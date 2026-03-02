// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { lead_id } = await req.json();

    // 1. Obtener datos actuales del lead y Config de Meta
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value').in('key', ['openai_api_key', 'meta_pixel_id', 'meta_access_token']);
    
    const getConfig = (key) => configs.find(c => c.key === key)?.value;
    const apiKey = getConfig('openai_api_key');
    
    // 2. Obtener historial
    const { data: messages } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead_id).order('created_at', { ascending: true }).limit(40);
    const transcript = messages.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');

    // 3. IA Extrae Datos
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Extrae JSON puro: {email, ciudad, nombre, intent, summary, psych}" },
                { role: "user", content: `Analiza este chat:\n${transcript}` }
            ],
            response_format: { type: "json_object" }
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 4. Guardar en DB
    const updatePayload = {
        last_ai_analysis: new Date().toISOString(),
        buying_intent: result.intent,
        summary: result.summary,
        perfil_psicologico: result.psych
    };

    if (result.email) updatePayload.email = result.email.toLowerCase().trim();
    if (result.ciudad) updatePayload.ciudad = result.ciudad;
    if (result.nombre && (!lead.nombre || lead.nombre.includes('Nuevo'))) updatePayload.nombre = result.nombre;

    const { data: updatedLead } = await supabaseClient.from('leads').update(updatePayload).eq('id', lead_id).select().single();

    // 5. AUTO-CAPI: Si hay email y no se ha enviado hoy, disparamos a Meta
    const pixelId = getConfig('meta_pixel_id');
    const token = getConfig('meta_access_token');

    if (updatedLead.email && updatedLead.nombre && !updatedLead.capi_lead_event_sent_at && pixelId && token) {
        console.log(`[auto-capi] Disparando evento para ${updatedLead.email}`);
        await supabaseClient.functions.invoke('meta-capi-sender', {
            body: {
                eventData: {
                    event_name: 'Lead',
                    lead_id: updatedLead.id,
                    user_data: { 
                        ph: updatedLead.telefono, 
                        em: updatedLead.email, 
                        fn: updatedLead.nombre, 
                        ct: updatedLead.ciudad 
                    }
                },
                config: { pixel_id: pixelId, access_token: token }
            }
        });
        await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
    }

    return new Response(JSON.stringify({ success: true, lead: updatedLead }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})