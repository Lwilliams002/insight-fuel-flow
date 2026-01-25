import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export interface UserClaims {
  sub: string;
  email: string;
  'cognito:groups'?: string[];
  'cognito:username': string;
}

export function getUserFromEvent(event: APIGatewayProxyEvent): UserClaims | null {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) return null;

  return {
    sub: claims.sub,
    email: claims.email,
    'cognito:groups': claims['cognito:groups'] ?
      (Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'] : [claims['cognito:groups']]) :
      [],
    'cognito:username': claims['cognito:username'],
  };
}

export function isAdmin(user: UserClaims | null): boolean {
  if (!user) return false;
  return user['cognito:groups']?.includes('admin') || false;
}

export function isRep(user: UserClaims | null): boolean {
  if (!user) return false;
  return user['cognito:groups']?.includes('rep') || false;
}

export function response(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

export function success(data: any): APIGatewayProxyResult {
  return response(200, { data });
}

export function created(data: any): APIGatewayProxyResult {
  return response(201, { data });
}

export function noContent(): APIGatewayProxyResult {
  return response(204, null);
}

export function badRequest(message: string): APIGatewayProxyResult {
  return response(400, { error: message });
}

export function unauthorized(message = 'Unauthorized'): APIGatewayProxyResult {
  return response(401, { error: message });
}

export function forbidden(message = 'Forbidden'): APIGatewayProxyResult {
  return response(403, { error: message });
}

export function notFound(message = 'Not found'): APIGatewayProxyResult {
  return response(404, { error: message });
}

export function serverError(message = 'Internal server error'): APIGatewayProxyResult {
  console.error('Server error:', message);
  return response(500, { error: message });
}

export function parseBody<T = any>(event: APIGatewayProxyEvent): T | null {
  if (!event.body) return null;
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}
