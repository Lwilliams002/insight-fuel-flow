import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminSetUserPasswordCommand,
  ListUsersInGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { queryOne, execute, query } from '../shared/database';
import {
  getUserFromEvent,
  isAdmin,
  success,
  created,
  badRequest,
  forbidden,
  serverError,
  parseBody,
} from '../shared/auth';

const cognitoClient = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID || '';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const user = getUserFromEvent(event);
  if (!user) {
    return forbidden('Authentication required');
  }

  // Only admins can access these endpoints
  if (!isAdmin(user)) {
    return forbidden('Admin access required');
  }

  const path = event.resource;

  try {
    if (path.includes('create-rep')) {
      return await createRep(event);
    }
    if (path.includes('create-admin')) {
      return await createAdmin(event);
    }
    if (path.includes('sync-reps')) {
      return await syncReps();
    }
    return badRequest('Unknown admin action');
  } catch (error) {
    console.error('Error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

async function createRep(event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const { email, password, fullName, commissionLevel = 'junior', canSelfGen = true, managerId } = body;

  if (!email || !password || !fullName) {
    return badRequest('email, password, and fullName are required');
  }

  try {
    // Create user in Cognito
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: fullName },
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email
    });

    const createUserResponse = await cognitoClient.send(createUserCommand);
    const cognitoUserId = createUserResponse.User?.Username;

    if (!cognitoUserId) {
      throw new Error('Failed to create Cognito user');
    }

    // Set permanent password
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    });

    await cognitoClient.send(setPasswordCommand);

    // Add to rep group
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: 'rep',
    });

    await cognitoClient.send(addToGroupCommand);

    // Create profile in database
    await execute(
      `INSERT INTO profiles (id, email, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = $2, full_name = $3`,
      [cognitoUserId, email, fullName]
    );

    // Create user role
    await execute(
      `INSERT INTO user_roles (user_id, role)
       VALUES ($1, 'rep')
       ON CONFLICT (user_id) DO UPDATE SET role = 'rep'`,
      [cognitoUserId]
    );

    // Create rep record
    const rep = await queryOne(
      `INSERT INTO reps (user_id, commission_level, can_self_gen, manager_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [cognitoUserId, commissionLevel, canSelfGen, managerId]
    );

    return created({
      message: 'Rep created successfully',
      userId: cognitoUserId,
      rep,
    });
  } catch (error) {
    if ((error as { name?: string }).name === 'UsernameExistsException') {
      return badRequest('A user with this email already exists');
    }
    throw error;
  }
}

async function createAdmin(event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const { email, password, fullName } = body;

  if (!email || !password || !fullName) {
    return badRequest('email, password, and fullName are required');
  }

  try {
    // Create user in Cognito
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: fullName },
      ],
      MessageAction: 'SUPPRESS',
    });

    const createUserResponse = await cognitoClient.send(createUserCommand);
    const cognitoUserId = createUserResponse.User?.Username;

    if (!cognitoUserId) {
      throw new Error('Failed to create Cognito user');
    }

    // Set permanent password
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    });

    await cognitoClient.send(setPasswordCommand);

    // Add to admin group
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: 'admin',
    });

    await cognitoClient.send(addToGroupCommand);

    // Create profile in database
    await execute(
      `INSERT INTO profiles (id, email, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = $2, full_name = $3`,
      [cognitoUserId, email, fullName]
    );

    // Create user role
    await execute(
      `INSERT INTO user_roles (user_id, role)
       VALUES ($1, 'admin')
       ON CONFLICT (user_id) DO UPDATE SET role = 'admin'`,
      [cognitoUserId]
    );

    return created({
      message: 'Admin created successfully',
      userId: cognitoUserId,
    });
  } catch (error) {
    if ((error as { name?: string }).name === 'UsernameExistsException') {
      return badRequest('A user with this email already exists');
    }
    throw error;
  }
}

async function syncReps() {
  // List all users in the 'rep' group from Cognito
  const listUsersCommand = new ListUsersInGroupCommand({
    UserPoolId: USER_POOL_ID,
    GroupName: 'rep',
    Limit: 60,
  });

  const cognitoResponse = await cognitoClient.send(listUsersCommand);
  const cognitoUsers = cognitoResponse.Users || [];

  let synced = 0;
  let skipped = 0;

  for (const cognitoUser of cognitoUsers) {
    const username = cognitoUser.Username;
    if (!username) continue;

    // Get user attributes
    const emailAttr = cognitoUser.Attributes?.find(a => a.Name === 'email');
    const nameAttr = cognitoUser.Attributes?.find(a => a.Name === 'name');
    const email = emailAttr?.Value || username;
    const fullName = nameAttr?.Value || email.split('@')[0];

    // Check if profile already exists
    const existingProfile = await queryOne(
      'SELECT id FROM profiles WHERE id = $1',
      [username]
    );

    if (existingProfile) {
      skipped++;
      continue;
    }

    // Create profile
    await execute(
      `INSERT INTO profiles (id, email, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = $2, full_name = $3`,
      [username, email, fullName]
    );

    // Create user role
    await execute(
      `INSERT INTO user_roles (user_id, role)
       VALUES ($1, 'rep')
       ON CONFLICT (user_id) DO UPDATE SET role = 'rep'`,
      [username]
    );

    // Check if rep record exists
    const existingRep = await queryOne(
      'SELECT id FROM reps WHERE user_id = $1',
      [username]
    );

    if (!existingRep) {
      await execute(
        `INSERT INTO reps (user_id, commission_level, can_self_gen)
         VALUES ($1, 'junior', true)`,
        [username]
      );
    }

    synced++;
  }

  return success({
    message: `Synced ${synced} rep(s), ${skipped} already existed`,
    synced,
    skipped,
    total: cognitoUsers.length,
  });
}

