-- S11.1: Add profile columns to contacts and pricing columns to credit_sales
-- All columns nullable, IF NOT EXISTS for idempotency

-- Profile columns on contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS dieta TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS alimentacion TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS alergias TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS motivo_curso TEXT;

-- Pricing columns on credit_sales
ALTER TABLE public.credit_sales ADD COLUMN IF NOT EXISTS precio_tipo TEXT;
ALTER TABLE public.credit_sales ADD COLUMN IF NOT EXISTS precio_original NUMERIC;
