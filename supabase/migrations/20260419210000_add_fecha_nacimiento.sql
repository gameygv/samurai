-- Agregar campo fecha_nacimiento para matching Meta CAPI (campo db = date of birth)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_nacimiento date;
