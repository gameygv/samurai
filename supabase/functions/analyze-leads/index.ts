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

    const { lead_id, force } = await req.json();
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
        .limit(50);

    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    // IA EXTRAE DATOS TÁCTICOS PROFUNDOS
    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { 
                  role: "system", 
                  content: `Analista de Ventas de Samurai. Tu misión es extraer datos críticos en JSON: 
                  {
                    "email": "string/null",
                    "ciudad": "string/null",
                    "nombre": "string/null",
                    "intent": "ALTO/MEDIO/BAJO",
                    "summary": "Resumen corto",
                    "motivation": "Qué busca el cliente realmente (paz, técnica, etc)",
                    "main_objection": "Qué le impide comprar hoy",
                    "psych_profile": "Perfil de personalidad (Directo, emocional, analítico)"
                  }` 
                },
                { role: "user", content: `Analiza este chat:\n${transcript}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const updates: any = { 
        last_ai_analysis: new Date().toISOString(),
        perfil_psicologico: `MOTIVACIÓN: ${result.motivation || 'N/A'}. OBJECIÓN: ${result.main_objection || 'N/A'}. PERFIL: ${result.psych_profile || 'N/A'}`
    };
    
    if (result.nombre && result.nombre !== 'Desconocido') updates.nombre = result.nombre;
    if (result.email && result.email.includes('@')) updates.email = result.email;
    if (result.ciudad) updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.summary) updates.summary = result.summary;

    const { data: updatedLead } = await supabaseClient.from('leads').update(updates).eq('id', lead_id).select().single();

    return new Response(JSON.stringify({ success: true, lead: updatedLead }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})