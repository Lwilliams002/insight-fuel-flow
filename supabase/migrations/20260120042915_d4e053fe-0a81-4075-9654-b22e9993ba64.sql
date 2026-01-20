-- Create deal status enum
CREATE TYPE public.deal_status AS ENUM ('lead', 'signed', 'permit', 'install_scheduled', 'installed', 'complete', 'paid', 'cancelled');

-- Create commission type enum  
CREATE TYPE public.commission_type AS ENUM ('setter', 'closer', 'self_gen');

-- Create deals table for roofing jobs
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Property info
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  -- Homeowner info
  homeowner_name TEXT NOT NULL,
  homeowner_phone TEXT,
  homeowner_email TEXT,
  
  -- Deal info
  total_price NUMERIC NOT NULL DEFAULT 0,
  status deal_status NOT NULL DEFAULT 'lead',
  notes TEXT,
  
  -- Dates
  signed_date DATE,
  install_date DATE,
  completion_date DATE
);

-- Create deal_commissions table for tracking who gets paid what
CREATE TABLE public.deal_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL REFERENCES public.reps(id) ON DELETE CASCADE,
  commission_type commission_type NOT NULL,
  commission_percent NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deal_photos table for before/after photos and documents
CREATE TABLE public.deal_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT, -- 'photo', 'contract', 'permit', 'other'
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_photos ENABLE ROW LEVEL SECURITY;

-- Deals policies
CREATE POLICY "Admins can manage deals" ON public.deals FOR ALL USING (is_admin());
CREATE POLICY "Reps can view their deals" ON public.deals FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.deal_commissions dc 
    WHERE dc.deal_id = deals.id AND dc.rep_id = get_rep_id()
  ));
CREATE POLICY "Reps can insert deals" ON public.deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Reps can update their deals" ON public.deals FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.deal_commissions dc 
    WHERE dc.deal_id = deals.id AND dc.rep_id = get_rep_id()
  ));

-- Deal commissions policies
CREATE POLICY "Admins can manage deal_commissions" ON public.deal_commissions FOR ALL USING (is_admin());
CREATE POLICY "Reps can view own commissions" ON public.deal_commissions FOR SELECT 
  USING (rep_id = get_rep_id());
CREATE POLICY "Reps can insert commissions" ON public.deal_commissions FOR INSERT WITH CHECK (true);

-- Deal photos policies
CREATE POLICY "Admins can manage deal_photos" ON public.deal_photos FOR ALL USING (is_admin());
CREATE POLICY "Reps can view photos of their deals" ON public.deal_photos FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.deal_commissions dc 
    WHERE dc.deal_id = deal_photos.deal_id AND dc.rep_id = get_rep_id()
  ));
CREATE POLICY "Reps can upload photos" ON public.deal_photos FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Update triggers
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deal_commissions_updated_at
  BEFORE UPDATE ON public.deal_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for deal photos
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-photos', 'deal-photos', true);

-- Storage policies for deal photos
CREATE POLICY "Anyone can view deal photos" ON storage.objects FOR SELECT USING (bucket_id = 'deal-photos');
CREATE POLICY "Authenticated users can upload deal photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'deal-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own photos" ON storage.objects FOR UPDATE USING (bucket_id = 'deal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own photos" ON storage.objects FOR DELETE USING (bucket_id = 'deal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);