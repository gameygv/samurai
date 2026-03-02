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

    // 1. Obtener datos y configuración
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    
    const apiKey = configs?.find(c => c.key === 'openai_api_key')?.value;
    if (!apiKey) throw new Error("OpenAI API Key faltante.");

    // 2. Obtener Historial
    const { data: messages } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: true }) 
        .limit(50);

    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    // 3. IA Extrae Datos Profundos
    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { 
                  role: "system", 
                  content: "Analista de Ventas de The Elephant Bowl. Extrae JSON: {email, ciudad, nombre, intent, summary, psych_profile, motivation, main_objection}" 
                },
                { role: "user", content: `Analiza este chat de venta de taller de cuencos:\n${transcript}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 4. Actualizar Lead
    const { data: updatedLead, error: updateError } = await supabaseClient
        .from('leads')
        .update({
            last_ai_analysis: new Date().toISOString(),
            nombre: result.nombre || lead.nombre,
            email: result.email || lead.email,
            ciudad: result.ciudad || lead.ciudad,
            buying_intent: result.intent || lead.buying_intent,
            summary: result.summary || lead.summary,
            perfil_psicologico: `MOTIVACIÓN: ${result.motivation || 'No detectada'}. OBJECIÓN: ${result.main_objection || 'Ninguna'}. PERFIL: ${result.psych_profile || 'Pendiente'}`
        })
        .eq('id', lead_id)
        .select()
        .single();

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, lead: updatedLead }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})