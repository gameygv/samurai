// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[system-wipe] Iniciando secuencia de autodestrucción del sistema...");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { confirmation } = await req.json();
    
    // Verificación estricta de seguridad
    if (confirmation !== 'FACTORY_RESET') {
        throw new Error("Confirmación de seguridad denegada.");
    }

    // 1. OBTENER Y BORRAR USUARIOS (EXCEPTO gameygv@gmail.com)
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) throw usersError;

    let deletedUsers = 0;
    for (const user of users) {
      if (user.email !== 'gameygv@gmail.com') {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        deletedUsers++;
      }
    }
    console.log(`[system-wipe] Usuarios eliminados: ${deletedUsers}`);

    // 2. BORRAR TABLAS DE DATOS Y CONFIGURACIÓN
    // Nota: El usuario gameygv mantendrá su fila en 'profiles' porque no lo borramos de auth
    const tablesToWipe = [
      'leads', 'conversaciones', 'media_assets', 'knowledge_documents', 
      'main_website_content', 'activity_logs', 'errores_ia', 
      'versiones_prompts_aprendidas', 'prompt_versions', 'meta_capi_events', 
      'agent_evaluations', 'followup_config', 'followup_history'
    ];

    for (const table of tablesToWipe) {
      await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Borrar app_config (su primary key es 'key', no 'id')
    await supabaseAdmin.from('app_config').delete().neq('key', 'non_existent_key');

    // Registrar en logs que ocurrió un reset masivo por el usuario sobreviviente
    await supabaseAdmin.from('activity_logs').insert({
        action: 'RESTART',
        resource: 'SYSTEM',
        description: `FACTORY RESET EJECUTADO. Todos los datos y ${deletedUsers} usuarios eliminados.`,
        status: 'OK',
        username: 'gameygv@gmail.com'
    });

    return new Response(JSON.stringify({ 
        success: true, 
        message: `Sistema reseteado a fábrica. Se eliminaron ${deletedUsers} usuarios.` 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("[system-wipe] Error Crítico:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})