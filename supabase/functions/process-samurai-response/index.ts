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

    // 1. OBTENER EL TEXTO BRUTO
    let fullText = typeof ai_json_response === 'string' ? ai_json_response : (ai_json_response?.reply || raw_text || "");
    let cleanText = fullText;
    let analysisData: any = null;

    // 2. EL BISTURÍ: CORTAR EL ANÁLISIS DE SISTEMA
    // Buscamos cualquier variante del separador
    const separators = ['---SYSTEM_ANALYSIS---', '[[ANALYSIS:', '---ANALYSIS---'];
    
    for (const sep of separators) {
        if (fullText.includes(sep)) {
            const parts = fullText.split(sep);
            cleanText = parts[0].trim(); // Nos quedamos solo con lo de ARRIBA
            
            // Intentamos extraer el JSON de lo de ABAJO para el Dashboard
            try {
                const jsonPart = parts[1].trim();
                const jsonCleaned = jsonPart.replace(/```json/g, '').replace(/```/g, '').trim();
                // Si el JSON está incompleto o mal formado, no rompemos el proceso
                if (jsonCleaned.startsWith('{')) {
                    analysisData = JSON.parse(jsonCleaned);
                }
            } catch (e) {
                console.warn("[process-samurai-response] Error parsing metadata, but message is clean.");
            }
            break; // Una vez cortado, salimos del bucle
        }
    }

    // 3. ACTUALIZAR DASHBOARD (MEMORIA)
    if (analysisData) {
        const updateData: any = { last_ai_analysis: new Date().toISOString() };
        if (analysisData.mood) updateData.estado_emocional_actual = analysisData.mood;
        if (analysisData.intent) updateData.buying_intent = analysisData.intent;
        if (analysisData.summary) updateData.summary = analysisData.summary;
        if (analysisData.handoff_required === true) updateData.ai_paused = true;

        await supabaseClient.from('leads').update(updateData).eq('id', lead_id);
    }

    // 4. GUARDAR EN HISTORIAL (TEXTO LIMPIO)
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead_id,
        emisor: is_client_message ? 'CLIENTE' : 'SAMURAI',
        mensaje: cleanText, 
        platform: 'API',
        metadata: { analysis: analysisData }
    });

    // 5. RESPUESTA FINAL (ESTO ES LO QUE VA A WHATSAPP)
    return new Response(
      JSON.stringify({ 
         success: true, 
         reply: cleanText, // <--- ESTE ES EL CAMPO QUE DEBES USAR EN MAKE.COM
         handoff: analysisData?.handoff_required || false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})