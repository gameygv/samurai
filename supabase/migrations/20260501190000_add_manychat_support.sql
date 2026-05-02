-- ManyChat integration: subscriber ID en leads + API key en app_config
-- Soporte para Messenger, Instagram DMs, y comentarios via ManyChat

-- Campo para vincular lead con subscriber de ManyChat
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS manychat_subscriber_id TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_manychat_sub ON public.leads (manychat_subscriber_id) WHERE manychat_subscriber_id IS NOT NULL;

-- Agregar 'manychat' al constraint de provider
ALTER TABLE public.whatsapp_channels DROP CONSTRAINT IF EXISTS whatsapp_channels_provider_check;
ALTER TABLE public.whatsapp_channels ADD CONSTRAINT whatsapp_channels_provider_check
  CHECK (provider = ANY (ARRAY['evolution','gowa','meta','manychat']));

-- Webhook secret para validar requests entrantes de ManyChat
INSERT INTO public.app_config (key, value, category)
VALUES ('manychat_webhook_secret', 'mc_samurai_2026_secret', 'integrations')
ON CONFLICT (key) DO NOTHING;

-- API key de ManyChat (se actualiza con el valor real)
INSERT INTO public.app_config (key, value, category)
VALUES ('manychat_api_key', '', 'integrations')
ON CONFLICT (key) DO NOTHING;
