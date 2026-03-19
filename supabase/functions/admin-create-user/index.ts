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

    if (!email || !password || !fullName) {
        throw new Error("Email, Contraseña y Nombre son obligatorios.");
    }

    if (password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const finalRole = (role === 'agent' || role === 'sales') ? 'sales_agent' : (role || 'sales_agent');

    console.log(`[admin-create-user] Creando cuenta para: ${email}`);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: { 
        full_name: fullName,
        role: finalRole 
      },
      email_confirm: true 
    })

    if (error) {
        if (error.message.includes("already registered")) {
            throw new Error("Este correo electrónico ya está registrado en el sistema.");
        }
        throw error;
    }

    // Asegurar que el perfil se cree o actualice con el rol correcto
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role: finalRole, full_name: fullName })
      .eq('id', data.user.id);
    
    if (profileError) console.error("Error actualizando perfil:", profileError);
    
    return new Response(JSON.stringify({ success: true, user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error("[admin-create-user] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})