import { createClient } from '@supabase/supabase-js';

// URL proporcionada por ti desde Coolify
export const SUPABASE_URL = 'http://supabasekong-t8c8c44ck80wcookscww8c0k.162.251.123.3.sslip.io';

// TODO: REEMPLAZAR ESTO CON TU 'ANON KEY' CUANDO ME LA DES
export const SUPABASE_ANON_KEY = 'INSERT_ANON_KEY_HERE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);