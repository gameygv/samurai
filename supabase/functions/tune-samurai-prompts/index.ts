// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    const { messages, currentPrompts } = await req.json();

    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').single();
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || config?.value;
    if (!openaiApiKey) throw new Error("OpenAI API Key no configurada.");

    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const masterTruth = webContent?.map(w => `[DATA WEB: ${w.title}]: ${w.content.substring(0, 500)}...`).join('\n') || "No hay datos web indexados.";

    // Construir la lista de prompts dinámicamente para que TODOS se incluyan
    const promptKeys = Object.keys(currentPrompts);
    const promptLabels: Record<string, string> = {
      prompt_alma_samurai: 'Personalidad y tono de Sam',
      prompt_adn_core: 'Estrategia de ventas (ADN Core)',
      prompt_estrategia_cierre: 'Protocolo de cierre de ventas',
      prompt_vision_instrucciones: 'Ojo de Halcón (análisis de imágenes/comprobantes)',
      prompt_analista_datos: 'Analista CAPI (extracción de datos: emails, nombres, ciudades, CP, estado → alimenta Meta CAPI)',
      prompt_behavior_rules: 'Reglas de comportamiento y límites',
      prompt_relearning: 'Reglas de re-aprendizaje',
      prompt_human_handoff: 'Reglas de escalamiento a humano',
    };

    const promptsSection = promptKeys.map((key, i) => {
      const label = promptLabels[key] || key;
      const val = currentPrompts[key] || '';
      return `${i + 1}. ${key} [${label}]:\n${val}`;
    }).join('\n\n---\n\n');

    const responseKeys = promptKeys.map(k => `    "${k}": "..."`).join(',\n');

    const systemInstruction = `
Eres el "Ingeniero Maestro de The Elephant Bowl AI", experto en optimización de prompts y ventas.
Tu misión es reescribir la configuración de la IA basándote en el feedback del usuario y capturas de pantalla.

REGLAS CRÍTICAS:
- Solo modifica los prompts que el usuario pide cambiar. Los demás devuélvelos EXACTAMENTE igual.
- Si el usuario pide mejorar detección de datos (emails, ciudades, CP), edita prompt_analista_datos.
- Si pide cambiar tono o personalidad, edita prompt_alma_samurai.
- Si pide mejorar ventas o cierre, edita prompt_adn_core y/o prompt_estrategia_cierre.
- Si pide cambiar reglas de escalamiento, edita prompt_human_handoff.
- Si pide cambiar reglas de comportamiento, edita prompt_behavior_rules.
- NUNCA devuelvas un prompt vacío si ya tenía contenido.
- NUNCA inventes contenido que contradiga la Verdad Maestra.

VERDAD MAESTRA (Datos reales del negocio):
${masterTruth}

CONFIGURACIÓN ACTUAL COMPLETA (${promptKeys.length} prompts):

${promptsSection}

RESPONDE SOLO JSON:
{
  "message": "Explicación de qué cambiaste y por qué (2-3 oraciones).",
  "prompts": {
${responseKeys}
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

    let response: Response | null = null;
    const maxRetries = 3;
    const requestBody = JSON.stringify({ model: "gpt-4o", messages: formattedMessages, response_format: { type: "json_object" }, temperature: 0.2 });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
        body: requestBody
      });
      if (response.status !== 429) break;
      if (attempt === maxRetries) break;
      const retryAfter = parseInt(response.headers.get('retry-after') || '0') || (attempt * 15);
      const waitMs = Math.min(retryAfter * 1000, 45000);
      await new Promise(r => setTimeout(r, waitMs));
    }

    if (!response!.ok) throw new Error(`OpenAI HTTP ${response!.status}: ${await response!.text()}`);
    const aiData = await response.json();
    return new Response(JSON.stringify({ success: true, result: JSON.parse(aiData.choices?.[0]?.message?.content || '{}') }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})