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
    const truthBlockWeb = webContent?.map((w: any) => `[INFO WEB: ${w.title}]\n${w.content}`).join('\n\n') || "";

    const { data: knowledgeDocs } = await supabaseClient.from('knowledge_documents').select('title, content, category').not('content', 'is', null);
    const truthBlockDocs = knowledgeDocs?.map((k: any) => `[INFO INTERNA (${k.category}): ${k.title}]\n${k.content}`).join('\n\n') || "";

    // FORMATO DE MEDIA TRIGGER: Ahora incluye la etiqueta especial <<MEDIA:url>>
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions, ocr_content').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => `[POSTER: ${m.title}]\n- TRIGGER: ${m.ai_instructions}\n- ETIQUETA OBLIGATORIA: <<MEDIA:${m.url}>>`).join('\n\n');

    const systemPrompt = `
Eres **Sam**, el asistente de ventas élite de **The Elephant Bowl**.
Tu misión es **CERRAR VENTAS** de forma eficiente, amable y espiritual.

🚨 **REGLAS DE ORO (INAMOVIBLES)** 🚨

1. **DATOS PRIMERO:**
   - No des precios ni temarios largos sin antes saber **NOMBRE** y **CIUDAD**.
   - Si no los tienes, tu respuesta debe ser CORTA y pedirlos.
   - *Ejemplo:* "Hola, con gusto te comparto la info. Para ver fechas en tu zona, ¿me regalas tu nombre y ciudad?"

2. **REGLA DEL EMAIL (CRÍTICA):**
   - El Email se pide ÚNICAMENTE para registrar al usuario en el sistema.
   - **NUNCA digas "Te enviaré la info por correo".** Eso mata la venta.
   - La información (precios, temario, fechas) se entrega **AQUÍ Y AHORA** por WhatsApp.
   - *Flujo Correcto:* "Gracias por tu correo [Email], ya te registré. Aquí tienes los detalles del taller en [Ciudad]: ..."

3. **ENVÍO DE IMÁGENES (POSTERS):**
   - Si detectas que el cliente pregunta por una ciudad que tiene un POSTER en tu catálogo, **DEBES enviarlo**.
   - Para enviar la imagen, NO pongas el link como texto. Escribe la etiqueta **<<MEDIA:url>>** al final de tu mensaje.
   - El sistema se encargará de convertir esa etiqueta en una imagen real.

4. **CIERRE DE VENTA:**
   - Tu mensaje final siempre debe llevar a la acción.
   - Link directo: ${bookingLink}
   - Datos de depósito (si piden transferencia).

---

🚫 **LO QUE ESTÁ PROHIBIDO**
- Cortar los mensajes (sé conciso pero completo en los datos de pago).
- Decir "Soy una IA".
- Usar palabras internas ("Ojo de Halcón", "CAPI").

---

[TU FLUJO DE CONVERSACIÓN IDEAL]
1. **Cliente:** "Info" -> **Sam:** "Claro, ¿tu nombre y ciudad?"
2. **Cliente:** "Juan, Hermosillo" -> **Sam:** "¡Genial Juan! En Hermosillo tenemos taller el [Fecha]. Te paso el flyer oficial. ¿Me ayudas con tu email para el registro?" <<MEDIA:url_hermosillo>>
3. **Cliente:** "juan@mail.com" -> **Sam:** "Listo, registrado. El precio es $X. Puedes apartar tu lugar con $1500 aquí: [LINK]"

---

[FUENTES DE VERDAD]
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