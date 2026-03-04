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

    // 2. Construcción de Link de Pago Robusto
    const wcUrl = getConfig('wc_url', "https://theelephantbowl.com");
    const checkoutPath = getConfig('wc_checkout_path', "/inscripciones/");
    const productId = getConfig('wc_product_id', "1483"); 
    
    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const path = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;
    
    let paymentLink = `${baseUrl}${path}?add-to-cart=${productId}`;
    
    // Inyección de parámetros redundantes (Shotgun approach para formularios WP)
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) {
        const names = lead.nombre.trim().split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ');
        
        paymentLink += `&billing_first_name=${encodeURIComponent(firstName)}&first_name=${encodeURIComponent(firstName)}&nombre=${encodeURIComponent(firstName)}`;
        if (lastName) {
           paymentLink += `&billing_last_name=${encodeURIComponent(lastName)}&last_name=${encodeURIComponent(lastName)}&apellidos=${encodeURIComponent(lastName)}`;
        }
    }
    
    if (lead.email) {
       paymentLink += `&billing_email=${encodeURIComponent(lead.email)}&email=${encodeURIComponent(lead.email)}&correo=${encodeURIComponent(lead.email)}`;
    }
    
    if (lead.telefono) {
       paymentLink += `&billing_phone=${encodeURIComponent(lead.telefono)}&phone=${encodeURIComponent(lead.telefono)}&telefono=${encodeURIComponent(lead.telefono)}`;
    }
    
    if (lead.ciudad) {
       paymentLink += `&billing_city=${encodeURIComponent(lead.ciudad)}&city=${encodeURIComponent(lead.ciudad)}&ciudad=${encodeURIComponent(lead.ciudad)}`;
    }

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    // 3. Cargar el resto del contexto
    const pAlma = getConfig('prompt_alma_samurai');
    const pAdn = getConfig('prompt_adn_core');
    const pEstrategia = getConfig('prompt_estrategia_cierre');
    const pRelearning = getConfig('prompt_relearning');

    const systemPrompt = `
INSTRUCCIÓN CONSTITUCIONAL: Sigue estrictamente estos bloques.

=== 1. ALMA DE SAMURAI ===
${pAlma}

=== 2. ADN CORE (Personalidad) ===
${pAdn}

=== 3. ESTRATEGIA DE CIERRE ===
${pEstrategia}

=== DATOS DEL CLIENTE (PARA EL LINK) ===
- Nombre: ${lead.nombre || 'Desconocido'}
- Ciudad: ${lead.ciudad || 'No proporcionada'}
- Email: ${lead.email || 'No proporcionado'}

=== DATOS FINANCIEROS (SISTEMA) ===
Usa este link SOLAMENTE si el cliente ya te dio su Email y Ciudad:
- Link de Inscripción (Auto-rellenable): ${paymentLink}
- Datos Transferencia: \n${bankInfo}

[REGLA CRÍTICA]: Nunca inventes un link. Usa el de arriba. Los parámetros añadidos al final (&first_name, etc) sirven para que el cliente no tenga que escribir sus datos de nuevo.
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})