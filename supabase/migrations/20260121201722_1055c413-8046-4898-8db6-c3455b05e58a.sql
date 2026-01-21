
-- Create a safe server-side function to convert a rep pin into a deal
-- This avoids client-side multi-step writes and ensures consistent permission checks.
CREATE OR REPLACE FUNCTION public.create_deal_from_pin(
  _pin_id uuid,
  _homeowner_phone text DEFAULT NULL,
  _homeowner_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rep_id uuid;
  v_pin record;
  v_deal_id uuid;
BEGIN
  -- Ensure caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Ensure caller is a rep
  IF NOT public.has_role(auth.uid(), 'rep') THEN
    RAISE EXCEPTION 'not_a_rep';
  END IF;

  v_rep_id := public.get_rep_id();
  IF v_rep_id IS NULL THEN
    RAISE EXCEPTION 'rep_record_missing';
  END IF;

  -- Load pin (must belong to rep)
  SELECT * INTO v_pin
  FROM public.rep_pins
  WHERE id = _pin_id AND rep_id = v_rep_id
  LIMIT 1;

  IF v_pin.id IS NULL THEN
    RAISE EXCEPTION 'pin_not_found';
  END IF;

  IF v_pin.deal_id IS NOT NULL THEN
    RETURN v_pin.deal_id;
  END IF;

  -- Create deal
  INSERT INTO public.deals (
    homeowner_name,
    homeowner_phone,
    homeowner_email,
    address,
    notes,
    status
  ) VALUES (
    COALESCE(v_pin.homeowner_name, 'Unknown'),
    _homeowner_phone,
    _homeowner_email,
    COALESCE(v_pin.address, ''),
    v_pin.notes,
    'lead'
  )
  RETURNING id INTO v_deal_id;

  -- Link rep to deal
  INSERT INTO public.deal_commissions (
    deal_id,
    rep_id,
    commission_type,
    commission_percent,
    commission_amount
  ) VALUES (
    v_deal_id,
    v_rep_id,
    'self_gen',
    0,
    0
  );

  -- Mark pin converted
  UPDATE public.rep_pins
  SET deal_id = v_deal_id,
      updated_at = now()
  WHERE id = _pin_id;

  RETURN v_deal_id;
END;
$$;

-- Lock down execute privileges (optional but recommended)
REVOKE ALL ON FUNCTION public.create_deal_from_pin(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_deal_from_pin(uuid, text, text) TO authenticated;
