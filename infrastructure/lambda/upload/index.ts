import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import {
  getUserFromEvent,
  success,
  badRequest,
  forbidden,
  serverError,
  parseBody,
} from '../shared/auth';

// Wasabi configuration from environment variables
const WASABI_ENDPOINT = process.env.WASABI_ENDPOINT || 'https://s3.us-central-1.wasabisys.com';
const WASABI_BUCKET = process.env.WASABI_BUCKET || 'titanprime';
const WASABI_REGION = process.env.WASABI_REGION || 'us-central-1';
const WASABI_SECRET_ARN = process.env.WASABI_SECRET_ARN || '';

// Cache for credentials
let cachedCredentials: { accessKey: string; secretKey: string } | null = null;

async function getWasabiCredentials(): Promise<{ accessKey: string; secretKey: string }> {
  // Return cached credentials if available
  if (cachedCredentials) return cachedCredentials;

  // Try to get from Secrets Manager if ARN is provided
  if (WASABI_SECRET_ARN) {
    try {
      const secretsClient = new SecretsManagerClient({});
      const response = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: WASABI_SECRET_ARN })
      );
      if (response.SecretString) {
        const secret = JSON.parse(response.SecretString) as Record<string, string>;
        cachedCredentials = {
          accessKey: secret.accessKey || secret.WASABI_ACCESS_KEY,
          secretKey: secret.secretKey || secret.WASABI_SECRET_KEY,
        };
        return cachedCredentials;
      }
    } catch (error) {
      console.warn('Failed to get Wasabi credentials from Secrets Manager, using env vars:', error);
    }
  }

  // Fall back to environment variables
  cachedCredentials = {
    accessKey: process.env.WASABI_ACCESS_KEY || '',
    secretKey: process.env.WASABI_SECRET_KEY || '',
  };
  return cachedCredentials;
}

// Lazy initialization of S3 client
let s3Client: S3Client | null = null;

async function getS3Client(): Promise<S3Client> {
  if (s3Client) return s3Client;

  const credentials = await getWasabiCredentials();
  s3Client = new S3Client({
    endpoint: WASABI_ENDPOINT,
    region: WASABI_REGION,
    credentials: {
      accessKeyId: credentials.accessKey,
      secretAccessKey: credentials.secretKey,
    },
    forcePathStyle: true, // Required for Wasabi
  });
  return s3Client;
}

interface UserInfo {
  sub: string;
  email?: string;
  'cognito:groups'?: string[];
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const user = getUserFromEvent(event) as UserInfo | null;
  if (!user) {
    return forbidden('Authentication required');
  }

  const path = event.resource || event.path || '';
  const method = event.httpMethod;

  try {
    // GET or POST /upload/download - get signed URL for viewing a file
    if (path.includes('/download') || (method === 'GET' && event.queryStringParameters?.key)) {
      return await getDownloadUrl(user, event);
    }
    // POST /upload/url - get presigned URL for uploading
    if (path.includes('/url')) {
      return await getPresignedUrl(user, event);
    }
    // POST /upload - direct base64 upload
    return await handleUpload(user, event);
  } catch (error) {
    console.error('Error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

// Get a signed download URL for an existing file
async function getDownloadUrl(user: UserInfo, event: APIGatewayProxyEvent) {
  const bodyKey = parseBody(event)?.key;
  const queryKey = event.queryStringParameters?.key;
  const key = queryKey || bodyKey;

  console.log('[getDownloadUrl] Query key:', queryKey);
  console.log('[getDownloadUrl] Body key:', bodyKey);
  console.log('[getDownloadUrl] Using key:', key);

  if (!key) {
    return badRequest('key is required');
  }

  try {
    const client = await getS3Client();

    console.log('[getDownloadUrl] Getting signed URL for bucket:', WASABI_BUCKET, 'key:', key);

    const command = new GetObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: key,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hour

    console.log('[getDownloadUrl] Generated signed URL successfully');

    return success({
      url: signedUrl,
      key,
    });
  } catch (error) {
    console.error('[getDownloadUrl] Error getting download URL:', error);
    return serverError(error instanceof Error ? error.message : 'Failed to get download URL');
  }
}

async function getPresignedUrl(user: UserInfo, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const { fileName, fileType, folder, action = 'upload' } = body;

  if (!fileName) {
    return badRequest('fileName is required');
  }

  // Get S3 client (lazy initialized with credentials)
  const client = await getS3Client();

  // Construct the S3 key with folder structure
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = folder
    ? `${folder}/${user.sub}/${timestamp}-${sanitizedFileName}`
    : `uploads/${user.sub}/${timestamp}-${sanitizedFileName}`;

  if (action === 'download') {
    // Generate download URL
    const command = new GetObjectCommand({
      Bucket: WASABI_BUCKET,
      Key: body.key || key,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });

    return success({
      url,
      key: body.key || key,
    });
  }

  // Generate upload URL
  const command = new PutObjectCommand({
    Bucket: WASABI_BUCKET,
    Key: key,
    ContentType: fileType || 'application/octet-stream',
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

  // Also generate a signed download URL for viewing (valid for 7 days)
  const getCommand = new GetObjectCommand({
    Bucket: WASABI_BUCKET,
    Key: key,
  });
  const downloadUrl = await getSignedUrl(client, getCommand, { expiresIn: 604800 }); // 7 days

  return success({
    url: uploadUrl,
    uploadUrl,
    downloadUrl,
    key,
    bucket: WASABI_BUCKET,
  });
}

async function handleUpload(user: UserInfo, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const { key, fileData, fileType, fileName } = body;

  // If fileData is provided, do a direct upload
  if (fileData && key) {
    try {
      const client = await getS3Client();

      // Decode base64 data
      const buffer = Buffer.from(fileData, 'base64');

      // Upload to Wasabi (without public ACL since bucket doesn't allow it)
      const command = new PutObjectCommand({
        Bucket: WASABI_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: fileType || 'application/octet-stream',
      });

      await client.send(command);

      // Generate a signed URL for viewing (valid for 7 days)
      const getCommand = new GetObjectCommand({
        Bucket: WASABI_BUCKET,
        Key: key,
      });
      const signedUrl = await getSignedUrl(client, getCommand, { expiresIn: 604800 }); // 7 days

      return success({
        url: signedUrl,
        signedUrl,
        key,
        bucket: WASABI_BUCKET,
      });
    } catch (error) {
      console.error('Direct upload error:', error);
      return serverError(error instanceof Error ? error.message : 'Upload failed');
    }
  }

  // Fallback to presigned URL approach
  return getPresignedUrl(user, event);
}
