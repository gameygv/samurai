// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log("[process-followups] Iniciando ciclo AI-Driven + Retargeting + Routing + Limpieza + Recordatorios...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key) => configs?.find(c => c.key === key)?.value || null;

    // ========================================================
    // 1. LÓGICA DE RETARGETING / FOLLOW-UPS (IA)
    // ========================================================
    const { data: followupConfigs } = await supabaseClient.from('followup_config').select('*').eq('enabled', true);
    
    if (followupConfigs && followupConfigs.length > 0) {
        const explorationConfig = followupConfigs.find(c => c.strategy_type === 'exploration');
        const salesConfig = followupConfigs.find(c => c.strategy_type === 'sales');
        
        const currentHour = new Date().getUTCHours() - 6; // Ajuste aprox a CST
        const activeConfigHour = explorationConfig || salesConfig;
        
        if (activeConfigHour && currentHour >= (activeConfigHour.start_hour || 9) && currentHour <= (activeConfigHour.end_hour || 20)) {
            
            const { data: stagnantLeads } = await supabaseClient.from('leads')
                .select('id, nombre, telefono, channel_id, last_message_at, followup_stage, buying_intent')
                .eq('ai_paused', false)
                .not('buying_intent', 'in', '("COMPRADO","PERDIDO")');

            for (const lead of (stagnantLeads || [])) {
                const configToUse = lead.buying_intent === 'ALTO' ? salesConfig : explorationConfig;
                if (!configToUse) continue;

                const minutesSinceLastMsg = Math.floor((new Date().getTime() - new Date(lead.last_message_at).getTime()) / 60000);
                const stage = lead.followup_stage || 0;
                let messageToSend = null;
                let nextStage = stage;

                if (stage === 0 && minutesSinceLastMsg >= (configToUse.stage_1_delay || 15)) {
                    messageToSend = configToUse.stage_1_message;
                    nextStage = 1;
                } else if (stage === 1 && minutesSinceLastMsg >= (configToUse.stage_2_delay || 60)) {
                    messageToSend = configToUse.stage_2_message;
                    nextStage = 2;
                } else if (stage === 2 && minutesSinceLastMsg >= (configToUse.stage_3_delay || 1440)) {
                    messageToSend = configToUse.stage_3_message;
                    nextStage = 3;
                }

                if (messageToSend && lead.telefono) {
                    const clientName = lead.nombre?.split(' ')[0] || 'amigo';
                    const finalMsg = messageToSend.replace(/{nombre}/g, clientName);
                    
                    await supabaseClient.functions.invoke('send-message-v3', {
                        body: { channel_id: lead.channel_id, phone: lead.telefono, message: finalMsg }
                    });

                    await supabaseClient.from('conversaciones').insert({
                        lead_id: lead.id, emisor: 'SAMURAI', mensaje: finalMsg, platform: 'WHATSAPP_FOLLOWUP'
                    });

                    await supabaseClient.from('leads').update({ followup_stage: nextStage }).eq('id', lead.id);
                }
            }
        }
    }

    // ========================================================
    // 2. WOOCOMMERCE WATCHER
    // ========================================================
    const wcUrl = getConfig('wc_url');
    const wcKey = getConfig('wc_consumer_key');
    const wcSecret = getConfig('wc_consumer_secret');

    if (wcUrl && wcKey && wcSecret) {
       const { data: highIntentLeads } = await supabaseClient.from('leads').select('id, nombre, email, telefono, channel_id').eq('buying_intent', 'ALTO').not('email', 'is', null);

       for (const lead of (highIntentLeads || [])) {
          try {
             const apiBase = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
             const endpoint = `${apiBase}/wp-json/wc/v3/orders?customer=${encodeURIComponent(lead.email)}`;
             const auth = btoa(`${wcKey}:${wcSecret}`);
             const wcRes = await fetch(endpoint, { headers: { 'Authorization': `Basic ${auth}` } });

             if (wcRes.ok) {
                const orders = await wcRes.json();
                const paidOrder = orders.find(o => o.status === 'processing' || o.status === 'completed');

                if (paidOrder) {
                   await supabaseClient.from('leads').update({
                      buying_intent: 'COMPRADO', payment_status: 'VALID', summary: `VENTA AUTOMÁTICA DETECTADA EN WC. Pedido: #${paidOrder.id}`
                   }).eq('id', lead.id);

                   const thanksMsg = `¡Hola *${lead.nombre}*! 👋 He detectado tu pago correctamente. ¡Muchas gracias por tu confianza! \n\nEn breve recibirás más detalles por correo. ¡Estamos muy felices de que te uniste! 😊`;
                   
                   await supabaseClient.functions.invoke('send-message-v3', {
                      body: { channel_id: lead.channel_id, phone: lead.telefono, message: thanksMsg }
                   });

                   await supabaseClient.from('activity_logs').insert({
                      action: 'UPDATE', resource: 'LEADS', description: `💰 Venta cerrada AUTO: ${lead.nombre} via WooCommerce`, status: 'OK'
                   });
                }
             }
          } catch (e) { console.error(`[WC-Watcher] Error:`, e.message); }
       }
    }

    // ========================================================
    // 3. AUTO-ROUTING BATCH (Asignación de huérfanos)
    // ========================================================
    const { data: orphanLeads } = await supabaseClient.from('leads').select('id, ciudad').is('assigned_to', null).not('ciudad', 'is', null);
    const { data: activeAgents } = await supabaseClient.from('profiles').select('id, territories').eq('is_active', true);
    
    if (orphanLeads && orphanLeads.length > 0 && activeAgents) {
        for (const ol of orphanLeads) {
            const cityNorm = ol.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            for (const agent of activeAgents) {
                if (!agent.territories) continue;
                const match = agent.territories.some(t => {
                    const tNorm = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return cityNorm.includes(tNorm) || tNorm.includes(cityNorm);
                });
                if (match) {
                    await supabaseClient.from('leads').update({ assigned_to: agent.id }).eq('id', ol.id);
                    break;
                }
            }
        }
    }

    // ========================================================
    // 4. LIMPIEZA AUTOMÁTICA (DESCARTAR A PERDIDO)
    // ========================================================
    const daysToLost = parseInt(getConfig('days_to_lost_lead') || '14');
    const lostDateThreshold = new Date();
    lostDateThreshold.setDate(lostDateThreshold.getDate() - daysToLost);

    const { data: leadsToLose } = await supabaseClient.from('leads')
        .select('id')
        .not('buying_intent', 'in', '("COMPRADO","PERDIDO")')
        .lt('last_message_at', lostDateThreshold.toISOString());

    if (leadsToLose && leadsToLose.length > 0) {
        const ids = leadsToLose.map(l => l.id);
        await supabaseClient.from('leads').update({ buying_intent: 'PERDIDO' }).in('id', ids);
        console.log(`[process-followups] ${ids.length} leads movidos a PERDIDO por inactividad.`);
    }

    // ========================================================
    // 5. ALERTAS Y RECORDATORIOS PARA AGENTES (NUEVO)
    // ========================================================
    const { data: leadsWithReminders } = await supabaseClient
        .from('leads')
        .select('id, nombre, assigned_to, reminders')
        .not('reminders', 'is', null)
        .neq('reminders', '[]');

    if (leadsWithReminders && leadsWithReminders.length > 0) {
        const now = new Date();
        const { data: allAgentsProfiles } = await supabaseClient.from('profiles').select('id, phone, full_name').eq('is_active', true);
        const agentMap = (allAgentsProfiles || []).reduce((acc, a) => ({...acc, [a.id]: a}), {});

        for (const lead of leadsWithReminders) {
            let remindersModified = false;
            let currentReminders = typeof lead.reminders === 'string' ? JSON.parse(lead.reminders) : lead.reminders;
            
            if (!Array.isArray(currentReminders)) continue;

            for (let i = 0; i < currentReminders.length; i++) {
                const rem = currentReminders[i];
                if (rem.notified || !rem.datetime) continue;

                const remTime = new Date(rem.datetime);
                const notifyMinutes = parseInt(rem.notify_minutes) || 0;
                const triggerTime = new Date(remTime.getTime() - (notifyMinutes * 60000));

                if (now >= triggerTime) {
                    if (rem.notify_wa !== false && lead.assigned_to) {
                        const agent = agentMap[lead.assigned_to];
                        if (agent && agent.phone) {
                            const msg = `⏰ *RECORDATORIO CRM*\n\nHola ${agent.full_name?.split(' ')[0] || 'Asesor'},\nTienes una tarea con el lead *${lead.nombre}*:\n\n📌 *${rem.title || 'Tarea programada'}*\n🕒 Hora: ${remTime.toLocaleString('es-MX', {timeStyle: 'short', dateStyle: 'short'})}`;
                            
                            const defaultCh = getConfig('default_notification_channel');
                            if (defaultCh) {
                                await supabaseClient.functions.invoke('send-message-v3', {
                                    body: { channel_id: defaultCh, phone: agent.phone, message: msg }
                                });
                            }
                        }
                    }
                    currentReminders[i].notified = true;
                    remindersModified = true;
                }
            }

            if (remindersModified) {
                await supabaseClient.from('leads').update({ reminders: currentReminders }).eq('id', lead.id);
            }
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})