-- Tüm sistem development amaçlı RLS'ye kapatıldığı için sales_targets da aynı kapsama alınıyor.
ALTER TABLE public.sales_targets DISABLE ROW LEVEL SECURITY;
