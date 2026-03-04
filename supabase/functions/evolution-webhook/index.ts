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

function findMessageObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.key && obj.message) return obj; 
    for (const key in obj) {
        const found = findMessageObject(obj[key]);
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

    if (!apiKey) throw new Error("Falta OpenAI API Key");

    const body = await req.json();
    const eventName = (body.event || body.type || "").toLowerCase();
    
    if (eventName !== 'messages.upsert') {
        return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = findValue(body, 'message'); 
    const fromMe = findValue(body, 'fromMe') || body.data?.key?.fromMe;
    if (!messageData || fromMe) return new Response('Ignored (Self/NoData)');

    const phone = findValue(body, 'remoteJid')?.split('@')[0];
    let messageText = "";

    const audioObj = findValue(messageData, 'audioMessage');
    
    if (audioObj) {
        console.log(`[Audio] Detectado para ${phone}.`);
        let audioBase64 = findValue(body, 'base64');
        let debugStatus = "INIT";

        if (!audioBase64) {
            if (evoUrl && evoKey) {
                try {
                    let getBase64Url = evoUrl.replace('message/sendText', 'chat/getBase64FromMediaMessage');
                    const msgObjectForApi = findMessageObject(body);

                    if (msgObjectForApi) {
                        const res = await fetch(getBase64Url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                            body: JSON.stringify({ message: msgObjectForApi, convertToMp4: false })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            audioBase64 = data.base64;
                            debugStatus = "RECOVERED_VIA_API";
                        } else {
                            debugStatus = `API_ERROR_${res.status}`;
                        }
                    }
                } catch (err) { debugStatus = `NETWORK_ERROR`; }
            }
        }

        if (audioBase64) {
            try {
                const cleanBase64 = audioBase64.replace(/^data:.*;base64,/, "");
                const binaryString = atob(cleanBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                const blob = new Blob([bytes], { type: 'audio/ogg' });
                
                const formData = new FormData();
                formData.append("model", "whisper-1");
                formData.append("file", blob, "audio.ogg");

                const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${apiKey}` },
                    body: formData
                });
                const whisperData = await whisperRes.json();
                
                if (whisperData.text) messageText = `[TRANSCRIPCIÓN AUDIO]: "${whisperData.text}"`;
                else messageText = `[AUDIO ININTELIGIBLE]`;
            } catch (e) { messageText = `[ERROR PROCESANDO AUDIO]`; }
        } else {
            messageText = `[AUDIO FALLIDO - Diagnóstico: ${debugStatus}]`;
        }
    } else {
        messageText = findValue(messageData, 'conversation') || findValue(messageData, 'text') || findValue(messageData, 'caption') || "[MULTIMEDIA]";
    }

    if (!messageText || messageText.includes('MULTIMEDIA')) return new Response('No valid content');

    // LOGICA DB
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ 
            nombre: `Nuevo Lead ${phone.slice(-4)}`,
            telefono: phone, 
            buying_intent: 'BAJO' 
        }).select().single();
        lead = newLead;
    }

    if (lead.ai_paused) return new Response('AI Paused');

    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context', {
        body: { lead: lead }
    });
    
    // INCREMENTAMOS LA MEMORIA A 40 MENSAJES PARA EVITAR AMNESIA
    const { data: historyMsgsRaw } = await supabaseClient.from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(40);

    const historyMsgs = historyMsgsRaw ? historyMsgsRaw.reverse() : [];

    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });

    const validName = lead.nombre && !lead.nombre.includes('Nuevo Lead') ? lead.nombre : 'NO_PROPORCIONADO_AUN';
    const validCity = lead.ciudad ? lead.ciudad : 'NO_PROPORCIONADA_AUN';
    const validEmail = lead.email ? lead.email : 'NO_PROPORCIONADO_AUN';

    // REGLA ESTRICTA ANTI-AMNESIA Y ANTI-BOT INYECTADA EN EL CORE DEL WEBHOOK
    const dynamicSystemPrompt = `
${kernelData?.system_prompt}

--- EXTREMADAMENTE IMPORTANTE: MEMORIA Y CONCIENCIA ---
1. Tienes acceso total al historial de esta conversación (los mensajes anteriores están justo abajo). NUNCA digas "no tengo registros", "no recuerdo" o "no tengo acceso a conversaciones previas". Lee el contexto y fluye de forma continua.
2. ERES PARTE DEL EQUIPO. Nunca digas "soy un bot", "soy una inteligencia artificial" o "no soy humano". Eres Sam, el asistente digital oficial de The Elephant Bowl.
3. Datos ya obtenidos (NO los vuelvas a pedir si ya tienen un valor real):
- NOMBRE DEL CLIENTE: ${validName}
- CIUDAD: ${validCity}
- EMAIL: ${validEmail}
----------------------------------------------------------------`;

    const messages = [
        { role: "system", content: dynamicSystemPrompt },
        ...(historyMsgs || []).map(m => ({
            role: (m.emisor === 'CLIENTE' || m.emisor === 'HUMANO') ? 'user' : 'assistant',
            content: m.mensaje
        })),
        { role: "user", content: messageText } 
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

    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const mediaMatch = rawAnswer.match(mediaRegex);
    let textToSend = rawAnswer.replace(mediaRegex, '').trim();
    const mediaUrl = mediaMatch ? mediaMatch[1] : null;

    if (evoUrl && evoKey) {
        try {
            if (mediaUrl) {
                // ESTRUCTURA CORREGIDA PARA EVOLUTION API V1/V2
                let sendMediaUrl = evoUrl.replace('message/sendText', 'message/sendMedia');
                if (sendMediaUrl === evoUrl) sendMediaUrl = evoUrl.replace('sendText', 'sendMedia'); // Fallback manual
                
                await fetch(sendMediaUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                    body: JSON.stringify({ 
                        number: phone, 
                        options: { delay: 1500, presence: 'composing' },
                        mediaMessage: {
                            mediatype: "image", 
                            media: mediaUrl, 
                            caption: textToSend 
                        }
                    })
                });
            } else {
                await fetch(evoUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                    body: JSON.stringify({ 
                        number: phone, 
                        options: { delay: 1500, presence: 'composing' },
                        textMessage: { text: textToSend } 
                    })
                });
            }
            const logMsg = mediaUrl ? `[IMG: ${mediaUrl}] ${rawAnswer}` : rawAnswer;
            await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: logMsg, platform: 'WHATSAPP_AUTO' });
        } catch (sendErr) { console.error("Send Error:", sendErr); }
    }

    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id })
    }).catch(err => console.error("Analytics Trigger Error", err));

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})