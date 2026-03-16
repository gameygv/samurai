// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    
    const body = await req.json().catch(() => ({}));
    const lead = body.lead || {};

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = "") => configs?.find((c: any) => c.key === key)?.value || def;

    const wcUrl = getConfig('wc_url', "https://tutienda.com");
    const checkoutPath = getConfig('wc_checkout_path', "/checkout/");
    
    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const path = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;
    
    // Parámetros dinámicos para los links
    let leadParams = "";
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) {
        const names = lead.nombre.trim().split(' ');
        leadParams += `&wffn_billing_first_name=${encodeURIComponent(names[0])}`;
        if (names.length > 1) {
           leadParams += `&wffn_billing_last_name=${encodeURIComponent(names.slice(1).join(' '))}`;
        }
    }
    if (lead.email) leadParams += `&wffn_billing_email=${encodeURIComponent(lead.email)}`;
    if (lead.telefono) leadParams += `&wffn_billing_phone=${encodeURIComponent(lead.telefono)}`;
    if (lead.ciudad) leadParams += `&wffn_billing_city=${encodeURIComponent(lead.ciudad)}`;

    // CARGAR CATÁLOGO DE PRODUCTOS
    let products = [];
    try {
       const prodStr = getConfig('wc_products', '[]');
       products = JSON.parse(prodStr);
    } catch(e) {}

    // Envoltorio del catálogo ahora es dinámico
    const pCatalogRules = getConfig('prompt_catalog_rules', 'Usa ESTOS enlaces específicos según lo que el cliente quiera comprar. Entrégalo SOLO UNA VEZ en toda la conversación.');
    let catalogContext = `\n=== CATÁLOGO DE PRODUCTOS (ENLACES DE PAGO) ===\n${pCatalogRules}\n\n`;
    
    if (products.length > 0) {
        products.forEach((p: any) => {
            const finalLink = `${baseUrl}${path}?add-to-cart=${p.wc_id}${leadParams}`;
            catalogContext += `[PRODUCTO]: ${p.title} ($${p.price})\n`;
            catalogContext += `[LINK EXACTO PARA ENVIAR]: ${finalLink}\n`;
            catalogContext += `[CUÁNDO OFRECERLO]: ${p.prompt}\n\n`;
        });
    } else {
        catalogContext += "No hay productos configurados en el catálogo.\n";
    }

    const { data: mediaAssets } = await supabaseClient
        .from('media_assets')
        .select('title, url, ai_instructions, ocr_content, category')
        .eq('category', 'POSTER');

    // Reglas de archivos multimedia ahora dinámicas
    const pMediaRules = getConfig('prompt_media_rules', 'Cuando el cliente requiera información visual, adjunta el recurso correspondiente usando la etiqueta <<MEDIA:URL>>. NO envíes la misma imagen dos veces.');
    let mediaContext = `\n=== BÓVEDA MULTIMEDIA (MEDIA MANAGER) ===\nINSTRUCCIÓN CRÍTICA DE VISUALES:\n${pMediaRules}\n\nCATÁLOGO DISPONIBLE:\n`;
    
    if (mediaAssets && mediaAssets.length > 0) {
        mediaAssets.forEach(m => {
            mediaContext += `- TÍTULO: ${m.title}\n  INFORMACIÓN EXTRAÍDA: ${m.ocr_content || 'N/A'}\n  CUÁNDO USAR: ${m.ai_instructions}\n  ETIQUETA EXACTA A PEGAR EN EL CHAT: <<MEDIA:${m.url}>>\n\n`;
        });
    } else {
        mediaContext += "No hay recursos cargados actualmente.\n";
    }

    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB OFICIAL) ===\nEsta es la información OFICIAL e innegable de la empresa. Usa esto para responder:\n";
    if (webPages && webPages.length > 0) {
        webPages.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 2000)}\n`; });
    }

    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content, description');
    let kbContext = "\n=== BASE DE CONOCIMIENTO TÉCNICO ===\n";
    if (kbDocs && kbDocs.length > 0) {
        kbDocs.forEach(d => { if(d.content) kbContext += `\n[RECURSO: ${d.title} | CAT: ${d.category}]\nInstrucción: ${d.description || 'N/A'}\nContenido: ${d.content.substring(0, 1500)}\n`; });
    }

    let agentName = "uno de nuestros asesores";
    if (lead.assigned_to) {
        const { data: agentProfile } = await supabaseClient.from('profiles').select('full_name').eq('id', lead.assigned_to).maybeSingle();
        if (agentProfile?.full_name) agentName = agentProfile.full_name.split(' ')[0];
    }

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;
    
    // Prompts Core
    const pAlma = getConfig('prompt_alma_samurai');
    const pAdn = getConfig('prompt_adn_core');
    const pEstrategia = getConfig('prompt_estrategia_cierre');
    const pRelearning = getConfig('prompt_relearning'); 
    
    // Nuevos Prompts de Comportamiento (Agnósticos)
    const pBehavior = getConfig('prompt_behavior_rules', '1. MEMORIA: Lee el historial. No repitas saludos ni información que ya diste.\n2. NATURALIDAD: Habla como un humano experto.');
    const pHuman = getConfig('prompt_human_handoff', 'Si el cliente pide explícitamente hablar con una persona o hace una pregunta fuera de tu conocimiento, responde que un asesor lo atenderá pronto y añade EXACTAMENTE este JSON al final de tu respuesta:\n---JSON---\n{"request_human": true}');
    const pBankRules = getConfig('prompt_bank_rules', 'Presenta estos datos bancarios como alternativa de pago directo, úsalos solo una vez:');

    const systemPrompt = `
=== CONSTITUCIÓN TÁCTICA ===
${pAlma}
${pAdn}
${pEstrategia}

=== REGLAS DE CONDUCTA ANTI-ROBOT (PRIORIDAD MÁXIMA) ===
${pBehavior}

=== ESCALADO A HUMANO Y ANTI-ALUCINACIÓN (REGLA DE ORO) ===
${pHuman}
(El asesor disponible actualmente se llama: ${agentName})

${pRelearning && pRelearning.trim() !== '' && pRelearning !== '# Aún no hay lecciones inyectadas.' ? `\n=== REGLAS #CIA (PRIORIDAD ABSOLUTA) ===\nEstas reglas corrigen comportamientos pasados. Síguelas por encima de todo lo demás:\n${pRelearning}\n` : ''}

${masterTruth}

${kbContext}

${mediaContext}

${catalogContext}

=== DATOS PARA DEPÓSITO/TRANSFERENCIA ===
${pBankRules}
${bankInfo}
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})