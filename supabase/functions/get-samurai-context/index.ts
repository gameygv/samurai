import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fallbacks de seguridad por si la BD falla
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

    // 1. IDENTIFICACIÓN Y CAPTURA (CRÍTICO PARA MEMORIA)
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
          // Recuperamos perfilado previo para "Autoaprendizaje"
          leadMood = existingLead.estado_emocional_actual || "NEUTRO";
          buyingIntent = existingLead.buying_intent || "MEDIO";
          leadProfile = `Cliente Recurrente | Mood: ${leadMood} | Intent: ${buyingIntent}`;
          
          // Actualizar nombre si no existía
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

    // Guardar el mensaje del Usuario (INPUT)
    // Esto asegura que NADA se pierda.
    if (currentLeadId && message) {
       await supabaseClient.from('conversaciones').insert({
          lead_id: currentLeadId,
          emisor: 'CLIENTE',
          mensaje: message,
          platform: platform || 'API'
       });
       // Actualizar timestamp para que suba en el dashboard
       await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', currentLeadId);
    }

    // 2. RECUPERACIÓN DE CEREBRO (Prompts Dinámicos)
    const { data: configData } = await supabaseClient.from('app_config').select('key, value').eq('category', 'PROMPT');
    const prompts: Record<string, string> = { ...DEFAULTS };
    if (configData && configData.length > 0) {
       configData.forEach((item: any) => { 
          if(item.value && item.value.trim().length > 0) {
             prompts[item.key] = item.value; 
          }
       });
    }

    // 3. MEMORIA PROFUNDA (Contexto Histórico)
    // Aumentamos a 30 mensajes para tener contexto real de conversaciones largas.
    let chatHistoryText = "Sin historial previo (Inicio de conversación).";
    if (currentLeadId) {
       const { data: history } = await supabaseClient
          .from('conversaciones')
          .select('emisor, mensaje, created_at')
          .eq('lead_id', currentLeadId)
          .order('created_at', { ascending: false })
          .limit(30); // AUMENTADO DE 15 A 30
       
       if (history && history.length > 0) {
          // Formateamos para que la IA entienda la secuencia temporal
          chatHistoryText = history.reverse().map(m => {
             const time = new Date(m.created_at).toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'});
             return `[${time}] ${m.emisor}: ${m.mensaje}`;
          }).join('\n');
       }
    }

    // 4. MEDIA ASSETS (Inventario Visual)
    const { data: mediaAssets } = await supabaseClient
       .from('media_assets')
       .select('title, url, ai_instructions, type')
       .not('ai_instructions', 'is', null)
       .neq('ai_instructions', '');
    
    const mediaContext = mediaAssets && mediaAssets.length > 0
       ? mediaAssets.map(m => ` - [${m.type}] ${m.title}: ${m.url} (USAR SI: ${m.ai_instructions})`).join('\n')
       : "No hay archivos multimedia disponibles.";

    // 5. LECCIONES APRENDIDAS (Auto-corrección)
    const { data: learnings } = await supabaseClient
       .from('errores_ia')
       .select('correccion_sugerida')
       .eq('estado_correccion', 'VALIDADA')
       .order('applied_at', { ascending: false })
       .limit(10);
    
    const learnedLessons = learnings && learnings.length > 0
       ? learnings.map(l => `🔴 EVITAR ERROR PREVIO: ${l.correccion_sugerida}`).join('\n')
       : "Sin correcciones reportadas aún.";

    // 6. CONSTRUCCIÓN DEL SYSTEM PROMPT MAESTRO
    // Estructurado para que la IA priorice Identidad > Contexto > Respuesta
    const fullSystemPrompt = `
=== 🧠 IDENTIDAD & OBJETIVO (CORE) ===
${prompts['prompt_core']}

=== 📜 PROTOCOLOS DE VENTA ===
${prompts['prompt_behavior']}
${prompts['prompt_objections']}
${prompts['prompt_closing_strategy']}

=== 👤 PERFIL DEL CLIENTE (AUTO-LEARNING) ===
Nombre: ${lead_name || 'No especificado'}
Perfil Detectado: ${leadProfile}
Psicología a aplicar: ${prompts['prompt_psychology']}

=== 🕰️ MEMORIA DE CONVERSACIÓN (HISTORIAL REAL) ===
Analiza esto para no repetir preguntas y mantener el hilo:
${chatHistoryText}

=== 📦 INVENTARIO & MEDIA (SOLO USAR SI APLICA) ===
${mediaContext}

=== 📚 BASE DE CONOCIMIENTO (RAG) ===
${relevant_knowledge || 'Usa tu conocimiento general de ventas.'}

=== 🚫 REGLAS DE ORO & CORRECCIONES ===
${learnedLessons}
${prompts['prompt_relearning'] || ''}
IMPORTANTE: Responde SIEMPRE en TEXTO PLANO. Sé natural.
    `;

    // Retornamos el contexto listo para que Make se lo pase a Gemini/GPT
    return new Response(
      JSON.stringify({
        lead_id: currentLeadId,
        system_prompt: fullSystemPrompt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Brain Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})