SELECT cron.unschedule('check-services-every-minute');

SELECT cron.schedule(
  'check-services-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://cynnbynmicfosozmgjua.supabase.co/functions/v1/check-services?force=true',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bm5ieW5taWNmb3Nvem1nanVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDA2NjgsImV4cCI6MjA4NjM3NjY2OH0.qlusQwSNiaAUAlJsaPCI24e1-oiw-Dtp21djpOUclIA"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);