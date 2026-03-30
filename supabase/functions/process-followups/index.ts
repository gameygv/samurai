// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log("[process-followups] Ciclo de mantenimiento iniciado...");

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key) => configs?.find(c => c.key === key)?.value || null;

    // 1. LIMPIEZA AUTOMÁTICA (SOLO SI SE CONFIGURÓ EXPLÍCITAMENTE)
    const daysToLostRaw = getConfig('days_to_lost_lead');
    const daysToLost = parseInt(daysToLostRaw || '0');
    
    // Si daysToLost es 0 o no existe, NO DESCARTAR NADA
    if (daysToLost > 0) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysToLost);

        const { data: staleLeads } = await supabaseClient.from('leads')
            .select('id, nombre')
            .not('buying_intent', 'in', '("COMPRADO","PERDIDO")')
            .not('last_message_at', 'is', null) 
            .lt('last_message_at', thresholdDate.toISOString());

        if (staleLeads && staleLeads.length > 0) {
            console.log(`[Cleanup] Descartando ${staleLeads.length} leads por inactividad de ${daysToLost} días.`);
            await supabaseClient.from('leads').update({ buying_intent: 'PERDIDO' }).in('id', staleLeads.map(l => l.id));
        }
    }

    // 2. RETARGETING (MENSAJES AUTOMÁTICOS)
    const { data: followupConfigs } = await supabaseClient.from('followup_config').select('*');
    const exploration = (followupConfigs || []).find(c => c.strategy_type === 'exploration');
    const sales = (followupConfigs || []).find(c => c.strategy_type === 'sales');
    
    if (exploration?.enabled || sales?.enabled) {
        const { data: leads } = await supabaseClient.from('leads')
            .select('*')
            .eq('ai_paused', false)
            .not('last_message_at', 'is', null)
            .not('buying_intent', 'in', '("COMPRADO","PERDIDO")');

        for (const lead of (leads || [])) {
            const cfg = lead.buying_intent === 'ALTO' ? sales : exploration;
            if (!cfg?.enabled) continue;

            const minsSinceMsg = Math.floor((new Date().getTime() - new Date(lead.last_message_at).getTime()) / 60000);
            const stage = lead.followup_stage || 0;
            let msg = null;
            let next = stage;

            if (stage === 0 && minsSinceMsg >= (cfg.stage_1_delay || 60)) { msg = cfg.stage_1_message; next = 1; }
            else if (stage === 1 && minsSinceMsg >= (cfg.stage_2_delay || 1440)) { msg = cfg.stage_2_message; next = 2; }

            if (msg && lead.telefono) {
                await supabaseClient.from('leads').update({ followup_stage: next }).eq('id', lead.id);
                await supabaseClient.functions.invoke('send-message-v3', {
                    body: { channel_id: lead.channel_id, phone: lead.telefono, message: msg.replace(/{nombre}/g, lead.nombre || 'amigo') }
                });
                await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: msg, platform: 'AUTO_FOLLOWUP' });
            }
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})