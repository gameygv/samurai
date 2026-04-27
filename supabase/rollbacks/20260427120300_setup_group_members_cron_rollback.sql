DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-group-members-30min') THEN
    PERFORM cron.unschedule('sync-group-members-30min');
  END IF;
END $$;
