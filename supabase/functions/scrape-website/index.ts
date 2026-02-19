import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { Cheerio, cheerio } from 'https://deno.land/x/cheerio@1.0.7/mod.ts'

// Simula ser un navegador real para evitar bloqueos simples
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

async function scrapeUrl(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });

    // Valida si la respuesta es exitosa (código 200)
    if (!response.ok) {
      throw new Error(`El sitio devolvió un estado de error: ${response.status} ${response.statusText}. Posible bloqueo de seguridad.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Elimina elementos que no contienen contenido relevante (menús, scripts, etc.)
    $('script, style, nav, footer, header, .header, .footer, #header, #footer, .sidebar, #sidebar, .ad, .ads, .advertisement, form, noscript, link, meta').remove();
    
    // Intenta obtener el contenido del <main>, si no existe, del <body>
    let textContent = $('main').length ? $('main').text() : $('body').text();

    // Limpieza avanzada del texto
    textContent = textContent
      .replace(/<[^>]*>/g, ' ')      // Quitar remanentes de HTML
      .replace(/\s\s+/g, ' ')       // Reemplazar múltiples espacios/saltos con uno solo
      .replace(/\n\s*\n/g, '\n')     // Reemplazar múltiples saltos de línea con uno
      .trim();

    if (textContent.length < 100) {
      // Si el contenido es muy corto, puede ser una página de error o un CAPTCHA
      throw new Error(`Contenido extraído muy corto (${textContent.length} caracteres). El sitio puede estar presentando un CAPTCHA o una página de error vacía.`);
    }
    
    // Extracción de URLs de imágenes
    const images: string[] = [];
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      if (src && (src.startsWith('http') || src.startsWith('/'))) {
        // Resuelve URLs relativas a absolutas
        const absoluteUrl = new URL(src, url).href;
        images.push(absoluteUrl);
      }
    });
    const uniqueImages = [...new Set(images)];

    return {
      success: true,
      content: textContent,
      images: uniqueImages,
    };

  } catch (error) {
    console.error(`[Scraper] Error crítico en ${url}:`, error);
    return {
      success: false,
      error: error.message || 'Error desconocido durante el scraping.',
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json();
    if (!url) {
      throw new Error("La URL es requerida en el cuerpo de la petición.");
    }

    const data = await scrapeUrl(url);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})