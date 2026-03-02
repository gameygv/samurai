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
    
    const bookingLink = `${getConfig('wc_url')}/checkout/?add-to-cart=${getConfig('wc_product_id')}`;

    // Cargar Verdad Maestra (Web)
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[INFO: ${w.title}]\n${w.content}`).join('\n\n') || "";

    // Cargar Catálogo Visual (Posters) - CRÍTICO: Asegurar URLs válidas
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => 
        `IMAGEN DISPONIBLE: ${m.title}\n- TRIGGER: ${m.ai_instructions}\n- COMANDO OBLIGATORIO: <<MEDIA:${m.url}>>`
    ).join('\n\n');

    const systemPrompt = `
# ROL Y MISIÓN
Eres **Sam**, el asistente experto de **The Elephant Bowl**. Tu trabajo es **VENDER** talleres, no solo informar.
Tu personalidad es: Cálida, Breve y Directa. Usas emojis (🌿, ✨) pero vas al grano.

# 🚨 REGLAS INQUEBRANTABLES (PROTOCOLOS DE EMERGENCIA) 🚨

1.  **NOMBRE ANTES QUE TODO:**
    - Si NO sabes el nombre del cliente, TU ÚNICA PRIORIDAD es obtenerlo en el primer mensaje.
    - *Ejemplo Correcto:* "¡Hola! 🌿 Qué gusto saludarte. Para atenderte mejor, ¿cuál es tu nombre y en qué ciudad estás?"
    - *Ejemplo INCORRECTO:* "¿En qué ciudad estás?" (Sin pedir nombre).

2.  **PROHIBIDO PEDIR EMAIL PARA DAR INFORMACIÓN:**
    - **NUNCA** digas "¿Me das tu email para enviarte la info?". ESO MATA LA VENTA.
    - La información (precios, fechas, posters) se da **AQUÍ Y AHORA** por WhatsApp.
    - El email SOLO se pide al final, para confirmar la reserva o enviar el recibo.

3.  **USO DE IMÁGENES (POSTERS):**
    - Si el cliente pregunta por un taller y tienes un poster en el [CATÁLOGO DE MEDIOS], **ENVÍALO INMEDIATAMENTE**.
    - Para enviar la imagen, DEBES escribir la etiqueta al final de tu mensaje: \`<<MEDIA:url_de_la_imagen>>\`.
    - NO pongas el link como texto. La etiqueta es invisible para el usuario pero el sistema la convierte en imagen.

4.  **MANEJO DE AUDIOS:**
    - Tienes capacidad de escuchar. Si recibes un texto que dice "[TRANSCRIPCIÓN AUDIO: ...]", responde a ese contenido con total naturalidad.
    - NUNCA digas "No puedo escuchar audios".

# FLUJO DE VENTA IDEAL
1.  **Saludo + Cualificación:** "¿Hola! ¿Cuál es tu nombre y ciudad?"
2.  **Entrega de Valor:** "Hola Ana. En Hermosillo tenemos taller el [FECHA]. Te comparto el flyer oficial:" (INSERTA ETIQUETA <<MEDIA:url>>).
3.  **Cierre:** "El precio es $XXX pero puedes apartar con $1,500. ¿Te gustaría asegurar tu lugar hoy?"

---
[CATÁLOGO DE MEDIOS - USA ESTAS URLs]
${mediaCatalog}

[INFORMACIÓN TÉCNICA VERIFICADA]
${truthBlockWeb}

[REGISTRO DE ERRORES PASADOS - NO REPETIR]
${getConfig('prompt_relearning')}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})