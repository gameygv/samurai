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

  const logTrace = async (msg: string, isError = false) => {
    await supabaseClient.from('activity_logs').insert({
        action: isError ? 'ERROR' : 'UPDATE', resource: 'BRAIN',
        description: `Samurai Trace: ${msg}`, status: isError ? 'ERROR' : 'OK'
    });
  };

  try {
    const body = await req.json().catch(() => ({}));
    const lead_id = body.lead_id;
    const clientMessage = body.client_message || '';

    if (!lead_id) {
        await logTrace("Abortado: No se recibió lead_id", true);
        return new Response('no_lead_id', { headers: corsHeaders });
    }

    const { data: lead, error: leadErr } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    if (leadErr || !lead) {
        await logTrace(`Abortado: Lead no encontrado (${lead_id})`, true);
        return new Response('lead_not_found', { headers: corsHeaders });
    }

    if (lead.ai_paused) return new Response('skipped_pause', { headers: corsHeaders });
    if (lead.buying_intent === 'COMPRADO' || lead.buying_intent === 'PERDIDO') return new Response('skipped_stage', { headers: corsHeaders });

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const openaiKey = configMap['openai_api_key'];

    if (!openaiKey) {
        await logTrace("Abortado: OpenAI API Key faltante.", true);
        return new Response('missing_key', { headers: corsHeaders });
    }

    await logTrace(`Construyendo contexto del sistema para ${lead.nombre}...`);
    const { data: context } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead, platform: lead.platform } });
    
    const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(15);

    const messages = [
        { role: 'system', content: context?.system_prompt || 'Eres un asistente de ventas.' },
        ...history.map(h => ({ role: (['IA', 'SAMURAI', 'BOT'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje })),
        { role: 'user', content: clientMessage }
    ];

    await logTrace("Llamando al cerebro de OpenAI (GPT-4o)...");
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.5 })
    });

    if (!aiRes.ok) {
        const errText = await aiRes.text();
        await logTrace(`Fallo en OpenAI: ${aiRes.status} - ${errText}`, true);
        return new Response('openai_error', { headers: corsHeaders });
    }

    const aiData = await aiRes.json();
    const aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        await logTrace("Respuesta lista. Despachando a WhatsApp...");
        const sendRes = await supabaseClient.functions.invoke('send-message-v3', { 
            body: { channel_id: lead.channel_id, phone: lead.telefono, message: aiText, lead_id: lead.id } 
        });

        if (sendRes.error || (sendRes.data && !sendRes.data.success)) {
            await logTrace(`Fallo de entrega Meta/Gowa: ${JSON.stringify(sendRes.data?.error || sendRes.error)}`, true);
        } else {
            await supabaseClient.from('conversaciones').insert({ 
                lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP'
            });
            await logTrace("✅ Mensaje entregado y guardado exitosamente.");
        }
    } else {
        await logTrace("La IA generó una respuesta vacía.", true);
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err: any) {
    await logTrace(`Excepción de código: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});