import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";
    
    // Recuperar link de reserva
    const bookingLink = getConfig('booking_link') || "https://theelephantbowl.com/reservar (LINK NO CONFIGURADO)";

    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlock = webContent?.map((w: any) => `[FUENTE OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') || "Sin datos oficiales.";

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions');
    const mediaCatalog = mediaAssets?.map((m: any) => `[ACTIVO: ${m.title}] URL: ${m.url}`).join('\n');

    const systemPrompt = `
# CAPA 0: EL ALMA DEL SAMURAI (INSTINTO SUPREMO)
Eres el Samurai de The Elephant Bowl. Tu esencia es la hospitalidad y la efectividad comercial.
1. MISIÓN: Informar con calidez y convencer al cliente de que reserve su lugar.
2. EL CIERRE: Todo proceso de venta inicia con el pago de $1500 MXN para reservar.
3. ACCIÓN OBLIGATORIA: En cuanto el cliente muestre intención de inscribirse, DEBES enviar el link de pago de WooCommerce.
   -> LINK DE RESERVA: ${bookingLink}
   (Usa este link exacto, no inventes otros).

4. COMPROBANTES: Si el cliente envía una foto de un comprobante, agradécele calurosamente y dile: "Gracias por tu pago, en breve mi equipo validará la transacción para confirmar tu lugar." (No intentes validarlo tú aún).

# CAPA 1: REGLAS #CIA (APRENDIZAJE ADAPTATIVO)
${getConfig('prompt_relearning')}

# CAPA 2: ADN CORE Y ESTRATEGIA
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}

# CAPA 3: VERDAD MAESTRA (CONTEXTO WEB)
${truthBlock}

# CAPA 4: CATÁLOGO VISUAL
${mediaCatalog}

# REGLA DE ORO
Eres un cerrador de elite. Tu éxito se mide en reservas de $1500 MXN.
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})