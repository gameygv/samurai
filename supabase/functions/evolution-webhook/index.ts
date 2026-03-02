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

    const body = await req.json();
    const eventName = (body.event || "").toLowerCase();
    
    if (eventName !== 'messages.upsert' && eventName !== 'messages_upsert') {
        return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = body.data;
    if (!messageData || messageData.key?.fromMe) return new Response('Ignored');

    const remoteJid = messageData.key?.remoteJid;
    const phone = remoteJid.split('@')[0];
    const messageText = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || "Mensaje multimedia";
    const senderName = messageData.pushName || "Cliente";

    // 1. GESTIÓN DE LEADS
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ nombre: senderName, telefono: phone, buying_intent: 'BAJO' }).select().single();
        lead = newLead;
    }

    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    if (lead.ai_paused) return new Response('AI Paused');

    // 2. CONTEXTO
    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context');
    const { data: historyMsgs } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(15);

    const thread = (historyMsgs || []).map(m => ({
        role: (m.emisor === 'CLIENTE' || m.emisor === 'HUMANO') ? 'user' : 'assistant',
        content: m.mensaje
    }));

    const missing = [];
    if (!lead.nombre || lead.nombre.includes('Nuevo') || lead.nombre === phone) missing.push("NOMBRE");
    if (!lead.ciudad || lead.ciudad.length < 3) missing.push("CIUDAD");
    if (!lead.email || lead.email.length < 5) missing.push("EMAIL");

    let dataDirective = "";
    if (missing.length > 0) {
        dataDirective = `[ALERTA SISTEMA: FALTAN DATOS: ${missing.join(', ')}. Tu prioridad es obtenerlos antes de dar el bloque grande de info. Si ya los dio en este último mensaje, ignora esta alerta.]`;
    }

    // 3. LLAMADA A OPENAI (TOKENS AUMENTADOS)
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const apiKey = configs.find(c => c.key === 'openai_api_key')?.value;
    
    if (!apiKey) throw new Error("OpenAI API Key faltante.");

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: `${kernelData?.system_prompt}\n\n${dataDirective}` }, ...thread],
            temperature: 0.6,
            max_tokens: 800 // AUMENTADO PARA EVITAR CORTES
        })
    });

    const aiData = await aiRes.json();
    const rawAnswer = aiData.choices[0].message.content;

    // 4. PROCESAMIENTO DE MEDIA (IMÁGENES)
    // Buscamos la etiqueta <<MEDIA:url>>
    const mediaMatch = rawAnswer.match(/<<MEDIA:(.*?)>>/);
    const textToSend = rawAnswer.replace(/<<MEDIA:.*?>>/, '').trim();
    const mediaUrl = mediaMatch ? mediaMatch[1] : null;

    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    if (evoUrl && evoKey) {
        // A. Enviar Texto Limpio
        if (textToSend) {
            await fetch(evoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: phone, text: textToSend })
            });
        }

        // B. Enviar Imagen (Si existe)
        if (mediaUrl) {
            // Nota: Evolution tiene endpoints dedicados para media. Usamos /message/sendMedia
            // Si la URL base es .../message/sendText/instance, ajustamos a .../message/sendMedia/instance
            const mediaEndpoint = evoUrl.replace('sendText', 'sendMedia');
            
            await fetch(mediaEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({
                    number: phone,
                    mediaMessage: {
                        mediatype: "image",
                        media: mediaUrl,
                        caption: "" // Opcional, ya mandamos el texto antes
                    },
                    options: { delay: 1000 } // Pequeño delay para que lleguen en orden
                })
            });
        }

        // 5. GUARDAR EN DB
        // Guardamos el texto completo para que el historial tenga sentido (incluyendo la referencia de que se mandó media)
        const logMsg = mediaUrl ? `${textToSend} [IMAGEN ENVIADA]` : textToSend;
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: logMsg, platform: 'WHATSAPP_AUTO' });
    }

    // 6. AUTO-ANÁLISIS
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