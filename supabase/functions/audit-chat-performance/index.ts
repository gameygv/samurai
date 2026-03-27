// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { lead_id } = await req.json();

    if (!lead_id) throw new Error("Falta el ID del lead para auditar.");

    const { data: configs } = await supabaseClient.from('app_config').select('key, value').eq('key', 'openai_api_key').single();
    const apiKey = configs?.value;

    if (!apiKey) throw new Error("API Key de OpenAI no configurada.");

    // Extraer toda la conversación (hasta 100 mensajes)
    const { data: messages } = await supabaseClient
      .from('conversaciones')
      .select('emisor, mensaje, created_at')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!messages || messages.length === 0) {
       throw new Error("No hay suficientes mensajes para auditar.");
    }

    // Identificar si el humano participó
    const humanCount = messages.filter(m => m.emisor === 'HUMANO').length;
    if (humanCount === 0) {
       return new Response(JSON.stringify({
          score: 100,
          strengths: ["El bot manejó toda la conversación."],
          weaknesses: ["El asesor humano no ha intervenido."],
          conclusion: "Atención automatizada al 100% por la IA. El agente aún no toma el control."
       }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const transcript = messages.map(m => `[${new Date(m.created_at).toLocaleTimeString()}] ${m.emisor}: ${m.mensaje}`).join('\n');

    const prompt = `
Eres un Supervisor de Calidad de Ventas Experto (QA Manager).
Evalúa el desempeño de los mensajes enviados por el 'HUMANO' en esta transcripción de WhatsApp. (Ignora el desempeño de la IA, céntrate en el Humano).

Evalúa lo siguiente:
1. Tiempo de respuesta (si contestó rápidamente después de un mensaje del cliente o tras pausar a la IA).
2. Empatía, amabilidad y ortografía.
3. Habilidad y agresividad comercial (si está cerrando la venta o resolviendo dudas eficazmente).

Proporciona un puntaje del 0 al 100 y una breve crítica.

RESPONDE ESTRICTAMENTE EN JSON:
{
  "score": 85,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "conclusion": "Resumen ejecutivo..."
}

Transcripción del Chat:
${transcript}
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
         model: "gpt-4o", 
         messages: [{ role: "user", content: prompt }], 
         response_format: { type: "json_object" },
         temperature: 0.2
      })
    });

    const aiData = await aiRes.json();
    const result = aiData.choices[0].message.content;

    return new Response(result, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})