// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, newPassword } = await req.json();
    if (!email || !newPassword) throw new Error("Email y nueva contraseña son requeridos.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const userToReset = users.find(u => u.email === email);
    if (!userToReset) {
      throw new Error(`No se encontró un usuario con el email: ${email}`);
    }

    // Reset the password
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userToReset.id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, message: "Contraseña restablecida." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[admin-reset-password] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})