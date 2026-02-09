-- Migration: Add commission override fields and crew role
-- Date: 2026-02-08

-- Add commission override fields to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_override_amount NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_override_reason TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_override_date TIMESTAMP WITH TIME ZONE;

-- Add commission paid tracking fields to deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_paid BOOLEAN DEFAULT false;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_paid_date DATE;

-- Update app_role enum to include crew role
-- Note: PostgreSQL doesn't allow direct alteration of enums, so we need to use a workaround
DO $$
BEGIN
    -- Check if 'crew' value already exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'crew' AND enumtypid = 'app_role'::regtype) THEN
        ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'crew';
    END IF;
END
$$;

-- Add crew-specific fields to profiles if needed
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_type TEXT; -- 'admin', 'rep', 'crew'

-- Add adjuster_notes field if not exists
ALTER TABLE deals ADD COLUMN IF NOT EXISTS adjuster_notes TEXT;

-- Add install request fields for admin dashboard
ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_request_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_request_notes TEXT;

-- Add utility_url to rep_pins for solar bill uploads
ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS utility_url TEXT;

-- Add contract_url to rep_pins
ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS contract_url TEXT;

-- Add image_url to rep_pins
ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add inspection_images to rep_pins for inspection photos
ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS inspection_images TEXT[];

-- Add sales_tax field to deals if not exists
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sales_tax_rate NUMERIC DEFAULT 8.25;

-- Add roofing_system_type to deals if not exists
ALTER TABLE deals ADD COLUMN IF NOT EXISTS roofing_system_type TEXT;

