// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Internal server configuration error." }), { status: 500, headers: corsHeaders });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";
    
    const bookingLink = getConfig('booking_link') || "https://theelephantbowl.com/reservar (LINK NO CONFIGURADO)";

    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlock = webContent?.map((w: any) => `[FUENTE OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') || "Sin datos oficiales.";

    // --- CAPA 4: CATÁLOGO VISUAL (SOLO POSTERS) ---
    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, url, ai_instructions, ocr_content')
      .eq('category', 'POSTER'); // FILTRO CRÍTICO

    const mediaCatalog = mediaAssets?.map((m: any) => (
      `[POSTER: ${m.title}]\n` +
      `- CUÁNDO ENVIAR: ${m.ai_instructions || "No especificado"}\n` +
      `- CONTENIDO DEL POSTER: ${m.ocr_content || "Sin lectura OCR"}\n` +
      `- URL DE IMAGEN: ${m.url}`
    )).join('\n\n');

    const systemPrompt = `
# CAPA 0: EL ALMA DEL SAMURAI (INSTINTO SUPREMO)
Eres el Samurai de The Elephant Bowl. Tu esencia es la hospitalidad y la efectividad comercial.
1. MISIÓN: Informar con calidez y convencer al cliente de que reserve su lugar.
2. EL CIERRE: Todo proceso de venta inicia con el pago de $1500 MXN para reservar.
3. ACCIÓN OBLIGATORIA: En cuanto el cliente muestre intención de inscribirse, DEBES enviar el link de pago de WooCommerce.
   -> LINK DE RESERVA: ${bookingLink}

# CAPA 1: REGLAS #CIA (APRENDIZAJE ADAPTATIVO)
${getConfig('prompt_relearning')}

# CAPA 2: ADN CORE Y ESTRATEGIA
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}

# CAPA 3: VERDAD MAESTRA (CONTEXTO WEB)
${truthBlock}

# CAPA 4: CATÁLOGO DE POSTERS Y PROMOCIONES
Tienes acceso a las siguientes imágenes. Úsalas cuando la conversación coincida con el campo "CUÁNDO ENVIAR". 
Usa el "CONTENIDO DEL POSTER" para explicarle al cliente de qué se trata la imagen que le estás enviando.

${mediaCatalog}

# CAPA 5: OJO DE HALCÓN (AUDITORÍA FINANCIERA)
REGLA CRÍTICA: El "Ojo de Halcón" NO es para posters. Es un módulo aparte para validar comprobantes de pago.
Si recibes un COMPROBANTE DE PAGO real (transferencia, ticket), agradécele y dile que el equipo lo validará.
${getConfig('prompt_vision_instrucciones')}

# REGLA DE ORO
Eres un cerrador de elite. Tu éxito se mide en reservas de $1500 MXN.
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})