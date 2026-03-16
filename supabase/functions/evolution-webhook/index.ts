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

  console.log("[evolution-webhook] Evento recibido...");
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const body = await req.json();
    const eventName = (body.event || body.type || "").toLowerCase();
    if (eventName !== 'messages.upsert') return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });

    const messageData = findValue(body, 'message'); 
    const fromMe = findValue(body, 'fromMe') || findValue(body.data?.key, 'fromMe');
    const phone = findValue(body, 'remoteJid')?.split('@')[0] || findValue(body.data?.key, 'remoteJid')?.split('@')[0];

    if (!phone || phone.includes('status')) return new Response('Ignored');

    let messageText = findValue(messageData, 'conversation') || findValue(messageData, 'text') || findValue(messageData, 'caption') || "";

    // 1. IDENTIFICAR LEAD
    let { data: lead } = await supabase.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabase.from('leads').insert({ 
            nombre: `Nuevo Lead ${phone.slice(-4)}`, telefono: phone, buying_intent: 'BAJO'
        }).select().single();
        lead = newLead;
    }

    // 2. FILTRAR MENSAJES SALIENTES (MANUALES O ECOS)
    if (fromMe) {
        // Bloqueo de Eco de IA (Para no guardar dos veces lo que dice el bot)
        const { data: isAiEcho } = await supabase.from('conversaciones')
            .select('id').eq('lead_id', lead.id).in('emisor', ['IA', 'SAMURAI'])
            .gte('created_at', new Date(Date.now() - 10000).toISOString())
            .ilike('mensaje', `%${messageText.substring(0, 20)}%`).limit(1);
            
        if (isAiEcho && isAiEcho.length > 0) return new Response('AI Echo ignored');

        // Es un humano respondiendo desde el celular
        await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'HUMANO', mensaje: messageText, platform: 'WHATSAPP_MANUAL' });
        return new Response('Manual message saved');
    }

    // 3. MENSAJES DEL CLIENTE (ENTRANTES)
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const getC = (k) => configs?.find(c => c.key === k)?.value || '';
    const apiKey = getC('openai_api_key');

    // Guardar mensaje del cliente de inmediato para que el vendedor lo vea
    await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText || "[MULTIMEDIA]", platform: 'WHATSAPP' });
    await supabase.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    if (lead.ai_paused || !apiKey) return new Response('AI Paused');

    // 4. CONSTRUIR CONTEXTO INTERNO (STANDALONE)
    const { data: media } = await supabase.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER');
    const { data: web } = await supabase.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    
    const context = `
      ADN: ${getC('prompt_adn_core')}
      ESTRATEGIA: ${getC('prompt_estrategia_cierre')}
      WEB: ${web?.map(p => `[${p.title}]: ${p.content.substring(0, 1000)}`).join('\n')}
      POSTERS: ${media?.map(m => `<<MEDIA:${m.url}>> - ${m.ai_instructions}`).join('\n')}
    `;

    const { data: history } = await supabase.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(15);

    // 5. RESPUESTA IA
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: getC('prompt_alma_samurai') + "\n" + context },
                ...(history ? history.reverse() : []).map(m => ({ role: (m.emisor === 'IA' ? 'assistant' : 'user'), content: m.mensaje })),
                { role: "user", content: messageText }
            ],
            temperature: 0.3
        })
    });

    if (!aiRes.ok) throw new Error("OpenAI Error");
    const aiData = await aiRes.json();
    const rawAnswer = aiData.choices[0].message.content;

    // *** PASO CRÍTICO: GUARDAR EN CRM ANTES DE ENVIAR A WHATSAPP ***
    await supabase.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'IA', 
        mensaje: rawAnswer, 
        platform: 'WHATSAPP_AUTO' 
    });

    // 6. ENVIAR A WHATSAPP
    const evoUrl = getC('evolution_api_url');
    const evoKey = getC('evolution_api_key');
    if (evoUrl && evoKey) {
        const mediaRegex = /<<MEDIA:(.*?)>>/;
        const mediaUrl = rawAnswer.match(mediaRegex)?.[1];
        const textToSend = rawAnswer.replace(mediaRegex, '').trim();

        const endpoint = mediaUrl ? evoUrl.replace('sendText', 'sendMedia') : evoUrl;
        const payload = mediaUrl ? {
            number: phone, mediatype: "image", media: mediaUrl, caption: textToSend
        } : { number: phone, text: textToSend };

        await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoKey }, body: JSON.stringify(payload) });
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("[Webhook Error]:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})