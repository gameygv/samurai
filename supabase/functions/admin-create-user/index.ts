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

    const finalRole = (role === 'sales_agent' || role === 'sales') ? 'agent' : (role || 'agent');

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
        if (error.message.includes("already registered") || error.message.includes("User already exists")) {
            throw new Error("Este correo electrónico ya está registrado en el sistema.");
        }
        throw error;
    }

    // Actualizamos el perfil público
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role: finalRole, full_name: fullName })
      .eq('id', data.user.id);
    
    if (profileError) {
        // Hacemos rollback: Si la DB rechaza el rol, borramos el usuario recién creado
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        throw new Error("Error en BD al asignar rol. ¿Corriste el script SQL de FIX_GERENTE_ROLE?: " + profileError.message);
    }
    
    return new Response(JSON.stringify({ success: true, user: data.user }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error("[admin-create-user] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, // Devolvemos 200 para que el frontend pueda leer el JSON sin problemas
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})