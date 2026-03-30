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
    
    if (!lead_id) return new Response(JSON.stringify({ error: 'lead_id required' }), { headers: corsHeaders });

    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single();
    if (!lead) return new Response(JSON.stringify({ error: 'Lead not found' }), { headers: corsHeaders });

    // BLINDAJE 1: Nunca analizar ni cambiar leads que ya están en COMPRADO
    if (lead.buying_intent === 'COMPRADO') {
      return new Response(JSON.stringify({ message: 'Ignorado: Lead ya está ganado' }), { headers: corsHeaders });
    }

    // BLINDAJE 2: Si por alguna razón extraña llegó como PERDIDO, lo rescatamos a BAJO
    if (lead.buying_intent === 'PERDIDO') {
       await supabase.from('leads').update({ buying_intent: 'BAJO' }).eq('id', lead.id);
       lead.buying_intent = 'BAJO';
    }

    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc: any, c) => ({ ...acc, [c.key]: c.value }), {}) || {};
    const apiKey = configMap.openai_api_key;

    if (!apiKey) return new Response(JSON.stringify({ message: 'No API key' }), { headers: corsHeaders });

    const { data: lastMessages } = await supabase.from('conversaciones')
      .select('mensaje, emisor')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(3);

    const clientMessages = (lastMessages || []).filter(m => m.emisor === 'CLIENTE').map(m => m.mensaje).join('\n');
    if (!clientMessages) return new Response(JSON.stringify({ message: 'No client messages' }), { headers: corsHeaders });

    const analysisPrompt = `Analiza este mensaje de cliente y extrae:
    1. Ciudad (si la menciona)
    2. Email (si lo menciona)
    3. Intención de compra: Responde ESTRICTAMENTE con una de estas tres palabras: "BAJO", "MEDIO" o "ALTO". (Nunca respondas PERDIDO).

    Mensaje:
    ${clientMessages}

    Responde en JSON exacto: {"ciudad": "", "email": "", "intent": "BAJO"}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: "gpt-4o-mini", 
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(content);
      const updates: any = {};
      
      // BLINDAJE 3 DE HIERRO: Solo permitimos que la IA asigne estados positivos.
      const allowedIntents = ['BAJO', 'MEDIO', 'ALTO'];
      let newIntent = parsed.intent ? String(parsed.intent).toUpperCase() : '';
      
      if (allowedIntents.includes(newIntent)) {
         updates.buying_intent = newIntent;
      } else {
         // Si la IA alucina y responde "PERDIDO" u otra cosa, forzamos BAJO.
         updates.buying_intent = allowedIntents.includes(lead.buying_intent) ? lead.buying_intent : 'BAJO';
      }
      
      if (parsed.ciudad && parsed.ciudad.length > 2) updates.ciudad = parsed.ciudad;
      if (parsed.email && parsed.email.includes('@')) updates.email = parsed.email;

      // Doble validación final
      if (updates.buying_intent === 'PERDIDO') updates.buying_intent = 'BAJO';

      await supabase.from('leads').update(updates).eq('id', lead.id);

      return new Response(JSON.stringify({ success: true, intent: updates.buying_intent }), { headers: corsHeaders });

    } catch (parseError) {
      return new Response(JSON.stringify({ message: 'Parse error' }), { headers: corsHeaders });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});