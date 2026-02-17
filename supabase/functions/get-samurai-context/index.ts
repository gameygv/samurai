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
          
          // Calcular tiempo desde última interacción
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

    // 3. HISTORIAL DE CHAT (MEMORIA RECIENTE)
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

    // Instrucción de saludo si pasó mucho tiempo
    const timeInstruction = timeGapHours >= 12 
       ? `⚠️ RECONEXIÓN: Han pasado ${Math.round(timeGapHours)} horas desde la última charla. Inicia con un saludo amable y re-conecta con el cliente reconociendo que ha pasado un tiempo.`
       : `CONTINUIDAD: La charla es reciente. No repitas saludos formales si no es necesario.`;

    // 4. RAG Y MEDIA (Simplificado para el ejemplo)
    const mediaContext = "Consultar Media Manager para archivos.";
    const learnedLessons = "Consultar Learning Log.";

    // 5. SYSTEM PROMPT MAESTRO (CON MEMORIA REFORZADA)
    const fullSystemPrompt = `
=== 🧠 IDENTIDAD & REGLAS DE MEMORIA ===
${prompts['prompt_core']}
- PROHIBICIÓN: No vuelvas a preguntar datos que ya conoces (Nombre, ciudad, presupuesto, etc).
- RECONOCIMIENTO: Si el cliente ya te habló antes, trátalo como conocido, no como un extraño.

=== 👤 PERFIL DEL CLIENTE (MEMORIA PROFUNDA) ===
Resumen de lo que sabemos: ${leadSummary}
Estado actual: Mood ${leadMood} | Intención ${buyingIntent}
${timeInstruction}

=== 🕰️ HISTORIAL RECIENTE (Últimos 30 mensajes) ===
${chatHistoryText}

=== 📜 PROTOCOLOS & COMPORTAMIENTO ===
${prompts['prompt_behavior']}
${prompts['prompt_objections']}
${prompts['prompt_psychology']}

=== ⚡ PROTOCOLO DE SALIDA ===
1. Responde de forma natural basándote en la MEMORIA arriba descrita.
2. Si el cliente ya dio su nombre, úsalo. Si ya preguntó un precio, no lo des de nuevo a menos que haya cambiado.
3. AL FINAL, añade SIEMPRE el bloque de análisis para seguir aprendiendo:
[[ANALYSIS: {"mood": "...", "intent": "...", "summary": "ACTUALIZA EL RESUMEN AQUÍ..."}]]
    `;

    return new Response(
      JSON.stringify({
        lead_id: currentLeadId,
        system_prompt: fullSystemPrompt,
        debug: {
            time_gap: timeGapHours,
            has_summary: !!leadSummary,
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