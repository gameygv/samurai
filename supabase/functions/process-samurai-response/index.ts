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

    let parsedResponse;
    try {
        parsedResponse = typeof ai_json_response === 'string' ? JSON.parse(ai_json_response) : ai_json_response;
    } catch (e) {
        parsedResponse = { 
            reply: raw_text || ai_json_response || "Error de formato IA",
            lead_analysis: { mood: "NEUTRO", summary: "Error parsing AI response" }
        };
    }

    const { reply, media_url, lead_analysis } = parsedResponse;

    // 1. GUARDAR RESPUESTA TEXTO
    const { error: chatError } = await supabaseClient.from('conversaciones').insert({
        lead_id: lead_id,
        emisor: 'SAMURAI',
        mensaje: reply,
        platform: 'API',
        metadata: { analysis: lead_analysis }
    });

    if (chatError) throw chatError;

    // 1.5 GUARDAR MEDIA SI EXISTE (Como un segundo mensaje)
    if (media_url && media_url.length > 5) {
       await supabaseClient.from('conversaciones').insert({
          lead_id: lead_id,
          emisor: 'SAMURAI',
          mensaje: media_url,
          platform: 'API',
          metadata: { type: 'image', auto_sent: true }
       });
    }

    // 2. ACTUALIZAR PERFIL LEAD
    if (lead_analysis) {
        const updates: any = {
            last_message_at: new Date().toISOString()
        };

        if (lead_analysis.mood) updates.estado_emocional_actual = lead_analysis.mood;
        if (lead_analysis.buying_intent) updates.buying_intent = lead_analysis.buying_intent;
        if (lead_analysis.summary) updates.summary = lead_analysis.summary;
        
        if (lead_analysis.buying_intent === 'ALTO') updates.confidence_score = 90;
        else if (lead_analysis.buying_intent === 'MEDIO') updates.confidence_score = 50;
        else if (lead_analysis.buying_intent === 'BAJO') updates.confidence_score = 20;

        await supabaseClient.from('leads').update(updates).eq('id', lead_id);
    }

    // 3. LOG
    await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'USERS',
        description: `Perfil actualizado Lead ${lead_id.substring(0,8)} ${media_url ? '+ IMAGEN ENVIADA' : ''}`,
        status: 'OK'
    });

    // Retornamos todo a Make para que pueda enviarlo por WhatsApp
    return new Response(
      JSON.stringify({ success: true, reply: reply, media_url: media_url || null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Error processing response:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})