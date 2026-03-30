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
    
    if (lead.buying_intent === 'PERDIDO' || lead.buying_intent === 'COMPRADO') return new Response('closed', { headers: corsHeaders });

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    if (!apiKey) {
        await supabaseClient.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: "Falta OpenAI API Key en Ajustes.", status: 'ERROR' });
        return new Response('no_key', { headers: corsHeaders });
    }

    const [ { data: history } ] = await Promise.all([
        supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(10)
    ]);

    const { data: kernel, error: kernelErr } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead } });
    if (kernelErr) {
        await supabaseClient.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: `Fallo al cargar contexto del Kernel: ${kernelErr.message}`, status: 'ERROR' });
    }

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
    
    // DETECTOR DE ERRORES OPENAI (Saldo, Bloqueo, Límite)
    if (aiData.error) {
        await supabaseClient.from('activity_logs').insert({ 
            action: 'ERROR', resource: 'BRAIN', description: `OpenAI rechazó la conexión: ${aiData.error.message}`, status: 'ERROR' 
        });
        return new Response('openai_error', { headers: corsHeaders });
    }

    const aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        // Enviar a WhatsApp
        const { data: sendData, error: sendErr } = await supabaseClient.functions.invoke('send-message-v3', { 
            body: { channel_id: lead.channel_id, phone: lead.telefono, message: aiText, lead_id: lead.id } 
        });
        
        // DETECTOR DE ERRORES WHATSAPP (Meta / Gowa rechaza el mensaje)
        if (sendErr || (sendData && !sendData.success)) {
            await supabaseClient.from('activity_logs').insert({ 
                action: 'ERROR', resource: 'SYSTEM', description: `Error WhatsApp API (${lead.telefono}): ${sendErr?.message || sendData?.error}`, status: 'ERROR' 
            });
        }

        // SIEMPRE registrar la respuesta de la IA en el chat, incluso si WhatsApp falla
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP' });
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err: any) {
    await supabaseClient.from('activity_logs').insert({ action: 'ERROR', resource: 'SYSTEM', description: `Crash crítico en IA: ${err.message}`, status: 'ERROR' });
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});