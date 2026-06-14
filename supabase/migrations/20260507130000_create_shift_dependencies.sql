CREATE TABLE IF NOT EXISTS shift_dependency_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    target_department TEXT NOT NULL,
    trigger_absence_count INT DEFAULT 1,
    trigger_shift_type TEXT DEFAULT 'S',
    action_shift_type TEXT DEFAULT 'A',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS'yi kapatıp herkesin (adminlerin) erişebilmesini sağlayalım
ALTER TABLE shift_dependency_rules DISABLE ROW LEVEL SECURITY;
