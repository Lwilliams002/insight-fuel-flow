-- Create a function to handle new rep creation (called by admin via edge function)
-- First, let's add a trigger-based approach for the profile creation that already exists

-- Add policy allowing authenticated users to insert their own reps record
-- This is needed because when signUp happens, the new user needs to be able to have records created for them
CREATE POLICY "Service role can manage reps"
ON public.reps
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage user_roles"
ON public.user_roles
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');