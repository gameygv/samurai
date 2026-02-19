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

    const url = new URL(req.url);
    const kommo_id = url.searchParams.get('kommo_id');
    const phone = url.searchParams.get('phone');

    if (!kommo_id && !phone) {
      throw new Error("Se requiere 'kommo_id' o 'phone' como parámetro en la URL.");
    }

    // --- 1. ENCONTRAR AL LEAD ---
    let leadQuery = supabaseClient.from('leads').select('id').limit(1).single();
    if (kommo_id) {
      leadQuery = leadQuery.eq('kommo_id', kommo_id);
    } else if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      leadQuery = leadQuery.or(`telefono.ilike.%${cleanPhone}%`);
    }
    
    const { data: lead, error: leadError } = await leadQuery;

    if (leadError || !lead) {
      // Si no hay lead, no hay historial. Devolvemos un historial vacío.
      return new Response(JSON.stringify({ history: "No hay historial previo para este lead." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- 2. OBTENER HISTORIAL DE CONVERSACIÓN ---
    const { data: messages, error: messagesError } = await supabaseClient
      .from('conversaciones')
      .select('emisor, mensaje')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(20); // Limitamos a los últimos 20 mensajes para no exceder el límite de tokens

    if (messagesError) throw messagesError;

    // --- 3. FORMATEAR HISTORIAL ---
    const history = messages
      .map(msg => `${msg.emisor}: ${msg.mensaje}`)
      .join('\n');

    return new Response(
      JSON.stringify({ history: history || "No hay historial previo para este lead." }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[get-lead-context] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})