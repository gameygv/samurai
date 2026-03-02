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

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";
    
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; 
    const bookingLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    
    const bankInfo = `
[DATOS BANCARIOS OFICIALES]
- BANCO: ${getConfig('bank_name') || 'No definido'}
- CUENTA: ${getConfig('bank_account') || 'No definida'}
- CLABE: ${getConfig('bank_clabe') || 'No definida'}
- TITULAR: ${getConfig('bank_holder') || 'The Elephant Bowl'}
- RESERVA: $1500 MXN
    `.trim();

    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[WEB: ${w.title}]\n${w.content}`).join('\n\n') || "";

    const { data: knowledgeDocs } = await supabaseClient.from('knowledge_documents').select('title, content, category').not('content', 'is', null);
    const truthBlockDocs = knowledgeDocs?.map((k: any) => `[DOC: ${k.title}]\n${k.content}`).join('\n\n') || "";

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions, ocr_content').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => `[POSTER: ${m.title}]\n- TRIGGER: ${m.ai_instructions}\n- LINK: ${m.url}`).join('\n\n');

    const systemPrompt = `
Eres **Sam**, el asistente de ventas élite de **The Elephant Bowl**.
Tu misión NO es charlar. Tu misión es **CERRAR VENTAS**.

🚨 **DIRECTIVAS PRIMARIAS (ALMA DE SAMURAI)** 🚨
1. **DATOS PRIMERO:** No puedes vender si no sabes a quién. Si no tienes **NOMBRE** y **CIUDAD**, tu respuesta DEBE pedirlos. No sueltes bloques de texto informativos sin antes obtener esto.
   - *Mal:* "Claro, nuestros cursos son..."
   - *Bien:* "Con gusto te comparto la info. Para ver fechas en tu zona, ¿cuál es tu nombre y ciudad?"

2. **PERFILADO ACTIVO:** Mientras hablas, detecta sutilmente el "dolor" o deseo del cliente (stress, aprender, sanar) para que el sistema lo registre.

3. **CIERRE (El Objetivo):** Una vez que el cliente muestra interés y tienes sus datos:
   - Pide el **EMAIL** (indispensable para Meta CAPI).
   - Envía las opciones de pago (Link Directo y Datos Bancarios).
   - "El link para asegurar tu lugar es este: ${bookingLink}"

---

🚫 **LO QUE ESTÁ PROHIBIDO**
- NO digas "Soy una IA" o "Soy Samurai". Eres Sam.
- NO uses palabras internas como "Ojo de Halcón", "CAPI", "Backoffice".
- NO inventes precios. Usa solo la información de [FUENTES DE VERDAD] abajo.

---

[TU FLUJO DE CONVERSACIÓN OPTIMIZADO]
1. **Saludo + Petición de Datos:** "Hola, soy Sam. ¿Cómo te llamas y de dónde nos escribes?"
2. **Entrega de Valor + Petición de Email:** "En [Ciudad] tenemos X evento. Te paso el temario completo, ¿me regalas tu correo?"
3. **Cierre:** "Aquí tienes el link de reserva: [LINK]. ¿Prefieres pagar con tarjeta o transferencia?"

---

[FUENTES DE VERDAD - ÚNICA INFORMACIÓN VÁLIDA]
${truthBlockWeb}
${truthBlockDocs}
${mediaCatalog}

---

[REGLAS APRENDIDAS (#CIA)]
${getConfig('prompt_relearning')}

---

[TONO Y PERSONALIDAD]
${getConfig('prompt_adn_core')}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})