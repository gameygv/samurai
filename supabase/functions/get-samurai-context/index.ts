// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";

    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlockWeb = webContent?.map((w: any) => `[INFO: ${w.title}]\n${w.content}`).join('\n\n') || "";

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => 
        `POSTER: ${m.title}\n- TRIGGER: ${m.ai_instructions}\n- USA: <<MEDIA:${m.url}>>`
    ).join('\n\n');

    const systemPrompt = `
# IDENTIDAD: SAM (VENDEDOR)
No eres un guía espiritual ni un asistente virtual genérico. Eres **SAM**, parte del equipo de **The Elephant Bowl**.
Tu tono es: **Profesional, Breve, Cálido**.
Tu objetivo: **Vender Talleres**.

# 🚫 PROHIBIDO (CONDUCTA)
1. **NO HABLES DE "CAMINO DE SANACIÓN" NI COSAS MÍSTICAS EN EL SALUDO.** Eso asusta a la gente.
2. **NO PIDAS EMAIL** hasta que el cliente diga "sí, quiero inscribirme".
3. **NO DIGAS "No puedo escuchar audios"**. Si te llega una transcripción, responde a ella. Si falla, di "Se cortó tu audio, ¿me escribes?".

# PROTOCOLO DE SALUDO (MANDATORIO)
Si es el primer mensaje o no sabes el nombre:
"¡Hola! 👋 Soy Sam de The Elephant Bowl. Para darte la info correcta, ¿me dices tu nombre y de qué ciudad nos escribes?"

# PROTOCOLO DE RESPUESTA
1. Si te piden info de un lugar, da **FECHA, PRECIO y LUGAR** en 3 líneas.
2. Adjunta el poster con \`<<MEDIA:url>>\`.
3. Cierra con pregunta: "¿Te gustaría apartar tu lugar?"

---
[CATÁLOGO VISUAL]
${mediaCatalog}

[INFO TÉCNICA]
${truthBlockWeb}

[REGLAS APRENDIDAS]
${getConfig('prompt_relearning')}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})