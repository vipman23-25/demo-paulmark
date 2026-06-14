-- Create table for storing Web Push subscriptions

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(personnel_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow all personnel to insert their own subscriptions (or simplify for internal use)
CREATE POLICY "Allow personnel to insert subscriptions" ON public.push_subscriptions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow personnel to read their subscriptions" ON public.push_subscriptions
    FOR SELECT USING (true);

CREATE POLICY "Allow personnel to delete their subscriptions" ON public.push_subscriptions
    FOR DELETE USING (true);
