CREATE OR REPLACE FUNCTION public.sync_contact_from_lead()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.contacts (lead_id, nombre, apellido, telefono, email, ciudad, estado, cp, pais, tags, origen_contacto)
  VALUES (NEW.id, NEW.nombre, NEW.apellido, NEW.telefono, NEW.email, NEW.ciudad, NEW.estado, NEW.cp, NEW.pais, COALESCE(NEW.tags, '{}'), NEW.origen_contacto)
  ON CONFLICT (telefono) DO UPDATE SET
    lead_id = EXCLUDED.lead_id, -- ¡Crucial para enlazar contactos importados!
    nombre = COALESCE(EXCLUDED.nombre, contacts.nombre),
    apellido = COALESCE(EXCLUDED.apellido, contacts.apellido),
    email = COALESCE(EXCLUDED.email, contacts.email),
    ciudad = COALESCE(EXCLUDED.ciudad, contacts.ciudad),
    estado = COALESCE(EXCLUDED.estado, contacts.estado),
    cp = COALESCE(EXCLUDED.cp, contacts.cp),
    tags = COALESCE(EXCLUDED.tags, contacts.tags),
    updated_at = NOW();
  RETURN NEW;
END;
$function$