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
    if (eventName !== 'messages.upsert') return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });

    const messageData = findValue(body, 'message'); 
    const fromMe = findValue(body, 'fromMe') || findValue(body.data?.key, 'fromMe');
    const phone = findValue(body, 'remoteJid')?.split('@')[0] || findValue(body.data?.key, 'remoteJid')?.split('@')[0];

    if (!phone || phone.includes('status')) return new Response('Ignored');

    let messageText = findValue(messageData, 'conversation') || findValue(messageData, 'text') || findValue(messageData, 'caption') || "";

    let { data: lead } = await supabase.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
      const { data: newLead } = await supabase.from('leads').insert({ nombre: `Nuevo Lead ${phone.slice(-4)}`, telefono: phone, buying_intent: 'BAJO' }).select().single();
      lead = newLead;
    }

    if (fromMe) {
      await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'HUMANO', mensaje: messageText || '[MULTIMEDIA]', platform: 'WHATSAPP' });
      return new Response('Saved');
    }

    await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText || '[MULTIMEDIA]', platform: 'WHATSAPP' });
    await supabase.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    // DISPARAR ANÁLISIS INMEDIATO
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id })
    }).catch(() => {});

    if (lead.ai_paused) return new Response('Paused');

    const { data: configs } = await supabase.from('app_config').select('key, value');
    const getC = (k: string) => configs?.find(c => c.key === k)?.value || '';
    const apiKey = getC('openai_api_key');

    // OBTENER CONTEXTO (Pasando la plataforma)
    const contextRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/get-samurai-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead, platform: 'WHATSAPP' })
    });
    const { system_prompt } = await contextRes.json();

    const { data: history } = await supabase.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(15);
    const messages = [{ role: "system", content: system_prompt }];
    if (history) history.reverse().forEach(h => messages.push({ role: (h.emisor === 'CLIENTE' ? 'user' : 'assistant'), content: h.mensaje }));

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.5 })
    });
    const aiData = await aiRes.json();
    let aiText = aiData.choices[0].message.content;

    // Enviar a WhatsApp
    const evoUrl = getC('evolution_api_url');
    const evoKey = getC('evolution_api_key');
    if (evoUrl && evoKey) {
        const mediaMatch = aiText.match(/<<MEDIA:(.+?)>>/);
        let cleanMsg = aiText.replace(/<<MEDIA:.+?>>/g, '').trim();
        if (mediaMatch) {
            await fetch(evoUrl.replace('sendText', 'sendMedia'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: phone, media: mediaMatch[1], mediatype: 'image', caption: cleanMsg })
            });
        } else {
            await fetch(evoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: phone, text: aiText })
            });
        }
    }

    await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP' });
    return new Response('OK');

  } catch (error: any) {
    return new Response(error.message, { status: 200 });
  }
})