// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    
    // Ignorar eventos que no sean mensajes
    if (eventName !== 'messages.upsert') return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });

    const messageData = findValue(body, 'message'); 
    const fromMe = findValue(body, 'fromMe') || findValue(body.data?.key, 'fromMe');
    if (!messageData) return new Response('Ignored: No message data');

    const phone = findValue(body, 'remoteJid')?.split('@')[0] || findValue(body.data?.key, 'remoteJid')?.split('@')[0];
    if (!phone || phone.includes('status')) return new Response('No phone or status');

    let messageText = findValue(messageData, 'conversation') || findValue(messageData, 'text') || findValue(messageData, 'caption') || "";

    // 1. OBTENER O CREAR LEAD
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ 
            nombre: `Nuevo Lead ${phone.slice(-4)}`, telefono: phone, buying_intent: 'BAJO', payment_status: 'NONE'
        }).select().single();
        lead = newLead;
    }

    // 2. LÓGICA PARA MENSAJES SALIENTES (HUMANOS O ECOS DE LA IA)
    if (fromMe) {
        if (!messageText) return new Response('Ignored: Empty fromMe');

        // Verificar si es un ECO de la IA (Si la IA envió un mensaje igual en los últimos 20 segundos)
        const { data: aiEcho } = await supabaseClient.from('conversaciones')
            .select('id')
            .eq('lead_id', lead.id)
            .in('emisor', ['IA', 'SAMURAI'])
            .ilike('mensaje', `%${messageText.substring(0, 30)}%`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (aiEcho && aiEcho.length > 0) {
            return new Response('Ignored: AI Echo');
        }

        // Si no es un eco de la IA, es un Vendedor Humano desde el celular/WhatsApp Web
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'HUMANO', mensaje: messageText, platform: 'WHATSAPP_MANUAL' });

        if (messageText.includes('#STOP') || messageText.includes('#AI_OFF')) {
            await supabaseClient.from('leads').update({ ai_paused: true }).eq('id', lead.id);
        } else if (messageText.includes('#START') || messageText.includes('#AI_ON')) {
            await supabaseClient.from('leads').update({ ai_paused: false }).eq('id', lead.id);
        }
        
        return new Response('Agent message processed');
    }

    // 3. LÓGICA PARA MENSAJES DEL CLIENTE (ENTRANTES)
    let isAudio = !!findValue(messageData, 'audioMessage');
    let isImage = !!findValue(messageData, 'imageMessage');
    let mimeType = isAudio ? findValue(messageData, 'mimetype') : (isImage ? findValue(messageData, 'mimetype') : null);
    let base64 = findValue(body, 'base64');

    if (!base64 && (isAudio || isImage) && evoUrl && evoKey) {
        try {
            const urlObj = new URL(evoUrl);
            const getMediaUrl = `${urlObj.origin}/chat/getBase64FromMediaMessage/${body.instance || urlObj.pathname.split('/').pop()}`;
            const mediaRes = await fetch(getMediaUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoKey }, body: JSON.stringify({ message: body.data || body }) });
            if (mediaRes.ok) base64 = (await mediaRes.json()).base64;
        } catch (e) { console.error("Error fetching media base64:", e); }
    }

    let bytes = null;
    if (base64) {
        try {
            const binary = atob(base64);
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } catch(e) {}
    }

    if (isAudio && bytes) {
        try {
            const blob = new Blob([bytes], { type: mimeType?.split(';')[0] || 'audio/ogg' });
            const formData = new FormData();
            formData.append('file', blob, 'audio.ogg');
            formData.append('model', 'whisper-1');
            const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}` }, body: formData });
            messageText = whisperRes.ok ? `[TRANSCRIPCIÓN AUDIO]: "${(await whisperRes.json()).text}"` : `[AUDIO NO RECONOCIDO]`;
        } catch (e) { messageText = `[AUDIO NO RECONOCIDO]`; }
    }

    if (isImage && !messageText) messageText = "[IMAGEN RECIBIDA]";
    if (!messageText && !isImage) return new Response('No content');

    if (lead.ai_paused) {
        // Guardamos el mensaje del cliente pero no disparamos la IA
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
        return new Response('Paused');
    }

    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString(), followup_stage: 0 }).eq('id', lead.id);

    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead } });
    const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20);
    const historyMsgs = history ? history.reverse() : [];

    // GUARDAR MENSAJE DEL CLIENTE EN DB
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });

    let finalSystemPrompt = kernelData?.system_prompt || "";
    let userMessageContent: any = messageText;

    if (isImage && base64) {
        const visionPrompt = configs.find(c => c.key === 'prompt_vision_instrucciones')?.value || "Analiza esta imagen con precisión.";
        finalSystemPrompt += `\n\n=== MÓDULO OJO DE HALCÓN ===\n${visionPrompt}\n\nSi ES un comprobante de pago añade al final: \n---JSON---\n{"payment_status": "VALID"}`;
        userMessageContent = [{ type: "text", text: messageText }, { type: "image_url", image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64}` } }];
    }

    // 4. LLAMADA A LA INTELIGENCIA ARTIFICIAL
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

    if (!aiRes.ok) {
        const errorText = await aiRes.text();
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: `[ERROR DE IA] OpenAI rechazó la solicitud. Revisa la API Key.`, platform: 'ERROR' });
        return new Response("OpenAI Error logged", { status: 200, headers: corsHeaders });
    }

    const aiData = await aiRes.json();
    let rawAnswer = aiData.choices?.[0]?.message?.content || "";
    
    let paymentStatusToUpdate = null;
    let requestHumanToUpdate = false;

    if (rawAnswer.includes('---JSON---')) {
        const parts = rawAnswer.split('---JSON---');
        rawAnswer = parts[0].trim();
        try {
            const parsedJson = JSON.parse(parts[1].trim().replace(/```json/g, '').replace(/```/g, '').trim());
            if (parsedJson.payment_status) paymentStatusToUpdate = parsedJson.payment_status;
            if (parsedJson.request_human) requestHumanToUpdate = true;
        } catch(e) { }
    }

    if (paymentStatusToUpdate) {
        await supabaseClient.from('leads').update({ payment_status: paymentStatusToUpdate }).eq('id', lead.id);
    }

    const mediaRegex = /<<MEDIA:(.*?)>>/i;
    const mediaMatch = rawAnswer.match(mediaRegex);
    const mediaUrl = mediaMatch ? mediaMatch[1].trim() : null;
    let textToSend = rawAnswer.replace(mediaRegex, '').trim();

    if (!textToSend && !mediaUrl) {
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'NOTA', mensaje: `🤖 [Análisis Silencioso IA]: Procesado.`, platform: 'SISTEMA' });
        return new Response(JSON.stringify({ success: true, note: "Silent processing" }), { headers: corsHeaders });
    }

    const messageToLog = mediaUrl ? `[IMG: ${mediaUrl}] ${textToSend}` : textToSend;

    // 5. GUARDADO INDESTRUCTIBLE EN BASE DE DATOS (ANTES DE ENVIAR A WHATSAPP)
    // Esto garantiza que el mensaje SIEMPRE aparezca en el CRM aunque Evolution falle
    const { data: insertedMsg } = await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'IA', 
        mensaje: messageToLog, 
        platform: 'WHATSAPP_AUTO' 
    }).select().single();

    // 6. ENVÍO A WHATSAPP (SI FALLA, ACTUALIZAMOS EL REGISTRO A ERROR)
    if (evoUrl && evoKey) {
        const endpoint = mediaUrl ? evoUrl.replace('sendText', 'sendMedia') : evoUrl;
        const payload = mediaUrl ? {
            number: phone, mediatype: "image", media: mediaUrl, caption: textToSend || "",
            mediaMessage: { mediatype: "image", media: mediaUrl, caption: textToSend || "" }
        } : { number: phone, text: textToSend };

        try {
            const response = await fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoKey }, body: JSON.stringify(payload)
            });
            if (!response.ok && insertedMsg) {
                await supabaseClient.from('conversaciones').update({ platform: 'ERROR_WA', mensaje: `[FALLO ENVÍO WA] ${messageToLog}` }).eq('id', insertedMsg.id);
            }
        } catch (e) {
            if (insertedMsg) await supabaseClient.from('conversaciones').update({ platform: 'ERROR_WA', mensaje: `[FALLO CONEXIÓN WA] ${messageToLog}` }).eq('id', insertedMsg.id);
        }
    }

    // 7. ESCALADO HUMANO
    if (requestHumanToUpdate) {
        await supabaseClient.from('leads').update({ ai_paused: true }).eq('id', lead.id);
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, mensaje: `IA Pausada. Cliente solicitó humano.`, emisor: 'NOTA', platform: 'PANEL_INTERNO' });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})