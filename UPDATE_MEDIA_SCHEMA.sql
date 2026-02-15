-- Agregar columna de instrucciones para la IA
ALTER TABLE public.media_assets 
ADD COLUMN IF NOT EXISTS ai_instructions TEXT;

-- Asegurar que la tabla conversaciones soporte metadatos de tipo de mensaje si no existe
-- (Usaremos el campo metadata JSONB que ya existe para { type: 'image' })