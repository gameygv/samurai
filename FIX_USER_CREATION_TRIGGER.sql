-- 1. Reemplazamos la función problemática por una inteligente y a prueba de fallos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    -- Usamos el email completo para garantizar que nunca haya un choque de nombres
    new.email, 
    -- Tomamos el nombre exacto que enviaste desde el panel
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    -- Tomamos el rol exacto que enviaste desde el panel (ej. gerente, agent)
    COALESCE(new.raw_user_meta_data->>'role', 'agent')
  )
  -- Si por alguna razón el perfil ya existe, lo actualiza en lugar de causar un error
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
    
  return new;
end;
$function$;