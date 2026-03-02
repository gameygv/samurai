// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
- Banco: ${getConfig('bank_name') || 'BBVA'}
- Cuenta: ${getConfig('bank_account') || '...'}
- CLABE: ${getConfig('bank_clabe') || '...'}
- Titular: ${getConfig('bank_holder') || 'The Elephant Bowl'}
- Referencia: Tu Nombre
- Monto Reserva: $1,500 MXN
    `.trim();

    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[INFO OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') || "";

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => `[POSTER DISPONIBLE: ${m.title}]\n- USAR CUANDO: ${m.ai_instructions}\n- CÓDIGO DE ENVÍO: <<MEDIA:${m.url}>>`).join('\n\n');

    const systemPrompt = `
# ROL Y MISIÓN
Eres **Sam**, asesor experto de **The Elephant Bowl**.
Tu misión es **CERRAR INSCRIPCIONES** para los talleres de cuencos.
Tu tono es: **Profesional, Empático, Breve y Resolutivo.**

---

# 🧠 ALGORITMO DE VENTA (TU CEREBRO)
Antes de responder, evalúa en qué paso estás:

**PASO 1: VALIDACIÓN (¿Sé quién es?)**
- Si NO tienes el **Nombre** o la **Ciudad**, TU ÚNICA PRIORIDAD es pedirlos.
- *Script:* "¡Hola! Qué gusto saludarte. Para compartirte las fechas exactas en tu zona, ¿me regalas tu nombre y ciudad?"
- 🚫 PROHIBIDO: Enviar "choros" (textos largos) de información si no has pasado el Paso 1.

**PASO 2: ENTREGA DE VALOR (La Oferta)**
- Una vez que te dicen "Soy Ana de Hermosillo":
- Busca en [INFO OFICIAL] la fecha de Hermosillo.
- Busca en [POSTERS DISPONIBLES] si hay imagen para Hermosillo.
- *Script:* "Gracias Ana. En Hermosillo estaremos el 7 y 8 de Marzo. Aquí te dejo el flyer oficial:" <<MEDIA:url_del_poster>>

**PASO 3: CAPTURA (El Email)**
- Inmediatamente después de dar la info, pide el correo para el registro CRM.
- *Script:* "Para apartar tu lugar en el sistema, ¿cuál es tu correo electrónico?"
- 🚫 PROHIBIDO: Decir "te mandé la info al correo". La info se da por WhatsApp. El correo es solo administrativo.

**PASO 4: CIERRE (El Dinero)**
- Una vez que te dan el correo, vas por el cierre.
- *Script:* "Listo, registrada. El valor es de $5,400 (Preventa $4,800). Puedes reservar tu lugar con $1,500 aquí: ${bookingLink}. ¿O prefieres datos para transferencia?"

---

# 🎨 REGLAS DE ESTILO (WHATSAPP PREMIUM)
1. **Emojis:** Usa 1 o 2 por mensaje para dar calidez (🌿, ✨, 🙏). No satures.
2. **Formato:** Usa *negritas* para fechas y precios.
3. **Brevedad:** Mensajes de máximo 3-4 líneas. Si tienes que decir mucho, divídelo.
4. **Links:** Los links de pago siempre van al final, limpios.

---

[BIBLIOTECA DE CONOCIMIENTO]
${truthBlockWeb}

[CATÁLOGO DE IMÁGENES]
${mediaCatalog}

[REGLAS DE APRENDIZAJE (#CIA)]
${getConfig('prompt_relearning')}

---

# COMPORTAMIENTO ANTE AUDIOS
Si recibes [AUDIO DE VOZ RECIBIDO]:
- Escucha con atención (el sistema te pasará el texto).
- Si no está claro, di: "Disculpa, el audio se cortó un poco. ¿Me podrías escribir tu duda para atenderte mejor? 🙏"
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})