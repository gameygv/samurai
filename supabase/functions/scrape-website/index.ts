// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

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
    if (!url) throw new Error("URL is required");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (mode === 'VISION') {
       console.log(`[scrape-website] VISION mode started for URL: ${url}`);
       
       const { data: config, error: configError } = await supabaseClient.from('app_config').select('value').eq('key', 'gemini_api_key').single();
       if (configError || !config?.value) {
         throw new Error("Gemini API Key not found in app_config.");
       }
       console.log("[scrape-website] Gemini API Key loaded.");

       const imgResponse = await fetch(url);
       if (!imgResponse.ok) {
         throw new Error(`Failed to download image. Status: ${imgResponse.status} ${imgResponse.statusText}`);
       }
       console.log("[scrape-website] Image downloaded successfully.");

       const imgBlob = await imgResponse.blob();
       const arrayBuffer = await imgBlob.arrayBuffer();
       const base64String = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
       console.log(`[scrape-website] Image converted to Base64. Mime-type: ${imgBlob.type}`);

       const prompt = `
         Actúa como el sistema de visión avanzada 'Ojo de Halcón' de Samurai AI.
         Analiza esta imagen y extrae el texto de forma estructurada.

         IDENTIFICACIÓN:
         1. Si es un POSTER PROMOCIONAL: 
            - Extrae TÍTULO, FECHAS, CIUDAD y PRECIOS.
            - Resume qué incluye el taller.
            
         2. Si es un COMPROBANTE DE PAGO:
            - Extrae MONTO EXACTO, BANCO, FECHA y FOLIO/REFERENCIA.
            - Determina si el estado es EXITOSO.
         
         SALIDA REQUERIDA:
         Texto claro y conciso. No uses JSON, usa texto plano estructurado con guiones.
       `;

       const geminiPayload = {
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: imgBlob.type || "image/jpeg", data: base64String } }
            ]
          }]
       };

       const geminiResponse = await fetch(`${GEMINI_URL}?key=${config.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
       });
       console.log(`[scrape-website] Gemini API response status: ${geminiResponse.status}`);

       const responseBodyText = await geminiResponse.text();

       if (!geminiResponse.ok) {
         console.error("[scrape-website] Gemini API Error Response Body:", responseBodyText);
         throw new Error(`Gemini API request failed with status ${geminiResponse.status}. Response: ${responseBodyText}`);
       }

       const data = JSON.parse(responseBodyText);
       const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

       if (!text) {
         console.warn("[scrape-website] Gemini responded OK but no text was found in candidates.", data);
         throw new Error("Gemini analysis completed, but no text was extracted.");
       }
       
       console.log("[scrape-website] VISION mode completed successfully.");
       return new Response(JSON.stringify({ success: true, content: text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
    console.error("[scrape-website] CRITICAL ERROR in function:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})