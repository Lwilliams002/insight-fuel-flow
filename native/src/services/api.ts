import { awsConfig } from '../constants/config';

// Get token from auth context (will be injected)
let getIdTokenFn: (() => Promise<string | null>) | null = null;

export function setGetIdTokenFn(fn: () => Promise<string | null>) {
  getIdTokenFn = fn;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getIdTokenFn ? await getIdTokenFn() : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${awsConfig.api.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      return { error: json.error || `HTTP ${response.status}` };
    }

    return { data: json.data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ TYPES ============

export interface Deal {
  id: string;
  created_at: string;
  updated_at: string;
  address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  roof_type: string | null;
  roof_squares: number | null;
  stories: number | null;
  homeowner_name: string;
  homeowner_phone: string | null;
  homeowner_email: string | null;
  status: string;
  notes: string | null;
  insurance_company: string | null;
  policy_number: string | null;
  claim_number: string | null;
  date_of_loss: string | null;
  deductible: number | null;
  inspection_date: string | null;
  rcv: number | null;
  acv: number | null;
  depreciation: number | null;
  adjuster_name: string | null;
  adjuster_phone: string | null;
  adjuster_email: string | null;
  adjuster_meeting_date: string | null;
  contract_signed: boolean;
  signed_date: string | null;
  signature_url: string | null;
  agreement_document_url: string | null;
  install_date: string | null;
  completion_date: string | null;
  permit_file_url: string | null;
  lost_statement_url: string | null;
  insurance_agreement_url: string | null;
  inspection_images: string[] | null;
  install_images: string[] | null;
  completion_images: string[] | null;
  acv_receipt_url: string | null;
  deductible_receipt_url: string | null;
  depreciation_receipt_url: string | null;
  invoice_amount: number | null;
  invoice_url: string | null;
  invoice_work_items: string | null;
  approval_type: string | null;
  approved_date: string | null;
  material_category: string | null;
  material_type: string | null;
  material_color: string | null;
  drip_edge: string | null;
  vent_color: string | null;
  total_price: number;
  sales_tax: number | null;
  payment_requested: boolean;
  rep_id?: string;
  rep_name?: string;
  // Milestone timestamp fields
  claim_filed_date: string | null;
  collect_acv_date: string | null;
  collect_deductible_date: string | null;
  installed_date: string | null;
  depreciation_collected_date: string | null;
  complete_date: string | null;
  invoice_sent_date: string | null;
  // New workflow timestamp fields
  awaiting_approval_date: string | null;
  acv_collected_date: string | null;
  deductible_collected_date: string | null;
  materials_selected_date: string | null;
  completion_signed_date: string | null;
  // Completion form fields
  completion_form_url: string | null;
  completion_form_signature_url: string | null;
  homeowner_completion_signature_url: string | null;
  // Check collected fields
  acv_check_collected: boolean | null;
  depreciation_check_collected: boolean | null;
  // Installation schedule fields
  install_time: string | null;
  crew_assignment: string | null;
  // Commission payment fields
  commission_paid: boolean | null;
  commission_paid_date: string | null;
  deal_commissions?: DealCommission[];
}

export interface DealCommission {
  id: string;
  deal_id: string;
  rep_id: string;
  commission_type: string;
  commission_percent: number;
  commission_amount: number;
  paid: boolean;
  rep_name?: string;
}

export interface Pin {
  id: string;
  rep_id: string;
  deal_id: string | null;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  homeowner_name: string | null;
  homeowner_phone: string | null;
  homeowner_email: string | null;
  status: string;
  notes: string | null;
  appointment_date: string | null;
  appointment_end_date: string | null;
  appointment_all_day: boolean | null;
  document_url: string | null;
  image_url: string | null;
  contract_url: string | null;
  assigned_closer_id: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  rep_name?: string;
  closer_name?: string;
}

export interface Rep {
  id: string;
  user_id: string;
  email?: string;
  full_name?: string;
  commission_level: string;
  default_commission_percent: number;
  can_self_gen: boolean;
  active: boolean;
  created_at: string;
}

// ============ DEALS API ============

export const dealsApi = {
  list: () => fetchApi<Deal[]>('/deals'),

  get: (id: string) => fetchApi<Deal>(`/deals/${id}`),

  create: (deal: Partial<Deal>) =>
    fetchApi<Deal>('/deals', {
      method: 'POST',
      body: JSON.stringify(deal),
    }),

  update: (id: string, deal: Partial<Deal>) =>
    fetchApi<Deal>(`/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(deal),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/deals/${id}`, { method: 'DELETE' }),

  createFromPin: (pinId: string) =>
    fetchApi<Deal>(`/deals`, {
      method: 'POST',
      body: JSON.stringify({ pin_id: pinId }),
    }),
};

// ============ PINS API ============

export const pinsApi = {
  list: () => fetchApi<Pin[]>('/pins'),

  get: (id: string) => fetchApi<Pin>(`/pins/${id}`),

  create: (pin: Partial<Pin>) =>
    fetchApi<Pin>('/pins', {
      method: 'POST',
      body: JSON.stringify(pin),
    }),

  update: (id: string, pin: Partial<Pin>) =>
    fetchApi<Pin>(`/pins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pin),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/pins/${id}`, { method: 'DELETE' }),
};

// ============ REPS API ============

export const repsApi = {
  list: () => fetchApi<Rep[]>('/reps'),

  get: (id: string) => fetchApi<Rep>(`/reps/${id}`),

  getMe: () => fetchApi<Rep>('/reps/me'),

  update: (id: string, rep: Partial<Rep>) =>
    fetchApi<Rep>(`/reps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rep),
    }),
};

// ============ UPLOAD API ============

export async function uploadFile(
  fileUri: string,
  fileName: string,
  fileType: string,
  category: string,
  dealId?: string,
  pinId?: string
): Promise<{ url: string; key: string } | null> {
  try {
    const token = getIdTokenFn ? await getIdTokenFn() : null;
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Build folder path
    let folder = category;
    if (dealId) folder = `deals/${dealId}/${category}`;
    else if (pinId) folder = `pins/${pinId}/${category}`;

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${timestamp}-${sanitizedFileName}`;

    let fileData: string;

    // Check if fileUri is already a base64 data URL (from signature pad)
    if (fileUri.startsWith('data:')) {
      // Extract base64 data from data URL
      const base64Match = fileUri.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match && base64Match[1]) {
        fileData = base64Match[1];
        console.log('[uploadFile] Using base64 data from data URL');
      } else {
        throw new Error('Invalid data URL format');
      }
    } else {
      // Read file from URI as base64
      console.log('[uploadFile] Fetching file from URI:', fileUri.substring(0, 50));
      const response = await fetch(fileUri);
      const blob = await response.blob();

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      fileData = await base64Promise;
    }

    console.log('[uploadFile] Uploading to key:', key, 'fileType:', fileType);

    // Upload via API
    const uploadResponse = await fetch(`${awsConfig.api.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        key,
        fileData,
        fileType,
        fileName: sanitizedFileName,
      }),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[uploadFile] Upload failed:', uploadResponse.status, errorText);
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const responseJson = await uploadResponse.json();
    console.log('[uploadFile] Upload response:', JSON.stringify(responseJson));

    // The API wraps response in { data: ... }, so unwrap it
    const result = responseJson.data || responseJson;

    // The API returns the URL in different fields depending on the response
    const url = result.url || result.signedUrl || result.publicUrl;
    console.log('[uploadFile] Upload successful, URL:', url ? url.substring(0, 100) + '...' : 'undefined');

    if (!url) {
      console.error('[uploadFile] No URL in response, full result:', result);
    }

    return {
      url: url,
      key: result.key || key,
    };
  } catch (error) {
    console.error('[uploadFile] Upload error:', error);
    return null;
  }
}

// ============ DOWNLOAD API ============

export async function getSignedFileUrl(key: string): Promise<string | null> {
  const requestId = Math.random().toString(36).substring(7);

  if (!key) {
    console.log(`[getSignedFileUrl:${requestId}] No key provided`);
    return null;
  }

  // If it's already a signed URL or data URL, return as-is
  if (key.startsWith('data:') || key.includes('X-Amz-Signature')) {
    console.log(`[getSignedFileUrl:${requestId}] Already signed, returning as-is`);
    return key;
  }

  // If it's a Wasabi URL, extract the key after bucket name
  let fileKey = key;
  if (key.includes('wasabisys.com')) {
    const match = key.match(/titanprime\/(.+?)(\?|$)/);
    if (match && match[1]) {
      fileKey = match[1];
    }
  }

  console.log(`[getSignedFileUrl:${requestId}] Original key:`, key);
  console.log(`[getSignedFileUrl:${requestId}] Extracted fileKey:`, fileKey);

  try {
    const token = getIdTokenFn ? await getIdTokenFn() : null;
    if (!token) {
      console.error(`[getSignedFileUrl:${requestId}] No auth token`);
      return null;
    }

    // Use GET with query param like web app does
    const apiUrl = `${awsConfig.api.baseUrl}/upload/download?key=${encodeURIComponent(fileKey)}`;
    console.log(`[getSignedFileUrl:${requestId}] Calling API:`, apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`[getSignedFileUrl:${requestId}] Response status:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[getSignedFileUrl:${requestId}] Failed:`, response.status, errorText);
      return null;
    }

    const responseData = await response.json();
    console.log(`[getSignedFileUrl:${requestId}] Response data keys:`, Object.keys(responseData));

    // Handle both { url: "..." } and { data: { url: "..." } } response formats
    const url = responseData.url || responseData.data?.url;

    if (url) {
      console.log(`[getSignedFileUrl:${requestId}] Success, URL length:`, url.length);
      return url;
    } else {
      console.error(`[getSignedFileUrl:${requestId}] No URL in response:`, JSON.stringify(responseData));
      return null;
    }
  } catch (error) {
    console.error(`[getSignedFileUrl:${requestId}] Error:`, error);
    return null;
  }
}

// ============ ADMIN API ============

export const adminApi = {
  runMigration: () =>
    fetchApi<{ success: boolean; message: string }>('/admin/init-db', {
      method: 'POST',
    }),
};

