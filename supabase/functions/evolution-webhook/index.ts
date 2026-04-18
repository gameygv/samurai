import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request): Promise<Response> => {
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
    // deno-lint-ignore no-explicit-any
    let payload: any;
    try { payload = JSON.parse(payloadText); } catch (_e) { return new Response("Invalid JSON", { status: 400 }); }

    let phone: string | undefined, text = '', pushName = 'Cliente WA', messageId: string | null = null;
    let actualChannelId = channelIdParam;
    let isFromMe = false;
    let audioMediaId: string | null = null; // S4.1: media_id para transcripcion async (Meta)
    let audioMediaUrl: string | null = null; // S7.1: URL directa para audio (Gowa)
    let imageMediaId: string | null = null; // S6.1: media_id para analisis de comprobante (Meta)
    let imageMediaUrl: string | null = null; // S7.1: URL directa para imagen (Gowa)
    // 2026-04-10: Atribución CTWA — Meta Cloud API envía objeto referral en primer mensaje de un click-to-wa ad
    // deno-lint-ignore no-explicit-any
    let ctwaReferral: Record<string, any> | null = null;

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

        // 2026-04-10: capturar referral de anuncio Click-to-WhatsApp si existe
        // Meta docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components#referral-object
        if (msg.referral && typeof msg.referral === 'object') {
            ctwaReferral = {
                source_url: msg.referral.source_url || null,
                source_id: msg.referral.source_id || null,   // Ad ID
                source_type: msg.referral.source_type || null, // 'ad' | 'post'
                headline: msg.referral.headline || null,
                body: msg.referral.body || null,
                thumbnail_url: msg.referral.thumbnail_url || null,
                ctwa_clid: msg.referral.ctwa_clid || null,   // Click ID — crítico para CAPI matching
            };
        }

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
        // Gowa: solo procesar eventos de mensaje (entrante y saliente)
        const gowaEvent = payload.event;
        if (gowaEvent && gowaEvent !== 'message' && gowaEvent !== 'send_message') return new Response('ok', { status: 200 });

        const p = payload.payload || payload.data || payload;
        isFromMe = p.is_from_me || p.fromMe || p.key?.fromMe || false;
        // Gowa isFromMe: from=dispositivo propio, chat_id=cliente. Usar chat_id para buscar lead.
        phone = isFromMe ? (p.chat_id || p.from) : (p.remoteJid || p.key?.remoteJid || p.from);
        if (!phone) return new Response('ok', { status: 200 });
        const msgContent = p.message || {};

        // Gowa: extraer nombre del contacto (campo from_name en payload Gowa)
        pushName = p.from_name || p.pushName || p.push_name || 'Lead WhatsApp';

        // Gowa multi-device: rutear por device_id (JID) → buscar canal por phone_number
        // device_id viene como "5214771172736@s.whatsapp.net", phone_number se guarda como "5214771172736"
        const deviceId = payload.device_id || p.device_id;
        if (deviceId && !actualChannelId) {
            const devicePhone = String(deviceId).split('@')[0];
            const { data: ch } = await supabase.from('whatsapp_channels')
                .select('id').eq('phone_number', devicePhone).maybeSingle();
            if (ch) actualChannelId = ch.id;
        }

        // Resolver URL base del canal Gowa para media relativas
        const resolveGowaMedia = async (relativePath: string): Promise<string> => {
            // Quitar "; codecs=opus" u otros sufijos del path
            const cleanPath = relativePath.split(';')[0].trim();
            if (cleanPath.startsWith('http')) return cleanPath;
            // Buscar api_url del canal para construir URL completa
            if (actualChannelId) {
                const { data: chUrl } = await supabase.from('whatsapp_channels')
                    .select('api_url').eq('id', actualChannelId).maybeSingle();
                if (chUrl?.api_url) {
                    let base = chUrl.api_url;
                    if (base.endsWith('/')) base = base.slice(0, -1);
                    return `${base}/${cleanPath}`;
                }
            }
            return cleanPath;
        };

        // 2026-04-12: Atribución CTWA para Gowa v8.3.0
        // Gowa mapea contextInfo.externalAdReply → payload.referral (campo de primer nivel).
        // Fuente: https://github.com/aldinokemal/go-whatsapp-web-multidevice
        // Solo aparece en el PRIMER mensaje de una conversación iniciada desde anuncio CTWA.
        // Intentamos: 1) p.referral (Gowa nativo), 2) externalAdReply paths (Baileys raw).
        const gowaRef = p.referral;
        if (gowaRef && typeof gowaRef === 'object' && (gowaRef.ctwa_clid || gowaRef.source_id)) {
          ctwaReferral = {
            source_url: gowaRef.source_url || null,
            source_id: gowaRef.source_id || null,       // = Ad ID en Meta Ads Manager
            source_type: gowaRef.source_type || null,    // "ad" | "post"
            headline: gowaRef.ad_title || null,
            body: gowaRef.ad_body || null,
            thumbnail_url: gowaRef.thumbnail_url || null,
            ctwa_clid: gowaRef.ctwa_clid || null,
            // Campos adicionales Gowa v8.3.0
            source_app: gowaRef.source_app || null,      // "facebook" | "instagram"
            ref: gowaRef.ref || null,                    // parámetro ref del CTA
          };
        } else {
          // Fallback: Baileys raw (contextInfo.externalAdReply) por si Gowa no mapea a referral
          const adReply =
            msgContent.extendedTextMessage?.contextInfo?.externalAdReply
            || msgContent.imageMessage?.contextInfo?.externalAdReply
            || msgContent.videoMessage?.contextInfo?.externalAdReply
            || msgContent.audioMessage?.contextInfo?.externalAdReply
            || p.contextInfo?.externalAdReply
            || p.context_info?.external_ad_reply
            || p.externalAdReply
            || p.external_ad_reply
            || null;
          if (adReply && typeof adReply === 'object') {
            ctwaReferral = {
              source_url: adReply.sourceUrl || adReply.source_url || null,
              source_id: adReply.sourceId || adReply.source_id || null,
              source_type: adReply.sourceType || adReply.source_type || null,
              headline: adReply.title || adReply.headline || null,
              body: adReply.body || null,
              thumbnail_url: adReply.thumbnailUrl || adReply.thumbnail_url || null,
              ctwa_clid: adReply.ctwaClid || adReply.ctwa_clid || adReply.clid || null,
            };
          }
        }

        // S7.1: Detectar tipo de media — Gowa nativo (p.audio, p.image, p.video, p.document)
        // y fallback Evolution API (msgContent.audioMessage, msgContent.imageMessage)
        if (p.audio) {
            text = '[Nota de Voz]';
            audioMediaUrl = await resolveGowaMedia(p.audio);
        } else if (msgContent.audioMessage) {
            text = '[Nota de Voz]';
            audioMediaUrl = msgContent.audioMessage.url || null;
        } else if (p.image) {
            text = p.body || '[Imagen]';
            imageMediaUrl = await resolveGowaMedia(p.image);
        } else if (msgContent.imageMessage) {
            text = msgContent.imageMessage.caption || '[Imagen]';
            imageMediaUrl = msgContent.imageMessage.url || null;
        } else if (p.video) {
            text = p.body || '[Video]';
        } else if (p.document) {
            text = p.body || '[Documento]';
        } else {
            text = p.body || p.text || msgContent.conversation || msgContent.extendedTextMessage?.text || msgContent.videoMessage?.caption || msgContent.documentMessage?.caption || msgContent.buttonsResponseMessage?.selectedDisplayText || '[Mensaje]';
        }
        messageId = p.id || p.key?.id;
    }

    if (!phone) return new Response('ok', { status: 200 });
    // Ignorar mensajes de grupos (JID @g.us) — solo procesar chats individuales
    if (String(phone).includes('@g.us')) return new Response('ok', { status: 200 });
    let senderPhone = String(phone).split('@')[0].replace(/\D/g, '');

    let { data: lead } = await supabase.from('leads').select('*').or(`telefono.ilike.%${senderPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (!lead) {
        if (isFromMe) return new Response('ok', { status: 200 });
        
        // Check if this channel has a direct agent assignment (per-channel, no global toggle needed)
        let assignedAgent: string | null = null;
        if (actualChannelId) {
            const { data: agentMapCfg } = await supabase.from('app_config').select('value').eq('key', 'channel_agent_map').maybeSingle();
            if (agentMapCfg?.value) {
                try {
                    const agentMap = JSON.parse(agentMapCfg.value);
                    if (agentMap[actualChannelId]) assignedAgent = agentMap[actualChannelId];
                } catch (_) {}
            }
        }

        // Determine initial ai_paused from agent's AI status config (if assigned)
        let initialAiPaused = false;
        if (assignedAgent) {
            const { data: aiStatusCfg } = await supabase.from('app_config').select('value').eq('key', `agent_ai_status_${assignedAgent}`).maybeSingle();
            if (aiStatusCfg?.value) {
                try {
                    const parsed = JSON.parse(aiStatusCfg.value);
                    initialAiPaused = parsed.enabled === false;
                } catch (_) {}
            }
        }

        // 2026-04-10: Atribución de anuncio CTWA si vino de click-to-WhatsApp
        // deno-lint-ignore no-explicit-any
        const leadInsert: Record<string, any> = {
           nombre: pushName,
           telefono: senderPhone,
           channel_id: actualChannelId,
           assigned_to: assignedAgent,
           ai_paused: initialAiPaused,
           buying_intent: 'BAJO',
           last_message_at: new Date().toISOString(),
           followup_stage: 0
        };
        if (ctwaReferral) {
           leadInsert.ctwa_clid = ctwaReferral.ctwa_clid;
           leadInsert.ad_source_id = ctwaReferral.source_id;
           leadInsert.ad_source_url = ctwaReferral.source_url;
           leadInsert.ad_source_type = ctwaReferral.source_type;
           leadInsert.ad_headline = ctwaReferral.headline;
           leadInsert.ad_body = ctwaReferral.body;
           leadInsert.ad_thumbnail_url = ctwaReferral.thumbnail_url;
           leadInsert.referral_captured_at = new Date().toISOString();
           // Construir fbc conforme a formato Meta: fb.<subdomain_index>.<timestamp_ms>.<click_id>
           // subdomain_index=1 es el default para CTWA
           if (ctwaReferral.ctwa_clid) {
              leadInsert.fbc = `fb.1.${Date.now()}.${ctwaReferral.ctwa_clid}`;
           }
        }

        const { data: nl, error: insertError } = await supabase.from('leads').insert(leadInsert).select().single();

        if (insertError) console.error(insertError);
        lead = nl;

        const routeInfo = assignedAgent ? ` Asignado directo a agente (canal vinculado).` : '';
        const attribInfo = ctwaReferral ? ` 🎯 CTWA: ${ctwaReferral.headline || ctwaReferral.source_id || 'ad'}` : '';
        await supabase.from('activity_logs').insert({
            action: 'CREATE', resource: 'LEADS', description: `Lead entrante (${pushName}). Etapa BAJO.${routeInfo}${attribInfo}`, status: 'OK'
        });
        // 2026-04-11: log de diagnóstico explícito cuando un lead viene con atribución
        if (ctwaReferral) {
            await supabase.from('activity_logs').insert({
                action: 'INFO', resource: 'SYSTEM',
                description: `📢 Atribución CTWA capturada: clid=${ctwaReferral.ctwa_clid || 'null'} source_id=${ctwaReferral.source_id || 'null'} headline=${(ctwaReferral.headline || '').substring(0, 60)}`,
                status: 'OK'
            });
        }
    } else if (isFromMe) {
        // --- #OFF / #ON desde el teléfono WhatsApp (per-lead toggle) ---
        const cmd = text.trim().toUpperCase();
        if (cmd === '#OFF' || cmd === '#STOP') {
            await supabase.from('leads').update({ ai_paused: true }).eq('id', lead.id);
            await supabase.from('conversaciones').insert({ lead_id: lead.id, mensaje: 'IA Pausada manualmente (WhatsApp).', emisor: 'HUMANO', platform: 'WHATSAPP' });
            await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'BRAIN', description: `⏸️ IA pausada para ${lead.nombre} vía #OFF desde WhatsApp`, status: 'OK' });
            return new Response('ai_paused', { status: 200, headers: corsHeaders });
        }
        if (cmd === '#ON' || cmd === '#START') {
            await supabase.from('leads').update({ ai_paused: false }).eq('id', lead.id);
            await supabase.from('conversaciones').insert({ lead_id: lead.id, mensaje: 'IA Activada manualmente (WhatsApp).', emisor: 'HUMANO', platform: 'WHATSAPP' });
            await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'BRAIN', description: `▶️ IA activada para ${lead.nombre} vía #ON desde WhatsApp`, status: 'OK' });
            return new Response('ai_resumed', { status: 200, headers: corsHeaders });
        }

        // Detectar y descartar auto-responders del teléfono WhatsApp
        // Estos mensajes confunden a la IA porque parecen respuestas humanas
        const autoReplyPatterns = [
            'en este momento no podemos responder',
            'nuestros horarios de atención',
            'fuera de nuestro horario',
            'te responderemos a la brevedad',
            'no estamos disponibles',
            'horario de atención',
            'respuesta automática',
            'auto-reply',
            'away message'
        ];
        const lowerText = text.toLowerCase();
        const isAutoReply = autoReplyPatterns.some(p => lowerText.includes(p));
        if (isAutoReply) {
            // No guardar en conversaciones — evita que la IA piense que un humano respondió
            await supabase.from('activity_logs').insert({
                action: 'INFO', resource: 'SYSTEM',
                description: `🤖 Auto-responder descartado para ${lead.nombre}: "${text.substring(0, 60)}..."`,
                status: 'OK'
            });
            return new Response('auto_reply_skipped', { status: 200, headers: corsHeaders });
        }

        // Mensaje saliente del asesor desde teléfono: guardar como HUMANO sin mutar lead ni activar IA
        // deno-lint-ignore no-explicit-any
        const asesorMeta: Record<string, any> = { raw: payloadText.length <= 4000 ? payloadText : payloadText.substring(0, 4000) };
        if (audioMediaUrl || audioMediaId) { asesorMeta.mediaUrl = audioMediaUrl || null; asesorMeta.mediaId = audioMediaId || null; asesorMeta.mediaType = 'audio'; }
        else if (imageMediaUrl || imageMediaId) { asesorMeta.mediaUrl = imageMediaUrl || null; asesorMeta.mediaId = imageMediaId || null; asesorMeta.mediaType = 'image'; }
        // deno-lint-ignore no-explicit-any
        const asesorInsert: Record<string, any> = { lead_id: lead.id, emisor: 'HUMANO', mensaje: text, platform: 'WHATSAPP', metadata: asesorMeta };
        if (messageId) asesorInsert.message_id = messageId;
        await supabase.from('conversaciones').insert(asesorInsert);

        // Bug-fix 2026-04-10: transcribir TAMBIÉN las notas de voz salientes del vendedor
        // para que queden legibles en el historial. skip_ai=true evita que la IA responda
        // al cliente como si la nota del vendedor fuese del cliente.
        if ((audioMediaId || audioMediaUrl) && messageId && actualChannelId) {
            supabase.functions.invoke('transcribe-audio', {
                body: { media_id: audioMediaId || null, media_url: audioMediaUrl || null, lead_id: lead.id, message_id: messageId, channel_id: actualChannelId, sender_phone: senderPhone, skip_ai: true }
            }).then((res) => {
                if (res.error) {
                    supabase.from('activity_logs').insert({
                        action: 'ERROR', resource: 'BRAIN',
                        description: `🎙️ transcribe-audio (outbound) invoke failed: ${res.error?.message || JSON.stringify(res.error).substring(0, 150)}`,
                        status: 'ERROR'
                    }).catch(() => {});
                }
            }).catch((err) => {
                supabase.from('activity_logs').insert({
                    action: 'ERROR', resource: 'BRAIN',
                    description: `🎙️ transcribe-audio (outbound) invoke crash: ${err?.message || String(err).substring(0, 150)}`,
                    status: 'ERROR'
                }).catch(() => {});
            });
        }

        // Bug-fix 2026-04-10: re-analizar intent cuando el vendedor escribe
        // (su respuesta cambia el contexto de la conversación y puede mover de etapa)
        const skipAnalysisOutbound = !text || text.length < 3 || text === '[Sticker]';
        if (!skipAnalysisOutbound) {
            supabase.functions.invoke('analyze-leads', {
                body: { lead_id: lead.id, triggered_by: 'agent_message' }
            }).catch(() => {});
        }

        return new Response('ok', { status: 200, headers: corsHeaders });
    } else {
        const updates: Record<string, unknown> = { last_message_at: new Date().toISOString(), followup_stage: 0 };
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
    // deno-lint-ignore no-explicit-any
    const clientInsert: Record<string, any> = { lead_id: lead.id, emisor: 'CLIENTE', mensaje: text, platform: 'WHATSAPP' };
    if (messageId) clientInsert.message_id = messageId;
    // Construir metadata: media URLs + raw_payload para reprocesamiento futuro
    // deno-lint-ignore no-explicit-any
    const msgMetadata: Record<string, any> = {};
    if (audioMediaUrl || audioMediaId) { msgMetadata.mediaUrl = audioMediaUrl || null; msgMetadata.mediaId = audioMediaId || null; msgMetadata.mediaType = 'audio'; }
    else if (imageMediaUrl || imageMediaId) { msgMetadata.mediaUrl = imageMediaUrl || null; msgMetadata.mediaId = imageMediaId || null; msgMetadata.mediaType = 'image'; }
    // Raw payload: guardar para poder reprocesar si cambia formato de GoWA/Meta
    msgMetadata.raw = payloadText.length <= 4000 ? payloadText : payloadText.substring(0, 4000);
    clientInsert.metadata = msgMetadata;
    const { error: insertError2 } = await supabase.from('conversaciones').insert(clientInsert);
    if (insertError2) {
        if (insertError2.code === '23505') {
            // Duplicate wamid — webhook retry de Meta, ignorar
            return new Response('ok', { status: 200, headers: corsHeaders });
        }
        console.error('Insert conversacion error:', insertError2.message);
    }
    await supabase.from('activity_logs').insert({ action: 'CHAT', resource: 'SYSTEM', description: `Mensaje de ${lead.nombre}: "${text.substring(0, 30)}..."`, status: 'OK' });

    // S6.1 + S7.1: Ojo de Halcón — analizar TODA imagen entrante.
    // analyze-receipt hace early-exit vía GPT-4o Vision si la imagen no es un comprobante.
    // Bug-fix 2026-04-10: antes sólo se analizaba si el caption contenía palabras clave
    // o el lead ya estaba en ALTO, lo que dejaba fuera los comprobantes sin caption.
    if (imageMediaId || imageMediaUrl) {
        supabase.functions.invoke('analyze-receipt', {
            body: { image_id: imageMediaId || null, media_url: imageMediaUrl || null, lead_id: lead.id, channel_id: actualChannelId, caption: text }
        }).catch(err => console.error('analyze-receipt fire error:', err));
    }

    // Determine AI mode: per-channel > per-lead > global
    const { data: channelConfig } = actualChannelId
      ? await supabase.from('whatsapp_channels').select('ai_mode').eq('id', actualChannelId).maybeSingle()
      : { data: null };
    const channelAiMode = channelConfig?.ai_mode || 'on'; // 'on' | 'monitor' | 'off'

    // If channel is OFF, stop here (lead + message already saved above)
    if (channelAiMode === 'off') {
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // ALWAYS run analyze-leads in 'on' and 'monitor' modes (extracts data + sends CAPI)
    // Skip analysis for empty/placeholder messages (no value for OpenAI tokens)
    const skipAnalysis = !text || text === '[Mensaje]' || text === '[Sticker]';
    if (!skipAnalysis) {
        supabase.functions.invoke('analyze-leads', { body: { lead_id: lead.id } }).catch(() => {});
    }

    // ALWAYS transcribe audio in 'on' and 'monitor' modes (so conversations are readable)
    if (audioMediaId || audioMediaUrl) {
        supabase.functions.invoke('transcribe-audio', {
            body: { media_id: audioMediaId || null, media_url: audioMediaUrl || null, lead_id: lead.id, message_id: messageId, channel_id: actualChannelId, sender_phone: senderPhone }
        }).then((res) => {
            if (res.error) {
                supabase.from('activity_logs').insert({
                    action: 'ERROR', resource: 'BRAIN',
                    description: `🎙️ transcribe-audio invoke failed: ${res.error?.message || JSON.stringify(res.error).substring(0, 150)}`,
                    status: 'ERROR'
                }).catch(() => {});
            }
        }).catch((err) => {
            supabase.from('activity_logs').insert({
                action: 'ERROR', resource: 'BRAIN',
                description: `🎙️ transcribe-audio invoke crash: ${err?.message || String(err).substring(0, 150)}`,
                status: 'ERROR'
            }).catch(() => {});
        });
    }

    // AI response: channel on + global active + lead not paused + agent enabled + within schedule
    // Schedule priority: Admin schedule > Agent self-schedule
    const { data: globalConfig } = await supabase.from('app_config').select('value').eq('key', 'global_ai_status').maybeSingle();
    let agentAiDisabled = false;
    let outsideSchedule = false;
    if (lead.assigned_to) {
        // 1. Admin AI status (highest priority — set in Gestión de Equipo)
        const { data: agentAiCfg } = await supabase.from('app_config').select('value').eq('key', `agent_ai_status_${lead.assigned_to}`).maybeSingle();
        if (agentAiCfg?.value) {
            try {
                const parsed = JSON.parse(agentAiCfg.value);
                if (parsed.enabled === false) agentAiDisabled = true;
            } catch (_) {}
        }

        // 2. Agent self AI status (set by agent in Mi Perfil)
        if (!agentAiDisabled) {
            const { data: selfAiCfg } = await supabase.from('app_config').select('value').eq('key', `agent_self_ai_status_${lead.assigned_to}`).maybeSingle();
            if (selfAiCfg?.value) {
                try {
                    const parsed = JSON.parse(selfAiCfg.value);
                    if (parsed.enabled === false) agentAiDisabled = true;
                } catch (_) {}
            }
        }

        // 3. Schedule check — helper to evaluate a schedule against current time
        const nowMx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const dayId = nowMx.getDay().toString();
        const hhmm = `${String(nowMx.getHours()).padStart(2, '0')}:${String(nowMx.getMinutes()).padStart(2, '0')}`;

        const isOutsideSchedule = (scheduleJson: string): boolean => {
            try {
                const schedule = JSON.parse(scheduleJson);
                const hasAnyDay = Object.values(schedule).some((d: unknown) => (d as { active?: boolean })?.active);
                if (!hasAnyDay) return false; // No schedule configured → no restriction
                const dayCfg = schedule[dayId];
                if (!dayCfg || !dayCfg.active) return true; // Day not active
                if (dayCfg.ranges && Array.isArray(dayCfg.ranges)) {
                    return !dayCfg.ranges.some((r: { start: string; end: string }) => hhmm >= r.start && hhmm <= r.end);
                }
                return false;
            } catch (_) { return false; }
        };

        // Admin schedule has priority
        const { data: adminScheduleCfg } = await supabase.from('app_config').select('value').eq('key', `agent_ai_schedule_${lead.assigned_to}`).maybeSingle();
        if (adminScheduleCfg?.value) {
            outsideSchedule = isOutsideSchedule(adminScheduleCfg.value);
        } else {
            // No admin schedule → check agent self-schedule
            const { data: selfScheduleCfg } = await supabase.from('app_config').select('value').eq('key', `agent_self_schedule_${lead.assigned_to}`).maybeSingle();
            if (selfScheduleCfg?.value) {
                outsideSchedule = isOutsideSchedule(selfScheduleCfg.value);
            }
        }
    }
    const aiEnabled = channelAiMode === 'on' && globalConfig?.value !== 'paused' && !lead.ai_paused && !agentAiDisabled && !outsideSchedule;

    if (aiEnabled) {
        if (audioMediaId || audioMediaUrl) {
            // Audio ya se envió a transcribir arriba, no invocar process-samurai-response aquí
            // transcribe-audio lo invoca después de transcribir
        } else {
            // Llamar al procesador IA con fetch directo
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
                await fnRes.json().catch(() => ({}));
            } catch (invokeErr) {
                console.error('Error calling process-samurai-response:', invokeErr);
            }
        }
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[evolution-webhook] CRASH:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: corsHeaders });
  }
});