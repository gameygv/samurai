import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fallbacks de seguridad
const DEFAULTS = {
  'prompt_core': `Eres Samurai, un asistente de ventas experto.`,
  'prompt_behavior': `Sé breve y profesional.`,
  'prompt_objections': `Responde dudas con certeza.`,
  'prompt_psychology': `Adapta tu tono al cliente.`
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

    const { message, lead_name, lead_phone, lead_id, platform, relevant_knowledge } = await req.json();

    // 1. IDENTIFICACIÓN Y CAPTURA
    let currentLeadId = lead_id;
    let leadProfile = "Nuevo Prospecto";
    let leadMood = "NEUTRO";
    let buyingIntent = "DESCONOCIDO";

    // Buscar o Crear Lead
    if (!currentLeadId && lead_phone) {
       const { data: existingLead } = await supabaseClient
          .from('leads')
          .select('*')
          .eq('telefono', lead_phone)
          .maybeSingle();
       
       if (existingLead) {
          currentLeadId = existingLead.id;
          leadMood = existingLead.estado_emocional_actual || "NEUTRO";
          buyingIntent = existingLead.buying_intent || "MEDIO";
          leadProfile = `Cliente Recurrente | Mood: ${leadMood} | Intent: ${buyingIntent}`;
          
          if (!existingLead.nombre && lead_name) {
             await supabaseClient.from('leads').update({ nombre: lead_name }).eq('id', currentLeadId);
          }
       } else {
          const { data: newLead } = await supabaseClient
             .from('leads')
             .insert({ 
                nombre: lead_name || 'Desconocido', 
                telefono: lead_phone, 
                origen: platform || 'API',
                last_message_at: new Date().toISOString()
             })
             .select()
             .single();
          if (newLead) currentLeadId = newLead.id;
       }
    }

    // Guardar mensaje INPUT
    if (currentLeadId && message) {
       await supabaseClient.from('conversaciones').insert({
          lead_id: currentLeadId,
          emisor: 'CLIENTE',
          mensaje: message,
          platform: platform || 'API'
       });
       await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', currentLeadId);
    }

    // 2. PROMPTS
    const { data: configData } = await supabaseClient.from('app_config').select('key, value').eq('category', 'PROMPT');
    const prompts: Record<string, string> = { ...DEFAULTS };
    if (configData && configData.length > 0) {
       configData.forEach((item: any) => { 
          if(item.value && item.value.trim().length > 0) {
             prompts[item.key] = item.value; 
          }
       });
    }

    // 3. MEMORIA (30 mensajes)
    let chatHistoryText = "Sin historial previo (Inicio de conversación).";
    if (currentLeadId) {
       const { data: history } = await supabaseClient
          .from('conversaciones')
          .select('emisor, mensaje, created_at')
          .eq('lead_id', currentLeadId)
          .order('created_at', { ascending: false })
          .limit(30);
       
       if (history && history.length > 0) {
          chatHistoryText = history.reverse().map(m => {
             const time = new Date(m.created_at).toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'});
             return `[${time}] ${m.emisor}: ${m.mensaje}`;
          }).join('\n');
       }
    }

    // 4. RAG NATIVO
    let ragContext = relevant_knowledge || "";
    let ragSources: string[] = []; // Debug info

    if (!ragContext && message && message.length > 3) {
       const query = message.replace(/[^\w\s]/gi, '').split(' ').filter((w: string) => w.length > 3).join(' | ');
       if (query.length > 0) {
          const { data: docs } = await supabaseClient
             .from('knowledge_documents')
             .select('title, content')
             .textSearch('content', query, { type: 'websearch', config: 'spanish' })
             .limit(2);

          if (docs && docs.length > 0) {
             ragContext = docs.map((d: any) => `📌 DATOS DE "${d.title}":\n${d.content}`).join('\n\n');
             ragSources = docs.map((d: any) => d.title);
          }
       }
    }

    // 5. MEDIA
    const { data: mediaAssets } = await supabaseClient
       .from('media_assets')
       .select('title, url, ai_instructions, type')
       .not('ai_instructions', 'is', null)
       .neq('ai_instructions', '');
    
    const mediaContext = mediaAssets && mediaAssets.length > 0
       ? mediaAssets.map(m => ` - [${m.type}] ${m.title}: ${m.url} (USAR SI: ${m.ai_instructions})`).join('\n')
       : "No hay archivos multimedia disponibles.";

    // 6. LECCIONES
    const { data: learnings } = await supabaseClient
       .from('errores_ia')
       .select('correccion_sugerida')
       .eq('estado_correccion', 'VALIDADA')
       .order('applied_at', { ascending: false })
       .limit(10);
    
    const learnedLessons = learnings && learnings.length > 0
       ? learnings.map(l => `🔴 EVITAR ERROR PREVIO: ${l.correccion_sugerida}`).join('\n')
       : "Sin correcciones reportadas aún.";

    // 7. SYSTEM PROMPT MAESTRO (INTEGRADO TOTAL)
    const fullSystemPrompt = `
=== 🧠 IDENTIDAD & OBJETIVO (CORE) ===
${prompts['prompt_core']}

=== 📜 PROTOCOLOS ===
${prompts['prompt_behavior']}
${prompts['prompt_objections']}
${prompts['prompt_closing_strategy']}

=== 👁️ VISIÓN & VALIDACIÓN DE PAGOS ===
ATENCIÓN: Si el cliente envía una imagen o comprobante, aplica estas reglas:
1. ANÁLISIS: ${prompts['prompt_vision_analysis'] || 'Verifica fecha, monto y banco.'}
2. VALIDACIÓN: ${prompts['prompt_match_validation'] || 'Compara con deuda pendiente.'}
3. ACCIÓN POSTERIOR: ${prompts['prompt_post_validation'] || 'Confirma recepción.'}

=== 👤 PERFIL ACTUAL ===
Mood: ${leadMood} | Intent: ${buyingIntent}
Instrucción: ${prompts['prompt_psychology']}

=== 🕰️ MEMORIA ===
${chatHistoryText}

=== 📦 MEDIA DISPONIBLE ===
${mediaContext}

=== 🔍 CONOCIMIENTO (RAG) ===
${ragContext || 'Usa tu conocimiento general.'}

=== 🚫 LECCIONES APRENDIDAS ===
${learnedLessons}
${prompts['prompt_relearning'] || ''}

=== ⚡ PROTOCOLO DE SALIDA ===
1. Responde naturalmente.
2. Si detectas un comprobante válido, confírmalo según reglas de Visión.
3. AL FINAL, añade SIEMPRE el bloque de análisis:
[[ANALYSIS: {"mood": "...", "intent": "...", "summary": "..."}]]
    `;

    return new Response(
      JSON.stringify({
        lead_id: currentLeadId,
        system_prompt: fullSystemPrompt,
        debug: {
            rag_sources: ragSources,
            media_count: mediaAssets?.length || 0,
            profile: { mood: leadMood, intent: buyingIntent }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Brain Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})