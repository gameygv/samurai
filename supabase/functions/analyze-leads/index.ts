// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const body = await req.json();
    const lead_id = body.lead_id;
    
    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'lead_id required' }), { headers: corsHeaders });
    }

    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single();
    if (!lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), { headers: corsHeaders });
    }

    // NUNCA cambiar buying_intent de leads que ya están en PERDIDO o COMPRADO
    if (lead.buying_intent === 'PERDIDO' || lead.buying_intent === 'COMPRADO') {
      return new Response(JSON.stringify({ message: 'Lead is in closed state, skipping analysis' }), { headers: corsHeaders });
    }

    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc: any, c) => ({ ...acc, [c.key]: c.value }), {}) || {};
    const apiKey = configMap.openai_api_key;

    // Extraer información del mensaje del cliente
    const { data: lastMessages } = await supabase.from('conversaciones')
      .select('mensaje, emisor')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const clientMessages = (lastMessages || [])
      .filter(m => m.emisor === 'CLIENTE')
      .map(m => m.mensaje)
      .join('\n');

    if (!clientMessages) {
      // Si no hay mensajes de cliente, mantener el intent actual (default BAJO)
      if (!lead.buying_intent || lead.buying_intent === 'PERDIDO') {
        await supabase.from('leads').update({ buying_intent: 'BAJO' }).eq('id', lead.id);
      }
      return new Response(JSON.stringify({ message: 'No client messages to analyze' }), { headers: corsHeaders });
    }

    // Si no hay API key, mantener intent actual o asignar BAJO
    if (!apiKey) {
      if (!lead.buying_intent || lead.buying_intent === 'PERDIDO') {
        await supabase.from('leads').update({ buying_intent: 'BAJO' }).eq('id', lead.id);
      }
      return new Response(JSON.stringify({ message: 'No API key, keeping current intent' }), { headers: corsHeaders });
    }

    // Analizar con IA
    const analysisPrompt = `Analiza el siguiente mensaje de un cliente y extrae:
1. Ciudad mencionada (si hay)
2. Email mencionado (si hay)
3. Intención de compra (BAJO, MEDIO, ALTO - NUNCA usar PERDIDO)

Mensajes del cliente:
${clientMessages}

Responde SOLO en formato JSON:
{"ciudad": "", "email": "", "intent": "BAJO|MEDIO|ALTO"}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: "gpt-4o-mini", 
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.1
      })
    });

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    try {
      const parsed = JSON.parse(content);
      
      const updates: any = {};
      
      // NUNCA permitir que la IA asigne PERDIDO
      if (parsed.intent && ['BAJO', 'MEDIO', 'ALTO'].includes(parsed.intent)) {
        updates.buying_intent = parsed.intent;
      } else {
        // Default a BAJO si la IA devuelve algo inválido
        updates.buying_intent = lead.buying_intent || 'BAJO';
      }
      
      if (parsed.ciudad) updates.ciudad = parsed.ciudad;
      if (parsed.email) updates.email = parsed.email;

      await supabase.from('leads').update(updates).eq('id', lead.id);

      return new Response(JSON.stringify({ success: true, updates }), { headers: corsHeaders });
    } catch (parseError) {
      // Si falla el parseo, mantener intent actual
      if (!lead.buying_intent || lead.buying_intent === 'PERDIDO') {
        await supabase.from('leads').update({ buying_intent: 'BAJO' }).eq('id', lead.id);
      }
      return new Response(JSON.stringify({ message: 'Parse error, keeping current intent' }), { headers: corsHeaders });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});