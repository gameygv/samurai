-- 1. Añadir los nuevos campos tácticos a la tabla de leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS apellido TEXT,
ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'mx',
ADD COLUMN IF NOT EXISTS estado TEXT,
ADD COLUMN IF NOT EXISTS cp TEXT,
ADD COLUMN IF NOT EXISTS servicio_interes TEXT,
ADD COLUMN IF NOT EXISTS origen_contacto TEXT,
ADD COLUMN IF NOT EXISTS tiempo_compra TEXT,
ADD COLUMN IF NOT EXISTS main_pain TEXT,
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;

-- 2. Insertar el Prompt del Analista en app_config para que sea editable desde el panel
INSERT INTO public.app_config (key, value, category, description)
VALUES (
  'prompt_analista_datos',
  'Eres el Analista de Datos de Samurai. Tu misión es leer el historial del chat y extraer información del cliente en este JSON exacto. NUNCA inventes lo que no sepas, usa null si no estás seguro.
{
  "nombre": "Nombre de pila del cliente (o null)",
  "apellido": "Apellido del cliente (o null)",
  "email": "correo electrónico (o null)",
  "ciudad": "Ciudad mencionada",
  "estado": "Infiere el estado/provincia basado en la ciudad. Ej: Si es Monterrey, pon nl",
  "cp": "Infiere un código postal central válido para la ciudad. Ej: Guadalajara -> 44100",
  "pais": "mx (u otro código de 2 letras si menciona otro país)",
  "intent": "ALTO/MEDIO/BAJO",
  "summary": "Resumen corto de la situación",
  "main_pain": "Problema principal corto (ansiedad, estrés, insomnio, sanación)",
  "origen_contacto": "De dónde viene (fb_ads, ig_organico, referido, google)",
  "servicio_interes": "Taller, terapia o producto que busca",
  "tiempo_compra": "Urgencia: esta_semana, este_mes, futuro",
  "lead_score": "Número del 1 al 100 calificando la probabilidad de compra (100 = listo para pagar)",
  "psych_profile": "Perfil psicológico corto (analítico, emocional, etc)"
}',
  'PROMPT',
  'Instrucciones de extracción JSON para alimentar Meta CAPI'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;