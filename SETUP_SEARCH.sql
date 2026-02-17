-- Habilitar extensión de búsqueda si no existe (normalmente viene por defecto en Supabase)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Crear un índice GIN para búsquedas rápidas en el contenido de los documentos
-- Esto permite que el Samurai encuentre palabras clave en milisegundos
CREATE INDEX IF NOT EXISTS knowledge_documents_content_idx ON public.knowledge_documents USING GIN (to_tsvector('spanish', content));
CREATE INDEX IF NOT EXISTS knowledge_documents_title_idx ON public.knowledge_documents USING GIN (to_tsvector('spanish', title));

-- Comentario: Índices aplicados para RAG Nativo en Edge Function.