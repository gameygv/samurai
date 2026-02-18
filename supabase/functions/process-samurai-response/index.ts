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

    const { ai_json_response, lead_id, raw_text, is_client_message } = await req.json();

    if (!lead_id) throw new Error("Lead ID is required");

    let fullText = typeof ai_json_response === 'string' ? ai_json_response : (ai_json_response?.reply || raw_text || "");
    let cleanText = fullText;
    let analysisData: any = null;

    // Regex para capturar el bloque JSON de análisis avanzado
    const analysisRegex = /\[\[ANALYSIS:\s*({[\s\S]*?})\s*\]\]/s;
    const match = fullText.match(analysisRegex);

    if (match && match[1]) {
        try {
            analysisData = JSON.parse(match[1]);
            cleanText = fullText.replace(match[0], '').trim();
        } catch (e) {
            console.error("[process-samurai-response] Error parsing analysis JSON", e);
        }
    }

    // 1. ACTUALIZACIÓN DEL PERFIL DEL LEAD (MEMORIA MAESTRA)
    if (analysisData) {
        const updateData: any = {
           last_ai_analysis: new Date().toISOString()
        };
        
        // Mapeo de campos dinámicos
        if (analysisData.mood) updateData.estado_emocional_actual = analysisData.mood;
        if (analysisData.intent) updateData.buying_intent = analysisData.intent;
        if (analysisData.summary) updateData.summary = analysisData.summary;
        if (analysisData.city) updateData.ciudad = analysisData.city;
        if (analysisData.preferences) updateData.preferencias = analysisData.preferences;
        if (analysisData.psychology) updateData.perfil_psicologico = analysisData.psychology;
        
        // Si la IA decide que necesita un humano
        if (analysisData.handoff_required === true) {
            updateData.ai_paused = true;
            
            // Obtener configuración de auto-restart
            const { data: followupConfig } = await supabaseClient
                .from('followup_config')
                .select('auto_restart_delay')
                .single();
            
            const delayMinutes = followupConfig?.auto_restart_delay || 30;
            const restartTime = new Date(Date.now() + delayMinutes * 60 * 1000);
            updateData.auto_restart_scheduled_at = restartTime.toISOString();
            updateData.stop_requested_at = new Date().toISOString();
            
            // DISPARAR WEBHOOK A MAKE PARA AVISAR AL HUMANO
            const { data: config } = await supabaseClient
                .from('app_config')
                .select('value')
                .eq('key', 'webhook_human_handoff')
                .single();

            if (config?.value) {
                console.log("[process-samurai-response] Disparando Webhook Humano...");
                fetch(config.value, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'human_intervention_required',
                        lead_id: lead_id,
                        reason: analysisData.handoff_reason || 'Situación delicada',
                        last_message: cleanText,
                        auto_restart_at: restartTime.toISOString()
                    })
                }).catch(err => console.error("Error calling handoff webhook:", err));
            }
        }

        await supabaseClient.from('leads').update(updateData).eq('id', lead_id);
    }

    // 2. RESETEAR FOLLOW-UPS SI EL CLIENTE RESPONDE
    if (is_client_message) {
        await supabaseClient.from('leads').update({
            followup_stage: 0,
            next_followup_at: null,
            last_message_at: new Date().toISOString()
        }).eq('id', lead_id);
    } else {
        // Si es mensaje del bot, programar follow-up
        const { data: followupConfig } = await supabaseClient
            .from('followup_config')
            .select('stage_1_delay, enabled')
            .single();
        
        if (followupConfig?.enabled) {
            const delayMinutes = followupConfig.stage_1_delay || 10;
            const nextFollowup = new Date(Date.now() + delayMinutes * 60 * 1000);
            
            await supabaseClient.from('leads').update({
                followup_stage: 1,
                next_followup_at: nextFollowup.toISOString(),
                last_bot_message_at: new Date().toISOString()
            }).eq('id', lead_id);
        }
    }

    // 3. GUARDAR CONVERSACIÓN
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead_id,
        emisor: is_client_message ? 'CLIENTE' : 'SAMURAI',
        mensaje: cleanText, 
        platform: 'API',
        metadata: { analysis: analysisData }
    });

    return new Response(
      JSON.stringify({ 
         success: true, 
         reply: cleanText, 
         handoff: analysisData?.handoff_required || false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})