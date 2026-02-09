-- Migration: Add new deal fields for merchant requested changes
-- Date: 2026-02-08

-- Add roofing_system_type to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS roofing_system_type TEXT;

-- Add adjuster_notes to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS adjuster_notes TEXT;

-- Add sales_tax if it doesn't exist (for commission calculations)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sales_tax NUMERIC;

-- Add deductible_skipped flag (for optional deductible collection)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deductible_skipped BOOLEAN DEFAULT false;

-- Add inspection_photos_skipped flag (for optional inspection photo skip)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS inspection_photos_skipped BOOLEAN DEFAULT false;

-- Add coaching_logs table for rep profile
CREATE TABLE IF NOT EXISTS coaching_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    notes TEXT,
    goals TEXT,
    action_items TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster coaching log queries
CREATE INDEX IF NOT EXISTS idx_coaching_logs_rep_id ON coaching_logs(rep_id);
CREATE INDEX IF NOT EXISTS idx_coaching_logs_session_date ON coaching_logs(session_date);

-- Add crew role support to profiles (for future crew implementation)
-- The role column already exists, just ensure 'crew' is a valid value
-- This is handled by the application layer, not a constraint

COMMENT ON COLUMN deals.roofing_system_type IS 'Type of roofing system (e.g., Asphalt Shingles, Metal, Tile)';
COMMENT ON COLUMN deals.adjuster_notes IS 'Notes about the adjuster or meeting';
COMMENT ON COLUMN deals.sales_tax IS 'Sales tax amount for commission calculations';

