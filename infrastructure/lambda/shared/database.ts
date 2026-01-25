import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

interface DatabaseCredentials {
  username: string;
  password: string;
}

async function getCredentials(): Promise<DatabaseCredentials> {
  const secretsManager = new SecretsManager({});
  const secretArn = process.env.DATABASE_SECRET_ARN;

  if (!secretArn) {
    throw new Error('DATABASE_SECRET_ARN environment variable is required');
  }

  const response = await secretsManager.getSecretValue({ SecretId: secretArn });
  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  return JSON.parse(response.SecretString);
}

export async function getPool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const credentials = await getCredentials();

  pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'insightfuelflow',
    user: credentials.username,
    password: credentials.password,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const pool = await getPool();
  const result = await pool.query(text, params);
  return result.rows;
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function execute(text: string, params?: any[]): Promise<number> {
  const pool = await getPool();
  const result = await pool.query(text, params);
  return result.rowCount || 0;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
