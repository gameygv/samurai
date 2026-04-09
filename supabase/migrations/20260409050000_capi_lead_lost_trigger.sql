-- Extender trigger para también enviar LeadLost cuando un lead pasa a PERDIDO
-- Útil para construir audiencias negativas en Meta (excluir gente que no compra)

CREATE OR REPLACE FUNCTION public.on_lead_comprado()
RETURNS TRIGGER AS $$
DECLARE
  _pixel_id TEXT;
  _access_token TEXT;
  _test_code TEXT;
  _capi_enabled BOOLEAN;
  _action TEXT;
  _event_data JSONB;
BEGIN
  -- Solo disparar cuando buying_intent cambia A 'COMPRADO' o 'PERDIDO'
  IF NEW.buying_intent IN ('COMPRADO', 'PERDIDO')
     AND (OLD.buying_intent IS NULL OR OLD.buying_intent != NEW.buying_intent) THEN

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

      -- Determinar tipo de evento
      IF NEW.buying_intent = 'COMPRADO' THEN
        _action := 'CAPI_PURCHASE';
      ELSE
        _action := 'CAPI_LEAD_LOST';
      END IF;

      _event_data := json_build_object(
        'lead_id', NEW.id,
        'telefono', NEW.telefono,
        'nombre', COALESCE(NEW.nombre, ''),
        'email', COALESCE(NEW.email, ''),
        'ciudad', COALESCE(NEW.ciudad, ''),
        'estado', COALESCE(NEW.estado, ''),
        'cp', COALESCE(NEW.cp, ''),
        'pixel_id', _pixel_id,
        'access_token', _access_token,
        'test_event_code', COALESCE(_test_code, ''),
        'servicio_interes', COALESCE(NEW.servicio_interes, ''),
        'previous_intent', COALESCE(OLD.buying_intent, 'BAJO'),
        'assigned_to', COALESCE(NEW.assigned_to::TEXT, '')
      )::JSONB;

      INSERT INTO public.activity_logs (action, resource, description, status)
      VALUES (_action, 'SYSTEM', _event_data::TEXT, 'PENDING');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
