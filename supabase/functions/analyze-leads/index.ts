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
    const extractionPrompt = configMap['prompt_analista_datos'] || 'Extrae datos en JSON: {"nombre": "null", "ciudad": "null", "email": "null", "intent": "BAJO"}';

    if (!apiKey) throw new Error("OpenAI API Key faltante.");

    const { data: messages } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: true }) 
        .limit(50);

    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    // IA EXTRAE DATOS USANDO EL PROMPT DINÁMICO DEL PANEL
    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: extractionPrompt },
                { role: "user", content: `Analiza este chat y devuelve el JSON:\n\n${transcript}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1 // Baja temperatura para JSON predecible
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const updates: any = { 
        last_ai_analysis: new Date().toISOString(),
        perfil_psicologico: `MOTIVACIÓN: ${result.main_pain || 'N/A'}. PERFIL: ${result.psych_profile || 'N/A'}`
    };
    
    // Mapeo seguro de datos extraídos a la BD
    if (result.nombre && result.nombre !== 'null') updates.nombre = result.nombre;
    if (result.apellido && result.apellido !== 'null') updates.apellido = result.apellido;
    if (result.email && result.email.includes('@')) updates.email = result.email;
    if (result.ciudad && result.ciudad !== 'null') updates.ciudad = result.ciudad;
    if (result.estado && result.estado !== 'null') updates.estado = result.estado;
    if (result.cp && result.cp !== 'null') updates.cp = result.cp;
    if (result.pais && result.pais !== 'null') updates.pais = result.pais;
    if (result.intent && result.intent !== 'null') updates.buying_intent = result.intent;
    if (result.summary && result.summary !== 'null') updates.summary = result.summary;
    if (result.origen_contacto && result.origen_contacto !== 'null') updates.origen_contacto = result.origen_contacto;
    if (result.servicio_interes && result.servicio_interes !== 'null') updates.servicio_interes = result.servicio_interes;
    if (result.tiempo_compra && result.tiempo_compra !== 'null') updates.tiempo_compra = result.tiempo_compra;
    if (result.main_pain && result.main_pain !== 'null') updates.main_pain = result.main_pain;
    if (result.lead_score) updates.lead_score = parseInt(result.lead_score) || 0;

    const { data: updatedLead } = await supabaseClient.from('leads').update(updates).eq('id', lead_id).select().single();

    return new Response(JSON.stringify({ success: true, lead: updatedLead }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})