import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://giwoovmvwlddaizorizk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd29vdm12d2xkZGFpem9yaXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDQzOTAsImV4cCI6MjA4NjYyMDM5MH0.5U_gkRRScbW8iOCk_3HC2V3ZcQVkWvl0n5ZLgccR1qo";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type { Database };