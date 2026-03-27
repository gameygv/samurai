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
    try { payload = JSON.parse(payloadText); } catch (e) { return new Response("Invalid JSON", { status: 400 }); }
    
    const { data: appConfigData } = await supabaseClient.from('app_config').select('key, value').in('key', ['global_ai_status', 'channel_routing_mode', 'channel_agent_map', 'openai_api_key']);
    const configMap = appConfigData?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    
    const isGlobalAiPaused = configMap['global_ai_status'] === 'paused';
    const routingMode = configMap['channel_routing_mode'] || 'auto';
    let channelAgentMap = {};
    try { channelAgentMap = JSON.parse(configMap['channel_agent_map'] || '{}'); } catch(e) {}

    let phone, text = '', pushName = 'Cliente WA', mediaType = null, messageId = null;
    let actualChannelId = channelIdParam;
    let isFromMe = false;

    // =====================================================================
    // DETECCIÓN Y PARSEO: GOWA / EVOLUTION API
    // =====================================================================
    if ((payload.device_id || payload.instance) && payload.event) { 
       if (payload.event !== 'message' && payload.event !== 'messages.upsert' && payload.event !== 'SEND_MESSAGE') {
           return new Response('ignored_event', { status: 200 });
       }
       
       const p = payload.payload || payload.data || payload;
       if (!p) return new Response('ignored_empty', { status: 200 });
       
       // DETECCIÓN CRÍTICA DE QUIÉN ENVÍA
       if (payload.event === 'SEND_MESSAGE') isFromMe = true;
       if (p.is_from_me === true || p.fromMe === true || p.key?.fromMe === true) isFromMe = true;

       const instanceName = String(payload.device_id || payload.instance || '').trim();
       if (instanceName) {
           const { data: ch } = await supabaseClient.from('whatsapp_channels').select('id').ilike('instance_id', instanceName).maybeSingle();
           if (ch) actualChannelId = ch.id;
       }

       // RESOLUCIÓN DEL TELÉFONO DEL CLIENTE (Incluso si envié yo el mensaje)
       phone = p.remoteJid || p.key?.remoteJid || (isFromMe ? p.to : p.from);
       if (!phone) return new Response('no_phone', { status: 200 });
       phone = phone.split('@')[0].replace(/\D/g, '');
       
       messageId = p.id || p.key?.id || `msg-${Date.now()}`;
       pushName = p.from_name || p.pushName || 'Nuevo Prospecto';

       // EXTRACCIÓN DE TEXTO ROBUSTA (Para Evo v1 y v2)
       if (p.image || p.message?.imageMessage) { text = p.body || p.message?.imageMessage?.caption || "[Imagen]"; mediaType = 'image'; } 
       else if (p.video || p.message?.videoMessage) { text = p.body || p.message?.videoMessage?.caption || "[Video]"; mediaType = 'video'; } 
       else if (p.audio || p.message?.audioMessage) { text = "[Audio]"; mediaType = 'audio'; } 
       else if (p.document || p.message?.documentMessage) { text = p.body || p.message?.documentMessage?.caption || "[Documento]"; mediaType = 'document'; } 
       else { text = p.text || p.body || p.message?.conversation || p.message?.extendedTextMessage?.text || "[Mensaje]"; mediaType = 'text'; }
    } 
    // =====================================================================
    // META CLOUD API
    // =====================================================================
    else if (payload.object === 'whatsapp_business_account' && payload.entry) {
        const change = payload.entry[0]?.changes?.[0]?.value;
        if (change.statuses) return new Response('status_ignored', { status: 200 });
        const msg = change.messages?.[0];
        if (!msg) return new Response('no_messages', { status: 200 });
        
        phone = msg.from.replace(/\D/g, '');
        messageId = msg.id;
        pushName = change.contacts?.[0]?.profile?.name || 'Lead Meta';

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
    } else {
        return new Response('unknown_payload', { status: 200 });
    }

    // =====================================================================
    // FILTROS DE SEGURIDAD Y ASIGNACIÓN
    // =====================================================================
    const { data: existingMsg } = await supabaseClient.from('conversaciones').select('id').contains('metadata', { msgId: messageId }).limit(1).maybeSingle();
    if (existingMsg) return new Response('duplicate', { status: 200 });

    const channelOwner = actualChannelId ? (channelAgentMap[actualChannelId] || null) : null;
    let assignedAgent = routingMode === 'channel' ? channelOwner : null;

    let { data: lead } = await supabaseClient.from('leads').select('*').eq('telefono', phone).maybeSingle();

    if (!lead) {
        // SI ES NUEVO LEAD Y EL MENSAJE LO ENVIÓ EL AGENTE, ASIGNÁRSELO A ÉL DE INMEDIATO
        const newAssignee = assignedAgent || (isFromMe ? channelOwner : null);
        
        const { data: nl } = await supabaseClient.from('leads').insert({ 
           nombre: pushName, 
           telefono: phone, 
           channel_id: actualChannelId || null, 
           assigned_to: newAssignee,
           ai_paused: isFromMe || newAssignee ? true : false 
        }).select().single();
        lead = nl;
        await logTrace(`Nuevo lead creado: ${phone}. Asignado a: ${newAssignee || 'Bot'}`);
    } else {
        const updates: any = { last_message_at: new Date().toISOString() };
        if (actualChannelId) updates.channel_id = actualChannelId;
        if (!isFromMe) updates.followup_stage = 0;

        // Si el agente escribe manualmente desde su cel y el lead estaba huérfano, se lo apropia
        if (isFromMe) {
            updates.ai_paused = true; // Pausa a la IA para que no moleste
            if (!lead.assigned_to && channelOwner) {
                updates.assigned_to = channelOwner;
            }
        }

        await supabaseClient.from('leads').update(updates).eq('id', lead.id);
        lead = { ...lead, ...updates };
    }

    // =====================================================================
    // REGISTRO DE MENSAJES (HUMANO VS CLIENTE)
    // =====================================================================
    let finalMediaUrl = null;

    if (isFromMe) {
        await supabaseClient.from('conversaciones').insert({ 
            lead_id: lead.id, emisor: 'HUMANO', mensaje: text || "[Archivo/Media Enviado]", platform: 'WHATSAPP',
            metadata: { msgId: messageId, mediaType, source: 'whatsapp_device' }
        });
        return new Response('human_message_saved', { status: 200, headers: corsHeaders });
    }

    // DESCARGA DE MEDIA (SI ES DEL CLIENTE)
    const { data: channelData } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', actualChannelId).maybeSingle();
    
    if (mediaType && mediaType !== 'text' && channelData?.provider === 'gowa') {
        try {
            const apiBaseUrl = channelData.api_url.endsWith('/') ? channelData.api_url.slice(0, -1) : channelData.api_url;
            const authHeader = channelData.api_key.startsWith('Basic ') ? channelData.api_key : `Basic ${channelData.api_key}`;
            const headers = { "Authorization": authHeader, "X-Device-Id": channelData.instance_id };
            if (mediaType === 'audio') await sleep(1000);
            
            const triggerUrl = `${apiBaseUrl}/message/${messageId}/download?phone=${phone}`;
            const triggerRes = await fetch(triggerUrl, { headers });
            const triggerData = await triggerRes.json();

            if (triggerData.code === "SUCCESS" && triggerData.results?.file_path) {
                const binaryRes = await fetch(`${apiBaseUrl}/${triggerData.results.file_path}`, { headers });
                if (binaryRes.ok) {
                    const downloadedBlob = await binaryRes.blob();
                    const fileName = `inbound/${Date.now()}_${messageId.substring(0,8)}.${mediaType === 'audio' ? 'ogg' : 'bin'}`;
                    const { data: uploadData } = await supabaseClient.storage.from('media').upload(fileName, downloadedBlob, { contentType: downloadedBlob.type });
                    if (uploadData) finalMediaUrl = supabaseClient.storage.from('media').getPublicUrl(fileName).data.publicUrl;
                }
            }
        } catch (e) {}
    }

    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, emisor: 'CLIENTE', mensaje: text || " ", platform: 'WHATSAPP',
        metadata: { msgId: messageId, mediaUrl: finalMediaUrl, mediaType }
    });

    // RESPUESTA IA (SI APLICA)
    const isChannelActive = channelData?.is_active !== false;
    if (!lead.ai_paused && !isGlobalAiPaused && isChannelActive && configMap['openai_api_key']) {
        const { data: context } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead, platform: 'WHATSAPP' } });
        const { data: historyData } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
        const history = (historyData || []).reverse();
        const messages = [ { role: 'system', content: context.system_prompt }, ...history.map(h => ({ role: (['IA', 'SAMURAI'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje })) ];

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: 'POST', headers: { 'Authorization': `Bearer ${configMap['openai_api_key']}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.4 })
        });
        const aiData = await aiRes.json();
        let aiText = aiData.choices?.[0]?.message?.content || '';

        if (aiText) {
            let mediaUrlToSend = null;
            const match = aiText.match(/<<MEDIA:\s*(.+?)\s*>>/i);
            if (match) { mediaUrlToSend = match[1].trim(); aiText = aiText.replace(match[0], '').trim(); }

            await supabaseClient.functions.invoke('send-message-v3', {
               body: { channel_id: actualChannelId, phone, message: aiText, mediaData: mediaUrlToSend ? { url: mediaUrlToSend, type: 'image' } : undefined }
            });

            await supabaseClient.from('conversaciones').insert({ 
               lead_id: lead.id, emisor: 'SAMURAI', mensaje: aiText, platform: 'WHATSAPP',
               metadata: mediaUrlToSend ? { mediaUrl: mediaUrlToSend, mediaType: 'image' } : {}
            });
        }
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    await logTrace(`ERROR CRÍTICO: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});