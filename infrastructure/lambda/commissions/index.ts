import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query, queryOne, execute } from '../shared/database';
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
  const commissionId = event.pathParameters?.id;

  try {
    switch (method) {
      case 'GET':
        return await listCommissions(user, event);
      case 'POST':
        return await createCommission(user, event);
      case 'PUT':
        return commissionId
          ? await updateCommission(commissionId, user, event)
          : badRequest('Commission ID required');
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

async function listCommissions(user: any, event: APIGatewayProxyEvent) {
  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  // Parse query params for filtering
  const status = event.queryStringParameters?.status;
  const dealId = event.queryStringParameters?.deal_id;

  let sql = `
    SELECT dc.*, d.homeowner_name, d.address, d.status as deal_status,
           d.total_price, p.full_name as rep_name
    FROM deal_commissions dc
    JOIN deals d ON d.id = dc.deal_id
    LEFT JOIN reps r ON r.id = dc.rep_id
    LEFT JOIN profiles p ON p.id = r.user_id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  // Reps can only see their own commissions
  if (!userIsAdmin && repId) {
    sql += ` AND dc.rep_id = $${paramIndex}`;
    params.push(repId);
    paramIndex++;
  }

  // Filter by paid status
  if (status === 'paid') {
    sql += ` AND dc.paid = true`;
  } else if (status === 'unpaid') {
    sql += ` AND dc.paid = false`;
  } else if (status === 'pending') {
    sql += ` AND d.status = 'pending'`;
  }

  // Filter by deal
  if (dealId) {
    sql += ` AND dc.deal_id = $${paramIndex}`;
    params.push(dealId);
    paramIndex++;
  }

  sql += ` ORDER BY dc.created_at DESC`;

  const commissions = await query(sql, params);
  return success(commissions);
}

async function createCommission(user: any, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  // Only admins or the deal owner can add commissions
  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  if (!userIsAdmin && !repId) {
    return forbidden('Access denied');
  }

  // If not admin, verify user has access to the deal
  if (!userIsAdmin) {
    const hasAccess = await queryOne(
      `SELECT 1 FROM deal_commissions WHERE deal_id = $1 AND rep_id = $2`,
      [body.deal_id, repId]
    );
    if (!hasAccess) {
      return forbidden('Access denied to this deal');
    }
  }

  const result = await queryOne(
    `INSERT INTO deal_commissions (
      deal_id, rep_id, commission_type, commission_percent, commission_amount
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      body.deal_id,
      body.rep_id,
      body.commission_type || 'self_gen',
      body.commission_percent || 0,
      body.commission_amount || 0,
    ]
  );

  return created(result);
}

async function updateCommission(commissionId: string, user: any, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  // Get the commission to check access
  const commission = await queryOne(
    `SELECT * FROM deal_commissions WHERE id = $1`,
    [commissionId]
  );

  if (!commission) {
    return notFound('Commission not found');
  }

  // Reps can only update their own commissions (limited fields)
  if (!userIsAdmin && commission.rep_id !== repId) {
    return forbidden('Access denied');
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Admin can update all fields, rep can only request payment
  const allowedFields = userIsAdmin
    ? ['commission_type', 'commission_percent', 'commission_amount', 'paid']
    : []; // Reps update via deal status, not directly

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
  values.push(commissionId);

  const result = await queryOne(
    `UPDATE deal_commissions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  // If marking as paid, also update the deal status
  if (body.paid === true && userIsAdmin) {
    await execute(
      `UPDATE deals SET status = 'paid', updated_at = NOW() WHERE id = $1`,
      [commission.deal_id]
    );
  }

  return success(result);
}
