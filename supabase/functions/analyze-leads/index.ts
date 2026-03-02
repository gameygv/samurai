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

    const { force } = await req.json().catch(() => ({}));
    
    console.log(`[analyze-leads] Motor Forense Samurai v2.0 Iniciado. Force: ${force ? 'ON' : 'OFF'}`);

    // Configuración
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || null;
    const apiKey = getConfig('gemini_api_key');
    const capiConfig = {
      pixel_id: getConfig('meta_pixel_id'),
      access_token: getConfig('meta_access_token'),
      test_mode: getConfig('meta_test_mode') === 'true',
      test_event_code: getConfig('meta_test_event_code'),
    };

    if (!apiKey) throw new Error("Gemini API Key no configurada.");

    // Selección de Leads (Prioridad a los que tienen actividad reciente y datos faltantes)
    const { data: activeLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(force ? 25 : 50); // Lote más grande si es forzado

    const leadsToAnalyze = activeLeads?.filter(l => {
       if (!l.last_message_at) return false;
       if (force) return true;
       // Si falta email o nombre y hay mensajes recientes, re-analizar
       if ((!l.email || l.nombre.includes('Nuevo Lead')) && new Date(l.last_message_at) > new Date(Date.now() - 86400000)) return true;
       // Si nunca se analizó
       if (!l.last_analyzed_at) return true;
       return new Date(l.last_message_at) > new Date(l.last_analyzed_at);
    }).slice(0, 10) || [];

    const results = [];
    const logsToInsert = [];

    for (const lead of leadsToAnalyze) {
       try {
         // Obtener contexto completo
         const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true }) 
            .limit(100); // Más contexto para mejor detección

         if (!messages || messages.length === 0) continue;

         const transcript = messages.map(m => `${m.emisor}: ${m.mensaje}`).join('\n');

         // PROMPT DE INGENIERÍA DE DATOS (META CAPI SPECIALIST)
         const prompt = `
            Eres el Analista de Datos Senior de Samurai AI. Tu misión es extraer datos estructurados para Meta Conversions API (CAPI).
            
            HISTORIAL DEL CHAT:
            ${transcript}

            INSTRUCCIONES DE EXTRACCIÓN FORENSE:
            1. EMAIL (em): Busca cualquier patrón de correo (ej: @gmail, @hotmail). Prioridad Máxima.
            2. NOMBRE (fn, ln): Deduce el nombre real por el contexto (ej: "Soy Laura", "Me llamo Carlos"). Si es compuesto, sepáralo.
            3. UBICACIÓN (ct, st): Busca ciudades, estados o referencias geográficas (ej: "Soy de GDL", "Vivo en Roma Norte").
            4. SCORE DE INTENCIÓN (0-100): 
               - 0-30: Curiosidad general.
               - 31-70: Pregunta precios, fechas, detalles.
               - 71-100: Pide datos bancarios, link de pago, pregunta "¿todavía hay lugar?".
            5. ARQUETIPO (Persona): Clasifica en [IMPULSIVO, ANALÍTICO, ESCÉPTICO, FAN, PRECIO_SENSIBLE].
            
            Formato JSON ESTRICTO (usa null si no encuentras el dato):
            {
              "fn": "string | null",
              "ln": "string | null",
              "email": "string | null",
              "city": "string | null",
              "state": "string | null",
              "intent_score": number,
              "intent_label": "BAJO" | "MEDIO" | "ALTO",
              "archetype": "string",
              "summary": "Resumen ejecutivo de 15 palabras."
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

         // Lógica de Actualización (Solo mejorar datos, no borrar)
         const updateData: any = {
            last_analyzed_at: new Date().toISOString(),
            summary: analysis.summary,
            buying_intent: analysis.intent_label,
            confidence_score: analysis.intent_score, // Usamos la columna existente confidence_score para el score numérico
            perfil_psicologico: `Arquetipo: ${analysis.archetype}. Estado: ${analysis.intent_score}/100`,
            // Guardamos metadatos estructurados para uso futuro
            metadata: { 
               ...lead.metadata, 
               capi_data: { 
                  fn: analysis.fn, 
                  ln: analysis.ln, 
                  ct: analysis.city, 
                  st: analysis.state, 
                  zp: analysis.zip 
               } 
            }
         };

         // Actualizar campos clave solo si la IA encontró algo mejor
         if (analysis.email && (!lead.email || lead.email.length < 5)) updateData.email = analysis.email.toLowerCase().trim();
         if (analysis.city) updateData.ciudad = analysis.city;
         
         // Nombre inteligente
         const detectedName = [analysis.fn, analysis.ln].filter(Boolean).join(' ');
         if (detectedName.length > 2 && (lead.nombre.includes('Nuevo Lead') || lead.nombre.length < 3)) {
            updateData.nombre = detectedName;
         }

         await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
         results.push({ lead: detectedName || lead.nombre, score: analysis.intent_score, email: analysis.email });

         // --- DISPARO DE META CAPI (Solo si score > 70 y no enviado) ---
         if (analysis.intent_score >= 70 && !lead.capi_lead_event_sent_at && capiConfig.pixel_id) {
            
            // Construir payload robusto para Meta
            const userData = {
               ph: lead.telefono, // Ya lo tenemos
               em: updateData.email || lead.email, // Prioridad al nuevo
               ct: analysis.city,
               st: analysis.state,
               fn: analysis.fn,
               ln: analysis.ln
            };

            // Limpiar valores nulos antes de enviar
            Object.keys(userData).forEach(k => !userData[k] && delete userData[k]);

            const capiPayload = {
              eventData: {
                event_name: 'Lead', // Evento estándar
                event_id: `${lead.id}_lead_${Date.now()}`,
                user_data: userData,
                custom_data: {
                  intention_score: analysis.intent_score,
                  customer_persona: analysis.archetype,
                  lead_source: 'whatsapp_ai_chat'
                },
              },
              config: capiConfig,
            };

            // Invocación asíncrona para no bloquear
            supabaseClient.functions.invoke('meta-capi-sender', { body: capiPayload });
            
            // Marcar como enviado
            await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead.id);
            
            logsToInsert.push({
               action: 'CREATE',
               resource: 'META_CAPI',
               description: `Evento LEAD enviado (Score: ${analysis.intent_score}). Email: ${userData.em ? 'Sí' : 'No'}`,
               status: 'OK',
               metadata: { capi_payload_preview: userData }
            });
         }

       } catch (e) {
          console.error(`Error lead ${lead.id}:`, e);
          results.push({ lead: lead.id, error: e.message });
       }
    }

    if (logsToInsert.length > 0) {
       await supabaseClient.from('activity_logs').insert(logsToInsert);
    }

    return new Response(
      JSON.stringify({ success: true, analyzed: results.length, details: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})