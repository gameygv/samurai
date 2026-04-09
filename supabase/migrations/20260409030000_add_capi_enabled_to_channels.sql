-- Per-channel CAPI toggle: allows disabling Meta CAPI events for test/dev channels
ALTER TABLE public.whatsapp_channels
ADD COLUMN IF NOT EXISTS capi_enabled BOOLEAN DEFAULT true;
