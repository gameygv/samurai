import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { ai_json_response, lead_id, kommo_id, phone, name, is_client_message = false } = await req.json();

    let lead = null;
    if (lead_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
        lead = data;
    } 
    if (!lead && kommo_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommo_id).single();
        lead = data;
    }
    if (!lead && phone) {
        const cleanPhone = phone.toString().replace(/\D/g, '');
        const { data } = await supabaseClient.from('leads').select('*').ilike('telefono', `%${cleanPhone}%`).single();
        lead = data;
    }
    if (!lead && (phone || kommo_id)) {
        const { data: newLead, error: createError } = await supabaseClient.from('leads').insert({
            nombre: name || 'Nuevo Lead WhatsApp',
            telefono: phone || null,
            kommo_id: kommo_id || null,
            last_message_at: new Date().toISOString()
        }).select().single();
        if (createError) throw createError;
        lead = newLead;
    }

    if (!lead) throw new Error("Lead not found.");

    let fullText = typeof ai_json_response === 'string' ? ai_json_response : (ai_json_response?.reply || "");
    let cleanText = fullText;
    let analysisData: any = null;

    const separators = ['---SYSTEM_ANALYSIS---', '[[ANALYSIS:', '---ANALYSIS---'];
    for (const sep of separators) {
        if (fullText.includes(sep)) {
            const parts = fullText.split(sep);
            cleanText = parts[0].trim();
            try {
                const jsonPart = parts[1].trim().replace(/```json/g, '').replace(/```/g, '').replace(/\]\]/g, '').trim();
                if (jsonPart.startsWith('{')) analysisData = JSON.parse(jsonPart);
            } catch (e) {}
            break;
        }
    }

    const updateData: any = { last_message_at: new Date().toISOString() };

    // PROGRAMACIÓN AUTOMÁTICA DE FOLLOW-UP (SI ES RESPUESTA DE LA IA)
    if (!is_client_message) {
        const { data: config } = await supabaseClient.from('followup_config').select('*').single();
        if (config && config.enabled) {
            // Programar Stage 1
            const nextTime = new Date(Date.now() + config.stage_1_delay * 60 * 1000);
            updateData.next_followup_at = nextTime.toISOString();
            updateData.followup_stage = 1;
        }
    } else {
        // SI EL CLIENTE RESPONDE, DETENER EL TEMPORIZADOR HASTA LA PRÓXIMA RESPUESTA DE LA IA
        updateData.next_followup_at = null;
    }

    if (analysisData) {
        updateData.last_ai_analysis = new Date().toISOString();
        if (analysisData.mood) updateData.estado_emocional_actual = analysisData.mood;
        if (analysisData.intent) updateData.buying_intent = analysisData.intent;
        if (analysisData.summary) updateData.summary = analysisData.summary;
        if (analysisData.handoff_required === true) updateData.ai_paused = true;
    }

    await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: is_client_message ? 'CLIENTE' : 'SAMURAI', mensaje: cleanText, platform: 'API' });

    return new Response(JSON.stringify({ success: true, reply: cleanText, lead_id: lead.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})