-- Add deletion_status to logistics_records
ALTER TABLE public.logistics_records
ADD COLUMN IF NOT EXISTS deletion_status text NOT NULL DEFAULT 'none';
