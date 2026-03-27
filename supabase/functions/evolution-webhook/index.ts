// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  const url = new URL(req.url);
  const channelIdParam = url.searchParams.get('channel_id');
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  // 1. VERIFICACIÓN DEL WEBHOOK DE META (Challenge)
  if (req.method === 'GET') {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    if (mode && token) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const logTrace = async (msg: string, isError = false) => {
    await supabaseClient.from('activity_logs').insert({
        action: isError ? 'ERROR' : 'UPDATE', resource: 'SYSTEM',
        description: `Webhook Trace: ${msg}`, status: isError ? 'ERROR' : 'OK'
    });
  };

  try {
    const payloadText = await req.text();
    let payload;
    try { 
        payload = JSON.parse(payloadText); 
    } catch (e) { 
        return new Response("Invalid JSON", { status: 400 }); 
    }
    
    // CARGAR CONFIGURACIÓN GLOBAL DE ENRUTAMIENTO Y ESTADOS
    const { data: appConfigData } = await supabaseClient.from('app_config')
      .select('key, value')
      .in('key', ['global_ai_status', 'channel_routing_mode', 'channel_agent_map', 'openai_api_key']);
      
    const configMap = appConfigData?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    
    const isGlobalAiPaused = configMap['global_ai_status'] === 'paused';
    const routingMode = configMap['channel_routing_mode'] || 'auto';
    let channelAgentMap = {};
    try { channelAgentMap = JSON.parse(configMap['channel_agent_map'] || '{}'); } catch(e) {}

    let phone, text = '', pushName = 'Cliente WA', mediaType = null, messageId = null;
    let actualChannelId = channelIdParam;
    let isFromMe = false;

    // =====================================================================
    // DETECCIÓN Y PARSEO: META CLOUD API
    // =====================================================================
    if (payload.object === 'whatsapp_business_account' && payload.entry) {
        const change = payload.entry[0]?.changes?.[0]?.value;
        if (change.statuses) return new Response('status_ignored', { status: 200 });
        
        const msg = change.messages?.[0];
        if (!msg) return new Response('no_messages', { status: 200 });
        
        const contact = change.contacts?.[0];
        phone = msg.from;
        messageId = msg.id;
        pushName = contact?.profile?.name || 'Lead Meta';

        // Meta no suele enviar eventos de "fromMe" al webhook de mensajes estándar en Cloud API de la misma manera
        // Pero lo preparamos por si acaso.
        
        const phoneNumberId = change.metadata?.phone_number_id;
        if (phoneNumberId) {
            const { data: ch } = await supabaseClient.from('whatsapp_channels').select('id').eq('instance_id', phoneNumberId).maybeSingle();
            if (ch) actualChannelId = ch.id;
        }

        if (msg.type === 'text') { text = msg.text?.body || ''; mediaType = 'text'; } 
        else if (msg.type === 'image') { text = msg.image?.caption || '[Imagen]'; mediaType = 'image'; } 
        else if (msg.type === 'audio') { text = '[Audio]'; mediaType = 'audio'; } 
        else if (msg.type === 'document') { text = msg.document?.caption || '[Documento]'; mediaType = 'document'; } 
        else if (msg.type === 'video') { text = msg.video?.caption || '[Video]'; mediaType = 'video'; } 
        else { text = '[Mensaje no soportado]'; mediaType = 'text'; }
    } 
    // =====================================================================
    // DETECCIÓN Y PARSEO: GOWA / EVOLUTION API
    // =====================================================================
    else if ((payload.device_id || payload.instance) && payload.event) { 
       if (payload.event !== 'message' && payload.event !== 'messages.upsert') return new Response('ignored_event', { status: 200 });
       
       const p = payload.payload || payload.data;
       if (!p) return new Response('ignored_empty', { status: 200 });
       
       isFromMe = p.is_from_me || p.fromMe || false;

       const instanceName = payload.device_id || payload.instance;
       if (instanceName) {
           const { data: ch } = await supabaseClient.from('whatsapp_channels').select('id').eq('instance_id', instanceName).maybeSingle();
           if (ch) actualChannelId = ch.id;
       }

       // Si es del agente, el remoteJid es el cliente. Si es del cliente, el remoteJid es el cliente.
       phone = isFromMe ? (p.to || p.key?.remoteJid) : (p.from || p.key?.remoteJid);
       if (!phone) return new Response('no_phone', { status: 200 });
       
       messageId = p.id || p.key?.id;
       pushName = p.from_name || p.pushName || 'Lead Gowa';

       if (p.image || p.message?.imageMessage) { text = p.body || p.message?.imageMessage?.caption || "[Imagen]"; mediaType = 'image'; } 
       else if (p.video || p.message?.videoMessage) { text = p.body || p.message?.videoMessage?.caption || "[Video]"; mediaType = 'video'; } 
       else if (p.audio || p.message?.audioMessage) { text = "[Audio]"; mediaType = 'audio'; } 
       else if (p.document || p.message?.documentMessage) { text = p.body || "[Documento]"; mediaType = 'document'; } 
       else { text = p.body || p.message?.conversation || p.message?.extendedTextMessage?.text || "[Mensaje]"; mediaType = 'text'; }
    } 
    else {
       return new Response('unknown_payload', { status: 200 });
    }

    if (!phone || !messageId) return new Response('invalid_data', { status: 200 });
    let senderPhone = phone.split('@')[0].replace(/\D/g, '');

    const { data: existingMsg } = await supabaseClient.from('conversaciones').select('id').contains('metadata', { msgId: messageId }).limit(1).maybeSingle();
    if (existingMsg) return new Response('duplicate', { status: 200 });

    const { data: channelData } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', actualChannelId).maybeSingle();
    const isChannelActive = channelData?.is_active !== false;

    // RESOLUCIÓN DEL AGENTE Y LEAD
    let assignedAgent = routingMode === 'channel' ? (channelAgentMap[actualChannelId] || null) : null;

    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${senderPhone.slice(-10)}%`).limit(1).maybeSingle();
    if (!lead) {
        if (isFromMe) return new Response('ignore_new_lead_from_me', { status: 200 }); // Evitar crear leads si el agente manda mensaje a alguien no registrado

        const { data: nl } = await supabaseClient.from('leads').insert({ 
           nombre: pushName, 
           telefono: senderPhone, 
           channel_id: actualChannelId || null,
           assigned_to: assignedAgent
        }).select().single();
        lead = nl;
    } else {
        const updates: any = { 
           last_message_at: new Date().toISOString(), 
           channel_id: actualChannelId || lead.channel_id 
        };
        
        // El cliente contestó, reiniciamos el funnel de retargeting
        if (!isFromMe) updates.followup_stage = 0;

        if (assignedAgent && lead.assigned_to !== assignedAgent) {
           updates.assigned_to = assignedAgent;
        }

        await supabaseClient.from('leads').update(updates).eq('id', lead.id);
        lead.channel_id = updates.channel_id;
        if (updates.assigned_to) lead.assigned_to = updates.assigned_to;
    }

    // =====================================================================
    // MANEJO DE MENSAJES ENVIADOS POR EL AGENTE (isFromMe = true)
    // =====================================================================
    if (isFromMe) {
        const cmd = text.trim().toUpperCase();
        
        if (cmd === '#STOP' || cmd === '#START') {
            const isPaused = cmd === '#STOP';
            await supabaseClient.from('leads').update({ ai_paused: isPaused }).eq('id', lead.id);
            await supabaseClient.from('conversaciones').insert({
                lead_id: lead.id, emisor: 'SISTEMA', platform: 'PANEL_INTERNO',
                mensaje: `IA ${isPaused ? 'Pausada' : 'Activada'} por comando desde WhatsApp.`
            });
            return new Response('command_processed', { status: 200, headers: corsHeaders });
        }

        // Si no es comando, registramos el mensaje del humano en el CRM y no disparamos IA
        await supabaseClient.from('conversaciones').insert({ 
            lead_id: lead.id, emisor: 'HUMANO', mensaje: text, platform: 'WHATSAPP',
            metadata: { msgId: messageId, mediaType, source: 'whatsapp_web' }
        });

        return new Response('human_message_saved', { status: 200, headers: corsHeaders });
    }

    // =====================================================================
    // MANEJO DE MULTIMEDIA DEL CLIENTE (isFromMe = false)
    // =====================================================================
    let downloadedBlob = null;
    let finalMediaUrl = null;

    if (mediaType && mediaType !== 'text' && channelData && channelData.provider === 'gowa') {
        try {
            const apiBaseUrl = channelData.api_url.endsWith('/') ? channelData.api_url.slice(0, -1) : channelData.api_url;
            const authHeader = channelData.api_key.startsWith('Basic ') ? channelData.api_key : `Basic ${channelData.api_key}`;
            const headers = { "Authorization": authHeader, "X-Device-Id": channelData.instance_id };
            
            if (mediaType === 'audio') await sleep(1500);

            const triggerUrl = `${apiBaseUrl}/message/${messageId}/download?phone=${senderPhone}`;
            const triggerRes = await fetch(triggerUrl, { headers });
            const triggerData = await triggerRes.json();

            if (triggerData.code === "SUCCESS" && triggerData.results?.file_path) {
                const realPath = triggerData.results.file_path;
                const binaryUrl = `${apiBaseUrl}/${realPath}`;
                
                const binaryRes = await fetch(binaryUrl, { headers });
                if (binaryRes.ok) {
                    downloadedBlob = await binaryRes.blob();
                    const fileName = `inbound/${Date.now()}_${messageId.substring(0,8)}.${mediaType === 'audio' ? 'ogg' : 'bin'}`;
                    const { data: uploadData } = await supabaseClient.storage.from('media').upload(fileName, downloadedBlob, { contentType: downloadedBlob.type });
                    if (uploadData) finalMediaUrl = supabaseClient.storage.from('media').getPublicUrl(fileName).data.publicUrl;
                }
            }
        } catch (e) { await logTrace(`Error en descarga multimedia: ${e.message}`, true); }
    }

    if (mediaType === 'audio' && downloadedBlob) {
        if (configMap['openai_api_key']) {
            const formData = new FormData();
            formData.append('file', downloadedBlob, 'voice_note.ogg'); 
            formData.append('model', 'whisper-1');
            formData.append('language', 'es');

            const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: 'POST', headers: { 'Authorization': `Bearer ${configMap['openai_api_key']}` }, body: formData });
            if (whisperRes.ok) {
                const whisperData = await whisperRes.json();
                if (whisperData.text) text = `[TRANSCRIPCIÓN DE NOTA DE VOZ]: "${whisperData.text}"`;
            }
        }
    }

    // REGISTRO DE MENSAJE DEL CLIENTE
    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, emisor: 'CLIENTE', mensaje: text || " ", platform: 'WHATSAPP',
        metadata: { msgId: messageId, mediaUrl: finalMediaUrl, mediaType }
    });

    if (mediaType === 'image' && finalMediaUrl && lead.buying_intent === 'ALTO') {
       await supabaseClient.from('media_assets').insert({
           title: `Comprobante de ${lead.nombre} (${new Date().toLocaleDateString()})`,
           url: finalMediaUrl, type: 'IMAGE', category: 'PAYMENT', ai_instructions: `Lead ID: ${lead.id}` 
       });
       await logTrace(`Comprobante interceptado de ${lead.nombre}. Enviado al Centro Financiero.`, false);
    }

    // EXTRAER DATOS (SIEMPRE ACTIVO)
    await supabaseClient.functions.invoke('analyze-leads', { body: { lead_id: lead.id, force: false } });

    // =====================================================================
    // CONTROL DE HORARIOS (Si la IA estaba pausada, verificar horario)
    // =====================================================================
    const { data: updatedLead } = await supabaseClient.from('leads').select('*').eq('id', lead.id).single();
    if (updatedLead) lead = updatedLead;

    if (lead.ai_paused && lead.assigned_to) {
        const { data: schedData } = await supabaseClient.from('app_config').select('value').eq('key', `agent_schedule_${lead.assigned_to}`).maybeSingle();
        if (schedData?.value) {
            try {
                const schedule = JSON.parse(schedData.value);
                if (schedule.enabled && schedule.start && schedule.end) {
                    const now = new Date();
                    // Ajuste aprox a CST (UTC-6)
                    const cstHour = (now.getUTCHours() - 6 + 24) % 24;
                    const currentMinutes = cstHour * 60 + now.getUTCMinutes();

                    const [startH, startM] = schedule.start.split(':').map(Number);
                    const [endH, endM] = schedule.end.split(':').map(Number);
                    const startMinutes = startH * 60 + startM;
                    const endMinutes = endH * 60 + endM;

                    let isWorkingHours = false;
                    if (startMinutes <= endMinutes) {
                        isWorkingHours = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
                    } else {
                        // Cruza la medianoche (ej 22:00 a 08:00)
                        isWorkingHours = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
                    }

                    // Si está FUERA del horario de trabajo, la IA DEBE contestar.
                    if (!isWorkingHours) {
                        lead.ai_paused = false;
                        await supabaseClient.from('leads').update({ ai_paused: false }).eq('id', lead.id);
                        await supabaseClient.from('conversaciones').insert({
                            lead_id: lead.id, emisor: 'SISTEMA', platform: 'PANEL_INTERNO',
                            mensaje: `IA auto-activada. El asesor está fuera de su turno (${schedule.start} - ${schedule.end}).`
                        });
                        await logTrace(`Auto-IA activada para ${lead.nombre} (Fuera de horario).`);
                    }
                }
            } catch(e) { console.error("Error parseando horario:", e); }
        }
    }

    // =====================================================================
    // RESPUESTA DE LA IA
    // =====================================================================
    if (!lead.ai_paused && !isGlobalAiPaused && isChannelActive) {
       const openaiKey = configMap['openai_api_key'];

       if (openaiKey) {
          const { data: context } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead, platform: 'WHATSAPP' } });
          const { data: historyData } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(12);
          const history = (historyData || []).reverse();
          const messages = [ { role: 'system', content: context.system_prompt }, ...history.map(h => ({ role: (['IA', 'SAMURAI', 'BOT'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje })) ];

          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST', headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.4 })
          });

          const aiData = await aiRes.json();
          let aiText = aiData.choices?.[0]?.message?.content || '';

          if (aiText) {
             let mediaUrlToSend = null;
             const match = aiText.match(/<<MEDIA:\s*(.+?)\s*>>/i);
             if (match) { mediaUrlToSend = match[1].trim(); aiText = aiText.replace(match[0], '').trim(); }

             await supabaseClient.functions.invoke('send-message-v3', {
                body: { channel_id: lead.channel_id, phone: senderPhone, message: aiText, mediaData: mediaUrlToSend ? { url: mediaUrlToSend, type: 'image' } : undefined }
             });

             await supabaseClient.from('conversaciones').insert({ 
                lead_id: lead.id, emisor: 'SAMURAI', mensaje: aiText || "[Poster Enviado]", platform: 'WHATSAPP',
                metadata: mediaUrlToSend ? { mediaUrl: mediaUrlToSend, mediaType: 'image' } : {}
             });
          }
       }
    } else {
       if (!isChannelActive) {
           await logTrace(`Mensaje guardado pero IA no respondió porque el CANAL '${channelData?.name || actualChannelId}' está APAGADO en el CRM.`, false);
       } else if (isGlobalAiPaused) {
           await logTrace(`Mensaje guardado pero IA no respondió porque el KILL SWITCH GLOBAL está activado.`, false);
       }
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    await logTrace(`ERROR CRÍTICO: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});