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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const finalRole = (role === 'agent' || role === 'sales') ? 'sales_agent' : (role || 'sales_agent');

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: { 
        full_name: fullName,
        role: finalRole 
      },
      email_confirm: true 
    })

    if (error) throw error;

    await supabaseAdmin
      .from('profiles')
      .update({ role: finalRole, full_name: fullName })
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