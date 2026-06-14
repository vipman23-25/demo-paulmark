CREATE TABLE public.sales_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE NOT NULL,
    target_month VARCHAR(7) NOT NULL,
    target_quota NUMERIC NOT NULL DEFAULT 0,
    realized_sales NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(personnel_id, target_month)
);

-- Satış hedefleri için Role-Based yetkiler
CREATE POLICY "Admins can manage sales targets" ON public.sales_targets
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Personnel can view own sales targets" ON public.sales_targets
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.personnel WHERE id = personnel_id AND user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
  );

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
