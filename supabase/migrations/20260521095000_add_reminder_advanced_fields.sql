ALTER TABLE public.reminders ADD COLUMN display_type TEXT DEFAULT 'popup';
ALTER TABLE public.reminders ADD COLUMN action_button_label TEXT;
ALTER TABLE public.reminders ADD COLUMN action_url TEXT;
ALTER TABLE public.reminders ADD COLUMN auto_close_seconds INTEGER;
