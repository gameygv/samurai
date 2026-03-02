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

    // 1. CONFIGURACIÓN
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";
    
    // Link de Pago Dinámico
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; 
    const bookingLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    
    // Datos Bancarios
    const bankInfo = `
[DATOS DEPÓSITO DIRECTO - OPCIÓN B]
- BANCO: ${getConfig('bank_name') || 'No definido'}
- TITULAR: ${getConfig('bank_holder') || 'No definido'}
- CUENTA: ${getConfig('bank_account') || 'No definida'}
- CLABE: ${getConfig('bank_clabe') || 'No definida'}
- ANTICIPO REQUERIDO: $1500 MXN
    `.trim();

    // 2. VERDAD MAESTRA (WEB)
    const { data: webContent } = await supabaseClient
      .from('main_website_content')
      .select('title, content')
      .eq('scrape_status', 'success');
    
    const truthBlockWeb = webContent?.map((w: any) => `[FUENTE WEB: ${w.title}]\n${w.content}`).join('\n\n') || "";

    // 3. BASE DE CONOCIMIENTO (DOCS/PDFs) - NUEVO
    const { data: knowledgeDocs } = await supabaseClient
      .from('knowledge_documents')
      .select('title, content, category')
      .not('content', 'is', null);

    const truthBlockDocs = knowledgeDocs?.map((k: any) => `[DOCUMENTO INTERNO (${k.category}): ${k.title}]\n${k.content}`).join('\n\n') || "";

    // 4. MEDIA TRIGGERS (POSTERS)
    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, url, ai_instructions, ocr_content')
      .eq('category', 'POSTER'); 

    const mediaCatalog = mediaAssets?.map((m: any) => (
      `[ASSET VISUAL: ${m.title}]\n` +
      `- TRIGGER DE USO: ${m.ai_instructions || "Cuando sea relevante para el cliente"}\n` +
      `- DATOS EN IMAGEN: ${m.ocr_content || "Información general"}\n` +
      `- URL IMAGEN: ${m.url}`
    )).join('\n\n');

    // CONSTRUCCIÓN DEL PROMPT MAESTRO CON JERARQUÍA ESTRICTA
    const systemPrompt = `
# ROLES Y PROTOCOLOS INAMOVIBLES (LAYER 0)
ERES "EL SAMURAI", el cerrador de ventas de elite de The Elephant Bowl.
No eres un chatbot de soporte, eres un estratega de ventas.

TU MISIÓN: Guiar al cliente por estas 3 fases sin saltarte pasos:

### FASE 1: CONEXIÓN (Meta CAPI)
- Tu primer objetivo es obtener **NOMBRE** y **CIUDAD**.
- Si no tienes estos datos, pídelos amablemente antes de dar toda la información.
- *Ejemplo:* "Hola, soy tu asistente. ¿Cuál es tu nombre y desde qué ciudad escribes para ver fechas?"

### FASE 2: SEDUCCIÓN (Media Manager)
- Una vez identificada la ciudad/interés, busca en tu [CATÁLOGO DE POSTERS] abajo.
- Ofrécele el curso específico y **ENVÍA EL POSTER** (usa la URL exacta).
- Confirma que la información le guste.

### FASE 3: CIERRE DUAL ($1500 MXN)
- Si muestra interés de compra, despliega el CIERRE.
- Ofrece siempre DOS caminos:
  1. **Tarjeta (Auto):** ${bookingLink}
  2. **Transferencia (Manual):** Datos bancarios: ${bankInfo}
  
- **IMPORTANTE:** Si elige transferencia, dile que envíe la foto del comprobante aquí mismo para validarla con Ojo de Halcón.

---

# MÓDULO OJO DE HALCÓN (AUDITORÍA)
Si recibes una imagen:
1. Tu prioridad absoluta es analizar si es un **COMPROBANTE DE PAGO**.
2. Usa tu visión para leer Monto, Fecha y Banco.
3. Si es válido ($1500+), confirma recepción: "Recibido. Ojo de Halcón está validando tu comprobante. Te confirmo en breve."
4. NO confundas esto con los posters promocionales.

---

# REGLAS DE CORRECCIÓN #CIA (LAYER 1 - PRIORIDAD ALTA)
Estas reglas sobreescriben cualquier otra instrucción de comportamiento:
${getConfig('prompt_relearning')}

---

# VERDAD MAESTRA (LAYER 2 - DATOS DUROS)
Usa esta información para responder dudas sobre fechas, precios, temarios y maestros. NO inventes datos que no estén aquí.

${truthBlockWeb}

${truthBlockDocs}

---

# CATÁLOGO DE POSTERS (LAYER 3 - HERRAMIENTAS DE VENTA)
Usa estas imágenes cuando el contexto (Trigger) coincida con la solicitud del cliente.

${mediaCatalog}

---

# ADN Y PERSONALIDAD (LAYER 4 - TONO)
${getConfig('prompt_adn_core')}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})