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
      console.error("Payload no es JSON válido:", payloadText);
      return new Response("Invalid JSON", { status: 400 });
    }

    console.log(`[webhook] Recibido evento GOWA/Evo para canal ${channelId}`);
    
    // Log para auditoría
    await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'SYSTEM',
        description: `Webhook Hit: ${payload.event || 'desconocido'}`,
        status: 'OK',
        metadata: { payload_raw: payload }
    });

    let phone, text = '', pushName = 'Cliente WA';

    // --- LÓGICA GOWA EXACTA SEGÚN REPORTE ---
    if (payload.device_id && payload.event) {
       if (payload.event !== 'message') return new Response('ok_ignored_event');
       if (!payload.payload) return new Response('ok_no_payload');
       if (payload.payload.is_from_me) return new Response('ok_self_msg');

       phone = payload.payload.from;
       pushName = payload.payload.from_name || 'Lead Gowa';
       text = payload.payload.body || '';
    } 
    // --- LÓGICA EVOLUTION LEGACY ---
    else {
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe) return new Response('ok_ignored_self');
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || '';
    }

    if (!phone) return new Response('invalid_phone_data');
    
    // Limpieza de teléfono (Cortar el @s.whatsapp.net y Fix de México)
    let cleanPhone = phone.split('@')[0].replace(/\D/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12 && cleanPhone[2] !== '1') {
        cleanPhone = '521' + cleanPhone.substring(2);
    }

    // --- ACTUALIZAR CRM ---
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

    // Guardar mensaje
    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'CLIENTE', 
        mensaje: text, 
        platform: 'WHATSAPP'
    });

    // --- LANZAR IA ---
    if (!lead.ai_paused) {
       fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response?phone=${cleanPhone}&client_message=${encodeURIComponent(text)}`, {
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