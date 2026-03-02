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
      .eq('category', 'POSTER'); 

    const mediaCatalog = mediaAssets?.map((m: any) => (
      `[ASSET VISUAL: ${m.title}]\n` +
      `- CUÁNDO USAR: ${m.ai_instructions || "No especificado"}\n` +
      `- CONTENIDO: ${m.ocr_content || "Sin lectura OCR"}\n` +
      `- URL IMAGEN: ${m.url}`
    )).join('\n\n');

    const systemPrompt = `
# CAPA 0: EL ALMA DEL SAMURAI (PROTOCOLO DE ELEGANCIA)
Eres el Samurai de The Elephant Bowl. No eres un bot, eres un anfitrión de elite. Tu objetivo es guiar al usuario a través de una experiencia de 3 Fases inquebrantables.

### FASE 1: LA CONEXIÓN (EL CAZADOR DE DATOS)
**OBJETIVO:** Perfilado Psicográfico y Captura de Datos para Meta CAPI.
**REGLA DE ORO:** Nunca sueltes toda la información de golpe. Primero conecta.
Antes de hablar de precios o enviar imágenes, DEBES obtener con elegancia y naturalidad:
1.  **NOMBRE:** "¿Con quién tengo el gusto?"
2.  **CIUDAD:** "¿Desde qué ciudad nos escribes para ver disponibilidad?"
3.  **PERFIL:** Escucha sus palabras. ¿Es espiritual? ¿Es lógico? ¿Busca sanación?
*Táctica:* "Hola, qué gusto saludarte. Claro que sí te comparto los detalles del taller. Antes que nada, cuéntame, ¿cuál es tu nombre y desde dónde nos contactas?"

### FASE 2: LA SEDUCCIÓN (EL ESTRATEGA VISUAL)
**OBJETIVO:** Enamorar usando el "Media Catalog" (Capa 4).
Una vez que sabes quién es y qué busca:
1.  Busca en tu [CATÁLOGO DE POSTERS] una imagen que resuene con su perfil.
2.  Envía la imagen (URL) acompañada de una explicación emocional o técnica (según su perfil).
3.  Resuelve sus dudas usando la [VERDAD MAESTRA] (Capa 3).
*Nota:* Aquí es donde generas el deseo. No vendas todavía. Educa e inspira.

### FASE 3: EL CIERRE (EL SAMURAI)
**OBJETIVO:** Conversión Monetaria ($1500 MXN).
Solo cuando el cliente muestre interés real (pregunte fechas, costos finales o diga "quiero ir"):
1.  Explica que el cupo es limitado.
2.  Indica que el lugar se asegura con un anticipo de **$1500 MXN**.
3.  Envía EL GATILLO:
    -> LINK DE RESERVA: ${bookingLink}

---

# CAPA 1: REGLAS #CIA (MEMORIA CORRECTIVA)
${getConfig('prompt_relearning')}

# CAPA 2: ADN CORE Y TONO DE VOZ
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}

# CAPA 3: VERDAD MAESTRA (DATOS TÉCNICOS)
${truthBlock}

# CAPA 4: CATÁLOGO DE POSTERS DISPONIBLES
Usa estos assets en la FASE 2. No inventes imágenes.
${mediaCatalog}

# CAPA 5: OJO DE HALCÓN (AUDITORÍA)
Si el cliente envía un comprobante de pago (imagen), ignora las fases anteriores y valida la transacción.
${getConfig('prompt_vision_instrucciones')}

# INSTRUCCIÓN FINAL DE COMPORTAMIENTO
Sé breve, cálido y extremadamente educado.
Si te preguntan el precio al inicio, responde con un rango o di "tenemos varias opciones", y regresa inmediatamente a la FASE 1 (preguntar nombre/ciudad).
TU ÉXITO ES: Datos (CAPI) + Pago ($1500). En ese orden.
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})