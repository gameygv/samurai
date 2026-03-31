-- S2.2: Add message tracking columns to conversaciones
-- message_id: stores WhatsApp message ID (wamid) for deduplication
-- delivery_status: tracks sent/delivered/read status (prepared for S2.3)

ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS delivery_status TEXT;

-- Partial unique index: only enforce uniqueness when message_id is not null.
-- This allows Panel/campaign messages (no wamid) to pass without constraint,
-- while preventing duplicate WhatsApp messages on webhook retry.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversaciones_message_id
  ON conversaciones (message_id) WHERE message_id IS NOT NULL;
