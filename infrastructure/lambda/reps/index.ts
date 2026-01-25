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
        return repId ? await getRep(repId, user) : await listReps(user);
      case 'POST':
        return await createRep(user, event);
      case 'PUT':
        return repId ? await updateRep(repId, user, event) : badRequest('Rep ID required');
      default:
        return badRequest(`Unsupported method: ${method}`);
    }
  } catch (error) {
    console.error('Error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

async function listReps(user: any) {
  // Admin can see all reps, rep can only see themselves
  if (!isAdmin(user)) {
    const rep = await queryOne(
      `SELECT r.*, p.full_name, p.email, p.avatar_url
       FROM reps r
       JOIN profiles p ON p.id = r.user_id
       WHERE r.user_id = $1`,
      [user.sub]
    );
    return success(rep ? [rep] : []);
  }

  const reps = await query(
    `SELECT r.*, p.full_name, p.email, p.avatar_url
     FROM reps r
     JOIN profiles p ON p.id = r.user_id
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

  const result = await queryOne(
    `INSERT INTO reps (user_id, commission_level, can_self_gen, manager_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      body.user_id,
      body.commission_level || 'junior',
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

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const allowedFields = ['commission_level', 'can_self_gen', 'manager_id', 'active'];

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
