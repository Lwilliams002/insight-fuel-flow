-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'rep');

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reps table (extends user profile for rep-specific data)
CREATE TABLE public.reps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    default_commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create merchants table
CREATE TABLE public.merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mid TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create merchant_assignments table
CREATE TABLE public.merchant_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
    rep_id UUID REFERENCES public.reps(id) ON DELETE CASCADE NOT NULL,
    percent_override DECIMAL(5,2),
    effective_from DATE,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (merchant_id, rep_id)
);

-- Create imports table
CREATE TABLE public.imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'locked')),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    row_count INTEGER DEFAULT 0,
    unmatched_count INTEGER DEFAULT 0,
    total_profit DECIMAL(12,2) DEFAULT 0,
    total_payouts DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create import_rows_raw table
CREATE TABLE public.import_rows_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES public.imports(id) ON DELETE CASCADE NOT NULL,
    merchant_identifier TEXT,
    profit DECIMAL(12,2),
    raw_data JSONB,
    matched_merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create merchant_aliases for fuzzy matching
CREATE TABLE public.merchant_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
    alias TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (alias)
);

-- Create payout_rows table
CREATE TABLE public.payout_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES public.imports(id) ON DELETE CASCADE NOT NULL,
    month TEXT NOT NULL,
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
    rep_id UUID REFERENCES public.reps(id) ON DELETE CASCADE NOT NULL,
    profit DECIMAL(12,2) NOT NULL,
    percent_used DECIMAL(5,2) NOT NULL,
    payout_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create adjustments table
CREATE TABLE public.adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,
    rep_id UUID REFERENCES public.reps(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    note TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user has a role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Create function to get rep_id for current user
CREATE OR REPLACE FUNCTION public.get_rep_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.reps WHERE user_id = auth.uid()
$$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reps_updated_at BEFORE UPDATE ON public.reps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_merchant_assignments_updated_at BEFORE UPDATE ON public.merchant_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_imports_updated_at BEFORE UPDATE ON public.imports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for user_roles (admin only)
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.is_admin());
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- RLS Policies for reps
CREATE POLICY "Admins can manage reps" ON public.reps FOR ALL USING (public.is_admin());
CREATE POLICY "Reps can view own record" ON public.reps FOR SELECT USING (user_id = auth.uid());

-- RLS Policies for merchants
CREATE POLICY "Admins can manage merchants" ON public.merchants FOR ALL USING (public.is_admin());
CREATE POLICY "Reps can view assigned merchants" ON public.merchants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.merchant_assignments ma 
    WHERE ma.merchant_id = id AND ma.rep_id = public.get_rep_id()
  )
);

-- RLS Policies for merchant_assignments
CREATE POLICY "Admins can manage assignments" ON public.merchant_assignments FOR ALL USING (public.is_admin());
CREATE POLICY "Reps can view own assignments" ON public.merchant_assignments FOR SELECT USING (rep_id = public.get_rep_id());

-- RLS Policies for imports
CREATE POLICY "Admins can manage imports" ON public.imports FOR ALL USING (public.is_admin());
CREATE POLICY "Reps can view imports" ON public.imports FOR SELECT USING (public.has_role(auth.uid(), 'rep'));

-- RLS Policies for import_rows_raw (admin only for raw data)
CREATE POLICY "Admins can manage raw import rows" ON public.import_rows_raw FOR ALL USING (public.is_admin());

-- RLS Policies for merchant_aliases
CREATE POLICY "Admins can manage aliases" ON public.merchant_aliases FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can view aliases" ON public.merchant_aliases FOR SELECT USING (true);

-- RLS Policies for payout_rows
CREATE POLICY "Admins can manage payouts" ON public.payout_rows FOR ALL USING (public.is_admin());
CREATE POLICY "Reps can view own payouts" ON public.payout_rows FOR SELECT USING (rep_id = public.get_rep_id());

-- RLS Policies for adjustments
CREATE POLICY "Admins can manage adjustments" ON public.adjustments FOR ALL USING (public.is_admin());
CREATE POLICY "Reps can view own adjustments" ON public.adjustments FOR SELECT USING (rep_id = public.get_rep_id());

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_reps_user_id ON public.reps(user_id);
CREATE INDEX idx_merchant_assignments_rep_id ON public.merchant_assignments(rep_id);
CREATE INDEX idx_merchant_assignments_merchant_id ON public.merchant_assignments(merchant_id);
CREATE INDEX idx_payout_rows_rep_id ON public.payout_rows(rep_id);
CREATE INDEX idx_payout_rows_month ON public.payout_rows(month);
CREATE INDEX idx_payout_rows_merchant_id ON public.payout_rows(merchant_id);
CREATE INDEX idx_imports_month ON public.imports(month);
CREATE INDEX idx_import_rows_raw_import_id ON public.import_rows_raw(import_id);
CREATE INDEX idx_adjustments_rep_id ON public.adjustments(rep_id);
CREATE INDEX idx_adjustments_month ON public.adjustments(month);

-- Create a function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();