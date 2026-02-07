#!/bin/bash

# =====================================================
# Database Migration Script
# =====================================================
# This script helps you run the migration to add
# material specification fields to the deals table.
#
# OPTION 1: If you have psql installed locally
# ---------------------------------------------
# 1. First, get your RDS endpoint from AWS Console:
#    - Go to AWS Console → RDS → Databases
#    - Click on your database instance
#    - Copy the "Endpoint" (e.g., mydb.xxxxx.us-east-1.rds.amazonaws.com)
#
# 2. Get your database credentials from AWS Secrets Manager:
#    - Go to AWS Console → Secrets Manager
#    - Find your database secret
#    - Click "Retrieve secret value" to get username/password
#
# 3. Run this command (replace placeholders):
#    psql -h YOUR_RDS_ENDPOINT -U YOUR_USERNAME -d insightfuelflow -f infrastructure/database/migrations/006_add_material_specifications.sql
#
# OPTION 2: Run directly in AWS Console (RDS Query Editor)
# --------------------------------------------------------
# 1. Go to AWS Console → RDS → Query Editor
# 2. Connect to your database
# 3. Copy and paste the SQL below:

cat << 'EOF'

-- Migration: Add material specification fields to deals table
-- Run this SQL in your database

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

EOF

echo ""
echo "=====================================================
INSTRUCTIONS:
=====================================================

1. Go to AWS Console: https://console.aws.amazon.com/
2. Navigate to RDS → Query Editor (or use a PostgreSQL client)
3. Connect to your database
4. Copy the SQL statements above and run them

OR if you have psql installed:

psql -h YOUR_RDS_ENDPOINT -p 5432 -U YOUR_USERNAME -d insightfuelflow

Then paste the SQL statements.

After running the migration, redeploy your Lambda functions:
cd infrastructure && npm run cdk deploy InsightFuelFlow-Api-dev
"
