CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.system_settings (setting_key, setting_value)
VALUES (
    'general',
    '{"breakLimitMinutes": 60, "movementTypes": ["İzin", "Hastalık İzni", "Muafiyet", "Başka Görev"], "overtimeTypes": ["Fazla Mesai", "Alacak (Kullanım)"]}'::jsonb
);
