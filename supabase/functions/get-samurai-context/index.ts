import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fallbacks de seguridad
const DEFAULTS = {
  'prompt_core': `Eres Samurai, asistente experto de The Elephant Bowl. Tu misión es vender el anticipo de lugar de $1500.`,
  'prompt_technical': `Responde en texto plano.`,
  'prompt_behavior': `Sé empático pero enfocado en el cierre.`,
  'prompt_objections': `Maneja objeciones con firmeza y amabilidad.`,
  'shop_base_url': `https://theelephantbowl.com/finalizar-compra/`, // Valor seguro
  'reservation_product_id': `4521` // ID genérico por defecto
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { message, lead_name, lead_phone, lead_id, platform } = await req.json();

    // 1. OBTENER CONFIGURACIÓN
    const { data: configData } = await supabaseClient.from('app_config').select('key, value');
    const configs: Record<string, string> = { ...DEFAULTS };
    if (configData) {
       configData.forEach((item: any) => { configs[item.key] = item.value || DEFAULTS[item.key as keyof typeof DEFAULTS] || ''; });
    }

    // 2. RAG NATIVO
    const { data: knowledge } = await supabaseClient
      .from('knowledge_documents')
      .select('title, content, type, external_link')
      .limit(3); 
    
    let knowledgeContext = knowledge?.map(d => 
      `DOCUMENTO [${d.title}]: ${d.content?.substring(0, 1000)} ${d.external_link ? '(Link: ' + d.external_link + ')' : ''}`
    ).join('\n\n') || "No hay documentos específicos encontrados.";

    // 3. MEDIA TRIGGERS
    const { data: mediaTriggers } = await supabaseClient
      .from('media_assets')
      .select('title, url, ai_instructions')
      .not('ai_instructions', 'is', null);

    let mediaContext = mediaTriggers?.map(m => 
      `MEDIA [${m.title}]: Si detectas que ${m.ai_instructions}, ofrece este link: ${m.url}`
    ).join('\n') || "No hay disparadores de media activos.";

    // 4. DATOS DEL LEAD
    let currentLeadId = lead_id;
    let leadMood = "NEUTRO";
    let buyingIntent = "DESCONOCIDO";
    let leadSummary = "";

    if (lead_phone || lead_id) {
       const query = supabaseClient.from('leads').select('*');
       if (lead_id) query.eq('id', lead_id);
       else query.eq('telefono', lead_phone);
       
       const { data: lead } = await query.maybeSingle();
       if (lead) {
          currentLeadId = lead.id;
          leadMood = lead.estado_emocional_actual;
          buyingIntent = lead.buying_intent;
          leadSummary = lead.summary;
       }
    }

    // Construcción del Link Seguro
    const baseURL = configs['shop_base_url'] || DEFAULTS['shop_base_url'];
    const prodID = configs['reservation_product_id'] || DEFAULTS['reservation_product_id'];
    const checkoutUrl = `${baseURL}?add-to-cart=${prodID}`;

    const fullSystemPrompt = `
=== 🧠 IDENTIDAD ELEPHANT BOWL ===
${configs['prompt_core']}
Objetivo: Vender anticipo de $1500 MXN.

=== 📚 CONOCIMIENTO ESPECÍFICO (RAG) ===
Usa esta información técnica para responder dudas:
${knowledgeContext}

=== 📸 DISPARADORES MULTIMEDIA ===
${mediaContext}

=== 🔗 LINK DE VENTA ===
${checkoutUrl}

=== 📜 COMPORTAMIENTO ===
${configs['prompt_behavior']}
${configs['prompt_objections']}

=== 🧬 CONTEXTO CLIENTE ===
Nombre: ${lead_name || 'Prospecto'} | Mood: ${leadMood} | Intención: ${buyingIntent}
Resumen: ${leadSummary}

=== ⚡ REGLA DE ORO ===
Sé directo. Si el cliente tiene dudas sobre talleres, usa el conocimiento arriba. Si está listo, envía el link de $1500.
Finaliza siempre con:
[[ANALYSIS: {"mood": "...", "intent": "...", "summary": "..."}]]
    `;

    return new Response(
      JSON.stringify({ lead_id: currentLeadId, system_prompt: fullSystemPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})