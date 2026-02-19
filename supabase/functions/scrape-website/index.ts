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

    // MODO VISIÓN: Análisis de Comprobantes de Pago y Posters
    if (mode === 'VISION') {
        const openAiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openAiKey) throw new Error("OPENAI_API_KEY no configurada.");

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
                              text: "Actúa como un analista de pagos. Extrae del comprobante: 1. Monto total, 2. Fecha y hora, 3. Banco emisor, 4. Número de referencia. Además, indica si el comprobante parece legítimo o si ves alteraciones sospechosas. Devuelve el análisis estructurado y claro." 
                            },
                            { type: "image_url", image_url: { url: url } }
                        ]
                    }
                ],
                max_tokens: 800
            })
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "No se detectó información.";

        return new Response(
            JSON.stringify({ success: true, content, length: content.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // MODO TEXTO: Scraping estándar
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SamuraiBot/1.0)' } });
    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();
    let text = $('body').text().replace(/\s+/g, ' ').trim();

    return new Response(
      JSON.stringify({ success: true, content: text.substring(0, 5000) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders })
  }
})