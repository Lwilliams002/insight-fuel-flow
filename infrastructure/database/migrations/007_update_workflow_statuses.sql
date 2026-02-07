-- Migration: Update workflow statuses to match owner's requirements
-- Date: 2026-02-05
-- Run this migration on your PostgreSQL database

-- New workflow based on owner's requirements:
-- 1. lead - Knock and set inspection
-- 2. inspection_scheduled - Inspected, take photos, show report
-- 3. claim_filed - File claim, get adjuster info
-- 4. signed - Sign agreement with homeowner
-- 5. adjuster_met - Meet adjuster at appointment
-- 6. awaiting_approval - Wait for insurance decision + admin approval
-- 7. approved - Insurance approved, admin reviewed financials
-- 8. acv_collected - Collected ACV payment from homeowner
-- 9. deductible_collected - Collected deductible from homeowner
-- 10. materials_selected - Picked materials and colors
-- 11. install_scheduled - Admin scheduled install
-- 12. installed - Crew completed installation
-- 13. completion_signed - Homeowner signed completion form
-- 14. invoice_sent - Final invoice sent to insurance
-- 15. depreciation_collected - Depreciation payment collected
-- 16. complete - Job complete, rep can request commission
-- 17. paid - Commission paid

-- =====================================================
-- STEP 1: Add new enum values to deal_status type
-- =====================================================
-- Note: ALTER TYPE ADD VALUE cannot be inside a transaction
-- Run each statement separately if you get transaction errors

ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'awaiting_approval';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'acv_collected';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'deductible_collected';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'materials_selected';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'completion_signed';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'paid';

-- =====================================================
-- STEP 2: Add new timestamp columns
-- =====================================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS materials_selected_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS completion_signed_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS awaiting_approval_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS acv_collected_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deductible_collected_date TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- STEP 3: Migrate old status values to new ones
-- =====================================================
-- Skip if you don't have deals with old status values

-- UPDATE deals SET status = 'acv_collected' WHERE status = 'collect_acv';
-- UPDATE deals SET status = 'deductible_collected' WHERE status = 'collect_deductible';

-- =====================================================
-- STEP 4: Add index for faster filtering
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

-- Log completion
SELECT 'Migration 007_update_workflow_statuses completed successfully' AS status;
