#!/bin/bash

# Data Migration Script: Supabase to AWS RDS
# This script exports data from Supabase and imports it to AWS RDS

set -e

echo "=========================================="
echo "Supabase to AWS RDS Migration Script"
echo "=========================================="

# Configuration - Update these values
SUPABASE_HOST="${SUPABASE_HOST:-db.your-project.supabase.co}"
SUPABASE_DB="${SUPABASE_DB:-postgres}"
SUPABASE_USER="${SUPABASE_USER:-postgres}"
SUPABASE_PASSWORD="${SUPABASE_PASSWORD:-}"

RDS_HOST="${RDS_HOST:-your-rds-endpoint.rds.amazonaws.com}"
RDS_DB="${RDS_DB:-insightfuelflow}"
RDS_USER="${RDS_USER:-postgres}"
RDS_PASSWORD="${RDS_PASSWORD:-}"

BACKUP_DIR="./migration_backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/supabase_backup_${TIMESTAMP}.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo ""
echo "Step 1: Exporting data from Supabase..."
echo "----------------------------------------"

# Export from Supabase (schema + data)
PGPASSWORD="$SUPABASE_PASSWORD" pg_dump \
  -h "$SUPABASE_HOST" \
  -U "$SUPABASE_USER" \
  -d "$SUPABASE_DB" \
  --no-owner \
  --no-acl \
  --schema=public \
  --exclude-table-data='auth.*' \
  --exclude-table-data='storage.*' \
  --exclude-table-data='supabase_functions.*' \
  -f "$BACKUP_FILE"

echo "✅ Backup saved to: $BACKUP_FILE"

echo ""
echo "Step 2: Cleaning up Supabase-specific elements..."
echo "-------------------------------------------------"

# Create a cleaned version for RDS
CLEANED_FILE="${BACKUP_DIR}/rds_import_${TIMESTAMP}.sql"

# Remove Supabase-specific extensions and functions
sed -e 's/SECURITY DEFINER//g' \
    -e '/^CREATE EXTENSION/d' \
    -e '/auth\./d' \
    -e '/storage\./d' \
    -e '/supabase_/d' \
    "$BACKUP_FILE" > "$CLEANED_FILE"

echo "✅ Cleaned file saved to: $CLEANED_FILE"

echo ""
echo "Step 3: Importing data to AWS RDS..."
echo "------------------------------------"

# Import to RDS
PGPASSWORD="$RDS_PASSWORD" psql \
  -h "$RDS_HOST" \
  -U "$RDS_USER" \
  -d "$RDS_DB" \
  -f "$CLEANED_FILE"

echo "✅ Data imported to RDS"

echo ""
echo "Step 4: Verifying migration..."
echo "------------------------------"

# Count records in key tables
echo "Record counts in RDS:"
for table in profiles user_roles reps deals deal_commissions rep_pins merchants; do
  count=$(PGPASSWORD="$RDS_PASSWORD" psql \
    -h "$RDS_HOST" \
    -U "$RDS_USER" \
    -d "$RDS_DB" \
    -t -c "SELECT COUNT(*) FROM public.$table" 2>/dev/null || echo "0")
  echo "  $table: $count"
done

echo ""
echo "=========================================="
echo "Migration Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify data integrity in RDS"
echo "2. Update frontend environment variables"
echo "3. Test authentication with Cognito"
echo "4. Switch DNS/traffic to new infrastructure"
echo ""
