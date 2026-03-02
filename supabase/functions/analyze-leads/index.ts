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
    
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || null;
    const apiKey = getConfig('openai_api_key');

    if (!apiKey) throw new Error("OpenAI API Key no configurada en Ajustes.");

    let query = supabaseClient.from('leads').select('*');
    
    if (lead_id) {
       query = query.eq('id', lead_id);
    } else {
       query = query.order('last_message_at', { ascending: false }).limit(10);
    }

    const { data: activeLeads } = await query;
    const results = [];

    for (const lead of activeLeads || []) {
       try {
         const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true }) 
            .limit(100);

         if (!messages || messages.length === 0) continue;

         const transcript = messages.map(m => `${m.emisor}: ${m.mensaje}`).join('\n');

         const prompt = `
            Analiza la siguiente transcripción de chat y extrae los datos solicitados en formato JSON.
            
            HISTORIAL:
            ${transcript}

            EXTRAER:
            1. EMAIL: Patrón de correo (ej: @gmail, @hotmail). Si no hay, devuelve null.
            2. CIUDAD: Infiere la ciudad por contexto (ej: "soy de GDL", "CDMX", "vivo en Monterrey"). Si es ambigua, null.
            3. INTENCIÓN: Basado en el último mensaje del cliente, clasifica como BAJO, MEDIO o ALTO.
            4. NOMBRE: Si el usuario dice "Soy Juan", extráelo.
            
            Responde únicamente con el siguiente objeto JSON:
            {
              "fn": "Nombre o null",
              "ln": "Apellido o null",
              "email": "email@dominio.com o null",
              "city": "Ciudad o null",
              "intent_label": "BAJO" | "MEDIO" | "ALTO",
              "summary": "Resumen ejecutivo de 1 linea sobre la necesidad del cliente",
              "psych_profile": "Perfil psicográfico breve (Ej: Analítico, Impulsivo, Amable, Decidido)"
            }
         `;

         const response = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                { role: "system", content: "Eres una herramienta de extracción de datos que solo responde con JSON." },
                { role: "user", content: prompt }
              ],
              response_format: { type: "json_object" }
            })
         });

         if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`OpenAI Error: ${errorBody.error.message}`);
         }

         const aiData = await response.json();
         const rawText = aiData.choices[0]?.message?.content;
         if (!rawText) continue;
         
         const analysis = JSON.parse(rawText);

         const updateData: any = {
            last_analyzed_at: new Date().toISOString(),
            summary: analysis.summary,
            buying_intent: analysis.intent_label,
            perfil_psicologico: analysis.psych_profile
         };

         if (analysis.email) updateData.email = analysis.email;
         if (analysis.city) updateData.ciudad = analysis.city;

         const detectedName = `${analysis.fn || ''} ${analysis.ln || ''}`.trim();
         if (detectedName && detectedName.length > 2) {
             if (!lead.nombre || lead.nombre.includes('Nuevo') || lead.nombre.includes('Lead')) {
                 updateData.nombre = detectedName;
             }
         }

         await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
         results.push({ lead: lead.id, status: 'updated', data: updateData });

       } catch (e) { console.error(`Error procesando lead ${lead.id}:`, e); }
    }

    return new Response(JSON.stringify({ success: true, analyzed: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})