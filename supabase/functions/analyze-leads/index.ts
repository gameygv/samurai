// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { lead_id } = await req.json();

    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    const { data: messages } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead_id).order('created_at', { ascending: true }).limit(20);
    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    const systemPrompt = `
Eres el Analista Táctico de Samurai CRM.
Tu tarea es leer el chat y extraer el JSON de datos del cliente.
REGLA: Si el cliente ya dio su nombre y ciudad, detecta si en los últimos mensajes ya se le pidió el email o si ya lo dio.

RESPONDE SOLO JSON:
{
  "nombre": "string o null",
  "apellido": "string o null",
  "email": "string o null",
  "ciudad": "string o null",
  "intent": "BAJO | MEDIO | ALTO | COMPRADO",
  "summary": "Resumen breve de la situación actual",
  "perfil_psicologico": "Intereses detectados (uso personal/profesional, dolores)"
}
`;

    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Chat:\n${transcript}` }],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const updates: any = { last_ai_analysis: new Date().toISOString() };
    if (result.nombre && result.nombre !== 'null') updates.nombre = result.nombre;
    if (result.apellido && result.apellido !== 'null') updates.apellido = result.apellido;
    if (result.email && result.email !== 'null') updates.email = result.email;
    if (result.ciudad && result.ciudad !== 'null') updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.summary) updates.summary = result.summary;
    if (result.perfil_psicologico) updates.perfil_psicologico = result.perfil_psicologico;

    await supabaseClient.from('leads').update(updates).eq('id', lead_id);

    return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})