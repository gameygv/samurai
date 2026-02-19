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

  console.log("[get-samurai-brain] Generando Identidad Maestra...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. OBTENER PROMPTS DE IDENTIDAD (Filtrado robusto)
    const { data: configs } = await supabaseClient
      .from('app_config')
      .select('key, value');

    const p = (key: string) => configs?.find(c => c.key === key)?.value || "";

    // 2. OBTENER VERDAD MAESTRA (Contenido de theelephantbowl.com)
    const { data: webContent } = await supabaseClient
      .from('main_website_content')
      .select('title, content')
      .eq('scrape_status', 'success');

    const truthBlock = webContent?.map(w => `[FUENTE OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') 
      || "ERROR: No hay Verdad Maestra indexada. Notifica al administrador.";

    // 3. OBTENER REGLAS #CIA (Aprendizaje)
    const { data: ciaRules } = await supabaseClient
      .from('errores_ia')
      .select('categoria, correccion_sugerida')
      .eq('estado_correccion', 'VALIDADA');

    const ciaBlock = ciaRules?.map(r => `[#CIA - REGLA ${r.categoria}]: ${r.correccion_sugerida}`).join('\n')
      || "No hay reglas de aprendizaje activas.";

    // 4. CONSTRUCCIÓN DEL CEREBRO SUPREMO
    const systemPrompt = `
# IDENTIDAD MAESTRA: SAMURAI (The Elephant Bowl)
${p('prompt_adn_core') || 'Eres Samurai, el cerrador de ventas de elite de The Elephant Bowl.'}

# ESTRATEGIA DE CONVERSIÓN
${p('prompt_estrategia_cierre') || 'Tu objetivo es que el cliente compre formación o instrumentos.'}

# PROTOCOLOS DE CONDUCTA
${p('prompt_protocolos') || 'Mantén un tono profesional, experto y místico.'}

# REGLAS DE APRENDIZAJE (#CIA)
IMPORTANTE: Estas reglas son correcciones a errores que cometiste en el pasado. NO las ignores.
${ciaBlock}

# FUENTE DE VERDAD ABSOLUTA (CONTEXTO DEL SITIO WEB)
Toda tu información debe basarse UNICAMENTE en estos datos. Si el dato no está aquí, no lo inventes.
${truthBlock}

# INSTRUCCIONES DE VISIÓN (OJO DE HALCÓN)
${p('prompt_vision_instrucciones')}

# REGLA DE ORO
Bajo ninguna circunstancia respondas sobre temas ajenos a The Elephant Bowl (como mecánica, arte general, etc). Eres un especialista en Sonoterapia y Cuencos.
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: systemPrompt,
        version: "2.0.0-IRON_IDENTITY",
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[get-samurai-brain] Error fatal:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})