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

    const { ai_json_response, lead_id, raw_text, is_client_message } = await req.json();

    if (!lead_id) throw new Error("Lead ID is required");

    // Obtenemos el texto completo de la IA
    let fullText = typeof ai_json_response === 'string' ? ai_json_response : (ai_json_response?.reply || raw_text || "");
    let cleanText = fullText;
    let analysisData: any = null;

    // 1. LIMPIEZA Y EXTRACCIÓN DEL ANÁLISIS
    // Buscamos el separador ---SYSTEM_ANALYSIS---
    if (fullText.includes('---SYSTEM_ANALYSIS---')) {
        const parts = fullText.split('---SYSTEM_ANALYSIS---');
        cleanText = parts[0].trim(); // El mensaje humano
        
        try {
            // Intentamos parsear el JSON que viene después del separador
            const jsonPart = parts[1].trim();
            // Limpiamos posibles caracteres extraños que la IA pueda añadir (como bloques de código markdown)
            const jsonCleaned = jsonPart.replace(/```json/g, '').replace(/```/g, '').trim();
            analysisData = JSON.parse(jsonCleaned);
        } catch (e) {
            console.error("[process-samurai-response] Error parsing system analysis", e);
        }
    } else {
        // Soporte para el formato antiguo [[ANALYSIS: ...]] por si acaso
        const analysisRegex = /\[\[ANALYSIS:\s*({[\s\S]*?})\s*\]\]/s;
        const match = fullText.match(analysisRegex);
        if (match && match[1]) {
            try {
                analysisData = JSON.parse(match[1]);
                cleanText = fullText.replace(match[0], '').trim();
            } catch (e) {
                console.error("[process-samurai-response] Error parsing legacy analysis", e);
            }
        }
    }

    // 2. ACTUALIZACIÓN DEL PERFIL DEL LEAD (MEMORIA MAESTRA)
    if (analysisData) {
        const updateData: any = {
           last_ai_analysis: new Date().toISOString()
        };
        
        if (analysisData.mood) updateData.estado_emocional_actual = analysisData.mood;
        if (analysisData.intent) updateData.buying_intent = analysisData.intent;
        if (analysisData.summary) updateData.summary = analysisData.summary;
        
        if (analysisData.handoff_required === true) {
            updateData.ai_paused = true;
            updateData.stop_requested_at = new Date().toISOString();
        }

        await supabaseClient.from('leads').update(updateData).eq('id', lead_id);
    }

    // 3. GUARDAR CONVERSACIÓN (GUARDAMOS EL TEXTO LIMPIO)
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead_id,
        emisor: is_client_message ? 'CLIENTE' : 'SAMURAI',
        mensaje: cleanText, 
        platform: 'API',
        metadata: { analysis: analysisData }
    });

    // 4. RESPUESTA AL CLIENTE (DEVOLVEMOS EL TEXTO LIMPIO)
    return new Response(
      JSON.stringify({ 
         success: true, 
         reply: cleanText, // ESTO es lo que Make.com o tu sistema de WhatsApp debe usar
         handoff: analysisData?.handoff_required || false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})