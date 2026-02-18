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

    const { message, lead_id, kommo_id } = await req.json();

    // 1. BUSCAR O CREAR EL LEAD POR KOMMO_ID
    let lead = null;
    if (lead_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
        lead = data;
    } else if (kommo_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommo_id).single();
        lead = data;
        
        if (!lead) {
            const { data: newLead } = await supabaseClient.from('leads').insert({
                kommo_id: kommo_id,
                nombre: 'Cliente de Kommo',
                last_message_at: new Date().toISOString()
            }).select().single();
            lead = newLead;
        }
    }

    // 2. CARGAR CONFIGURACIÓN Y PROMPTS
    const { data: configData } = await supabaseClient.from('app_config').select('key, value').eq('category', 'PROMPT');
    const prompts: any = {};
    configData?.forEach(i => prompts[i.key] = i.value);

    // 3. CARGAR HISTORIAL (MEMORIA)
    let conversationHistory = "";
    if (lead) {
        const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje, created_at')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true })
            .limit(20);

        if (messages?.length) {
            conversationHistory = "\n=== 💬 HISTORIAL RECIENTE ===\n";
            messages.forEach(msg => {
                conversationHistory += `[${msg.emisor}]: ${msg.mensaje}\n`;
            });
            conversationHistory += "\n--- FIN HISTORIAL ---\n";
        }
    }

    // ENSAMBLAR PROMPT
    const fullSystemPrompt = `
${prompts['prompt_adn_core']}
${prompts['prompt_tecnico']}
CLIENTE ACTUAL: ${lead?.nombre || 'Desconocido'}
${conversationHistory}
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: fullSystemPrompt,
        lead_id: lead?.id, // Enviamos el UUID interno para el siguiente paso
        status: "ready"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})