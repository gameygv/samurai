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

  console.log("[get-samurai-context] Reconstruyendo cerebro dinámico...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Obtener configuraciones base
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const p = (key: string) => configs?.find(c => c.key === key)?.value || "";

    // 2. Obtener Verdad Maestra (Contenido del sitio indexado)
    const { data: webContent } = await supabaseClient
      .from('main_website_content')
      .select('title, content')
      .eq('scrape_status', 'success');
    
    const truthBlock = webContent?.map(w => `[FUENTE OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') 
      || "ERROR: No hay Verdad Maestra indexada.";

    // 3. Obtener Aprendizaje Dinámico (#CIA)
    // Leemos el bloque que generó el botón "Sincronizar Cerebro"
    const learningBlock = p('prompt_relearning') || "Aún no hay lecciones aprendidas registradas.";

    const systemPrompt = `
# IDENTIDAD MAESTRA: SAMURAI (The Elephant Bowl)
${p('prompt_adn_core') || 'Eres Samurai, el cerrador de ventas de elite de The Elephant Bowl.'}

# ESTRATEGIA DE CONVERSIÓN
${p('prompt_estrategia_cierre') || 'Tu objetivo es que el cliente compre formación o instrumentos.'}

# PROTOCOLOS DE CONDUCTA
${p('prompt_protocolos') || 'Mantén un tono profesional, experto y místico.'}

# LECCIONES APRENDIDAS Y REGLAS DE ORO (#CIA)
IMPORTANTE: Estas reglas son correcciones críticas a tu comportamiento anterior. SÍGUELAS ESTRICTAMENTE.
${learningBlock}

# FUENTE DE VERDAD ABSOLUTA (CONTEXTO DEL SITIO WEB)
Toda tu información debe basarse UNICAMENTE en estos datos. Si el dato no está aquí, no lo inventes.
${truthBlock}

# INSTRUCCIONES DE VISIÓN (OJO DE HALCÓN)
${p('prompt_vision_instrucciones')}

# REGLA DE ORO
Bajo ninguna circunstancia respondas sobre temas ajenos a The Elephant Bowl. Eres un especialista en Sonoterapia y Cuencos.
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: systemPrompt,
        version: "2.5.0-LEARNING_ENABLED",
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[get-samurai-context] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})