// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { action, userId, transferToId, email, password } = body;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. LISTAR USUARIOS (Para extraer los Emails ocultos)
    if (action === 'LIST') {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // 2. ACTUALIZAR CREDENCIALES (Email o Contraseña)
    if (action === 'UPDATE') {
        if (!userId) throw new Error("ID de usuario requerido.");
        const updates: any = {};
        if (email) updates.email = email;
        if (password) updates.password = password;
        
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
        if (error) {
            if (error.message.includes("already registered")) throw new Error("Este email ya está en uso.");
            throw error;
        }
        return new Response(JSON.stringify({ success: true, user: data.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // 3. ELIMINAR Y TRANSFERIR
    if (action === 'DELETE') {
        if (!userId) throw new Error("ID de usuario a eliminar requerido.");
        
        if (transferToId) {
            console.log(`[manage-auth-users] Transfiriendo activos a ${transferToId}...`);
            await supabaseAdmin.from('leads').update({ assigned_to: transferToId }).eq('assigned_to', userId);
            await supabaseAdmin.from('credit_sales').update({ responsible_id: transferToId }).eq('responsible_id', userId);
            await supabaseAdmin.from('knowledge_documents').update({ created_by: transferToId }).eq('created_by', userId);
            await supabaseAdmin.from('prompt_versions').update({ created_by: transferToId }).eq('created_by', userId);
            await supabaseAdmin.from('errores_ia').update({ usuario_id: transferToId }).eq('usuario_id', userId);
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        
        return new Response(JSON.stringify({ success: true, message: "Usuario eliminado." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    throw new Error("Acción no reconocida");

  } catch (error: any) {
    console.error("[manage-auth-users] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})