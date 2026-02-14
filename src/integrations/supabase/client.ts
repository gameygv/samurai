import { createClient } from '@supabase/supabase-js';

// Usamos variables de entorno estándar de Vite
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Diagnóstico de conexión
console.log("--- SUPABASE CONFIG DIAGNOSTIC ---");
console.log("URL Detectada:", SUPABASE_URL ? "SÍ" : "NO (Usando Placeholder)");
console.log("Key Detectada:", SUPABASE_ANON_KEY ? "SÍ" : "NO (Usando Placeholder)");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ CRÍTICO: Faltan las variables de entorno de Supabase. La app no funcionará correctamente.');
  console.warn('Por favor, asegúrate de conectar el proyecto usando el botón de integración de Dyad y haz un REBUILD.');
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_ANON_KEY || 'placeholder'
);