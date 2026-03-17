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
    const payload = await req.json();
    let phone, text = '', pushName = 'Cliente WA', mediaUrl = null, mediaType = null;

    // --- 1. PROCESAR CANAL ---
    const { data: channel } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelId).single();
    if (!channel) return new Response('invalid_channel');

    // --- 2. DETECCIÓN DE FORMATO (META vs EVOLUTION vs GOWA) ---
    
    // A. FORMATO GOWA (Detectado en logs)
    if (payload.event === 'message' && payload.payload) {
       const data = payload.payload;
       if (data.is_from_me) return new Response('ignored');
       
       phone = data.from; // Viene como 521... @s.whatsapp.net
       pushName = data.from_name || 'Lead Gowa';
       text = data.body || '';
       
       // Nota: Gowa usa 'type' para media, aquí un ejemplo básico:
       if (data.type && data.type !== 'text') {
           mediaType = data.type;
           mediaUrl = data.url; // URL temporal de la media
       }
    }
    // B. FORMATO META CLOUD API
    else if (payload.object === 'whatsapp_business_account') {
       const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
       const contact = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
       if (!message) return new Response('no_msg');
       
       phone = message.from;
       pushName = contact?.profile?.name || 'Lead Meta';
       
       if (message.type === 'text') {
           text = message.text.body;
       } else if (['image', 'audio', 'video', 'document'].includes(message.type)) {
           mediaType = message.type;
           const mediaId = message[mediaType].id;
           text = `[${mediaType.toUpperCase()} RECIBIDO]`;
           const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
               headers: { 'Authorization': `Bearer ${channel.api_key}` }
           });
           const metaData = await metaRes.json();
           mediaUrl = metaData.url;
       }
    } 
    // C. FORMATO EVOLUTION API (Legacy)
    else {
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe) return new Response('ignored');
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || '';
       
       if (msg?.message?.imageMessage || payload.type === 'image') {
          mediaType = 'image';
          mediaUrl = msg?.message?.imageMessage?.url || payload.url;
          text = text || "[IMAGEN]";
       } else if (msg?.message?.audioMessage || payload.type === 'audio') {
          mediaType = 'audio';
          mediaUrl = msg?.message?.audioMessage?.url || payload.url;
          text = text || "[AUDIO]";
       }
    }

    if (!phone) return new Response('invalid_data');
    
    // Limpieza de teléfono (quitar @s.whatsapp.net y caracteres no numéricos)
    const cleanPhone = phone.split('@')[0].replace(/\D/g, '');

    // --- 3. ACTUALIZAR CRM ---
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
    
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

    // Guardar el mensaje en el historial
    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'CLIENTE', 
        mensaje: text, 
        platform: 'WHATSAPP',
        metadata: { mediaUrl, mediaType, provider: channel.provider }
    });

    // --- 4. LANZAR IA (Respuesta automática) ---
    if (!lead.ai_paused) {
       fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response?phone=${cleanPhone}&client_message=${encodeURIComponent(text)}&media_url=${encodeURIComponent(mediaUrl || '')}&media_type=${mediaType || ''}`, {
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