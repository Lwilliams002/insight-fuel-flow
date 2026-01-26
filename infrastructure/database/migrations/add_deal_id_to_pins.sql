-- Migration: Add deal_id column to rep_pins table
-- This links pins to deals when a pin is converted to a deal

ALTER TABLE rep_pins
ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rep_pins_deal_id ON rep_pins(deal_id);
