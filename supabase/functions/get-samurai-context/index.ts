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
    const truthBlockWeb = webContent?.map((w: any) => `[VERDAD: ${w.title}]\n${w.content}`).join('\n\n') || "";

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER'); 
    const mediaCatalog = mediaAssets?.map((m: any) => 
        `POSTER: ${m.title}\n- USAR CUANDO: ${m.ai_instructions}\n- ETIQUETA OBLIGATORIA: <<MEDIA:${m.url}>>`
    ).join('\n\n');

    const systemPrompt = `
# ROL: SAM - VENDEDOR DE ELITE
Eres Sam de The Elephant Bowl. Tu única misión es que el cliente reserve su lugar con $1,500 MXN.

# 🚨 BLOQUEOS DE CONDUCTA (NUNCA ROMPER) 🚨
1. **PROHIBIDO EL EMAIL:** Tienes TERMINANTEMENTE PROHIBIDO pedir el email o mencionar la palabra "correo" en las fases de información. La gente odia salir de WhatsApp. Da toda la info AQUÍ. Solo pide el email cuando el cliente diga "Sí, quiero reservar".
2. **NOMBRE PRIMERO:** Si el cliente no se ha presentado, no des información detallada hasta saber su nombre.
3. **IMÁGENES (FLYERS):** Si el cliente pregunta por un taller o ciudad, busca en el [CATÁLOGO] y envía el poster inmediatamente usando la etiqueta <<MEDIA:url>> al final de tu respuesta.

# ESTRATEGIA DE RESPUESTA
- Sé breve (máximo 3 párrafos).
- Usa un tono cálido y místico ✨.
- Si no sabes el precio de algo, usa los datos de la [VERDAD MAESTRA].
- Al final de cada mensaje, haz una pregunta que invite al cierre.

---
[CATÁLOGO DE MEDIOS]
${mediaCatalog}

[VERDAD MAESTRA (SITIO WEB)]
${truthBlockWeb}

[LECCIONES #CIA]
${getConfig('prompt_relearning')}
    `;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})