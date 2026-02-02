-- Migration: Update commission levels and sync all fields
-- Date: 2026-02-01
-- This migration updates the commission level system and ensures all tables are in sync

-- ==========================================
-- COMMISSION LEVEL UPDATES
-- ==========================================

-- Update the commission_level enum to use the new values (junior, senior, manager)
-- Note: PostgreSQL doesn't allow easy modification of enums, so we handle this carefully

-- First, alter the reps table to use TEXT temporarily if the enum is the old one
-- Check if the column is using the old enum values

-- Drop the old enum constraint if it exists and use TEXT
ALTER TABLE reps ALTER COLUMN commission_level TYPE TEXT;

-- Update any old values to new format
UPDATE reps SET commission_level = 'junior' WHERE commission_level IN ('Apprentice', 'apprentice', 'Junior');
UPDATE reps SET commission_level = 'senior' WHERE commission_level IN ('Journeyman', 'journeyman', 'Senior');
UPDATE reps SET commission_level = 'manager' WHERE commission_level IN ('Master Roofer', 'master_roofer', 'Manager');

-- Set default for new reps
ALTER TABLE reps ALTER COLUMN commission_level SET DEFAULT 'junior';

-- ==========================================
-- UPDATE DEFAULT_COMMISSION_PERCENT FOR EXISTING REPS
-- ==========================================

-- Update commission percentages based on level
UPDATE reps
SET default_commission_percent = 5
WHERE commission_level = 'junior'
AND (default_commission_percent IS NULL OR default_commission_percent = 10.00);

UPDATE reps
SET default_commission_percent = 10
WHERE commission_level = 'senior'
AND (default_commission_percent IS NULL OR default_commission_percent = 10.00);

UPDATE reps
SET default_commission_percent = 13
WHERE commission_level = 'manager'
AND (default_commission_percent IS NULL OR default_commission_percent = 10.00);

-- Ensure default_commission_percent has a value for all reps
UPDATE reps
SET default_commission_percent = 5
WHERE default_commission_percent IS NULL;

-- ==========================================
-- ENSURE TRAINING_COMPLETED COLUMN EXISTS
-- ==========================================

ALTER TABLE reps ADD COLUMN IF NOT EXISTS training_completed BOOLEAN DEFAULT false;

-- ==========================================
-- DEAL STATUS - Add missing signed_date timestamp
-- ==========================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS signed_date TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- INVOICE FIELDS
-- ==========================================

-- Invoice data for deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_items TEXT; -- JSON string of invoice line items
ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_total DECIMAL(12,2);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_url TEXT;

-- ==========================================
-- MATERIAL SPECIFICATION FIELDS
-- ==========================================

-- Material details for deals (shown on ACV receipt)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS material_category TEXT; -- 'single', 'metal', 'architectural', 'architectural_metal'
ALTER TABLE deals ADD COLUMN IF NOT EXISTS material_type TEXT; -- Required for metal materials
ALTER TABLE deals ADD COLUMN IF NOT EXISTS material_color TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS drip_edge_color TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS vent_color TEXT;

-- ==========================================
-- LOST STATEMENT FIELD
-- ==========================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_statement_url TEXT;

-- ==========================================
-- PAYMENT REQUEST FIELDS
-- ==========================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_requested BOOLEAN DEFAULT false;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_request_date TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- APPROVAL TYPE FIELD
-- ==========================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS approval_type TEXT; -- 'full', 'partial', 'sale'

-- ==========================================
-- SALES TAX FIELD
-- ==========================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS sales_tax DECIMAL(12,2);

-- ==========================================
-- DEAL COMMISSIONS - Ensure table exists with correct structure
-- ==========================================

CREATE TABLE IF NOT EXISTS deal_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    commission_type TEXT NOT NULL, -- 'setter', 'closer', 'self_gen', 'junior', 'senior', 'manager'
    commission_percent DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(12,2),
    paid BOOLEAN DEFAULT false,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for faster commission lookups
CREATE INDEX IF NOT EXISTS idx_deal_commissions_deal_id ON deal_commissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_commissions_rep_id ON deal_commissions(rep_id);

-- ==========================================
-- INSTALL DATE FIELD (set by admin)
-- ==========================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_date DATE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_scheduled_by UUID REFERENCES profiles(id);

-- ==========================================
-- COMPLETION PHOTOS
-- ==========================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS completion_images TEXT[];
ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_images TEXT[];

-- ==========================================
-- UPDATE TIMESTAMPS
-- ==========================================

-- Create or replace function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_deals_updated_at') THEN
        CREATE TRIGGER update_deals_updated_at
            BEFORE UPDATE ON deals
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_reps_updated_at') THEN
        CREATE TRIGGER update_reps_updated_at
            BEFORE UPDATE ON reps
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ==========================================
-- CALENDAR EVENTS TABLE (optional, for server-side storage)
-- ==========================================

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT,
    event_date DATE NOT NULL,
    event_time TIME,
    event_end_time TIME,
    all_day BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_rep_id ON calendar_events(rep_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);

-- ==========================================
-- SUMMARY
-- ==========================================

-- This migration:
-- 1. Updates commission levels from old enum to new (junior, senior, manager)
-- 2. Sets correct commission percentages (junior=5%, senior=10%, manager=13%)
-- 3. Adds invoice fields for deal invoicing
-- 4. Adds material specification fields for ACV receipt
-- 5. Adds lost statement URL field (required for full approval)
-- 6. Adds payment request tracking fields
-- 7. Adds approval type field
-- 8. Creates deal_commissions table if not exists
-- 9. Adds install scheduling fields
-- 10. Adds completion/install photo arrays
-- 11. Creates calendar_events table for server-side event storage
