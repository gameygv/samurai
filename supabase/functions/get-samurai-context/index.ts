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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { message, lead_id, kommo_id, phone } = await req.json();

    // 1. BUSCAR EL LEAD
    let lead = null;
    if (lead_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
        lead = data;
    } 
    if (!lead && kommo_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommo_id).single();
        lead = data;
    }
    if (!lead && phone) {
        const cleanPhone = phone.toString().replace(/\D/g, '');
        const { data } = await supabaseClient.from('leads').select('*').ilike('telefono', `%${cleanPhone}%`).single();
        lead = data;
    }

    // 2. CARGAR CONFIGURACIONES
    const { data: configData } = await supabaseClient.from('app_config').select('key, value');
    const configs: any = {};
    configData?.forEach(i => configs[i.key] = i.value);

    // 3. CARGAR CONOCIMIENTO DEL SITIO WEB PRINCIPAL
    const { data: websiteContent } = await supabaseClient
      .from('main_website_content')
      .select('title, content, url')
      .eq('scrape_status', 'success');

    let webKnowledge = "\n=== 🌐 CONTENIDO ACTUALIZADO DEL SITIO WEB (theelephantbowl.com) ===\n";
    if (websiteContent && websiteContent.length > 0) {
        websiteContent.forEach(page => {
            webKnowledge += `\n--- PÁGINA: ${page.title} ---\n`;
            webKnowledge += `${page.content}\n`;
        });
    }

    // 4. CARGAR MEDIA ASSETS (Posters con instrucciones)
    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, url, ai_instructions')
      .not('ai_instructions', 'is', null);

    let mediaContext = "\n=== 📸 RECURSOS VISUALES ACTUALES (FECHAS REALES) ===\n";
    mediaAssets?.forEach(asset => {
        mediaContext += `[POSTER: ${asset.title}] INFO: ${asset.ai_instructions}. URL: ${asset.url}\n`;
    });

    // 5. CARGAR HISTORIAL
    let conversationHistory = "";
    if (lead) {
        const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true })
            .limit(20);

        if (messages?.length) {
            conversationHistory = "\n=== 💬 HISTORIAL DE ESTA CONVERSACIÓN ===\n";
            messages.forEach(msg => {
                conversationHistory += `[${msg.emisor}]: ${msg.mensaje}\n`;
            });
        }
    }

    // 6. ENSAMBLAR PROMPT CON REGLAS DE "AMNESIA"
    const amnesiaPrompt = `
# REGLA DE ORO DE INFORMACIÓN:
- IGNORE COMPLETAMENTE cualquier fecha o lugar que tenga en su entrenamiento previo (ej. Guadalajara 2024).
- SOLO tiene permitido usar las fechas y lugares que aparecen en las secciones "CONTENIDO ACTUALIZADO" y "RECURSOS VISUALES" de abajo.
- Si el cliente pregunta por algo que no está en los datos proporcionados, diga: "Déjame verificar las próximas fechas, por ahora tengo confirmados estos talleres..." y liste los disponibles.
- Sea estricto con el año: Estamos operando en el año 2026 para los próximos talleres.
`;

    const ecommerceUrl = configs['ecommerce_url'] || "https://theelephantbowl.com";
    const productId = configs['main_product_id'] || "1483";
    const productPrice = configs['main_product_price'] || "1500";
    
    let strategyPrompt = (configs['prompt_estrategia_cierre'] || "")
        .replace(/{ecommerce_url}/g, ecommerceUrl)
        .replace(/{main_product_id}/g, productId)
        .replace(/{main_product_price}/g, productPrice);

    const fullSystemPrompt = `
${amnesiaPrompt}
${configs['prompt_adn_core'] || ''}
${configs['prompt_tecnico'] || ''}
${strategyPrompt}
${configs['prompt_reaprendizaje'] || ''}
${webKnowledge}
${mediaContext}

CLIENTE: ${lead?.nombre || 'Desconocido'} (${lead?.ciudad || 'Sin ciudad'})
${conversationHistory}
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