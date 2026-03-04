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

    const systemInstruction = `
Eres el "Ingeniero Maestro de Samurai", una IA experta en optimización de prompts y flujos de ventas.
Tu trabajo es analizar el feedback del usuario (el dueño del negocio) y las capturas de pantalla de los chats donde "Samurai" (el bot de ventas) cometió errores.

AQUÍ ESTÁ LA CONFIGURACIÓN ACTUAL DE SAMURAI:
1. Alma de Samurai: ${currentPrompts.prompt_alma_samurai || 'Vacio'}
2. ADN Core: ${currentPrompts.prompt_adn_core || 'Vacio'}
3. Estrategia de Cierre: ${currentPrompts.prompt_estrategia_cierre || 'Vacio'}
4. Ojo de Halcón (Visión): ${currentPrompts.prompt_vision_instrucciones || 'Vacio'}

TUS OBJETIVOS:
1. Analizar el problema reportado.
2. Modificar, reordenar o mejorar los prompts actuales para que el bot no vuelva a cometer ese error.
3. Devolver los prompts actualizados junto con un mensaje explicando qué ajustaste y por qué.

REGLA ESTRICTA: 
Debes responder ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "message": "Explicación clara y concisa de lo que modificaste para el usuario.",
  "prompts": {
    "prompt_alma_samurai": "...",
    "prompt_adn_core": "...",
    "prompt_estrategia_cierre": "...",
    "prompt_vision_instrucciones": "..."
  }
}
Si un prompt no necesitaba cambios, devuélvelo exactamente como estaba. NUNCA dejes un prompt vacío a menos que el usuario lo pida.
    `;

    // Formatear mensajes para OpenAI (Soporte de Visión)
    const formattedMessages = [
      { role: "system", content: systemInstruction }
    ];

    for (const msg of messages) {
        if (msg.role === 'user') {
            const contentArray = [];
            if (msg.text) contentArray.push({ type: "text", text: msg.text });
            if (msg.image) contentArray.push({ type: "image_url", image_url: { url: msg.image } }); // msg.image is base64
            
            formattedMessages.push({ role: "user", content: contentArray });
        } else {
            formattedMessages.push({ role: "assistant", content: msg.text });
        }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${config.value}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        model: "gpt-4o",
        messages: formattedMessages,
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI Error: ${errText}`);
    }

    const aiData = await response.json();
    const resultJson = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify({ success: true, result: resultJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})