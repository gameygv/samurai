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

  console.log("[get-samurai-context] Generando contexto inteligente...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { message, lead_id, kommo_id } = await req.json();

    // 1. BUSCAR EL LEAD
    let lead = null;
    if (lead_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
        lead = data;
    } else if (kommo_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommo_id).single();
        lead = data;
    }

    // 2. CARGAR CONFIGURACIONES (PROMPTS + ECOMMERCE)
    const { data: configData } = await supabaseClient.from('app_config').select('key, value');
    const configs: any = {};
    configData?.forEach(i => configs[i.key] = i.value);

    // 3. CARGAR CONOCIMIENTO (SITIO WEB + DOCUMENTOS)
    // Obtenemos el contenido del sitio web principal scrapeado
    const { data: websiteContent } = await supabaseClient
      .from('main_website_content')
      .select('title, content')
      .eq('scrape_status', 'success')
      .limit(10); // Traemos las páginas más relevantes

    // Obtenemos documentos de conocimiento adicionales (Talleres/Maestros)
    const { data: knowledgeDocs } = await supabaseClient
      .from('knowledge_documents')
      .select('title, content, description')
      .limit(5);

    let brainContext = "\n=== 🧠 BASE DE CONOCIMIENTO (DATOS REALES) ===\n";
    
    if (websiteContent && websiteContent.length > 0) {
        websiteContent.forEach(p => {
            brainContext += `\n[FUENTE: ${p.title}]\n${p.content?.substring(0, 1000)}\n`;
        });
    }

    if (knowledgeDocs && knowledgeDocs.length > 0) {
        knowledgeDocs.forEach(d => {
            brainContext += `\n[RECURSO: ${d.title}]\n${d.content || d.description}\n`;
        });
    }
    brainContext += "\n=== FIN CONOCIMIENTO ===\n";

    // 4. CARGAR HISTORIAL (MEMORIA)
    let conversationHistory = "";
    if (lead) {
        const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje, created_at')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true })
            .limit(15);

        if (messages?.length) {
            conversationHistory = "\n=== 💬 HISTORIAL RECIENTE ===\n";
            messages.forEach(msg => {
                conversationHistory += `[${msg.emisor}]: ${msg.mensaje}\n`;
            });
            conversationHistory += "\n--- FIN HISTORIAL ---\n";
        }
    }

    // 5. ENSAMBLAR PROMPT
    let strategyPrompt = configs['prompt_estrategia_cierre'] || "";
    
    // Inyección de variables
    strategyPrompt = strategyPrompt
        .replace(/{ecommerce_url}/g, configs['ecommerce_url'] || "https://theelephantbowl.com")
        .replace(/{main_product_id}/g, configs['main_product_id'] || "1483")
        .replace(/{main_product_price}/g, configs['main_product_price'] || "1500");

    const fullSystemPrompt = `
${configs['prompt_adn_core']}
${configs['prompt_tecnico']}
${strategyPrompt}
${configs['prompt_reaprendizaje']}

${brainContext}

INFORMACIÓN DEL CLIENTE:
- Nombre: ${lead?.nombre || 'Desconocido'}
- Ciudad: ${lead?.ciudad || 'No especificada'}
- Intención: ${lead?.buying_intent || 'Analizando...'}

${conversationHistory}

INSTRUCCIÓN CRÍTICA: Tienes el contenido del sitio web arriba. NO envíes al usuario a revisar la web. Lee el contenido tú mismo y dile los nombres de los cursos y las fechas que encuentres. Si quiere inscribirse, dale el link de checkout de inmediato.
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: fullSystemPrompt,
        lead_id: lead?.id,
        status: "ready"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[get-samurai-context] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})