// @ts-nocheck
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

    // Extraer datos de la URL o Body
    const url = new URL(req.url);
    const kommo_id = url.searchParams.get('kommo_id');
    const phone = url.searchParams.get('phone');
    const name = url.searchParams.get('name');
    const client_message = url.searchParams.get('client_message');
    const ai_response = await req.text();
    
    if (!ai_response) throw new Error("Respuesta de IA requerida.");

    // 1. IDENTIFICAR LEAD
    let lead = null;
    if (kommo_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommo_id).maybeSingle();
        lead = data;
    }
    if (!lead && phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        const { data } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
        lead = data;
    }

    // 2. CREAR LEAD SI NO EXISTE
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({
            nombre: name || 'Nuevo Lead WhatsApp',
            telefono: phone,
            kommo_id: kommo_id || null,
        }).select().single();
        lead = newLead;
    }

    // 3. GUARDAR MENSAJES
    if (client_message) {
      await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: client_message, platform: 'API' });
    }
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: ai_response, platform: 'API' });
    
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    // --- EL GATILLO AUTOMÁTICO ---
    // Llamamos a la función de análisis en modo "background" para no retrasar la respuesta del webhook
    console.log(`[process-response] Disparando análisis automático para lead: ${lead.id}`);
    
    // Invocación asíncrona (Fire and forget)
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
        },
        body: JSON.stringify({ lead_id: lead.id, force: true })
    }).catch(err => console.error("Error en auto-análisis:", err));

    return new Response(JSON.stringify({ success: true, lead_id: lead.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})