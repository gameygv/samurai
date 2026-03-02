// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { lead_id, transcript } = await req.json();

    // 1. Obtener API Key de OpenAI
    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').single();
    if (!config?.value) throw new Error("OpenAI API Key no configurada.");

    // 2. Obtener ADN Samurai para el tono
    const { data: adn } = await supabaseClient.from('app_config').select('value').eq('key', 'prompt_adn_core').single();

    const prompt = `
      Actúa como el Samurai, el cerrador de ventas de elite de The Elephant Bowl.
      
      CONOCIMIENTO BASE:
      ${adn?.value}

      HISTORIAL DE CHAT RECIENTE:
      ${transcript}

      TU TAREA:
      Genera 3 opciones de respuesta CORTAS y TÁCTICAS para el vendedor humano.
      - Opción 1 [EMPATIA]: Conecta emocionalmente.
      - Opción 2 [VENTA]: Empuja al cierre o pide el dato faltante (Email/Ciudad).
      - Opción 3 [TECNICA]: Resuelve dudas sobre cuencos o talleres.

      RESPONDE SOLO EN JSON:
      {
        "suggestions": [
          {"type": "EMPATIA", "text": "..."},
          {"type": "VENTA", "text": "..."},
          {"type": "TECNICA", "text": "..."}
        ]
      }
    `;

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${config.value}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await response.json();
    return new Response(aiData.choices[0].message.content, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})