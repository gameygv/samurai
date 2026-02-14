import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Usamos Service Role para poder escribir logs y leer todo
    )

    // Obtenemos el body del request desde Make
    const { message, lead_name, lead_id, platform } = await req.json();

    // ------------------------------------------------------------------
    // LÓGICA 1: DETECCIÓN DE APRENDIZAJE (#CORREGIRIA)
    // ------------------------------------------------------------------
    if (message && message.includes('#CORREGIRIA')) {
      console.log(`[Samurai Brain] Detectado comando de corrección: ${message}`);

      // Parseamos el mensaje para extraer feedback
      const feedback = message.replace('#CORREGIRIA', '').trim();

      // Guardamos en la tabla de errores para el Dashboard
      const { error: logError } = await supabaseClient.from('errores_ia').insert({
        mensaje_cliente: "Feedback Humano Directo",
        respuesta_ia: "N/A (Intervención manual)",
        correccion_sugerida: feedback,
        categoria: "ENTRENAMIENTO_DIRECTO",
        estado_correccion: "PENDIENTE",
        severidad: "MEDIA",
        created_by: "MakeAutomation"
      });

      if (logError) throw logError;

      // Devolvemos respuesta especial para que Make no llame a la IA, sino que confirme
      return new Response(
        JSON.stringify({
          action: 'LEARNING_LOGGED',
          reply: `🫡 Entendido. He registrado esta corrección en mi bitácora: "${feedback}". La aplicaré en mi próxima versión.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ------------------------------------------------------------------
    // LÓGICA 2: CONSTRUCCIÓN DEL CONTEXTO (Si es mensaje normal)
    // ------------------------------------------------------------------
    
    // A. Obtener Prompts de Personalidad
    const { data: configData } = await supabaseClient
      .from('app_config')
      .select('key, value')
      .eq('category', 'PROMPT')

    const prompts: Record<string, string> = {}
    configData?.forEach((item: any) => {
      prompts[item.key] = item.value
    })

    // B. Obtener Frases de Geoffrey (Auxiliar)
    const { data: geoffreyData } = await supabaseClient
      .from('frases_geoffrey')
      .select('frase, categoria')
      .eq('active', true)

    // C. Búsqueda simple en Base de Conocimiento (Knowledge Base)
    // Buscamos documentos que coincidan con palabras clave del mensaje
    let knowledgeContext = "";
    if (message) {
      const keywords = message.split(' ').filter((w: string) => w.length > 4); // Palabras de >4 letras
      if (keywords.length > 0) {
        const { data: docs } = await supabaseClient
          .from('knowledge_documents')
          .select('title, content, description')
          .textSearch('title', keywords.join(' | ')) // Búsqueda básica
          .limit(2);
        
        if (docs && docs.length > 0) {
           knowledgeContext = `\nRECURSOS RELEVANTES DE TU BASE DE CONOCIMIENTO:\n${docs.map((d:any) => `- [${d.title}]: ${d.description || d.content}`).join('\n')}\n`;
        }
      }
    }

    // D. Registrar Actividad (Log)
    await supabaseClient.from('activity_logs').insert({
       action: 'CHAT',
       resource: 'BRAIN',
       description: `Generando contexto para: ${lead_name || 'Desconocido'}`,
       status: 'OK'
    });

    // E. Construir el System Prompt Final
    const fullSystemPrompt = `
${prompts['prompt_core'] || ''}

${prompts['prompt_technical'] || ''}

${prompts['prompt_behavior'] || ''}

${prompts['prompt_objections'] || ''}

${knowledgeContext}

GEOFFREY PHRASES (Usa estas frases para dar color a tu respuesta si aplica):
${geoffreyData?.map((g: any) => `- [${g.categoria}] ${g.frase}`).join('\n') || ''}

CONTEXTO ACTUAL:
Estás hablando con: ${lead_name || 'Cliente'}
Plataforma: ${platform || 'WhatsApp'}
    `

    return new Response(
      JSON.stringify({
        action: 'REPLY',
        system_prompt: fullSystemPrompt,
        config: {
            temperature: 0.3,
            model: 'gemini-1.5-pro'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Error en Edge Function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})