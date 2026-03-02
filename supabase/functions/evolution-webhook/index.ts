// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: Búsqueda recursiva
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

    if (!apiKey) throw new Error("Falta OpenAI API Key");

    const body = await req.json();
    const eventName = (body.event || body.type || "").toLowerCase();
    
    if (eventName !== 'messages.upsert') {
        return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = findValue(body, 'message'); 
    
    // Ignorar mensajes propios
    const fromMe = findValue(body, 'fromMe') || body.data?.key?.fromMe;
    if (!messageData || fromMe) return new Response('Ignored (Self/NoData)');

    const phone = findValue(body, 'remoteJid')?.split('@')[0];
    let messageText = "";

    // --- PROCESAMIENTO INTELIGENTE ---
    
    // Detectar si es Audio
    const audioObj = findValue(messageData, 'audioMessage');
    
    if (audioObj) {
        console.log(`[Audio] Procesando para ${phone}...`);
        
        // 1. Intentar Base64
        let audioBase64 = findValue(body, 'base64');
        // 2. Intentar URL
        const audioUrl = findValue(audioObj, 'url');

        try {
            const formData = new FormData();
            formData.append("model", "whisper-1");
            let blob;

            if (audioBase64) {
                console.log("[Audio] Usando Base64...");
                const cleanBase64 = audioBase64.replace(/^data:.*;base64,/, "");
                const binaryString = atob(cleanBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                blob = new Blob([bytes], { type: 'audio/ogg' });
            } 
            else if (audioUrl) {
                console.log(`[Audio] Descargando desde URL: ${audioUrl}`);
                const audioRes = await fetch(audioUrl, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (compatible; SamuraiBot/1.0)',
                        'Accept': '*/*'
                    }
                });
                
                if (!audioRes.ok) throw new Error(`Fallo descarga audio: ${audioRes.status}`);
                blob = await audioRes.blob();
            }

            if (blob) {
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
                    console.error("Whisper Fail:", whisperData);
                    messageText = "[AUDIO SIN INTELIGIBILIDAD]";
                }
            } else {
                messageText = "[AUDIO SIN DATOS - Falló Base64 y URL]";
            }
        } catch (e) {
            console.error("Audio Error:", e);
            messageText = `[ERROR AUDIO: ${e.message}]`;
        }
    } 
    // Texto Normal
    else {
        messageText = findValue(messageData, 'conversation') || 
                      findValue(messageData, 'text') || 
                      findValue(messageData, 'caption') ||
                      "[MULTIMEDIA/STICKER]";
    }

    if (!messageText || messageText.includes('MULTIMEDIA')) return new Response('No valid content');

    // --- LOGICA DB (LEAD) ---
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

    // --- CEREBRO IA ---
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
            temperature: 0.3
        })
    });

    const aiData = await aiRes.json();
    const rawAnswer = aiData.choices?.[0]?.message?.content || "";

    // --- ENVÍO (ROBUSTO) ---
    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const mediaMatch = rawAnswer.match(mediaRegex);
    let textToSend = rawAnswer.replace(mediaRegex, '').trim();
    const mediaUrl = mediaMatch ? mediaMatch[1] : null;

    if (evoUrl && evoKey) {
        try {
            if (mediaUrl) {
                // Intento enviar imagen
                let sendMediaUrl = evoUrl;
                if(evoUrl.includes('sendText')) sendMediaUrl = evoUrl.replace('sendText', 'sendMedia');
                
                await fetch(sendMediaUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                    body: JSON.stringify({
                        number: phone,
                        mediatype: "image",
                        media: mediaUrl,
                        caption: textToSend,
                        delay: 1000
                    })
                });
            } else {
                // Intento enviar texto
                await fetch(evoUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                    body: JSON.stringify({ number: phone, text: textToSend, delay: 1000 })
                });
            }

            const logMsg = mediaUrl ? `[IMG: ${mediaUrl}] ${rawAnswer}` : rawAnswer;
            await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: logMsg, platform: 'WHATSAPP_AUTO' });

        } catch (sendErr) {
            console.error("Evolution Send Error:", sendErr);
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})