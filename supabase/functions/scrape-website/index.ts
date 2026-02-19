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

    // MODO TEXTO + IMÁGENES: Scraping estándar
    console.log("[scrape-website] Scraping profundo de:", url);
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SamuraiBot/1.0' } });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 1. Extraer Imágenes
    const images: string[] = [];
    $('img').each((_, el) => {
       const src = $(el).attr('src');
       if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
          images.push(src);
       }
    });

    // 2. Extraer Texto Limpio
    $('script, style, noscript, iframe, header, footer, nav').remove();
    let text = $('body').text().replace(/\s+/g, ' ').trim();

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: text.substring(0, 10000), 
        images: [...new Set(images)].slice(0, 15) // Top 15 imágenes únicas
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders })
  }
})