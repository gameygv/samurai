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
    const challenge = url.searchParams.get("hub.challenge");
    if (challenge) return new Response(challenge, { status: 200 });
    return new Response("OK", { status: 200 });
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
    
    const { data: configData } = await supabaseClient.from('app_config').select('key, value').in('key', ['global_ai_status', 'openai_api_key']);
    const configMap = configData?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    const isGlobalAiPaused = configMap['global_ai_status'] === 'paused';

    let phone, text = '', pushName = 'Cliente WA', messageId = null;
    let actualChannelId = channelIdParam;
    let isFromMe = false;

    // --- IDENTIFICAR PAYLOAD (META O GOWA) ---
    if (payload.object === 'whatsapp_business_account') {
        const change = payload.entry?.[0]?.changes?.[0]?.value;
        if (!change || change.statuses) return new Response('ok', { status: 200 });
        const msg = change.messages?.[0];
        if (!msg) return new Response('ok', { status: 200 });
        
        phone = msg.from;
        messageId = msg.id;
        pushName = change.contacts?.[0]?.profile?.name || 'Lead WhatsApp';
        text = msg.text?.body || msg.image?.caption || '[Mensaje]';

        // Resolución de canal por ID de número de Meta
        const phoneId = change.metadata?.phone_number_id;
        if (phoneId) {
            const { data: ch } = await supabaseClient.from('whatsapp_channels').select('id').eq('instance_id', phoneId).maybeSingle();
            if (ch) actualChannelId = ch.id;
        }
    } else {
        // GOWA / EVOLUTION
        const p = payload.payload || payload.data || payload;
        isFromMe = p.is_from_me || p.fromMe || p.key?.fromMe || false;
        phone = p.remoteJid || p.key?.remoteJid || p.from;
        if (!phone) return new Response('ok', { status: 200 });
        senderPhone = phone.split('@')[0].replace(/\D/g, '');
        text = p.body || p.message?.conversation || '[Mensaje]';
        messageId = p.id || p.key?.id;
    }

    if (!phone) return new Response('ok', { status: 200 });
    let senderPhone = String(phone).split('@')[0].replace(/\D/g, '');

    // --- BUSCAR O CREAR LEAD ---
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${senderPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (!lead) {
        if (isFromMe) return new Response('ok', { status: 200 });
        const { data: nl } = await supabaseClient.from('leads').insert({ 
           nombre: pushName, telefono: senderPhone, channel_id: actualChannelId, ai_paused: false 
        }).select().single();
        lead = nl;
    } else {
        const updates: any = { last_message_at: new Date().toISOString(), followup_stage: 0 };
        if (actualChannelId) updates.channel_id = actualChannelId;
        await supabaseClient.from('leads').update(updates).eq('id', lead.id);
        lead = { ...lead, ...updates };
    }

    if (isFromMe) return new Response('ok', { status: 200 });

    // --- REGISTRAR MENSAJE ---
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: text, platform: 'WHATSAPP' });

    // --- DISPARAR IA ---
    if (!lead.ai_paused && !isGlobalAiPaused && configMap['openai_api_key']) {
        logTrace(`🤖 Samurai respondiendo a ${lead.nombre}...`);
        await supabaseClient.functions.invoke('process-samurai-response', { body: { lead_id: lead.id, client_message: text } });
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    await logTrace(`ERROR WEBHOOK: ${err.message}`, true);
    return new Response('error', { status: 200 });
  }
});