-- Disable RLS for all tables to allow the custom Login and Mock user to work seamlessly during development

ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_day_off DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_records DISABLE ROW LEVEL SECURITY;
