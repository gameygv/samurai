// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

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

    const { question } = await req.json();

    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').single();
    if (!config?.value) throw new Error("OpenAI API Key no configurada en Ajustes.");

    // Enviamos un Lead ficticio para probar que el simulador respete las reglas del email
    const mockLead = { nombre: "Usuario Simulado", email: "correo@simulador.com", telefono: "5551234567" };

    const { data: kernelData, error: kernelError } = await supabaseClient.functions.invoke('get-samurai-context', {
        body: { lead: mockLead }
    });
    
    if (kernelError) throw new Error("No se pudo obtener el contexto del Samurai.");

    const systemPrompt = kernelData.system_prompt;

    const prompt = `
      ${systemPrompt}

      ---
      PREGUNTA DEL USUARIO (SIMULACIÓN):
      "${question}"

      INSTRUCCIÓN PARA LA IA:
      Responde como el Samurai siguiendo estrictamente tu jerarquía. 
      Al final de tu respuesta, añade un separador y un bloque JSON explicando tu razonamiento.

      Formato de salida OBLIGATORIO:
      [Tu respuesta como Samurai aquí]
      
      --- EXPLICACIÓN TÉCNICA ---
      {
        "layers_used": ["LAYER 2 (Web)", "LAYER 3 (ADN)"],
        "reasoning": "Explica brevemente por qué elegiste esa respuesta basándote en tus reglas."
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
        messages: [
            { role: "system", content: "Eres un simulador de entrenamiento de IA. Tu trabajo es ejecutar el prompt del usuario y luego explicar tu razonamiento." },
            { role: "user", content: prompt }
        ],
        temperature: 0.5
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI Error: ${errText}`);
    }

    const aiData = await response.json();
    const rawText = aiData?.choices?.[0]?.message?.content || "No se recibió respuesta de la IA.";
    
    const parts = rawText.split('--- EXPLICACIÓN TÉCNICA ---');
    const answer = parts[0].trim();
    let explanation = { layers_used: ["LAYER 3"], reasoning: "Respuesta estándar generada por GPT-4o." };
    
    if (parts[1]) {
       try {
          const jsonStr = parts[1].trim().replace(/```json/g, '').replace(/```/g, '');
          explanation = JSON.parse(jsonStr);
       } catch (e) {
          console.error("Error parseando explicación JSON", e);
       }
    }
    
    return new Response(JSON.stringify({ answer, explanation }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})