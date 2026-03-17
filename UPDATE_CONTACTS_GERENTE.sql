-- Añadir columna de estado financiero a la tabla de contactos
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS financial_status TEXT DEFAULT 'Sin transacción';

-- Nota: El rol 'gerente' se maneja mediante metadatos y código sin necesidad de crear nuevas tablas.