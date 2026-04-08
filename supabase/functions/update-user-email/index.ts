// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

import { corsHeaders } from '../_shared/cors.ts'
import { requireRole } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireRole(req, ['admin', 'dev']);
  if (auth.error) return auth.error;

  try {
    const { email } = await req.json();
    if (!email) throw new Error("Email requerido");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[Rescate] Buscando usuario para: ${email}`);

    // 1. Buscar usuario por email (paginated to handle >50 users)
    let userToFix = null;
    let page = 1;
    while (!userToFix) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (listError) throw listError;
      if (!users || users.length === 0) break;
      userToFix = users.find(u => u.email === email || u.new_email === email);
      page++;
    }

    if (!userToFix) {
      throw new Error("No se encontró ninguna cuenta asociada a este correo.");
    }

    // 2. Forzar actualización y confirmación
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userToFix.id,
      { 
        email: email, 
        email_confirm: true,
        user_metadata: { ...userToFix.user_metadata, email_verified: true }
      }
    );

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, message: "Cuenta reparada. Ya puedes iniciar sesión." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})