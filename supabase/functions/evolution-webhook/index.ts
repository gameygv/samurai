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
    try { payload = JSON.parse(payloadText); } catch (e) { return new Response("Invalid JSON", { status: 400 }); }
    
    // Verificar Kill Switch Global antes de procesar IA
    const { data: globalAiConf } = await supabaseClient.from('app_config').select('value').eq('key', 'global_ai_status').maybeSingle();
    const isGlobalAiPaused = globalAiConf?.value === 'paused';

    let phone, text = '', pushName = 'Cliente WA', mediaType = null, messageId = null;
    let actualChannelId = channelIdParam;

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

        // ENFORCE CHANNEL MATCHING PARA META (Evita cruces)
        const phoneNumberId = change.metadata?.phone_number_id;
        if (phoneNumberId) {
            const { data: ch } = await supabaseClient.from('whatsapp_channels').select('id').eq('instance_id', phoneNumberId).maybeSingle();
            if (ch) {
                actualChannelId = ch.id;
            } else {
                await logTrace(`Bloqueo de seguridad: Mensaje recibido del número ID '${phoneNumberId}', pero no está registrado en Canales WA del CRM. Ignorando para evitar responder desde otro número.`, true);
                return new Response('channel_not_registered', { status: 200 });
            }
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
       
       // Soportar Gowa y Evolution V1/V2
       const p = payload.payload || payload.data;
       if (!p || p.is_from_me || p.fromMe) return new Response('ignored_self', { status: 200 });

       // ENFORCE CHANNEL MATCHING PARA GOWA (Evita cruces de instancias nuevas no agregadas)
       const instanceName = payload.device_id || payload.instance;
       if (instanceName) {
           const { data: ch } = await supabaseClient.from('whatsapp_channels').select('id').eq('instance_id', instanceName).maybeSingle();
           if (ch) {
               actualChannelId = ch.id;
           } else {
               await logTrace(`Bloqueo de seguridad: Gowa envió un mensaje de la instancia '${instanceName}', pero no está agregada en Canales WA del CRM. Ignorando para evitar cruces.`, true);
               return new Response('channel_not_registered', { status: 200 });
           }
       }

       phone = p.from || p.key?.remoteJid;
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
      const { data: nl } = await supabaseClient.from('leads').insert({ nombre: pushName, telefono: senderPhone, channel_id: actualChannelId || null }).select().single();
      lead = nl;
    } else {
      // Actualiza el channel_id al que recibió el mensaje para asegurar que si le respondemos, salga del correcto
      await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString(), followup_stage: 0, channel_id: actualChannelId || lead.channel_id }).eq('id', lead.id);
      lead.channel_id = actualChannelId || lead.channel_id;
    }

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

    await supabaseClient.functions.invoke('analyze-leads', { body: { lead_id: lead.id, force: false } });

    const { data: updatedLead } = await supabaseClient.from('leads').select('*').eq('id', lead.id).single();
    if (updatedLead) lead = updatedLead;

    if (!lead.ai_paused && !isGlobalAiPaused && isChannelActive) {
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