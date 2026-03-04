// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    
    const { messages, currentPrompts } = await req.json();

    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').single();
    if (!config?.value) throw new Error("OpenAI API Key no configurada.");

    // OBTENER VERDAD MAESTRA (SITIO WEB) PARA QUE EL TUNER TENGA DATOS REALES
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const masterTruth = webContent?.map(w => `[DATA WEB: ${w.title}]: ${w.content.substring(0, 500)}...`).join('\n') || "No hay datos web indexados.";

    const systemInstruction = `
Eres el "Ingeniero Maestro de Samurai", experto en optimización de prompts y ventas.
Tu misión es reescribir la configuración de Samurai basándote en el feedback del usuario y capturas de pantalla.

VERDAD MAESTRA (Datos reales del negocio):
${masterTruth}

CONFIGURACIÓN ACTUAL DE LOS PROMPTS QUE DEBES EDITAR:
1. prompt_alma_samurai: ${currentPrompts.prompt_alma_samurai || 'Vacio'}
2. prompt_adn_core: ${currentPrompts.prompt_adn_core || 'Vacio'}
3. prompt_estrategia_cierre: ${currentPrompts.prompt_estrategia_cierre || 'Vacio'}
4. prompt_vision_instrucciones: ${currentPrompts.prompt_vision_instrucciones || 'Vacio'} (ESTE CONTROLA EL 'OJO DE HALCÓN', ÚSALO SI EL USUARIO PIDE MEJORAR LA LECTURA DE IMÁGENES O COMPROBANTES DE PAGO).

TU TAREA:
1. Identifica qué quiere corregir el usuario.
2. Si el usuario habla de OCR, lectura de imágenes, o revisión de comprobantes, DEBES modificar 'prompt_vision_instrucciones'.
3. Si habla de tono o personalidad, modifica 'prompt_adn_core'.
4. Si habla de precios, procesos o ventas, modifica 'prompt_estrategia_cierre'.
5. Devuelve TODO el JSON con los prompts mejorados. Los que no cambien, déjalos igual.

RESPONDE SOLO JSON, CON LA ESTRUCTURA EXACTA:
{
  "message": "Explicación del ajuste realizado.",
  "prompts": { 
    "prompt_alma_samurai": "...", 
    "prompt_adn_core": "...", 
    "prompt_estrategia_cierre": "...", 
    "prompt_vision_instrucciones": "..." 
  }
}
`;

    const formattedMessages = [{ role: "system", content: systemInstruction }];
    for (const msg of messages) {
        if (msg.role === 'user') {
            const content = [];
            if (msg.text) content.push({ type: "text", text: msg.text });
            if (msg.image) content.push({ type: "image_url", image_url: { url: msg.image } });
            formattedMessages.push({ role: "user", content });
        } else {
            formattedMessages.push({ role: "assistant", content: msg.text });
        }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.value}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: "gpt-4o", messages: formattedMessages, response_format: { type: "json_object" }, temperature: 0.2 })
    });

    const aiData = await response.json();
    return new Response(JSON.stringify({ success: true, result: JSON.parse(aiData.choices[0].message.content) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})