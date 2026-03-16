-- Insertar o actualizar el catálogo de WooCommerce inicial en app_config
INSERT INTO public.app_config (key, value, category, description)
VALUES (
    'wc_products', 
    '[{"id":"1700000000000","wc_id":"1483","title":"Inscripción / Anticipo Taller","price":"1500","prompt":"Ofrecer este enlace exclusivamente cuando el cliente confirme que desea asegurar su lugar o apartar su cupo en el Taller/Certificación. Este producto corresponde a la INSCRIPCIÓN O ANTICIPO de $1,500 MXN. IMPORTANTE: Entregar el enlace solo después de haber obtenido el email y la ciudad del cliente en la fase de cierre."}]', 
    'WOOCOMMERCE', 
    'Catálogo dinámico de productos y prompts de venta'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;

-- Limpiar la llave vieja si existe para evitar confusión
DELETE FROM public.app_config WHERE key = 'wc_product_id';