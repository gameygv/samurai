// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelIdParam).maybeSingle();
       if (data) channel = data;
    }
    if (!channel && deviceJid) {
       const deviceNum = deviceJid.split('@')[0];
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').or(`instance_id.eq.${deviceNum},instance_id.eq.gowa`).limit(1).maybeSingle();
       if (data) channel = data;
    }
    if (!channel) {
       const { data: defConfig } = await supabaseClient.from('app_config').select('value').eq('key', 'default_notification_channel').maybeSingle();
       if (defConfig?.value) {
           const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', defConfig.value).maybeSingle();
           if (data) channel = data;
       }
    }
    if (!channel) {
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('is_active', true).limit(1).maybeSingle();
       if (data) channel = data;
    }
    if (!channel) return new Response('invalid_channel', { status: 200 });

    let phone, text = '', pushName = 'Cliente WA', mediaUrl = null, mediaType = null, base64String = null;

    // --- 2. PARSEAR MENSAJE ---
    if (payload.device_id && payload.event) { 
       if (payload.event !== 'message') return new Response('ignored_event', { status: 200 });
       if (!payload.payload || payload.payload.is_from_me) return new Response('ignored_self', { status: 200 });

       const p = payload.payload;
       phone = p.from;
       pushName = p.from_name || 'Lead Gowa';
       const GOWA_BASE_URL = channel.api_url.endsWith('/') ? channel.api_url.slice(0, -1) : channel.api_url;

       if (p.image) {
         text = p.body || "[Imagen]"; mediaType = 'image';
         if (p.image.startsWith('data:')) base64String = p.image; else mediaUrl = `${GOWA_BASE_URL}/${p.image}`;
       } else if (p.video) {
         text = p.body || "[Video]"; mediaType = 'video';
         if (p.video.startsWith('data:')) base64String = p.video; else mediaUrl = `${GOWA_BASE_URL}/${p.video}`;
       } else if (p.audio) {
         text = "[Audio]"; mediaType = 'audio';
         if (p.audio.startsWith('data:')) base64String = p.audio; else {
            const audioPath = p.audio.split(";")[0].trim();
            mediaUrl = `${GOWA_BASE_URL}/${audioPath}`;
         }
       } else if (p.document) {
         text = p.body || "[Documento]"; mediaType = 'document';
         if (p.document.startsWith('data:')) base64String = p.document; else mediaUrl = `${GOWA_BASE_URL}/${p.document}`;
       } else if (p.body) {
         text = p.body; mediaType = 'text';
       }
    } else { 
       if (payload.event && payload.event !== 'messages.upsert') return new Response('ignored_event', { status: 200 });
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe || payload.fromMe) return new Response('ignored_self', { status: 200 });
       
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       
       if (msg?.message?.imageMessage) { 
           text = msg?.message?.imageMessage?.caption || "[Imagen]"; mediaType = 'image'; 
       } 
       else if (msg?.message?.audioMessage) { 
           text = "[Audio]"; mediaType = 'audio'; 
       } 
       else { 
           text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || ''; 
       }
    }

    if (!phone) return new Response('invalid_phone', { status: 200 });

    let cleanPhone = phone.split('@')[0].replace(/\D/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12 && cleanPhone[2] !== '1') cleanPhone = '521' + cleanPhone.substring(2);

    // --- 3. DESCARGA Y WHISPER ---
    let finalMediaUrl = null;
    let downloadedBlob = null; 

    if (base64String) {
        const arr = base64String.split(',');
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        downloadedBlob = new Blob([u8arr], {type: mediaType === 'audio' ? 'audio/ogg' : 'application/octet-stream'});
    } else if (mediaUrl) {
        try {
            const authHeader = channel.api_key.startsWith('Basic ') ? channel.api_key : `Basic ${channel.api_key}`;
            const mediaRes = await fetch(mediaUrl, { headers: { 'Authorization': authHeader } });
            if (mediaRes.ok) downloadedBlob = await mediaRes.blob();
        } catch (e) { await logTrace(`Error descargando adjunto: ${e.message}`, true); }
    }

    if (downloadedBlob) {
        try {
            const ext = mediaType === 'audio' ? 'ogg' : 'bin';
            const fileName = `inbound/${Date.now()}.${ext}`;
            const { data: uploadData } = await supabaseClient.storage.from('media').upload(fileName, downloadedBlob, { contentType: downloadedBlob.type });
            if (uploadData) finalMediaUrl = supabaseClient.storage.from('media').getPublicUrl(fileName).data.publicUrl;
        } catch(e) { await logTrace(`Error subiendo a Storage: ${e.message}`, true); }
    }

    // WHISPER
    if (mediaType === 'audio' && downloadedBlob) {
        await logTrace("Audio listo. Llamando a motor Whisper...");
        const { data: conf } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').maybeSingle();
        if (conf?.value) {
            const formData = new FormData();
            formData.append('file', downloadedBlob, 'voice_note.ogg'); 
            formData.append('model', 'whisper-1');
            formData.append('language', 'es');

            const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${conf.value}` },
                body: formData
            });

            if (whisperRes.ok) {
                const whisperData = await whisperRes.json();
                if (whisperData.text) {
                    text = `[TRANSCRIPCIÓN DE NOTA DE VOZ]: "${whisperData.text}"`;
                    await logTrace("Transcripción exitosa.");
                }
            } else {
                const errorData = await whisperRes.json();
                await logTrace(`Fallo Whisper: ${JSON.stringify(errorData)}`, true);
            }
        }
    }

    // --- 4. ACTUALIZAR CRM ---
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (!lead) {
      const { data: nl } = await supabaseClient.from('leads').insert({ nombre: pushName, telefono: cleanPhone, channel_id: channel.id }).select().single();
      lead = nl;
    } else {
      await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString(), channel_id: channel.id }).eq('id', lead.id);
    }

    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, emisor: 'CLIENTE', mensaje: text || "[Nota de voz sin texto]", platform: 'WHATSAPP',
        metadata: finalMediaUrl ? { mediaUrl: finalMediaUrl, mediaType } : {}
    });

    // --- 5. LÓGICA IA ---
    if (!lead.ai_paused) {
       const { data: configs } = await supabaseClient.from('app_config').select('key, value');
       const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
       const openaiKey = configMap['openai_api_key'];

       if (openaiKey) {
          const { data: context } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead, platform: 'WHATSAPP' } });
          const { data: historyData } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(12);
          const history = (historyData || []).reverse();
          
          const messages = [ 
              { role: 'system', content: context.system_prompt },
              ...history.map(h => ({ role: (['IA', 'SAMURAI', 'BOT'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje }))
          ];

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

             await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message-v3`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel_id: lead.channel_id || channel.id, phone: cleanPhone, message: aiText, mediaData: mediaUrlToSend ? { url: mediaUrlToSend, type: 'image' } : undefined })
             });

             await supabaseClient.from('conversaciones').insert({ 
                lead_id: lead.id, emisor: 'SAMURAI', mensaje: aiText || "[Poster Enviado]", platform: 'WHATSAPP',
                metadata: mediaUrlToSend ? { mediaUrl: mediaUrlToSend, mediaType: 'image' } : {}
             });
          }
       }
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    await logTrace(`ERROR CRÍTICO: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});