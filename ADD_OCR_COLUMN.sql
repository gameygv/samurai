-- Añadir columna para contenido OCR separado de las instrucciones
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS ocr_content TEXT;

-- Comentario para claridad
COMMENT ON COLUMN public.media_assets.ocr_content IS 'Contenido textual extraído de la imagen mediante visión artificial.';
COMMENT ON COLUMN public.media_assets.ai_instructions IS 'Instrucciones en lenguaje natural sobre CUÁNDO y CÓMO debe Samurai enviar este archivo.';