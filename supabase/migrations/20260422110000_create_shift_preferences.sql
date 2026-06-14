-- Create shift_preferences table
CREATE TABLE IF NOT EXISTS public.shift_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1: Monday, 7: Sunday
    requested_shift TEXT NOT NULL CHECK (requested_shift IN ('sabah', 'aksam')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_personnel_preference UNIQUE(personnel_id) -- Only 1 active request per personnel
);

-- Grant permissions for frontend API
GRANT ALL ON TABLE public.shift_preferences TO anon, authenticated;
