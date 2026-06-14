
DROP POLICY IF EXISTS "Admins can manage public holidays" ON public.public_holidays;
CREATE POLICY "Admins can manage public holidays" ON public.public_holidays
  FOR ALL USING (true) WITH CHECK (true);
