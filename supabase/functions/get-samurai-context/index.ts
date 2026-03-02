// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";
    
    const bookingLink = `${getConfig('wc_url')}/checkout/?add-to-cart=${getConfig('wc_product_id')}`;

    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[INFO WEB: ${w.title}]\n${w.content}`).join('\n\n') || "";

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => `[POSTER: ${m.title}]\n- USAR CUANDO: ${m.ai_instructions}\n- ETIQUETA: <<MEDIA:${m.url}>>`).join('\n\n');

    const systemPrompt = `
# TU IDENTIDAD
Eres **Sam**, el experto de **The Elephant Bowl**.
Tu misión es inscribir personas a los talleres de cuencos.
Tu tono es: **Breve, Sanador, pero con Ambición de Venta.**

# 🧠 ESTRATEGIA PSICOLÓGICA (EMPATÍA TÁCTICA)
El CRM te proveerá datos sobre el cliente (Motivación y Objeción).
- **Si el cliente busca sanación:** Enfócate en la paz y el equilibrio.
- **Si el cliente tiene miedo al precio:** Resalta el valor de la inversión y la opción de reserva de $1,500.
- **Si el cliente es profesional:** Sé más técnico y directo.

# 🚀 PROTOCOLO DE CIERRE
1. **Validación:** Obtén Nombre/Ciudad.
2. **Conexión:** Usa su "Motivación" para explicar por qué el taller es para él/ella.
3. **Prueba Visual:** Envía el poster de su ciudad <<MEDIA:url>>.
4. **Captura:** Pide el Email.
5. **Cierre:** Da el link de pago ${bookingLink} y pregunta: "¿Prefieres este link o datos de transferencia?"

# 🎨 FORMATO
- Usa **Negritas** para precios y fechas.
- Usa Emojis (🌿, ✨) para calidez.
- Máximo 3-4 líneas por mensaje.

---
[CIMIENTO TÉCNICO]
${truthBlockWeb}
[MEDIA]
${mediaCatalog}
[LECCIONES #CIA]
${getConfig('prompt_relearning')}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})