-- Create pin status enum
CREATE TYPE public.pin_status AS ENUM ('lead', 'followup', 'installed');

-- Create rep_pins table for map markers
CREATE TABLE public.rep_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_id UUID NOT NULL REFERENCES public.reps(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  status public.pin_status NOT NULL DEFAULT 'lead',
  address TEXT,
  homeowner_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rep_pins ENABLE ROW LEVEL SECURITY;

-- Reps can manage their own pins
CREATE POLICY "Reps can view own pins"
  ON public.rep_pins FOR SELECT
  USING (rep_id = get_rep_id());

CREATE POLICY "Reps can insert own pins"
  ON public.rep_pins FOR INSERT
  WITH CHECK (rep_id = get_rep_id());

CREATE POLICY "Reps can update own pins"
  ON public.rep_pins FOR UPDATE
  USING (rep_id = get_rep_id());

CREATE POLICY "Reps can delete own pins"
  ON public.rep_pins FOR DELETE
  USING (rep_id = get_rep_id());

-- Admins can view all pins
CREATE POLICY "Admins can manage all pins"
  ON public.rep_pins FOR ALL
  USING (is_admin());

-- Add updated_at trigger
CREATE TRIGGER update_rep_pins_updated_at
  BEFORE UPDATE ON public.rep_pins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster rep queries
CREATE INDEX idx_rep_pins_rep_id ON public.rep_pins(rep_id);
CREATE INDEX idx_rep_pins_status ON public.rep_pins(status);