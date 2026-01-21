
-- Add deal_id column to rep_pins to track pins converted to deals
ALTER TABLE public.rep_pins 
ADD COLUMN deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_rep_pins_deal_id ON public.rep_pins(deal_id);
