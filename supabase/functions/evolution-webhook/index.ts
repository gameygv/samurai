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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '', 
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json();
    const eventName = (body.event || body.type || "").toLowerCase();
    
    if (eventName !== 'messages.upsert') {
      return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });
    }

    const messageData = findValue(body, 'message'); 
    const fromMe = findValue(body, 'fromMe') || findValue(body.data?.key, 'fromMe');
    const phone = findValue(body, 'remoteJid')?.split('@')[0] || findValue(body.data?.key, 'remoteJid')?.split('@')[0];

    if (!phone || phone.includes('status') || phone.includes('broadcast')) {
      return new Response('Ignored');
    }

    let messageText = findValue(messageData, 'conversation') 
      || findValue(messageData, 'text') 
      || findValue(messageData, 'caption') 
      || "";

    // 1. OBTENER O CREAR LEAD
    let { data: lead } = await supabase
      .from('leads')
      .select('*')
      .or(`telefono.ilike.%${phone}%`)
      .maybeSingle();

    if (!lead) {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({ nombre: `Nuevo Lead ${phone.slice(-4)}`, telefono: phone, buying_intent: 'BAJO' })
        .select().single();
      lead = newLead;
    }

    // 2. GUARDAR MENSAJE ENTRANTE (Si no es del bot)
    if (fromMe) {
       // Evitar eco de mensajes enviados por el propio bot/vendedor
       return new Response('From me ignored');
    }

    if (!messageText) messageText = "[MULTIMEDIA]";
    await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
    await supabase.from('leads').update({ last_message_at: new Date().toISOString(), followup_stage: 0 }).eq('id', lead.id);

    // 3. DISPARAR ANÁLISIS EN TIEMPO REAL (SIN ESPERAR)
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id, force: true })
    }).catch(err => console.error("Error auto-analisis:", err));

    // 4. VERIFICAR SI LA IA DEBE RESPONDER
    if (lead.ai_paused) return new Response('AI Paused');
    
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const getC = (k: string) => configs?.find(c => c.key === k)?.value || '';

    if (getC('global_bot_paused') === 'true') return new Response('Global Killswitch Active');
    
    const apiKey = getC('openai_api_key');
    const evoUrl = getC('evolution_api_url');
    const evoKey = getC('evolution_api_key');

    if (!apiKey || !evoUrl) throw new Error("Falta configuración (API Key o Evolution URL)");

    // 5. OBTENER CONTEXTO Y GENERAR RESPUESTA
    const { data: kernelData } = await supabase.functions.invoke('get-samurai-context', { body: { lead } });
    
    const { data: history } = await supabase.from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(15);
    
    const historyMsgs = history ? history.reverse() : [];

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: kernelData.system_prompt },
          ...historyMsgs.map(m => ({ 
             role: (m.emisor === 'IA' || m.emisor === 'SAMURAI') ? 'assistant' : 'user', 
             content: m.mensaje 
          }))
        ],
        temperature: 0.5
      })
    });

    const aiData = await aiRes.json();
    const rawAnswer = aiData.choices?.[0]?.message?.content || "";

    // 6. PROCESAR MULTIMEDIA (POSTERS)
    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const mediaMatch = rawAnswer.match(mediaRegex);
    const mediaUrl = mediaMatch ? mediaMatch[1].trim() : null;
    let textToSend = rawAnswer.replace(mediaRegex, '').trim();

    if (!textToSend && !mediaUrl) return new Response('Empty response');

    // 7. ENVIAR A WHATSAPP (EVOLUTION API)
    const endpoint = mediaUrl ? evoUrl.replace('sendText', 'sendMedia') : evoUrl;
    const payload = mediaUrl ? {
        number: phone,
        mediatype: "image",
        media: mediaUrl,
        caption: textToSend || "",
        mediaMessage: { mediatype: "image", media: mediaUrl, caption: textToSend || "" }
    } : { number: phone, text: textToSend };

    const waRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
        body: JSON.stringify(payload)
    });

    // 8. GUARDAR RESPUESTA DE LA IA EN DB
    await supabase.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'SAMURAI', 
        mensaje: mediaUrl ? `[IMG: ${mediaUrl}] ${textToSend}` : textToSend,
        platform: 'API_AUTO'
    });

    return new Response(JSON.stringify({ success: true }));

  } catch (error: any) {
    console.error("[webhook-error]:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
});