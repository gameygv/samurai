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

  try {
    const { lead_id, client_message } = await req.json();
    if (!lead_id) return new Response('no_id', { headers: corsHeaders });

    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    if (!lead || lead.ai_paused) return new Response('skip', { headers: corsHeaders });
    
    // Si está en PERDIDO o COMPRADO, la IA no responde para no molestar
    if (lead.buying_intent === 'PERDIDO' || lead.buying_intent === 'COMPRADO') return new Response('closed', { headers: corsHeaders });

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    if (!apiKey) return new Response('no_key', { headers: corsHeaders });

    // CARGA DE CONTEXTO ULTRA RÁPIDA
    const [ { data: history } ] = await Promise.all([
        supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(10)
    ]);

    // LLAMADA AL KERNEL PARA EL PROMPT FINAL
    const { data: kernel } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead } });
    const systemPrompt = kernel?.system_prompt || "Eres Sam, asistente de ventas.";

    const msgs = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(h => ({ role: (['IA', 'SAMURAI', 'BOT'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje })),
        { role: 'user', content: client_message }
    ];

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages: msgs, temperature: 0.4 })
    });

    const aiData = await aiRes.json();
    const aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        await supabaseClient.functions.invoke('send-message-v3', { 
            body: { channel_id: lead.channel_id, phone: lead.telefono, message: aiText, lead_id: lead.id } 
        });
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP' });
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err: any) {
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});