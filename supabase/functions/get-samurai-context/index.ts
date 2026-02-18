import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULTS = {
  'prompt_core': `Eres Samurai, un asistente de ventas experto.`,
  'prompt_behavior': `Sé breve y profesional.`,
  'prompt_objections': `Responde dudas con certeza.`,
  'prompt_psychology': `Adapta tu tono al cliente.`,
  'prompt_relearning': `` 
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

    let currentLeadId = lead_id;
    let leadProfile = "Nuevo Prospecto";
    let leadMood = "NEUTRO";
    let buyingIntent = "DESCONOCIDO";
    let leadSummary = "";
    let timeGapHours = 0;

    // 1. IDENTIFICACIÓN Y MEMORIA PROFUNDA
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
          leadSummary = existingLead.summary || "No hay resumen previo.";
          
          if (existingLead.last_message_at) {
             const lastActive = new Date(existingLead.last_message_at).getTime();
             const now = new Date().getTime();
             timeGapHours = (now - lastActive) / (1000 * 60 * 60);
          }

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

    // 3. HISTORIAL DE CHAT
    let chatHistoryText = "Sin historial reciente.";
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

    const timeInstruction = timeGapHours >= 12 
       ? `⚠️ RECONEXIÓN: Han pasado ${Math.round(timeGapHours)} horas desde la última charla. Inicia con un saludo amable y re-conecta con el cliente reconociendo que ha pasado un tiempo.`
       : `CONTINUIDAD: La charla es reciente. No repitas saludos formales si no es necesario.`;

    // 4. ECOSISTEMA DIGITAL (The Elephant Bowl)
    
    // 4.1 Sitios Web (Maestros, Talleres)
    const { data: websites } = await supabaseClient
        .from('knowledge_documents')
        .select('title, external_link, description, content')
        .eq('type', 'WEBSITE');
    
    let websiteContextBlock = "No hay sitios web registrados.";
    if (websites && websites.length > 0) {
        websiteContextBlock = websites.map(w => 
           `🌐 [WEB: ${w.title}]\n` +
           `   URL: ${w.external_link}\n` +
           `   CUÁNDO COMPARTIR (Instrucción): ${w.description}\n` +
           `   DATOS CLAVE DEL SITIO: ${w.content ? w.content.substring(0, 1000) : 'Sin datos extraídos.'}`
        ).join('\n\n');
    }

    // 4.2 Documentos Generales (PDFs)
    const { data: knowledgeDocs } = await supabaseClient
        .from('knowledge_documents')
        .select('title, content, description')
        .neq('type', 'WEBSITE') // Excluimos webs aquí
        .order('created_at', { ascending: false })
        .limit(5);

    let knowledgeContextBlock = "No hay documentos base.";
    if (knowledgeDocs && knowledgeDocs.length > 0) {
        knowledgeContextBlock = knowledgeDocs.map(k => 
            `📘 [DOC: ${k.title}]\nRESUMEN: ${k.description || 'Sin descripción'}\nFRAGMENTO: ${k.content ? k.content.substring(0, 800) : 'Contenido no indexado.'}`
        ).join('\n\n');
    }

    // 4.3 Media Assets (Imágenes)
    const { data: mediaAssets } = await supabaseClient
        .from('media_assets')
        .select('title, url, ai_instructions')
        .not('ai_instructions', 'is', null);

    let mediaContextBlock = "No hay archivos multimedia configurados.";
    if (mediaAssets && mediaAssets.length > 0) {
        mediaContextBlock = mediaAssets.map(m => 
            `🔴 [ARCHIVO: ${m.title}]\n   URL: ${m.url}\n   REGLA DE USO: ${m.ai_instructions}`
        ).join('\n\n');
    }


    const fullSystemPrompt = `
=== 🧠 IDENTIDAD & REGLAS DE MEMORIA ===
${prompts['prompt_core']}
- PROHIBICIÓN: No vuelvas a preguntar datos que ya conoces.
- RECONOCIMIENTO: Si el cliente ya te habló antes, trátalo como conocido.

=== 👤 PERFIL DEL CLIENTE ===
Resumen: ${leadSummary}
Mood: ${leadMood} | Intent: ${buyingIntent}
${timeInstruction}

=== 🌐 ECOSISTEMA DIGITAL (The Elephant Bowl) ===
Estos son los sitios oficiales de Maestros y Talleres. Úsalos como FUENTE PRIMARIA de verdad.
Si el cliente pregunta algo específico de un maestro, consulta los "DATOS CLAVE" aquí abajo.
Si se cumple la instrucción "CUÁNDO COMPARTIR", envía la URL.

${websiteContextBlock}

=== 📚 DOCUMENTACIÓN TÉCNICA (Instrumentos/Políticas) ===
${knowledgeContextBlock}

=== 📸 MEDIA (Catálogos/Imágenes) ===
${mediaContextBlock}

=== 🕰️ HISTORIAL RECIENTE ===
${chatHistoryText}

=== 📜 PROTOCOLOS ===
${prompts['prompt_behavior']}
${prompts['prompt_objections']}
${prompts['prompt_psychology']}

=== ⚡ PROTOCOLO DE SALIDA ===
1. Prioriza la información de los SITIOS WEB para preguntas sobre Talleres y Maestros.
2. Si compartes un link, hazlo de forma natural: "Puedes ver más detalles del Maestro Juan aquí: [URL]".
3. AL FINAL, añade SIEMPRE el bloque de análisis:
[[ANALYSIS: {"mood": "...", "intent": "...", "summary": "ACTUALIZA EL RESUMEN..."}]]
    `;

    return new Response(
      JSON.stringify({
        lead_id: currentLeadId,
        system_prompt: fullSystemPrompt,
        debug: {
            time_gap: timeGapHours,
            has_summary: !!leadSummary,
            profile: { mood: leadMood, intent: buyingIntent },
            website_sources: websites?.length || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Brain Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})