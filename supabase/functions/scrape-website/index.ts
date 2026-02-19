import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
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

    // MODO VISIÓN: Ojo de Halcón
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
                        { type: "text", text: "Analiza esta imagen. Extrae precios, fechas y datos de transferencia si es un comprobante." },
                        { type: "image_url", image_url: { url: url } }
                    ]
                }],
                max_tokens: 1000
            })
        });

        const data = await response.json();
        return new Response(JSON.stringify({ success: true, content: data.choices?.[0]?.message?.content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // MODO TEXTO + IMÁGENES: Mejorado
    console.log(`[scrape-website] Intentando conexión con: ${url}`);
    
    // Forzamos URL absoluta y añadimos timestamp para evitar cache
    const targetUrl = new URL(url);
    const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;

    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1'
      } 
    });

    if (!response.ok) {
      throw new Error(`El sitio respondió con error ${response.status}. Puede que la URL esté mal o el sitio bloquee bots.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 1. Extraer Imágenes con resolución de URLs relativas
    const images: string[] = [];
    $('img').each((_, el) => {
       let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('srcset')?.split(' ')[0];
       
       if (src) {
          // Si la URL es relativa (/img/test.jpg), la convertimos en absoluta
          if (src.startsWith('/')) {
             src = `${baseUrl}${src}`;
          } else if (!src.startsWith('http')) {
             src = `${baseUrl}/${src}`;
          }

          const lowerSrc = src.toLowerCase();
          const isIcon = lowerSrc.includes('logo') || lowerSrc.includes('icon') || lowerSrc.includes('avatar') || lowerSrc.includes('favicon') || lowerSrc.includes('svg');
          
          // Filtramos imágenes muy pequeñas o de sistema
          if (!isIcon && !src.includes('base64')) {
            images.push(src);
          }
       }
    });

    // 2. Extraer Texto
    $('script, style, noscript, iframe, header, footer, nav').remove();
    let text = $('body').text().replace(/\s+/g, ' ').trim();

    if (text.length < 100) {
       throw new Error("La página se leyó pero no tiene contenido útil (posible bloqueo de contenido).");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: text.substring(0, 15000), 
        images: [...new Set(images)].slice(0, 40)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[scrape-website] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders })
  }
})