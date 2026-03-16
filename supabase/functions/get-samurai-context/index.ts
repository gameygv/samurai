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
        if (!value || value === 'null') return;
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
Cuando identifiques la CIUDAD del cliente, adjunta el poster correspondiente pegando la etiqueta <<MEDIA:URL>> en tu respuesta. 
REGLA DE MEMORIA (ANTI-SPAM): Revisa cuidadosamente el historial de chat. Si en tus mensajes pasados ya existe la marca "[IMG: ...]", SIGNIFICA QUE YA ENVIASTE EL POSTER. ESTÁ ESTRICTAMENTE PROHIBIDO volver a enviarlo o volver a usar la etiqueta <<MEDIA:URL>> en toda esta conversación. Envíalo solo UNA vez.

CATÁLOGO DISPONIBLE:\n`;
        mediaAssets.forEach(m => {
            mediaContext += `- TÍTULO: ${m.title}\n  INFORMACIÓN EXTRAÍDA DEL POSTER: ${m.ocr_content || 'Aún no se ha leído la información visual.'}\n  CUÁNDO USAR: ${m.ai_instructions}\n  ETIQUETA EXACTA A PEGAR EN EL CHAT: <<MEDIA:${m.url}>>\n\n`;
        });
    } else {
        mediaContext += "No hay posters cargados actualmente.\n";
    }

    // CARGAR VERDAD MAESTRA (SITIO WEB) - CON LÍMITE DE TOKENS DE SEGURIDAD
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB OFICIAL) ===\n";
    if (webPages && webPages.length > 0) {
        masterTruth += "Esta es la información OFICIAL e innegable de la academia. Usa esto para responder sobre fechas, profesores, precios y detalles.\n";
        webPages.forEach(p => {
            if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 2000)}\n`; 
        });
    }

    // CARGAR BASE DE CONOCIMIENTO (DOCUMENTOS Y TALLERES EXTRAS)
    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content, description');
    let kbContext = "\n=== BASE DE CONOCIMIENTO TÉCNICO ===\n";
    if (kbDocs && kbDocs.length > 0) {
        kbDocs.forEach(d => {
            if(d.content) kbContext += `\n[RECURSO: ${d.title} | CAT: ${d.category}]\nInstrucción: ${d.description || 'N/A'}\nContenido: ${d.content.substring(0, 1500)}\n`;
        });
    }

    // EXTRAER NOMBRE DEL AGENTE ASIGNADO
    let agentName = "uno de nuestros asesores";
    if (lead.assigned_to) {
        const { data: agentProfile } = await supabaseClient.from('profiles').select('full_name').eq('id', lead.assigned_to).maybeSingle();
        if (agentProfile?.full_name) agentName = agentProfile.full_name.split(' ')[0];
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

=== REGLAS DE CONDUCTA ANTI-ROBOT (PRIORIDAD MÁXIMA) ===
1. MEMORIA DE SALUDOS: Lee el historial. Si ya saludaste ("Hola", "Buen día") en mensajes anteriores, NO vuelvas a saludar. Responde directamente y con naturalidad.
2. NO REPETIR INFORMACIÓN: Si ya enviaste los detalles del taller (fechas, precios, ubicación, horarios) en el historial, ESTÁ PROHIBIDO volver a escribirlos completos en el siguiente mensaje. Avanza de inmediato a la siguiente fase de la venta (pedir email o dar link).
3. MEMORIA DE PAGOS (ESTRICTO): Revisa el historial. Si ya enviaste el número de cuenta, la CLABE o el link de pago arriba, NUNCA LOS VUELVAS A REPETIR en tus siguientes mensajes. Si el cliente pregunta "¿se puede pagar en Oxxo?" dile: "Sí, claro, puedes usar la misma cuenta que te mandé aquí arriba", sin escribir los números otra vez.
4. NO REPETIR CUESTIONARIOS: Si el cliente ya te respondió algo sobre su alimentación o motivación, solo haz un comentario cálido y natural. No vuelvas a hacer la pregunta ni a repetir la cuenta bancaria. Solo dile que quedas atento a su comprobante.
5. CONTEXTO CONTINUO: Compórtate como un humano. Si ya te dijeron que sí a algo, pasa a lo siguiente.

=== ESCALADO A HUMANO (MUY IMPORTANTE) ===
Si el cliente pide explícitamente hablar con una persona, asesor o humano, O BIEN te hace preguntas complejas que no puedes responder basándote en tu Verdad Maestra o Base de Conocimiento, DEBES:
1. Responderle al cliente de forma natural diciendo que en breve será atendido por ${agentName}.
2. PAUSAR tu operación añadiendo obligatoriamente este bloque JSON EXACTO al final de tu respuesta:
---JSON---
{"request_human": true}

${pRelearning && pRelearning.trim() !== '' && pRelearning !== '# Aún no hay lecciones inyectadas.' ? `\n=== REGLAS #CIA (PRIORIDAD ABSOLUTA) ===\nEstas reglas corrigen comportamientos pasados. Síguelas por encima de todo lo demás:\n${pRelearning}\n` : ''}

${masterTruth}

${kbContext}

${mediaContext}

=== LINK DE PAGO (MAPEO FUNNELKIT OK) ===
ÚSALO SOLO UNA VEZ EN TODA LA CONVERSACIÓN:
${paymentLink}

=== DATOS PARA TRANSFERENCIA ===
ÚSALOS SOLO UNA VEZ EN TODA LA CONVERSACIÓN:
${bankInfo}

[REGLA VITAL]: Entrega el link de pago o la cuenta SOLAMENTE si el cliente ya te dio su Ciudad y Email (Fase de Cierre).
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})