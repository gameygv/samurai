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

  try {
    const payloadText = await req.text();
    let payload;
    try { payload = JSON.parse(payloadText); } catch (e) { return new Response("Invalid JSON", { status: 400 }); }
    
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

        const phoneId = change.metadata?.phone_number_id;
        if (phoneId) {
            const { data: ch } = await supabaseClient.from('whatsapp_channels').select('id').eq('instance_id', phoneId).maybeSingle();
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

    // --- 1. BUSCAR O CREAR LEAD ---
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${senderPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (!lead) {
        if (isFromMe) return new Response('ok', { status: 200 });
        
        // BLINDAJE: Forzar BAJO explícitamente y registrar timestamp
        const { data: nl } = await supabaseClient.from('leads').insert({ 
           nombre: pushName, 
           telefono: senderPhone, 
           channel_id: actualChannelId, 
           ai_paused: false,
           buying_intent: 'BAJO', // FORZAMOS HUNTING DESDE EL NACIMIENTO
           last_message_at: new Date().toISOString(),
           followup_stage: 0
        }).select().single();
        lead = nl;
    } else {
        const updates: any = { last_message_at: new Date().toISOString(), followup_stage: 0 };
        if (actualChannelId) updates.channel_id = actualChannelId;
        
        // AUTO-RESCATE: Si el cliente escribe y estaba en "Perdido", lo regresamos a Hunting obligatoriamente.
        if (lead.buying_intent === 'PERDIDO') {
            updates.buying_intent = 'BAJO';
        }
        
        await supabaseClient.from('leads').update(updates).eq('id', lead.id);
        lead = { ...lead, ...updates };
    }

    if (isFromMe) return new Response('ok', { status: 200 });

    // --- 2. REGISTRAR MENSAJE DEL CLIENTE ---
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: text, platform: 'WHATSAPP' });

    // Log visible en el Monitor
    await supabaseClient.from('activity_logs').insert({ 
        action: 'CHAT', resource: 'SYSTEM', description: `Mensaje recibido de ${lead.nombre}: "${text.substring(0, 20)}..."`, status: 'OK' 
    });

    // --- 3. DISPARO PROTEGIDO DE IA ---
    const promises = [];
    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'global_ai_status').maybeSingle();
    
    // Si la IA no está pausada globalmente ni en este lead, la invocamos
    if (config?.value !== 'paused' && !lead.ai_paused) {
        promises.push(
            supabaseClient.functions.invoke('process-samurai-response', { body: { lead_id: lead.id, client_message: text } })
        );
    }

    // Invocamos al analista para extraer ciudad/email
    promises.push(
        supabaseClient.functions.invoke('analyze-leads', { body: { lead_id: lead.id, force: false } })
    );

    // ESTA LÍNEA ES LA MAGIA: Obliga al servidor a no cerrarse hasta que la IA termine (máximo 15 segundos permitidos por Meta)
    await Promise.allSettled(promises);

    return new Response('ok', { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response('error', { status: 200 });
  }
});