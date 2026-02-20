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

  console.log("[analyze-leads] Iniciando análisis periódico de conversaciones...");

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

    // 2. BUSCAR LEADS ACTIVOS (Que han hablado recientemente y no han sido analizados en la última hora)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Como Supabase no soporta OR complejo en JS client facilmente para timestamps nulos, traemos los más recientes y filtramos en código
    const { data: activeLeads } = await supabaseClient
      .from('leads')
      .select('id, nombre, ciudad, last_analyzed_at, last_message_at')
      .order('last_message_at', { ascending: false })
      .limit(20);

    const leadsToAnalyze = activeLeads?.filter(l => {
       // Si no ha sido analizado nunca, o si el último mensaje es más reciente que el último análisis
       if (!l.last_analyzed_at) return true;
       return new Date(l.last_message_at) > new Date(l.last_analyzed_at);
    }).slice(0, 5) || []; // Limitamos a 5 por ejecución para evitar timeouts

    if (leadsToAnalyze.length === 0) {
       return new Response(JSON.stringify({ message: "No hay leads pendientes de análisis." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];

    // 3. ANALIZAR CADA LEAD
    for (const lead of leadsToAnalyze) {
       console.log(`Analizando lead: ${lead.nombre} (${lead.id})`);

       // Obtener chat reciente
       const { data: messages } = await supabaseClient
          .from('conversaciones')
          .select('emisor, mensaje')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: true }) // Orden cronológico
          .limit(30);

       if (!messages || messages.length < 2) continue;

       const transcript = messages.map(m => `${m.emisor}: ${m.mensaje}`).join('\n');

       // LLAMADA A GEMINI
       const prompt = `
          Analiza la siguiente conversación de venta de instrumentos/terapias y extrae JSON.
          
          HISTORIAL:
          ${transcript}

          TU TAREA:
          Devuelve SOLO un objeto JSON con este formato (sin markdown):
          {
            "ciudad": "Ciudad mencionada por el cliente o 'Desconocida'",
            "resumen": "Resumen de 1 frase de la situación actual",
            "intencion": "BAJO, MEDIO o ALTO",
            "estado_animo": "POSITIVO, NEUTRO, NEGATIVO o CONFUSO"
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

             // Actualizar Lead
             const updateData: any = {
                last_analyzed_at: new Date().toISOString(),
                summary: analysis.resumen,
                buying_intent: analysis.intencion,
                estado_emocional_actual: analysis.estado_animo
             };
             
             // Solo actualizamos ciudad si se detectó una nueva y no es "Desconocida"
             if (analysis.ciudad && !analysis.ciudad.toLowerCase().includes('desconocid') && analysis.ciudad !== 'N/A') {
                updateData.ciudad = analysis.ciudad;
             }

             await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
             results.push({ lead: lead.nombre, ...analysis });

          } catch (e) {
             console.error("Error parseando JSON de Gemini:", e);
          }
       }
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