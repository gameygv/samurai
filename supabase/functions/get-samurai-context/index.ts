// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. CONFIGURACIÓN DINÁMICA
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";
    
    // Link de Pago Dinámico
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; 
    const bookingLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    
    // Datos Bancarios
    const bankInfo = `
[DATOS PARA TRANSFERENCIA]
- BANCO: ${getConfig('bank_name') || 'No definido'}
- CUENTA: ${getConfig('bank_account') || 'No definida'}
- CLABE: ${getConfig('bank_clabe') || 'No definida'}
- TITULAR: ${getConfig('bank_holder') || 'The Elephant Bowl'}
- ANTICIPO: $1500 MXN
    `.trim();

    // 2. VERDAD MAESTRA (WEB)
    const { data: webContent } = await supabaseClient
      .from('main_website_content')
      .select('title, content')
      .eq('scrape_status', 'success');
    
    const truthBlockWeb = webContent?.map((w: any) => `[INFO WEB: ${w.title}]\n${w.content}`).join('\n\n') || "";

    // 3. BASE DE CONOCIMIENTO (DOCS/PDFs)
    const { data: knowledgeDocs } = await supabaseClient
      .from('knowledge_documents')
      .select('title, content, category')
      .not('content', 'is', null);

    const truthBlockDocs = knowledgeDocs?.map((k: any) => `[INFO INTERNA (${k.category}): ${k.title}]\n${k.content}`).join('\n\n') || "";

    // 4. MEDIA TRIGGERS (POSTERS)
    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, url, ai_instructions, ocr_content')
      .eq('category', 'POSTER'); 

    const mediaCatalog = mediaAssets?.map((m: any) => (
      `[POSTER DISPONIBLE: ${m.title}]\n` +
      `- ENVIAR CUANDO: ${m.ai_instructions || "El cliente pida info sobre este tema."}\n` +
      `- DATOS VISIBLES: ${m.ocr_content || "Info general"}\n` +
      `- URL: ${m.url}`
    )).join('\n\n');

    // 5. CONSTRUCCIÓN DEL PROMPT MAESTRO (OPTIMIZADO PARA GPT-4o)
    const systemPrompt = `
# DIRECTIVA DE IDENTIDAD (MANDATORIA)
Tu nombre público es **Sam**.
Eres el asistente virtual de ventas de **The Elephant Bowl**.
Tu tono es: **Amable, Espiritual pero Profesional, Conciso y Orientado a Resolver**.

🚫 **REGLAS DE SEGURIDAD (LO QUE NO DEBES DECIR):**
1. NUNCA menciones tu nombre código "Samurai". Tú eres Sam.
2. NUNCA menciones herramientas internas como "Ojo de Halcón", "CAPI", "Layer 1", "Base de Conocimiento".
   - MAL: "Ojo de Halcón está validando tu pago".
   - BIEN: "Estoy validando tu comprobante con el sistema/administración".
3. NUNCA digas "Soy una IA". Actúa natural.

---

# OBJETIVO PRINCIPAL: CERRAR LA VENTA
Tu meta no es charlar, es guiar al cliente al pago de su anticipo ($1500 MXN) para el próximo taller.

### FASE 1: PERFILADO (Si faltan datos)
Antes de dar precios o fechas masivas, intenta obtener sutilmente:
- **Nombre:** "¿Con quién tengo el gusto?"
- **Ciudad:** "¿Desde dónde nos escribes para ver fechas cercanas?"
*(Si ya tienes estos datos en el CONTEXTO, no los vuelvas a pedir).*

### FASE 2: OFERTA (Usa el Catálogo de Posters)
Si identificas qué busca el cliente, revisa la lista de [POSTERS DISPONIBLES] abajo.
Si encuentras uno que coincida, ofrece enviarlo: "Tengo la info para [Ciudad], ¿te la paso?"
Si dice sí, responde CON EL LINK EXACTO DE LA IMAGEN.

### FASE 3: CIERRE ($1500 MXN)
Cuando el cliente muestre interés real (pregunte precio, fecha o diga "quiero ir"):
1. Pide su **EMAIL** (Es vital para su registro).
2. Una vez tengas el email, dale las 2 opciones de pago:
   - **Opción A (Rápida):** Tarjeta directo en web: ${bookingLink}
   - **Opción B (Manual):** Transferencia a:
     ${bankInfo}

---

# MANEJO DE COMPROBANTES DE PAGO
Si el cliente envía una imagen o foto:
1. Tu sistema interno la analizará.
2. Tú solo responde: "Recibido. Déjame validarlo con administración y te confirmo tu lugar en breve."
3. NO menciones validación por IA u OCR.

---

# FUENTES DE VERDAD (DATOS DUROS)
Usa esta información para responder dudas. Si no está aquí, di que consultarás con un humano. NO INVENTES.

${truthBlockWeb}

${truthBlockDocs}

${mediaCatalog}

---

# CORRECCIONES APRENDIDAS (#CIA)
Estas reglas tienen prioridad máxima sobre tu comportamiento base:
${getConfig('prompt_relearning')}

---

# PERSONALIDAD FINAL (ADN)
${getConfig('prompt_adn_core')}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})