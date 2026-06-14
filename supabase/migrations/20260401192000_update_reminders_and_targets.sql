ALTER TABLE public.reminders ALTER COLUMN personnel_id DROP NOT NULL;
ALTER TABLE public.reminders ADD COLUMN department_name TEXT;
