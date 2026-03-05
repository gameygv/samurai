// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { newEmail } = await req.json();
    if (!newEmail) {
      throw new Error("El nuevo email es requerido.");
    }

    // 1. Validar la sesión del usuario que hace la petición
    const authHeader = req.headers.get('Authorization')!
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();
    if (userError || !user) throw new Error("No autorizado");

    // 2. Usar cliente Admin para forzar el cambio sin confirmación de link
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Actualizamos el email y lo marcamos como confirmado de una vez
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        email: newEmail,
        email_confirm: true // Esto evita que el usuario tenga que usar el link roto
      }
    )

    if (updateError) throw updateError;

    // 3. También actualizamos el username en el perfil para que coincida (opcional pero recomendado)
    const newUsername = newEmail.split('@')[0];
    await supabaseAdmin
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', user.id);

    return new Response(JSON.stringify({ success: true, user: updatedUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error("[update-user-email] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})