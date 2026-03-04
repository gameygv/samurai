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

  console.log("[simulate-samurai] Iniciando simulación...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { question } = await req.json();

    // 1. Obtener la API Key
    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').single();
    if (!config?.value) throw new Error("OpenAI API Key no encontrada en la tabla app_config.");

    // 2. Obtener los bloques de prompt actuales
    const { data: promptData } = await supabaseClient.from('app_config').select('key, value').eq('category', 'PROMPT');
    const getP = (key: string) => promptData?.find(p => p.key === key)?.value || "";

    // 3. Obtener Verdad Maestra (Sitio Web)
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truth = webContent?.map(w => `[WEB: ${w.title}]\n${w.content}`).join('\n\n') || "Sin datos web.";

    // 4. Construir el System Prompt igual que lo hace el Kernel Real
    const systemPrompt = `
      CONSTITUCIÓN SAMURAI:
      
      ALMA: ${getP('prompt_alma_samurai')}
      ADN CORE: ${getP('prompt_adn_core')}
      ESTRATEGIA: ${getP('prompt_estrategia_cierre')}
      BITÁCORA #CIA: ${getP('prompt_relearning')}
      
      VERDAD MAESTRA (HECHOS):
      ${truth}
    `;

    // 5. Llamada directa a OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${config.value}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        model: "gpt-4o",
        messages: [
            { role: "system", content: "Responde como el Samurai. Al final, añade '---JSON---' y un objeto JSON con: layers_used (array de strings) y reasoning (string)." },
            { role: "user", content: `CONTEXTO SISTEMA:\n${systemPrompt}\n\nMENSAJE CLIENTE: ${question}` }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
       const err = await response.text();
       throw new Error(`OpenAI Error: ${err}`);
    }

    const aiData = await response.json();
    const rawText = aiData.choices[0].message.content;
    
    const parts = rawText.split('---JSON---');
    const answer = parts[0].trim();
    let explanation = { layers_used: ["CAPA 3"], reasoning: "Respuesta generada por el motor GPT-4o." };

    if (parts[1]) {
        try {
            explanation = JSON.parse(parts[1].trim());
        } catch (e) {
            console.error("Error parseando JSON de IA");
        }
    }

    return new Response(JSON.stringify({ answer, explanation }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[simulate-samurai] Error crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 200, // Respondemos 200 para que el front maneje el error suavemente
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})