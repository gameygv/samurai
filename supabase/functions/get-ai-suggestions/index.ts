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

    // 1. Obtener Datos del Lead para saber qué falta
    const { data: lead } = await supabaseClient.from('leads').select('nombre, ciudad, email').eq('id', lead_id).single();
    
    const missingData = [];
    if (!lead?.email) missingData.push("EMAIL");
    if (!lead?.ciudad) missingData.push("CIUDAD");
    if (!lead?.nombre || lead.nombre.includes('Nuevo')) missingData.push("NOMBRE");

    // 2. Obtener Contexto Maestro (Sam Persona)
    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context');

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const apiKey = configs?.find(c => c.key === 'openai_api_key')?.value;

    if (!apiKey) throw new Error("OpenAI API Key no configurada.");

    const prompt = `
      ${kernelData?.system_prompt}
      
      ---
      CONTEXTO DEL LEAD ACTUAL:
      - Nombre: ${lead?.nombre || 'Desconocido'}
      - Datos Faltantes: ${missingData.join(', ') || 'Ninguno, proceder al cierre.'}

      HISTORIAL RECIENTE:
      ${transcript}

      TU TAREA:
      Eres el Co-piloto de Sam. Genera 3 opciones de respuesta CORTAS (max 20 palabras) para que el humano las use.
      Deben sonar exactamente como Sam.
      
      ESTRATEGIA:
      - Si faltan datos, la opción [VENTA] DEBE pedirlos.
      - Si ya tenemos todo, la opción [VENTA] debe dar el link de pago.
      - La opción [EMPATIA] debe conectar con el sentimiento del cliente.

      RESPONDE SOLO EN JSON:
      {
        "suggestions": [
          {"type": "EMPATIA", "text": "Frase conectando espiritualmente..."},
          {"type": "VENTA", "text": "Frase para avanzar en el embudo o cerrar..."},
          {"type": "TECNICA", "text": "Dato específico sobre el taller o cuencos..."}
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