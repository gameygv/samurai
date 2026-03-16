// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  try {
    const payload = await req.json();
    const eventType = payload?.event || payload?.type || 'unknown';

    // 1. LOG DE CUALQUIER ACTIVIDAD (Para el Monitor Live)
    await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'SYSTEM',
        description: `Webhook Hit: ${eventType}`,
        status: 'OK',
        metadata: { event: eventType }
    }).catch(() => {});

    // 2. RESPONDER A EVENTOS DE CONEXIÓN (Para que Evolution sepa que estamos vivos)
    if (eventType.includes('connection') || eventType.includes('status')) {
        return new Response(JSON.stringify({ status: 'connected', msg: 'Samurai Kernel is listening' }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    // 3. PROCESAR MENSAJES (MESSAGES_UPSERT)
    const msgData = payload?.data || payload?.body || payload;
    const msg = Array.isArray(msgData) ? msgData[0] : msgData;

    if (msg?.key?.fromMe === true || msg?.fromMe === true) return new Response('ignored_from_me', { headers: corsHeaders });

    const phone = msg?.key?.remoteJid?.split('@')[0] || msg?.from?.split('@')[0] || msg?.remoteJid?.split('@')[0];
    const text = msg?.message?.conversation || 
                 msg?.message?.extendedTextMessage?.text || 
                 msg?.text?.body || 
                 msg?.text || 
                 msg?.message?.imageMessage?.caption || '';

    if (!phone || !text) return new Response('no_content_ignored', { headers: corsHeaders });

    const cleanPhone = phone.replace(/\D/g, '');

    // Lead Ops
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({
            nombre: msg?.pushName || 'Nuevo Lead WhatsApp',
            telefono: cleanPhone,
            platform: 'WHATSAPP'
        }).select().single();
        lead = newLead;
    }

    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: text, platform: 'WHATSAPP' });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    if (lead.ai_paused) return new Response('ai_paused', { headers: corsHeaders });

    // AI Flow...
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    
    if (configMap['global_bot_paused'] === 'true') return new Response('global_paused', { headers: corsHeaders });

    const openaiKey = configMap['openai_api_key'];
    const evolutionUrl = configMap['evolution_api_url'];
    const evolutionKey = configMap['evolution_api_key'];

    const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(10);
    const systemPrompt = `${configMap['prompt_alma_samurai']}\n${configMap['prompt_adn_core']}\n${configMap['prompt_behavior_rules']}`;
    
    const messages = [{ role: 'system', content: systemPrompt }];
    history?.forEach(h => messages.push({ role: h.emisor === 'CLIENTE' ? 'user' : 'assistant', content: h.mensaje }));

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.7 })
    });

    const aiData = await aiRes.json();
    let aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        const mediaMatch = aiText.match(/<<MEDIA:(.+?)>>/);
        let endpoint = evolutionUrl;
        let body = { number: cleanPhone, text: aiText };

        if (mediaMatch) {
            const mediaUrl = mediaMatch[1];
            const cleanAiText = aiText.replace(mediaMatch[0], '').trim();
            endpoint = evolutionUrl.replace('sendText', 'sendMedia');
            body = { number: cleanPhone, mediatype: "image", mimetype: "image/jpeg", caption: cleanAiText, media: mediaUrl };
        }

        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
            body: JSON.stringify(body)
        });

        await supabaseClient.from('conversaciones').insert({ 
            lead_id: lead.id, 
            emisor: 'IA', 
            mensaje: aiText, 
            platform: 'WHATSAPP' 
        });
    }

    return new Response('success', { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});