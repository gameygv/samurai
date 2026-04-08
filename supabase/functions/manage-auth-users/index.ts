// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { requireRole } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await requireRole(req, ['admin', 'dev']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { action, userId, transferToId, email, password } = body;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'LIST') {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, users }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    if (action === 'UPDATE') {
        if (!userId) throw new Error("ID de usuario requerido.");
        const updates: any = {};
        if (email) updates.email = email;
        if (password) updates.password = password;
        
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
        if (error) {
            if (error.message.includes("already registered") || error.message.includes("User already exists")) {
                throw new Error("Este correo electrónico ya está en uso por otra persona.");
            }
            throw error;
        }
        return new Response(JSON.stringify({ success: true, user: data.user }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    if (action === 'DELETE') {
        if (!userId) throw new Error("ID de usuario a eliminar requerido.");
        
        if (transferToId) {
            await supabaseAdmin.from('leads').update({ assigned_to: transferToId }).eq('assigned_to', userId);
            await supabaseAdmin.from('credit_sales').update({ responsible_id: transferToId }).eq('responsible_id', userId);
            await supabaseAdmin.from('knowledge_documents').update({ created_by: transferToId }).eq('created_by', userId);
            await supabaseAdmin.from('prompt_versions').update({ created_by: transferToId }).eq('created_by', userId);
            await supabaseAdmin.from('errores_ia').update({ usuario_id: transferToId }).eq('usuario_id', userId);
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        
        return new Response(JSON.stringify({ success: true, message: "Usuario eliminado." }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    throw new Error("Acción no reconocida");

  } catch (error: any) {
    console.error("[manage-auth-users] Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})