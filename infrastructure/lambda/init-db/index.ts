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
    CREATE TYPE pin_status AS ENUM ('lead', 'followup', 'installed', 'appointment', 'renter', 'not_interested');
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

-- Add 'renter' to pin_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'renter' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pin_status')
    ) THEN
        ALTER TYPE pin_status ADD VALUE 'renter';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add 'not_interested' to pin_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'not_interested' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pin_status')
    ) THEN
        ALTER TYPE pin_status ADD VALUE 'not_interested';
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

-- Training system tables
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

CREATE INDEX IF NOT EXISTS idx_training_progress_rep_id ON training_progress(rep_id);

-- Add training_completed column to reps if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reps' AND column_name = 'training_completed') THEN
        ALTER TABLE reps ADD COLUMN training_completed BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_training_progress_updated_at ON training_progress;
CREATE TRIGGER update_training_progress_updated_at BEFORE UPDATE ON training_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const pool = await getPool();

    // Run the schema
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
