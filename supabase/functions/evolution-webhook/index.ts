// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOWA_BASE_URL = "https://gowa.poesis.net";
const GOWA_AUTH_HEADER = "Basic Z293YTpHMHc0UzNjdXIzITIwMjY=";
const GOWA_DEVICE_ID = "gowa";

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
    
    // --- 1. RESOLVER CANAL ---
    let channel = null;
    const deviceJid = payload.device_id;

    if (channelIdParam) {
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelIdParam).limit(1);
       if (data && data.length > 0) channel = data[0];
    }
    if (!channel && deviceJid) {
       const deviceNum = deviceJid.split('@')[0];
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').or(`instance_id.eq.${deviceNum},instance_id.eq.gowa`).limit(1);
       if (data && data.length > 0) channel = data[0];
    }
    if (!channel) {
       const { data: defConfig } = await supabaseClient.from('app_config').select('value').eq('key', 'default_notification_channel').limit(1);
       if (defConfig && defConfig.length > 0) {
           const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', defConfig[0].value).limit(1);
           if (data && data.length > 0) channel = data[0];
       }
    }
    if (!channel) {
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('is_active', true).limit(1);
       if (data && data.length > 0) channel = data[0];
    }
    if (!channel) return new Response('invalid_channel', { status: 200 });

    let phone, text = '', pushName = 'Cliente WA', mediaType = null, messageId = null;

    // --- 2. PARSEAR MENSAJE ---
    if (payload.device_id && payload.event) { 
       if (payload.event !== 'message') return new Response('ignored_event', { status: 200 });
       const p = payload.payload;
       if (!p || p.is_from_me) return new Response('ignored_self', { status: 200 });

       phone = p.from;
       messageId = payload.id || p.id; 
       pushName = p.from_name || 'Lead Gowa';

       if (p.image) { text = p.body || "[Imagen]"; mediaType = 'image'; } 
       else if (p.video) { text = p.body || "[Video]"; mediaType = 'video'; } 
       else if (p.audio) { text = "[Audio]"; mediaType = 'audio'; } 
       else if (p.document) { text = p.body || "[Documento]"; mediaType = 'document'; } 
       else if (p.body) { text = p.body; mediaType = 'text'; }
    } else { 
       if (payload.event && payload.event !== 'messages.upsert') return new Response('ignored_event', { status: 200 });
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe || payload.fromMe) return new Response('ignored_self', { status: 200 });
       
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       messageId = msg?.key?.id || payload.id;
       
       if (msg?.message?.audioMessage) { text = "[Audio]"; mediaType = 'audio'; } 
       else { text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || ''; }
    }

    if (!phone) return new Response('invalid_phone', { status: 200 });
    let cleanPhone = phone.split('@')[0].replace(/\D/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12 && cleanPhone[2] !== '1') cleanPhone = '521' + cleanPhone.substring(2);

    // --- 3. DEDUPLICACIÓN ---
    if (messageId) {
        const { data: existingMsgs } = await supabaseClient.from('conversaciones').select('id').contains('metadata', { msgId: messageId }).limit(1);
        if (existingMsgs && existingMsgs.length > 0) {
            await logTrace(`Mensaje duplicado (${messageId}). Ignorando.`);
            return new Response('duplicate', { status: 200 });
        }
    }

    // --- 4. DESCARGA GOWA EN 2-PASOS ---
    let finalMediaUrl = null;
    let downloadedBlob = null; 

    if (mediaType && mediaType !== 'text' && channel.provider === 'gowa' && messageId) {
        try {
            const GOWA_URL = channel.api_url.endsWith('/') ? channel.api_url.slice(0, -1) : channel.api_url;
            const headers = { "Authorization": channel.api_key.startsWith('Basic ') ? channel.api_key : `Basic ${channel.api_key}`, "X-Device-Id": channel.instance_id };

            const triggerUrl = `${GOWA_URL}/message/${messageId}/download?phone=${cleanPhone}`;
            const triggerRes = await fetch(triggerUrl, { headers });
            const triggerData = await triggerRes.json();

            if (triggerData.code === "SUCCESS" && triggerData.results?.file_path) {
                const binaryRes = await fetch(`${GOWA_URL}/${triggerData.results.file_path}`, { headers });
                if (binaryRes.ok) downloadedBlob = await binaryRes.blob();
            }
        } catch (e) { await logTrace(`Error GOWA Download: ${e.message}`, true); }
    }

    if (downloadedBlob) {
        try {
            const ext = mediaType === 'audio' ? 'ogg' : 'bin';
            const fileName = `inbound/${Date.now()}_${messageId.substring(0,8)}.${ext}`;
            const { data: uploadData } = await supabaseClient.storage.from('media').upload(fileName, downloadedBlob, { contentType: downloadedBlob.type });
            if (uploadData) finalMediaUrl = supabaseClient.storage.from('media').getPublicUrl(fileName).data.publicUrl;
        } catch(e) {}
    }

    // WHISPER
    if (mediaType === 'audio' && downloadedBlob) {
        const { data: conf } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').limit(1);
        if (conf && conf.length > 0 && conf[0].value) {
            const formData = new FormData();
            formData.append('file', downloadedBlob, 'voice_note.ogg'); 
            formData.append('model', 'whisper-1');
            formData.append('language', 'es');

            const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: 'POST', headers: { 'Authorization': `Bearer ${conf[0].value}` }, body: formData });
            if (whisperRes.ok) {
                const whisperData = await whisperRes.json();
                if (whisperData.text) text = `[TRANSCRIPCIÓN DE NOTA DE VOZ]: "${whisperData.text}"`;
            }
        }
    }

    // --- 5. ACTUALIZAR CRM ---
    const { data: foundLeads } = await supabaseClient.from('leads').select('*').ilike('telefono', `%${cleanPhone.slice(-10)}%`).order('created_at', { ascending: false }).limit(1);
    let lead = foundLeads?.[0] || null;

    if (!lead) {
      const { data: nl } = await supabaseClient.from('leads').insert({ nombre: pushName, telefono: cleanPhone, channel_id: channel.id }).select().single();
      lead = nl;
    } else {
      await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString(), channel_id: channel.id }).eq('id', lead.id);
    }

    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, emisor: 'CLIENTE', mensaje: text || " ", platform: 'WHATSAPP',
        metadata: { msgId: messageId, mediaUrl: finalMediaUrl, mediaType }
    });

    // --- 6. PROCESOS PARALELOS SEGUROS (Análisis de Datos + Respuesta IA) ---
    const analyzeTask = supabaseClient.functions.invoke('analyze-leads', { body: { lead_id: lead.id, force: false } });

    let aiTask = Promise.resolve();

    if (!lead.ai_paused) {
       aiTask = (async () => {
           const { data: configs } = await supabaseClient.from('app_config').select('key, value');
           const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
           const openaiKey = configMap['openai_api_key'];

           if (openaiKey) {
              const { data: context } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead, platform: 'WHATSAPP' } });
              const { data: historyData } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(12);
              const history = (historyData || []).reverse();
              const messages = [ { role: 'system', content: context.system_prompt }, ...history.map(h => ({ role: (['IA', 'SAMURAI', 'BOT'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje })) ];

              const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.4 })
              });

              const aiData = await aiRes.json();
              let aiText = aiData.choices?.[0]?.message?.content || '';

              if (aiText) {
                 let mediaUrlToSend = null;
                 const match = aiText.match(/<<MEDIA:\s*(.+?)\s*>>/i);
                 if (match) { mediaUrlToSend = match[1].trim(); aiText = aiText.replace(match[0], '').trim(); }

                 await supabaseClient.functions.invoke('send-message-v3', {
                    body: { channel_id: lead.channel_id || channel.id, phone: cleanPhone, message: aiText, mediaData: mediaUrlToSend ? { url: mediaUrlToSend, type: 'image' } : undefined }
                 });

                 await supabaseClient.from('conversaciones').insert({ 
                    lead_id: lead.id, emisor: 'SAMURAI', mensaje: aiText || "[Poster Enviado]", platform: 'WHATSAPP',
                    metadata: mediaUrlToSend ? { mediaUrl: mediaUrlToSend, mediaType: 'image' } : {}
                 });
              }
           }
       })();
    }

    // ESPERAR A QUE AMBAS TAREAS TERMINEN ANTES DE MATAR LA FUNCIÓN
    await Promise.allSettled([analyzeTask, aiTask]);

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    await logTrace(`ERROR CRÍTICO CAPTURADO: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});