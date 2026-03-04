// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { question, customPrompts } = await req.json();

    // 1. Obtener la API Key
    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').single();
    if (!config?.value) throw new Error("OpenAI API Key no encontrada.");

    // 2. Usar prompts enviados por el usuario o caer en los de la DB
    let pAlma = customPrompts?.prompt_alma_samurai;
    let pAdn = customPrompts?.prompt_adn_core;
    let pEstrategia = customPrompts?.prompt_estrategia_cierre;
    let pRelearning = customPrompts?.prompt_relearning;

    if (!pAlma) {
        const { data: promptData } = await supabaseClient.from('app_config').select('key, value').eq('category', 'PROMPT');
        const getP = (key: string) => promptData?.find(p => p.key === key)?.value || "";
        pAlma = getP('prompt_alma_samurai');
        pAdn = getP('prompt_adn_core');
        pEstrategia = getP('prompt_estrategia_cierre');
        pRelearning = getP('prompt_relearning');
    }

    // 3. Obtener Verdad Maestra
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truth = webContent?.map(w => `[WEB: ${w.title}]\n${w.content}`).join('\n\n') || "Sin datos web.";

    const systemPrompt = `
      CONSTITUCIÓN SAMURAI ACTUAL (MODO SIMULACIÓN):
      
      ALMA: ${pAlma}
      ADN CORE: ${pAdn}
      ESTRATEGIA: ${pEstrategia}
      BITÁCORA #CIA: ${pRelearning}
      
      VERDAD MAESTRA (HECHOS):
      ${truth}
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.value}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: "gpt-4o",
        messages: [
            { role: "system", content: "Eres Sam. Responde como el Samurai. Al final, añade '---JSON---' y un objeto JSON con: layers_used (array de strings) y reasoning (string)." },
            { role: "user", content: `CONTEXTO SISTEMA:\n${systemPrompt}\n\nMENSAJE CLIENTE: ${question}` }
        ],
        temperature: 0.7
      })
    });

    const aiData = await response.json();
    if (aiData.error) throw new Error(aiData.error.message);

    const rawText = aiData.choices[0].message.content;
    const parts = rawText.split('---JSON---');
    const answer = parts[0].trim();
    let explanation = { layers_used: ["CAPA 3"], reasoning: "Motor GPT-4o activo." };

    if (parts[1]) {
        try { explanation = JSON.parse(parts[1].trim()); } catch (e) {}
    }

    return new Response(JSON.stringify({ answer, explanation }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})