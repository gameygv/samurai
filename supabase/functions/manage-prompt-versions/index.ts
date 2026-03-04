// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Usamos el SERVICE_ROLE_KEY para tener permisos de administrador y saltar el candado de seguridad (RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, id } = await req.json()

    if (action === 'PURGE') {
       console.log("[manage-prompt-versions] Purgando todo el historial...");
       // Borra todos los registros que no sean un UUID vacío (básicamente todos)
       const { error } = await supabaseAdmin.from('prompt_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
       if (error) throw error;
       
       return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } 
    
    if (action === 'DELETE' && id) {
       console.log(`[manage-prompt-versions] Eliminando snapshot: ${id}`);
       const { error } = await supabaseAdmin.from('prompt_versions').delete().eq('id', id);
       if (error) throw error;
       
       return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error("Acción no válida");

  } catch (error: any) {
    console.error("[manage-prompt-versions] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})