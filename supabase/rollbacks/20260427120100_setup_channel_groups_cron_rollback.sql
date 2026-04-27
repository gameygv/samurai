-- Rollback E13/S13.3: eliminar cron de sync-channel-groups
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-channel-groups-30min') THEN
    PERFORM cron.unschedule('sync-channel-groups-30min');
  END IF;
END $$;
