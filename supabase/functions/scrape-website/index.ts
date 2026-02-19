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

    if (!url) throw new Error('URL es requerida.')

    if (mode === 'VISION') {
        const openAiKey = Deno.env.get('OPENAI_API_KEY');
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: "Analiza esta imagen y extrae datos clave." },
                        { type: "image_url", image_url: { url: url } }
                    ]
                }]
            })
        });
        const data = await response.json();
        return new Response(JSON.stringify({ success: true, content: data.choices?.[0]?.message?.content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // SCRAPER CON HEADERS DE NAVEGACIÓN REAL
    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
       throw new Error(`El sitio theelephantbowl.com rechazó la conexión (${response.status}). Es posible que necesite una actualización de IP o bypass de Cloudflare.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Limpieza agresiva de basura web
    $('script, style, noscript, iframe, header, footer, nav, aside').remove();
    let text = $('body').text().replace(/\s+/g, ' ').trim();

    if (text.length < 100) throw new Error("Contenido insuficiente detectado. El sitio puede estar bloqueando el renderizado.");

    return new Response(
      JSON.stringify({ success: true, content: text.substring(0, 15000) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders })
  }
})