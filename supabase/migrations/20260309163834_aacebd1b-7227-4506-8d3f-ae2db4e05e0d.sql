DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-services-every-minute') THEN
    PERFORM cron.unschedule('check-services-every-minute');
  END IF;
END $$;

SELECT cron.schedule(
  'check-services-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://irsmnxqzyimcmusdkket.supabase.co/functions/v1/check-services?force=true',
    headers:=format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}',
      current_setting('app.settings.service_role_key', true))::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);