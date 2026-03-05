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

    const wcUrl = getConfig('wc_url', "https://theelephantbowl.com");
    const checkoutPath = getConfig('wc_checkout_path', "/inscripciones/");
    const productId = getConfig('wc_product_id', ""); 
    
    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const path = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;
    
    let paymentLink = `${baseUrl}${path}`;
    let isFirstParam = true;

    if (productId && productId.trim() !== '') {
        paymentLink += `?add-to-cart=${productId}`;
        isFirstParam = false;
    }
    
    const addParam = (key, value) => {
        paymentLink += `${isFirstParam ? '?' : '&'}${key}=${value}`;
        isFirstParam = false;
    };
    
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) {
        const names = lead.nombre.trim().split(' ');
        addParam('wffn_billing_first_name', encodeURIComponent(names[0]));
        if (names.length > 1) {
           addParam('wffn_billing_last_name', encodeURIComponent(names.slice(1).join(' ')));
        }
    }
    if (lead.email) addParam('wffn_billing_email', encodeURIComponent(lead.email));
    if (lead.telefono) addParam('wffn_billing_phone', encodeURIComponent(lead.telefono));
    if (lead.ciudad) addParam('wffn_billing_city', encodeURIComponent(lead.ciudad));

    // CARGAR POSTERS DESDE MEDIA MANAGER (OCR)
    const { data: mediaAssets } = await supabaseClient
        .from('media_assets')
        .select('title, url, ai_instructions, ocr_content, category')
        .eq('category', 'POSTER');

    let mediaContext = "\n=== BÓVEDA DE POSTERS (MEDIA MANAGER) ===\n";
    if (mediaAssets && mediaAssets.length > 0) {
        mediaContext += `INSTRUCCIÓN CRÍTICA DE VISUALES: 
Cuando el cliente pida información o cuando ya hayas identificado su CIUDAD, DEBES adjuntar el poster correspondiente de esa ciudad AUTOMÁTICAMENTE en tu respuesta. 
NO le preguntes si quiere ver la imagen, envíala directamente de forma proactiva. 
REGLA DE ORO: NUNCA uses enlaces markdown como ![imagen](url). Para enviar una imagen, SIMPLEMENTE PEGA la etiqueta exacta <<MEDIA:URL>> en cualquier parte de tu mensaje (al final es ideal).

CATÁLOGO DISPONIBLE:\n`;
        mediaAssets.forEach(m => {
            mediaContext += `- TÍTULO: ${m.title}\n  INFORMACIÓN EXTRAÍDA DEL POSTER: ${m.ocr_content || 'Aún no se ha leído la información visual.'}\n  CUÁNDO USAR: ${m.ai_instructions}\n  ETIQUETA EXACTA A PEGAR EN EL CHAT: <<MEDIA:${m.url}>>\n\n`;
        });
    } else {
        mediaContext += "No hay posters cargados actualmente.\n";
    }

    // CARGAR VERDAD MAESTRA (SITIO WEB)
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB OFICIAL) ===\n";
    if (webPages && webPages.length > 0) {
        masterTruth += "Esta es la información OFICIAL e innegable de la academia. Usa esto para responder sobre fechas, profesores, precios y detalles. NUNCA inventes nombres ni datos que no estén aquí.\n";
        webPages.forEach(p => {
            if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 3000)}\n`; // Limitado para no exceder tokens
        });
    }

    // CARGAR BASE DE CONOCIMIENTO (DOCUMENTOS Y TALLERES EXTRAS)
    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content, description');
    let kbContext = "\n=== BASE DE CONOCIMIENTO TÉCNICO ===\n";
    if (kbDocs && kbDocs.length > 0) {
        kbDocs.forEach(d => {
            if(d.content) kbContext += `\n[RECURSO: ${d.title} | CAT: ${d.category}]\nInstrucción: ${d.description || 'N/A'}\nContenido: ${d.content.substring(0, 2000)}\n`;
        });
    }

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;
    const pAlma = getConfig('prompt_alma_samurai');
    const pAdn = getConfig('prompt_adn_core');
    const pEstrategia = getConfig('prompt_estrategia_cierre');
    const pRelearning = getConfig('prompt_relearning'); // REGLAS #CIA

    const systemPrompt = `
=== CONSTITUCIÓN TÁCTICA ===
${pAlma}
${pAdn}
${pEstrategia}

${pRelearning && pRelearning.trim() !== '' && pRelearning !== '# Aún no hay lecciones inyectadas.' ? `\n=== REGLAS #CIA (PRIORIDAD ABSOLUTA) ===\nEstas reglas corrigen comportamientos pasados. Síguelas por encima de todo lo demás:\n${pRelearning}\n` : ''}

${masterTruth}

${kbContext}

${mediaContext}

=== LINK DE PAGO (MAPEO FUNNELKIT OK) ===
Usa este link exacto. Ya tiene los campos wffn_billing_ mapeados dinámicamente:
${paymentLink}

=== DATOS PARA TRANSFERENCIA ===
${bankInfo}

[REGLA VITAL]: Entrega el link de pago o la cuenta SOLAMENTE si el cliente ya te dio su Ciudad y Email (Fase de Cierre).
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})