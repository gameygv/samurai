// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, userId, transferToId } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'DELETE') {
        if (!userId) throw new Error("ID de usuario a eliminar requerido.");
        
        // 1. TRANSFERENCIA DE ACTIVOS (Si se proporcionó un destino)
        if (transferToId) {
            console.log(`[manage-auth-users] Transfiriendo activos de ${userId} a ${transferToId}...`);
            
            // Transferir Leads asignados
            await supabaseAdmin.from('leads').update({ assigned_to: transferToId }).eq('assigned_to', userId);
            
            // Transferir Ventas a Crédito (Responsable)
            await supabaseAdmin.from('credit_sales').update({ responsible_id: transferToId }).eq('responsible_id', userId);
            
            // Transferir Documentos de Conocimiento
            await supabaseAdmin.from('knowledge_documents').update({ created_by: transferToId }).eq('created_by', userId);
            
            // Transferir Snapshots y Reportes #CIA (Evita bloqueos de Foreign Keys)
            await supabaseAdmin.from('prompt_versions').update({ created_by: transferToId }).eq('created_by', userId);
            await supabaseAdmin.from('errores_ia').update({ usuario_id: transferToId }).eq('usuario_id', userId);
            
            console.log(`[manage-auth-users] Transferencia completa de activos empresariales.`);
        }

        // 2. ELIMINACIÓN DEL USUARIO EN AUTH
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        
        return new Response(JSON.stringify({ success: true, message: "Usuario eliminado y activos transferidos de forma segura." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    throw new Error("Acción no reconocida");

  } catch (error: any) {
    console.error("[manage-auth-users] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})