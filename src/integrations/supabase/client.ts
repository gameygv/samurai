import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("--- SUPABASE DEBUG ---");
console.log("URL:", SUPABASE_URL ? "Configurada" : "FALTANTE");
console.log("KEY:", SUPABASE_ANON_KEY ? "Configurada" : "FALTANTE");

// Si faltan las credenciales, usamos valores vacíos para provocar un error claro en lugar de conectar a placeholder
// Esto ayuda a diagnosticar mejor el problema en el Login
export const supabase = createClient(
  SUPABASE_URL || '', 
  SUPABASE_ANON_KEY || ''
);