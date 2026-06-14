-- Create shift_gender_rules
CREATE TABLE IF NOT EXISTS public.shift_gender_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1: Monday, 7: Sunday
    gender TEXT NOT NULL, -- 'Erkek', 'Kadın'
    warning_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Upgrade existing weekly_day_off table
ALTER TABLE public.weekly_day_off 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
ADD COLUMN IF NOT EXISTS requested_shift TEXT, -- 'sabah', 'aksam', 'farketmez'
ADD COLUMN IF NOT EXISTS admin_response TEXT;

-- Create shift_schedules
CREATE TABLE IF NOT EXISTS public.shift_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type TEXT NOT NULL, -- 'S', 'A', 'İ', 'R', 'S+M', etc.
    week_start_date DATE NOT NULL,
    is_manual_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create department_shift_rules
CREATE TABLE IF NOT EXISTS public.department_shift_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name TEXT NOT NULL UNIQUE,
    override_morning_count INTEGER,
    override_evening_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
