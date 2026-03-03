// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    
    // 1. Cargar Configuraciones Dinámicas de la BD
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";

    // 2. Extraer Prompts del Panel (¡AQUÍ ESTABA EL ERROR, AHORA SÍ LOS LEE!)
    const adnCore = getConfig('prompt_adn_core') || "Eres Sam, asistente experto de The Elephant Bowl.";
    const estrategiaCierre = getConfig('prompt_estrategia_cierre') || "Tu objetivo es cerrar ventas. Ofrece el link de pago o datos de transferencia.";
    const relearningCia = getConfig('prompt_relearning') || "";

    // 3. Datos Financieros Dinámicos
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; 
    const paymentLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    const bankInfo = `Banco: ${getConfig('bank_name') || 'BBVA'}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    // 4. Cargar Verdad Maestra (Sitio Web)
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[FUENTE OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') || "Sin información oficial indexada.";

    // 5. Cargar Catálogo Visual (Media Manager)
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions, category').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => 
        `POSTER DISPONIBLE: "${m.title}"\n- REGLA DE ENVÍO: ${m.ai_instructions}\n- CÓDIGO DE ENVÍO: <<MEDIA:${m.url}>>`
    ).join('\n\n') || "Sin posters disponibles.";

    // 6. Construir el Prompt Maestro Consolidado
    const systemPrompt = `
${adnCore}

---

# 🛡️ ESTRATEGIA DE CIERRE Y PROTOCOLO DE VENTAS
${estrategiaCierre}

---

# 🧠 MEMORIA Y APRENDIZAJE (#CIA)
Estas son lecciones aprendidas de errores pasados. TIENEN PRIORIDAD TOTAL sobre el protocolo y la identidad:
${relearningCia ? relearningCia : 'No hay reglas de corrección activas.'}

---

# 💰 DATOS FINANCIEROS Y DE PAGO (Úsalos SIEMPRE que ofrezcas inscripción)
- Link de Pago (Tarjeta/Online): ${paymentLink}
- Datos Transferencia:
${bankInfo}

---

# 📚 BASES DE DATOS CONECTADAS (Úsalas para dar información veraz)

[CATÁLOGO VISUAL (MEDIA MANAGER)]
${mediaCatalog}

[FUENTE OFICIAL (VERDAD MAESTRA)]
${truthBlockWeb}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})