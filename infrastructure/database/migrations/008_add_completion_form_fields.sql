-- Migration: Add completion form signature and document fields
-- These fields support the final inspection statement workflow

-- Add completion form status to deal_status enum if not exists
DO $$ BEGIN
    -- First check if the values already exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completion_signed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')) THEN
        ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'completion_signed' AFTER 'installed';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'awaiting_approval' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')) THEN
        ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'awaiting_approval' AFTER 'adjuster_met';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'acv_collected' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')) THEN
        ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'acv_collected' AFTER 'approved';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'deductible_collected' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')) THEN
        ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'deductible_collected' AFTER 'acv_collected';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'materials_selected' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')) THEN
        ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'materials_selected' AFTER 'deductible_collected';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'paid' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')) THEN
        ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'paid' AFTER 'complete';
    END IF;
END $$;

-- Add completion form fields to deals table
ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS completion_form_url TEXT,
    ADD COLUMN IF NOT EXISTS completion_form_signature_url TEXT,
    ADD COLUMN IF NOT EXISTS homeowner_completion_signature_url TEXT,
    ADD COLUMN IF NOT EXISTS completion_signed_date TIMESTAMP WITH TIME ZONE;

-- Add workflow milestone timestamp fields if not already present
ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS awaiting_approval_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS acv_collected_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS deductible_collected_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS materials_selected_date TIMESTAMP WITH TIME ZONE;

-- Add commission payment tracking fields
ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS commission_paid BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS commission_paid_date TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN deals.completion_form_url IS 'Base64-encoded HTML document of the signed completion form';
COMMENT ON COLUMN deals.completion_form_signature_url IS 'URL to the rep signature image on completion form';
COMMENT ON COLUMN deals.homeowner_completion_signature_url IS 'URL to the homeowner signature image on completion form';
COMMENT ON COLUMN deals.completion_signed_date IS 'Date when both parties signed the completion form';

