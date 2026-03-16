// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Búsqueda Profunda Recursiva (Deep Search) para localizar multimedia
function findValue(obj: any, keyToFind: string): any {
  if (!obj || typeof obj !== 'object') return null;
  if (keyToFind in obj) return obj[keyToFind];
  for (const key in obj) {
    const found = findValue(obj[key], keyToFind);
    if (found) return found;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const apiKey = configs.find(c => c.key === 'openai_api_key')?.value;
    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    const body = await req.json();
    const eventName = (body.event || body.type || "").toLowerCase();
    
    if (eventName !== 'messages.upsert') return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });

    const messageData = findValue(body, 'message'); 
    const fromMe = findValue(body, 'fromMe') || findValue(body.data?.key, 'fromMe');
    if (!messageData) return new Response('Ignored: No message data');

    const phone = findValue(body, 'remoteJid')?.split('@')[0] || findValue(body.data?.key, 'remoteJid')?.split('@')[0];
    if (!phone) return new Response('No phone');

    let messageText = findValue(messageData, 'conversation') || findValue(messageData, 'text') || findValue(messageData, 'caption') || "";

    // --- NUEVA LÓGICA DE CONTROL PARA AGENTES ---
    if (fromMe) {
        const { data: lead } = await supabaseClient.from('leads').select('id, nombre').or(`telefono.ilike.%${phone}%`).maybeSingle();
        if (!lead) return new Response('Ignored: Lead not found for agent message');

        // Guardar el mensaje del agente para tener el historial completo
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'HUMANO', mensaje: messageText, platform: 'WHATSAPP_MANUAL' });

        if (messageText.includes('#AI_OFF')) {
            await supabaseClient.from('leads').update({ ai_paused: true }).eq('id', lead.id);
            await supabaseClient.from('activity_logs').insert({ action: 'UPDATE', resource: 'LEADS', description: `IA PAUSADA manualmente para ${lead.nombre}`, status: 'OK' });
        } else if (messageText.includes('#AI_ON')) {
            await supabaseClient.from('leads').update({ ai_paused: false }).eq('id', lead.id);
            await supabaseClient.from('activity_logs').insert({ action: 'UPDATE', resource: 'LEADS', description: `IA ACTIVADA manualmente para ${lead.nombre}`, status: 'OK' });
        }
        
        return new Response('Agent message processed');
    }

    // --- LÓGICA PARA MENSAJES DE CLIENTES ---
    let isAudio = !!findValue(messageData, 'audioMessage');
    let isImage = !!findValue(messageData, 'imageMessage');
    let mimeType = isAudio ? findValue(messageData, 'mimetype') : (isImage ? findValue(messageData, 'mimetype') : null);
    let base64 = findValue(body, 'base64');

    if (!base64 && (isAudio || isImage) && evoUrl && evoKey) {
        try {
            const urlObj = new URL(evoUrl);
            const baseUrl = urlObj.origin;
            const instance = body.instance || urlObj.pathname.split('/').pop();
            const getMediaUrl = `${baseUrl}/chat/getBase64FromMediaMessage/${instance}`;
            const mediaRes = await fetch(getMediaUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ message: body.data || body })
            });
            if (mediaRes.ok) base64 = (await mediaRes.json()).base64;
        } catch (e) { console.error("[Webhook] Búsqueda externa de base64 falló:", e); }
    }

    let bytes = null;
    if (base64) {
        try {
            const binary = atob(base64);
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } catch(e) { console.error("Error decodificando base64:", e); }
    }

    if (isAudio && bytes) {
        try {
            const blob = new Blob([bytes], { type: mimeType?.split(';')[0] || 'audio/ogg' });
            const formData = new FormData();
            formData.append('file', blob, 'audio.ogg');
            formData.append('model', 'whisper-1');
            const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}` }, body: formData
            });
            if (whisperRes.ok) messageText = `[TRANSCRIPCIÓN AUDIO]: "${(await whisperRes.json()).text}"`;
            else messageText = `[TRANSCRIPCIÓN AUDIO]: (Fallo en la transcripción)`;
        } catch (e) { messageText = `[AUDIO NO RECONOCIDO]`; }
    }

    if (isImage && !messageText) messageText = "[IMAGEN RECIBIDA]";
    if (!messageText && !isImage) return new Response('No content');

    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ 
            nombre: `Nuevo Lead ${phone.slice(-4)}`, telefono: phone, buying_intent: 'BAJO', payment_status: 'NONE'
        }).select().single();
        lead = newLead;
    }

    if (lead.ai_paused) return new Response('Paused');

    // AL RECIBIR MENSAJE DEL CLIENTE: RESETEAR EL RELOJ Y LA FASE DE FOLLOWUP A CERO
    await supabaseClient.from('leads').update({ 
        last_message_at: new Date().toISOString(),
        followup_stage: 0 
    }).eq('id', lead.id);

    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead } });
    const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20);
    const historyMsgs = history ? history.reverse() : [];

    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });

    let finalSystemPrompt = kernelData?.system_prompt || "";
    let userMessageContent: any = messageText;

    if (isImage && base64) {
        const visionPrompt = configs.find(c => c.key === 'prompt_vision_instrucciones')?.value || "Analiza esta imagen con precisión.";
        finalSystemPrompt += `\n\n=== MÓDULO OJO DE HALCÓN ACTIVADO ===\n${visionPrompt}\n\n[REGLA DE SISTEMA OBLIGATORIA]: El cliente acaba de enviar una imagen. Si tras analizarla determinas que ES un comprobante de pago o ficha de depósito, DEBES añadir al final de tu mensaje este bloque JSON EXACTO para actualizar el Pipeline de ventas: \n---JSON---\n{"payment_status": "VALID"}\n(Usa "VALID" si el pago es correcto, "INVALID" si es falso o cuenta errónea, y "DOUBTFUL" si es borroso o dudoso). Si la imagen NO es un comprobante de pago, NO escribas el JSON.`;
        userMessageContent = [{ type: "text", text: messageText }, { type: "image_url", image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64}` } }];
    }

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: finalSystemPrompt },
                ...historyMsgs.map(m => ({ role: (m.emisor === 'IA' || m.emisor === 'SAMURAI' ? 'assistant' : 'user'), content: m.mensaje })),
                { role: "user", content: userMessageContent } 
            ],
            temperature: 0.3
        })
    });

    const aiData = await aiRes.json();
    let rawAnswer = aiData.choices?.[0]?.message?.content || "";
    
    // --- NUEVO: INTERCEPCIÓN JSON DUAL (Pagos y Petición de Humano) ---
    let paymentStatusToUpdate = null;
    let requestHumanToUpdate = false;

    if (rawAnswer.includes('---JSON---')) {
        const parts = rawAnswer.split('---JSON---');
        rawAnswer = parts[0].trim();
        try {
            let jsonStr = parts[1].trim();
            // Limpiar block quotes por si GPT agrega markdown
            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedJson = JSON.parse(jsonStr);
            if (parsedJson.payment_status) paymentStatusToUpdate = parsedJson.payment_status;
            if (parsedJson.request_human) requestHumanToUpdate = true;
        } catch(e) { console.error("[Webhook] Error procesando JSON IA:", e); }
    }

    if (paymentStatusToUpdate) {
        await supabaseClient.from('leads').update({ payment_status: paymentStatusToUpdate }).eq('id', lead.id);
        if (bytes) {
            const fileName = `uploads/pago_${lead.id}_${Date.now()}.jpg`;
            const { data: uploadData } = await supabaseClient.storage.from('media').upload(fileName, bytes, { contentType: mimeType || 'image/jpeg' });
            if (uploadData) {
                const { data: publicUrlData } = supabaseClient.storage.from('media').getPublicUrl(fileName);
                await supabaseClient.from('media_assets').insert({
                    title: `Comprobante Automático ${lead.nombre}`, url: publicUrlData.publicUrl, type: 'IMAGE', category: 'PAYMENT',
                    ocr_content: `[Ojo de Halcón] Status IA: ${paymentStatusToUpdate}\nLead: ${lead.nombre} (${lead.telefono})\nValidación Automática.`
                });
            }
        }
        await supabaseClient.from('activity_logs').insert({
            action: 'UPDATE', resource: 'LEADS',
            description: `Comprobante evaluado para ${lead.nombre}. Estatus Ojo de Halcón: ${paymentStatusToUpdate}`,
            status: paymentStatusToUpdate === 'VALID' ? 'OK' : 'ERROR'
        });
    }

    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const mediaMatch = rawAnswer.match(mediaRegex);
    const mediaUrl = mediaMatch ? mediaMatch[1].trim() : null;
    let textToSend = rawAnswer.replace(mediaRegex, '').trim();

    if (evoUrl && evoKey && (textToSend || mediaUrl)) {
        const endpoint = mediaUrl ? evoUrl.replace('sendText', 'sendMedia') : evoUrl;
        const payload = mediaUrl ? {
            number: phone, mediatype: "image", media: mediaUrl, caption: textToSend || "",
            mediaMessage: { mediatype: "image", media: mediaUrl, caption: textToSend || "" }
        } : { number: phone, text: textToSend };

        const response = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoKey }, body: JSON.stringify(payload)
        });

        const messageToLog = mediaUrl ? `[IMG: ${mediaUrl}] ${textToSend}` : textToSend;
        
        if (!response.ok) {
            const errText = await response.text();
            console.error("[Webhook] Evolution API Rechazó el mensaje:", errText);
            await supabaseClient.from('activity_logs').insert({
                action: 'ERROR', resource: 'SYSTEM', description: `Evolution API falló enviando a ${phone}: ${errText.substring(0, 150)}`, status: 'ERROR'
            });
            await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: `[ERROR WA] ${messageToLog}`, platform: 'ERROR' });
        } else {
            await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: messageToLog, platform: 'WHATSAPP_AUTO' });
        }
    }

    // --- ACCIÓN POST-ENVÍO: ESCALADO A HUMANO ---
    if (requestHumanToUpdate) {
        // Pausar bot
        await supabaseClient.from('leads').update({ ai_paused: true }).eq('id', lead.id);
        
        // Notificar al Vendedor por WhatsApp
        if (lead.assigned_to && evoUrl && evoKey) {
            const { data: agentProfile } = await supabaseClient.from('profiles').select('full_name, phone').eq('id', lead.assigned_to).maybeSingle();
            
            if (agentProfile?.phone) {
                const agentAlertMsg = `🚨 *ATENCIÓN REQUERIDA* 🚨\n\nEl cliente *${lead.nombre || lead.telefono}* ha solicitado asistencia humana o hizo una pregunta que la IA no pudo responder.\n\nEl Bot ha sido pausado automáticamente para este chat.\n👉 Ingresa al CRM para atenderlo.`;
                
                await fetch(evoUrl, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'apikey': evoKey }, 
                    body: JSON.stringify({ number: agentProfile.phone.replace(/\D/g, ''), text: agentAlertMsg })
                });
            }
        }
        
        // Logs Internos
        await supabaseClient.from('activity_logs').insert({
            action: 'UPDATE', resource: 'LEADS',
            description: `IA pausada y agente notificado para ${lead.nombre}`,
            status: 'OK'
        });
        
        await supabaseClient.from('conversaciones').insert({ 
            lead_id: lead.id, 
            mensaje: `IA Pausada automáticamente porque el cliente solicitó asistencia humana o hizo una pregunta sin respuesta en KB.`, 
            emisor: 'NOTA', 
            platform: 'PANEL_INTERNO' 
        });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error("[Webhook] Error Crítico:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})