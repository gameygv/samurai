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
        action: isError ? 'ERROR' : 'UPDATE',
        resource: 'SYSTEM',
        description: `Webhook Trace: ${msg}`,
        status: isError ? 'ERROR' : 'OK'
    });
  };

  try {
    const payloadText = await req.text();
    let payload;
    try { payload = JSON.parse(payloadText); } catch (e) { return new Response("Invalid JSON", { status: 400 }); }
    
    // --- 1. RESOLVER CANAL ---
    const deviceJid = payload.device_id;
    let channel = null;

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

    let phone, text = '', pushName = 'Cliente WA', mediaUrl = null, mediaType = null;

    // --- 2. LÓGICA GOWA v8.3.0 ---
    if (payload.device_id && payload.event) {
       if (payload.event !== 'message') return new Response('ignored_event', { status: 200 });
       if (!payload.payload || payload.payload.is_from_me) return new Response('ignored', { status: 200 });

       const p = payload.payload;
       phone = p.from;
       pushName = p.from_name || 'Lead Gowa';
       const GOWA_BASE_URL = channel.api_url.endsWith('/') ? channel.api_url.slice(0, -1) : channel.api_url;

       if (p.body) {
         text = p.body;
         mediaType = 'text';
       } else if (p.image) {
         text = "[Imagen]"; mediaUrl = `${GOWA_BASE_URL}/${p.image}`; mediaType = 'image';
       } else if (p.audio) {
         text = "[Audio]"; const audioPath = p.audio.split(";")[0].trim(); mediaUrl = `${GOWA_BASE_URL}/${audioPath}`; mediaType = 'audio';
       } else if (p.video) {
         text = "[Video]"; mediaUrl = `${GOWA_BASE_URL}/${p.video}`; mediaType = 'video';
       } else if (p.document) {
         text = "[Documento]"; mediaUrl = `${GOWA_BASE_URL}/${p.document}`; mediaType = 'document';
       } else if (p.sticker) {
         text = "[Sticker]"; mediaUrl = `${GOWA_BASE_URL}/${p.sticker}`; mediaType = 'image';
       } else {
         return new Response('unknown_msg', { status: 200 });
       }
    } else {
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe) return new Response('ignored_self', { status: 200 });
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || '';
    }

    if (!phone) return new Response('invalid_phone', { status: 200 });

    let cleanPhone = phone.split('@')[0].replace(/\D/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12 && cleanPhone[2] !== '1') cleanPhone = '521' + cleanPhone.substring(2);

    // --- 4. DESCARGA MULTIMEDIA ---
    let finalMediaUrl = null;
    if (mediaUrl) {
        try {
            const authHeader = channel.api_key.startsWith('Basic ') ? channel.api_key : `Basic ${channel.api_key}`;
            const mediaRes = await fetch(mediaUrl, { headers: { 'Authorization': authHeader } });
            if (mediaRes.ok) {
                const blob = await mediaRes.blob();
                const ext = mediaUrl.split('.').pop()?.split('?')[0] || 'bin';
                const fileName = `inbound/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const { data: uploadData } = await supabaseClient.storage.from('media').upload(fileName, blob, { contentType: blob.type });
                if (uploadData) finalMediaUrl = supabaseClient.storage.from('media').getPublicUrl(fileName).data.publicUrl;
            }
        } catch (e) { await logTrace(`Error bajando adjunto: ${e.message}`, true); }
    }

    // --- 5. ACTUALIZAR CRM ---
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (!lead) {
      const { data: nl } = await supabaseClient.from('leads').insert({ nombre: pushName, telefono: cleanPhone, channel_id: channel.id }).select().single();
      lead = nl;
    } else {
      await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString(), channel_id: channel.id }).eq('id', lead.id);
    }

    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, emisor: 'CLIENTE', mensaje: text || " ", platform: 'WHATSAPP',
        metadata: finalMediaUrl ? { mediaUrl: finalMediaUrl, mediaType } : {}
    });

    // --- 6. LANZAR IA (AHORA CON AWAIT PARA EVITAR CONGELAMIENTO) ---
    if (!lead.ai_paused) {
       let samuraiUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response?phone=${cleanPhone}&client_message=${encodeURIComponent(text)}`;
       if (finalMediaUrl) samuraiUrl += `&media_url=${encodeURIComponent(finalMediaUrl)}&media_type=${mediaType}`;
       
       // AWAIT ES LA CLAVE: Evita que el servidor cierre el proceso antes de que la IA conteste
       await fetch(samuraiUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` } }).catch(() => {});
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});