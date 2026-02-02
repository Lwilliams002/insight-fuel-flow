/**
 * Wasabi Storage Service
 * Bucket: titanprime
 * Region: us-central-1 (Texas)
 *
 * Note: Actual uploads go through backend API which has the secret key
 */

// Wasabi S3-compatible endpoint
const WASABI_ENDPOINT = 'https://s3.us-central-1.wasabisys.com';
const WASABI_BUCKET = 'titanprime';
const WASABI_REGION = 'us-central-1';

// File categories for organization
export type FileCategory =
  | 'inspection-photos'
  | 'install-photos'
  | 'completion-photos'
  | 'permits'
  | 'contracts'
  | 'insurance-agreements'
  | 'receipts'
  | 'signatures'
  | 'documents';

interface UploadOptions {
  dealId?: string;
  pinId?: string;
  category: FileCategory;
  fileName: string;
  contentType: string;
}

interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Generate a unique file key for Wasabi storage
 */
export function generateFileKey(options: UploadOptions): string {
  const timestamp = Date.now();
  const sanitizedFileName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

  if (options.dealId) {
    return `deals/${options.dealId}/${options.category}/${timestamp}-${sanitizedFileName}`;
  } else if (options.pinId) {
    return `pins/${options.pinId}/${options.category}/${timestamp}-${sanitizedFileName}`;
  }
  return `uploads/${options.category}/${timestamp}-${sanitizedFileName}`;
}

/**
 * Get the public URL for a file in Wasabi
 */
export function getWasabiUrl(key: string): string {
  return `${WASABI_ENDPOINT}/${WASABI_BUCKET}/${key}`;
}

/**
 * Upload a file to Wasabi storage via backend API
 * Note: For security, actual upload should go through your backend
 * which has the secret access key
 */
export async function uploadToWasabi(
  file: File,
  options: UploadOptions
): Promise<UploadResult> {
  try {
    const key = generateFileKey({
      ...options,
      fileName: file.name,
      contentType: file.type,
    });

    // Create form data for upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', key);
    formData.append('category', options.category);
    if (options.dealId) formData.append('dealId', options.dealId);
    if (options.pinId) formData.append('pinId', options.pinId);

    // Get API URL from environment or use default
    const apiUrl = import.meta.env.VITE_API_URL || '';

    const response = await fetch(`${apiUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Upload failed');
    }

    const result = await response.json();

    return {
      success: true,
      url: result.url || getWasabiUrl(key),
      key: result.key || key,
    };
  } catch (error) {
    console.error('Wasabi upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload multiple files to Wasabi
 */
export async function uploadMultipleToWasabi(
  files: File[],
  options: Omit<UploadOptions, 'fileName' | 'contentType'>
): Promise<UploadResult[]> {
  const results = await Promise.all(
    files.map(file =>
      uploadToWasabi(file, {
        ...options,
        fileName: file.name,
        contentType: file.type,
      })
    )
  );
  return results;
}

/**
 * Delete a file from Wasabi storage
 */
export async function deleteFromWasabi(key: string): Promise<boolean> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';

    const response = await fetch(`${apiUrl}/api/upload`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    });

    return response.ok;
  } catch (error) {
    console.error('Wasabi delete error:', error);
    return false;
  }
}

/**
 * Convert base64 data URL to File object
 */
export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
}

/**
 * Upload a signature (data URL) to Wasabi
 */
export async function uploadSignatureToWasabi(
  signatureDataUrl: string,
  options: { dealId?: string; pinId?: string; type: string }
): Promise<UploadResult> {
  const file = dataUrlToFile(signatureDataUrl, `signature-${options.type}-${Date.now()}.png`);
  return uploadToWasabi(file, {
    ...options,
    category: 'signatures',
    fileName: file.name,
    contentType: 'image/png',
  });
}
