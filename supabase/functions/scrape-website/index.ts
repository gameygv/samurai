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
    // Usado para: Posters (Media Manager) y Comprobantes de Pago (Pagos)
    if (mode === 'VISION') {
       console.log(`[Vision AI] Analyzing Image: ${url}`);
       
       // 1. Obtener API Key
       const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'gemini_api_key').single();
       if (!config?.value) throw new Error("Gemini API Key no configurada.");
       
       // 2. Descargar Imagen
       const imgReq = await fetch(url);
       if (!imgReq.ok) throw new Error(`Failed to fetch image: ${imgReq.statusText}`);
       const imgBlob = await imgReq.blob();
       const arrayBuffer = await imgBlob.arrayBuffer();
       const base64String = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

       // 3. Prompt de Visión Especializado
       const prompt = `
         Actúa como el sistema de visión 'Ojo de Halcón' de Samurai AI.
         Analiza esta imagen y extrae TODO el texto relevante.
         
         Si es un POSTER PROMOCIONAL:
         - Extrae Título, Fechas, Lugar, Precios y Qué incluye.
         - Resume de qué trata el evento en 1 frase.
         
         Si es un COMPROBANTE DE PAGO (Transferencia/Ticket):
         - Extrae Monto, Banco, Fecha, Referencia/Folio y Estado (Exitoso/Pendiente).
         
         Salida: TEXTO PLANO limpio y estructurado. No uses markdown complejo.
       `;

       const response = await fetch(`${GEMINI_URL}?key=${config.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: imgBlob.type || 'image/jpeg', data: base64String } }
              ]
            }]
          })
       });

       const data = await response.json();
       
       if (data.error) throw new Error(`Gemini Error: ${data.error.message}`);
       
       const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se detectó texto legible.";

       return new Response(JSON.stringify({ 
          success: true, 
          content: text, 
          source: 'Gemini 1.5 Flash Vision' 
       }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    // --- MODO TEXTO (WEB SCRAPING CLASSIC) ---
    // Usado para: Verdad Maestra (Sitio Web)
    console.log(`[Web Scraper] Reading: ${url}`);
    
    const response = await fetch(url, {
        headers: { 
          'User-Agent': BROWSER_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    // Limpieza agresiva
    $('script, style, noscript, iframe, svg, header, footer, nav, button, .cookie-banner').remove();
    
    // Extracción de contenido principal
    let content = $('body').text().replace(/\s+/g, ' ').trim();
    
    // Extracción de imágenes (para importar al Media Manager)
    const images = [];
    $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
            images.push(src);
        }
    });

    // Truncar para no exceder límites de contexto
    const truncatedContent = content.substring(0, 8000);

    return new Response(JSON.stringify({ 
        success: true, 
        content: truncatedContent, 
        images: images.slice(0, 10), // Top 10 imágenes
        source: 'Cheerio Scraper' 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Scrape Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})