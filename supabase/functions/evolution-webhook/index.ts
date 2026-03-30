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
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  if (req.method === 'GET') {
    const challenge = url.searchParams.get("hub.challenge");
    if (challenge) return new Response(challenge, { status: 200 });
    return new Response("OK", { status: 200 });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payloadText = await req.text();
    let payload;
    try { payload = JSON.parse(payloadText); } catch (e) { return new Response("Invalid JSON", { status: 400 }); }
    
    let phone, text = '', pushName = 'Cliente WA', messageId = null;
    let actualChannelId = channelIdParam;
    let isFromMe = false;

    if (payload.object === 'whatsapp_business_account') {
        const change = payload.entry?.[0]?.changes?.[0]?.value;
        if (!change || change.statuses) return new Response('ok', { status: 200 });
        const msg = change.messages?.[0];
        if (!msg) return new Response('ok', { status: 200 });
        
        phone = msg.from;
        messageId = msg.id;
        pushName = change.contacts?.[0]?.profile?.name || 'Lead WhatsApp';
        text = msg.text?.body || msg.image?.caption || '[Mensaje]';

        const phoneId = change.metadata?.phone_number_id;
        if (phoneId) {
            const { data: ch } = await supabase.from('whatsapp_channels').select('id').eq('instance_id', phoneId).maybeSingle();
            if (ch) actualChannelId = ch.id;
        }
    } else {
        const p = payload.payload || payload.data || payload;
        isFromMe = p.is_from_me || p.fromMe || p.key?.fromMe || false;
        phone = p.remoteJid || p.key?.remoteJid || p.from;
        if (!phone) return new Response('ok', { status: 200 });
        text = p.body || p.message?.conversation || '[Mensaje]';
        messageId = p.id || p.key?.id;
    }

    if (!phone) return new Response('ok', { status: 200 });
    let senderPhone = String(phone).split('@')[0].replace(/\D/g, '');

    let { data: lead } = await supabase.from('leads').select('*').or(`telefono.ilike.%${senderPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (!lead) {
        if (isFromMe) return new Response('ok', { status: 200 });
        
        const { data: nl, error: insertError } = await supabase.from('leads').insert({ 
           nombre: pushName, 
           telefono: senderPhone, 
           channel_id: actualChannelId, 
           ai_paused: false,
           buying_intent: 'BAJO', // ESTRICTO
           last_message_at: new Date().toISOString(),
           followup_stage: 0
        }).select().single();
        
        if (insertError) console.error(insertError);
        lead = nl;
        
        await supabase.from('activity_logs').insert({ 
            action: 'CREATE', resource: 'LEADS', description: `Lead entrante (${pushName}). Asignado a etapa BAJO (Hunting).`, status: 'OK' 
        });
    } else {
        const updates: any = { last_message_at: new Date().toISOString(), followup_stage: 0 };
        if (actualChannelId) updates.channel_id = actualChannelId;
        
        if (lead.buying_intent === 'PERDIDO') {
            updates.buying_intent = 'BAJO';
            await supabase.from('activity_logs').insert({ 
                action: 'UPDATE', resource: 'LEADS', description: `Rescate Automático: El lead ${lead.nombre} estaba en PERDIDO pero escribió. Regresa a etapa BAJO.`, status: 'OK' 
            });
        }
        
        await supabase.from('leads').update(updates).eq('id', lead.id);
        lead = { ...lead, ...updates };
    }

    if (isFromMe) return new Response('ok', { status: 200 });

    await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: text, platform: 'WHATSAPP' });
    await supabase.from('activity_logs').insert({ action: 'CHAT', resource: 'SYSTEM', description: `Mensaje de ${lead.nombre}: "${text.substring(0, 30)}..."`, status: 'OK' });

    const { data: config } = await supabase.from('app_config').select('value').eq('key', 'global_ai_status').maybeSingle();
    
    if (config?.value !== 'paused' && !lead.ai_paused) {
        await supabase.functions.invoke('analyze-leads', { body: { lead_id: lead.id, force: false } });
        await supabase.functions.invoke('process-samurai-response', { body: { lead_id: lead.id, client_message: text } });
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error(err);
    return new Response('error', { status: 200 });
  }
});