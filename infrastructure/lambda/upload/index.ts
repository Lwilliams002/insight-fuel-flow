import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  getUserFromEvent,
  success,
  badRequest,
  forbidden,
  serverError,
  parseBody,
} from '../shared/auth';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.S3_BUCKET || '';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const user = getUserFromEvent(event);
  if (!user) {
    return forbidden('Authentication required');
  }

  const path = event.resource;

  try {
    if (path.includes('/url')) {
      return await getPresignedUrl(user, event);
    }
    return await handleUpload(user, event);
  } catch (error) {
    console.error('Error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

async function getPresignedUrl(user: any, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  const { fileName, fileType, folder, action = 'upload' } = body;

  if (!fileName) {
    return badRequest('fileName is required');
  }

  // Construct the S3 key with folder structure
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = folder
    ? `${folder}/${user.sub}/${timestamp}-${sanitizedFileName}`
    : `uploads/${user.sub}/${timestamp}-${sanitizedFileName}`;

  if (action === 'download') {
    // Generate download URL
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: body.key || key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return success({
      url,
      key: body.key || key,
    });
  }

  // Generate upload URL
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType || 'application/octet-stream',
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return success({
    url,
    key,
    bucket: BUCKET_NAME,
  });
}

async function handleUpload(user: any, event: APIGatewayProxyEvent) {
  // This endpoint can be used for small files or metadata registration
  const body = parseBody(event);
  if (!body) {
    return badRequest('Request body required');
  }

  // For now, just return the presigned URL approach
  return getPresignedUrl(user, event);
}
