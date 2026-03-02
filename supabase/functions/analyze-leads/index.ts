// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { force, lead_id } = await req.json().catch(() => ({}));
    
    // 1. Obtener API Key
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || null;
    const apiKey = getConfig('openai_api_key');

    if (!apiKey) throw new Error("OpenAI API Key no configurada.");

    let query = supabaseClient.from('leads').select('*');
    if (lead_id) {
       query = query.eq('id', lead_id);
    } else {
       query = query.order('last_message_at', { ascending: false }).limit(10);
    }

    const { data: activeLeads } = await query;
    const results = [];

    console.log(`[analyze-leads] Procesando ${activeLeads?.length || 0} leads...`);

    for (const lead of activeLeads || []) {
       try {
         // Obtener últimos 50 mensajes (suficiente contexto)
         const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true }) 
            .limit(50);

         if (!messages || messages.length === 0) {
             results.push({ lead: lead.id, status: 'skipped_no_messages' });
             continue;
         }

         const transcript = messages.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');

         const prompt = `
            ACTÚA COMO UN MOTOR DE EXTRACCIÓN DE DATOS (DATA SCRAPER).
            Tu única misión es leer el historial de chat y rellenar los campos faltantes en el JSON.

            HISTORIAL DEL CHAT:
            ---
            ${transcript}
            ---

            INSTRUCCIONES DE EXTRACCIÓN (PRIORIDAD ALTA):
            1. EMAIL: Busca cualquier string con formato de correo (ej: "usuario@gmail.com"). Si el usuario envía SOLO el correo en un mensaje, tómalo inmediatamente.
            2. CIUDAD: Busca menciones de ubicación (ej: "soy de Hermosillo", "vivo en CDMX").
            3. NOMBRE: Si el usuario se presenta ("Soy Jorge"), extráelo.
            4. INTENCIÓN: 
               - BAJO: Solo saluda.
               - MEDIO: Hace preguntas específicas.
               - ALTO: Pide precio, cuenta bancaria, link de pago o confirma asistencia.

            FORMATO DE RESPUESTA (JSON ÚNICAMENTE):
            {
              "email": "string o null",
              "city": "string o null",
              "full_name": "string o null", 
              "intent": "BAJO" | "MEDIO" | "ALTO",
              "summary": "Resumen técnico de 1 frase",
              "psych_profile": "Perfil en 3 palabras (Ej: Directo, Desconfiado)"
            }
         `;

         const response = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: "gpt-4o", // Usando el modelo más capaz para seguir instrucciones
              messages: [
                { role: "system", content: "Eres una API que solo responde JSON válido. No incluyas markdown ```json." },
                { role: "user", content: prompt }
              ],
              temperature: 0 // Temperatura 0 para máxima precisión determinista
            })
         });

         if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`OpenAI Error: ${errorBody.error.message}`);
         }

         const aiData = await response.json();
         let rawText = aiData.choices[0]?.message?.content;
         
         // Limpieza de JSON por si acaso
         rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
         
         console.log(`[analyze-leads] AI Response for ${lead.id}:`, rawText);

         const analysis = JSON.parse(rawText);

         const updateData: any = {
            last_analyzed_at: new Date().toISOString(),
            summary: analysis.summary,
            buying_intent: analysis.intent,
            perfil_psicologico: analysis.psych_profile
         };

         // Solo sobrescribir si la IA encontró algo válido
         if (analysis.email && analysis.email.includes('@')) updateData.email = analysis.email;
         if (analysis.city) updateData.ciudad = analysis.city;
         
         // Nombre: Lógica conservadora para no borrar nombres reales
         if (analysis.full_name && analysis.full_name.length > 2) {
             const currentName = lead.nombre || '';
             // Si no tiene nombre O tiene nombre genérico, actualizamos
             if (!currentName || currentName.includes('Nuevo') || currentName.includes('Lead') || currentName.length < 3) {
                 updateData.nombre = analysis.full_name;
             }
         }

         const { error: updateError } = await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
         if (updateError) throw updateError;

         results.push({ lead: lead.id, status: 'updated', extracted: analysis });

       } catch (e) { 
           console.error(`Error procesando lead ${lead.id}:`, e);
           results.push({ lead: lead.id, status: 'error', error: e.message });
       }
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})