-- S7.2: Add valid_until to knowledge_documents to filter expired content
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS valid_until DATE;
