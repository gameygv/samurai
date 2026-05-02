import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

interface LeadData {
  id?: string | number;
  nombre?: string;
  email?: string;
  ciudad?: string;
  assigned_to?: string;
  [key: string]: unknown;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const lead: LeadData = (body.lead as LeadData) || {};
    const platform: string = (body.platform as string) || 'WHATSAPP';

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = ""): string => {
      const found = configs?.find((c: { key: string; value: unknown }) => c.key === key);
      return (found?.value as string) || def;
    };

    // --- FECHA DE HOY (usada en filtros y prompt) ---
    const today = new Date().toISOString().split('T')[0];

    // --- CARGAR VERDAD MAESTRA ---
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = `\n=== VERDAD MAESTRA (SITIO WEB) ===\nIMPORTANTE: La fecha de hoy es ${today}. NUNCA recomiendes talleres, cursos o eventos con fechas anteriores a hoy. Si el sitio web menciona eventos pasados, ignóralos y sugiere solo los que aún no han ocurrido.\n`;
    webPages?.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 1500)}\n`; });

    // --- CARGAR BASE DE CONOCIMIENTO ---
    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content').or(`valid_until.is.null,valid_until.gte.${today}`);
    let kbContext = "\n=== CONOCIMIENTO TÉCNICO (PDFs/NOTAS) ===\n";
    kbDocs?.forEach(d => { if(d.content) kbContext += `\n[RECURSO: ${d.title}]\n${d.content.substring(0, 1000)}\n`; });

    // --- CARGAR BÓVEDA VISUAL (Media Manager: General, Promoción, Aviso) ---
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, description, url, ai_instructions, ocr_content, start_date, valid_until, category').in('category', ['GENERAL', 'PROMOCION', 'AVISO']).or(`valid_until.is.null,valid_until.gte.${today}`);
    let mediaContext = "\n=== BÓVEDA VISUAL (MEDIA) ===\nINSTRUCCIÓN CRÍTICA: Para enviar una imagen usa EXACTAMENTE este formato en tu respuesta: <<MEDIA:url_de_imagen>>\n";
    mediaAssets?.forEach(m => {
      // Skip promotions that haven't started yet
      if (m.category === 'PROMOCION' && m.start_date && m.start_date > today) return;
      let meta = `- [${m.category}] ${m.title}: ${m.ai_instructions || 'Sin instrucciones'} -> <<MEDIA:${m.url}>>`;
      if (m.description) meta += ` | Descripción: ${m.description.substring(0, 200)}`;
      if (m.valid_until) meta += ` | Vigente hasta: ${m.valid_until}`;
      if (m.start_date) meta += ` | Inicio: ${m.start_date}`;
      mediaContext += meta + '\n';
      if (m.ocr_content) mediaContext += `  DETALLE: ${m.ocr_content.substring(0, 500)}\n`;
    });

    // --- CARGAR CATÁLOGO DE CURSOS Y TALLERES ---
    const { data: courses } = await supabaseClient.from('courses').select('*').eq('ai_enabled', true).or(`valid_until.is.null,valid_until.gte.${today}`);
    let coursesContext = "\n=== CATÁLOGO DE CURSOS Y TALLERES ===\nINSTRUCCIÓN: Para enviar el poster de un curso usa <<MEDIA:url_del_poster>>. Ofrece cursos activos basándote en las fechas y precios. Si la preventa está vigente, menciona el precio de preventa y la urgencia. Si sale_closes_at ya pasó, NO ofrezcas ese curso.\n";
    courses?.forEach(c => {
      // Skip courses past their sale closing date
      if (c.sale_closes_at && c.sale_closes_at < today) return;
      let meta = `- CURSO: ${c.title}`;
      if (c.description) meta += ` | ${c.description.substring(0, 200)}`;
      meta += ` -> <<MEDIA:${c.poster_url}>>`;
      if (c.sede) meta += ` | Sede: ${c.sede}`;
      if (c.nivel) meta += ` | Nivel: ${c.nivel}`;
      if (c.profesor) meta += ` | Profesor: ${c.profesor}`;
      if (c.presale_price && c.presale_ends_at && c.presale_ends_at >= today) {
        meta += ` | PREVENTA: $${c.presale_price} (hasta ${c.presale_ends_at}). Anticipo de $1500 disponible.`;
      } else if (c.normal_price) {
        meta += ` | Precio: $${c.normal_price}`;
      }
      if (c.sale_closes_at) meta += ` | Cierre de venta: ${c.sale_closes_at}`;
      if (c.extras) meta += ` | Extras: ${c.extras}`;
      if (c.session_dates && Array.isArray(c.session_dates) && c.session_dates.length > 0) {
        const sessions = c.session_dates.map((s: any) => `${s.date} ${s.start_time || ''}-${s.end_time || ''}`).join(', ');
        meta += ` | Fechas: ${sessions}`;
      }
      if (c.ai_instructions) meta += `\n  TRIGGER: ${c.ai_instructions}`;
      coursesContext += meta + '\n';
      if (c.ocr_content) coursesContext += `  DETALLE DEL POSTER: ${c.ocr_content.substring(0, 500)}\n`;
    });

    // --- EVALUAR CONFIGURACIÓN DE CIERRE Y AGENTE ---
    let autoCloseEnabled = true;
    let agentName = "un asesor";
    
    if (lead.assigned_to) {
        // Obtener nombre del agente
        const { data: agentData } = await supabaseClient.from('profiles').select('full_name').eq('id', lead.assigned_to).maybeSingle();
        if (agentData?.full_name) agentName = agentData.full_name.split(' ')[0]; // Solo el primer nombre

        // Verificar si el agente apagó el cierre automático
        const closingConfigRaw = getConfig(`agent_closing_${lead.assigned_to}`);
        if (closingConfigRaw) {
            try {
                const closingConfig = JSON.parse(closingConfigRaw);
                if (closingConfig.auto_close === false) autoCloseEnabled = false;
            } catch(e) {}
        }
    }

    // --- CARGAR WOOCOMMERCE & BANCOS (SIEMPRE — la IA intenta cerrar la venta) ---
    let wcContext = "";
    let bankInfo = "";
    let handoffRule = "";

    // WooCommerce: siempre cargar si existe
    const wcProductsRaw = getConfig('wc_products');
    if (wcProductsRaw) {
        try {
            const wcProducts = JSON.parse(wcProductsRaw);
            const wcUrl = getConfig('wc_url', '').replace(/\/$/, '');
            let wcCheckout = getConfig('wc_checkout_path', '/checkout/');
            if (!wcCheckout.startsWith('/')) wcCheckout = '/' + wcCheckout;

            if (wcProducts.length > 0) {
                wcContext = "\n=== CATÁLOGO DE PRODUCTOS (TIENDA ONLINE WOOCOMMERCE) ===\n";
                (wcProducts as Array<{ wc_id: string; title: string; price: string; prompt: string }>).forEach(p => {
                    const link = `${wcUrl}${wcCheckout}?add-to-cart=${p.wc_id}`;
                    wcContext += `- PRODUCTO: ${p.title}\n  PRECIO: $${p.price}\n  LINK DE COMPRA: ${link}\n  REGLA DE VENTA E INSTRUCCIÓN IA: ${p.prompt}\n\n`;
                });
            }
        } catch (e) {}
    }

    // Banco: cargar global, luego override por agente si tiene cuenta propia
    bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    if (lead.assigned_to) {
        const agentBankRaw = getConfig(`agent_bank_${lead.assigned_to}`);
        if (agentBankRaw) {
            try {
                const agentBank = JSON.parse(agentBankRaw);
                if (agentBank.enabled) {
                    bankInfo = `Banco: ${agentBank.bank_name}\nCuenta: ${agentBank.bank_account}\nCLABE: ${agentBank.bank_clabe}\nTitular: ${agentBank.bank_holder}`;
                }
            } catch(e) {}
        }
    }

    // Detectar si hay datos bancarios reales configurados
    const hasBankData = getConfig('bank_name') || (lead.assigned_to && getConfig(`agent_bank_${lead.assigned_to}`));
    const hasWcProducts = wcContext.length > 100;

    handoffRule = `
### REGLA DE CIERRE DE VENTA:
Tu objetivo es CERRAR la venta tú mismo. NUNCA derives al humano excepto si el cliente lo pide o si no tienes los datos necesarios.

PROCESO DE CIERRE:
1. Cuando el cliente quiera pagar o inscribirse:
${hasWcProducts ? '   - PRIMERO ofrece el link de pago en línea (WooCommerce) si hay un producto que corresponda.' : ''}
${hasBankData ? '   - TAMBIÉN ofrece los datos bancarios para transferencia/depósito del anticipo de $1,500 MXN.' : '   - NO tienes datos bancarios configurados. En este caso sí deriva al humano para el cobro.'}
2. Si el cliente pide hablar con un humano o pide atención personal → ahí sí responde: "¡Con gusto! En breve ${agentName} te atenderá personalmente por aquí."
3. Si no sabes algo o no tienes la información → responde honestamente y ofrece que ${agentName} puede resolver su duda.
4. NUNCA digas "te contactará un humano" si tú puedes resolver la situación.
`;


    // --- CARGAR HISTORIAL ACADÉMICO DEL CONTACTO ---
    let academicContext = '';
    let profileContext = '';
    const leadId = lead.id ?? (lead as Record<string, unknown>).lead_id;
    if (leadId) {
      const { data: contactData } = await supabaseClient
        .from('contacts')
        .select('academic_record, dieta, alergias, motivo_curso, genero')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (contactData?.academic_record) {
        const records = Array.isArray(contactData.academic_record)
          ? contactData.academic_record
          : JSON.parse(contactData.academic_record as string);

        if (records.length > 0) {
          academicContext = '\n=== HISTORIAL ACADÉMICO DEL CLIENTE ===\n';
          academicContext += 'IMPORTANTE: Este cliente YA tomó estos cursos. NO los vuelvas a ofrecer. Sugiere el siguiente nivel o cursos complementarios.\n';
          (records as Array<{ course?: string; nivel?: string; location?: string; date?: string }>).forEach((r) => {
            academicContext += `- ${r.course || 'Curso desconocido'}`;
            if (r.nivel) academicContext += ` (${r.nivel})`;
            if (r.location) academicContext += ` en ${r.location}`;
            if (r.date) academicContext += ` — ${r.date}`;
            academicContext += '\n';
          });
        }
      }

      if (contactData?.dieta || contactData?.alergias || contactData?.motivo_curso || contactData?.genero) {
        profileContext = '\n=== PERFIL DEL ALUMNO ===\n';
        if (contactData.genero) profileContext += `Género: ${contactData.genero}\n`;
        if (contactData.dieta) profileContext += `Dieta: ${contactData.dieta}\n`;
        if (contactData.alergias) profileContext += `Alergias: ${contactData.alergias}\n`;
        if (contactData.motivo_curso) profileContext += `Motivación: ${contactData.motivo_curso}\n`;
      }
    }

    // AQUI ESTÁ LA PROTECCIÓN CRÍTICA PARA DATOS Y PAGOS
    // Detectar si el lead viene de un canal sin teléfono real (Messenger, Instagram)
    const phoneRaw = lead.telefono || '';
    const hasRealPhone = phoneRaw.length >= 10 && !phoneRaw.startsWith('mc_') && !phoneRaw.startsWith('messenger:') && !phoneRaw.startsWith('ig_');
    const isNonWhatsApp = phoneRaw.startsWith('mc_') || phoneRaw.startsWith('messenger:') || phoneRaw.startsWith('ig_');
    const whatsappRule = isNonWhatsApp && !hasRealPhone
      ? `\n5. CAPTURA DE WHATSAPP (PRIORIDAD ALTA — CANAL NO-WHATSAPP): Este cliente te está escribiendo por ${phoneRaw.startsWith('mc_') || phoneRaw.startsWith('messenger:') ? 'Facebook Messenger' : 'Instagram'}. NO tenemos su número de WhatsApp. En cuanto la conversación lo permita de forma natural (después del primer intercambio, no en el primer mensaje), pregúntale su número de WhatsApp. Ejemplos: "Para darte un seguimiento más personalizado, ¿me compartes tu número de WhatsApp?", "¿Tienes WhatsApp donde pueda enviarte más información?". Si ya lo proporcionó, NO lo pidas de nuevo.`
      : '';

    const activeLeadMemory = `
=== ESTADO ACTUAL DEL PROSPECTO (MEMORIA) ===
Nombre conocido: ${lead.nombre && !lead.nombre.includes('Nuevo') ? lead.nombre : 'NO PROPORCIONADO'}
Teléfono/WhatsApp: ${hasRealPhone ? phoneRaw : 'NO PROPORCIONADO'}
Email capturado: ${lead.email || 'NO PROPORCIONADO'}
Ciudad: ${lead.ciudad || 'NO PROPORCIONADA'}
Canal de contacto: ${isNonWhatsApp ? (phoneRaw.startsWith('mc_') || phoneRaw.startsWith('messenger:') ? 'Facebook Messenger' : 'Instagram') : 'WhatsApp'}

REGLAS ESTRICTAS DE MEMORIA Y VENTAS:
1. SI EL EMAIL O LA CIUDAD YA ESTÁN CAPTURADOS, NO VUELVAS A PEDIRLOS BAJO NINGUNA CIRCUNSTANCIA.
2. PAGOS: Si el cliente dice "ya pagué", "listo" o envía una imagen de comprobante, NUNCA le confirmes que el pago está validado o completo. Tu respuesta DEBE SER SIEMPRE: "¡Excelente! He recibido tu confirmación. En breve nuestro sistema automático o un asesor verificará el comprobante y validará tu acceso."
3. CAPTURA DE EMAIL (PRIORIDAD ALTA): Cuando el cliente muestre interés real (pregunta precios, fechas, quiere inscribirse), pídele su correo electrónico de forma natural. Ejemplos: "Para enviarte la información completa y tu confirmación, ¿me compartes tu correo electrónico?", "¿A qué email te envío los detalles del taller?". El email es CRÍTICO para el seguimiento. Si ya está capturado, NO lo pidas de nuevo.
4. RECOPILACIÓN DE DATOS PERSONALES: Cuando la conversación avance hacia la etapa de cierre (el cliente muestra interés alto o pregunta por precios/inscripción), además del email y ciudad, pregunta de forma natural: dieta (vegetariana, vegana, omnívora, etc.), alergias alimentarias, y con qué género se identifica (hombre, mujer, otro). Hazlo de forma cálida y natural, no como un formulario. Si alguno de estos datos ya está capturado, NO lo preguntes de nuevo.${whatsappRule}
`;

    const voiceInstruction = `
### REGLA DE OJO DE HALCÓN (AUDICIÓN):
1. Cuentas con un módulo de transcripción avanzada (OpenAI Whisper).
2. Si ves un mensaje que empieza con "[TRANSCRIPCIÓN DE NOTA DE VOZ]:", significa que el cliente te envió un audio y ya fue procesado para ti.
3. RESPONDE como si hubieras escuchado el audio perfectamente.

### REGLA DE CONTINUIDAD (NUNCA PARAR):
1. Si ves mensajes de HUMANO en el historial, eso puede ser un vendedor que escribió algo desde el teléfono. Eso NO significa que tomó control de la conversación.
2. TÚ SIGUES SIENDO EL RESPONSABLE de la conversación. Continúa atendiendo al cliente normalmente.
3. Solo dejas de responder si el sistema te desactiva — eso no es tu decisión, es del sistema.
4. Si un vendedor escribió algo útil (como datos de pago o confirmaciones), puedes complementar su mensaje pero NUNCA dejes de atender.
`;

    const memoryRule = `
### REGLA DE MEMORIA Y CONTINUIDAD (ANTI-REPETICIÓN):
1. REVISA TODO EL HISTORIAL antes de responder. Cada mensaje tiene fecha y hora entre corchetes — úsalas para entender la línea temporal.
2. NUNCA saludes como si fuera la primera vez si ya existe conversación previa. Si ya hablaste con el cliente antes, ve directo al tema o di "¡Hola de nuevo!" brevemente.
3. NUNCA repitas información que ya compartiste (cursos, descripciones, posters, instrucciones de pago). Si ya enviaste un poster o recomendaste un curso, no lo vuelvas a hacer salvo que el cliente lo pida.
4. Si el cliente ya respondió una pregunta (nombre, ciudad, email, interés), NO la vuelvas a hacer.
5. Si han pasado varios días desde el último mensaje, puedes retomar con un saludo breve pero NO repitas el pitch completo.
6. Mantén coherencia: si en un mensaje anterior dijiste algo, no te contradigas en el siguiente.
7. Si en el historial ves que PROMETISTE enviar un poster o información específica PERO NO LO HICISTE (el poster no fue adjuntado), discúlpate brevemente: "Disculpa, hubo un problema técnico. Aquí te envío el poster:" y ahora sí inclúyelo con <<MEDIA:url>>.
8. Si el historial muestra que el cliente escribió algo y NO recibió respuesta (gap largo sin mensaje IA), empieza con: "Disculpa la demora en responder." y atiende su pregunta directamente.

### PRIMER CONTACTO — REGLA DE EFICIENCIA:
Cuando un lead nuevo escribe por primera vez (generalmente "¡Hola! Quiero más información."):
1. Salúdalo cálidamente usando su nombre si lo tienes.
2. Preséntate como asistente de Tepoz Cuencos brevemente (1 línea).
3. Pregunta SOLO su ciudad para poder recomendarle el taller más cercano. NO pidas nombre si ya lo tienes del contacto de WhatsApp.
4. NO hagas un pitch genérico de "tenemos talleres en varias ciudades". Sé directo: "¿En qué ciudad te encuentras para recomendarte el taller más cercano?"
`;

    const systemPrompt = `
${voiceInstruction}
${memoryRule}
${activeLeadMemory}
${handoffRule}

### REGLA TEMPORAL ESTRICTA:
La fecha de hoy es ${today}. NUNCA menciones, ofrezcas ni recomiendes talleres, cursos o eventos cuya fecha ya pasó. Si el cliente pregunta por un evento pasado, responde que ese ya ocurrió y ofrécele las próximas fechas disponibles. Si no hay próximas fechas, invítalo a dejar sus datos para avisarle cuando se abran nuevas fechas.

### ⚠️ REGLA TEMPORAL — NO MENCIONAR PRECIOS (PENDIENTE DE REVERTIR)
INSTRUCCIÓN CRÍTICA TEMPORAL: NO debes mencionar precios específicos de cursos, talleres ni productos bajo NINGUNA circunstancia.
- NO digas el precio normal, ni el precio de preventa.
- SÍ menciona que pueden apartar su lugar con un anticipo (sin decir el monto exacto). Ejemplo: "Puedes apartar tu lugar con un anticipo y pagar el resto el día del taller."
- SÍ puedes dar información del curso: descripción, fechas, sede, profesor, nivel, extras.
- SÍ puedes generar interés y entusiasmo por el curso.
- Si el cliente pregunta por el precio, responde: "¡Con gusto! Para darte los detalles de inversión y opciones de pago, permíteme conectarte con un asesor que te dará toda la información." y luego indica que un asesor lo contactará en breve.
- NO envíes links de pago WooCommerce ni datos bancarios hasta que se revierta esta regla.
- Esta regla tiene PRIORIDAD sobre cualquier otra instrucción de cierre de venta o precios.

### REGLA DE POSTER (OBLIGATORIO):
- SIEMPRE envía el poster del curso con <<MEDIA:url_del_poster>> cuando recomiendes un curso específico. Es OBLIGATORIO. No digas "te comparto el poster" sin incluir el tag <<MEDIA:url>>.
- El poster se envía como imagen adjunta automáticamente al incluir el tag.

### MAPA DE PROXIMIDAD GEOGRÁFICA (SEDES ACTIVAS):
Usa esta guía para recomendar la sede MÁS CERCANA al cliente. SIEMPRE prioriza la ciudad más cercana, luego la segunda más cercana como alternativa.

Desde LEÓN, GTO → 1° Aguascalientes (120km), 2° Juriquilla/Querétaro (180km)
Desde QUERÉTARO → 1° Juriquilla (misma zona), 2° Aguascalientes (220km)
Desde CDMX/DF → 1° Coyoacán (misma ciudad), 2° Toluca (70km), 3° Puebla (130km)
Desde GUADALAJARA → 1° Aguascalientes (250km), 2° León/Juriquilla (300km)
Desde MONTERREY → 1° Monterrey (misma ciudad)
Desde AGUASCALIENTES → 1° Aguascalientes (misma ciudad), 2° León/Juriquilla (120km)
Desde SAN LUIS POTOSÍ → 1° Aguascalientes (190km), 2° Juriquilla (200km)
Desde MORELIA → 1° Toluca (250km), 2° Juriquilla (290km)
Desde PUEBLA → 1° Puebla (misma ciudad), 2° Coyoacán/CDMX (130km)
Desde OAXACA → 1° Oaxaca (misma ciudad), 2° Puebla (340km)
Desde CANCÚN/RIVIERA MAYA → 1° Cancún/Playa del Carmen (zona), 2° Mérida (310km)
Desde MÉRIDA → 1° Mérida (misma ciudad), 2° Cancún (310km)
Para cualquier otra ciudad: busca la sede más lógicamente cercana por región geográfica.

NUNCA sugieras una sede lejana si hay una más cercana con fechas próximas. Si la sede más cercana tiene el curso próximo, recomiéndala primero. Si la segunda opción tiene una fecha más próxima, menciónala como alternativa.

${getConfig('prompt_alma_samurai')}
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}
${getConfig('prompt_behavior_rules')}

${getConfig('prompt_relearning')}

${masterTruth}
${kbContext}
${mediaContext}
${coursesContext}
${wcContext}

=== DATOS DE PAGO BANCARIO ===
${bankInfo}
${academicContext}${profileContext}`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: corsHeaders })
  }
})