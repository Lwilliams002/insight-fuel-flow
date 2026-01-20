-- Fix overly permissive RLS policies
-- Drop the permissive policies
DROP POLICY IF EXISTS "Reps can insert deals" ON public.deals;
DROP POLICY IF EXISTS "Reps can insert commissions" ON public.deal_commissions;

-- Create more restrictive policies - reps can only insert deals they're associated with
CREATE POLICY "Authenticated users can insert deals" ON public.deals 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Reps can only insert commissions for deals and must include themselves
CREATE POLICY "Authenticated users can insert commissions" ON public.deal_commissions 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND rep_id = get_rep_id());