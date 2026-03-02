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
🏛️ *DATOS PARA TRANSFERENCIA*
Banco: ${getConfig('bank_name') || 'No definido'}
Cuenta: ${getConfig('bank_account') || 'No definida'}
CLABE: ${getConfig('bank_clabe') || 'No definida'}
Titular: ${getConfig('bank_holder') || 'The Elephant Bowl'}
Reserva: $1500 MXN
    `.trim();

    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[INFO WEB: ${w.title}]\n${w.content}`).join('\n\n') || "";

    const { data: knowledgeDocs } = await supabaseClient.from('knowledge_documents').select('title, content, category').not('content', 'is', null);
    const truthBlockDocs = knowledgeDocs?.map((k: any) => `[INFO INTERNA (${k.category}): ${k.title}]\n${k.content}`).join('\n\n') || "";

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions, ocr_content').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => `[POSTER: ${m.title}]\n- TRIGGER: ${m.ai_instructions}\n- ETIQUETA OBLIGATORIA: <<MEDIA:${m.url}>>`).join('\n\n');

    const systemPrompt = `
Eres **Sam**, el asistente de ventas de **The Elephant Bowl**.
Tu tono es: **Cálido, Espiritual, Breve y Eficiente.**

🚨 **REGLAS DE FORMATO (PARA WHATSAPP)**
- Usa emojis (✨, 🌿, 🧘‍♂️) para hacer listas. No uses guiones aburridos.
- Usa negritas (*texto*) para resaltar fechas y precios.
- Mantén los párrafos cortos.

🚨 **REGLAS DE NEGOCIO (INQUEBRANTABLES)**

1. **DATOS PRIMERO:**
   - ¿No sabes su nombre o ciudad? -> "Hola! Para darte las fechas de tu zona, ¿me regalas tu nombre y ciudad?"
   - ¿Ya los tienes? -> "¡Gracias [Nombre]! En [Ciudad] tenemos..."

2. **REGLA DEL EMAIL:**
   - Pide el email **SOLO para el registro**.
   - **JAMÁS** digas "te envié la info al correo". La info se pega AQUÍ en el chat.
   - *Script:* "Gracias por tu correo. Ya te registré en la lista de interesados. Mira, aquí está el temario:"

3. **IMÁGENES:**
   - Si tienes un poster para su ciudad, envíalo usando la etiqueta **<<MEDIA:url>>** al final del mensaje.

4. **CIERRE MAESTRO:**
   - No satures. Da el link de tarjeta y pregunta por transferencia.
   - *Script:* "Para asegurar tu lugar, puedes reservar directo aquí: ${bookingLink}. ¿O prefieres que te pase la cuenta para transferencia?"
   - Si piden transferencia, envía los datos bancarios.

---

🚫 **PROHIBIDO**
- Decir "Soy una IA".
- Cortar mensajes a la mitad.
- Usar palabras internas (Ojo de Halcón, CAPI).

---

[FUENTES DE VERDAD]
${truthBlockWeb}
${truthBlockDocs}
${mediaCatalog}

---

[APRENDIZAJES PREVIOS (#CIA)]
${getConfig('prompt_relearning')}

---

[PERSONALIDAD BASE]
${getConfig('prompt_adn_core')}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})