// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Obtener parámetros (Soporte para forzar análisis)
    const { force } = await req.json().catch(() => ({}));
    
    console.log(`[analyze-leads] Iniciando... Force Mode: ${force ? 'ON' : 'OFF'}`);

    // 2. Obtener API Keys
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
      throw new Error("Gemini API Key no configurada.");
    }

    // 3. Buscar leads (Priorizar los que tienen mensajes recientes)
    const { data: activeLeads } = await supabaseClient
      .from('leads')
      .select('id, nombre, ciudad, email, telefono, perfil_psicologico, last_analyzed_at, last_message_at, capi_lead_event_sent_at')
      .order('last_message_at', { ascending: false })
      .limit(force ? 20 : 50);

    // Filtro: Si es forzado, analiza todo lo que tenga mensajes. Si no, solo lo nuevo.
    const leadsToAnalyze = activeLeads?.filter(l => {
       if (!l.last_message_at) return false; // Sin mensajes no hay nada que analizar
       if (force) return true; // Si forzamos, analizamos todo
       if (!l.last_analyzed_at) return true; // Nunca analizado
       return new Date(l.last_message_at) > new Date(l.last_analyzed_at); // Nuevos mensajes
    }).slice(0, 10) || []; // Lote de 10 para no saturar

    if (leadsToAnalyze.length === 0) {
       return new Response(JSON.stringify({ message: "Todo al día. No se requiere análisis nuevo.", analyzed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];
    const logsToInsert = [];

    // 4. Procesar cada lead
    for (const lead of leadsToAnalyze) {
       try {
         const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true }) 
            .limit(60);

         // Analizamos incluso con 1 mensaje si es forzado, para capturar datos iniciales
         if (!messages || messages.length === 0) continue;

         const transcript = messages.map(m => `${m.emisor}: ${m.mensaje}`).join('\n');

         const prompt = `
            Actúa como un Data Scientist experto en extracción de datos para CRM.
            Analiza esta conversación de WhatsApp y extrae la información del cliente.
            
            HISTORIAL:
            ${transcript}

            OBJETIVO: Rellenar la ficha del cliente para Meta CAPI.
            
            INSTRUCCIONES DE EXTRACCIÓN:
            1. NOMBRE REAL: Si el cliente dice su nombre (ej: "Soy Juan"), úsalo. Si no, intenta inferirlo. Si no hay nada, usa "null".
            2. EMAIL: Busca patrones de correo electrónico. Si encuentras uno, extráelo. Si no, "null".
            3. CIUDAD: Busca menciones de ubicación. Si no, "null".
            4. INTENCIÓN: (BAJO, MEDIO, ALTO). ALTO si pregunta precios, fechas, cuentas o pide link.
            5. ÁNIMO: (POSITIVO, NEUTRO, NEGATIVO).
            6. RESUMEN: Resumen ejecutivo de 10 palabras sobre la situación actual.
            7. PERFIL: 3 adjetivos sobre su personalidad.

            Formato JSON estricto (devuelve null si no encuentras el dato específico, no uses "N/A"):
            {
              "nombre_detectado": "string | null",
              "email_detectado": "string | null",
              "ciudad": "string | null",
              "resumen": "string",
              "intencion": "string",
              "estado_animo": "string",
              "perfil_psicologico": "string"
            }
         `;

         const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
         });

         const aiData = await response.json();
         const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
         if (!rawText) continue;
         
         const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
         const analysis = JSON.parse(cleanJson);

         // Preparar actualización inteligente (solo sobrescribir si hay dato nuevo)
         const updateData: any = {
            last_analyzed_at: new Date().toISOString(),
            summary: analysis.resumen,
            buying_intent: analysis.intencion,
            estado_emocional_actual: analysis.estado_animo,
            perfil_psicologico: analysis.perfil_psicologico
         };
         
         if (analysis.ciudad && analysis.ciudad !== 'null') updateData.ciudad = analysis.ciudad;
         if (analysis.email_detectado && analysis.email_detectado !== 'null') updateData.email = analysis.email_detectado;
         
         // Solo actualizamos nombre si no tenemos uno bueno (ej: si se llamaba "Nuevo Lead...")
         const currentName = lead.nombre || '';
         if (analysis.nombre_detectado && analysis.nombre_detectado !== 'null') {
             if (currentName.includes('Nuevo Lead') || currentName.length < 3) {
                 updateData.nombre = analysis.nombre_detectado;
             }
         }

         await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
         results.push({ lead: lead.nombre, ...updateData });

         // --- EVENTO CAPI (Solo si intención ALTA y no enviado previamente) ---
         if (analysis.intencion === 'ALTO' && !lead.capi_lead_event_sent_at && capiConfig.pixel_id) {
            const userData = {
               ph: lead.telefono,
               em: updateData.email || lead.email,
               ct: updateData.ciudad || lead.ciudad
            };

            const capiPayload = {
              eventData: {
                event_name: 'Lead',
                event_id: `${lead.id}_lead_${Date.now()}`,
                user_data: userData,
                custom_data: {
                  intention: 'ALTO',
                  psych_profile: analysis.perfil_psicologico,
                  source: 'Samurai Auto-Analysis'
                },
              },
              config: capiConfig,
            };

            // Invocamos CAPI de forma asíncrona (no bloqueante)
            supabaseClient.functions.invoke('meta-capi-sender', { body: capiPayload });
            
            await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead.id);
            logsToInsert.push({
               action: 'CREATE',
               resource: 'META_CAPI',
               username: 'AI Analyst',
               description: `Lead Calificado enviado a Meta: ${updateData.nombre || lead.nombre}`,
               status: 'OK'
            });
         }

       } catch (e) {
          console.error(`Error lead ${lead.id}:`, e);
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
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})