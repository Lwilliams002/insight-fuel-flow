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
  const repId = event.pathParameters?.id;

  try {
    switch (method) {
      case 'GET':
        return repId ? await getRep(repId, user) : await listReps(user, event);
      case 'POST':
        return await createRep(user, event);
      case 'PUT':
        return repId ? await updateRep(repId, user, event) : badRequest('Rep ID required');
      case 'DELETE':
        return repId ? await deleteRep(repId, user) : badRequest('Rep ID required');
      default:
        return badRequest(`Unsupported method: ${method}`);
    }
  } catch (error) {
    console.error('Error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

async function listReps(user: any, event: APIGatewayProxyEvent) {
  // Check if requesting closers for assignment
  const queryParams = event.queryStringParameters || {};
  const forAssignment = queryParams.for_assignment === 'true';
  const accountType = queryParams.account_type; // 'admin', 'rep', or 'crew'

  console.log('[listReps] Query params:', JSON.stringify(queryParams));
  console.log('[listReps] accountType:', accountType);

  // If requesting closers for assignment, return senior and manager level reps
  if (forAssignment) {
    const closers = await query(
      `SELECT r.*, p.full_name, p.email, p.avatar_url, ur.role as account_type
       FROM reps r
       JOIN profiles p ON p.id = r.user_id
       LEFT JOIN user_roles ur ON ur.user_id = r.user_id
       WHERE r.commission_level IN ('senior', 'manager')
       AND r.active = true
       ORDER BY p.full_name`
    );
    return success(closers);
  }

  // Admin can see all users, rep can only see themselves
  if (!isAdmin(user)) {
    const rep = await queryOne(
      `SELECT r.*, p.full_name, p.email, p.avatar_url, ur.role as account_type
       FROM reps r
       JOIN profiles p ON p.id = r.user_id
       LEFT JOIN user_roles ur ON ur.user_id = r.user_id
       WHERE r.user_id = $1`,
      [user.sub]
    );
    return success(rep ? [rep] : []);
  }

  // For admins: filter by account_type
  if (accountType === 'admin') {
    console.log('[listReps] Fetching admins...');
    // Get admins from profiles/user_roles (not in reps table)
    const admins = await query(
      `SELECT p.id as user_id, p.id, p.full_name, p.email, p.avatar_url, 
              ur.role as account_type, true as active,
              'manager' as commission_level, 0 as default_commission_percent,
              false as can_self_gen, null as manager_id, false as training_completed,
              p.created_at
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id
       WHERE ur.role = 'admin'
       ORDER BY p.full_name`
    );
    console.log('[listReps] Found admins:', admins.length);
    return success(admins);
  }

  if (accountType === 'crew') {
    console.log('[listReps] Fetching crew leads...');
    // Get crew leads from profiles/user_roles (not in reps table)
    const crewLeads = await query(
      `SELECT p.id as user_id, p.id, p.full_name, p.email, p.avatar_url,
              ur.role as account_type, true as active,
              'junior' as commission_level, 0 as default_commission_percent,
              false as can_self_gen, null as manager_id, false as training_completed,
              p.created_at
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id
       WHERE ur.role = 'crew'
       ORDER BY p.full_name`
    );
    console.log('[listReps] Found crew leads:', crewLeads.length);
    return success(crewLeads);
  }

  if (accountType === 'rep') {
    console.log('[listReps] Fetching reps...');
    // Get only sales reps (users with 'rep' role in user_roles who are in reps table)
    const reps = await query(
      `SELECT r.*, p.full_name, p.email, p.avatar_url, 'rep' as account_type
       FROM reps r
       JOIN profiles p ON p.id = r.user_id
       JOIN user_roles ur ON ur.user_id = r.user_id
       WHERE ur.role = 'rep'
       ORDER BY p.full_name`
    );
    console.log('[listReps] Found reps:', reps.length);
    return success(reps);
  }

  // Default (no filter): return all reps from the reps table
  // This is for backwards compatibility
  console.log('[listReps] No accountType specified, returning all reps...');
  const reps = await query(
    `SELECT r.*, p.full_name, p.email, p.avatar_url, COALESCE(ur.role, 'rep') as account_type
     FROM reps r
     JOIN profiles p ON p.id = r.user_id
     LEFT JOIN user_roles ur ON ur.user_id = r.user_id
     ORDER BY p.full_name`
  );

  return success(reps);
}

async function getRep(repId: string, user: any) {
  const rep = await queryOne(
    `SELECT r.*, p.full_name, p.email, p.avatar_url
     FROM reps r
     JOIN profiles p ON p.id = r.user_id
     WHERE r.id = $1`,
    [repId]
  );

  if (!rep) {
    return notFound('Rep not found');
  }

  // Non-admins can only see their own profile
  if (!isAdmin(user) && rep.user_id !== user.sub) {
    return forbidden('Access denied');
  }

  return success(rep);
}

async function createRep(user: any, event: APIGatewayProxyEvent) {
  if (!isAdmin(user)) {
    return forbidden('Only admins can create reps');
  }

  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  // Commission level percentages
  const commissionLevelPercentages: Record<string, number> = {
    'junior': 5,
    'senior': 10,
    'manager': 13,
  };

  const commissionLevel = body.commission_level || 'junior';
  const defaultCommissionPercent = body.default_commission_percent || commissionLevelPercentages[commissionLevel] || 5;

  const result = await queryOne(
    `INSERT INTO reps (user_id, commission_level, default_commission_percent, can_self_gen, manager_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      body.user_id,
      commissionLevel,
      defaultCommissionPercent,
      body.can_self_gen ?? true,
      body.manager_id,
    ]
  );

  return created(result);
}

async function updateRep(repId: string, user: any, event: APIGatewayProxyEvent) {
  if (!isAdmin(user)) {
    return forbidden('Only admins can update reps');
  }

  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  // Commission level percentages
  const commissionLevelPercentages: Record<string, number> = {
    'junior': 5,
    'senior': 10,
    'manager': 13,
  };

  // If commission_level is being updated, also update default_commission_percent
  if (body.commission_level && !body.default_commission_percent) {
    body.default_commission_percent = commissionLevelPercentages[body.commission_level] || 5;
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const allowedFields = ['commission_level', 'default_commission_percent', 'can_self_gen', 'manager_id', 'active'];

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
  values.push(repId);

  const result = await queryOne(
    `UPDATE reps SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return success(result);
}

async function deleteRep(repId: string, user: any) {
  if (!isAdmin(user)) {
    return forbidden('Only admins can delete reps');
  }

  // Check if rep exists
  const rep = await queryOne('SELECT * FROM reps WHERE id = $1', [repId]);
  if (!rep) {
    return notFound('Rep not found');
  }

  // Delete the rep (cascade will handle related records based on DB constraints)
  await execute('DELETE FROM reps WHERE id = $1', [repId]);

  return success({ message: 'Rep deleted successfully' });
}

