import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPool } from '../shared/database';

const SCHEMA = `
-- AWS RDS PostgreSQL Schema for Insight Fuel Flow

-- ENUMS
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'rep');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE deal_status AS ENUM ('lead', 'signed', 'permit', 'install_scheduled', 'installed', 'complete', 'pending', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE commission_type AS ENUM ('setter', 'closer', 'self_gen');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pin_status AS ENUM ('lead', 'followup', 'installed', 'appointment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE commission_level AS ENUM ('junior', 'senior', 'manager');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- TABLES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS reps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    commission_level commission_level NOT NULL DEFAULT 'junior',
    default_commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    can_self_gen BOOLEAN NOT NULL DEFAULT true,
    manager_id UUID REFERENCES reps(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    training_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    address TEXT NOT NULL,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    homeowner_name TEXT NOT NULL,
    homeowner_phone TEXT,
    homeowner_email TEXT,
    total_price NUMERIC NOT NULL DEFAULT 0,
    status deal_status NOT NULL DEFAULT 'lead',
    notes TEXT,
    contract_signed BOOLEAN DEFAULT false,
    permit_file_url TEXT,
    install_images TEXT[],
    completion_images TEXT[],
    payment_requested BOOLEAN DEFAULT false,
    signed_date DATE,
    install_date DATE,
    completion_date DATE
);

CREATE TABLE IF NOT EXISTS deal_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    commission_type commission_type NOT NULL,
    commission_percent NUMERIC NOT NULL DEFAULT 0,
    commission_amount NUMERIC NOT NULL DEFAULT 0,
    paid BOOLEAN NOT NULL DEFAULT false,
    paid_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deal_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    description TEXT,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rep_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    homeowner_name TEXT,
    homeowner_phone TEXT,
    homeowner_email TEXT,
    status pin_status NOT NULL DEFAULT 'lead',
    notes TEXT,
    appointment_date TIMESTAMP WITH TIME ZONE,
    appointment_end_date TIMESTAMP WITH TIME ZONE,
    appointment_all_day BOOLEAN DEFAULT false,
    assigned_closer_id UUID REFERENCES reps(id) ON DELETE SET NULL,
    outcome TEXT,
    outcome_notes TEXT,
    follow_up_date DATE,
    document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pin_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_id UUID NOT NULL REFERENCES rep_pins(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mid TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchant_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    percent_override DECIMAL(5,2),
    effective_from DATE,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (merchant_id, rep_id)
);

CREATE TABLE IF NOT EXISTS merchant_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    alias TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'locked')),
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    row_count INTEGER DEFAULT 0,
    unmatched_count INTEGER DEFAULT 0,
    total_profit DECIMAL(12,2) DEFAULT 0,
    total_payouts DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_rows_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    merchant_identifier TEXT,
    profit DECIMAL(12,2),
    raw_data JSONB,
    matched_merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    profit DECIMAL(12,2) NOT NULL,
    percent_used DECIMAL(5,2) NOT NULL,
    payout_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    note TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,
    exam_score INTEGER,
    exam_passed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (rep_id, course_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_commissions_deal_id ON deal_commissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_commissions_rep_id ON deal_commissions(rep_id);
CREATE INDEX IF NOT EXISTS idx_deal_commissions_paid ON deal_commissions(paid);
CREATE INDEX IF NOT EXISTS idx_rep_pins_rep_id ON rep_pins(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_pins_status ON rep_pins(status);
CREATE INDEX IF NOT EXISTS idx_rep_pins_location ON rep_pins(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reps_user_id ON reps(user_id);
CREATE INDEX IF NOT EXISTS idx_reps_manager_id ON reps(manager_id);
CREATE INDEX IF NOT EXISTS idx_payout_rows_rep_id ON payout_rows(rep_id);
CREATE INDEX IF NOT EXISTS idx_payout_rows_month ON payout_rows(month);
CREATE INDEX IF NOT EXISTS idx_training_progress_rep_id ON training_progress(rep_id);

-- TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS (drop if exists to avoid duplicates)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reps_updated_at ON reps;
CREATE TRIGGER update_reps_updated_at BEFORE UPDATE ON reps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deal_commissions_updated_at ON deal_commissions;
CREATE TRIGGER update_deal_commissions_updated_at BEFORE UPDATE ON deal_commissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rep_pins_updated_at ON rep_pins;
CREATE TRIGGER update_rep_pins_updated_at BEFORE UPDATE ON rep_pins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchants_updated_at ON merchants;
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchant_assignments_updated_at ON merchant_assignments;
CREATE TRIGGER update_merchant_assignments_updated_at BEFORE UPDATE ON merchant_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_imports_updated_at ON imports;
CREATE TRIGGER update_imports_updated_at BEFORE UPDATE ON imports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrations for existing databases

-- Add 'appointment' to pin_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'appointment' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pin_status')
    ) THEN
        ALTER TYPE pin_status ADD VALUE 'appointment';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add deal_id column to rep_pins if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rep_pins' AND column_name = 'deal_id') THEN
        ALTER TABLE rep_pins ADD COLUMN deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add appointment_end_date column to rep_pins if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rep_pins' AND column_name = 'appointment_end_date') THEN
        ALTER TABLE rep_pins ADD COLUMN appointment_end_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add appointment_all_day column to rep_pins if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rep_pins' AND column_name = 'appointment_all_day') THEN
        ALTER TABLE rep_pins ADD COLUMN appointment_all_day BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create index for deal_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_rep_pins_deal_id ON rep_pins(deal_id);

-- Create index for appointment_date for calendar queries
CREATE INDEX IF NOT EXISTS idx_rep_pins_appointment_date ON rep_pins(appointment_date);

-- Create index for assigned_closer_id for closer calendar queries
CREATE INDEX IF NOT EXISTS idx_rep_pins_assigned_closer_id ON rep_pins(assigned_closer_id);

-- Add training_completed column to reps if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reps' AND column_name = 'training_completed') THEN
        ALTER TABLE reps ADD COLUMN training_completed BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add trigger for training_progress updated_at
DROP TRIGGER IF EXISTS update_training_progress_updated_at ON training_progress;
CREATE TRIGGER update_training_progress_updated_at BEFORE UPDATE ON training_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- MIGRATION: Add all new columns (2026-02)
-- ==========================================

-- Deals table new columns
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS signature_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS signature_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS insurance_agreement_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS inspection_images TEXT[]; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS acv_receipt_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS deductible_receipt_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation_receipt_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Insurance info columns
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS insurance_company TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS policy_number TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS claim_number TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS date_of_loss DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS deductible NUMERIC; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS rcv NUMERIC; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS acv NUMERIC; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation NUMERIC; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Property details
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS roof_type TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS roof_squares DECIMAL(10,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS roof_squares_with_waste DECIMAL(10,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS stories INTEGER DEFAULT 1; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Adjuster info
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS adjuster_name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS adjuster_phone TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS adjuster_email TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS adjuster_meeting_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Contract & payments
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS agreement_document_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS acv_check_collected BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS acv_check_amount NUMERIC; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS acv_check_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Build phase
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS materials_ordered_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS materials_delivered_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Collect phase
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_sent_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation_check_collected BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation_check_amount NUMERIC; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation_check_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Supplements
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS supplement_amount NUMERIC DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS supplement_approved BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS supplement_notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS total_contract_value NUMERIC DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Milestone timestamps
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS lead_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS inspection_scheduled_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS claim_filed_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS signed_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS adjuster_met_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS collect_acv_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS collect_deductible_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_scheduled_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS installed_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation_collected_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS complete_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Fix signed_date column type from DATE to TIMESTAMP WITH TIME ZONE if needed
DO $$
BEGIN
    -- Check if signed_date is DATE type and convert to TIMESTAMP
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'signed_date' AND data_type = 'date'
    ) THEN
        ALTER TABLE deals ALTER COLUMN signed_date TYPE TIMESTAMP WITH TIME ZONE USING signed_date::timestamp with time zone;
    END IF;
END $$;

-- Rep pins new columns
DO $$ BEGIN ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS inspection_images TEXT[]; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS image_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS utility_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE rep_pins ADD COLUMN IF NOT EXISTS contract_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Create deal_documents table if not exists
CREATE TABLE IF NOT EXISTS deal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    description TEXT,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deal_documents_deal_id ON deal_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_documents_type ON deal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

-- Add new enum values for deal_status
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'inspection_scheduled'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'claim_filed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'adjuster_scheduled'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'adjuster_met'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'approved'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'collect_acv'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'collect_deductible'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'materials_ordered'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'materials_delivered'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'invoice_sent'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'depreciation_collected'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'on_hold'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add new enum values for pin_status
DO $$ BEGIN ALTER TYPE pin_status ADD VALUE IF NOT EXISTS 'renter'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE pin_status ADD VALUE IF NOT EXISTS 'not_interested'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==========================================
-- MIGRATION: Update commission levels and sync (2026-02)
-- ==========================================

-- Update commission percentages based on level for existing reps
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

-- Invoice fields for deals
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_items TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_total DECIMAL(12,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_created_at TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Material specification fields for ACV receipt
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS material_category TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS material_type TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS material_color TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS drip_edge_color TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS drip_edge TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS vent_color TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Rep assignment fields (for reassign feature)
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS rep_id UUID; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS rep_name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Lost statement field (required for full approval)
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_statement_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Payment request fields
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_requested BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_request_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Approval type field
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS approval_type TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Sales tax field
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS sales_tax DECIMAL(12,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Install scheduling fields
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_scheduled_by UUID; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS install_time TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS crew_assignment TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Invoice and depreciation fields
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS invoice_sent_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS depreciation_collected_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Commission payment fields
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_paid BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS commission_paid_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS paid_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Completion form fields
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS completion_form_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS completion_form_signature_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS homeowner_completion_signature_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ==========================================
-- MIGRATION: Add new workflow status enum values (2026-02)
-- ==========================================

-- Add new deal_status enum values for updated workflow
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'awaiting_approval' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')
    ) THEN
        ALTER TYPE deal_status ADD VALUE 'awaiting_approval';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'acv_collected' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')
    ) THEN
        ALTER TYPE deal_status ADD VALUE 'acv_collected';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'deductible_collected' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')
    ) THEN
        ALTER TYPE deal_status ADD VALUE 'deductible_collected';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'materials_selected' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')
    ) THEN
        ALTER TYPE deal_status ADD VALUE 'materials_selected';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'completion_signed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deal_status')
    ) THEN
        ALTER TYPE deal_status ADD VALUE 'completion_signed';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add timestamp columns for new workflow statuses
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS awaiting_approval_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS acv_collected_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS deductible_collected_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS materials_selected_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE deals ADD COLUMN IF NOT EXISTS completion_signed_date TIMESTAMP WITH TIME ZONE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Calendar events table for server-side storage
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
`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const pool = await getPool();

    // Run enum additions first - these MUST run outside a transaction
    // ALTER TYPE ADD VALUE cannot be inside a transaction block in PostgreSQL
    const enumAdditions = [
      "ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'awaiting_approval'",
      "ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'acv_collected'",
      "ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'deductible_collected'",
      "ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'materials_selected'",
      "ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'completion_signed'",
      "ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'paid'",
      "ALTER TYPE pin_status ADD VALUE IF NOT EXISTS 'renter'",
      "ALTER TYPE pin_status ADD VALUE IF NOT EXISTS 'not_interested'",
    ];

    for (const sql of enumAdditions) {
      try {
        await pool.query(sql);
      } catch (e) {
        // Ignore errors - likely means value already exists
        console.log(`Enum addition skipped (may already exist): ${sql}`);
      }
    }

    // Run the main schema
    await pool.query(SCHEMA);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Database schema initialized successfully',
      }),
    };
  } catch (error) {
    console.error('Error initializing database:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}
