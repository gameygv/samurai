// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const url = new URL(req.url);
  const channelIdParam = url.searchParams.get('channel_id');
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  if (req.method === 'GET') {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode && token) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const logTrace = async (msg: string, isError = false) => {
    await supabaseClient.from('activity_logs').insert({
        action: isError ? 'ERROR' : 'UPDATE', resource: 'SYSTEM',
        description: `Webhook Trace: ${msg}`, status: isError ? 'ERROR' : 'OK'
    });
  };

  try {
    const payloadText = await req.text();
    let payload;
    try { payload = JSON.parse(payloadText); } catch (e) { return new Response("Invalid JSON", { status: 400 }); }
    
    // 1. RESOLVER CANAL
    let channel = null;
    if (channelIdParam) {
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelIdParam).maybeSingle();
       channel = data;
    }
    if (!channel) {
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('is_active', true).limit(1).maybeSingle();
       channel = data;
    }
    if (!channel) return new Response('no_channel', { status: 200 });

    // 2. PARSEAR MENSAJE GOWA
    if (!payload.payload || payload.payload.is_from_me) return new Response('ignored', { status: 200 });
    const p = payload.payload;
    const cleanPhone = p.from.replace(/\D/g, '');
    let text = p.body || (p.image ? "[Imagen]" : p.audio ? "[Audio]" : p.sticker ? "[Sticker]" : "");

    // 3. ACTUALIZAR CRM
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone.slice(-10)}%`).limit(1).maybeSingle();
    if (!lead) {
      const { data: nl } = await supabaseClient.from('leads').insert({ nombre: p.from_name || 'Nuevo Lead', telefono: cleanPhone, channel_id: channel.id }).select().single();
      lead = nl;
    }
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: text, platform: 'WHATSAPP' });

    // 4. CEREBRO IA INTEGRADO
    if (!lead.ai_paused) {
       const { data: configs } = await supabaseClient.from('app_config').select('key, value');
       const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
       
       // CARGAR CONTEXTO DINÁMICO (POSTERS)
       const { data: posters } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER');
       let postersCtx = "\n=== BÓVEDA VISUAL (POSTERS) ===\nINSTRUCCIÓN DE ALTA PRIORIDAD: Si el cliente menciona una CIUDAD o LUGAR, debes buscar el poster que coincida y enviarlo usando <<MEDIA:url>> al inicio de tu respuesta. Ejemplo: '¡Hola! Qué bien que seas de Guadalajara. Aquí tienes los detalles: <<MEDIA:https://url.jpg>>'\n";
       posters?.forEach(m => { postersCtx += `- ${m.title}: ${m.ai_instructions} -> <<MEDIA:${m.url}>>\n`; });

       const systemPrompt = `${configMap['prompt_alma_samurai']}\n${configMap['prompt_adn_core']}\n${postersCtx}\n${configMap['prompt_behavior_rules']}`;

       const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
         method: 'POST',
         headers: { 'Authorization': `Bearer ${configMap['openai_api_key']}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
            temperature: 0.3
         })
       });

       const aiData = await aiRes.json();
       let aiText = aiData.choices?.[0]?.message?.content || '';

       if (aiText) {
          let mediaUrl = null;
          const match = aiText.match(/<<MEDIA:\s*(.+?)\s*>>/i);
          if (match) {
             mediaUrl = match[1].trim();
             aiText = aiText.replace(match[0], '').trim();
          }

          // ENVÍO REAL A WHATSAPP
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message-v3`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: channel.id, phone: cleanPhone, message: aiText, mediaData: mediaUrl ? { url: mediaUrl, type: 'image', name: 'poster.jpg' } : undefined })
          });

          // GUARDAR EN CRM CON EMISOR 'SAMURAI' (Estandarizado para el visor)
          await supabaseClient.from('conversaciones').insert({ 
             lead_id: lead.id, emisor: 'SAMURAI', mensaje: aiText || "[Poster Enviado]", platform: 'WHATSAPP',
             metadata: mediaUrl ? { mediaUrl, mediaType: 'image' } : {}
          });
       }
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    await logTrace(`ERROR: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});