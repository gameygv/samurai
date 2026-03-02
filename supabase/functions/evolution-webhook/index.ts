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
    
    // Filtro estricto de eventos
    if (eventName !== 'messages.upsert') {
        return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = body.data;
    if (!messageData || messageData.key?.fromMe) return new Response('Ignored (Self)');

    const remoteJid = messageData.key?.remoteJid;
    const phone = remoteJid.split('@')[0];
    const senderName = messageData.pushName || "Cliente";
    
    // --- LÓGICA DE PROCESAMIENTO DE MENSAJE ---
    let messageText = "";
    const msgType = Object.keys(messageData.message || {})[0];

    // 1. TEXTO NORMAL
    if (msgType === 'conversation') {
        messageText = messageData.message.conversation;
    } else if (msgType === 'extendedTextMessage') {
        messageText = messageData.message.extendedTextMessage.text;
    } 
    // 2. AUDIO (WHISPER INTEGRATION)
    else if (msgType === 'audioMessage') {
        console.log(`[Audio Detectado] Iniciando transcripción para ${phone}...`);
        
        // Intentar obtener base64 o URL. Evolution v2 suele enviar base64 si está configurado "includeBase64OnData".
        // Si no, necesitamos hacer fetch al messageId. Por simplicidad en Edge, asumimos base64 presente o url.
        // NOTA: Para producción robusta, Evolution debe tener "includeBase64OnData: true" en settings.
        
        const audioBase64 = messageData.message.audioMessage?.url ? null : body.data.base64; // Fallback logic depending on version
        // Nota: Evolution a veces manda la URL de descarga directa en message.audioMessage.url
        const audioUrl = messageData.message.audioMessage?.url;

        if (audioUrl || audioBase64) {
             try {
                // Preparar archivo para Whisper
                const formData = new FormData();
                formData.append("model", "whisper-1");
                
                let blob;
                if (audioUrl) {
                    const audioRes = await fetch(audioUrl);
                    blob = await audioRes.blob();
                } else if (audioBase64) {
                    // Convert base64 to blob logic here (simplified for brevity, focusing on URL which is standard)
                    const binary = atob(audioBase64);
                    const array = [];
                    for(let i = 0; i < binary.length; i++) array.push(binary.charCodeAt(i));
                    blob = new Blob([new Uint8Array(array)], { type: 'audio/ogg' });
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
                        console.log(`[Whisper Success]: ${messageText}`);
                    } else {
                        throw new Error("Whisper no devolvió texto.");
                    }
                }
             } catch (err) {
                 console.error("Whisper Error:", err);
                 messageText = "[AUDIO RECIBIDO - NO PUDE ESCUCHARLO POR ERROR TÉCNICO]";
             }
        } else {
             messageText = "[AUDIO RECIBIDO - SIN DATOS]";
        }
    } else {
        messageText = "[ARCHIVO MULTIMEDIA / STICKER]";
    }

    if (!messageText) return new Response('No content');

    // --- GESTIÓN DE LEADS ---
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ 
            nombre: `Nuevo Lead ${phone.slice(-4)}`, // Nombre temporal para forzar al bot a preguntar
            telefono: phone, 
            buying_intent: 'BAJO' 
        }).select().single();
        lead = newLead;
    }

    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
    if (lead.ai_paused) return new Response('AI Paused');

    // --- GENERACIÓN DE RESPUESTA (CEREBRO) ---
    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context');
    const { data: historyMsgs } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(20);

    // Inyectar datos faltantes en el prompt del sistema dinámicamente
    let dynamicInstruction = "";
    if (lead.nombre.includes('Nuevo Lead')) dynamicInstruction += "\n[ALERTA]: NO TIENES EL NOMBRE DEL CLIENTE. PÍDELO ANTES DE NADA.";
    if (!lead.ciudad) dynamicInstruction += "\n[ALERTA]: FALTA LA CIUDAD. PÍDELA PARA SABER QUÉ POSTER ENVIAR.";

    const messages = [
        { role: "system", content: `${kernelData?.system_prompt}\n${dynamicInstruction}` },
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
            temperature: 0.3, // Creatividad baja para seguir reglas
            max_tokens: 600
        })
    });

    const aiData = await aiRes.json();
    const rawAnswer = aiData.choices?.[0]?.message?.content || "";

    // --- ENVÍO DE RESPUESTA (MANOS) ---
    // Extraer etiqueta de media: <<MEDIA:http://...>>
    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const mediaMatch = rawAnswer.match(mediaRegex);
    
    let textToSend = rawAnswer.replace(mediaRegex, '').trim(); // Quitamos la etiqueta del texto visible
    const mediaUrl = mediaMatch ? mediaMatch[1] : null;

    if (evoUrl && evoKey) {
        // 1. Si hay imagen, la enviamos PRIMERO (Impacto visual)
        if (mediaUrl && mediaUrl.startsWith('http')) {
            console.log(`[Evolution] Enviando imagen: ${mediaUrl}`);
            const mediaEndpoint = evoUrl.replace('/sendText', '/sendMedia').replace('/sendMedia', '/sendMedia'); // Asegurar endpoint correcto (v2 style)
            // Fix para endpoint v2: suele ser /message/sendMedia/instance
            // Como no sabemos la estructura exacta de la URL del usuario, asumimos que 'sendText' es la base.
            
            // Construcción robusta de URL
            let sendMediaUrl = evoUrl; 
            if(evoUrl.includes('sendText')) sendMediaUrl = evoUrl.replace('sendText', 'sendMedia');

            await fetch(sendMediaUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({
                    number: phone,
                    mediaMessage: { mediatype: "image", media: mediaUrl, caption: textToSend } // Caption con el texto
                })
            });
            
            // Si mandamos caption, no mandamos texto separado.
            textToSend = ""; 
        } 
        
        // 2. Si queda texto (o no hubo imagen), lo enviamos
        if (textToSend) {
            await fetch(evoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: phone, text: textToSend, delay: 1200 })
            });
        }

        // Log
        const logMsg = mediaUrl ? `[IMG: ${mediaUrl}] ${rawAnswer}` : rawAnswer;
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: logMsg, platform: 'WHATSAPP_AUTO' });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})