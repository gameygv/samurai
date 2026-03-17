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
    console.log(`[webhook] Recibido evento de Gowa para canal ${channelId}:`, JSON.stringify(payload));
    
    // Log de auditoría para diagnóstico
    await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'SYSTEM',
        description: `Webhook Hit: ${payload.event || 'desconocido'}`,
        status: 'OK',
        metadata: { payload_raw: payload }
    });

    let phone, text = '', pushName = 'Cliente WA', mediaUrl = null, mediaType = null;

    // --- 1. PROCESAR CANAL ---
    const { data: channel } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelId).single();
    if (!channel) return new Response('invalid_channel');

    // --- 2. DETECCIÓN DE FORMATO GOWA ---
    if (payload.payload && payload.event === 'message') {
       const data = payload.payload;
       if (data.is_from_me) return new Response('ignored_self');
       
       phone = data.from; // Viene como 521... @s.whatsapp.net
       pushName = data.from_name || 'Lead Gowa';
       text = data.body || '';
    } 
    // Otros formatos (Evolution/Meta)
    else {
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe) return new Response('ignored');
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || '';
    }

    if (!phone) return new Response('invalid_data');
    
    // Limpieza de teléfono (Mexican 1-digit fix)
    let cleanPhone = phone.split('@')[0].replace(/\D/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12 && cleanPhone[2] !== '1') {
        cleanPhone = '521' + cleanPhone.substring(2);
    }

    // --- 3. ACTUALIZAR CRM ---
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

    // --- 4. LANZAR IA ---
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