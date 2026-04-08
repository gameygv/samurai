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

    // --- CARGAR BÓVEDA VISUAL (POSTERS) — filtrar expirados por valid_until o presale_ends_at ---
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions, ocr_content, presale_price, presale_ends_at, normal_price, nivel, profesor, sede, friday_concert, category').neq('category', 'PAYMENT').or(`valid_until.is.null,valid_until.gte.${today}`);
    let mediaContext = "\n=== BÓVEDA VISUAL (POSTERS) ===\nINSTRUCCIÓN CRÍTICA: Para enviar un poster usa EXACTAMENTE este formato en tu respuesta: <<MEDIA:url_del_poster>>\n";
    mediaAssets?.forEach(m => {
      let meta = `- ${m.title}: ${m.ai_instructions} -> <<MEDIA:${m.url}>>`;
      if (m.sede) meta += ` | Sede: ${m.sede}`;
      if (m.nivel) meta += ` | Nivel: ${m.nivel}`;
      if (m.profesor) meta += ` | Profesor: ${m.profesor}`;
      if (m.presale_price && m.presale_ends_at && m.presale_ends_at >= today) meta += ` | PREVENTA: $${m.presale_price} (hasta ${m.presale_ends_at})`;
      else if (m.normal_price) meta += ` | Precio: $${m.normal_price}`;
      if (m.friday_concert) meta += ` | Incluye concierto del viernes`;
      mediaContext += meta + '\n';
      if (m.ocr_content) mediaContext += `  DETALLE DEL POSTER: ${m.ocr_content.substring(0, 500)}\n`;
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

    // --- CARGAR WOOCOMMERCE & BANCOS (SOLO SI EL CIERRE AUTOMÁTICO ESTÁ ACTIVO) ---
    let wcContext = "";
    let bankInfo = "";
    let handoffRule = "";

    if (autoCloseEnabled) {
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
    } else {
        // SI EL CIERRE MANUAL ESTÁ ACTIVADO (Auto-Close Off)
        wcContext = "\n=== CATÁLOGO DE PRODUCTOS ===\n(PRECIOS Y LINKS NO DISPONIBLES. EL HUMANO LOS PROPORCIONARÁ.)\n";
        bankInfo = "NO DISPONIBLE - EL HUMANO PROPORCIONARÁ LA CUENTA.";
        
        handoffRule = `
### REGLA ESTRICTA DE CIERRE MANUAL (HANDOFF A HUMANO):
El asesor humano (${agentName}) ha decidido cerrar las ventas personalmente.
CUANDO EL CLIENTE MUESTRE INTENCIÓN DE COMPRA, PREGUNTE POR PRECIOS FINALES, MÉTODOS DE PAGO O DEPÓSITOS:
1. NO ofrezcas ni menciones cuentas bancarias.
2. NO proporciones enlaces de compra.
3. DETÉN el proceso de venta y responde exactamente algo similar a esto:
   "¡Excelente! En breve mi compañero(a) ${agentName} te contactará personalmente por aquí para brindarte los detalles de pago y ayudarte a completar tu registro."
`;
    }

    // --- CARGAR HISTORIAL ACADÉMICO DEL CONTACTO ---
    let academicContext = '';
    let profileContext = '';
    const leadId = lead.id ?? (lead as Record<string, unknown>).lead_id;
    if (leadId) {
      const { data: contactData } = await supabaseClient
        .from('contacts')
        .select('academic_record, dieta, alergias, motivo_curso')
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

      if (contactData?.dieta || contactData?.alergias || contactData?.motivo_curso) {
        profileContext = '\n=== PERFIL DEL ALUMNO ===\n';
        if (contactData.dieta) profileContext += `Dieta: ${contactData.dieta}\n`;
        if (contactData.alergias) profileContext += `Alergias: ${contactData.alergias}\n`;
        if (contactData.motivo_curso) profileContext += `Motivación: ${contactData.motivo_curso}\n`;
      }
    }

    // AQUI ESTÁ LA PROTECCIÓN CRÍTICA PARA DATOS Y PAGOS
    const activeLeadMemory = `
=== ESTADO ACTUAL DEL PROSPECTO (MEMORIA) ===
Nombre conocido: ${lead.nombre && !lead.nombre.includes('Nuevo') ? lead.nombre : 'NO PROPORCIONADO'}
Email capturado: ${lead.email || 'NO PROPORCIONADO'}
Ciudad: ${lead.ciudad || 'NO PROPORCIONADA'}

REGLAS ESTRICTAS DE MEMORIA Y VENTAS:
1. SI EL EMAIL O LA CIUDAD YA ESTÁN CAPTURADOS, NO VUELVAS A PEDIRLOS BAJO NINGUNA CIRCUNSTANCIA.
2. PAGOS: Si el cliente dice "ya pagué", "listo" o envía una imagen de comprobante, NUNCA le confirmes que el pago está validado o completo. Tu respuesta DEBE SER SIEMPRE: "¡Excelente! He recibido tu confirmación. En breve nuestro sistema automático o un asesor verificará el comprobante y validará tu acceso."
`;

    const voiceInstruction = `
### REGLA DE OJO DE HALCÓN (AUDICIÓN):
1. Cuentas con un módulo de transcripción avanzada (OpenAI Whisper). 
2. Si ves un mensaje que empieza con "[TRANSCRIPCIÓN DE NOTA DE VOZ]:", significa que el cliente te envió un audio y ya fue procesado para ti. 
3. RESPONDE como si hubieras escuchado el audio perfectamente.
`;

    const systemPrompt = `
${voiceInstruction}
${activeLeadMemory}
${handoffRule}

### REGLA TEMPORAL ESTRICTA:
La fecha de hoy es ${today}. NUNCA menciones, ofrezcas ni recomiendes talleres, cursos o eventos cuya fecha ya pasó. Si el cliente pregunta por un evento pasado, responde que ese ya ocurrió y ofrécele las próximas fechas disponibles. Si no hay próximas fechas, invítalo a dejar sus datos para avisarle cuando se abran nuevas fechas.

${getConfig('prompt_alma_samurai')}
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}
${getConfig('prompt_behavior_rules')}

${getConfig('prompt_relearning')}

${masterTruth}
${kbContext}
${mediaContext}
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