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

  try {
    switch (method) {
      case 'GET':
        return dealId ? await getDeal(dealId, user) : await listDeals(user, event);
      case 'POST':
        return await createDeal(user, event);
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
    'homeowner_name', 'homeowner_phone', 'homeowner_email',
    'address', 'city', 'state', 'zip_code',
    'status', 'total_price', 'notes',
    'signed_date', 'install_date', 'completion_date',
    'contract_signed', 'permit_file_url',
    'install_images', 'completion_images', 'payment_requested',
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
