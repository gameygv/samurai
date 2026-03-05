// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, mode, assetCategory } = await req.json();
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // MODO VISIÓN (Análisis de Imágenes por OCR)
    if (mode === 'VISION') {
       console.log(`[scrape-website] Modo Visión activado para URL: ${url} | Categoría: ${assetCategory}`);
       
       if (!url) throw new Error("No se proporcionó una URL de imagen válida.");

       const { data: configs } = await supabaseClient.from('app_config').select('key, value');
       const apiKey = configs?.find(c => c.key === 'openai_api_key')?.value;
       
       let customVisionPrompt = "";

       // AISLAMIENTO: Si es Poster, usamos un prompt exhaustivo de extracción comercial.
       // Si es Payment, usamos Ojo de Halcón (Auditoría Financiera).
       if (assetCategory === 'POSTER') {
          customVisionPrompt = "Eres un asistente experto en extracción de datos. Analiza este póster promocional y extrae textualmente TODA la información comercial que contiene: Título del Taller, Fechas exactas, Ciudad/Ubicación, Precios (Preventa y Regular), Horarios desglosados, el NOMBRE DEL PROFESOR o maestro que lo imparte (dato crucial), Dirección completa y cualquier otro dato visible. Tu respuesta debe ser clara, estructurada y basada 100% en lo que ves en la imagen. No inventes datos.";
       } else {
          customVisionPrompt = configs?.find(c => c.key === 'prompt_vision_instrucciones')?.value;
          // Fallback de seguridad estricto para pagos
          if (!customVisionPrompt || customVisionPrompt.trim() === '') {
             customVisionPrompt = "Analiza esta imagen con extremo detalle y precisión. Si es un COMPROBANTE DE PAGO: Extrae Banco, Monto transferido, Fecha y Referencia. Responde en texto plano.";
          }
       }
          
       if (!apiKey) throw new Error("OpenAI API Key no encontrada en Ajustes.");

       const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: customVisionPrompt },
                  { type: "image_url", image_url: { url: url } }
                ]
              }
            ],
            max_tokens: 800,
            temperature: 0.1 // Baja temperatura para precisión matemática
          })
       });

       if (!response.ok) {
         const errorText = await response.text();
         console.error("[scrape-website] Error OpenAI:", errorText);
         throw new Error(`OpenAI rechazó la imagen. Asegúrate de que el formato sea soportado (JPG/PNG).`);
       }

       const aiData = await response.json();
       const text = aiData.choices[0]?.message?.content;

       return new Response(JSON.stringify({ success: true, content: text, mode: 'VISION' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    // MODO TEXTO (Estándar - Base de Conocimiento / Sitio Web)
    console.log(`[scrape-website] Modo Texto activado para: ${url}`);
    
    const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script, style, noscript, iframe, svg, nav, footer, header, form').remove();
    
    const images: string[] = [];
    $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.includes('logo') && !src.includes('icon') && src.startsWith('http')) {
            images.push(src);
        }
    });

    let content = $('body').text().replace(/\s\s+/g, ' ').trim();
    content = content.substring(0, 15000);

    if (!content) throw new Error("No se pudo extraer texto legible de la página.");

    return new Response(JSON.stringify({ success: true, content, images, mode: 'TEXT' }), { 
       headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("[scrape-website] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})