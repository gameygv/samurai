// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, mode } = await req.json();
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // MODO VISIÓN (Ojo de Halcón - Comprobantes / Posters)
    if (mode === 'VISION') {
       console.log(`[scrape-website] Modo Visión activado para: ${url}`);
       
       const { data: config } = await supabaseClient
          .from('app_config')
          .select('value')
          .eq('key', 'openai_api_key')
          .maybeSingle();
          
       if (!config?.value) throw new Error("OpenAI API Key no encontrada.");

       const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.value}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: "Analiza esta imagen. Si es un POSTER, extrae Título, Fechas, Ciudad y Precios. Si es un COMPROBANTE, extrae Banco, Monto, Referencia y Fecha. Responde en texto plano." 
                  },
                  { type: "image_url", image_url: { url: url } }
                ]
              }
            ],
            max_tokens: 500
          })
       });

       if (!response.ok) {
         const errorText = await response.text();
         throw new Error(`OpenAI API Error: ${errorText}`);
       }

       const aiData = await response.json();
       const text = aiData.choices[0]?.message?.content;

       return new Response(JSON.stringify({ success: true, content: text, mode: 'VISION' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    // MODO TEXTO (Estándar - Base de Conocimiento / Sitio Web)
    console.log(`[scrape-website] Modo Texto activado para: ${url}`);
    
    // 1. Fetch HTML con headers de navegador real para evitar bloqueos
    const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    // 2. Limpieza agresiva del HTML
    $('script, style, noscript, iframe, svg, nav, footer, header, form').remove();
    
    // 3. Extracción de imágenes relevantes (para la galería)
    const images: string[] = [];
    $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.includes('logo') && !src.includes('icon') && src.startsWith('http')) {
            images.push(src);
        }
    });

    // 4. Extracción de texto
    let content = $('body').text().replace(/\s\s+/g, ' ').trim();
    
    // Limite de seguridad para no saturar el prompt (15,000 caracteres)
    content = content.substring(0, 15000);

    if (!content) throw new Error("No se pudo extraer texto legible de la página.");

    return new Response(JSON.stringify({ success: true, content, images, mode: 'TEXT' }), { 
       headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("[scrape-website] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})