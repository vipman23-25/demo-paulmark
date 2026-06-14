-- is_active exists
-- ALTER TABLE public.reminders ADD COLUMN is_active boolean DEFAULT true;

-- Remove the old not null constraints for dates if they exist
ALTER TABLE public.reminders ALTER COLUMN reminder_date DROP NOT NULL;
ALTER TABLE public.reminders ALTER COLUMN reminder_time DROP NOT NULL;

-- Create Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    target_type text NOT NULL, -- 'all', 'department', 'personnel'
    target_id text,
    is_active boolean DEFAULT true,
    created_by text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Task Assignments table
CREATE TABLE IF NOT EXISTS public.task_assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
    personnel_id uuid REFERENCES public.personnel(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'Bekliyor', -- 'Bekliyor', 'Yapıldı', 'Yapılmadı'
    notes text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(task_id, personnel_id)
);

-- Set permissions for tasks and task_assignments
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to tasks" ON public.tasks FOR ALL USING (true);
CREATE POLICY "Allow authenticated full access to task_assignments" ON public.task_assignments FOR ALL USING (true);
