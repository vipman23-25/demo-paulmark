-- Add advanced filtering columns to the reminders table

ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS target_gender TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS target_shift TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS target_employment_type TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS target_break_status TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS target_task TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS target_time TEXT;
