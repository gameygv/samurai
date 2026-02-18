import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { ai_json_response, lead_id, kommo_id, is_client_message = false } = await req.json();

    // 1. IDENTIFICAR AL LEAD
    let lead = null;
    if (lead_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
        lead = data;
    } else if (kommo_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommo_id).single();
        lead = data;
    }

    if (!lead) throw new Error("Lead not found.");

    // 2. LIMPIAR EL TEXTO Y EXTRAER METADATOS
    let fullText = typeof ai_json_response === 'string' ? ai_json_response : (ai_json_response?.reply || "");
    let cleanText = fullText;
    let analysisData: any = null;

    const separators = ['---SYSTEM_ANALYSIS---', '[[ANALYSIS:', '---ANALYSIS---'];
    
    for (const sep of separators) {
        if (fullText.includes(sep)) {
            const parts = fullText.split(sep);
            cleanText = parts[0].trim();
            
            try {
                const jsonPart = parts[1].trim();
                const jsonCleaned = jsonPart.replace(/```json/g, '').replace(/```/g, '').replace(/\]\]/g, '').trim();
                if (jsonCleaned.startsWith('{')) {
                    analysisData = JSON.parse(jsonCleaned);
                }
            } catch (e) {
                console.warn("[process-samurai-response] Metadata parse error ignored.");
            }
            break;
        }
    }

    // 3. ACTUALIZAR DASHBOARD (RADAR DE LEADS)
    if (analysisData) {
        const updateData: any = { 
            last_ai_analysis: new Date().toISOString() 
        };

        // Mapeo inteligente de campos detectados por la IA
        if (analysisData.mood) updateData.estado_emocional_actual = analysisData.mood;
        if (analysisData.intent) updateData.buying_intent = analysisData.intent;
        if (analysisData.summary) updateData.summary = analysisData.summary;
        if (analysisData.handoff_required === true) updateData.ai_paused = true;
        
        // ¡NUEVO!: Actualizar Nombre y Ciudad
        if (analysisData.detected_name && (!lead.nombre || lead.nombre.includes('Cliente'))) {
            updateData.nombre = analysisData.detected_name;
        }
        if (analysisData.detected_city) {
            updateData.ciudad = analysisData.detected_city;
        }

        await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
    }

    // 4. GUARDAR EN HISTORIAL
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: is_client_message ? 'CLIENTE' : 'SAMURAI',
        mensaje: cleanText, 
        platform: 'API'
    });

    return new Response(
      JSON.stringify({ 
         success: true, 
         reply: cleanText,
         handoff: analysisData?.handoff_required || false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[process-samurai-response] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})