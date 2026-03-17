// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channel_id');
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  if (req.method === 'GET') {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode && token && channelId) {
      const { data: ch } = await supabaseClient.from('whatsapp_channels').select('verify_token').eq('id', channelId).single();
      if (token === ch?.verify_token) return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payloadText = await req.text();
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch (e) {
      console.error("Payload no es JSON válido");
      return new Response("Invalid JSON", { status: 400 });
    }
    
    // Log para auditoría rápida
    await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'SYSTEM',
        description: `Webhook Hit: ${payload.event || 'desconocido'}`,
        status: 'OK'
    });

    let phone, text = '', pushName = 'Cliente WA', mediaUrl = null, mediaType = null;

    // --- 1. OBTENER CONFIGURACIÓN DEL CANAL ---
    const { data: channel } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelId).single();
    if (!channel) return new Response('invalid_channel', { status: 200 });

    const GOWA_BASE_URL = channel.api_url.endsWith('/') ? channel.api_url.slice(0, -1) : channel.api_url;

    // --- 2. PARSEO ESTRICTO PARA GOWA ---
    if (payload.device_id && payload.event) {
       // Filtrar acks y reacciones (solo queremos mensajes)
       if (payload.event !== 'message') return new Response('ignored_event', { status: 200 });
       if (!payload.payload) return new Response('no_payload', { status: 200 });
       if (payload.payload.is_from_me) return new Response('ignored_self', { status: 200 });

       const p = payload.payload;
       phone = p.from;
       pushName = p.from_name || 'Lead Gowa';

       // Determinar tipo de mensaje basado en la presencia de llaves
       if (p.body) {
         text = p.body;
       } else if (p.image) {
         text = "[Imagen]";
         mediaUrl = `${GOWA_BASE_URL}/${p.image}`;
         mediaType = 'image';
       } else if (p.audio) {
         text = "[Audio]";
         // Gowa manda el audio con codec (statics/media/archivo.ogg; codecs=opus)
         const audioPath = p.audio.split(";")[0].trim();
         mediaUrl = `${GOWA_BASE_URL}/${audioPath}`;
         mediaType = 'audio';
       } else if (p.video) {
         text = "[Video]";
         mediaUrl = `${GOWA_BASE_URL}/${p.video}`;
         mediaType = 'video';
       } else if (p.document) {
         text = "[Documento]";
         mediaUrl = `${GOWA_BASE_URL}/${p.document}`;
         mediaType = 'document';
       } else if (p.sticker) {
         text = "[Sticker]";
         mediaUrl = `${GOWA_BASE_URL}/${p.sticker}`;
         mediaType = 'image';
       } else {
         return new Response('unknown_msg_type', { status: 200 });
       }
    } 
    // --- LÓGICA FALLBACK EVOLUTION ---
    else {
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe) return new Response('ignored_self', { status: 200 });
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || '';
    }

    if (!phone) return new Response('invalid_phone', { status: 200 });
    
    // --- 3. LIMPIEZA DE NÚMERO (Fix de JID y México) ---
    let cleanPhone = phone.split('@')[0].replace(/\D/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12 && cleanPhone[2] !== '1') {
        cleanPhone = '521' + cleanPhone.substring(2); // Agregar el '1' para móviles MX
    }

    // --- 4. ACTUALIZAR CRM ---
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (!lead) {
      const { data: nl } = await supabaseClient.from('leads').insert({ 
        nombre: pushName, 
        telefono: cleanPhone, 
        channel_id: channelId,
        platform: 'WHATSAPP'
      }).select().single();
      lead = nl;
    } else {
      await supabaseClient.from('leads').update({ 
        last_message_at: new Date().toISOString(), 
        channel_id: channelId 
      }).eq('id', lead.id);
    }

    // Guardar mensaje en base de datos
    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'CLIENTE', 
        mensaje: text, 
        platform: 'WHATSAPP',
        metadata: mediaUrl ? { mediaUrl, mediaType } : {}
    });

    // --- 5. LANZAR IA (Samurai) ---
    if (!lead.ai_paused) {
       let samuraiUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response?phone=${cleanPhone}&client_message=${encodeURIComponent(text)}`;
       if (mediaUrl) {
           samuraiUrl += `&media_url=${encodeURIComponent(mediaUrl)}&media_type=${mediaType}`;
       }
       
       fetch(samuraiUrl, {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` }
       }).catch(() => {});
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    console.error("[evolution-webhook] Error:", err.message);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});