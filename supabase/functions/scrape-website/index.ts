import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url, mode } = await req.json()

    if (!url) {
      throw new Error('URL del asset es requerida.')
    }

    // MODO VISIÓN: Ojo de Halcón
    if (mode === 'VISION') {
        const openAiKey = Deno.env.get('OPENAI_API_KEY');
        
        if (!openAiKey) {
           return new Response(
              JSON.stringify({ success: false, error: "CRÍTICO: OPENAI_API_KEY no configurada en Supabase > Edge Functions > Manage Secrets." }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           );
        }

        console.log("[scrape-website] Iniciando análisis de visión para:", url);

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
                            { 
                              type: "text", 
                              text: "Actúa como el Ojo de Halcón del sistema Samurai. Analiza esta imagen. Si es un COMPROBANTE DE PAGO, extrae: Banco, Monto, Fecha y Referencia. Si es un POSTER DE EVENTO, extrae: Nombre del evento, Maestro, Fecha, Lugar y Precios. Devuelve la información de forma estructurada y breve para que la IA la aprenda." 
                            },
                            { type: "image_url", image_url: { url: url } }
                        ]
                    }
                ],
                max_tokens: 1000
            })
        });

        if (!response.ok) {
           const errText = await response.text();
           throw new Error(`OpenAI Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "No se detectó información en la imagen.";

        return new Response(
            JSON.stringify({ success: true, content, length: content.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // MODO TEXTO: Scraping estándar
    console.log("[scrape-website] Scraping texto de:", url);
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SamuraiBot/1.0)' } });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    $('script, style, noscript, iframe, header, footer, nav').remove();
    let text = $('body').text().replace(/\s+/g, ' ').trim();

    return new Response(
      JSON.stringify({ success: true, content: text.substring(0, 8000) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[scrape-website] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})