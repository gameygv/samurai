// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

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
    const phone = url.searchParams.get('phone');

    if (!phone) {
      throw new Error("Se requiere el parámetro 'phone' en la URL.");
    }

    // --- 1. ENCONTRAR AL LEAD ---
    const cleanPhone = phone.replace(/\D/g, '');
    const { data: lead, error: leadError } = await supabaseClient
      .from('leads')
      .select('*')
      .or(`telefono.ilike.%${cleanPhone}%`)
      .limit(1)
      .maybeSingle();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ history: "Nuevo prospecto.", profile: "Sin datos previos." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- 2. OBTENER HISTORIAL (excluir mensajes de campaña) ---
    const { data: messages } = await supabaseClient
      .from('conversaciones')
      .select('emisor, mensaje')
      .eq('lead_id', lead.id)
      .neq('emisor', 'CAMPAÑA')
      .order('created_at', { ascending: true })
      .limit(25);

    const history = messages?.map(msg => `${msg.emisor}: ${msg.mensaje}`).join('\n') || "Sin mensajes previos.";

    // --- 3. CONSTRUIR PERFIL PARA LA IA ---
    const profile = `
DATOS ACTUALES DEL LEAD:
- NOMBRE: ${lead.nombre || 'Desconocido'}
- CIUDAD: ${lead.ciudad || 'Desconocida (Indispensable obtenerla en Fase 1)'}
- EMAIL: ${lead.email || 'No capturado (Indispensable para Meta CAPI)'}
- INTENCIÓN: ${lead.buying_intent}
- PERFIL PSICOGRÁFICO: ${lead.perfil_psicologico || 'Pendiente de análisis'}
- RESUMEN SITUACIÓN: ${lead.summary || 'Contacto inicial'}
    `.trim();

    return new Response(
      JSON.stringify({ 
        history, 
        profile,
        lead_id: lead.id,
        is_paused: lead.ai_paused
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})