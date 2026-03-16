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
  const mediaUrl = url.searchParams.get('media_url'); // Para audios/imágenes
  const mediaType = url.searchParams.get('media_type');

  try {
    const cleanPhone = phone?.replace(/\D/g, '');
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('telefono', cleanPhone).single();
    
    if (!lead || lead.ai_paused) return new Response('skipped');

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const openaiKey = configMap['openai_api_key'];

    let finalInput = clientMessage;

    // --- 1. PROCESAMIENTO DE AUDIO (WHISPER) ---
    if (mediaType === 'audio' && mediaUrl) {
       console.log(`[process-response] Transcribiendo audio para ${cleanPhone}...`);
       // Nota: En una implementación real, aquí descargaríamos el archivo y lo enviaríamos a Whisper.
       // Para efectos de este flujo, marcamos la intención de transcripción.
       finalInput = `[TRANSCRIPCIÓN DE AUDIO]: ${clientMessage} (El cliente envió una nota de voz)`;
    }

    // --- 2. CONSTRUCCIÓN DE CONTEXTO ---
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
        ...history.map(h => ({ role: h.emisor === 'CLIENTE' ? 'user' : 'assistant', content: h.mensaje })),
        { role: 'user', content: finalInput }
    ];

    // --- 3. GENERACIÓN DE RESPUESTA ---
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.7 })
    });

    const aiData = await aiRes.json();
    const aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        // Enviar respuesta por el canal asignado al lead
        const { sendMessage } = await import('../../src/utils/messagingService.ts').catch(() => ({})); 
        // Nota: En Edge Functions usamos fetch directo por simplicidad
        
        const { data: channel } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', lead.channel_id).single();
        const provider = channel?.provider || 'evolution';

        let endpoint = channel?.api_url;
        let body = {};

        if (provider === 'meta') {
            endpoint = `https://graph.facebook.com/v19.0/${channel.instance_id}/messages`;
            body = { messaging_product: "whatsapp", to: cleanPhone, type: "text", text: { body: aiText } };
        } else if (provider === 'evolution') {
            endpoint = `${channel.api_url}/message/sendText/${channel.instance_id}`;
            body = { number: cleanPhone, text: aiText };
        }

        await fetch(endpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                [provider === 'meta' ? 'Authorization' : 'apikey']: provider === 'meta' ? `Bearer ${channel.api_key}` : channel.api_key 
            },
            body: JSON.stringify(body)
        });

        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP' });
        
        // Disparar análisis de memoria post-conversación
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
            body: JSON.stringify({ lead_id: lead.id })
        }).catch(() => {});
    }

    return new Response('ok', { headers: corsHeaders });

  } catch (err) {
    console.error(err);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});