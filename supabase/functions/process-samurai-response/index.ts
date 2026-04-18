import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // FIX: Supabase env variable read fix.
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { lead_id, client_message } = await req.json();
    if (!lead_id) return new Response('no_id', { headers: corsHeaders });

    // LOG: Inicio de procesamiento
    await supabase.from('activity_logs').insert({ 
        action: 'UPDATE', resource: 'BRAIN', 
        description: `🧠 [IA INICIADA] Procesando respuesta para Lead ${lead_id}`, 
        status: 'OK' 
    });

    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single();
    if (!lead) {
        await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: `❌ Lead ${lead_id} no encontrado`, status: 'ERROR' });
        return new Response('no_lead', { headers: corsHeaders });
    }
    
    if (lead.ai_paused) {
        await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'BRAIN', description: `⏸️ IA pausada para ${lead.nombre}`, status: 'OK' });
        return new Response('paused', { headers: corsHeaders });
    }
    
    // PROTECCIÓN: No responder a leads cerrados
    if (lead.buying_intent === 'PERDIDO' || lead.buying_intent === 'COMPRADO') {
        // Auto-rescate: si el cliente escribe, sacarlo de PERDIDO
        if (lead.buying_intent === 'PERDIDO') {
            await supabase.from('leads').update({ buying_intent: 'BAJO' }).eq('id', lead.id);
            await supabase.from('activity_logs').insert({ 
                action: 'UPDATE', resource: 'BRAIN', 
                description: `🔄 Lead ${lead.nombre} rescatado de PERDIDO -> BAJO`, 
                status: 'OK' 
            });
        } else {
            return new Response('closed', { headers: corsHeaders });
        }
    }

    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap: Record<string, unknown> = configs?.reduce((acc: Record<string, unknown>, item: { key: string; value: unknown }) => ({...acc, [item.key]: item.value}), {} as Record<string, unknown>) ?? {};

    // Verificar: agent self AI status + schedule (Admin > Agent self)
    if (lead.assigned_to) {
        // Agent self-toggle (set by agent in Mi Perfil)
        const selfStatusRaw = configMap[`agent_self_ai_status_${lead.assigned_to}`];
        if (selfStatusRaw) {
            try {
                const parsed = JSON.parse(selfStatusRaw as string);
                if (parsed.enabled === false) {
                    await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'BRAIN', description: `⏸️ IA desactivada por agente (self) para ${lead.nombre}`, status: 'OK' });
                    return new Response('self_disabled', { headers: corsHeaders });
                }
            } catch (_) {}
        }

        // Schedule: admin schedule has priority over agent self-schedule
        const nowMx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const dayId = nowMx.getDay().toString();
        const hhmm = `${String(nowMx.getHours()).padStart(2, '0')}:${String(nowMx.getMinutes()).padStart(2, '0')}`;

        const checkSchedule = (raw: unknown): boolean => {
            try {
                const schedule = JSON.parse(raw as string);
                const hasAnyDay = Object.values(schedule).some((d: unknown) => (d as { active?: boolean })?.active);
                if (!hasAnyDay) return false;
                const dayCfg = schedule[dayId];
                if (!dayCfg || !dayCfg.active) return true;
                if (dayCfg.ranges && Array.isArray(dayCfg.ranges)) {
                    return !dayCfg.ranges.some((r: { start: string; end: string }) => hhmm >= r.start && hhmm <= r.end);
                }
                return false;
            } catch (_) { return false; }
        };

        const adminScheduleRaw = configMap[`agent_ai_schedule_${lead.assigned_to}`];
        const selfScheduleRaw = configMap[`agent_self_schedule_${lead.assigned_to}`];
        const outsideSchedule = adminScheduleRaw ? checkSchedule(adminScheduleRaw) : (selfScheduleRaw ? checkSchedule(selfScheduleRaw) : false);

        if (outsideSchedule) {
            await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'BRAIN', description: `🕐 IA fuera de horario para ${lead.nombre} (${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })})`, status: 'OK' });
            return new Response('outside_schedule', { headers: corsHeaders });
        }
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY') || configMap['openai_api_key'];

    if (!apiKey) {
        await supabase.from('activity_logs').insert({ 
            action: 'ERROR', resource: 'BRAIN', 
            description: "🚨 ERROR CRÍTICO: OpenAI API Key no configurada en Ajustes", 
            status: 'ERROR' 
        });
        return new Response('no_key', { headers: corsHeaders });
    }

    // Obtener historial de conversación
    const { data: history } = await supabase.from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true })
        .limit(10);

    // Obtener constitución del Kernel (protegido para no matar el flujo)
    let systemPrompt = "Eres Sam, asistente de ventas amigable y profesional.";
    try {
        const { data: kernel, error: kernelErr } = await supabase.functions.invoke('get-samurai-context', { body: { lead } });
        if (kernelErr) {
            await supabase.from('activity_logs').insert({
                action: 'ERROR', resource: 'BRAIN',
                description: `Fallo al obtener contexto del Kernel: ${kernelErr.message}`,
                status: 'ERROR'
            });
        } else if (kernel?.system_prompt) {
            systemPrompt = kernel.system_prompt;
        }
    } catch (ctxErr: unknown) {
        const ctxErrMsg = ctxErr instanceof Error ? ctxErr.message : String(ctxErr);
        await supabase.from('activity_logs').insert({
            action: 'ERROR', resource: 'BRAIN',
            description: `CRASH get-samurai-context: ${ctxErrMsg}`,
            status: 'ERROR'
        });
    }

    const msgs = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(h => ({ role: (['IA', 'SAMURAI', 'BOT'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje })),
        { role: 'user', content: client_message }
    ];

    // LOG: Llamando a OpenAI
    await supabase.from('activity_logs').insert({ 
        action: 'UPDATE', resource: 'BRAIN', 
        description: `📡 [OPENAI] Generando respuesta para ${lead.nombre}...`, 
        status: 'OK' 
    });

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages: msgs, temperature: 0.4 })
    });

    if (!aiRes.ok) throw new Error(`OpenAI HTTP ${aiRes.status}: ${await aiRes.text()}`);
    const aiData = await aiRes.json();

    // DETECTOR DE ERRORES OPENAI
    if (aiData.error) {
        await supabase.from('activity_logs').insert({ 
            action: 'ERROR', resource: 'BRAIN', 
            description: `🚨 ERROR OPENAI: ${aiData.error.message}`, 
            status: 'ERROR' 
        });
        return new Response('openai_error', { headers: corsHeaders });
    }

    const aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        // S4.2: Extraer media tags de la respuesta IA
        const mediaRegex = /<<MEDIA:(https?:\/\/[^>]+)>>/;
        const mediaMatch = aiText.match(mediaRegex);
        const cleanText = aiText.replace(/<<MEDIA:https?:\/\/[^>]+>>/g, '').trim();

        // ENVIAR A WHATSAPP PRIMERO — obtener wamid antes de insertar (S2.2-D2)
        let wamid = null;
        let sendFailed = false;
        try {
            if (mediaMatch) {
                const mediaUrl = mediaMatch[1];
                // S4.3: Validar URL de media antes de enviar
                if (!mediaUrl.startsWith('https://')) {
                    await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: `URL de media invalida: ${mediaUrl.substring(0, 100)}`, status: 'ERROR' });
                    // Fallback: enviar solo texto sin imagen
                    const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-message-v3', {
                        body: { channel_id: lead.channel_id, phone: lead.telefono, message: cleanText || aiText, lead_id: lead.id }
                    });
                    if (sendErr || (sendData && !sendData.success)) {
                        sendFailed = true;
                        await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'SYSTEM', description: `ERROR WHATSAPP (${lead.telefono}): ${sendErr?.message || JSON.stringify(sendData?.error || 'unknown')}`, status: 'ERROR' });
                    } else {
                        wamid = sendData?.wamid || null;
                    }
                } else if (cleanText && cleanText.length <= 1024) {
                    // Caption mode: imagen con texto como caption
                    const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-message-v3', {
                        body: { channel_id: lead.channel_id, phone: lead.telefono, message: cleanText, mediaData: { url: mediaUrl, type: 'image' }, lead_id: lead.id }
                    });
                    if (sendErr || (sendData && !sendData.success)) {
                        sendFailed = true;
                        await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'SYSTEM', description: `ERROR WHATSAPP MEDIA (${lead.telefono}): ${sendErr?.message || JSON.stringify(sendData?.error || 'unknown')}`, status: 'ERROR' });
                    } else {
                        wamid = sendData?.wamid || null;
                        await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'BRAIN', description: `🖼️ Imagen enviada a ${lead.nombre} (caption mode)`, status: 'OK' });
                    }
                } else if (cleanText && cleanText.length > 1024) {
                    // Split mode: imagen sola + texto aparte
                    const { data: imgData, error: imgErr } = await supabase.functions.invoke('send-message-v3', {
                        body: { channel_id: lead.channel_id, phone: lead.telefono, message: '', mediaData: { url: mediaUrl, type: 'image' }, lead_id: lead.id }
                    });
                    if (imgErr || (imgData && !imgData.success)) {
                        sendFailed = true;
                        await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'SYSTEM', description: `ERROR WHATSAPP MEDIA (${lead.telefono}): ${imgErr?.message || JSON.stringify(imgData?.error || 'unknown')}`, status: 'ERROR' });
                    } else {
                        const { data: txtData, error: txtErr } = await supabase.functions.invoke('send-message-v3', {
                            body: { channel_id: lead.channel_id, phone: lead.telefono, message: cleanText, lead_id: lead.id }
                        });
                        if (txtErr || (txtData && !txtData.success)) {
                            await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'SYSTEM', description: `ERROR WHATSAPP TEXTO (${lead.telefono}): ${txtErr?.message || JSON.stringify(txtData?.error || 'unknown')}`, status: 'ERROR' });
                        }
                        wamid = txtData?.wamid || imgData?.wamid || null;
                        await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'BRAIN', description: `🖼️ Imagen enviada a ${lead.nombre} (split mode)`, status: 'OK' });
                    }
                } else {
                    // Solo imagen, sin texto
                    const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-message-v3', {
                        body: { channel_id: lead.channel_id, phone: lead.telefono, message: '', mediaData: { url: mediaUrl, type: 'image' }, lead_id: lead.id }
                    });
                    if (sendErr || (sendData && !sendData.success)) {
                        sendFailed = true;
                        await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'SYSTEM', description: `ERROR WHATSAPP MEDIA (${lead.telefono}): ${sendErr?.message || JSON.stringify(sendData?.error || 'unknown')}`, status: 'ERROR' });
                    } else {
                        wamid = sendData?.wamid || null;
                        await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'BRAIN', description: `🖼️ Imagen enviada a ${lead.nombre} (image only)`, status: 'OK' });
                    }
                }
            } else {
                // Sin media tag: flujo original sin cambios
                const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-message-v3', {
                    body: { channel_id: lead.channel_id, phone: lead.telefono, message: aiText, lead_id: lead.id }
                });
                if (sendErr || (sendData && !sendData.success)) {
                    sendFailed = true;
                    await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'SYSTEM', description: `ERROR WHATSAPP (${lead.telefono}): ${sendErr?.message || JSON.stringify(sendData?.error || 'unknown')}`, status: 'ERROR' });
                } else {
                    wamid = sendData?.wamid || null;
                }
            }
        } catch (sendError: unknown) {
            sendFailed = true;
            const sendErrMsg = sendError instanceof Error ? sendError.message : String(sendError);
            await supabase.from('activity_logs').insert({
                action: 'ERROR', resource: 'SYSTEM',
                description: `ERROR ENVIO WA (${lead.telefono}): ${sendErrMsg}`,
                status: 'ERROR'
            });
        }

        // LUEGO INSERTAR EN CONVERSACIONES — guardar texto limpio (sin tags)
        if (!sendFailed) {
            const insertPayload: Record<string, string> = {
                lead_id: lead.id, emisor: 'IA', mensaje: cleanText || aiText, platform: 'WHATSAPP'
            };
            if (wamid) insertPayload.message_id = wamid;

            const { error: convError } = await supabase.from('conversaciones').insert(insertPayload);
            if (convError) {
                await supabase.from('activity_logs').insert({
                    action: 'ERROR', resource: 'BRAIN',
                    description: `INSERT conversaciones FALLO: ${convError.message?.substring(0, 200)}`,
                    status: 'ERROR'
                });
            }
        }
    } else {
        await supabase.from('activity_logs').insert({
            action: 'ERROR', resource: 'BRAIN',
            description: `OpenAI devolvio respuesta vacia para ${lead.nombre}`,
            status: 'ERROR'
        });
    }

    return new Response(JSON.stringify({ aiText: aiText || '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await supabase.from('activity_logs').insert({
        action: 'ERROR', resource: 'SYSTEM',
        description: `🚨 CRASH en IA: ${errMsg}`,
        status: 'ERROR'
    });
    return new Response(errMsg, { status: 200, headers: corsHeaders });
  }
});