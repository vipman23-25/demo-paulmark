-- Task Automation Settings
CREATE TABLE IF NOT EXISTS public.task_automation_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_name TEXT NOT NULL UNIQUE, -- 'warehouse' or 'kitchen'
    active_days JSONB DEFAULT '[]'::jsonb, -- e.g., [1, 2, 3, 4, 5, 6, 7]
    max_capacity INTEGER DEFAULT 1,
    rules JSONB DEFAULT '{}'::jsonb, -- e.g., department, gender, shift restrictions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Task Personnel Balances (Borç/Alacak)
CREATE TABLE IF NOT EXISTS public.task_personnel_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE NOT NULL,
    module_name TEXT NOT NULL, -- 'warehouse' or 'kitchen'
    balance_days INTEGER DEFAULT 0, -- manual +/- adjustment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(personnel_id, module_name)
);

-- Task Assignments
CREATE TABLE IF NOT EXISTS public.task_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE NOT NULL,
    module_name TEXT NOT NULL, -- 'warehouse' or 'kitchen'
    assignment_date DATE NOT NULL,
    shift TEXT, -- 'Morning' or 'Evening' or custom code
    is_manual BOOLEAN DEFAULT false, -- if the admin manually overridden the engine
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(personnel_id, module_name, assignment_date)
);

-- Disable RLS for now so admin operations won't get blocked
ALTER TABLE public.task_automation_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_personnel_balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments DISABLE ROW LEVEL SECURITY;
