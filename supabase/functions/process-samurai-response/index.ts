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

    // Extract data from URL query parameters
    const url = new URL(req.url);
    const kommo_id = url.searchParams.get('kommo_id');
    const phone = url.searchParams.get('phone');
    const name = url.searchParams.get('name');
    const client_message = url.searchParams.get('client_message');

    // Get the AI response from the raw request body
    const ai_response = await req.text();
    
    if (!ai_response) throw new Error("La respuesta de la IA (en el cuerpo del request) es requerida.");

    // --- 1. IDENTIFICAR O CREAR LEAD ---
    let lead = null;
    if (kommo_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommo_id).single();
        lead = data;
    }
    const rawPhone = phone ? phone.toString() : null;
    const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : null;
    if (!lead && cleanPhone) {
        const { data } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
        lead = data;
    }
    if (!lead && (cleanPhone || kommo_id)) {
        const { data: newLead } = await supabaseClient.from('leads').insert({
            nombre: name || 'Nuevo Lead WhatsApp',
            telefono: rawPhone,
            kommo_id: kommo_id || null,
        }).select().single();
        lead = newLead;
    }
    if (!lead) throw new Error("No se pudo identificar ni crear el lead (Datos insuficientes).");

    // --- 2. GUARDAR CONVERSACIÓN ---
    if (client_message) {
      await supabaseClient.from('conversaciones').insert({ 
          lead_id: lead.id, 
          emisor: 'CLIENTE', 
          mensaje: client_message, 
          platform: 'API' 
      });
    }
    
    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'SAMURAI', 
        mensaje: ai_response, 
        platform: 'API' 
    });
    await supabaseClient.from('leads').update({ 
        last_message_at: new Date().toISOString() 
    }).eq('id', lead.id);

    return new Response(
        JSON.stringify({ 
            success: true, 
            message: "Conversación guardada.", 
            lead_id: lead.id 
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[process-samurai-response] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})