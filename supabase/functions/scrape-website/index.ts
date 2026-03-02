// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, mode } = await req.json();
    console.log(`[scrape-website] Iniciando OCR en modo OpenAI Vision...`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (mode === 'VISION') {
       // 1. Obtener OpenAI Key
       const { data: config } = await supabaseClient
          .from('app_config')
          .select('value')
          .eq('key', 'openai_api_key')
          .maybeSingle();
          
       if (!config?.value) {
          throw new Error("OpenAI API Key no encontrada. Por favor configúrala en Ajustes > API Keys.");
       }

       // 2. Procesar imagen mediante GPT-4o
       const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.value}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: "Analiza esta imagen de The Elephant Bowl. Si es un POSTER, extrae Título del curso, Fechas, Ciudad y Precios. Si es un COMPROBANTE DE PAGO, extrae Banco, Monto, Referencia y Fecha. Responde en texto plano estructurado." 
                  },
                  {
                    type: "image_url",
                    image_url: { url: url }
                  }
                ]
              }
            ],
            max_tokens: 500
          })
       });

       if (!response.ok) {
         const errorText = await response.text();
         throw new Error(`OpenAI API Error: ${errorText}`);
       }

       const aiData = await response.json();
       const text = aiData.choices[0]?.message?.content;

       if (!text) throw new Error("La IA no devolvió ningún contenido tras analizar la imagen.");

       console.log("[scrape-website] OCR con OpenAI exitoso.");
       return new Response(JSON.stringify({ success: true, content: text }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    return new Response(JSON.stringify({ success: false, error: "Modo no soportado." }), { 
       status: 400, headers: corsHeaders 
    });

  } catch (error) {
    console.error("[scrape-website] Error Crítico:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})