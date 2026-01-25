-- Fix admin visibility for deals
-- This migration ensures admins can see ALL deals regardless of rep assignment

-- First, drop ALL existing policies on deals to start fresh
DROP POLICY IF EXISTS "Admins can manage deals" ON public.deals;
DROP POLICY IF EXISTS "Reps can view their deals" ON public.deals;
DROP POLICY IF EXISTS "Reps can insert deals" ON public.deals;
DROP POLICY IF EXISTS "Reps can update their deals" ON public.deals;

-- Create admin policy for full access to all deals
-- This uses FOR ALL which covers SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "Admins can manage all deals" ON public.deals
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Create separate policies for reps
-- Reps can only view deals they have a commission on
CREATE POLICY "Reps can view own deals" ON public.deals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.deal_commissions dc
    WHERE dc.deal_id = deals.id AND dc.rep_id = get_rep_id()
  )
);

-- Reps can insert new deals
CREATE POLICY "Reps can create deals" ON public.deals
FOR INSERT
WITH CHECK (true);

-- Reps can update their own deals
CREATE POLICY "Reps can update own deals" ON public.deals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.deal_commissions dc
    WHERE dc.deal_id = deals.id AND dc.rep_id = get_rep_id()
  )
);

-- Also fix deal_commissions visibility so admin can see all commissions
DROP POLICY IF EXISTS "Admins can manage deal_commissions" ON public.deal_commissions;
DROP POLICY IF EXISTS "Reps can view own commissions" ON public.deal_commissions;
DROP POLICY IF EXISTS "Reps can insert commissions" ON public.deal_commissions;

-- Admin can manage all deal commissions
CREATE POLICY "Admins can manage all deal_commissions" ON public.deal_commissions
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Reps can view their own commissions
CREATE POLICY "Reps can view their commissions" ON public.deal_commissions
FOR SELECT
USING (rep_id = get_rep_id());

-- Reps can insert commissions (for new deals)
CREATE POLICY "Reps can create commissions" ON public.deal_commissions
FOR INSERT
WITH CHECK (true);

-- Reps can update their own commissions (for payment requests)
CREATE POLICY "Reps can update their commissions" ON public.deal_commissions
FOR UPDATE
USING (rep_id = get_rep_id());
