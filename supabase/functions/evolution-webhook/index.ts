// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const apiKey = configs.find(c => c.key === 'openai_api_key')?.value;
    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    if (!apiKey) throw new Error("Falta OpenAI API Key");

    const body = await req.json();
    
    // VALIDACIÓN DE EVENTO (Compatible con "Webhook by Events" ON y OFF)
    // Evolution v2 a veces manda el evento en el body, a veces en el path. Revisamos el body.
    const eventType = body.event || body.type;
    if (eventType !== 'messages.upsert') {
        return new Response(JSON.stringify({ ignored: true, reason: 'Not an upsert' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = body.data;
    if (!messageData || messageData.key?.fromMe) return new Response('Ignored (Self)');

    const phone = messageData.key?.remoteJid?.split('@')[0];
    const msgType = Object.keys(messageData.message || {})[0];
    let messageText = "";

    // --- 1. PROCESAMIENTO DE MENSAJE (AUDIO FIX) ---
    if (msgType === 'audioMessage') {
        // BUSCA-TESORO: Encontrar el base64 donde sea que esté
        let audioBase64 = body.data.base64 || 
                          messageData.message.audioMessage.base64 || 
                          null;
        
        const audioUrl = messageData.message.audioMessage.url;

        if (audioBase64) {
            try {
                // Limpiar header si existe (data:audio/ogg;base64,...)
                const cleanBase64 = audioBase64.replace(/^data:.*;base64,/, "");
                
                const formData = new FormData();
                formData.append("model", "whisper-1");
                
                // Convertir Base64 a Blob
                const binaryString = atob(cleanBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'audio/ogg' });
                formData.append("file", blob, "audio.ogg");

                const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${apiKey}` },
                    body: formData
                });
                
                const whisperData = await whisperRes.json();
                
                if (whisperData.text) {
                    messageText = `[TRANSCRIPCIÓN AUDIO]: "${whisperData.text}"`;
                } else {
                    console.error("Whisper Error:", whisperData);
                    messageText = "[AUDIO INDESCIFRABLE - PIDE TEXTO]";
                }
            } catch (e) {
                console.error("Audio Processing Error:", e);
                messageText = "[ERROR PROCESANDO AUDIO - PIDE TEXTO]";
            }
        } else {
            messageText = "[AUDIO SIN DATOS - REVISAR CONFIG EVOLUTION]";
        }
    } 
    else if (msgType === 'conversation') {
        messageText = messageData.message.conversation;
    } 
    else if (msgType === 'extendedTextMessage') {
        messageText = messageData.message.extendedTextMessage.text;
    }

    if (!messageText) return new Response('No valid content');

    // --- 2. GESTIÓN DE LEADS ---
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

    // --- 3. CEREBRO IA ---
    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context');
    const { data: historyMsgs } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(15);

    const messages = [
        { role: "system", content: kernelData?.system_prompt },
        ...(historyMsgs || []).map(m => ({
            role: (m.emisor === 'CLIENTE' || m.emisor === 'HUMANO') ? 'user' : 'assistant',
            content: m.mensaje
        }))
    ];

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: messages,
            temperature: 0.3
        })
    });

    const aiData = await aiRes.json();
    const rawAnswer = aiData.choices?.[0]?.message?.content || "";

    // --- 4. ENVÍO (EVOLUTION API FIX) ---
    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const mediaMatch = rawAnswer.match(mediaRegex);
    let textToSend = rawAnswer.replace(mediaRegex, '').trim();
    const mediaUrl = mediaMatch ? mediaMatch[1] : null;

    if (evoUrl && evoKey) {
        try {
            // Lógica de URL base
            // Si la URL termina en /message/sendText/instance, cortamos para tener la base
            let baseUrl = evoUrl;
            if (evoUrl.includes('/message/sendText')) {
                baseUrl = evoUrl.split('/message/sendText')[0]; 
            }
            // Aseguramos que baseUrl no tenga slash final para evitar dobles //
            baseUrl = baseUrl.replace(/\/$/, "");
            
            // Asumimos que la instancia está en la URL original config o necesitamos extraerla?
            // Generalmente evoUrl en config es COMPLETA: http://host/message/sendText/instance
            // Vamos a usar replace simple que es más seguro si el usuario copió la URL completa
            
            if (mediaUrl) {
                const sendMediaUrl = evoUrl.replace('sendText', 'sendMedia');
                
                // Estructura PLANA para v2 (sin anidar en mediaMessage)
                const payload = {
                    number: phone,
                    media: mediaUrl,
                    mediatype: "image",
                    caption: textToSend,
                    delay: 1000
                };

                const mediaRes = await fetch(sendMediaUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                    body: JSON.stringify(payload)
                });

                if (!mediaRes.ok) {
                    console.error("Media Send Failed, Fallback to Text", await mediaRes.text());
                    // Fallback: enviar texto con link
                    textToSend = `${textToSend}\n\n(Ver imagen: ${mediaUrl})`;
                    await fetch(evoUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                        body: JSON.stringify({ number: phone, text: textToSend })
                    });
                }
            } else {
                await fetch(evoUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                    body: JSON.stringify({ number: phone, text: textToSend, delay: 1000 })
                });
            }

            // Log Éxito
            const logMsg = mediaUrl ? `[IMG: ${mediaUrl}] ${rawAnswer.replace(mediaRegex, '')}` : textToSend;
            await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: logMsg, platform: 'WHATSAPP_AUTO' });

        } catch (sendErr) {
            console.error("Evolution Send Error:", sendErr);
            // Log Error Crítico
            await supabaseClient.from('activity_logs').insert({
                action: 'ERROR',
                resource: 'SYSTEM',
                description: `Fallo envío a ${phone}: ${sendErr.message}`,
                status: 'ERROR'
            });
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    // Catch general para que no explote el webhook
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    await supabaseClient.from('activity_logs').insert({
        action: 'ERROR',
        resource: 'SYSTEM',
        description: `Webhook Crash: ${error.message}`,
        status: 'ERROR'
    });
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})