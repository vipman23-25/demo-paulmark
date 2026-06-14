-- Add advanced cron-like scheduling fields to reminders table
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS target_date date;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS target_day_of_week text; -- e.g., '1' for Monday, '2' for Tuesday, etc. (1-7, 1=Monday)
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS target_day_of_month integer; -- e.g., 1-31
