SELECT cron.unschedule('check-services-every-minute');

SELECT cron.schedule(
  'check-services-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://cynnbynmicfosozmgjua.supabase.co/functions/v1/check-services?force=true',
    headers:=format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}',
      current_setting('app.settings.service_role_key', true))::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);