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

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const body = await req.json();
    const eventName = (body.event || body.type || "").toLowerCase();
    
    if (eventName !== 'messages.upsert') {
      return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });
    }

    const messageData = findValue(body, 'message'); 
    const fromMe = findValue(body, 'fromMe') || findValue(body.data?.key, 'fromMe');
    if (!messageData) return new Response('No message data');

    const phone = findValue(body, 'remoteJid')?.split('@')[0] || findValue(body.data?.key, 'remoteJid')?.split('@')[0];
    if (!phone || phone.includes('status')) return new Response('No phone');

    let messageText = findValue(messageData, 'conversation') || findValue(messageData, 'text') || findValue(messageData, 'caption') || "";

    // OBTENER O CREAR LEAD
    let { data: lead } = await supabase.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabase.from('leads').insert({ 
            nombre: `Nuevo Lead ${phone.slice(-4)}`, telefono: phone, buying_intent: 'BAJO', payment_status: 'NONE'
        }).select().single();
        lead = newLead;
    }

    // MENSAJES SALIENTES (fromMe = agente humano desde el celular)
    if (fromMe) {
        if (!messageText) return new Response('Empty fromMe');
        // Verificar eco de IA (últimos 10 segundos)
        const { data: recentAI } = await supabase.from('conversaciones')
            .select('id').eq('lead_id', lead.id).eq('emisor', 'IA')
            .gte('created_at', new Date(Date.now() - 10000).toISOString())
            .ilike('mensaje', `%${messageText.substring(0, 20)}%`)
            .limit(1);
        if (recentAI && recentAI.length > 0) return new Response('AI Echo ignored');

        await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'HUMANO', mensaje: messageText, platform: 'WHATSAPP_MANUAL' });
        if (messageText.includes('#STOP')) await supabase.from('leads').update({ ai_paused: true }).eq('id', lead.id);
        if (messageText.includes('#START')) await supabase.from('leads').update({ ai_paused: false }).eq('id', lead.id);
        return new Response('Agent message saved');
    }

    // MENSAJES ENTRANTES DEL CLIENTE
    let isAudio = !!findValue(messageData, 'audioMessage');
    let isImage = !!findValue(messageData, 'imageMessage');
    let mimeType = findValue(messageData, 'mimetype') || null;
    let base64 = findValue(body, 'base64');

    const { data: configs } = await supabase.from('app_config').select('key, value');
    const getConf = (k: string) => configs?.find(c => c.key === k)?.value || '';
    const apiKey = getConf('openai_api_key');
    const evoUrl = getConf('evolution_api_url');
    const evoKey = getConf('evolution_api_key');

    if (!base64 && (isAudio || isImage) && evoUrl && evoKey) {
        try {
            const urlObj = new URL(evoUrl);
            const getMediaUrl = `${urlObj.origin}/chat/getBase64FromMediaMessage/${body.instance || urlObj.pathname.split('/').pop()}`;
            const mediaRes = await fetch(getMediaUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoKey }, body: JSON.stringify({ message: body.data || body }) });
            if (mediaRes.ok) base64 = (await mediaRes.json()).base64;
        } catch (e) {}
    }

    let bytes = null;
    if (base64) {
        try {
            const binary = atob(base64);
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } catch(e) {}
    }

    if (isAudio && bytes && apiKey) {
        try {
            const blob = new Blob([bytes], { type: mimeType?.split(';')[0] || 'audio/ogg' });
            const formData = new FormData();
            formData.append('file', blob, 'audio.ogg');
            formData.append('model', 'whisper-1');
            const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}` }, body: formData });
            messageText = whisperRes.ok ? `[TRANSCRIPCIÓN AUDIO]: "${(await whisperRes.json()).text}"` : '[AUDIO NO RECONOCIDO]';
        } catch (e) { messageText = '[AUDIO NO RECONOCIDO]'; }
    }

    if (isImage && !messageText) messageText = "[IMAGEN RECIBIDA]";
    if (!messageText && !isImage) return new Response('No content');

    // GUARDAR MENSAJE DEL CLIENTE INMEDIATAMENTE
    await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
    await supabase.from('leads').update({ last_message_at: new Date().toISOString(), followup_stage: 0 }).eq('id', lead.id);

    if (lead.ai_paused) return new Response('AI paused - client message saved');
    if (!apiKey) {
        await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: '[ERROR: OpenAI API Key no configurada en Ajustes]', platform: 'ERROR' });
        return new Response('No API key');
    }

    // CONSTRUIR CONTEXTO DIRECTAMENTE (sin invocar otra función para evitar timeouts)
    const { data: mediaAssets } = await supabase.from('media_assets').select('title, url, ai_instructions, ocr_content, category').eq('category', 'POSTER');
    const { data: webPages } = await supabase.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const { data: kbDocs } = await supabase.from('knowledge_documents').select('title, category, content, description');

    const pAlma = getConf('prompt_alma_samurai');
    const pAdn = getConf('prompt_adn_core');
    const pEstrategia = getConf('prompt_estrategia_cierre');
    const pRelearning = getConf('prompt_relearning');
    const bankInfo = `Banco: ${getConf('bank_name')}\nCuenta: ${getConf('bank_account')}\nCLABE: ${getConf('bank_clabe')}\nTitular: ${getConf('bank_holder')}`;

    let wcUrl = getConf('wc_url') || 'https://tutienda.com';
    let checkoutPath = getConf('wc_checkout_path') || '/checkout/';
    let products = [];
    try { products = JSON.parse(getConf('wc_products') || '[]'); } catch(e) {}

    let leadParams = '';
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) {
        const names = lead.nombre.trim().split(' ');
        leadParams += `&wffn_billing_first_name=${encodeURIComponent(names[0])}`;
        if (names.length > 1) leadParams += `&wffn_billing_last_name=${encodeURIComponent(names.slice(1).join(' '))}`;
    }
    if (lead.email) leadParams += `&wffn_billing_email=${encodeURIComponent(lead.email)}`;
    if (lead.telefono) leadParams += `&wffn_billing_phone=${encodeURIComponent(lead.telefono)}`;

    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const path = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;

    let catalogContext = '\n=== CATÁLOGO DE PRODUCTOS ===\n';
    products.forEach((p: any) => {
        catalogContext += `[PRODUCTO]: ${p.title} ($${p.price})\n[LINK]: ${baseUrl}${path}?add-to-cart=${p.wc_id}${leadParams}\n[CUÁNDO]: ${p.prompt}\n\n`;
    });

    let mediaContext = '\n=== POSTERS DISPONIBLES ===\n';
    if (mediaAssets && mediaAssets.length > 0) {
        mediaAssets.forEach(m => {
            mediaContext += `- ${m.title}: ${m.ai_instructions}\n  ETIQUETA: <<MEDIA:${m.url}>>\n\n`;
        });
    }

    let masterTruth = '\n=== VERDAD MAESTRA (SITIO WEB) ===\n';
    if (webPages && webPages.length > 0) {
        webPages.forEach(p => { if(p.content) masterTruth += `[${p.title}]: ${p.content.substring(0, 1500)}\n`; });
    }

    let kbContext = '\n=== BASE DE CONOCIMIENTO ===\n';
    if (kbDocs && kbDocs.length > 0) {
        kbDocs.forEach(d => { if(d.content) kbContext += `[${d.title}]: ${d.content.substring(0, 1000)}\n`; });
    }

    const systemPrompt = `${pAlma}\n${pAdn}\n${pEstrategia}\n${pRelearning && pRelearning !== '# Aún no hay lecciones inyectadas.' ? `\n=== REGLAS #CIA ===\n${pRelearning}` : ''}\n${masterTruth}\n${kbContext}\n${mediaContext}\n${catalogContext}\n=== DATOS BANCARIOS ===\n${bankInfo}`;

    // HISTORIAL
    const { data: history } = await supabase.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20);
    const historyMsgs = history ? history.reverse() : [];

    let userMessageContent: any = messageText;
    let finalSystemPrompt = systemPrompt;

    if (isImage && base64) {
        const visionPrompt = getConf('prompt_vision_instrucciones') || "Analiza esta imagen con precisión.";
        finalSystemPrompt += `\n\n=== OJO DE HALCÓN ===\n${visionPrompt}\nSi es comprobante de pago añade al final: ---JSON---\n{"payment_status": "VALID"}`;
        userMessageContent = [{ type: "text", text: messageText }, { type: "image_url", image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64}` } }];
    }

    // LLAMADA A OPENAI
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
            temperature: 0.3,
            max_tokens: 1000
        })
    });

    if (!aiRes.ok) {
        const errText = await aiRes.text();
        await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: `[ERROR DE IA] OpenAI respondió: ${errText.substring(0, 200)}`, platform: 'ERROR' });
        return new Response("OpenAI Error", { status: 200, headers: corsHeaders });
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
        } catch(e) {}
    }

    if (paymentStatusToUpdate) {
        await supabase.from('leads').update({ payment_status: paymentStatusToUpdate }).eq('id', lead.id);
    }

    const mediaRegex = /<<MEDIA:(.*?)>>/i;
    const mediaMatch = rawAnswer.match(mediaRegex);
    const mediaUrl = mediaMatch ? mediaMatch[1].trim() : null;
    let textToSend = rawAnswer.replace(mediaRegex, '').trim();

    if (!textToSend && !mediaUrl) {
        await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'NOTA', mensaje: `🤖 [IA procesó sin respuesta de texto]`, platform: 'SISTEMA' });
        return new Response('Silent');
    }

    const messageToLog = mediaUrl ? `[IMG: ${mediaUrl}] ${textToSend}` : textToSend;

    // *** GUARDADO INDESTRUCTIBLE: PRIMERO EN DB, LUEGO A WHATSAPP ***
    await supabase.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'IA', 
        mensaje: messageToLog, 
        platform: evoUrl && evoKey ? 'WHATSAPP_AUTO' : 'SISTEMA'
    });

    // ENVIAR A WHATSAPP (si está configurado)
    if (evoUrl && evoKey) {
        try {
            const endpoint = mediaUrl ? evoUrl.replace('sendText', 'sendMedia') : evoUrl;
            const payload = mediaUrl 
                ? { number: phone, mediatype: "image", media: mediaUrl, caption: textToSend || "", mediaMessage: { mediatype: "image", media: mediaUrl, caption: textToSend || "" } } 
                : { number: phone, text: textToSend };
            await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoKey }, body: JSON.stringify(payload) });
        } catch (e) {
            console.error("[webhook] Error enviando a WhatsApp:", e);
        }
    }

    if (requestHumanToUpdate) {
        await supabase.from('leads').update({ ai_paused: true }).eq('id', lead.id);
        await supabase.from('conversaciones').insert({ lead_id: lead.id, mensaje: `IA Pausada. Cliente solicitó humano.`, emisor: 'NOTA', platform: 'PANEL_INTERNO' });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("[webhook] Error crítico:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})