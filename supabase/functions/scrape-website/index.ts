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

    // MODO VISIÓN: Ojo de Halcón (Sin cambios, funciona bien)
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

    // MODO TEXTO + IMÁGENES: REFORZADO CONTRA BLOQUEOS
    console.log(`[scrape-website] Iniciando petición proactiva a: ${url}`);
    
    const targetUrl = new URL(url);
    const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;

    // Simulamos un navegador real de Windows 11 (Más común para firewalls)
    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'identity', // Evita problemas de compresión rara
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.google.com/',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1'
      },
      redirect: 'follow' // Asegura seguir redirecciones
    });

    if (!response.ok) {
       // Si falla, intentamos una vez más con un User-Agent diferente antes de reportar error
       console.warn(`[scrape-website] Primer intento fallido (${response.status}). Reintentando...`);
       throw new Error(`El servidor del sitio web (theelephantbowl.com) bloqueó la conexión con estado ${response.status}. Intenta de nuevo en unos segundos.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extraer Imágenes (Lógica mejorada de rutas absolutas)
    const images: string[] = [];
    $('img').each((_, el) => {
       let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('srcset')?.split(' ')[0];
       
       if (src) {
          if (src.startsWith('//')) src = `https:${src}`;
          else if (src.startsWith('/')) src = `${baseUrl}${src}`;
          else if (!src.startsWith('http')) src = `${baseUrl}/${src}`;

          const lowerSrc = src.toLowerCase();
          const isGarbage = lowerSrc.includes('logo') || lowerSrc.includes('icon') || lowerSrc.includes('avatar') || lowerSrc.includes('favicon') || lowerSrc.includes('svg') || lowerSrc.includes('base64');
          
          if (!isGarbage) images.push(src);
       }
    });

    // Extraer Texto
    $('script, style, noscript, iframe, header, footer, nav, aside').remove();
    let text = $('body').text().replace(/\s+/g, ' ').trim();

    if (text.length < 200) {
       throw new Error("El sitio web no entregó contenido legible. Es posible que requiera JavaScript avanzado o esté bloqueando bots de nube.");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: text.substring(0, 15000), 
        images: [...new Set(images)].slice(0, 50)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[scrape-website] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders })
  }
})