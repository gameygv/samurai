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

    if (!apiKey) throw new Error("OpenAI API Key no configurada.");

    const body = await req.json();
    const eventName = (body.event || "").toLowerCase();
    
    // Solo procesar mensajes entrantes
    if (eventName !== 'messages.upsert' && eventName !== 'messages_upsert') {
        return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = body.data;
    if (!messageData || messageData.key?.fromMe) return new Response('Ignored');

    const remoteJid = messageData.key?.remoteJid;
    const phone = remoteJid.split('@')[0];
    const senderName = messageData.pushName || "Cliente";
    
    // --- LÓGICA DE AUDIO (WHISPER) ---
    let messageText = "";
    const msgType = Object.keys(messageData.message || {})[0];

    if (msgType === 'conversation') {
        messageText = messageData.message.conversation;
    } else if (msgType === 'extendedTextMessage') {
        messageText = messageData.message.extendedTextMessage.text;
    } else if (msgType === 'audioMessage') {
        console.log(`[Audio Detectado] Procesando nota de voz de ${phone}...`);
        
        // Evolution v2 suele enviar el base64 o una URL si está configurado.
        // Asumimos que Evolution está configurado para guardar media o enviar base64.
        // Si viene base64 directo (común en configs default):
        const mediaBase64 = body.data.message?.audioMessage?.mediaKey; // Nota: Evolution maneja esto distinto según versión.
        // Intentaremos obtener el texto transcribiendo.
        // NOTA: Para simplificar en este entorno, asumimos que Evolution nos da acceso.
        // Si falla, pondremos un fallback.
        
        // Estrategia Robusta: Responder al audio pidiendo texto si no podemos procesarlo, 
        // PERO aquí intentaremos simular la transcripción si la API lo permite, 
        // o marcaremos como [AUDIO RECIBIDO] para que la IA sepa que debe pedir contexto.
        
        // *MEJORA PRO:* Si Evolution manda URL pública, la usamos. Si no, usamos texto placeholder
        // para no romper el flujo hasta tener integración de archivos completa.
        messageText = "[AUDIO DE VOZ RECIBIDO] (La IA responderá asumiendo que el cliente habló. Si no entiende, pedirá aclarar).";
        
        // *TODO:* Implementar descarga de buffer real cuando Evolution provea la URL de descarga directa en el JSON.
    } else {
        messageText = "Mensaje Multimedia (Imagen/Sticker)";
    }

    if (!messageText) return new Response('No text content');

    // 1. GESTIÓN DE LEADS
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ nombre: senderName, telefono: phone, buying_intent: 'BAJO' }).select().single();
        lead = newLead;
    }

    // Guardamos el mensaje (incluso si fue audio, guardamos la etiqueta o transcripción)
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    if (lead.ai_paused) return new Response('AI Paused');

    // 2. CONTEXTO
    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context');
    const { data: historyMsgs } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(20);

    const thread = (historyMsgs || []).map(m => ({
        role: (m.emisor === 'CLIENTE' || m.emisor === 'HUMANO') ? 'user' : 'assistant',
        content: m.mensaje
    }));

    // 3. ANÁLISIS DE DATOS FALTANTES (ALMA DE SAMURAI)
    const missing = [];
    if (!lead.nombre || lead.nombre.includes('Nuevo') || lead.nombre === phone) missing.push("NOMBRE");
    if (!lead.ciudad || lead.ciudad.length < 3) missing.push("CIUDAD");
    
    // Directiva de "Hambre de Datos"
    let dataDirective = "";
    if (missing.length > 0) {
        dataDirective = `
🚨 **PRIORIDAD MÁXIMA: OBTENER DATOS**
Faltan datos en el CRM: [ ${missing.join(', ')} ].
NO respondas preguntas complejas todavía.
Tu respuesta DEBE ser una pregunta amable para obtener estos datos.
*Ejemplo:* "Con gusto te doy los precios. Para ver si aplica promoción en tu zona, ¿me regalas tu nombre y ciudad?"
        `.trim();
    } 

    // 4. LLAMADA A GPT-4o
    const messages = [
        { role: "system", content: `${kernelData?.system_prompt}\n\n${dataDirective}` },
        ...thread
    ];

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: messages,
            temperature: 0.4, // Temperatura baja para precisión
            max_tokens: 800
        })
    });

    const aiData = await aiRes.json();
    const rawAnswer = aiData.choices[0].message.content;

    // 5. PROCESAMIENTO DE MEDIA (IMÁGENES)
    const mediaMatch = rawAnswer.match(/<<MEDIA:(.*?)>>/);
    const textToSend = rawAnswer.replace(/<<MEDIA:.*?>>/, '').trim();
    const mediaUrl = mediaMatch ? mediaMatch[1] : null;

    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    if (evoUrl && evoKey) {
        // Enviar Texto
        if (textToSend) {
            await fetch(evoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: phone, text: textToSend })
            });
        }
        // Enviar Imagen Real
        if (mediaUrl) {
            const mediaEndpoint = evoUrl.replace('sendText', 'sendMedia');
            await fetch(mediaEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({
                    number: phone,
                    mediaMessage: { mediatype: "image", media: mediaUrl, caption: "" },
                    options: { delay: 1500 }
                })
            });
        }

        // Log
        const logMsg = mediaUrl ? `${textToSend} [IMAGEN ENVIADA]` : textToSend;
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: logMsg, platform: 'WHATSAPP_AUTO' });
    }

    // 6. AUTO-ANÁLISIS (DATA MINING)
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id })
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})