import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { execute, query } from '../shared/database';
import {
  getUserFromEvent,
  isAdmin,
  success,
  forbidden,
  serverError,
} from '../shared/auth';

/**
 * Migration Lambda - Run database migrations
 * Only accessible by admins
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const user = getUserFromEvent(event);
  if (!user) {
    return forbidden('Authentication required');
  }

  if (!isAdmin(user)) {
    return forbidden('Only admins can run migrations');
  }

  try {
    const results: string[] = [];

    // ==========================================
    // DEALS TABLE UPDATES
    // ==========================================

    // Signature fields
    await safeAddColumn('deals', 'signature_url', 'TEXT', results);
    await safeAddColumn('deals', 'signature_date', 'TIMESTAMP WITH TIME ZONE', results);

    // Insurance agreement upload
    await safeAddColumn('deals', 'insurance_agreement_url', 'TEXT', results);

    // Date of loss field
    await safeAddColumn('deals', 'date_of_loss', 'DATE', results);

    // Date type field (loss or discovery)
    await safeAddColumn('deals', 'date_type', 'TEXT', results);

    // Adjuster not assigned flag
    await safeAddColumn('deals', 'adjuster_not_assigned', 'BOOLEAN', results);

    // Inspection photos
    await safeAddColumn('deals', 'inspection_images', 'TEXT[]', results);

    // Receipt URLs
    await safeAddColumn('deals', 'acv_receipt_url', 'TEXT', results);
    await safeAddColumn('deals', 'deductible_receipt_url', 'TEXT', results);
    await safeAddColumn('deals', 'depreciation_receipt_url', 'TEXT', results);

    // Milestone timestamps
    await safeAddColumn('deals', 'lead_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'inspection_scheduled_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'claim_filed_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'adjuster_met_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'approved_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'collect_acv_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'collect_deductible_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'install_scheduled_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'installed_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'invoice_sent_at', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'depreciation_collected_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'complete_date', 'TIMESTAMP WITH TIME ZONE', results);

    // ==========================================
    // REP_PINS TABLE UPDATES
    // ==========================================

    await safeAddColumn('rep_pins', 'inspection_images', 'TEXT[]', results);
    await safeAddColumn('rep_pins', 'image_url', 'TEXT', results);
    await safeAddColumn('rep_pins', 'utility_url', 'TEXT', results);
    await safeAddColumn('rep_pins', 'contract_url', 'TEXT', results);

    // ==========================================
    // COMMISSION OVERRIDE FIELDS (New)
    // ==========================================

    await safeAddColumn('deals', 'commission_override_amount', 'NUMERIC', results);
    await safeAddColumn('deals', 'commission_override_reason', 'TEXT', results);
    await safeAddColumn('deals', 'commission_override_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'commission_paid', 'BOOLEAN DEFAULT false', results);
    await safeAddColumn('deals', 'commission_paid_date', 'DATE', results);

    // ==========================================
    // CREW & ADDITIONAL FIELDS (New)
    // ==========================================

    await safeAddColumn('deals', 'adjuster_notes', 'TEXT', results);
    await safeAddColumn('deals', 'install_request_date', 'TIMESTAMP WITH TIME ZONE', results);
    await safeAddColumn('deals', 'install_request_notes', 'TEXT', results);
    await safeAddColumn('deals', 'sales_tax_rate', 'NUMERIC DEFAULT 8.25', results);
    await safeAddColumn('deals', 'roofing_system_type', 'TEXT', results);
    await safeAddColumn('deals', 'completion_form_url', 'TEXT', results);
    await safeAddColumn('deals', 'completion_form_signature_url', 'TEXT', results);
    await safeAddColumn('deals', 'completion_date', 'TIMESTAMP WITH TIME ZONE', results);

    // Add role_type column to profiles for crew support
    await safeAddColumn('profiles', 'role_type', 'TEXT', results);

    // ==========================================
    // ADD CREW ENUM VALUE
    // ==========================================

    try {
      const crewEnumCheck = await query(
        `SELECT 1 FROM pg_enum WHERE enumlabel = 'crew' AND enumtypid = 'app_role'::regtype`,
        []
      );
      if (crewEnumCheck.length === 0) {
        await execute(`ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'crew'`, []);
        results.push('Added enum value: crew to app_role');
      } else {
        results.push('Enum value crew already exists in app_role');
      }
    } catch (e: unknown) {
      const error = e as Error;
      results.push(`Enum crew in app_role: ${error.message}`);
    }

    // ==========================================
    // DEAL_DOCUMENTS TABLE
    // ==========================================

    try {
      await execute(`
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
        )
      `, []);
      results.push('Created table: deal_documents');
    } catch (e: unknown) {
      const error = e as Error;
      if (error.message?.includes('already exists')) {
        results.push('Table deal_documents already exists');
      } else {
        results.push(`Error creating deal_documents: ${error.message}`);
      }
    }

    // ==========================================
    // INDEXES
    // ==========================================

    await safeCreateIndex('idx_deal_documents_deal_id', 'deal_documents', 'deal_id', results);
    await safeCreateIndex('idx_deal_documents_type', 'deal_documents', 'document_type', results);
    await safeCreateIndex('idx_deals_status', 'deals', 'status', results);

    // ==========================================
    // ADD NEW ENUM VALUES (if needed)
    // ==========================================

    try {
      // Check if collect_acv exists
      const enumCheck = await query(
        `SELECT 1 FROM pg_enum WHERE enumlabel = 'collect_acv' AND enumtypid = 'deal_status'::regtype`,
        []
      );
      if (enumCheck.length === 0) {
        await execute(`ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'collect_acv' AFTER 'signed'`, []);
        results.push('Added enum value: collect_acv');
      } else {
        results.push('Enum value collect_acv already exists');
      }
    } catch (e: unknown) {
      const error = e as Error;
      results.push(`Enum collect_acv: ${error.message}`);
    }

    try {
      const enumCheck = await query(
        `SELECT 1 FROM pg_enum WHERE enumlabel = 'collect_deductible' AND enumtypid = 'deal_status'::regtype`,
        []
      );
      if (enumCheck.length === 0) {
        await execute(`ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'collect_deductible' AFTER 'collect_acv'`, []);
        results.push('Added enum value: collect_deductible');
      } else {
        results.push('Enum value collect_deductible already exists');
      }
    } catch (e: unknown) {
      const error = e as Error;
      results.push(`Enum collect_deductible: ${error.message}`);
    }

    return success({
      message: 'Migration completed',
      results,
    });

  } catch (error) {
    console.error('Migration error:', error);
    return serverError(error instanceof Error ? error.message : 'Migration failed');
  }
}

async function safeAddColumn(table: string, column: string, type: string, results: string[]) {
  try {
    await execute(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`, []);
    results.push(`Added column: ${table}.${column}`);
  } catch (e: unknown) {
    const error = e as Error;
    if (error.message?.includes('already exists')) {
      results.push(`Column ${table}.${column} already exists`);
    } else {
      results.push(`Error adding ${table}.${column}: ${error.message}`);
    }
  }
}

async function safeCreateIndex(name: string, table: string, column: string, results: string[]) {
  try {
    await execute(`CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${column})`, []);
    results.push(`Created index: ${name}`);
  } catch (e: unknown) {
    const error = e as Error;
    if (error.message?.includes('already exists')) {
      results.push(`Index ${name} already exists`);
    } else {
      results.push(`Error creating index ${name}: ${error.message}`);
    }
  }
}
