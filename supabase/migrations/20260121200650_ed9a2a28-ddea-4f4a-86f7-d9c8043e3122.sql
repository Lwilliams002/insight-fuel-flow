
-- Create a security definer function to check if an address already has a pin (across all reps)
CREATE OR REPLACE FUNCTION public.check_address_exists(check_address text)
RETURNS TABLE(exists_already boolean, owner_rep_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    true as exists_already,
    rep_id as owner_rep_id
  FROM public.rep_pins
  WHERE LOWER(TRIM(address)) = LOWER(TRIM(check_address))
  LIMIT 1
$$;
