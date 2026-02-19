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
      throw new Error('URL is required')
    }

    // MODO VISIÓN: Escaneo de Posters mediante IA
    if (mode === 'VISION') {
        console.log(`[Vision] Escaneando imagen: ${url}`);
        
        const openAiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openAiKey) throw new Error("OPENAI_API_KEY no configurada en Supabase.");

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openAiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Extrae todo el texto de este poster de cursos. Enfócate en: Ciudad, Fechas, Nombre del Curso y Precio. Devuelve solo el texto plano extraído." },
                            { type: "image_url", image_url: { url: url } }
                        ]
                    }
                ],
                max_tokens: 500
            })
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "No se detectó texto.";

        return new Response(
            JSON.stringify({ success: true, content, length: content.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // MODO TEXTO: Scraping estándar de sitios web
    console.log(`[Scrape] Scraping URL: ${url}`);
    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SamuraiBot/1.0)' }
    });

    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script, style, noscript, iframe, svg, header, footer').remove();
    let text = $('body').text().replace(/\s+/g, ' ').trim();
    const truncatedText = text.substring(0, 5000);

    return new Response(
      JSON.stringify({ 
        success: true, 
        title: $('title').text() || url,
        content: truncatedText,
        length: truncatedText.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Operation Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})