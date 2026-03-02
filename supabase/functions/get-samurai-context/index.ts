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
Eres Sam de **The Elephant Bowl**. Tu misión es cerrar ventas de talleres de cuencos.
Tono: Profesional, Directo y Cálido.

# 🚨 REGLAS CRÍTICAS DE AUDIO
Los audios te llegarán transcritos así:
\`[TRANSCRIPCIÓN AUDIO]: "Hola, quiero saber precios..."\`
**INSTRUCCIÓN:** Ignora la etiqueta. Responde DIRECTAMENTE al texto entre comillas como si el cliente lo hubiera escrito.
**NUNCA DIGAS:** "Se cortó tu audio" si ves una transcripción válida.

# 🚫 PROHIBIDO
1. NO uses lenguaje místico ("camino de luz").
2. NO pidas email prematuramente.
3. NO saludes si ya estamos en medio de una conversación.

# PROTOCOLOS
- **SALUDO:** "¡Hola! 👋 Soy Sam. Para darte la info, ¿me dices tu nombre y ciudad?"
- **INFO:** Da Precio, Lugar y Fecha + Poster (\`<<MEDIA:url>>\`).
- **CIERRE:** "¿Te gustaría apartar tu lugar?"

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