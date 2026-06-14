-- Add notification_preferences column to personnel table to store user-specific settings

ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;
