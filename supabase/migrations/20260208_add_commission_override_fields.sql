-- Add commission override fields to deals table
-- These fields allow admins to manually adjust commission amounts

ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_override_amount NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_override_reason TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_override_date TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN deals.commission_override_amount IS 'Admin-overridden commission amount';
COMMENT ON COLUMN deals.commission_override_reason IS 'Reason for commission override';
COMMENT ON COLUMN deals.commission_override_date IS 'Date when commission was overridden';

