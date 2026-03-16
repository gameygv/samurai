// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { lead_id } = await req.json();
    if (!lead_id) throw new Error("Lead ID requerido.");

    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    if (!apiKey) throw new Error("OpenAI API Key faltante.");

    const { data: messages } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: true }) 
        .limit(20);

    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    const systemPrompt = `
Eres un Analista de Datos experto. Tu misión es extraer información crítica de este chat para un CRM.
REGLAS DE EXTRACCIÓN:
1. NOMBRE: Extrae el nombre propio. Si dice "Soy Vajra Tay", el nombre es "Vajra" y apellido "Tay".
2. CIUDAD: Extrae la ubicación mencionada.
3. INTENT: BAJO (curioso), MEDIO (pide info), ALTO (pide cuenta/link), COMPRADO (envió comprobante).
4. SUMMARY: Un resumen de 10 palabras de la situación actual.

RESPONDE ÚNICAMENTE EN JSON:
{
  "nombre": "string o null",
  "apellido": "string o null",
  "ciudad": "string o null",
  "intent": "BAJO | MEDIO | ALTO",
  "summary": "string"
}
`;

    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Analiza este chat reciente:\n\n${transcript}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const updates: any = { last_ai_analysis: new Date().toISOString() };
    if (result.nombre) updates.nombre = result.nombre;
    if (result.apellido) updates.apellido = result.apellido;
    if (result.ciudad) updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.summary) updates.summary = result.summary;

    await supabaseClient.from('leads').update(updates).eq('id', lead_id);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})