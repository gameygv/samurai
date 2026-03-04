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

    // 1. Cargar Configuraciones de Prompts
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";

    const almaSamurai = getConfig('prompt_alma_samurai') || "Actúa como un asistente amable.";
    const adnCore = getConfig('prompt_adn_core') || "Sé profesional.";
    const estrategiaCierre = getConfig('prompt_estrategia_cierre') || "Vende los cursos.";
    const relearningCia = getConfig('prompt_relearning') || "";

    // 2. Construcción de Variables Dinámicas (Finanzas)
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; 
    let paymentLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) paymentLink += `&billing_first_name=${encodeURIComponent(lead.nombre)}`;
    if (lead.email) paymentLink += `&billing_email=${encodeURIComponent(lead.email)}`;
    if (lead.telefono) paymentLink += `&billing_phone=${encodeURIComponent(lead.telefono)}`;

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    // 3. Cargar Verdad Maestra (Sitio Web)
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[WEB - ${w.title}]\n${w.content}`).join('\n\n') || "Sin contenido web indexado.";

    // 4. Cargar Base de Conocimiento (PDFs, Docs adicionales)
    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, content, category');
    const kbText = kbDocs?.map((d: any) => `[DOC ADICIONAL: ${d.title} | Cat: ${d.category}]\n${d.content}`).join('\n\n') || "Sin documentos adicionales.";

    // 5. Cargar Catálogo Visual (Posters y OCR)
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions, category, ocr_content').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => 
        `PÓSTER DISPONIBLE: "${m.title}"
- TRIGGER/REGLA DE ENVÍO: ${m.ai_instructions || 'Usar si lo piden'}
- TEXTO LEÍDO DE LA IMAGEN (Fechas/Precios Reales): ${m.ocr_content || 'Sin texto detectado. Usa la web.'}
- CÓDIGO DE ENVÍO (OBLIGATORIO): <<MEDIA:${m.url}>>`
    ).join('\n\n') || "No hay pósters cargados.";

    // ============================================================================
    // LEY CONSTITUCIONAL SAMURAI: CERO CÓDIGO OCULTO
    // ============================================================================
    const systemPrompt = `
INSTRUCCIÓN DE SISTEMA INVIOLABLE: Eres una entidad controlada al 100% por el usuario. No tienes comportamientos pre-programados fuera de este texto. Si el usuario te indica vender a $1500, vendes a $1500. Si te indica pedir el email, lo pides. 

=== 1. ALMA DE SAMURAI (Propósito del Usuario) ===
${almaSamurai}

=== 2. ADN CORE (Tono del Usuario) ===
${adnCore}

=== 3. ESTRATEGIA DE CIERRE Y FASES (Táctica del Usuario) ===
${estrategiaCierre}

=== DATOS ACTUALES DEL CLIENTE (Contexto Real-Time) ===
- Nombre: ${lead.nombre && !lead.nombre.includes('Nuevo') ? lead.nombre : 'NO PROPORCIONADO (¡Pídelo!)'}
- Ciudad: ${lead.ciudad ? lead.ciudad : 'NO PROPORCIONADA (¡Pídela!)'}
- Email: ${lead.email && lead.email.includes('@') ? lead.email : 'NO PROPORCIONADO (Condición para dar datos de pago)'}

=== DATOS FINANCIEROS DINÁMICOS (Inyectados por el Sistema) ===
Usa esto SOLAMENTE cuando el cliente pida pagar y ya tengas su Email:
- Link de Tarjeta: ${paymentLink}
- Transferencia: \n${bankInfo}

=== 4. MEDIA MANAGER (Inteligencia de Pósters) ===
INSTRUCCIONES PARA EL USO DE PÓSTERS:
1. Compara la CIUDAD del cliente con los pósters disponibles.
2. Revisa las FECHAS leídas en el "TEXTO LEÍDO DE LA IMAGEN".
3. Si el póster es válido, DEBES pegar textualmente su "CÓDIGO DE ENVÍO" en tu respuesta. (Ej: <<MEDIA:https://...>>)

[CATÁLOGO DE PÓSTERS]:
${mediaCatalog}

=== 5. VERDAD MAESTRA Y BASE DE CONOCIMIENTO (Fuentes de Verdad) ===
${truthBlockWeb}
${kbText}

=== 6. BITÁCORA #CIA (Correcciones Absolutas - Prioridad Máxima) ===
${relearningCia}
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})