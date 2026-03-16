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
      return new Response('Ignored: no phone');
    }

    let messageText = findValue(messageData, 'conversation') 
      || findValue(messageData, 'text') 
      || findValue(messageData, 'caption') 
      || "";

    // 1. OBTENER O CREAR LEAD
    let { data: lead } = await supabase.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
      const { data: newLead } = await supabase.from('leads').insert({ nombre: `Nuevo Lead ${phone.slice(-4)}`, telefono: phone, buying_intent: 'BAJO' }).select().single();
      lead = newLead;
    }

    // 2. SI EL MENSAJE ES MÍO (HUMANO O IA), GUARDAR Y SALIR
    if (fromMe) {
      if (!messageText) return new Response('Empty fromMe');
      const { data: recentAI } = await supabase.from('conversaciones').select('id').eq('lead_id', lead.id).in('emisor', ['IA', 'SAMURAI']).gte('created_at', new Date(Date.now() - 10000).toISOString()).limit(1);
      if (recentAI && recentAI.length > 0) return new Response('AI Echo ignored');
      await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'HUMANO', mensaje: messageText, platform: 'WHATSAPP_MANUAL' });
      return new Response('Agent message saved');
    }

    if (!messageText) messageText = "[MULTIMEDIA]";

    // 3. GUARDAR MENSAJE DEL CLIENTE Y DISPARAR ANÁLISIS
    await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
    await supabase.from('leads').update({ last_message_at: new Date().toISOString(), followup_stage: 0 }).eq('id', lead.id);

    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id })
    }).catch(() => {});

    // 4. VERIFICAR SI LA IA DEBE RESPONDER
    if (lead.ai_paused) return new Response('AI paused for this lead');

    const { data: configs } = await supabase.from('app_config').select('key, value');
    const getC = (k: string) => configs?.find(c => c.key === k)?.value || '';

    if (getC('global_bot_paused') === 'true') return new Response('Global bot is paused');

    const apiKey = getC('openai_api_key');
    if (!apiKey) return new Response('No API key');

    // 5. OBTENER CONTEXTO NEURONAL (PROMPT)
    const contextRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/get-samurai-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead })
    });
    const { system_prompt } = await contextRes.json();

    // 6. OBTENER HISTORIAL RECIENTE
    const { data: history } = await supabase.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(15);
    const messages = [{ role: "system", content: system_prompt }];
    if (history) {
        history.reverse().forEach(h => {
            messages.push({ role: (h.emisor === 'CLIENTE' ? 'user' : 'assistant'), content: h.mensaje });
        });
    }

    // 7. LLAMAR A OPENAI
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.5 })
    });
    const aiData = await aiRes.json();
    let aiText = aiData.choices[0].message.content;

    // 8. PROCESAR RESPUESTA (HANDOFF Y MEDIA)
    const parts = aiText.split('---JSON---');
    const finalMessage = parts[0].trim();
    
    if (parts[1]) {
        try {
            const meta = JSON.parse(parts[1].trim().replace(/```json/g, '').replace(/```/g, ''));
            if (meta.request_human) {
                await supabase.from('leads').update({ ai_paused: true }).eq('id', lead.id);
                await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'LEADS', description: `🚨 Sam escaló a humano: ${lead.nombre}`, status: 'OK' });
            }
        } catch(e) {}
    }

    // 9. ENVIAR A WHATSAPP (EVOLUTION API)
    const evoUrl = getC('evolution_api_url');
    const evoKey = getC('evolution_api_key');

    if (evoUrl && evoKey) {
        // Detectar si hay etiquetas de media <<MEDIA:URL>>
        const mediaMatch = finalMessage.match(/<<MEDIA:(.+?)>>/);
        let cleanMessage = finalMessage.replace(/<<MEDIA:.+?>>/g, '').trim();

        if (mediaMatch) {
            const mediaUrl = mediaMatch[1];
            const sendMediaUrl = evoUrl.replace('sendText', 'sendMedia');
            await fetch(sendMediaUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({
                    number: phone,
                    media: mediaUrl,
                    mediatype: 'image',
                    caption: cleanMessage
                })
            });
        } else {
            await fetch(evoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({ number: phone, text: finalMessage })
            });
        }
    }

    // 10. GUARDAR RESPUESTA DE LA IA
    await supabase.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: finalMessage, platform: 'WHATSAPP' });

    return new Response(JSON.stringify({ success: true }));

  } catch (error: any) {
    console.error("[webhook] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})