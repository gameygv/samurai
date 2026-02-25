import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[analyze-leads] Iniciando análisis profundo de conversaciones...");
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // 1. OBTENER CONFIGURACIONES (Gemini y Meta CAPI)
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || null;

    const apiKey = getConfig('gemini_api_key');
    const capiConfig = {
      pixel_id: getConfig('meta_pixel_id'),
      access_token: getConfig('meta_access_token'),
      test_mode: getConfig('meta_test_mode') === 'true',
      test_event_code: getConfig('meta_test_event_code'),
    };

    if (!apiKey) {
      throw new Error("Gemini API Key no configurada. Por favor, añádela en Ajustes > API Keys.");
    }

    // 2. BUSCAR LEADS ACTIVOS
    const { data: activeLeads } = await supabaseClient
      .from('leads')
      .select('id, nombre, ciudad, telefono, perfil_psicologico, last_analyzed_at, last_message_at, capi_lead_event_sent_at')
      .order('last_message_at', { ascending: false })
      .limit(50);

    const leadsToAnalyze = activeLeads?.filter(l => {
       if (!l.last_message_at) return false;
       if (!l.last_analyzed_at) return true;
       return new Date(l.last_message_at) > new Date(l.last_analyzed_at);
    }).slice(0, 5) || []; 

    if (leadsToAnalyze.length === 0) {
       return new Response(JSON.stringify({ message: "No hay leads con actividad nueva pendiente de análisis." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];
    let logsToInsert = [];

    // 3. ANALIZAR CADA LEAD
    for (const lead of leadsToAnalyze) {
       try {
         console.log(`[analyze-leads] Analizando lead: ${lead.nombre} (${lead.id})`);

         const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true }) 
            .limit(50);

         if (!messages || messages.length < 2) continue;

         const transcript = messages.map(m => `${m.emisor}: ${m.mensaje}`).join('\n');

         const prompt = `
            Actúa como un analista de CRM experto. Tu trabajo es extraer datos de perfil de esta conversación.
            
            HISTORIAL:
            ${transcript}

            INSTRUCCIONES DE EXTRACCIÓN:
            1. CIUDAD: Busca cualquier mención de ubicación, ciudad o país del cliente. Sé agresivo buscando esto. Si no hay NINGUNA pista, usa "N/A".
            2. INTENCIÓN: (BAJO, MEDIO, ALTO). ALTO si pregunta precios, fechas o métodos de pago.
            3. ÁNIMO: (POSITIVO, NEUTRO, NEGATIVO).
            4. RESUMEN: Una frase corta (max 10 palabras) del estado actual.
            5. PERFIL_PSICOLOGICO: Describe brevemente la personalidad del cliente en 3-5 palabras (ej: "Directo y decidido", "Curioso pero escéptico", "Amable y hablador"). Si no hay suficiente información, usa "N/A".

            Formato JSON estricto:
            {
              "ciudad": "string",
              "resumen": "string",
              "intencion": "string",
              "estado_animo": "string",
              "perfil_psicologico": "string"
            }
         `;

         const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               contents: [{ parts: [{ text: prompt }] }]
            })
         });

         if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Gemini API Error: ${errorBody.error.message}`);
         }

         const aiData = await response.json();
         const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
         
         if (!rawText) {
            throw new Error("La respuesta de Gemini estaba vacía.");
         }
         
         const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
         const analysis = JSON.parse(cleanJson);

         const updateData: any = {
            last_analyzed_at: new Date().toISOString(),
            summary: analysis.resumen,
            buying_intent: analysis.intencion,
            estado_emocional_actual: analysis.estado_animo,
            perfil_psicologico: analysis.perfil_psicologico
         };
         
         if (analysis.ciudad && analysis.ciudad.length > 2 && !analysis.ciudad.toLowerCase().includes('n/a')) {
            updateData.ciudad = analysis.ciudad;
         }

         await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
         results.push({ lead: lead.nombre, ...analysis });

         // --- DISPARADOR DE EVENTO CAPI ---
         if (analysis.intencion === 'ALTO' && !lead.capi_lead_event_sent_at && capiConfig.pixel_id) {
            console.log(`[analyze-leads] Intención ALTA detectada para ${lead.nombre}. Enviando evento 'Lead' a Meta CAPI.`);
            
            const capiPayload = {
              eventData: {
                event_name: 'Lead',
                event_id: `${lead.id}_lead`,
                user_data: { ph: lead.telefono },
                custom_data: {
                  intention: 'ALTO',
                  psych_profile: analysis.perfil_psicologico,
                  source: 'Samurai AI Analysis'
                },
              },
              config: capiConfig,
            };

            await supabaseClient.functions.invoke('meta-capi-sender', { body: capiPayload });
            await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead.id);
            
            logsToInsert.push({
               action: 'CREATE',
               resource: 'META_CAPI',
               username: 'AI Analyst',
               description: `Evento 'Lead' enviado para ${lead.nombre}`,
               status: 'OK'
            });
         }
       } catch (e) {
          console.error(`[analyze-leads] Error procesando lead ${lead.id}:`, e);
          logsToInsert.push({
              action: 'ERROR',
              resource: 'BRAIN',
              username: 'AI Analyst',
              description: `Fallo al analizar lead: ${lead.nombre}`,
              status: 'ERROR',
              metadata: { lead_id: lead.id, error: e.message }
          });
       }
    }

    if (logsToInsert.length > 0) {
       await supabaseClient.from('activity_logs').insert(logsToInsert);
    }

    return new Response(
      JSON.stringify({ success: true, analyzed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[analyze-leads] Error crítico:", error.message);
    await supabaseClient.from('activity_logs').insert({
        action: 'ERROR',
        resource: 'SYSTEM',
        username: 'AI Analyst',
        description: `Error crítico en la función analyze-leads`,
        status: 'ERROR',
        metadata: { error: error.message }
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})