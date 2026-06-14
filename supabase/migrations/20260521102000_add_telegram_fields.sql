ALTER TABLE public.personnel ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE public.reminders ADD COLUMN send_to_telegram BOOLEAN DEFAULT false;
