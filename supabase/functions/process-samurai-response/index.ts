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

    const { ai_json_response, lead_id, raw_text } = await req.json();

    if (!lead_id) throw new Error("Lead ID is required");

    // 1. NORMALIZACIÓN DE ENTRADA
    let fullText = "";
    
    if (typeof ai_json_response === 'string') {
        try {
            const parsed = JSON.parse(ai_json_response);
            fullText = parsed.reply || ai_json_response;
        } catch (e) {
            fullText = ai_json_response;
        }
    } else if (typeof ai_json_response === 'object') {
        fullText = ai_json_response.reply || JSON.stringify(ai_json_response);
    } else {
        fullText = raw_text || "Error: No response text";
    }

    // 2. EXTRACCIÓN DE INTELIGENCIA (AUTOAPRENDIZAJE)
    let cleanText = fullText;
    let analysisData: any = null;
    let mediaUrlFound = null;

    // Regex para capturar el bloque JSON de análisis [[ANALYSIS: {...}]]
    const analysisRegex = /\[\[ANALYSIS:\s*({[\s\S]*?})\s*\]\]/s;
    const match = fullText.match(analysisRegex);

    if (match && match[1]) {
        try {
            analysisData = JSON.parse(match[1]);
            // Eliminamos el bloque del mensaje para que no lo vea el cliente
            cleanText = fullText.replace(match[0], '').trim();
        } catch (e) {
            console.error("[process-samurai-response] Error parsing analysis JSON", e);
        }
    }

    // 3. ACTUALIZACIÓN DEL PERFIL DEL LEAD (MEMORIA ACTIVA)
    if (analysisData) {
        const updateData: any = {
           last_ai_analysis: new Date().toISOString()
        };
        
        if (analysisData.mood) updateData.estado_emocional_actual = analysisData.mood;
        if (analysisData.intent) updateData.buying_intent = analysisData.intent;
        if (analysisData.summary) updateData.summary = analysisData.summary;

        // Actualizamos para que el Dashboard y el ChatViewer reflejen la nueva psicología
        await supabaseClient.from('leads').update(updateData).eq('id', lead_id);
    }

    // 4. DETECTAR MEDIA URLS (Soporte para envíos automáticos de imágenes)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = cleanText.match(urlRegex);
    if (urls && urls.length > 0) {
       mediaUrlFound = urls[urls.length - 1]; // Tomamos la última URL como posible adjunto
    }

    // 5. GUARDAR CONVERSACIÓN EN HISTORIAL
    const { error: chatError } = await supabaseClient.from('conversaciones').insert({
        lead_id: lead_id,
        emisor: 'SAMURAI',
        mensaje: cleanText, 
        platform: 'API',
        metadata: { 
           format: 'text_processed',
           analysis: analysisData,
           has_media: !!mediaUrlFound
        }
    });

    if (chatError) throw chatError;

    // 6. ACTUALIZAR TIMESTAMP DEL LEAD
    await supabaseClient.from('leads').update({
        last_message_at: new Date().toISOString()
    }).eq('id', lead_id);

    // Retornamos la respuesta LIMPIA a Make
    return new Response(
      JSON.stringify({ 
         success: true, 
         reply: cleanText, 
         media_url: mediaUrlFound,
         analysis_captured: !!analysisData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("[process-samurai-response] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})