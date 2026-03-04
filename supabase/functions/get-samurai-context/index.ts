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

    // 1. Cargar Configuraciones
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = "") => configs?.find((c: any) => c.key === key)?.value || def;

    // 2. Construcción de Link de Pago Profesional
    const wcUrl = getConfig('wc_url', "https://theelephantbowl.com");
    const checkoutPath = getConfig('wc_checkout_path', "/checkout/");
    const productId = getConfig('wc_product_id', "1483"); 
    
    // Limpieza de URL para evitar dobles slashes
    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const path = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;
    
    let paymentLink = `${baseUrl}${path}?add-to-cart=${productId}`;
    
    // Inyección de parámetros de auto-rellenado (WooCommerce Standard)
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) {
        const names = lead.nombre.split(' ');
        paymentLink += `&billing_first_name=${encodeURIComponent(names[0])}`;
        if (names.length > 1) paymentLink += `&billing_last_name=${encodeURIComponent(names.slice(1).join(' '))}`;
    }
    if (lead.email) paymentLink += `&billing_email=${encodeURIComponent(lead.email)}`;
    if (lead.telefono) paymentLink += `&billing_phone=${encodeURIComponent(lead.telefono)}`;
    if (lead.ciudad) paymentLink += `&billing_city=${encodeURIComponent(lead.ciudad)}`;

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    // 3. Cargar el resto del contexto (Alma, ADN, Verdad Maestra, etc)
    const almaSamurai = getConfig('prompt_alma_samurai');
    const adnCore = getConfig('prompt_adn_core');
    const estrategiaCierre = getConfig('prompt_estrategia_cierre');
    const relearningCia = getConfig('prompt_relearning');

    // ... (resto de la carga de webContent y mediaAssets omitida por brevedad, se mantiene igual)

    const systemPrompt = `
INSTRUCCIÓN CONSTITUCIONAL: Sigue estrictamente estos bloques.

=== 1. ALMA DE SAMURAI ===
${almaSamurai}

=== 2. ADN CORE (Personalidad) ===
${adnCore}

=== 3. ESTRATEGIA DE CIERRE ===
${estrategiaCierre}

=== DATOS DEL CLIENTE (USAR PARA EL LINK) ===
- Nombre: ${lead.nombre || 'Desconocido'}
- Ciudad: ${lead.ciudad || 'No proporcionada'}
- Email: ${lead.email || 'No proporcionado'}

=== DATOS FINANCIEROS (SISTEMA) ===
Usa este link SOLAMENTE si el cliente ya te dio su Email y Ciudad:
- Link WooCommerce (Auto-rellenable): ${paymentLink}
- Datos Transferencia: \n${bankInfo}

[REGLA CRÍTICA]: Nunca inventes un link de pago. Usa el proporcionado arriba. Si el cliente está en Guadalajara, el link ya lleva los parámetros necesarios para que el formulario se llene solo.
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})