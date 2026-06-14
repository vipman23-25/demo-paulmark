ALTER TABLE shift_schedules 
ADD COLUMN IF NOT EXISTS task_assignment TEXT;
