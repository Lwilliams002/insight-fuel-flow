-- Add 'pending' status to deal_status enum
-- This represents when a rep has requested payment and admin hasn't approved yet
ALTER TYPE public.deal_status ADD VALUE 'pending' BEFORE 'paid';

-- Update RLS policies to fix admin visibility and rep payment request ability

-- Drop old policies that prevent admin from seeing all deals
DROP POLICY IF EXISTS "Reps can view their deals" ON public.deals;
DROP POLICY IF EXISTS "Reps can update their deals" ON public.deals;

-- Add new policies

-- Reps can view their own deals (including pending ones they requested payment on)
CREATE POLICY "Reps can view their deals" ON public.deals FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.deal_commissions dc
      WHERE dc.deal_id = deals.id AND dc.rep_id = get_rep_id()
    )
  );

-- Reps can update their deals (for payment requests and other updates)
CREATE POLICY "Reps can update their deals" ON public.deals FOR UPDATE
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.deal_commissions dc
      WHERE dc.deal_id = deals.id AND dc.rep_id = get_rep_id()
    )
  );
