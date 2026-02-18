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

    // 3. CARGAR CONOCIMIENTO DEL SITIO WEB PRINCIPAL (14 PÁGINAS)
    const { data: websiteContent } = await supabaseClient
      .from('main_website_content')
      .select('title, content, url')
      .eq('scrape_status', 'success')
      .order('last_scraped_at', { ascending: false });

    let webKnowledge = "\n=== 🌐 CONTENIDO DEL SITIO WEB OFICIAL (theelephantbowl.com) ===\n";
    webKnowledge += "INSTRUCCIÓN CRÍTICA: Esta es la ÚNICA fuente de verdad. NO inventes fechas ni información.\n\n";
    
    if (websiteContent && websiteContent.length > 0) {
        websiteContent.forEach(page => {
            webKnowledge += `\n--- PÁGINA: ${page.title} (${page.url}) ---\n`;
            webKnowledge += `${page.content?.substring(0, 2000)}\n`;
            webKnowledge += `--- FIN DE ${page.title} ---\n`;
        });
    } else {
        webKnowledge += "⚠️ ADVERTENCIA: No hay contenido scrapeado disponible. Solicita al usuario que espere mientras actualizamos la información.\n";
    }
    webKnowledge += "\n=== FIN CONTENIDO WEB ===\n";

    // 4. CARGAR MEDIA ASSETS (POSTERS CON FECHAS)
    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, url, ai_instructions, type')
      .not('ai_instructions', 'is', null);

    let mediaContext = "\n=== 📸 RECURSOS VISUALES DISPONIBLES (Media Manager) ===\n";
    if (mediaAssets && mediaAssets.length > 0) {
        mediaAssets.forEach(asset => {
            mediaContext += `\n[RECURSO: ${asset.title}]\n`;
            mediaContext += `URL: ${asset.url}\n`;
            mediaContext += `CUÁNDO USAR: ${asset.ai_instructions}\n`;
            mediaContext += `---\n`;
        });
    }
    mediaContext += "\n=== FIN RECURSOS VISUALES ===\n";

    // 5. CARGAR DOCUMENTOS DE CONOCIMIENTO ADICIONALES
    const { data: knowledgeDocs } = await supabaseClient
      .from('knowledge_documents')
      .select('title, content, description, type')
      .limit(5);

    let docsContext = "\n=== 📚 DOCUMENTOS DE CONOCIMIENTO ===\n";
    if (knowledgeDocs && knowledgeDocs.length > 0) {
        knowledgeDocs.forEach(doc => {
            docsContext += `\n[DOCUMENTO: ${doc.title}]\n`;
            if (doc.description) docsContext += `Descripción: ${doc.description}\n`;
            if (doc.content) docsContext += `Contenido: ${doc.content.substring(0, 1000)}\n`;
            docsContext += `---\n`;
        });
    }
    docsContext += "\n=== FIN DOCUMENTOS ===\n";

    // 6. CARGAR HISTORIAL (MEMORIA)
    let conversationHistory = "";
    if (lead) {
        const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje, created_at')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true })
            .limit(20);

        if (messages?.length) {
            conversationHistory = "\n=== 💬 HISTORIAL DE CONVERSACIÓN ===\n";
            messages.forEach(msg => {
                conversationHistory += `[${msg.emisor}]: ${msg.mensaje}\n`;
            });
            conversationHistory += "\n--- FIN HISTORIAL ---\n";
        }
    }

    // 7. ENSAMBLAR PROMPT CON VARIABLES DINÁMICAS
    let strategyPrompt = configs['prompt_estrategia_cierre'] || "";
    
    const ecommerceUrl = configs['ecommerce_url'] || "https://theelephantbowl.com";
    const productId = configs['main_product_id'] || "1483";
    const productPrice = configs['main_product_price'] || "1500";
    
    strategyPrompt = strategyPrompt
        .replace(/{ecommerce_url}/g, ecommerceUrl)
        .replace(/{main_product_id}/g, productId)
        .replace(/{main_product_price}/g, productPrice);

    // 8. PROMPT FINAL ENSAMBLADO
    const fullSystemPrompt = `
${configs['prompt_adn_core'] || ''}

${configs['prompt_tecnico'] || ''}

${strategyPrompt}

=== 🎯 REGLAS DE CIERRE OBLIGATORIAS ===
1. NUNCA inventes fechas. Solo usa las que veas en el contenido del sitio web o en los recursos visuales.
2. Si el cliente dice "quiero inscribirme" o "quiero comprar", genera INMEDIATAMENTE este link:
   ${ecommerceUrl}/checkout/?add-to-cart=${productId}
3. NO pidas más datos innecesarios. El link de pago es suficiente para cerrar.
4. Si no encuentras fechas específicas en el contenido, di: "Déjame verificar las fechas más recientes" y usa los recursos visuales.

${configs['prompt_reaprendizaje'] || ''}

${webKnowledge}

${mediaContext}

${docsContext}

INFORMACIÓN DEL CLIENTE:
- Nombre: ${lead?.nombre || 'Desconocido'}
- Ciudad: ${lead?.ciudad || 'No especificada'}
- Intención: ${lead?.buying_intent || 'Analizando...'}

${conversationHistory}

RECORDATORIO FINAL: 
- Tienes TODO el contenido del sitio web arriba. NO envíes al usuario a revisar la web.
- Si el cliente quiere inscribirse, dale el link de checkout AHORA: ${ecommerceUrl}/checkout/?add-to-cart=${productId}
- Precio del anticipo: $${productPrice} MXN
    `;

    console.log("[get-samurai-context] Contexto generado. Páginas web:", websiteContent?.length || 0);
    console.log("[get-samurai-context] Media assets:", mediaAssets?.length || 0);
    console.log("[get-samurai-context] Documentos:", knowledgeDocs?.length || 0);

    return new Response(
      JSON.stringify({ 
        system_prompt: fullSystemPrompt,
        lead_id: lead?.id,
        status: "ready",
        debug: {
          web_pages: websiteContent?.length || 0,
          media_assets: mediaAssets?.length || 0,
          knowledge_docs: knowledgeDocs?.length || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[get-samurai-context] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})