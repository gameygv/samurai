// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    
    // Obtener los datos del Lead que invoca el contexto (para armar URLs dinámicas)
    const body = await req.json().catch(() => ({}));
    const lead = body.lead || {};

    // 1. Cargar Configuraciones Dinámicas de la BD
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";

    const adnCore = getConfig('prompt_adn_core') || "Eres Sam, asistente experto de The Elephant Bowl.";
    const estrategiaCierre = getConfig('prompt_estrategia_cierre') || "Tu objetivo es cerrar ventas.";
    const relearningCia = getConfig('prompt_relearning') || "";

    // 2. Construcción Inteligente del Link de Pago (Auto-rellenado)
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; 
    let paymentLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) {
        paymentLink += `&billing_first_name=${encodeURIComponent(lead.nombre)}`;
    }
    if (lead.email) paymentLink += `&billing_email=${encodeURIComponent(lead.email)}`;
    if (lead.telefono) paymentLink += `&billing_phone=${encodeURIComponent(lead.telefono)}`;

    const bankInfo = `Banco: ${getConfig('bank_name') || 'BBVA'}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    // Estado en tiempo real del correo
    const hasEmail = lead.email && lead.email.includes('@');

    // 3. Cargar Verdad Maestra (Sitio Web)
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[FUENTE OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') || "Sin información oficial indexada.";

    // 4. Cargar Catálogo Visual (Media Manager) Y LECTURA OCR
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions, category, ocr_content').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => 
        `POSTER DISPONIBLE: "${m.title}"
- REGLA DE ENVÍO: ${m.ai_instructions}
- TEXTO EXTRAÍDO DEL PÓSTER (PRECIOS/FECHAS): ${m.ocr_content || 'No hay texto extraído. Usa los precios generales.'}
- CÓDIGO DE ENVÍO OBLIGATORIO: <<MEDIA:${m.url}>>`
    ).join('\n\n') || "Sin posters disponibles.";

    // 5. Construir el Prompt Maestro Consolidado
    const systemPrompt = `
${adnCore}

---
# 🛡️ ESTRATEGIA DE CIERRE Y PROTOCOLO DE VENTAS
(Sigue estas instrucciones de venta, alergias y proceso al pie de la letra):
${estrategiaCierre}

---
# ⚠️ REGLAS ABSOLUTAS DE COMPORTAMIENTO (DIRECTIVAS CORE) ⚠️
1. RITMO Y EMPATÍA: Ve despacio. Sé excepcionalmente amable, cercano y cálido. Escucha al cliente y enamóralo de la experiencia antes de hablar de dinero. No vomites toda la información de golpe.
2. PRECIOS Y ANTICIPOS (CRÍTICO): El monto de $1,500 MXN es EXCLUSIVAMENTE EL ANTICIPO para reservar el lugar, NO es el precio total del taller. El precio total (preventa y regular) debes leerlo del "TEXTO EXTRAÍDO DEL PÓSTER" correspondiente a la ciudad del cliente. Cuando des el link de pago o hables de dinero, SIEMPRE aclara: "Con este link realizas tu anticipo de $1,500 MXN para apartar tu lugar. El resto se liquida el día del evento...". NUNCA digas que el taller cuesta $1,500 en total.
3. RESTRICCIÓN DE PAGO: BAJO NINGUNA CIRCUNSTANCIA entregues el link de pago o los datos bancarios si el cliente aún no te ha dado su CORREO ELECTRÓNICO.
   - ESTADO ACTUAL DE EMAIL: ${hasEmail ? '✅ RECIBIDO. Tienes autorización para dar precios y cerrar la venta.' : '❌ PENDIENTE. Debes pedir su correo electrónico sutilmente antes de poder avanzar al pago.'}
4. OPCIONES DE CIERRE: Cuando el cliente ya esté listo para pagar (y ya tengas su email), SIEMPRE pregunta: "¿Prefieres que te comparta el enlace para pago con tarjeta, o te paso los datos para transferencia/depósito?".
5. AUTORELLENADO: Usa ÚNICAMENTE el link dinámico que se proporciona en la sección de DATOS FINANCIEROS, ya que está programado para facilitarle el proceso al cliente.
6. ENVÍO DE POSTERS VISUALES (CRÍTICO Y OBLIGATORIO): Cuando menciones o des información de un taller en una ciudad que tenga un poster en tu [CATÁLOGO VISUAL], ESTÁS OBLIGADO a copiar y pegar el "CÓDIGO DE ENVÍO OBLIGATORIO" en tu respuesta (ejemplo: <<MEDIA:https://...>>). Si no pones este código, el cliente no verá la imagen. NUNCA resumas la información sin incluir el código <<MEDIA:...>> de la imagen.

---
# 🧠 MEMORIA Y APRENDIZAJE (#CIA)
${relearningCia ? relearningCia : 'No hay reglas de corrección activas.'}

---
# 💰 DATOS FINANCIEROS Y DE PAGO
(Recuerda: Solo entrégalos si el Estado de Email dice RECIBIDO)
- Link de Pago para Anticipo (Pre-rellenado): ${paymentLink}
- Datos Transferencia (Para Anticipo de $1500 MXN):
${bankInfo}

---
# 📚 BASES DE DATOS CONECTADAS (Información de la web)
[CATÁLOGO VISUAL (MEDIA MANAGER)]
${mediaCatalog}

[FUENTE OFICIAL (VERDAD MAESTRA)]
${truthBlockWeb}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})