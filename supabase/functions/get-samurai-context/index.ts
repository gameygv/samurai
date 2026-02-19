import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, simulate_reply = false, custom_adn, context } = await req.json();
    
    if (simulate_reply) {
       // Simulamos la respuesta usando el ADN y el CONTEXTO recuperado
       const name = custom_adn?.includes('eres Sam') ? "Sam" : "Samurai";
       
       let reply = `[SIMULACIÓN ACTIVADA]\n\nHola, soy ${name}. `;
       
       if (context && context.length > 0) {
          reply += `He consultado nuestra Verdad Maestra y encontré información sobre: "${context}". `;
          reply += `Basado en esto, te confirmo que ${message.toLowerCase().includes('taller') ? 'tenemos vacantes disponibles para los próximos eventos mencionados en la web' : 'puedo ayudarte con esa consulta técnica sobre sonoterapia'}.`;
       } else {
          reply += `He buscado en mi memoria pero no encuentro datos específicos sobre esa consulta en la web indexada. ¿Podrías ser más específico o quieres que consulte el manual?`;
       }

       return new Response(JSON.stringify({ reply }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    return new Response(JSON.stringify({ status: "ok" }), { headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})