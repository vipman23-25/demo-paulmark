-- Disable RLS for public_holidays to fix insertion errors during development

ALTER TABLE public.public_holidays DISABLE ROW LEVEL SECURITY;
