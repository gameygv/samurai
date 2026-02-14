import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("--- SUPABASE DEBUG ---");
console.log("URL:", SUPABASE_URL ? "Configurada" : "FALTANTE");

// IMPORTANTE: createClient lanza un error si la URL está vacía.
// Usamos un placeholder si no hay configuración para evitar que la app se rompa (White Screen of Death).
// Esto permite que la UI de Login muestre el error de conexión amigablemente.
const url = SUPABASE_URL || 'https://placeholder.supabase.co';
const key = SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(url, key);