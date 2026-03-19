// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, password, fullName, role } = await req.json();

    // 1. Cliente Admin (Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Crear el usuario con metadatos de rol
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: { 
        full_name: fullName,
        role: role || 'agent' 
      },
      email_confirm: true 
    })

    if (error) throw error;

    // 3. Forzamos la actualización inmediata del perfil para asegurar que el rol sea el correcto
    // (Por si el trigger handle_new_user tiene una lógica de fallback antigua)
    await supabaseAdmin
      .from('profiles')
      .update({ role: role || 'agent' })
      .eq('id', data.user.id);
    
    return new Response(JSON.stringify({ success: true, user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error("[admin-create-user] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})