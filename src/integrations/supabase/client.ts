import { createClient } from '@supabase/supabase-js';

// URL proporcionada por ti desde Coolify
export const SUPABASE_URL = 'http://supabasekong-t8c8c44ck80wcookscww8c0k.162.251.123.3.sslip.io';

export const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MDU0NDg2MCwiZXhwIjo0OTI2MjE4NDYwLCJyb2xlIjoiYW5vbiJ9.Sf5YvNWNtfw8PIMWVL9xK1a2CJx3wMJPMn0u-yquK1o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);