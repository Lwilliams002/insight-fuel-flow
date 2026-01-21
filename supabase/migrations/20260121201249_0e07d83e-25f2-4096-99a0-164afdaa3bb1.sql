
-- Add policy for reps to insert deals
CREATE POLICY "Reps can insert deals"
ON public.deals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reps WHERE user_id = auth.uid()
  )
);
