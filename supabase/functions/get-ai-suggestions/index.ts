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

    // Obtener datos actuales del lead para ver qué falta
    const { data: lead } = await supabaseClient.from('leads').select('nombre, ciudad, email').eq('id', lead_id).single();
    
    const missingData = [];
    if (!lead?.email) missingData.push("EMAIL (CRÍTICO para reservar)");
    if (!lead?.ciudad) missingData.push("CIUDAD (para dar fechas)");
    if (!lead?.nombre || lead.nombre.includes('Nuevo')) missingData.push("NOMBRE");

    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').single();
    if (!config?.value) throw new Error("OpenAI API Key no configurada.");

    const prompt = `
      Actúa como el Samurai, cerrador de ventas experto.
      
      ESTADO DEL LEAD:
      - Nombre: ${lead?.nombre || 'Desconocido'}
      - Datos Faltantes: ${missingData.join(', ') || 'Ninguno, tenemos todo.'}

      HISTORIAL RECIENTE:
      ${transcript}

      TU TAREA:
      Genera 3 opciones de respuesta CORTAS para el vendedor humano.
      
      IMPORTANTE:
      Si hay "Datos Faltantes", la opción [VENTA] DEBE enfocarse en pedir ese dato sutilmente para avanzar (ej: "Para enviarte el link, ¿me regalas tu correo?").

      RESPONDE SOLO EN JSON:
      {
        "suggestions": [
          {"type": "EMPATIA", "text": "Frase conectando con su emoción..."},
          {"type": "VENTA", "text": "Frase de cierre o petición de dato faltante..."},
          {"type": "TECNICA", "text": "Respuesta informativa breve..."}
        ]
      }
    `;

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.value}`, 'Content-Type': 'application/json' },
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