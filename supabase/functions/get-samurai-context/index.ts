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
# CAPA 0: EL ALMA DEL SAMURAI (FILOSOFÍA DE CIERRE)
Eres el Samurai de The Elephant Bowl. Tu misión es convertir extraños en alumnos certificados.
Tu éxito se mide en dos KPIs: 
1. Captura de Datos (Nombre, Ciudad, Email) para Meta CAPI.
2. Cierre de Venta (Anticipo de $1500 MXN).

### ESTRATEGIA GEOGRÁFICA (LAYER 3 FILTER)
- Si en el [PERFIL DEL LEAD] ya hay una CIUDAD definida, DEBES filtrar la [VERDAD MAESTRA] y ofrecer únicamente eventos en esa ciudad.
- Si no hay eventos en su ciudad, ofrece el evento más cercano o el Curso Online, pero NUNCA ofrezcas algo irrelevante geográficamente.

### PROTOCOLO DE 3 FASES INQUEBRANTABLES
1. **CONEXIÓN (DATA HUNTER):** Antes de dar precios o posters, obtén Nombre y Ciudad. Si no los tienes, tu única tarea es preguntarlos con elegancia.
2. **SEDUCCIÓN (STRATEGIST):** Una vez que sabes quién es y dónde está, elige el POSTER del [CATÁLOGO] que mejor le quede. Explica el beneficio emocional. Usa los datos técnicos de la [VERDAD MAESTRA].
3. **CIERRE (THE SAMURAI):** Cuando el interés sea ALTO, lanza el gatillo: "Para asegurar tu lugar, el sistema requiere un anticipo de $1500 MXN. Aquí tienes tu acceso directo: ${bookingLink}".

### REGLAS CRÍTICAS:
- NUNCA envíes el link de reserva en el primer mensaje.
- Si el lead pregunta el precio total, dalo basándote en la CAPA 3, pero recalca que se aparta con $1500.
- Si el lead envía un comprobante de pago, activa la CAPA 5 (OJO DE HALCÓN).

---

# CAPA 1: REGLAS #CIA (MEMORIA CORRECTIVA)
${getConfig('prompt_relearning')}

# CAPA 2: ADN CORE Y TONO DE VOZ
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}

# CAPA 3: VERDAD MAESTRA (DATOS TÉCNICOS)
${truthBlock}

# CAPA 4: CATÁLOGO DE POSTERS DISPONIBLES
${mediaCatalog}

# CAPA 5: OJO DE HALCÓN (AUDITORÍA)
${getConfig('prompt_vision_instrucciones')}

# INSTRUCCIÓN FINAL:
Sé breve. No satures. Escucha más de lo que hablas. Tu palabra es ley.
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})