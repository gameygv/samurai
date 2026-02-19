import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url, mode } = await req.json()

    if (!url) {
      throw new Error('URL es requerida.')
    }

    // MODO VISIÓN: Ojo de Halcón (Ya configurado con OpenAI)
    if (mode === 'VISION') {
        const openAiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openAiKey) throw new Error("OPENAI_API_KEY no configurada.");

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: "Analiza esta imagen para el sistema Samurai. Extrae todo el texto relevante (precios, fechas, nombres, bancos). Si es un comprobante, detalla la transferencia. Si es un poster, detalla el evento." },
                        { type: "image_url", image_url: { url: url } }
                    ]
                }],
                max_tokens: 1000
            })
        });

        const data = await response.json();
        return new Response(JSON.stringify({ success: true, content: data.choices?.[0]?.message?.content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // MODO TEXTO + IMÁGENES: Scraping estándar mejorado
    console.log("[scrape-website] Scraping profundo de:", url);
    
    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      } 
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - No se pudo acceder a la página.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 1. Extraer Imágenes con lógica multivariable (Lazy-loading friendly)
    const images: string[] = [];
    $('img').each((_, el) => {
       const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('srcset')?.split(' ')[0];
       
       if (src && src.startsWith('http')) {
          const lowerSrc = src.toLowerCase();
          // Ignorar logos, iconos y avatares comunes
          const isIcon = lowerSrc.includes('logo') || lowerSrc.includes('icon') || lowerSrc.includes('avatar') || lowerSrc.includes('favicon');
          
          if (!isIcon) {
            images.push(src);
          }
       }
    });

    // 2. Extraer Texto Limpio (Mejorado para evitar el error de "No se ha podido encontrar la página")
    // Si detectamos texto de error común, lanzamos alerta
    const bodyText = $('body').text();
    if (bodyText.includes('No se ha podido encontrar la página') || bodyText.includes('404 Not Found')) {
       console.warn("[scrape-website] Alerta: Página devolvió contenido de error 404.");
    }

    $('script, style, noscript, iframe, header, footer, nav, .error-404').remove();
    let text = $('body').text().replace(/\s+/g, ' ').trim();

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: text.substring(0, 15000), 
        images: [...new Set(images)].slice(0, 30) // Hasta 30 imágenes únicas
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[scrape-website] Error Crítico:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders })
  }
})