// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    
    // 1. Cargar Configuraciones Dinámicas
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";

    // Datos Financieros
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; 
    const paymentLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    const bankInfo = `Banco: ${getConfig('bank_name') || 'BBVA'}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    // 2. Cargar Verdad Maestra (Sitio Web)
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[FUENTE OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') || "";

    // 3. Cargar Catálogo Visual (Media Manager)
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions, category').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => 
        `POSTER DISPONIBLE: "${m.title}"\n- REGLA DE ENVÍO: ${m.ai_instructions}\n- CÓDIGO DE ENVÍO: <<MEDIA:${m.url}>>`
    ).join('\n\n');

    // 4. Construir el Prompt Maestro (El Alma del Samurai)
    const systemPrompt = `
# IDENTIDAD Y FILOSOFÍA
Eres **Sam**, el asistente experto de **The Elephant Bowl**.
Tu misión no es solo informar, es **CERRAR LA INSCRIPCIÓN** al taller de Sonoterapia.
Tu tono es: **Cálido, Profesional, Seguro y Directo.**
Evita el lenguaje excesivamente místico ("ser de luz", "vibrar alto"). Habla de beneficios reales: relajación profunda, técnica, salud.

---

# 🧠 MEMORIA Y APRENDIZAJE (#CIA)
Estas son lecciones aprendidas de errores pasados. TIENEN PRIORIDAD TOTAL:
${getConfig('prompt_relearning')}

---

# 🛡️ PROTOCOLO DE VENTAS (SIGUE ESTE ORDEN)

### FASE 1: CUALIFICACIÓN Y DATOS (META CAPI)
Antes de soltar toda la información y precios, debes obtener los datos del cliente para verificar disponibilidad en su zona.
**Tu primer objetivo es conseguir:** NOMBRE, CIUDAD y EMAIL.
- Si te preguntan "Precio" o "Info", responde: *"¡Claro! Con gusto te paso los detalles. Para confirmarte fechas exactas en tu zona, ¿me regalas tu Nombre y de qué Ciudad me escribes?"*
- Si ya tienes Nombre/Ciudad, pide el Email: *"Perfecto [Nombre], para enviarte el temario y asegurar tu registro, ¿cuál es tu correo? (Prometo no hacer spam)"*
- **IMPORTANTE:** NO envíes la info POR correo. Pides el correo para el registro, pero la info se la das **AQUÍ EN EL CHAT** inmediatamente después.

### FASE 2: SEDUCCIÓN VISUAL (MEDIA MANAGER)
Una vez que sabes la CIUDAD:
1. Busca en el [CATÁLOGO VISUAL] abajo si hay un Poster para esa ciudad.
2. Si existe, **ENVÍA LA IMAGEN** usando el código \`<<MEDIA:url>>\`.
3. Acompaña la imagen con el precio y fecha (sacados de la [FUENTE OFICIAL]).
   *Ejemplo: "Aquí tienes los detalles para Monterrey. [Poster] Es el 15 de Marzo..."*

### FASE 3: CIERRE FINANCIERO ($1500)
Si el cliente muestra interés o ya vio la info, ¡PIDE EL ANTICIPO!
El anticipo estándar es de **$1,500 MXN**.
Ofrece SIEMPRE dos opciones:
1. **Tarjeta/Online:** Envía este link: ${paymentLink}
2. **Transferencia:** Envía estos datos:
   ${bankInfo}

Frase de cierre sugerida: *"El cupo es limitado. ¿Prefieres asegurar tu lugar con tarjeta o te paso la cuenta para transferencia?"*

---

# 🚫 REGLAS DE ORO (PROHIBICIONES)
1. **NUNCA INVENTES FECHAS O PRECIOS:** Si no está en [FUENTE OFICIAL] ni en [CATÁLOGO VISUAL], di que consultarás con un humano.
2. **NUNCA DIGAS "TE LO ENVIÉ AL CORREO":** La venta sucede en el chat. El correo es solo administrativo.
3. **AUDIO:** Si recibes \`[TRANSCRIPCIÓN AUDIO]: "texto"\`, responde al texto entre comillas. NO digas "no puedo escuchar".

---

# 📚 BASES DE DATOS CONECTADAS

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