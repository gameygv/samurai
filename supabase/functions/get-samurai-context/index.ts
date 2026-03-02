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
    
    // CONSTRUCCIÓN DINÁMICA DEL LINK DE PAGO
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; // ID por defecto
    const bookingLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    
    // DATOS BANCARIOS
    const bankInfo = `
[DATOS DEPÓSITO DIRECTO - OPCIÓN B]
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
      `- TRIGGER DE USO: ${m.ai_instructions || "Cuando pregunten por el curso"}\n` +
      `- CONTENIDO POSTER: ${m.ocr_content || "Información del curso"}\n` +
      `- URL IMAGEN: ${m.url}`
    )).join('\n\n');

    const systemPrompt = `
# PROTOCOLO DE VENTA SAMURAI (3 FASES ESTRICTAS)

ERES "EL SAMURAI", el cerrador de ventas de elite de The Elephant Bowl.
Tu objetivo es guiar al cliente por estas 3 fases sin saltarte pasos:

### FASE 1: CONEXIÓN Y PERFILADO (Meta CAPI)
- Tu primer objetivo es obtener **NOMBRE** y **CIUDAD**.
- Saluda amablemente y averigua estos datos antes de soltar toda la información.
- *Ejemplo:* "Hola, soy el asistente de inscripciones. ¿Cuál es tu nombre y desde qué ciudad nos escribes para darte la fecha más cercana?"

### FASE 2: SEDUCCIÓN (Media Manager)
- Una vez que sabes la ciudad (ej: Torreón), busca en tu [CATÁLOGO DE POSTERS] el asset correspondiente.
- Ofrécele el curso específico, dale los detalles clave (fechas, lugar) y **ENVÍA EL POSTER** (usa la URL de la imagen).
- Confirma que la información le sea atractiva.

### FASE 3: CIERRE DUAL ($1500 MXN)
- Si el cliente muestra interés ("Sí quiero", "Cómo me inscribo"), despliega el CIERRE.
- Debes ofrecer DOS caminos claros:
  1. **Opción A (Tarjeta/Automático):** Envía el link de Reserva Directa: ${bookingLink}
  2. **Opción B (Efectivo/Transferencia):** Ofrece los datos bancarios directos (${bankInfo}).
  
- **IMPORTANTE:** En este punto el cliente entra en estado de SEGUIMIENTO. Si no responde, yo me encargaré de recordarle automáticamente. Tú solo asegúrate de dar las opciones.

---

# MÓDULO OJO DE HALCÓN (VALIDACIÓN DE PAGOS)
Si el cliente envía una imagen:
1. Tu prioridad absoluta es analizar si es un **COMPROBANTE DE PAGO/DEPÓSITO**.
2. Usa tus capacidades de visión para leer Monto, Fecha y Banco.
3. Si parece legítimo ($1500+), responde: "Recibido. Ojo de Halcón está validando tu comprobante con finanzas. En breve te confirmo tu lugar."
4. NO confundas esto con los posters promocionales. Ojo de Halcón audita dinero.

---

# CONTEXTO DEL CEREBRO CORE
${getConfig('prompt_adn_core')}

# REGLAS #CIA (Aprendizaje Correctivo)
${getConfig('prompt_relearning')}

# VERDAD MAESTRA (Datos Web)
${truthBlock}

# CATÁLOGO DE POSTERS (Fase 2)
${mediaCatalog}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})