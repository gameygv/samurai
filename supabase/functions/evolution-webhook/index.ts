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

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const apiKey = configs.find(c => c.key === 'openai_api_key')?.value;
    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    const body = await req.json();
    const eventName = (body.event || body.type || "").toLowerCase();
    
    if (eventName !== 'messages.upsert') return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });

    const messageData = findValue(body, 'message'); 
    const fromMe = findValue(body, 'fromMe') || body.data?.key?.fromMe;
    if (!messageData || fromMe) return new Response('Ignored');

    const phone = findValue(body, 'remoteJid')?.split('@')[0];
    const messageText = findValue(messageData, 'conversation') || findValue(messageData, 'text') || findValue(messageData, 'caption') || "";

    if (!messageText) return new Response('No content');

    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ 
            nombre: `Nuevo Lead ${phone.slice(-4)}`,
            telefono: phone, 
            buying_intent: 'BAJO' 
        }).select().single();
        lead = newLead;
    }

    if (lead.ai_paused) return new Response('Paused');

    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead } });
    
    const { data: history } = await supabaseClient.from('conversaciones')
        .select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(20);

    const historyMsgs = history ? history.reverse() : [];
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: kernelData?.system_prompt },
                ...historyMsgs.map(m => ({ role: (m.emisor === 'SAMURAI' ? 'assistant' : 'user'), content: m.mensaje })),
                { role: "user", content: messageText } 
            ],
            temperature: 0.3
        })
    });

    const aiData = await aiRes.json();
    const rawAnswer = aiData.choices?.[0]?.message?.content || "";

    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const mediaMatch = rawAnswer.match(mediaRegex);
    const mediaUrl = mediaMatch ? mediaMatch[1] : null;
    let textToSend = rawAnswer.replace(mediaRegex, '').trim();

    if (evoUrl && evoKey) {
        const endpoint = mediaUrl ? evoUrl.replace('sendText', 'sendMedia') : evoUrl;
        const payload = mediaUrl ? {
            number: phone,
            mediaMessage: { mediatype: "image", media: mediaUrl, caption: textToSend }
        } : {
            number: phone,
            text: textToSend
        };

        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
            body: JSON.stringify(payload)
        });

        await supabaseClient.from('conversaciones').insert({ 
            lead_id: lead.id, emisor: 'SAMURAI', mensaje: mediaUrl ? `[IMG: ${mediaUrl}] ${rawAnswer}` : rawAnswer, platform: 'WHATSAPP_AUTO' 
        });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})