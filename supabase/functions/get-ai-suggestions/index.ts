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

    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    
    const missingData = [];
    if (!lead?.email) missingData.push("EMAIL");
    if (!lead?.ciudad) missingData.push("CIUDAD");
    if (!lead?.nombre || lead.nombre.includes('Nuevo')) missingData.push("NOMBRE");

    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context', {
       body: { lead: lead }
    });

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";
    
    const apiKey = getConfig('openai_api_key');
    if (!apiKey) throw new Error("OpenAI API Key no configurada.");

    const pSuggestions = getConfig('prompt_ai_suggestions', `
Eres el Co-piloto de la IA. Genera 3 opciones de respuesta CORTAS (max 30 palabras) para que el humano las use.
Deben sonar exactamente como la IA. NUNCA uses la etiqueta <<MEDIA:URL>> en las sugerencias.
RESPONDE SOLO EN JSON:
{
  "suggestions": [
    {"type": "EMPATIA", "text": "Frase conectando con el cliente..."},
    {"type": "VENTA", "text": "Frase para avanzar en la venta..."},
    {"type": "TECNICA", "text": "Dato específico sobre el producto..."}
  ]
}
    `);

    const prompt = `
      ${kernelData?.system_prompt}
      
      ---
      CONTEXTO DEL LEAD ACTUAL:
      - Nombre: ${lead?.nombre || 'Desconocido'}
      - Datos Faltantes: ${missingData.join(', ') || 'Ninguno, proceder al cierre.'}

      HISTORIAL RECIENTE:
      ${transcript}

      TU TAREA:
      ${pSuggestions}
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

    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${await response.text()}`);
    const aiData = await response.json();
    return new Response(aiData.choices?.[0]?.message?.content || '{}', { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})