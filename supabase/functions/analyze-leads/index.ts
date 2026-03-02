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
    
    // 1. Configuración
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || null;
    const apiKey = getConfig('openai_api_key');
    const metaPixelId = getConfig('meta_pixel_id');
    const metaToken = getConfig('meta_access_token');

    if (!apiKey) throw new Error("OpenAI API Key no configurada.");

    let query = supabaseClient.from('leads').select('*');
    if (lead_id) query = query.eq('id', lead_id);
    else query = query.order('last_message_at', { ascending: false }).limit(10);

    const { data: activeLeads } = await query;
    const results = [];

    for (const lead of activeLeads || []) {
       try {
         // Análisis solo si no se ha analizado recientemente o si es forzado
         if (!force && lead.last_analyzed_at && new Date() - new Date(lead.last_analyzed_at) < 1000 * 60 * 60) continue;

         const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true }) 
            .limit(100);

         if (!messages || messages.length === 0) continue;

         const transcript = messages.map(m => `${m.emisor}: ${m.mensaje}`).join('\n');

         const prompt = `
            ACTÚA COMO UN MOTOR DE EXTRACCIÓN DE DATOS (DATA SCRAPER).
            
            HISTORIAL:
            ${transcript}

            EXTRAER DATOS EXACTOS:
            1. EMAIL: Busca patrones @ (ej: gmail, outlook).
            2. CIUDAD: Busca menciones geográficas.
            3. INTENCIÓN: BAJO, MEDIO, ALTO.
            4. NOMBRE: Si se presenta.

            JSON:
            {
              "fn": "string|null",
              "email": "string|null",
              "city": "string|null",
              "intent": "BAJO|MEDIO|ALTO",
              "summary": "1 frase resumen",
              "psych": "3 adjetivos"
            }
         `;

         const response = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [{ role: "system", content: "Responde solo JSON válido." }, { role: "user", content: prompt }],
              response_format: { type: "json_object" }
            })
         });

         const aiData = await response.json();
         const analysis = JSON.parse(aiData.choices[0]?.message?.content || '{}');

         const updateData: any = {
            last_analyzed_at: new Date().toISOString(),
            summary: analysis.summary,
            buying_intent: analysis.intent,
            perfil_psicologico: analysis.psych
         };

         let dataDiscovered = false;

         // Actualización de Email (Prioridad Crítica)
         if (analysis.email && (!lead.email || lead.email.length < 5)) {
             updateData.email = analysis.email;
             dataDiscovered = true;
         }
         
         // Actualización de Ciudad
         if (analysis.city && (!lead.ciudad || lead.ciudad.length < 3)) {
             updateData.ciudad = analysis.city;
         }

         // Nombre (Conservador)
         if (analysis.fn && analysis.fn.length > 2) {
             const currentName = lead.nombre || '';
             if (!currentName || currentName.includes('Nuevo') || currentName.includes('Lead')) {
                 updateData.nombre = analysis.fn;
             }
         }

         await supabaseClient.from('leads').update(updateData).eq('id', lead.id);

         // --- AUTO TRIGGER META CAPI ---
         // Si descubrimos un email y tenemos configuración de Meta, disparamos el evento automáticamente
         if (dataDiscovered && metaPixelId && metaToken) {
             console.log(`[analyze-leads] Email descubierto para ${lead.id}. Disparando CAPI...`);
             await supabaseClient.functions.invoke('meta-capi-sender', {
                 body: {
                     eventData: {
                         event_name: 'Lead',
                         lead_id: lead.id,
                         user_data: {
                             em: updateData.email,
                             ph: lead.telefono,
                             fn: updateData.nombre || lead.nombre,
                             ct: updateData.ciudad || lead.ciudad
                         },
                         custom_data: { source: 'auto_analysis', intent: analysis.intent }
                     },
                     config: { pixel_id: metaPixelId, access_token: metaToken }
                 }
             });
             // Marcamos que ya se envió
             await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead.id);
         }

         results.push({ lead: lead.id, status: 'updated', discovered: dataDiscovered });

       } catch (e) { console.error(`Error ${lead.id}:`, e); }
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})