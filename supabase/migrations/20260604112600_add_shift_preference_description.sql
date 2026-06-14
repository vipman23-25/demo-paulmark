-- Add description column to shift_preferences table
ALTER TABLE public.shift_preferences ADD COLUMN IF NOT EXISTS description TEXT;
