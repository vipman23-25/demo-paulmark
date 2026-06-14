-- Disable RLS for system_settings to prevent password change blocks in dev

ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
