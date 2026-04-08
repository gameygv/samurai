-- Add ai_mode to whatsapp_channels
-- 'on' = IA responds automatically
-- 'monitor' = Records leads, chats, analyzes, sends CAPI, but NO AI response
-- 'off' = Channel completely ignored
ALTER TABLE public.whatsapp_channels
ADD COLUMN IF NOT EXISTS ai_mode TEXT DEFAULT 'on'
CHECK (ai_mode IN ('on', 'monitor', 'off'));
