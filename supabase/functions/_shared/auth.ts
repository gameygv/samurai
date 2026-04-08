import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from './cors.ts'

interface AuthResult {
  data: { user: any; profile: any } | null;
  error: Response | null;
}

export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { data: null, error: new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  const token = authHeader.replace('Bearer ', '');

  // Validate JWT with anon key (respects normal auth flow)
  const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

  if (userError || !user) {
    return { data: null, error: new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  // Lookup profile with service_role (guaranteed access)
  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data: profile } = await supabaseAdmin.from('profiles').select('role, full_name').eq('id', user.id).single();

  return { data: { user, profile }, error: null };
}

export async function requireRole(req: Request, allowedRoles: string[]): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if (auth.error) return auth;

  const role = auth.data?.profile?.role?.toLowerCase() || 'agent';
  if (!allowedRoles.includes(role)) {
    return { data: null, error: new Response(JSON.stringify({ error: 'Insufficient permissions', required: allowedRoles, current: role }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  return auth;
}
