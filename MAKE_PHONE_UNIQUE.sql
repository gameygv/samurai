-- 1. Eliminar duplicados exactos (dejando el registro más reciente)
DELETE FROM public.contacts a USING (
    SELECT MAX(id) as max_id, telefono
    FROM public.contacts 
    WHERE telefono IS NOT NULL
    GROUP BY telefono HAVING COUNT(*) > 1
) b
WHERE a.telefono = b.telefono AND a.id != b.max_id;

-- 2. Asegurar que no haya teléfonos nulos o vacíos que rompan la regla
DELETE FROM public.contacts WHERE telefono IS NULL OR telefono = '';

-- 3. Añadir la restricción UNIQUE
ALTER TABLE public.contacts ADD CONSTRAINT contacts_telefono_key UNIQUE (telefono);