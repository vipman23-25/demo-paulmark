-- Drop the old mismatched reminders table and recreate it to match the frontend application code

DROP TABLE IF EXISTS public.reminders CASCADE;

CREATE TABLE public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    reminder_date DATE NOT NULL,
    reminder_time TIME,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Remember to disable RLS on this recreated table so the dev app can insert into it
ALTER TABLE public.reminders DISABLE ROW LEVEL SECURITY;
