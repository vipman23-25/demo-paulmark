-- Performance Indexes (Created on 03.06.2026)

-- Break Records
CREATE INDEX IF NOT EXISTS idx_break_records_personnel_id ON public.break_records(personnel_id);
CREATE INDEX IF NOT EXISTS idx_break_records_start ON public.break_records(break_start);

-- Shift Schedules
CREATE INDEX IF NOT EXISTS idx_shift_schedules_week_start ON public.shift_schedules(week_start_date);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_personnel_id ON public.shift_schedules(personnel_id);

-- Cargo and Logistics
CREATE INDEX IF NOT EXISTS idx_cargo_shipments_arrival_date ON public.cargo_shipments(arrival_date);
CREATE INDEX IF NOT EXISTS idx_logistics_records_shipment_date ON public.logistics_records(shipment_date);

-- Personnel Related Tracking
CREATE INDEX IF NOT EXISTS idx_personnel_movements_personnel_id ON public.personnel_movements(personnel_id);
CREATE INDEX IF NOT EXISTS idx_overtime_records_personnel_id ON public.overtime_records(personnel_id);
CREATE INDEX IF NOT EXISTS idx_weekly_day_off_personnel_id ON public.weekly_day_off(personnel_id);
CREATE INDEX IF NOT EXISTS idx_reminders_personnel_id ON public.reminders(personnel_id);

-- Personnel table
CREATE INDEX IF NOT EXISTS idx_personnel_user_id ON public.personnel(user_id);
