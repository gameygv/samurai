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

    const { lead_id, transcript } = await req.json();

    // 1. Obtener Datos del Lead
    const { data: lead } = await supabaseClient.from('leads').select('nombre, ciudad, email').eq('id', lead_id).single();
    
    const missingData = [];
    if (!lead?.email) missingData.push("EMAIL");
    if (!lead?.ciudad) missingData.push("CIUDAD");
    if (!lead?.nombre || lead.nombre.includes('Nuevo')) missingData.push("NOMBRE");

    // 2. Obtener Configuración y Contexto Maestro
    const [{ data: configs }, { data: kernelData }] = await Promise.all([
       supabaseClient.from('app_config').select('key, value'),
       supabaseClient.functions.invoke('get-samurai-context') // Heredar identidad de Sam
    ]);

    const apiKey = configs?.find(c => c.key === 'openai_api_key')?.value;
    if (!apiKey) throw new Error("OpenAI API Key no configurada.");

    // Extraer solo las reglas de identidad del Kernel para no gastar tantos tokens, 
    // pero asegurando que se mantenga el personaje.
    const personaRules = kernelData?.system_prompt 
       ? kernelData.system_prompt.split('---')[0] // Tomamos la primera parte (Identidad + Reglas Seguridad)
       : "Eres Sam, asistente de ventas amable y espiritual.";

    const prompt = `
      ${personaRules}
      
      ESTADO DEL LEAD:
      - Nombre: ${lead?.nombre || 'Desconocido'}
      - Datos Faltantes: ${missingData.join(', ') || 'Ninguno, tenemos todo.'}

      HISTORIAL RECIENTE DEL CHAT:
      ${transcript}

      TU TAREA:
      Genera 3 opciones de respuesta CORTAS (max 15 palabras) para que el vendedor humano las use.
      Deben sonar como tú (Sam).
      
      ESTRATEGIA:
      - Si hay "Datos Faltantes", la opción [VENTA] DEBE intentar conseguirlos sutilmente.
      - Si el cliente ya dio los datos, ve al CIERRE (Link de pago).
      - Mantén el tono espiritual pero profesional.

      RESPONDE SOLO EN JSON:
      {
        "suggestions": [
          {"type": "EMPATIA", "text": "Frase conectando con su emoción..."},
          {"type": "VENTA", "text": "Frase táctica para avanzar al pago o pedir dato..."},
          {"type": "TECNICA", "text": "Respuesta informativa breve..."}
        ]
      }
    `;

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7
      })
    });

    const aiData = await response.json();
    return new Response(aiData.choices[0].message.content, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})