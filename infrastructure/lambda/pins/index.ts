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
  const pinId = event.pathParameters?.id;

  try {
    switch (method) {
      case 'GET':
        return pinId ? await getPin(pinId, user) : await listPins(user, event);
      case 'POST':
        return await createPin(user, event);
      case 'PUT':
        return pinId ? await updatePin(pinId, user, event) : badRequest('Pin ID required');
      case 'DELETE':
        return pinId ? await deletePin(pinId, user) : badRequest('Pin ID required');
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

async function listPins(user: any, event: APIGatewayProxyEvent) {
  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  let sql = `
    SELECT rp.*, 
           rp.latitude as lat, 
           rp.longitude as lng,
           p.full_name as rep_name,
           cp.full_name as closer_name
    FROM rep_pins rp
    LEFT JOIN reps r ON r.id = rp.rep_id
    LEFT JOIN profiles p ON p.id = r.user_id
    LEFT JOIN reps cr ON cr.id = rp.assigned_closer_id
    LEFT JOIN profiles cp ON cp.id = cr.user_id
  `;

  const params: any[] = [];

  // Reps can only see their own pins and pins assigned to them as closer
  if (!userIsAdmin && repId) {
    sql += ` WHERE rp.rep_id = $1 OR rp.assigned_closer_id = $1`;
    params.push(repId);
  }

  sql += ` ORDER BY rp.created_at DESC`;

  const pins = await query(sql, params);
  return success(pins);
}

async function getPin(pinId: string, user: any) {
  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  const pin = await queryOne(
    `SELECT rp.*, 
            rp.latitude as lat, 
            rp.longitude as lng,
            p.full_name as rep_name,
            cp.full_name as closer_name
     FROM rep_pins rp
     LEFT JOIN reps r ON r.id = rp.rep_id
     LEFT JOIN profiles p ON p.id = r.user_id
     LEFT JOIN reps cr ON cr.id = rp.assigned_closer_id
     LEFT JOIN profiles cp ON cp.id = cr.user_id
     WHERE rp.id = $1`,
    [pinId]
  );

  if (!pin) {
    return notFound('Pin not found');
  }

  // Check access
  if (!userIsAdmin && pin.rep_id !== repId && pin.assigned_closer_id !== repId) {
    return forbidden('Access denied');
  }

  return success(pin);
}

async function createPin(user: any, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const repId = await getRepId(user.sub);
  if (!repId && !isAdmin(user)) {
    return forbidden('Only reps can create pins');
  }

  const result = await queryOne(
    `INSERT INTO rep_pins (
      rep_id, homeowner_name, homeowner_phone, homeowner_email,
      address, city, state, zip_code,
      latitude, longitude, status, notes,
      appointment_date, appointment_end_date, appointment_all_day,
      assigned_closer_id, document_url, utility_url, contract_url, image_url, inspection_images
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    RETURNING *`,
    [
      body.rep_id || repId,
      body.homeowner_name,
      body.homeowner_phone,
      body.homeowner_email,
      body.address,
      body.city,
      body.state,
      body.zip_code,
      body.lat || body.latitude,
      body.lng || body.longitude,
      body.status || 'lead',
      body.notes,
      body.appointment_date,
      body.appointment_end_date,
      body.appointment_all_day || false,
      body.assigned_closer_id,
      body.document_url,
      body.utility_url,
      body.contract_url,
      body.image_url,
      body.inspection_images,
    ]
  );

  return created(result);
}

async function updatePin(pinId: string, user: any, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  // Check access
  if (!userIsAdmin) {
    const pin = await queryOne(
      `SELECT rep_id, assigned_closer_id FROM rep_pins WHERE id = $1`,
      [pinId]
    );
    if (!pin || (pin.rep_id !== repId && pin.assigned_closer_id !== repId)) {
      return forbidden('Access denied');
    }
  }

  // Build update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const allowedFields = [
    'homeowner_name', 'homeowner_phone', 'homeowner_email',
    'address', 'city', 'state', 'zip_code',
    'latitude', 'longitude', 'status', 'notes',
    'appointment_date', 'appointment_end_date', 'appointment_all_day',
    'document_url', 'assigned_closer_id',
    'outcome', 'outcome_notes', 'follow_up_date',
    'image_url', 'utility_url', 'contract_url',
    'inspection_images',
  ];

  // Map lat/lng to latitude/longitude if provided
  if (body.lat !== undefined && body.latitude === undefined) {
    body.latitude = body.lat;
  }
  if (body.lng !== undefined && body.longitude === undefined) {
    body.longitude = body.lng;
  }

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
  values.push(pinId);

  const result = await queryOne(
    `UPDATE rep_pins SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return success(result);
}

async function deletePin(pinId: string, user: any) {
  const userIsAdmin = isAdmin(user);
  const repId = await getRepId(user.sub);

  // Check access - only owner or admin can delete
  if (!userIsAdmin) {
    const pin = await queryOne(
      `SELECT rep_id FROM rep_pins WHERE id = $1`,
      [pinId]
    );
    if (!pin || pin.rep_id !== repId) {
      return forbidden('Access denied');
    }
  }

  await execute('DELETE FROM rep_pins WHERE id = $1', [pinId]);
  return success({ message: 'Pin deleted' });
}
