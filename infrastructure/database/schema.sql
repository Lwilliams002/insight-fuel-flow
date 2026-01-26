-- AWS RDS PostgreSQL Schema for Insight Fuel Flow
-- Clean schema without Supabase-specific features

-- ==========================================
-- ENUMS
-- ==========================================

CREATE TYPE app_role AS ENUM ('admin', 'rep');

-- Deal status follows the Sign → Build → Collect workflow from training
-- SIGN phase: lead → inspection_scheduled → claim_filed → adjuster_scheduled → adjuster_met → approved → signed
-- BUILD phase: materials_ordered → materials_delivered → install_scheduled → installed
-- COLLECT phase: invoice_sent → depreciation_collected → complete
CREATE TYPE deal_status AS ENUM (
    -- SIGN PHASE
    'lead',                  -- Initial contact, not yet scheduled
    'inspection_scheduled',  -- Free inspection appointment set
    'claim_filed',           -- Homeowner filed claim with insurance
    'adjuster_scheduled',    -- Adjuster meeting scheduled
    'adjuster_met',          -- Met with adjuster, awaiting approval
    'approved',              -- Insurance approved the claim
    'signed',                -- Homeowner signed agreement, ACV check collected

    -- BUILD PHASE
    'materials_ordered',     -- Materials ordered
    'materials_delivered',   -- Materials delivered to property
    'install_scheduled',     -- Installation date set
    'installed',             -- Construction completed

    -- COLLECT PHASE
    'invoice_sent',          -- Invoice sent to insurance for depreciation
    'depreciation_collected', -- Depreciation check collected
    'complete',              -- Job complete, commissions paid

    -- Other
    'cancelled',             -- Deal cancelled/lost
    'on_hold'                -- Deal on hold for any reason
);

CREATE TYPE commission_type AS ENUM ('setter', 'closer', 'self_gen');
CREATE TYPE pin_status AS ENUM ('lead', 'followup', 'installed', 'appointment', 'renter', 'not_interested');
CREATE TYPE commission_level AS ENUM ('Apprentice', 'Journeyman', 'Master Roofer');

-- ==========================================
-- CORE TABLES
-- ==========================================

-- Profiles table (user information synced from Cognito)
CREATE TABLE profiles (
    id UUID PRIMARY KEY,  -- This will be the Cognito user sub
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- Reps table (sales representatives)
CREATE TABLE reps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    commission_level commission_level NOT NULL DEFAULT 'junior',
    default_commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    can_self_gen BOOLEAN NOT NULL DEFAULT true,
    manager_id UUID REFERENCES reps(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- DEALS (CRM)
-- ==========================================

-- Deals table for roofing jobs
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    -- Property info
    address TEXT NOT NULL,
    city TEXT,
    state TEXT,
    zip_code TEXT,

    -- Property details (from measuring training)
    roof_type TEXT,                    -- gable, hip, gambrel, flat
    roof_squares DECIMAL(10,2),        -- Actual squares
    roof_squares_with_waste DECIMAL(10,2), -- Squares + waste
    stories INTEGER DEFAULT 1,

    -- Homeowner info
    homeowner_name TEXT NOT NULL,
    homeowner_phone TEXT,
    homeowner_email TEXT,

    -- Deal info
    status deal_status NOT NULL DEFAULT 'lead',
    notes TEXT,

    -- SIGN PHASE - Insurance Info
    insurance_company TEXT,
    policy_number TEXT,
    claim_number TEXT,
    date_of_loss DATE,                 -- Storm date
    deductible NUMERIC,                -- Homeowner's deductible

    -- Inspection scheduling
    inspection_date TIMESTAMP WITH TIME ZONE,

    -- Insurance Financials (from training)
    rcv NUMERIC,                       -- Replacement Cost Value (total claim)
    acv NUMERIC,                       -- Actual Cash Value (1st check)
    depreciation NUMERIC,              -- Depreciation amount (held back)

    -- Adjuster Info
    adjuster_name TEXT,
    adjuster_phone TEXT,
    adjuster_email TEXT,
    adjuster_meeting_date TIMESTAMP WITH TIME ZONE,

    -- Contract & documents
    contract_signed BOOLEAN DEFAULT false,
    signed_date DATE,
    agreement_document_url TEXT,       -- Signed agreement file

    -- SIGN Phase Payments
    acv_check_collected BOOLEAN DEFAULT false,
    acv_check_amount NUMERIC,
    acv_check_date DATE,

    -- BUILD PHASE
    materials_ordered_date DATE,
    materials_delivered_date DATE,
    install_date DATE,
    completion_date DATE,

    -- BUILD Phase Documents
    permit_file_url TEXT,
    install_images TEXT[],
    completion_images TEXT[],

    -- COLLECT PHASE
    invoice_sent_date DATE,
    invoice_amount NUMERIC,
    depreciation_check_collected BOOLEAN DEFAULT false,
    depreciation_check_amount NUMERIC,
    depreciation_check_date DATE,

    -- Supplements (additional items approved)
    supplement_amount NUMERIC DEFAULT 0,
    supplement_approved BOOLEAN DEFAULT false,
    supplement_notes TEXT,

    -- Calculated totals
    total_contract_value NUMERIC NOT NULL DEFAULT 0,  -- RCV or total job cost

    -- Legacy fields for compatibility
    total_price NUMERIC NOT NULL DEFAULT 0,
    payment_requested BOOLEAN DEFAULT false
);

-- Deal commissions table
CREATE TABLE deal_commissions (
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

-- Deal photos table
CREATE TABLE deal_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    description TEXT,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- REP PINS (Map markers)
-- ==========================================

CREATE TABLE rep_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

    -- Location
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,

    -- Homeowner info
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    homeowner_name TEXT,
    homeowner_phone TEXT,
    homeowner_email TEXT,

    -- Status & tracking
    status pin_status NOT NULL DEFAULT 'lead',
    notes TEXT,

    -- Appointment
    appointment_date TIMESTAMP WITH TIME ZONE,
    appointment_end_date TIMESTAMP WITH TIME ZONE,
    appointment_all_day BOOLEAN DEFAULT false,
    assigned_closer_id UUID REFERENCES reps(id) ON DELETE SET NULL,

    -- Outcome tracking
    outcome TEXT,
    outcome_notes TEXT,
    follow_up_date DATE,

    -- Documents
    document_url TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pin documents table
CREATE TABLE pin_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_id UUID NOT NULL REFERENCES rep_pins(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- MERCHANTS (for commission tracking)
-- ==========================================

CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mid TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE merchant_assignments (
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

CREATE TABLE merchant_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    alias TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- IMPORTS & PAYOUTS
-- ==========================================

CREATE TABLE imports (
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

CREATE TABLE import_rows_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    merchant_identifier TEXT,
    profit DECIMAL(12,2),
    raw_data JSONB,
    matched_merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE payout_rows (
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

CREATE TABLE adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL,
    rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    note TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- INDEXES
-- ==========================================

-- Deals
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);

-- Deal commissions
CREATE INDEX idx_deal_commissions_deal_id ON deal_commissions(deal_id);
CREATE INDEX idx_deal_commissions_rep_id ON deal_commissions(rep_id);
CREATE INDEX idx_deal_commissions_paid ON deal_commissions(paid);

-- Rep pins
CREATE INDEX idx_rep_pins_rep_id ON rep_pins(rep_id);
CREATE INDEX idx_rep_pins_status ON rep_pins(status);
CREATE INDEX idx_rep_pins_location ON rep_pins(latitude, longitude);

-- Reps
CREATE INDEX idx_reps_user_id ON reps(user_id);
CREATE INDEX idx_reps_manager_id ON reps(manager_id);

-- Payouts
CREATE INDEX idx_payout_rows_rep_id ON payout_rows(rep_id);
CREATE INDEX idx_payout_rows_month ON payout_rows(month);

-- ==========================================
-- UPDATED_AT TRIGGER FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reps_updated_at BEFORE UPDATE ON reps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deal_commissions_updated_at BEFORE UPDATE ON deal_commissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rep_pins_updated_at BEFORE UPDATE ON rep_pins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_merchant_assignments_updated_at BEFORE UPDATE ON merchant_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_imports_updated_at BEFORE UPDATE ON imports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- DONE
-- ==========================================
