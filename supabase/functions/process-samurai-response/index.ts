// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const url = new URL(req.url);
  const phone = url.searchParams.get('phone');
  const clientMessage = url.searchParams.get('client_message') || '';
  const mediaUrl = url.searchParams.get('media_url');
  const mediaType = url.searchParams.get('media_type');

  try {
    const cleanPhone = phone?.replace(/\D/g, '');
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('telefono', cleanPhone).single();
    
    if (!lead || lead.ai_paused) return new Response('skipped');

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const openaiKey = configMap['openai_api_key'];

    let finalInput = clientMessage;
    if (mediaType === 'audio' && mediaUrl) {
       finalInput = `[TRANSCRIPCIÓN DE AUDIO]: ${clientMessage} (El cliente envió una nota de voz)`;
    }

    // --- 1. OBTENER CONTEXTO ---
    const { data: context } = await supabaseClient.functions.invoke('get-samurai-context', {
        body: { lead, platform: lead.platform }
    });

    const { data: history } = await supabaseClient.from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true })
        .limit(15);

    const messages = [
        { role: 'system', content: context.system_prompt },
        ...history.map(h => ({ role: (h.emisor === 'IA' || h.emisor === 'SAMURAI' || h.emisor === 'BOT') ? 'assistant' : 'user', content: h.mensaje })),
        { role: 'user', content: finalInput }
    ];

    // --- 2. GENERAR RESPUESTA ---
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.5 })
    });

    const aiData = await aiRes.json();
    let aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        // Extraer si la IA decidió mandar un poster (<<MEDIA:url>>)
        let mediaUrlToSend = null;
        let mediaTypeToSend = 'image';
        const mediaRegex = /<<MEDIA:\s*(.+?)\s*>>/i;
        const match = aiText.match(mediaRegex);
        
        if (match) {
            mediaUrlToSend = match[1].trim();
            aiText = aiText.replace(mediaRegex, '').trim();
        }

        const { data: channel } = await supabaseClient.from('whatsapp_channels').select('id').eq('id', lead.channel_id).single();
        if (!channel) return new Response('no_channel');

        // Construir payload de envío
        const payload: any = {
            channel_id: channel.id,
            phone: cleanPhone,
            message: aiText
        };

        if (mediaUrlToSend) {
            payload.mediaData = { url: mediaUrlToSend, type: mediaTypeToSend, name: 'poster.jpg' };
        }

        // --- 3. ENVIAR POR EL TÚNEL ---
        const sendRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message-v3`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Registrar SIEMPRE en la base de datos, aunque falle la entrega a WhatsApp
        await supabaseClient.from('conversaciones').insert({ 
            lead_id: lead.id, 
            emisor: 'IA', 
            mensaje: aiText || '[Poster Enviado]', 
            platform: 'WHATSAPP',
            metadata: mediaUrlToSend ? { mediaUrl: mediaUrlToSend, mediaType: mediaTypeToSend } : {}
        });

        // Forzar análisis del lead en background
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
            body: JSON.stringify({ lead_id: lead.id })
        }).catch(() => {});
    }

    return new Response('ok', { headers: corsHeaders });

  } catch (err) {
    console.error("[process-response] Error crítico:", err.message);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});