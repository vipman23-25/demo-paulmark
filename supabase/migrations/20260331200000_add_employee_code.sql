-- Add a custom ID (employee badge/code) column
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS employee_code TEXT;
