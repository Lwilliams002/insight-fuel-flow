-- Migration: Add all missing fields to deals and pins tables
-- Date: 2026-02-01
-- This migration brings the database in sync with the frontend Deal interface

-- ==========================================
-- DEALS TABLE UPDATES
-- ==========================================

-- Signature fields
ALTER TABLE deals ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS signature_date TIMESTAMP WITH TIME ZONE;

-- Insurance agreement upload
ALTER TABLE deals ADD COLUMN IF NOT EXISTS insurance_agreement_url TEXT;

-- Inspection photos (transferred from pin when converted)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS inspection_images TEXT[];

-- Receipt URLs
ALTER TABLE deals ADD COLUMN IF NOT EXISTS acv_receipt_url TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deductible_receipt_url TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation_receipt_url TEXT;

-- Milestone timestamps (for tracking when each milestone was reached)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lead_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS inspection_scheduled_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS claim_filed_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS adjuster_met_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS collect_acv_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS collect_deductible_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_scheduled_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS installed_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation_collected_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS complete_date TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- REP_PINS TABLE UPDATES
-- ==========================================

-- Inspection photos for pins (before conversion to deal)
ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS inspection_images TEXT[];

-- Additional document URLs
ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS utility_url TEXT;
ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS contract_url TEXT;

-- ==========================================
-- DEAL STATUS ENUM UPDATES
-- ==========================================

-- Add new statuses if they don't exist
DO $$
BEGIN
    -- Check if 'collect_acv' exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'collect_acv'
        AND enumtypid = 'deal_status'::regtype
    ) THEN
        ALTER TYPE deal_status ADD VALUE 'collect_acv' AFTER 'signed';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'collect_deductible'
        AND enumtypid = 'deal_status'::regtype
    ) THEN
        ALTER TYPE deal_status ADD VALUE 'collect_deductible' AFTER 'collect_acv';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================
-- DEAL DOCUMENTS TABLE (for tracking all uploaded documents)
-- ==========================================

CREATE TABLE IF NOT EXISTS deal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'insurance_agreement', 'permit', 'receipt_acv', 'receipt_deductible', 'receipt_depreciation', 'contract', 'other'
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT, -- MIME type
    file_size INTEGER,
    description TEXT,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for faster document lookups
CREATE INDEX IF NOT EXISTS idx_deal_documents_deal_id ON deal_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_documents_type ON deal_documents(document_type);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_deals_inspection_images ON deals USING GIN (inspection_images);
CREATE INDEX IF NOT EXISTS idx_deals_install_images ON deals USING GIN (install_images);
CREATE INDEX IF NOT EXISTS idx_deals_completion_images ON deals USING GIN (completion_images);
CREATE INDEX IF NOT EXISTS idx_rep_pins_inspection_images ON rep_pins USING GIN (inspection_images);

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON COLUMN deals.signature_url IS 'URL to homeowner signature image';
COMMENT ON COLUMN deals.signature_date IS 'Date/time signature was captured';
COMMENT ON COLUMN deals.insurance_agreement_url IS 'Uploaded insurance agreement document URL';
COMMENT ON COLUMN deals.inspection_images IS 'Array of inspection photo URLs (transferred from pin when converted)';
COMMENT ON COLUMN deals.acv_receipt_url IS 'ACV payment receipt URL';
COMMENT ON COLUMN deals.deductible_receipt_url IS 'Deductible payment receipt URL';
COMMENT ON COLUMN deals.depreciation_receipt_url IS 'Depreciation payment receipt URL';
COMMENT ON COLUMN rep_pins.inspection_images IS 'Array of inspection photo URLs (uploaded during pin creation)';
COMMENT ON TABLE deal_documents IS 'Stores all documents uploaded for a deal';

