
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Personnel table (managed by admin)
CREATE TABLE public.personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    tc_no TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    password_hash TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage personnel" ON public.personnel
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Personnel can view own record" ON public.personnel
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Weekly day off selections
CREATE TABLE public.weekly_day_off (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(personnel_id, day_of_week)
);
ALTER TABLE public.weekly_day_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage day off" ON public.weekly_day_off
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Personnel can manage own day off" ON public.weekly_day_off
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.personnel WHERE id = personnel_id AND user_id = auth.uid())
  );

-- Break records
CREATE TABLE public.break_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE NOT NULL,
    break_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    break_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.break_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all breaks" ON public.break_records
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Personnel can manage own breaks" ON public.break_records
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.personnel WHERE id = personnel_id AND user_id = auth.uid())
  );

-- Personnel movements
CREATE TABLE public.personnel_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE NOT NULL,
    movement_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.personnel_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage movements" ON public.personnel_movements
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Personnel can view own movements" ON public.personnel_movements
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.personnel WHERE id = personnel_id AND user_id = auth.uid())
  );

-- Movement types (configurable by admin)
CREATE TABLE public.movement_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.movement_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view movement types" ON public.movement_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage movement types" ON public.movement_types
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default movement types
INSERT INTO public.movement_types (name) VALUES 
  ('İşe Girdi'), ('Yıllık İzinli'), ('Ücretsiz İzin'), ('Raporlu'), ('Mazeret İzni');

-- Reminders
CREATE TABLE public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reminder_datetime TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reminders" ON public.reminders
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Overtime records
CREATE TABLE public.overtime_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE NOT NULL,
    record_date DATE NOT NULL,
    hours NUMERIC(5,2) NOT NULL,
    record_type TEXT NOT NULL CHECK (record_type IN ('overtime', 'credit')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.overtime_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage overtime" ON public.overtime_records
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Personnel can view own overtime" ON public.overtime_records
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.personnel WHERE id = personnel_id AND user_id = auth.uid())
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personnel_updated_at BEFORE UPDATE ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
