import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query, queryOne, execute, withTransaction } from '../shared/database';
import {
  getUserFromEvent,
  isAdmin,
  success,
  created,
  badRequest,
  forbidden,
  notFound,
  serverError,
  parseBody,
} from '../shared/auth';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const user = getUserFromEvent(event);
  if (!user) {
    return forbidden('Authentication required');
  }

  const method = event.httpMethod;
  const dealId = event.pathParameters?.id;
  const path = event.resource || event.path || '';

  try {
    // Handle document routes
    if (path.includes('/documents')) {
      return await handleDocuments(dealId!, user, event);
    }

    switch (method) {
      case 'GET':
        return dealId ? await getDeal(dealId, user) : await listDeals(user, event);
      case 'POST': {
        // Check if this is a "create from pin" request
        const body = parseBody(event);
        if (body?.pin_id) {
          return await createDealFromPin(user, event);
        }
        return await createDeal(user, event);
      }
      case 'PUT':
        return dealId ? await updateDeal(dealId, user, event) : badRequest('Deal ID required');
      case 'DELETE':
        return dealId ? await deleteDeal(dealId, user) : badRequest('Deal ID required');
      default:
        return badRequest(`Unsupported method: ${method}`);
    }
  } catch (error) {
    console.error('Error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

async function getRepId(userId: string): Promise<string | null> {
  const rep = await queryOne<{ id: string }>(
    'SELECT id FROM reps WHERE user_id = $1',
    [userId]
  );
  return rep?.id || null;
}

async function listDeals(user: any, event: APIGatewayProxyEvent) {
  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  let sql = `
    SELECT d.*,
      json_agg(
        json_build_object(
          'id', dc.id,
          'commission_type', dc.commission_type,
          'commission_percent', dc.commission_percent,
          'commission_amount', dc.commission_amount,
          'paid', dc.paid,
          'rep_id', dc.rep_id,
          'rep_name', p.full_name
        )
      ) FILTER (WHERE dc.id IS NOT NULL) as deal_commissions
    FROM deals d
    LEFT JOIN deal_commissions dc ON dc.deal_id = d.id
    LEFT JOIN reps r ON r.id = dc.rep_id
    LEFT JOIN profiles p ON p.id = r.user_id
  `;

  const params: any[] = [];

  // Admin can see all deals, reps can only see their own
  if (!userIsAdmin && repId) {
    sql += ` WHERE EXISTS (
      SELECT 1 FROM deal_commissions dc2
      WHERE dc2.deal_id = d.id AND dc2.rep_id = $1
    )`;
    params.push(repId);
  }

  sql += ` GROUP BY d.id ORDER BY d.created_at DESC`;

  const deals = await query(sql, params);
  return success(deals);
}

async function getDeal(dealId: string, user: any) {
  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  const deal = await queryOne(
    `SELECT d.*,
      json_agg(
        json_build_object(
          'id', dc.id,
          'commission_type', dc.commission_type,
          'commission_percent', dc.commission_percent,
          'commission_amount', dc.commission_amount,
          'paid', dc.paid,
          'rep_id', dc.rep_id
        )
      ) FILTER (WHERE dc.id IS NOT NULL) as deal_commissions
    FROM deals d
    LEFT JOIN deal_commissions dc ON dc.deal_id = d.id
    WHERE d.id = $1
    GROUP BY d.id`,
    [dealId]
  );

  if (!deal) {
    return notFound('Deal not found');
  }

  // Check access
  if (!userIsAdmin) {
    const hasAccess = deal.deal_commissions?.some((dc: any) => dc.rep_id === repId);
    if (!hasAccess) {
      return forbidden('Access denied');
    }
  }

  return success(deal);
}

async function createDeal(user: any, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const repId = await getRepId(user.sub);
  if (!repId && !isAdmin(user)) {
    return forbidden('Only reps can create deals');
  }

  const result = await withTransaction(async (client) => {
    // Create the deal
    const dealResult = await client.query(
      `INSERT INTO deals (
        homeowner_name, homeowner_phone, homeowner_email,
        address, city, state, zip_code,
        status, total_price, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        body.homeowner_name,
        body.homeowner_phone,
        body.homeowner_email,
        body.address,
        body.city,
        body.state,
        body.zip_code,
        body.status || 'lead',
        body.total_price || 0,
        body.notes,
      ]
    );

    const deal = dealResult.rows[0];

    // Create commission record
    if (repId || body.rep_id) {
      await client.query(
        `INSERT INTO deal_commissions (
          deal_id, rep_id, commission_type, commission_percent, commission_amount
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          deal.id,
          body.rep_id || repId,
          body.commission_type || 'self_gen',
          body.commission_percent || 0,
          body.commission_amount || 0,
        ]
      );
    }

    return deal;
  });

  return created(result);
}

async function createDealFromPin(user: any, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const { pin_id } = body;
  if (!pin_id) {
    return badRequest('pin_id is required');
  }

  const repId = await getRepId(user.sub);
  if (!repId && !isAdmin(user)) {
    return forbidden('Only reps can create deals');
  }

  // Get the pin data
  const pin = await queryOne(
    `SELECT * FROM rep_pins WHERE id = $1`,
    [pin_id]
  );

  if (!pin) {
    return notFound('Pin not found');
  }

  // Check if user has access to this pin
  if (!isAdmin(user) && pin.rep_id !== repId && pin.assigned_closer_id !== repId) {
    return forbidden('Access denied');
  }

  // Check if pin already has a deal
  if (pin.deal_id) {
    return badRequest('This pin already has an associated deal');
  }

  const result = await withTransaction(async (client) => {
    // Create the deal from pin data, including inspection_images
    const dealResult = await client.query(
      `INSERT INTO deals (
        homeowner_name, homeowner_phone, homeowner_email,
        address, city, state, zip_code,
        status, total_price, notes, inspection_images
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        pin.homeowner_name || body.homeowner_name,
        pin.homeowner_phone || body.homeowner_phone,
        pin.homeowner_email || body.homeowner_email,
        pin.address || body.address,
        pin.city || body.city,
        pin.state || body.state,
        pin.zip_code || body.zip_code,
        body.status || 'lead',
        body.total_price || 0,
        pin.notes || body.notes,
        pin.inspection_images || null, // Transfer inspection photos from pin to deal
      ]
    );

    const deal = dealResult.rows[0];

    // Create commission record for the rep who owns the pin
    await client.query(
      `INSERT INTO deal_commissions (
        deal_id, rep_id, commission_type, commission_percent, commission_amount
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        deal.id,
        pin.rep_id,
        body.commission_type || 'self_gen',
        body.commission_percent || 0,
        body.commission_amount || 0,
      ]
    );

    // If there's an assigned closer, add them as well
    if (pin.assigned_closer_id && pin.assigned_closer_id !== pin.rep_id) {
      await client.query(
        `INSERT INTO deal_commissions (
          deal_id, rep_id, commission_type, commission_percent, commission_amount
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          deal.id,
          pin.assigned_closer_id,
          'closer',
          body.closer_commission_percent || 0,
          body.closer_commission_amount || 0,
        ]
      );
    }

    // Update the pin with the deal_id and change status to 'installed'
    await client.query(
      `UPDATE rep_pins SET deal_id = $1, status = 'installed', updated_at = NOW() WHERE id = $2`,
      [deal.id, pin_id]
    );

    return { deal, pin_id };
  });

  return created(result);
}

async function updateDeal(dealId: string, user: any, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  // Check access
  if (!userIsAdmin) {
    const hasAccess = await queryOne(
      `SELECT 1 FROM deal_commissions WHERE deal_id = $1 AND rep_id = $2`,
      [dealId, repId]
    );
    if (!hasAccess) {
      return forbidden('Access denied');
    }
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const allowedFields = [
    // Basic info
    'homeowner_name', 'homeowner_phone', 'homeowner_email',
    'address', 'city', 'state', 'zip_code',

    // Property details
    'roof_type', 'roof_squares', 'roof_squares_with_waste', 'stories', 'roofing_system_type',

    // Status & notes
    'status', 'total_price', 'notes',

    // Insurance info
    'insurance_company', 'policy_number', 'claim_number', 'date_of_loss', 'date_type', 'deductible',
    'inspection_date',
    'rcv', 'acv', 'depreciation', 'sales_tax',

    // Adjuster info
    'adjuster_name', 'adjuster_phone', 'adjuster_email', 'adjuster_meeting_date', 'adjuster_not_assigned',

    // Contract & signature
    'contract_signed', 'signed_date', 'agreement_document_url',
    'signature_url', 'signature_date',
    'insurance_agreement_url',

    // Payment tracking - SIGN phase
    'acv_check_collected', 'acv_check_amount', 'acv_check_date',

    // BUILD phase
    'materials_ordered_date', 'materials_delivered_date', 'install_date', 'install_time', 'crew_assignment', 'completion_date',

    // Documents & images
    'permit_file_url', 'lost_statement_url',
    'inspection_images', 'install_images', 'completion_images',

    // Receipts
    'acv_receipt_url', 'deductible_receipt_url', 'depreciation_receipt_url',

    // COLLECT phase
    'invoice_sent_date', 'invoice_amount',
    'depreciation_check_collected', 'depreciation_check_amount', 'depreciation_check_date',

    // Invoice fields
    'invoice_items', 'invoice_total', 'invoice_created_at', 'invoice_url',

    // Supplements
    'supplement_amount', 'supplement_approved', 'supplement_notes',

    // Totals
    'total_contract_value', 'payment_requested', 'payment_request_date',

    // Approval
    'approval_type',

    // Material specifications
    'material_category', 'material_type', 'material_color', 'drip_edge', 'vent_color',

    // Rep assignment
    'rep_id', 'rep_name',

    // Milestone timestamps
    'lead_date', 'inspection_scheduled_date', 'claim_filed_date',
    'adjuster_met_date', 'approved_date', 'collect_acv_date', 'collect_deductible_date',
    'install_scheduled_date', 'installed_date', 'invoice_sent_at', 'depreciation_collected_date',
    'depreciation_collected_date', 'complete_date', 'paid_date',

    // Workflow milestone timestamps
    'awaiting_approval_date', 'acv_collected_date', 'deductible_collected_date',
    'materials_selected_date', 'completion_signed_date',

    // Completion form
    'completion_form_url', 'completion_form_signature_url', 'homeowner_completion_signature_url',

    // Commission
    'commission_paid', 'commission_paid_date',
    'commission_override_amount', 'commission_override_reason', 'commission_override_date',

    // Adjuster notes
    'adjuster_notes',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      values.push(body[field]);
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    return badRequest('No fields to update');
  }

  updates.push(`updated_at = NOW()`);
  values.push(dealId);

  const result = await queryOne(
    `UPDATE deals SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return success(result);
}

async function deleteDeal(dealId: string, user: any) {
  if (!isAdmin(user)) {
    return forbidden('Only admins can delete deals');
  }

  await execute('DELETE FROM deals WHERE id = $1', [dealId]);
  return success({ message: 'Deal deleted' });
}

// Handle deal documents (list, add, delete)
async function handleDocuments(dealId: string, user: any, event: APIGatewayProxyEvent) {
  const method = event.httpMethod;
  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  // Verify access to the deal
  if (!userIsAdmin && repId) {
    const hasAccess = await queryOne(
      `SELECT 1 FROM deal_commissions WHERE deal_id = $1 AND rep_id = $2`,
      [dealId, repId]
    );
    if (!hasAccess) {
      return forbidden('Access denied');
    }
  }

  switch (method) {
    case 'GET':
      // List all documents for a deal
      const documents = await query(
        `SELECT * FROM deal_documents WHERE deal_id = $1 ORDER BY created_at DESC`,
        [dealId]
      );
      return success(documents);

    case 'POST': {
      // Add a new document
      const body = parseBody(event);
      if (!body) {
        return badRequest('Request body required');
      }

      const { document_type, file_name, file_url, file_type, file_size, description } = body;

      if (!document_type || !file_name || !file_url) {
        return badRequest('document_type, file_name, and file_url are required');
      }

      const result = await queryOne(
        `INSERT INTO deal_documents (
          deal_id, document_type, file_name, file_url, file_type, file_size, description, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [dealId, document_type, file_name, file_url, file_type, file_size, description, user.sub]
      );

      return created(result);
    }

    case 'DELETE': {
      // Delete a document
      const body = parseBody(event);
      const documentId = body?.document_id || event.queryStringParameters?.document_id;

      if (!documentId) {
        return badRequest('document_id is required');
      }

      // Only admins can delete documents
      if (!userIsAdmin) {
        return forbidden('Only admins can delete documents');
      }

      await execute('DELETE FROM deal_documents WHERE id = $1 AND deal_id = $2', [documentId, dealId]);
      return success({ message: 'Document deleted' });
    }

    default:
      return badRequest(`Unsupported method for documents: ${method}`);
  }
}
