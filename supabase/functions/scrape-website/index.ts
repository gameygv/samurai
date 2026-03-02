// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { cheerio } from 'https://deno.land/x/cheerio@1.0.7/mod.ts'

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url, mode } = await req.json();
    if (!url) throw new Error("URL is required");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- MODO VISIÓN (GEMINI AI) ---
    if (mode === 'VISION') {
       console.log(`[Vision AI] Iniciando análisis de imagen: ${url}`);
       
       // 1. Obtener API Key de Gemini
       const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'gemini_api_key').single();
       if (!config?.value) throw new Error("Gemini API Key no configurada en Ajustes.");
       
       // 2. Descargar la imagen
       const imgResponse = await fetch(url);
       if (!imgResponse.ok) throw new Error(`Fallo al descargar imagen para OCR: ${imgResponse.statusText}`);
       
       const imgBlob = await imgResponse.blob();
       const arrayBuffer = await imgBlob.arrayBuffer();
       const base64String = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

       // 3. Prompt Táctico basado en el tipo de archivo (Samurai vs Ojo de Halcón)
       const prompt = `
         Actúa como el sistema de visión avanzada 'Ojo de Halcón' de Samurai AI.
         Analiza esta imagen y extrae el texto de forma estructurada.

         IDENTIFICACIÓN:
         1. Si es un POSTER PROMOCIONAL (Talleres, Cursos, Precios): 
            - Extrae el TÍTULO del curso.
            - Extrae FECHAS, CIUDAD y PRECIOS.
            - Resume qué incluye el taller.
            
         2. Si es un COMPROBANTE DE PAGO (Boucher, SPEI, Ticket OXXO):
            - Extrae MONTO EXACTO, BANCO, FECHA y FOLIO/REFERENCIA.
            - Determina si el estado es EXITOSO o si parece sospechoso/editado.
         
         SALIDA REQUERIDA:
         Texto estructurado y fácil de leer para la memoria de la IA. No uses markdown complejo.
       `;

       const geminiPayload = {
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: imgBlob.type || "image/jpeg", data: base64String } }
            ]
          }]
       };

       const response = await fetch(`${GEMINI_URL}?key=${config.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
       });

       const data = await response.json();
       
       if (data.error) {
          console.error("[Gemini Error]", data.error);
          throw new Error(data.error.message);
       }
       
       const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo extraer texto de la imagen.";

       return new Response(JSON.stringify({ 
          success: true, 
          content: text, 
          source: 'Gemini 1.5 Vision API' 
       }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    // --- MODO WEB (CHEERIO) ---
    console.log(`[Web Scraper] Leyendo sitio: ${url}`);
    const webResponse = await fetch(url, { headers: { 'User-Agent': BROWSER_USER_AGENT } });
    if (!webResponse.ok) throw new Error(`HTTP ${webResponse.status}`);

    const html = await webResponse.text();
    const $ = cheerio.load(html);
    $('script, style, noscript, nav, footer, header').remove();
    let content = $('body').text().replace(/\s+/g, ' ').trim();

    return new Response(JSON.stringify({ 
        success: true, 
        content: content.substring(0, 10000),
        source: 'Cheerio Scraper' 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("[scrape-website] Error Crítico:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})