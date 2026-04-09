-- Trigger: enviar evento Purchase a Meta CAPI cuando un lead pasa a COMPRADO
-- Se ejecuta desde cualquier punto (Pipeline drag, UI, API) sin duplicar lógica

CREATE OR REPLACE FUNCTION public.on_lead_comprado()
RETURNS TRIGGER AS $$
DECLARE
  _pixel_id TEXT;
  _access_token TEXT;
  _test_code TEXT;
  _capi_enabled BOOLEAN;
BEGIN
  -- Solo disparar cuando buying_intent cambia A 'COMPRADO'
  IF NEW.buying_intent = 'COMPRADO' AND (OLD.buying_intent IS NULL OR OLD.buying_intent != 'COMPRADO') THEN

    -- Verificar CAPI habilitado para el canal
    IF NEW.channel_id IS NOT NULL THEN
      SELECT capi_enabled INTO _capi_enabled
      FROM public.whatsapp_channels WHERE id = NEW.channel_id;
      IF _capi_enabled = false THEN RETURN NEW; END IF;
    END IF;

    -- Obtener config CAPI
    SELECT value INTO _pixel_id FROM public.app_config WHERE key = 'meta_pixel_id';
    SELECT value INTO _access_token FROM public.app_config WHERE key = 'meta_access_token';
    SELECT value INTO _test_code FROM public.app_config WHERE key = 'meta_test_event_code';

    IF _pixel_id IS NOT NULL AND _pixel_id != '' AND _access_token IS NOT NULL AND _access_token != '' THEN
      -- Invocar meta-capi-sender vía pg_net (si disponible) o insertar en cola
      -- Usamos activity_log como señal para que un cron/webhook lo procese
      INSERT INTO public.activity_logs (action, resource, description, status)
      VALUES (
        'CAPI_PURCHASE',
        'SYSTEM',
        json_build_object(
          'lead_id', NEW.id,
          'telefono', NEW.telefono,
          'nombre', NEW.nombre,
          'email', COALESCE(NEW.email, ''),
          'ciudad', COALESCE(NEW.ciudad, ''),
          'estado', COALESCE(NEW.estado, ''),
          'cp', COALESCE(NEW.cp, ''),
          'pixel_id', _pixel_id,
          'access_token', _access_token,
          'test_event_code', COALESCE(_test_code, ''),
          'servicio_interes', COALESCE(NEW.servicio_interes, '')
        )::TEXT,
        'PENDING'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger (drop si ya existe)
DROP TRIGGER IF EXISTS trg_lead_comprado ON public.leads;
CREATE TRIGGER trg_lead_comprado
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.on_lead_comprado();
