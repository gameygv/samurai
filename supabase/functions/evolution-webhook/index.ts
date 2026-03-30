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
    const challenge = url.searchParams.get("hub.challenge");
    if (challenge) return new Response(challenge, { status: 200 });
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
    
    const { data: appConfigData } = await supabaseClient.from('app_config').select('key, value').in('key', ['global_ai_status', 'channel_routing_mode', 'channel_agent_map', 'openai_api_key']);
    const configMap = appConfigData?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    
    const isGlobalAiPaused = configMap['global_ai_status'] === 'paused';
    let channelAgentMap = {};
    try { channelAgentMap = JSON.parse(configMap['channel_agent_map'] || '{}'); } catch(e) {}

    let phone, text = '', pushName = 'Cliente WA', mediaType = null, messageId = null;
    let actualChannelId = channelIdParam;
    let isFromMe = false;

    // 1. META CLOUD API
    if (payload.object === 'whatsapp_business_account' && payload.entry) {
        const change = payload.entry[0]?.changes?.[0]?.value;
        if (change.statuses) return new Response('status_ignored', { status: 200 });
        const msg = change.messages?.[0];
        if (!msg) return new Response('no_messages', { status: 200 });
        
        phone = msg.from;
        messageId = msg.id;
        pushName = change.contacts?.[0]?.profile?.name || 'Lead Meta';

        const phoneNumberId = change.metadata?.phone_number_id;
        if (!actualChannelId && phoneNumberId) {
            const { data: ch } = await supabaseClient.from('whatsapp_channels').select('id').eq('instance_id', phoneNumberId).maybeSingle();
            if (ch) actualChannelId = ch.id;
        }

        if (msg.type === 'text') { text = msg.text?.body || ''; mediaType = 'text'; } 
        else if (msg.type === 'image') { text = msg.image?.caption || '[Imagen]'; mediaType = 'image'; } 
        else { text = '[Mensaje]'; mediaType = 'text'; }
    } 
    // 2. GOWA / EVOLUTION API
    else if ((payload.device_id || payload.instance) && payload.event) { 
       if (payload.event !== 'message' && payload.event !== 'messages.upsert' && payload.event !== 'SEND_MESSAGE') return new Response('ignored_event', { status: 200 });
       
       const p = payload.payload || payload.data || payload;
       if (!p) return new Response('ignored_empty', { status: 200 });
       
       isFromMe = p.is_from_me === true || p.fromMe === true || p.key?.fromMe === true || false;

       const instanceName = String(payload.device_id || payload.instance || '').trim();
       if (!actualChannelId && instanceName) {
           const { data: ch } = await supabaseClient.from('whatsapp_channels').select('id').ilike('instance_id', instanceName).maybeSingle();
           if (ch) actualChannelId = ch.id;
       }

       phone = p.remoteJid || p.key?.remoteJid || (isFromMe ? p.to : p.from);
       if (!phone) return new Response('no_phone', { status: 200 });
       
       messageId = p.id || p.key?.id || `msg-${Date.now()}`;
       pushName = p.from_name || p.pushName || 'Lead Gowa';

       if (p.image || p.message?.imageMessage) { text = p.body || p.message?.imageMessage?.caption || "[Imagen]"; mediaType = 'image'; } 
       else { text = p.body || p.message?.conversation || p.message?.extendedTextMessage?.text || "[Mensaje]"; mediaType = 'text'; }
    } else { return new Response('unknown_payload', { status: 200 }); }

    if (!phone || !messageId) return new Response('invalid_data', { status: 200 });
    let senderPhone = phone.split('@')[0].replace(/\D/g, '');

    const { data: channelData } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', actualChannelId).maybeSingle();
    const isChannelActive = channelData?.is_active !== false;

    // RESOLUCIÓN DE ASIGNACIÓN PRIORITARIA
    let assignedAgent = channelAgentMap[actualChannelId] || null;

    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${senderPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (!lead) {
        if (isFromMe) return new Response('ignore_new_lead_from_me', { status: 200 }); 
        const { data: nl } = await supabaseClient.from('leads').insert({ 
           nombre: pushName, telefono: senderPhone, channel_id: actualChannelId || null, assigned_to: assignedAgent,
           ai_paused: assignedAgent ? true : false 
        }).select().single();
        lead = nl;
    } else {
        const updates: any = { last_message_at: new Date().toISOString() };
        if (actualChannelId) updates.channel_id = actualChannelId;
        if (!isFromMe) updates.followup_stage = 0;

        if (assignedAgent && lead.assigned_to !== assignedAgent) {
           updates.assigned_to = assignedAgent;
           updates.ai_paused = true; 
        }

        await supabaseClient.from('leads').update(updates).eq('id', lead.id);
        lead.channel_id = updates.channel_id || lead.channel_id;
        if (updates.assigned_to) lead.assigned_to = updates.assigned_to;
        if (updates.ai_paused !== undefined) lead.ai_paused = updates.ai_paused;
    }

    if (isFromMe) {
        const cmd = text.trim().toUpperCase();
        if (cmd === '#STOP' || cmd === '#START') {
            await supabaseClient.from('leads').update({ ai_paused: cmd === '#STOP' }).eq('id', lead.id);
            return new Response('ok', { status: 200 });
        }
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'HUMANO', mensaje: text, platform: 'WHATSAPP', metadata: { msgId: messageId } });
        return new Response('ok', { status: 200 });
    }

    // REGISTRO DE CLIENTE
    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, emisor: 'CLIENTE', mensaje: text || " ", platform: 'WHATSAPP',
        metadata: { msgId: messageId, mediaType }
    });

    await logTrace(`Extrayendo datos CAPI del mensaje de ${lead.nombre}...`);
    await supabaseClient.functions.invoke('analyze-leads', { body: { lead_id: lead.id, force: false } });

    // RESPUESTA DE IA
    if (!lead.ai_paused && !isGlobalAiPaused && isChannelActive && configMap['openai_api_key']) {
        await logTrace(`🤖 Delegando respuesta a Samurai Kernel para el lead ${lead.nombre}...`);
        // Invocamos directamente pasando el lead_id para evitar dobles búsquedas y retrasos.
        await supabaseClient.functions.invoke('process-samurai-response', { body: { lead_id: lead.id, client_message: text } });
    } else {
        await logTrace(`⏸️ Samurai NO respondió. Causas posibles: Lead Pausado=${lead.ai_paused}, Global Pausado=${isGlobalAiPaused}, Canal Inactivo=${!isChannelActive}, API Key=${!!configMap['openai_api_key']}`);
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    await logTrace(`ERROR CRÍTICO WEBHOOK: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});