-- Esto elimina el candado de seguridad que bloqueaba la creación/edición del rol 'gerente'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;