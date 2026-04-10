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
    const { url, mode, assetCategory, autoFill, categoryFields } = await req.json();
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // MODO VISIÓN (Análisis de Imágenes por OCR)
    if (mode === 'VISION') {
       console.log(`[scrape-website] Modo Visión activado para URL: ${url} | Categoría: ${assetCategory}`);
       
       if (!url) throw new Error("No se proporcionó una URL de imagen válida.");

       const { data: configs } = await supabaseClient.from('app_config').select('key, value');
       const apiKey = Deno.env.get('OPENAI_API_KEY') || configs?.find(c => c.key === 'openai_api_key')?.value;
       
       let customVisionPrompt = "";

       // Auto-fill mode: extraer campos estructurados para categorías de Media Manager y Cursos
       if (autoFill) {
          const fieldsHint = Array.isArray(categoryFields) ? categoryFields.join(', ') : 'title, description, ai_instructions';
          customVisionPrompt = `Eres un asistente experto en análisis de imágenes promocionales y educativas. Analiza esta imagen y extrae TODA la información visible.

RESPONDE EN FORMATO JSON con estos campos (usa null si no puedes inferir):
{
  "ocr_text": "todo el texto visible en la imagen tal cual",
  "title": "título del evento/promoción/aviso",
  "description": "descripción breve del contenido (máximo 200 palabras)",
  ${fieldsHint.includes('presale_price') ? '"presale_price": número o null,\n  "presale_ends_at": "YYYY-MM-DD" o null,\n  "normal_price": número o null,' : ''}
  ${fieldsHint.includes('start_date') ? '"start_date": "YYYY-MM-DD" o null,' : ''}
  ${fieldsHint.includes('valid_until') ? '"valid_until": "YYYY-MM-DD" o null,' : ''}
  ${fieldsHint.includes('nivel') ? '"nivel": "nivel detectado" o null,' : ''}
  ${fieldsHint.includes('sede') ? '"sede": "ubicación/sede" o null,' : ''}
  ${fieldsHint.includes('profesor') ? '"profesor": "nombre del profesor" o null,' : ''}
  ${fieldsHint.includes('extras') ? '"extras": "eventos adicionales como conciertos, actividades extra" o null,' : ''}
  ${fieldsHint.includes('session_dates') ? '"session_dates": [{"date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM"}] o [],' : ''}
  "ai_instructions": "genera un prompt en español para un agente IA de ventas indicándole CUÁNDO debe enviar esta imagen al cliente. Sé específico: menciona el contexto de la conversación, intereses del lead, y condiciones temporales basadas en las fechas detectadas."
}

REGLAS:
- Solo extrae datos visibles, NO inventes.
- Las fechas deben estar en formato YYYY-MM-DD.
- Para ai_instructions: genera un prompt útil basándote en el contenido del poster.
- Responde SOLO el JSON, sin texto adicional.`;
       } else if (assetCategory === 'POSTER' || assetCategory === 'POSTER_PROMO' || assetCategory === 'COURSE') {
          customVisionPrompt = configs?.find(c => c.key === 'prompt_vision_poster')?.value;
          if (!customVisionPrompt) {
             customVisionPrompt = "Eres un asistente experto en extracción de datos. Analiza esta imagen promocional y extrae textualmente TODA la información comercial que contiene: Título, Fechas, Ubicación, Precios y cualquier otro dato visible. No inventes datos.";
          }
       } else {
          customVisionPrompt = configs?.find(c => c.key === 'prompt_vision_instrucciones')?.value;
          if (!customVisionPrompt || customVisionPrompt.trim() === '') {
             customVisionPrompt = "Analiza esta imagen con extremo detalle y precisión. Si es un COMPROBANTE DE PAGO: Extrae Banco, Monto transferido, Fecha y Referencia. Responde en texto plano.";
          }
       }
          
       if (!apiKey) throw new Error("OpenAI API Key no encontrada en Ajustes.");

       const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: customVisionPrompt },
                  { type: "image_url", image_url: { url: url } }
                ]
              }
            ],
            max_tokens: 800,
            temperature: 0.1 // Baja temperatura para precisión
          })
       });

       if (!response.ok) {
         const errorText = await response.text();
         console.error("[scrape-website] Error OpenAI:", errorText);
         throw new Error(`OpenAI rechazó la imagen. Asegúrate de que el formato sea soportado (JPG/PNG).`);
       }

       const aiData = await response.json();
       const text = aiData.choices[0]?.message?.content;

       // If autoFill mode, parse the JSON response to extract structured fields
       if (autoFill && text) {
          try {
             // Clean potential markdown code fences from the response
             const cleanJson = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
             const parsed = JSON.parse(cleanJson);
             return new Response(JSON.stringify({
                success: true,
                content: parsed.ocr_text || text,
                extracted: {
                   title: parsed.title || null,
                   description: parsed.description || null,
                   presale_price: parsed.presale_price || null,
                   presale_ends_at: parsed.presale_ends_at || null,
                   normal_price: parsed.normal_price || null,
                   start_date: parsed.start_date || null,
                   valid_until: parsed.valid_until || null,
                   nivel: parsed.nivel || null,
                   sede: parsed.sede || null,
                   profesor: parsed.profesor || null,
                   extras: parsed.extras || null,
                   session_dates: parsed.session_dates || [],
                   ai_instructions: parsed.ai_instructions || null,
                },
                mode: 'VISION_AUTOFILL'
             }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          } catch (_parseErr) {
             // If JSON parsing fails, return raw text as fallback
             console.error("[scrape-website] AutoFill JSON parse failed, returning raw text");
          }
       }

       return new Response(JSON.stringify({ success: true, content: text, mode: 'VISION' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    // MODO TEXTO (Estándar - Base de Conocimiento / Sitio Web)
    console.log(`[scrape-website] Modo Texto activado para: ${url}`);
    
    const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script, style, noscript, iframe, svg, nav, footer, header, form').remove();
    
    let content = $('body').text().replace(/\s\s+/g, ' ').trim();
    content = content.substring(0, 15000);

    if (!content) throw new Error("No se pudo extraer texto legible de la página.");

    return new Response(JSON.stringify({ success: true, content, mode: 'TEXT' }), { 
       headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("[scrape-website] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})