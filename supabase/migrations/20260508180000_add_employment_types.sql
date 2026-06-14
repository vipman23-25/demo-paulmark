-- 1. Add employment type fields to personnel
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time';
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS total_contract_days INTEGER;

-- 2. Create public_holidays table
CREATE TABLE IF NOT EXISTS public.public_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

-- Policies for public_holidays
CREATE POLICY "Public holidays viewable by authenticated" ON public.public_holidays
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage public holidays" ON public.public_holidays
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Notify postgrest to reload schema cache
NOTIFY pgrst, 'reload schema';
