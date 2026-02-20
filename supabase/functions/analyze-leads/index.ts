import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[analyze-leads] Iniciando análisis profundo de conversaciones...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. OBTENER API KEY
    const { data: config } = await supabaseClient
      .from('app_config')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    const apiKey = config?.value;
    if (!apiKey) {
      return new Response(JSON.stringify({ message: "Gemini API Key no configurada." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. BUSCAR LEADS ACTIVOS
    // Priorizamos leads que han hablado recientemente pero no han sido analizados en la última hora
    const { data: activeLeads } = await supabaseClient
      .from('leads')
      .select('id, nombre, ciudad, last_analyzed_at, last_message_at')
      .order('last_message_at', { ascending: false })
      .limit(50); // Traemos más para filtrar en memoria

    const leadsToAnalyze = activeLeads?.filter(l => {
       if (!l.last_message_at) return false; // Si nunca ha hablado, no hay nada que analizar
       if (!l.last_analyzed_at) return true; // Nunca analizado
       return new Date(l.last_message_at) > new Date(l.last_analyzed_at); // Nuevo mensaje desde último análisis
    }).slice(0, 5) || []; 

    if (leadsToAnalyze.length === 0) {
       return new Response(JSON.stringify({ message: "No hay leads con actividad nueva pendiente de análisis." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];
    let logsToInsert = [];

    // 3. ANALIZAR CADA LEAD
    for (const lead of leadsToAnalyze) {
       console.log(`Analizando lead: ${lead.nombre} (${lead.id})`);

       // Obtener chat completo (hasta 50 mensajes para tener contexto de ubicación antigua)
       const { data: messages } = await supabaseClient
          .from('conversaciones')
          .select('emisor, mensaje')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: true }) 
          .limit(50);

       if (!messages || messages.length < 2) continue;

       const transcript = messages.map(m => `${m.emisor}: ${m.mensaje}`).join('\n');

       // LLAMADA A GEMINI MEJORADA
       const prompt = `
          Actúa como un analista de CRM experto. Tu trabajo es extraer datos de perfil de esta conversación.
          
          HISTORIAL:
          ${transcript}

          INSTRUCCIONES DE EXTRACCIÓN:
          1. CIUDAD: Busca cualquier mención de ubicación, ciudad o país del cliente. Si dice "soy de X", "vivo en Y", "el evento en Z". Sé agresivo buscando esto. Si no hay NINGUNA pista, usa "N/A".
          2. INTENCIÓN: (BAJO, MEDIO, ALTO). ALTO si pregunta precios, fechas o métodos de pago.
          3. ÁNIMO: (POSITIVO, NEUTRO, NEGATIVO).
          4. RESUMEN: Una frase corta (max 10 palabras) del estado actual.

          Formato JSON estricto:
          {
            "ciudad": "string",
            "resumen": "string",
            "intencion": "string",
            "estado_animo": "string"
          }
       `;

       const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             contents: [{ parts: [{ text: prompt }] }]
          })
       });

       const aiData = await response.json();
       const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
       
       if (rawText) {
          try {
             const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
             const analysis = JSON.parse(cleanJson);

             // Preparar actualización
             const updateData: any = {
                last_analyzed_at: new Date().toISOString(),
                summary: analysis.resumen,
                buying_intent: analysis.intencion,
                estado_emocional_actual: analysis.estado_animo
             };
             
             let locationFound = false;
             // Lógica mejorada para Ciudad
             if (analysis.ciudad && analysis.ciudad.length > 2 && !analysis.ciudad.toLowerCase().includes('n/a') && !analysis.ciudad.toLowerCase().includes('desconocid')) {
                updateData.ciudad = analysis.ciudad;
                locationFound = true;
             }

             await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
             
             results.push({ lead: lead.nombre, ...analysis });
             
             // Preparar Log si hubo cambios importantes
             if (locationFound && lead.ciudad !== analysis.ciudad) {
                logsToInsert.push({
                   action: 'UPDATE',
                   resource: 'LEADS',
                   username: 'AI Analyst',
                   description: `Ubicación detectada para ${lead.nombre}: ${analysis.ciudad}`,
                   status: 'OK'
                });
             }

          } catch (e) {
             console.error("Error parseando JSON de Gemini:", e);
          }
       }
    }

    // Insertar logs de actividad
    if (logsToInsert.length > 0) {
       await supabaseClient.from('activity_logs').insert(logsToInsert);
    }

    return new Response(
      JSON.stringify({ success: true, analyzed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[analyze-leads] Error crítico:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})