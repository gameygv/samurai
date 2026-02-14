-- Crear tabla para documentos de la base de conocimiento
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- PDF, DOC, TXT, NOTION, SHEET, etc
  category TEXT NOT NULL, -- Productos, Legal, Ventas, Logística, Soporte
  file_url TEXT, -- URL del archivo si está en storage
  external_link TEXT, -- Link externo si es Notion/Sheet
  size TEXT, -- Tamaño del archivo
  description TEXT,
  content TEXT, -- Contenido indexable para búsqueda
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- Políticas: Todos pueden leer, solo autenticados pueden crear/editar
CREATE POLICY "knowledge_select_policy" ON public.knowledge_documents
FOR SELECT TO authenticated USING (true);

CREATE POLICY "knowledge_insert_policy" ON public.knowledge_documents
FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "knowledge_update_policy" ON public.knowledge_documents
FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "knowledge_delete_policy" ON public.knowledge_documents
FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Índices para búsqueda rápida
CREATE INDEX idx_knowledge_category ON public.knowledge_documents(category);
CREATE INDEX idx_knowledge_title ON public.knowledge_documents(title);
CREATE INDEX idx_knowledge_created_at ON public.knowledge_documents(created_at DESC);