// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log("[process-followups] Iniciando ciclo de mantenimiento...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key) => configs?.find(c => c.key === key)?.value || null;
    const defaultCh = getConfig('default_notification_channel');

    // ========================================================
    // 1. RETARGETING / FOLLOW-UPS (IA)
    // ========================================================
    const { data: followupConfigs } = await supabaseClient.from('followup_config').select('*');
    const explorationConfig = (followupConfigs || []).find(c => c.strategy_type === 'exploration');
    const salesConfig = (followupConfigs || []).find(c => c.strategy_type === 'sales');
    
    if (explorationConfig?.enabled || salesConfig?.enabled) {
        const { data: stagnantLeads } = await supabaseClient.from('leads')
            .select('id, nombre, telefono, channel_id, last_message_at, followup_stage, buying_intent')
            .eq('ai_paused', false)
            .not('last_message_at', 'is', null) // Protegemos contra nulos
            .not('buying_intent', 'in', '("COMPRADO","PERDIDO")');

        for (const lead of (stagnantLeads || [])) {
            const configToUse = lead.buying_intent === 'ALTO' ? salesConfig : explorationConfig;
            if (!configToUse || !configToUse.enabled) continue;

            const minutesSinceLastMsg = Math.floor((new Date().getTime() - new Date(lead.last_message_at).getTime()) / 60000);
            const stage = lead.followup_stage || 0;
            let messageToSend = null;
            let nextStage = stage;

            if (stage === 0 && minutesSinceLastMsg >= (configToUse.stage_1_delay || 60)) {
                messageToSend = configToUse.stage_1_message;
                nextStage = 1;
            } else if (stage === 1 && minutesSinceLastMsg >= (configToUse.stage_2_delay || 1440)) {
                messageToSend = configToUse.stage_2_message;
                nextStage = 2;
            }

            if (messageToSend && lead.telefono) {
                await supabaseClient.from('leads').update({ followup_stage: nextStage }).eq('id', lead.id);
                await supabaseClient.functions.invoke('send-message-v3', {
                    body: { channel_id: lead.channel_id, phone: lead.telefono, message: messageToSend.replace(/{nombre}/g, lead.nombre || 'amigo') }
                });
                await supabaseClient.from('conversaciones').insert({
                    lead_id: lead.id, emisor: 'SAMURAI', mensaje: messageToSend, platform: 'WHATSAPP_FOLLOWUP'
                });
            }
        }
    }

    // ========================================================
    // 2. LIMPIEZA AUTOMÁTICA (DESCARTAR A PERDIDO) - CORREGIDO
    // ========================================================
    const daysToLostRaw = getConfig('days_to_lost_lead');
    const daysToLost = parseInt(daysToLostRaw || '14');
    
    if (!isNaN(daysToLost) && daysToLost > 0) {
        const lostDateThreshold = new Date();
        lostDateThreshold.setDate(lostDateThreshold.getDate() - daysToLost);

        const { data: leadsToLose } = await supabaseClient.from('leads')
            .select('id')
            .not('buying_intent', 'in', '("COMPRADO","PERDIDO")')
            .not('last_message_at', 'is', null) // Solo descartar si realmente hubo actividad previa
            .lt('last_message_at', lostDateThreshold.toISOString());

        if (leadsToLose && leadsToLose.length > 0) {
            const ids = leadsToLose.map(l => l.id);
            await supabaseClient.from('leads').update({ buying_intent: 'PERDIDO' }).in('id', ids);
            console.log(`[process-followups] ${ids.length} leads movidos a PERDIDO por inactividad.`);
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})