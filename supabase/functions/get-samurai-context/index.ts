import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[get-samurai-context] Reconstruyendo consciencia 5-Layer del Samurai...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Obtener configuraciones base (ADN, Protocolos, etc)
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || "";

    // 2. Obtener Verdad Maestra (Sitio Web)
    const { data: webContent } = await supabaseClient
      .from('main_website_content')
      .select('title, content')
      .eq('scrape_status', 'success');
    
    const truthBlock = webContent?.map(w => `[FUENTE OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') 
      || "Sin datos oficiales indexados.";

    // 3. Obtener Catálogo de Media (Imágenes con Triggers y OCR)
    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, url, ai_instructions');

    const mediaCatalog = mediaAssets?.map(m => {
       const [trigger, ocr] = (m.ai_instructions || "").split('--- OCR DATA ---');
       return `[ACTIVO VISUAL: ${m.title}]
- URL: ${m.url}
- CUANDO USAR: ${trigger?.trim() || 'No especificado'}
- CONTENIDO DEL POSTER (LECTURA OCR): ${ocr?.trim() || 'Sin datos de texto'}`;
    }).join('\n\n') || "No hay activos visuales en biblioteca.";

    // 4. Obtener Reglas #CIA (Aprendizaje)
    const learningBlock = getConfig('prompt_relearning') || "Sin lecciones previas.";

    const systemPrompt = `
# CAPA 1: REGLAS CRÍTICAS DE APRENDIZAJE (#CIA)
IMPORTANTE: Estas reglas son correcciones a errores que cometiste en el pasado. Tienen prioridad absoluta sobre el ADN.
${learningBlock}

# CAPA 2: IDENTIDAD Y ADN (SAMURAI)
${getConfig('prompt_adn_core')}
${getConfig('prompt_protocolos')}
${getConfig('prompt_estrategia_cierre')}

# CAPA 3: FUENTE DE VERDAD ABSOLUTA (CONTEXTO WEB)
Solo puedes afirmar datos que aparezcan aquí. No inventes fechas ni precios que no estén en este bloque:
${truthBlock}

# CAPA 4: CATÁLOGO DE ACTIVOS VISUALES (MEDIA MANAGER)
Tienes permiso para enviar estas imágenes. Identifica si el contexto del cliente coincide con el campo "CUANDO USAR":
${mediaCatalog}

# CAPA 5: INSTRUCCIONES DE VISIÓN (OJO DE HALCÓN)
${getConfig('prompt_vision_instrucciones')}

# REGLA DE ORO
Eres un cerrador de ventas. Si el cliente muestra interés, usa los activos visuales (Layer 4) para reforzar la venta. No alucines información fuera de la Verdad Maestra (Layer 3).
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: systemPrompt,
        version: "3.0.0-HIERARCHY_CORE",
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[get-samurai-context] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})