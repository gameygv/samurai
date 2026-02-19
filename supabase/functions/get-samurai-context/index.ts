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

    const { message, simulate_reply = false } = await req.json();

    if (simulate_reply) {
       // 1. Obtener el Prompt Maestro real que genera el sistema
       const brainResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/get-samurai-brain`, {
          headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }
       });
       const { system_prompt } = await brainResponse.json();

       // 2. Llamar a OpenAI para una simulación real
       const openAiKey = Deno.env.get('OPENAI_API_KEY');
       const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
             model: "gpt-4o-mini",
             messages: [
                { role: "system", content: system_prompt },
                { role: "user", content: message }
             ],
             temperature: 0.3 // Baja temperatura para evitar alucinaciones
          })
       });

       const aiData = await aiResponse.json();
       const reply = aiData.choices?.[0]?.message?.content || "Error en simulación de IA.";

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