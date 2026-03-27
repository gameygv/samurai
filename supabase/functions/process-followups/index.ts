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
    const defaultCh = getConfig('default_notification_channel');

    const autoRoutingAgentsStr = getConfig('auto_routing_agents') || '[]';
    let autoRoutingAgents = [];
    try { autoRoutingAgents = JSON.parse(autoRoutingAgentsStr); } catch(e) {}

    const { data: inactiveChannels } = await supabaseClient.from('whatsapp_channels').select('id').eq('is_active', false);
    const inactiveChannelIds = inactiveChannels?.map(c => c.id) || [];

    // ========================================================
    // 1. LÓGICA DE RETARGETING / FOLLOW-UPS (IA)
    // ========================================================
    const { data: followupConfigs } = await supabaseClient.from('followup_config').select('*');
    const explorationConfig = (followupConfigs || []).find(c => c.strategy_type === 'exploration');
    const salesConfig = (followupConfigs || []).find(c => c.strategy_type === 'sales');
    
    if (explorationConfig?.enabled || salesConfig?.enabled) {
        const currentHour = new Date().getUTCHours() - 6; // Ajuste aprox a CST
        const activeConfigHour = explorationConfig?.enabled ? explorationConfig : salesConfig;
        
        if (activeConfigHour && currentHour >= (activeConfigHour.start_hour || 9) && currentHour <= (activeConfigHour.end_hour || 20)) {
            
            const { data: stagnantLeads } = await supabaseClient.from('leads')
                .select('id, nombre, telefono, channel_id, last_message_at, followup_stage, buying_intent')
                .eq('ai_paused', false)
                .not('buying_intent', 'in', '("COMPRADO","PERDIDO")');

            for (const lead of (stagnantLeads || [])) {
                if (inactiveChannelIds.includes(lead.channel_id)) continue;

                const configToUse = lead.buying_intent === 'ALTO' ? salesConfig : explorationConfig;
                if (!configToUse || !configToUse.enabled) continue;

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
                    
                    // IMPORTANTE: Actualizar BD PRIMERO para evitar que un cron solapado lo vuelva a agarrar
                    await supabaseClient.from('leads').update({ followup_stage: nextStage }).eq('id', lead.id);

                    // LUEGO enviamos
                    await supabaseClient.functions.invoke('send-message-v3', {
                        body: { channel_id: lead.channel_id, phone: lead.telefono, message: finalMsg }
                    });

                    await supabaseClient.from('conversaciones').insert({
                        lead_id: lead.id, emisor: 'SAMURAI', mensaje: finalMsg, platform: 'WHATSAPP_FOLLOWUP'
                    });
                }
            }
        }
    }

    // ========================================================
    // 2. AUTO-RESTART IA (Despausar por inactividad)
    // ========================================================
    const autoRestartMinutes = explorationConfig?.auto_restart_delay || 30;
    if (autoRestartMinutes > 0) {
        const restartThreshold = new Date();
        restartThreshold.setMinutes(restartThreshold.getMinutes() - autoRestartMinutes);

        const { data: pausedLeads } = await supabaseClient.from('leads')
            .select('id, nombre')
            .eq('ai_paused', true)
            .not('buying_intent', 'in', '("COMPRADO","PERDIDO")')
            .lt('last_message_at', restartThreshold.toISOString());

        if (pausedLeads && pausedLeads.length > 0) {
            for (const pl of pausedLeads) {
                await supabaseClient.from('leads').update({ ai_paused: false }).eq('id', pl.id);
                await supabaseClient.from('conversaciones').insert({
                    lead_id: pl.id, 
                    emisor: 'SISTEMA', 
                    platform: 'PANEL_INTERNO',
                    mensaje: `IA reactivada automáticamente tras ${autoRestartMinutes} min de inactividad humana.`,
                    metadata: { author: 'Sistema Auto-Restart' }
                });
            }
            console.log(`[process-followups] ${pausedLeads.length} leads reactivados (Auto-Restart).`);
        }
    }

    // ========================================================
    // 3. AUTO-ROUTING BATCH (Asignación de huérfanos) + NOTIFICACIÓN
    // ========================================================
    const { data: activeAgents } = await supabaseClient.from('profiles').select('id, phone, full_name, territories').eq('is_active', true);
    const validRoutingAgents = activeAgents?.filter(a => autoRoutingAgents.includes(a.id)) || [];
    
    const { data: orphanLeads } = await supabaseClient.from('leads').select('id, nombre, ciudad, telefono').is('assigned_to', null).not('ciudad', 'is', null);
    
    if (orphanLeads && orphanLeads.length > 0 && validRoutingAgents.length > 0) {
        for (const ol of orphanLeads) {
            const cityNorm = ol.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            for (const agent of validRoutingAgents) {
                if (!agent.territories) continue;
                const match = agent.territories.some((t: string) => {
                    const tNorm = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return cityNorm.includes(tNorm) || tNorm.includes(cityNorm);
                });
                
                if (match) {
                    // Si el bot descubre la ciudad y se lo asigna al asesor, la IA se pausa (El humano toma el control)
                    await supabaseClient.from('leads').update({ assigned_to: agent.id, ai_paused: true }).eq('id', ol.id);
                    
                    // Notificar al Asesor si hay un canal configurado
                    if (defaultCh && agent.phone && !inactiveChannelIds.includes(defaultCh)) {
                        const msg = `🎯 *NUEVO LEAD ASIGNADO*\n\nHola ${agent.full_name?.split(' ')[0] || 'Asesor'},\nEl sistema te ha asignado automáticamente un nuevo prospecto de tu zona.\n\n👤 *Nombre:* ${ol.nombre || 'Sin nombre'}\n📍 *Ciudad:* ${ol.ciudad}\n📞 *Teléfono:* ${ol.telefono}\n\nIngresa al CRM para atenderlo.`;
                        await supabaseClient.functions.invoke('send-message-v3', {
                            body: { channel_id: defaultCh, phone: agent.phone, message: msg }
                        });
                    }
                    break;
                }
            }
        }
    }

    // ========================================================
    // 4. LIMPIEZA AUTOMÁTICA (DESCARTAR A PERDIDO)
    // ========================================================
    const daysToLost = parseInt(getConfig('days_to_lost_lead') || '14');
    if (daysToLost > 0) {
        const lostDateThreshold = new Date();
        lostDateThreshold.setDate(lostDateThreshold.getDate() - daysToLost);

        const { data: leadsToLose } = await supabaseClient.from('leads')
            .select('id')
            .not('buying_intent', 'in', '("COMPRADO","PERDIDO")')
            .lt('last_message_at', lostDateThreshold.toISOString());

        if (leadsToLose && leadsToLose.length > 0) {
            const ids = leadsToLose.map((l: any) => l.id);
            await supabaseClient.from('leads').update({ buying_intent: 'PERDIDO' }).in('id', ids);
            console.log(`[process-followups] ${ids.length} leads movidos a PERDIDO por inactividad.`);
        }
    }

    // ========================================================
    // 5. ALERTAS Y RECORDATORIOS PARA AGENTES
    // ========================================================
    const { data: leadsWithReminders } = await supabaseClient
        .from('leads')
        .select('id, nombre, assigned_to, reminders')
        .not('reminders', 'is', null)
        .neq('reminders', '[]');

    if (leadsWithReminders && leadsWithReminders.length > 0 && activeAgents) {
        const now = new Date();
        const agentMap = activeAgents.reduce((acc: any, a: any) => ({...acc, [a.id]: a}), {});

        for (const lead of leadsWithReminders) {
            let remindersModified = false;
            let currentReminders = typeof lead.reminders === 'string' ? JSON.parse(lead.reminders) : lead.reminders;
            
            if (!Array.isArray(currentReminders)) continue;

            let messagesToSend = [];

            for (let i = 0; i < currentReminders.length; i++) {
                const rem = currentReminders[i];
                if (rem.notified || !rem.datetime) continue;

                const remTime = new Date(rem.datetime);
                const notifyMinutes = parseInt(rem.notify_minutes) || 0;
                const triggerTime = new Date(remTime.getTime() - (notifyMinutes * 60000));

                if (now >= triggerTime) {
                    currentReminders[i].notified = true;
                    remindersModified = true;

                    if (rem.notify_wa !== false && lead.assigned_to && !inactiveChannelIds.includes(defaultCh)) {
                        const agent = agentMap[lead.assigned_to];
                        if (agent && agent.phone && defaultCh) {
                            messagesToSend.push({
                                channel_id: defaultCh, 
                                phone: agent.phone, 
                                message: `⏰ *RECORDATORIO CRM*\n\nHola ${agent.full_name?.split(' ')[0] || 'Asesor'},\nTienes una tarea con el lead *${lead.nombre}*:\n\n📌 *${rem.title || 'Tarea programada'}*\n🕒 Hora: ${remTime.toLocaleString('es-MX', {timeStyle: 'short', dateStyle: 'short'})}`
                            });
                        }
                    }
                }
            }

            if (remindersModified) {
                // ACTUALIZAMOS BD PRIMERO
                await supabaseClient.from('leads').update({ reminders: currentReminders }).eq('id', lead.id);
                
                // ENVIAMOS DESPUÉS
                for (const payload of messagesToSend) {
                     await supabaseClient.functions.invoke('send-message-v3', { body: payload });
                }
            }
        }
    }

    // ========================================================
    // 6. WOOCOMMERCE WATCHER
    // ========================================================
    const wcUrl = getConfig('wc_url');
    const wcKey = getConfig('wc_consumer_key');
    const wcSecret = getConfig('wc_consumer_secret');

    if (wcUrl && wcKey && wcSecret) {
       const { data: highIntentLeads } = await supabaseClient.from('leads').select('id, nombre, email, telefono, channel_id').eq('buying_intent', 'ALTO').not('email', 'is', null);

       for (const lead of (highIntentLeads || [])) {
          if (inactiveChannelIds.includes(lead.channel_id)) continue;
          
          try {
             const apiBaseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
             const endpoint = `${apiBaseUrl}/wp-json/wc/v3/orders?customer=${encodeURIComponent(lead.email)}`;
             const auth = btoa(`${wcKey}:${wcSecret}`);
             const wcRes = await fetch(endpoint, { headers: { 'Authorization': `Basic ${auth}` } });

             if (wcRes.ok) {
                const orders = await wcRes.json();
                const paidOrder = orders.find((o: any) => o.status === 'processing' || o.status === 'completed');

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
          } catch (e: any) { console.error(`[WC-Watcher] Error:`, e.message); }
       }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})