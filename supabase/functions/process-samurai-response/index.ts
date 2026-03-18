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

  try {
    const cleanPhone = phone?.replace(/\D/g, '');
    let { data: lead } = await supabaseClient.from('leads').select('*').eq('telefono', cleanPhone).single();
    
    if (!lead) return new Response('lead_not_found');

    // 1. SIEMPRE DISPARAR LA INTELIGENCIA (Extraer datos) Y ESPERAR A QUE TERMINE
    await supabaseClient.functions.invoke('analyze-leads', { body: { lead_id: lead.id } });

    // 2. RECARGAR EL LEAD FRESCO PARA QUE LA IA VEA LOS DATOS NUEVOS
    const { data: updatedLead } = await supabaseClient.from('leads').select('*').eq('id', lead.id).single();
    if (updatedLead) lead = updatedLead;

    // 3. SI EL BOT ESTÁ PAUSADO, AQUÍ TERMINAMOS
    if (lead.ai_paused) return new Response('skipped_due_to_pause');

    // 4. GENERAR RESPUESTA IA CON MEMORIA FRESCA
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const openaiKey = configMap['openai_api_key'];

    const { data: context } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead, platform: lead.platform } });
    const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(15);

    const messages = [
        { role: 'system', content: context.system_prompt },
        ...history.map(h => ({ role: (['IA', 'SAMURAI', 'BOT'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje })),
        { role: 'user', content: clientMessage }
    ];

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.5 })
    });

    const aiData = await aiRes.json();
    const aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        await supabaseClient.functions.invoke('send-message-v3', { 
            body: { channel_id: lead.channel_id, phone: cleanPhone, message: aiText } 
        });

        await supabaseClient.from('conversaciones').insert({ 
            lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP'
        });
    }

    return new Response('ok', { headers: corsHeaders });

  } catch (err) {
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});