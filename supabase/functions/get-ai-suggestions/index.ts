import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

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

    // 1. Obtener API Key de Gemini
    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'gemini_api_key').single();
    if (!config?.value) throw new Error("Gemini API Key no configurada.");

    // 2. Obtener ADN Samurai para que las sugerencias tengan el tono correcto
    const { data: adn } = await supabaseClient.from('app_config').select('value').eq('key', 'prompt_adn_core').single();

    const prompt = `
      Actúa como el Samurai, el cerrador de ventas de elite de The Elephant Bowl.
      
      CONTEXTO DEL CEREBRO:
      ${adn?.value}

      HISTORIAL DE CHAT:
      ${transcript}

      TU TAREA:
      Genera 3 sugerencias de respuesta CORTAS y TÁCTICAS para que un humano las use.
      - Opción 1: Empática y suave.
      - Opción 2: Enfocada a cerrar/venta (call to action).
      - Opción 3: Resolutiva (responder duda técnica).

      Formato JSON estricto:
      {
        "suggestions": [
          {"type": "EMPATIA", "text": "..."},
          {"type": "VENTA", "text": "..."},
          {"type": "TECNICA", "text": "..."}
        ]
      }
    `;

    const response = await fetch(`${GEMINI_URL}?key=${config.value}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const aiData = await response.json();
    const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return new Response(cleanJson, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})