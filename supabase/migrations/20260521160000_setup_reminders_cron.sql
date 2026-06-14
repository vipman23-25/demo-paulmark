CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the edge function to run every minute
SELECT cron.schedule(
    'invoke-scheduled-reminders-every-minute',
    '* * * * *',
    $$
    SELECT net.http_post(
        url:='https://kiqptcpukecbeegkpnui.supabase.co/functions/v1/trigger-scheduled-reminders',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    );
    $$
);
