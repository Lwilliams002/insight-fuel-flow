-- Create commission_level enum
CREATE TYPE public.commission_level AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond');

-- Create commission_levels lookup table with percentages for each level
CREATE TABLE public.commission_levels (
  level commission_level PRIMARY KEY,
  display_name TEXT NOT NULL,
  commission_percent NUMERIC(5,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default commission levels
INSERT INTO public.commission_levels (level, display_name, commission_percent, description) VALUES
  ('bronze', 'Bronze', 5.00, 'Entry level - new reps'),
  ('silver', 'Silver', 10.00, 'Standard commission tier'),
  ('gold', 'Gold', 15.00, 'Experienced reps'),
  ('platinum', 'Platinum', 20.00, 'Top performers'),
  ('diamond', 'Diamond', 25.00, 'Elite tier - highest performers');

-- Enable RLS on commission_levels
ALTER TABLE public.commission_levels ENABLE ROW LEVEL SECURITY;

-- Everyone can view commission levels
CREATE POLICY "Anyone can view commission levels" 
ON public.commission_levels 
FOR SELECT 
USING (true);

-- Only admins can manage commission levels
CREATE POLICY "Admins can manage commission levels" 
ON public.commission_levels 
FOR ALL 
USING (is_admin());

-- Add commission_level column to reps table
ALTER TABLE public.reps ADD COLUMN commission_level commission_level NOT NULL DEFAULT 'silver';

-- Add commission_level column to merchant_assignments for override
ALTER TABLE public.merchant_assignments ADD COLUMN level_override commission_level;

-- Update the default_commission_percent column to be nullable (kept for backwards compatibility during transition)
-- We'll keep the old column but it will no longer be the primary source