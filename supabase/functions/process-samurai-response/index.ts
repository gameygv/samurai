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

    // 1. PROCESAR RESPUESTA (TEXTO PLANO)
    // Ya no esperamos JSON. Tomamos el raw_text o ai_json_response como string directo.
    let replyText = "";
    let mediaUrlFound = null;

    // Si viene como string JSON, intentamos extraer, si no, usamos el texto directo.
    if (typeof ai_json_response === 'string') {
        // Intentar parsear por si acaso es JSON, pero con fallback a texto
        try {
            const parsed = JSON.parse(ai_json_response);
            replyText = parsed.reply || ai_json_response;
            mediaUrlFound = parsed.media_url || null;
        } catch (e) {
            replyText = ai_json_response;
        }
    } else if (typeof ai_json_response === 'object') {
        replyText = ai_json_response.reply || JSON.stringify(ai_json_response);
        mediaUrlFound = ai_json_response.media_url || null;
    } else {
        replyText = raw_text || "Error: No response text";
    }

    // 2. DETECTAR URL EN TEXTO (Si la IA puso el link en el texto)
    if (!mediaUrlFound) {
       const urlRegex = /(https?:\/\/[^\s]+)/g;
       const urls = replyText.match(urlRegex);
       if (urls && urls.length > 0) {
          // Asumimos que la última URL es la imagen/archivo
          // Opcional: Podríamos verificar extensión de imagen
          mediaUrlFound = urls[urls.length - 1];
       }
    }

    // 3. GUARDAR RESPUESTA TEXTO
    const { error: chatError } = await supabaseClient.from('conversaciones').insert({
        lead_id: lead_id,
        emisor: 'SAMURAI',
        mensaje: replyText,
        platform: 'API',
        metadata: { format: 'text_plain' }
    });

    if (chatError) throw chatError;

    // 4. ACTUALIZAR LEAD TIMESTAMP
    await supabaseClient.from('leads').update({
        last_message_at: new Date().toISOString()
    }).eq('id', lead_id);

    // 5. LOG
    await supabaseClient.from('activity_logs').insert({
        action: 'CHAT',
        resource: 'USERS',
        description: `Respuesta enviada a Lead ${lead_id.substring(0,8)}`,
        status: 'OK'
    });

    // Retornamos todo a Make
    return new Response(
      JSON.stringify({ success: true, reply: replyText, media_url: mediaUrlFound }),
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