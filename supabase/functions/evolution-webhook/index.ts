// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: Búsqueda recursiva de una llave en un objeto JSON profundo
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
    
    // Filtro básico: Solo nos interesan mensajes nuevos
    if (eventName !== 'messages.upsert') {
        return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Extracción agnóstica de datos del mensaje
    // Buscamos 'message' y 'key' donde sea que estén
    const messageData = findValue(body, 'message'); 
    const keyData = findValue(body, 'key');

    if (!messageData || keyData?.fromMe) return new Response('Ignored (Self/NoData)');

    const phone = keyData?.remoteJid?.split('@')[0];
    const msgType = Object.keys(messageData || {})[0];
    
    let messageText = "";

    // --- PROCESAMIENTO INTELIGENTE ---
    
    // 1. Audio (Prioridad Alta)
    if (msgType === 'audioMessage' || findValue(messageData, 'audioMessage')) {
        console.log(`[Audio Detectado] Escaneando payload para ${phone}...`);
        
        // Búsqueda Profunda del Base64
        const foundBase64 = findValue(body, 'base64');
        
        if (foundBase64) {
            try {
                // Limpieza de headers data:image...
                const cleanBase64 = foundBase64.includes(',') ? foundBase64.split(',')[1] : foundBase64;
                
                const formData = new FormData();
                formData.append("model", "whisper-1");
                
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
                messageText = "[ERROR TÉCNICO PROCESANDO AUDIO]";
            }
        } else {
            // Si no hay base64, intentamos con URL si existe
            const foundUrl = findValue(messageData, 'url');
            if (foundUrl) {
               messageText = `[AUDIO URL DETECTADA: ${foundUrl} - Intentando descargar...]`;
               // Aquí se podría implementar descarga por URL, pero base64 es más seguro.
               // Por ahora, avisamos al admin.
            } else {
               messageText = "[AUDIO SIN DATOS - Evolution no envió base64]";
            }
        }
    } 
    // 2. Texto
    else if (msgType === 'conversation') {
        messageText = messageData.conversation;
    } else if (msgType === 'extendedTextMessage') {
        messageText = messageData.extendedTextMessage.text;
    } else {
        // Búsqueda de texto en cualquier parte profunda (ej: caption de imagen)
        const deepText = findValue(messageData, 'text') || findValue(messageData, 'caption') || findValue(messageData, 'conversation');
        messageText = deepText || "[ARCHIVO MULTIMEDIA / DESCONOCIDO]";
    }

    if (!messageText || messageText.includes('DESCONOCIDO')) return new Response('No valid content');

    // --- LOGICA DB ---
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
        let sent = false;
        
        // Intento 1: Media
        if (mediaUrl) {
            try {
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
                sent = true;
                textToSend = ""; // Ya se fue como caption
            } catch (e) {
                console.error("Fallo envío media, fallback a texto");
            }
        }

        // Intento 2: Texto (Si no hubo media o falló)
        if (textToSend) {
            await fetch(evoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: phone, text: textToSend, delay: 1200 })
            });
        }

        const logMsg = mediaUrl ? `[IMG: ${mediaUrl}] ${rawAnswer}` : rawAnswer;
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: logMsg, platform: 'WHATSAPP_AUTO' });
    }

    return new Response(JSON.stringify({ success: true }));

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})