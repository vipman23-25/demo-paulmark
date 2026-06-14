-- Drop existing policies
DROP POLICY IF EXISTS "Public holidays viewable by authenticated" ON public.public_holidays;
DROP POLICY IF EXISTS "Admins can manage public holidays" ON public.public_holidays;

-- Recreate policies with proper WITH CHECK clause for INSERTs
CREATE POLICY "Public holidays viewable by authenticated" ON public.public_holidays
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage public holidays" ON public.public_holidays
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
