// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

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
    let audioMediaId = null; // S4.1: media_id para transcripcion async (Meta)
    let audioMediaUrl = null; // S7.1: URL directa para audio (Gowa)
    let imageMediaId = null; // S6.1: media_id para analisis de comprobante (Meta)
    let imageMediaUrl = null; // S7.1: URL directa para imagen (Gowa)

    if (payload.object === 'whatsapp_business_account') {
        const change = payload.entry?.[0]?.changes?.[0]?.value;
        if (!change) return new Response('ok', { status: 200 });

        // Procesar status webhooks de Meta: sent/delivered/read/failed (S2.3)
        if (change.statuses) {
            const status = change.statuses[0];
            if (status?.id && status?.status) {
                const { data: updated } = await supabase.from('conversaciones')
                    .update({ delivery_status: status.status })
                    .eq('message_id', status.id)
                    .select('id')
                    .maybeSingle();

                // Si falló la entrega, loggear para visibilidad del operador (S2.3-D2)
                if (status.status === 'failed' && updated) {
                    const errMsg = status.errors?.[0]?.message || 'Unknown error';
                    const errCode = status.errors?.[0]?.code || '';
                    await supabase.from('activity_logs').insert({
                        action: 'ERROR', resource: 'SYSTEM',
                        description: `WhatsApp delivery failed (${status.recipient_id}): [${errCode}] ${errMsg}`,
                        status: 'ERROR'
                    });
                }
            }
            return new Response('ok', { status: 200, headers: corsHeaders });
        }
        const msg = change.messages?.[0];
        if (!msg) return new Response('ok', { status: 200 });

        // Ignorar reacciones (no son mensajes reales)
        if (msg.type === 'reaction') return new Response('ok', { status: 200 });

        phone = msg.from;
        messageId = msg.id;
        pushName = change.contacts?.[0]?.profile?.name || 'Lead WhatsApp';

        // Parseo completo de TODOS los tipos de mensaje de Meta Cloud API
        if (msg.type === 'text') {
            text = msg.text?.body || '';
        } else if (msg.type === 'image') {
            text = msg.image?.caption || '[Imagen]';
            imageMediaId = msg.image?.id || null; // S6.1: extraer media_id para Ojo de Halcón
        } else if (msg.type === 'video') {
            text = msg.video?.caption || '[Video]';
        } else if (msg.type === 'audio') {
            text = '[Nota de Voz]';
            audioMediaId = msg.audio?.id || null; // S4.1: extraer media_id para Whisper
        } else if (msg.type === 'document') {
            text = msg.document?.caption || `[Documento: ${msg.document?.filename || 'archivo'}]`;
        } else if (msg.type === 'sticker') {
            text = '[Sticker]';
        } else if (msg.type === 'location') {
            const lat = msg.location?.latitude || '';
            const lng = msg.location?.longitude || '';
            text = `[Ubicacion: ${lat}, ${lng}]`;
        } else if (msg.type === 'contacts') {
            const contactName = msg.contacts?.[0]?.name?.formatted_name || 'contacto';
            text = `[Contacto: ${contactName}]`;
        } else if (msg.type === 'button') {
            text = msg.button?.text || '[Respuesta de boton]';
        } else if (msg.type === 'interactive') {
            text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || msg.interactive?.nfm_reply?.body || '[Respuesta interactiva]';
        } else if (msg.type === 'order') {
            text = '[Pedido recibido]';
        } else {
            // Fallback: intentar extraer texto de cualquier campo conocido
            text = msg.text?.body || msg.image?.caption || msg.video?.caption || msg.document?.caption || msg.button?.text || `[${msg.type || 'Mensaje'}]`;
        }

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
        const msgContent = p.message || {};

        // S7.1: Detectar tipo de media en Gowa/Evolution
        if (msgContent.audioMessage) {
            text = '[Nota de Voz]';
            audioMediaUrl = msgContent.audioMessage.url || null;
        } else if (msgContent.imageMessage) {
            text = msgContent.imageMessage.caption || '[Imagen]';
            imageMediaUrl = msgContent.imageMessage.url || null;
        } else {
            text = p.body || msgContent.conversation || msgContent.extendedTextMessage?.text || msgContent.videoMessage?.caption || msgContent.documentMessage?.caption || msgContent.buttonsResponseMessage?.selectedDisplayText || '[Mensaje]';
        }
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
        // Mensajes salientes (isFromMe) no deben mutar el lead
        if (isFromMe) return new Response('ok', { status: 200 });

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

    // Insertar mensaje del cliente con wamid para deduplicación (S2.2)
    const clientInsert: any = { lead_id: lead.id, emisor: 'CLIENTE', mensaje: text, platform: 'WHATSAPP' };
    if (messageId) clientInsert.message_id = messageId;
    const { error: insertError2 } = await supabase.from('conversaciones').insert(clientInsert);
    if (insertError2) {
        if (insertError2.code === '23505') {
            // Duplicate wamid — webhook retry de Meta, ignorar
            return new Response('ok', { status: 200, headers: corsHeaders });
        }
        console.error('Insert conversacion error:', insertError2.message);
    }
    await supabase.from('activity_logs').insert({ action: 'CHAT', resource: 'SYSTEM', description: `Mensaje de ${lead.nombre}: "${text.substring(0, 30)}..."`, status: 'OK' });

    // S6.1 + S7.1: Ojo de Halcón — analizar comprobante si contexto indica pago
    if (imageMediaId || imageMediaUrl) {
        const textLower = text.toLowerCase();
        const paymentPhrases = ['pagué', 'pague', 'transferí', 'transferi', 'comprobante', 'deposité', 'deposite', 'ya pagué', 'aqui va', 'aquí va', 'envio comprobante', 'ficha', 'boucher', 'voucher'];
        const hasPaymentContext = paymentPhrases.some(p => textLower.includes(p));

        if (hasPaymentContext || lead.buying_intent === 'ALTO') {
            supabase.functions.invoke('analyze-receipt', {
                body: { image_id: imageMediaId || null, media_url: imageMediaUrl || null, lead_id: lead.id, channel_id: actualChannelId, caption: text }
            }).catch(err => console.error('analyze-receipt fire error:', err));
        }
    }

    const { data: config } = await supabase.from('app_config').select('value').eq('key', 'global_ai_status').maybeSingle();

    if (config?.value !== 'paused' && !lead.ai_paused) {
        if (audioMediaId || audioMediaUrl) {
            // S4.1 + S7.1: Audio detectado — fire-and-forget a transcribe-audio
            supabase.functions.invoke('transcribe-audio', {
                body: { media_id: audioMediaId || null, media_url: audioMediaUrl || null, lead_id: lead.id, message_id: messageId, channel_id: actualChannelId }
            }).catch((err) => console.error('transcribe-audio fire error:', err));
        } else {
            // Llamar al procesador IA con fetch directo (no supabase.functions.invoke)
            try {
                const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response`;
                const fnRes = await fetch(fnUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                    },
                    body: JSON.stringify({ lead_id: lead.id, client_message: text })
                });
                // process-samurai-response se encarga de guardar la respuesta IA en conversaciones (S2.1)
                await fnRes.json().catch(() => ({}));
            } catch (invokeErr) {
                console.error('Error calling process-samurai-response:', invokeErr);
            }
        }

        // Fire-and-forget: analyze-leads corre en background
        supabase.functions.invoke('analyze-leads', { body: { lead_id: lead.id } }).catch(() => {});
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[evolution-webhook] CRASH:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders });
  }
});