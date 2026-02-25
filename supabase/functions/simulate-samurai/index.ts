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

    const { question } = await req.json();

    // 1. Obtener API Key de Gemini
    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'gemini_api_key').single();
    if (!config?.value) throw new Error("Gemini API Key no configurada.");

    // 2. Obtener el Contexto Consolidado (Kernel) invocando la otra función interna o replicando lógica
    // Invocamos get-samurai-context para tener la última versión del cerebro
    const { data: kernelData, error: kernelError } = await supabaseClient.functions.invoke('get-samurai-context');
    if (kernelError) throw new Error("No se pudo obtener el contexto del Samurai.");

    const systemPrompt = kernelData.system_prompt;

    const prompt = `
      ${systemPrompt}

      ---
      PREGUNTA DEL USUARIO (SIMULACIÓN):
      "${question}"

      INSTRUCCIÓN PARA LA IA:
      Responde como el Samurai siguiendo estrictamente tu jerarquía. 
      Al final de tu respuesta, añade un bloque JSON que explique qué capas usaste (ej: si usaste datos de la web, si aplicaste una regla #CIA, etc).

      Formato de salida:
      [Tu respuesta aquí]
      
      --- EXPLICACIÓN TÉCNICA ---
      {
        "layers_used": ["LAYER 2", "LAYER 3"],
        "reasoning": "Resumen breve de por qué respondiste así."
      }
    `;

    const response = await fetch(`${GEMINI_URL}?key=${config.value}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const aiData = await response.json();
    const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "No se recibió respuesta de la IA.";
    
    // Separar respuesta de explicación
    const parts = rawText.split('--- EXPLICACIÓN TÉCNICA ---');
    const answer = parts[0].trim();
    let explanation = { layers_used: ["LAYER 2"], reasoning: "ADN Core estándar." };
    
    if (parts[1]) {
       try {
          explanation = JSON.parse(parts[1].trim());
       } catch (e) {
          console.error("Error parseando explicación JSON", e);
       }
    }
    
    return new Response(JSON.stringify({ answer, explanation }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})