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

  // 1. VERIFICACIÓN DE META (GET)
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

    // --- DETECCIÓN DE FORMATO ---
    
    // A. META CLOUD API
    if (payload.object === 'whatsapp_business_account') {
       const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
       const contact = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
       if (!message) return new Response('no_msg');
       
       phone = message.from;
       pushName = contact?.profile?.name || 'Lead Meta';
       
       if (message.type === 'text') text = message.text.body;
       else if (message.type === 'image') { text = "[IMAGEN]"; mediaUrl = "META_RESERVED"; mediaType = 'image'; }
       else if (message.type === 'audio') { text = "[AUDIO]"; mediaUrl = "META_RESERVED"; mediaType = 'audio'; }
    } 
    // B. EVOLUTION API / GOWA
    else {
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe) return new Response('ignored');
       
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       
       // Detección de texto o media
       text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || '';
       
       if (msg?.message?.imageMessage || payload.type === 'image') {
          text = text || "[IMAGEN]";
          mediaType = 'image';
       } else if (msg?.message?.audioMessage || payload.type === 'audio') {
          text = text || "[AUDIO]";
          mediaType = 'audio';
       }
    }

    if (!phone) return new Response('invalid_data');
    const cleanPhone = phone.replace(/\D/g, '');

    // 2. SINCRONIZACIÓN CRM
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
    
    if (!lead) {
      const { data: nl } = await supabaseClient.from('leads').insert({ nombre: pushName, telefono: cleanPhone, channel_id: channelId }).select().single();
      lead = nl;
    } else {
      await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString(), channel_id: channelId || lead.channel_id }).eq('id', lead.id);
    }

    // 3. REGISTRO DE MENSAJE
    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'CLIENTE', 
        mensaje: text, 
        platform: 'WHATSAPP',
        metadata: { mediaUrl, mediaType }
    });

    // 4. TRIGGER DE SAMURAI (IA)
    if (!lead.ai_paused) {
       // Aquí Samurai se activa. Si es audio, su módulo de transcripción 
       // entrará en acción antes de generar la respuesta.
       fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response?phone=${cleanPhone}&client_message=${encodeURIComponent(text)}`, {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` }
       }).catch(() => {});
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});