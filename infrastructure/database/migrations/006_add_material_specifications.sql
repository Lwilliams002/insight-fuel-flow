-- Migration: Add material specification fields to deals table
-- Date: 2026-02-05

-- Add material specification columns to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS material_category TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS material_type TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS material_color TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS drip_edge TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS vent_color TEXT;

-- Add signature_url column for storing signature image
ALTER TABLE deals ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Add lost_statement_url column for insurance lost statement document
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_statement_url TEXT;

-- Add insurance_agreement_url column for uploaded insurance agreement
ALTER TABLE deals ADD COLUMN IF NOT EXISTS insurance_agreement_url TEXT;

-- Add receipt URL columns
ALTER TABLE deals ADD COLUMN IF NOT EXISTS acv_receipt_url TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deductible_receipt_url TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation_receipt_url TEXT;

-- Add invoice URL column
ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_url TEXT;

-- Add invoice work items (JSON string)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_work_items TEXT;

-- Add approval type and date columns
ALTER TABLE deals ADD COLUMN IF NOT EXISTS approval_type TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP WITH TIME ZONE;

-- Add sales tax column
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sales_tax NUMERIC;

-- Add rep_id and rep_name for direct rep reference
ALTER TABLE deals ADD COLUMN IF NOT EXISTS rep_id UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS rep_name TEXT;

-- Add inspection_images column if it doesn't exist
ALTER TABLE deals ADD COLUMN IF NOT EXISTS inspection_images TEXT[];

-- Add install scheduling columns
ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_time TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS crew_assignment TEXT;

-- Comment on new columns
COMMENT ON COLUMN deals.material_category IS 'Roofing material category (e.g., Shingle, Metal, Architectural Metal)';
COMMENT ON COLUMN deals.material_type IS 'Specific material type within category';
COMMENT ON COLUMN deals.material_color IS 'Color of the roofing material';
COMMENT ON COLUMN deals.drip_edge IS 'Drip edge color/type';
COMMENT ON COLUMN deals.vent_color IS 'Vent color';
COMMENT ON COLUMN deals.signature_url IS 'URL to homeowner signature image';
COMMENT ON COLUMN deals.lost_statement_url IS 'URL to insurance lost statement document';
COMMENT ON COLUMN deals.insurance_agreement_url IS 'URL to uploaded insurance agreement';
COMMENT ON COLUMN deals.acv_receipt_url IS 'URL to ACV payment receipt';
COMMENT ON COLUMN deals.deductible_receipt_url IS 'URL to deductible payment receipt';
COMMENT ON COLUMN deals.depreciation_receipt_url IS 'URL to depreciation payment receipt';
COMMENT ON COLUMN deals.approval_type IS 'Type of insurance approval (full, partial, supplement_needed, sale)';
COMMENT ON COLUMN deals.approved_date IS 'Date when deal was approved by admin';
