-- Migration: Add date_type and adjuster_not_assigned columns to deals table
-- Run this migration manually if the columns don't exist

-- Add date_type column (stores 'loss' or 'discovery')
ALTER TABLE deals ADD COLUMN IF NOT EXISTS date_type TEXT;

-- Add adjuster_not_assigned column (boolean flag)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS adjuster_not_assigned BOOLEAN DEFAULT false;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'deals'
AND column_name IN ('date_type', 'adjuster_not_assigned');

