import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // 1. GESTIÓN DEL LEAD (Buscar o Crear)
    let currentLeadId = lead_id;
    let leadProfile = "Nuevo Lead";
    let leadMood = "NEUTRO";

    // Si no viene ID, intentamos buscar por teléfono
    if (!currentLeadId && lead_phone) {
       const { data: existingLead } = await supabaseClient
          .from('leads')
          .select('*')
          .eq('telefono', lead_phone)
          .maybeSingle();
       
       if (existingLead) {
          currentLeadId = existingLead.id;
          leadProfile = `Cliente Recurrente: ${existingLead.nombre} (${existingLead.estado_emocional_actual})`;
          leadMood = existingLead.estado_emocional_actual;
       } else {
          // Crear Lead si no existe
          const { data: newLead } = await supabaseClient
             .from('leads')
             .insert({ nombre: lead_name || 'Desconocido', telefono: lead_phone, origen: platform || 'Desconocido' })
             .select()
             .single();
          if (newLead) currentLeadId = newLead.id;
       }
    }

    // 2. LOGUEAR MENSAJE DEL USUARIO (CRÍTICO: NO PERDER DATOS)
    if (currentLeadId && message) {
       await supabaseClient.from('conversaciones').insert({
          lead_id: currentLeadId,
          emisor: 'CLIENTE',
          mensaje: message,
          platform: platform || 'API'
       });
       
       // Actualizar timestamp del lead
       await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', currentLeadId);
    }

    // 3. RECUPERAR MEMORIA (Historial + Config)
    
    // Prompts
    const { data: configData } = await supabaseClient.from('app_config').select('key, value').eq('category', 'PROMPT');
    const prompts: Record<string, string> = {};
    configData?.forEach((item: any) => { prompts[item.key] = item.value; });

    // Historial Chat (Últimos 15 mensajes para contexto profundo)
    let chatHistoryText = "";
    if (currentLeadId) {
       const { data: history } = await supabaseClient
          .from('conversaciones')
          .select('emisor, mensaje, created_at')
          .eq('lead_id', currentLeadId)
          .order('created_at', { ascending: false })
          .limit(15);
       
       if (history && history.length > 0) {
          chatHistoryText = history.reverse().map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');
       }
    }

    // Lecciones Aprendidas
    const { data: learnings } = await supabaseClient
       .from('errores_ia')
       .select('correccion_sugerida')
       .eq('estado_correccion', 'VALIDADA')
       .order('applied_at', { ascending: false })
       .limit(8);
    const learnedLessons = learnings?.map(l => `IMPORTANTE: ${l.correccion_sugerida}`).join('\n') || "Sin correcciones previas.";

    // 4. CONSTRUIR PROMPT SYSTEM
    const fullSystemPrompt = `
=== IDENTITY & CORE ===
${prompts['prompt_core'] || ''}
${prompts['prompt_technical'] || ''}

=== BEHAVIOR & SALES PROTOCOLS ===
${prompts['prompt_behavior'] || ''}
${prompts['prompt_objections'] || ''}
${prompts['prompt_closing_strategy'] || ''}

=== CUSTOMER PROFILE & CONTEXT ===
${prompts['prompt_psychology'] || ''}
CURRENT LEAD DATA:
- Name: ${lead_name || 'Unknown'}
- Detected Mood: ${leadMood}
- History:
${chatHistoryText}

=== KNOWLEDGE BASE (RAG) ===
${relevant_knowledge || 'No specific knowledge retrieved.'}

=== ⚠️ MANDATORY LEARNINGS (DO NOT REPEAT ERRORS) ===
${learnedLessons}
${prompts['prompt_relearning'] || ''}

---
INSTRUCTION: Reply to the user in the requested JSON format. Analyze their mood and intent based on the history.
    `;

    return new Response(
      JSON.stringify({
        lead_id: currentLeadId, // Devolvemos el ID para que Make lo use en el siguiente paso
        system_prompt: fullSystemPrompt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})