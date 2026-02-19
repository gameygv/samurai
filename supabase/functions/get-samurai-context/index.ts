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
    const { message, simulate_reply = false, custom_adn } = await req.json();
    
    // Si es simulación, tratamos de emular el comportamiento según el ADN recibido
    if (simulate_reply && custom_adn) {
       let name = "Samurai";
       if (custom_adn.toLowerCase().includes('presentate como "sam"') || custom_adn.toLowerCase().includes('eres sam')) {
          name = "Sam";
       }

       const reply = `¡Hola! Soy ${name} de The Elephant Bowl. He procesado tu mensaje: "${message}". Mi cerebro está aplicando ahora mismo las reglas de ADN que configuraste. ¿En qué más puedo ayudarte con la cuencoterapia?`;
       
       return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ status: "ok" }), { headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})