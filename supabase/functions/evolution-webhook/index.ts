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
    
    let phone, text = '', pushName = 'Cliente WA', mediaType = null, messageId = null;

    if (payload.device_id && payload.event) { 
       if (payload.event !== 'message') return new Response('ignored_event', { status: 200 });
       const p = payload.payload;
       if (!p || p.is_from_me) return new Response('ignored_self', { status: 200 });

       phone = p.from;
       messageId = p.id;
       pushName = p.from_name || 'Lead Gowa';

       if (p.image) { text = p.body || "[Imagen]"; mediaType = 'image'; } 
       else if (p.video) { text = p.body || "[Video]"; mediaType = 'video'; } 
       else if (p.audio) { text = "[Audio]"; mediaType = 'audio'; } 
       else if (p.document) { text = p.body || "[Documento]"; mediaType = 'document'; } 
       else if (p.body) { text = p.body; mediaType = 'text'; }
    } else {
       return new Response('unknown_payload', { status: 200 });
    }

    if (!phone || !messageId) return new Response('invalid_data', { status: 200 });
    let senderPhone = phone.split('@')[0].replace(/\D/g, '');

    const { data: existingMsg } = await supabaseClient.from('conversaciones').select('id').contains('metadata', { msgId: messageId }).limit(1).maybeSingle();
    if (existingMsg) return new Response('duplicate', { status: 200 });

    // BUSCAR CREDENCIALES DEL CANAL PARA DESCARGA DINÁMICA
    const { data: channelData } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelIdParam).maybeSingle();
    let downloadedBlob = null;
    let finalMediaUrl = null;

    if (mediaType && mediaType !== 'text' && channelData) {
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

    // WHISPER (Si es audio)
    if (mediaType === 'audio' && downloadedBlob) {
        const { data: conf } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').maybeSingle();
        if (conf?.value) {
            const formData = new FormData();
            formData.append('file', downloadedBlob, 'voice_note.ogg'); 
            formData.append('model', 'whisper-1');
            formData.append('language', 'es');

            const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: 'POST', headers: { 'Authorization': `Bearer ${conf.value}` }, body: formData });
            if (whisperRes.ok) {
                const whisperData = await whisperRes.json();
                if (whisperData.text) text = `[TRANSCRIPCIÓN DE NOTA DE VOZ]: "${whisperData.text}"`;
            }
        }
    }

    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${senderPhone.slice(-10)}%`).limit(1).maybeSingle();
    if (!lead) {
      const { data: nl } = await supabaseClient.from('leads').insert({ nombre: pushName, telefono: senderPhone, channel_id: channelIdParam || null }).select().single();
      lead = nl;
    } else {
      await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString(), followup_stage: 0 }).eq('id', lead.id);
    }

    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, emisor: 'CLIENTE', mensaje: text || " ", platform: 'WHATSAPP',
        metadata: { msgId: messageId, mediaUrl: finalMediaUrl, mediaType }
    });

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
       })();
    }

    await Promise.allSettled([analyzeTask, aiTask]);
    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    await logTrace(`ERROR CRÍTICO: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});