const ALLOWED_ORIGINS = [
  Deno.env.get('CORS_ALLOWED_ORIGIN'),
  'http://localhost:8080',
  'http://localhost:5173',
].filter(Boolean) as string[];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

// Backward-compatible static export for functions that haven't migrated to getCorsHeaders
export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id',
};
