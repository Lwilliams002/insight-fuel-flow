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
    if (path.includes('complete-training')) {
      return await completeTraining(event);
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

  const { email, password, fullName, accountType = 'rep', commissionLevel = 'junior', canSelfGen = true, managerId } = body;

  if (!email || !password || !fullName) {
    return badRequest('email, password, and fullName are required');
  }

  // Validate account type
  const validAccountTypes = ['rep', 'crew', 'admin'];
  if (!validAccountTypes.includes(accountType)) {
    return badRequest('Invalid account type. Must be rep, crew, or admin');
  }

  // If creating an admin, delegate to createAdmin function
  if (accountType === 'admin') {
    return createAdmin(event);
  }

  // Determine the Cognito group based on account type
  const cognitoGroup = accountType === 'crew' ? 'crew' : 'rep';
  const userRole = accountType === 'crew' ? 'crew' : 'rep';

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

    // Add to appropriate group
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: cognitoGroup,
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
       VALUES ($1, $2::app_role)
       ON CONFLICT (user_id) DO UPDATE SET role = $2::app_role`,
      [cognitoUserId, userRole]
    );

    // For reps, create rep record with commission percentage
    // For crew leads, we skip this step (they don't have commission)
    let rep = null;
    if (accountType === 'rep') {
      const commissionLevelPercentages: Record<string, number> = {
        'junior': 5,
        'senior': 10,
        'manager': 13,
      };
      const defaultCommissionPercent = commissionLevelPercentages[commissionLevel] || 5;

      rep = await queryOne(
        `INSERT INTO reps (user_id, commission_level, default_commission_percent, can_self_gen, manager_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [cognitoUserId, commissionLevel, defaultCommissionPercent, canSelfGen, managerId]
      );
    }

    const accountTypeLabel = accountType === 'crew' ? 'Crew Lead' : 'Rep';
    return created({
      message: `${accountTypeLabel} created successfully`,
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
  let totalSynced = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  // First, check if 'crew' enum value exists
  try {
    const enumCheck = await query(
      `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'app_role'::regtype`,
      []
    );
    console.log('[syncReps] Available app_role enum values:', enumCheck.map((e: any) => e.enumlabel));
  } catch (e) {
    console.error('[syncReps] Error checking enum values:', e);
  }

  // Sync all three groups: admin, rep, crew
  const groups = ['admin', 'rep', 'crew'];

  for (const groupName of groups) {
    try {
      console.log(`[syncReps] Syncing group: ${groupName}`);
      const listUsersCommand = new ListUsersInGroupCommand({
        UserPoolId: USER_POOL_ID,
        GroupName: groupName,
        Limit: 60,
      });

      const cognitoResponse = await cognitoClient.send(listUsersCommand);
      const cognitoUsers = cognitoResponse.Users || [];
      console.log(`[syncReps] Found ${cognitoUsers.length} users in Cognito group: ${groupName}`);

      for (const cognitoUser of cognitoUsers) {
        const username = cognitoUser.Username;
        if (!username) continue;

        // Get user attributes
        const emailAttr = cognitoUser.Attributes?.find(a => a.Name === 'email');
        const nameAttr = cognitoUser.Attributes?.find(a => a.Name === 'name');
        const email = emailAttr?.Value || username;
        const fullName = nameAttr?.Value || email.split('@')[0];

        try {
          // Create or update profile
          await execute(
            `INSERT INTO profiles (id, email, full_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET email = $2, full_name = $3`,
            [username, email, fullName]
          );

          // Create or update user role - cast to app_role enum
          await execute(
            `INSERT INTO user_roles (user_id, role)
             VALUES ($1, $2::app_role)
             ON CONFLICT (user_id) DO UPDATE SET role = $2::app_role`,
            [username, groupName]
          );

          // For reps, also create rep record if it doesn't exist
          if (groupName === 'rep') {
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
          }

          totalSynced++;
          console.log(`[syncReps] Successfully synced user: ${email} as ${groupName}`);
        } catch (userError) {
          const userErrorMsg = `Error syncing user ${email} in group ${groupName}: ${userError instanceof Error ? userError.message : String(userError)}`;
          console.error(`[syncReps] ${userErrorMsg}`);
          errors.push(userErrorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Error syncing group ${groupName}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[syncReps] ${errorMsg}`);
      errors.push(errorMsg);
      // Continue with other groups even if one fails
    }
  }

  return success({
    message: `Synced ${totalSynced} user(s) across all groups`,
    synced: totalSynced,
    skipped: totalSkipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}

async function completeTraining(event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const { email } = body;

  if (!email) {
    return badRequest('email is required');
  }

  // Find the user by email
  const profile = await queryOne(
    'SELECT id FROM profiles WHERE email = $1',
    [email]
  );

  if (!profile) {
    return badRequest(`User with email ${email} not found`);
  }

  // Find the rep record
  const rep = await queryOne(
    'SELECT id FROM reps WHERE user_id = $1',
    [profile.id]
  );

  if (!rep) {
    return badRequest(`Rep record not found for user ${email}`);
  }

  // Define required courses
  const requiredCourses = [
    'roof-types-components',
    'measuring-estimating',
    'sales-door-knocking',
    'understanding-insurance',
    'job-cycle-adjuster'
  ];

  // Insert training progress for all courses (marked as passed)
  for (const courseId of requiredCourses) {
    await execute(
      `INSERT INTO training_progress (rep_id, course_id, exam_score, exam_passed, completed_at)
       VALUES ($1, $2, 100, true, NOW())
       ON CONFLICT (rep_id, course_id)
       DO UPDATE SET exam_score = 100, exam_passed = true, completed_at = NOW(), updated_at = NOW()`,
      [rep.id, courseId]
    );
  }

  // Update rep's training_completed status
  await execute(
    'UPDATE reps SET training_completed = true WHERE id = $1',
    [rep.id]
  );

  return success({
    message: `Training completed for ${email}`,
    rep_id: rep.id,
    courses_completed: requiredCourses.length,
  });
}

