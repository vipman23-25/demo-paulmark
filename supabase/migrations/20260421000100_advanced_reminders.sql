-- Add new columns for survey and recurrence natively to reminders
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS is_survey boolean DEFAULT false;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS recurrence text DEFAULT 'none';

-- Create reminder_responses to capture feedback/surveys
CREATE TABLE IF NOT EXISTS public.reminder_responses (
    id uuid not null default gen_random_uuid(),
    reminder_id uuid not null references public.reminders(id) on delete cascade,
    personnel_id uuid not null references public.personnel(id) on delete cascade,
    response_date date not null default current_date,
    status text not null,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    constraint reminder_responses_pkey primary key (id),
    -- One response per personnel per reminder per day
    unique(reminder_id, personnel_id, response_date)
);

alter table public.reminder_responses disable row level security;
grant all privileges on table public.reminder_responses to anon, authenticated, service_role;
