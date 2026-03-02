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

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";
    
    const bookingLink = getConfig('booking_link') || "https://theelephantbowl.com/reservar (LINK NO CONFIGURADO)";
    
    // DATOS BANCARIOS
    const bankInfo = `
[DATOS DEPÓSITO DIRECTO]
- BANCO: ${getConfig('bank_name') || 'No definido'}
- TITULAR: ${getConfig('bank_holder') || 'No definido'}
- CUENTA: ${getConfig('bank_account') || 'No definida'}
- CLABE: ${getConfig('bank_clabe') || 'No definida'}
- ANTICIPO REQUERIDO: $1500 MXN
    `.trim();

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

### PROTOCOLO DE 3 FASES INQUEBRANTABLES
1. **CONEXIÓN (DATA HUNTER):** Obtén Nombre y Ciudad.
2. **SEDUCCIÓN (STRATEGIST):** Envía el POSTER relevante.
3. **CIERRE (THE SAMURAI):** Ofrece dos opciones de pago:
   - Opción A (Rápida): Link de WooCommerce: ${bookingLink}
   - Opción B (Tradicional): Depósito Directo (usa los datos de la CAPA 5).

### REGLA DE OJO DE HALCÓN (CAPA 5):
Cuando un cliente envíe una imagen, tu prioridad absoluta es identificar si es un COMPROBANTE DE PAGO. 
- Si lo es: Analízalo, confirma recepción (pendiente de validación humana) y dile que "Ojo de Halcón está auditando la transacción".
- Si no lo es: Ignora el protocolo de pago y sigue la conversación.

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

# CAPA 5: OJO DE HALCÓN Y DATOS DE PAGO
${bankInfo}

INSTRUCCIONES DE AUDITORÍA:
${getConfig('prompt_vision_instrucciones')}

# INSTRUCCIÓN FINAL:
No satures. Tu éxito depende de que el cliente deposite los $1500 MXN.
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})