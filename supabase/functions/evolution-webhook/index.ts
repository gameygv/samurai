// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    
    const apiKey = configs.find(c => c.key === 'openai_api_key')?.value;
    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    if (!apiKey) throw new Error("OpenAI API Key no configurada.");

    const body = await req.json();
    const eventName = (body.event || "").toLowerCase();
    
    if (eventName !== 'messages.upsert') return new Response('Ignored');

    const messageData = body.data;
    if (!messageData || messageData.key?.fromMe) return new Response('Ignored (Self)');

    const remoteJid = messageData.key?.remoteJid;
    const phone = remoteJid.split('@')[0];
    
    // --- PROCESAR MENSAJE ENTRANTE ---
    let messageText = "";
    const msgType = Object.keys(messageData.message || {})[0];

    if (msgType === 'conversation') {
        messageText = messageData.message.conversation;
    } else if (msgType === 'extendedTextMessage') {
        messageText = messageData.message.extendedTextMessage.text;
    } else if (msgType === 'audioMessage') {
        // Evolution suele enviar el base64 directamente en body.data.base64 si está configurado
        const audioBase64 = body.data.base64;
        if (audioBase64) {
            try {
                const formData = new FormData();
                formData.append("model", "whisper-1");
                const binary = atob(audioBase64);
                const array = [];
                for(let i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
                const blob = new Blob([new Uint8Array(array)], { type: 'audio/ogg' });
                formData.append("file", blob, "audio.ogg");

                const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${apiKey}` },
                    body: formData
                });
                const whisperData = await whisperRes.json();
                messageText = whisperData.text ? `[TRANSCRIPCIÓN AUDIO]: "${whisperData.text}"` : "[AUDIO VACÍO]";
            } catch (e) {
                messageText = "[AUDIO RECIBIDO - ERROR AL TRANSCRIBIR]";
            }
        } else {
            messageText = "[AUDIO RECIBIDO - ACTIVA 'BASE64 ON DATA' EN EVOLUTION]";
        }
    }

    if (!messageText) return new Response('No content');

    // --- LOGICA DE BASE DE DATOS ---
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ 
            nombre: `Nuevo Lead ${phone.slice(-4)}`,
            telefono: phone, 
            buying_intent: 'BAJO' 
        }).select().single();
        lead = newLead;
    }

    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
    if (lead.ai_paused) return new Response('AI Paused');

    // --- GENERACIÓN DE RESPUESTA ---
    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context');
    const { data: historyMsgs } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(15);

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: kernelData?.system_prompt },
                ...(historyMsgs || []).map(m => ({
                    role: (m.emisor === 'CLIENTE' || m.emisor === 'HUMANO') ? 'user' : 'assistant',
                    content: m.mensaje
                }))
            ],
            temperature: 0.2
        })
    });

    const aiData = await aiRes.json();
    const rawAnswer = aiData.choices?.[0]?.message?.content || "";

    // --- ENVÍO A WHATSAPP (FIX EVOLUTION V2) ---
    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const mediaMatch = rawAnswer.match(mediaRegex);
    const mediaUrl = mediaMatch ? mediaMatch[1] : null;
    let finalMsg = rawAnswer.replace(mediaRegex, '').trim();

    if (evoUrl && evoKey) {
        // 1. Si hay imagen, usamos endpoint sendMedia (Estructura Plana v2)
        if (mediaUrl) {
            const sendMediaUrl = evoUrl.replace('sendText', 'sendMedia');
            const mediaRes = await fetch(sendMediaUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({
                    number: phone,
                    mediatype: "image",
                    media: mediaUrl,
                    caption: finalMsg,
                    delay: 1200
                })
            });
            
            // Si el envío de media falla, intentamos enviar solo el texto como respaldo
            if (!mediaRes.ok) {
               await fetch(evoUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                  body: JSON.stringify({ number: phone, text: finalMsg })
               });
            }
        } else {
            // 2. Solo texto
            await fetch(evoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: phone, text: finalMsg, delay: 1000 })
            });
        }

        // Guardar en log local
        const logMsg = mediaUrl ? `[IMG: ${mediaUrl}] ${rawAnswer}` : rawAnswer;
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: logMsg, platform: 'WHATSAPP_AUTO' });
    }

    return new Response(JSON.stringify({ success: true }));

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})