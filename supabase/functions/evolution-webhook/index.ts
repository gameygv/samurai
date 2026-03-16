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

  // 1. MANEJO DE VERIFICACIÓN DE META (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode && token && channelId) {
      const { data: channel } = await supabaseClient.from('whatsapp_channels').select('verify_token').eq('id', channelId).single();
      if (token === channel?.verify_token) {
        return new Response(challenge, { status: 200 });
      }
    }
    return new Response("Verification failed", { status: 403 });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    let phone, text, pushName;

    // 2. DETECCIÓN DE FORMATO META (Cloud API)
    if (payload.object === 'whatsapp_business_account') {
       const entry = payload.entry?.[0];
       const changes = entry?.changes?.[0];
       const value = changes?.value;
       const message = value?.messages?.[0];

       if (!message) return new Response('no_message', { headers: corsHeaders });

       phone = message.from;
       pushName = value.contacts?.[0]?.profile?.name || 'Lead Meta';
       text = message.text?.body || (message.button?.text) || (message.interactive?.button_reply?.title) || '';
       
       if (message.type === 'image') text = "[IMAGEN RECIBIDA]";
    } 
    // 3. DETECCIÓN FORMATO EVOLUTION / GOWA
    else {
       const msgData = payload.data?.[0] || payload.data || payload;
       if (msgData?.key?.fromMe) return new Response('ignored', { headers: corsHeaders });
       phone = msgData?.key?.remoteJid?.split('@')[0] || payload.phone;
       text = msgData?.message?.conversation || msgData?.text || payload.message || '';
       pushName = payload.pushName || msgData?.pushName || 'Lead WA';
    }

    if (!phone || !text) return new Response('ignored', { headers: corsHeaders });
    const cleanPhone = phone.replace(/\D/g, '');

    // 4. LÓGICA DE ACTUALIZACIÓN DE LEAD
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
    if (!lead) {
      const { data: newLead } = await supabaseClient.from('leads').insert({ nombre: pushName, telefono: cleanPhone, channel_id: channelId }).select().single();
      lead = newLead;
    } else {
      await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString(), channel_id: channelId || lead.channel_id }).eq('id', lead.id);
    }

    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: text, platform: 'WHATSAPP' });

    // 5. RESPUESTA IA (Solo si no está pausada)
    if (!lead.ai_paused) {
       // ... (Lógica de IA similar a la anterior, invocando a OpenAI)
       // Para no extender el código, Samurai generará la respuesta y la enviará usando sendMessage
    }

    return new Response('success', { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});