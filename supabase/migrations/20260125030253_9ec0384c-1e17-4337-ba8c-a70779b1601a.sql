-- Add RLS policy for closers to view appointments assigned to them
CREATE POLICY "Closers can view assigned appointments"
ON public.rep_pins
FOR SELECT
USING (assigned_closer_id = get_rep_id());