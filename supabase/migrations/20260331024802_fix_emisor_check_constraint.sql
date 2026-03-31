-- Fix: emisor check constraint was missing IA, SISTEMA, BOT values
-- These are used by process-samurai-response, process-campaign-queue, and history mapping

ALTER TABLE conversaciones DROP CONSTRAINT IF EXISTS conversaciones_emisor_check;
ALTER TABLE conversaciones ADD CONSTRAINT conversaciones_emisor_check
  CHECK (emisor IN ('CLIENTE', 'IA', 'HUMANO', 'SAMURAI', 'BOT', 'SISTEMA'));
