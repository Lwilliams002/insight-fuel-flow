import { awsConfig } from './config';
import { getIdToken } from './auth';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getIdToken();

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

// ============ FILE/UPLOAD API ============

// Get a signed download URL for a file stored in Wasabi
// Use this to view files that were uploaded (images, documents, etc.)
export async function getSignedFileUrl(key: string): Promise<string | null> {
  if (!key) return null;

  // If it's already a signed URL or data URL, return as-is
  if (key.startsWith('data:') || key.includes('X-Amz-Signature')) {
    return key;
  }

  // If it's a Wasabi public URL, extract the key
  let fileKey = key;
  if (key.includes('wasabisys.com')) {
    const match = key.match(/titanprime\/(.+)$/);
    if (match) {
      fileKey = match[1];
    }
  }

  try {
    const response = await fetchApi<{ url: string }>(`/upload/download?key=${encodeURIComponent(fileKey)}`);
    return response.data?.url || null;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
}

// ============ DEALS API ============

// Deal status follows the owner's workflow:
// 1. Knock → 2. Inspect → 3. File Claim → 4. Sign → 5. Meet Adjuster →
// 6. Await Approval → 7. Approved → 8. Collect ACV → 9. Collect Deductible →
// 10. Select Materials → 11. Schedule Install → 12. Installed →
// 13. Completion Form → 14. Invoice → 15. Collect Depreciation → 16. Complete → 17. Paid
export type DealStatus =
  // SIGN PHASE
  | 'lead'
  | 'inspection_scheduled'
  | 'claim_filed'
  | 'signed'
  | 'adjuster_met'
  | 'awaiting_approval'
  | 'approved'
  // BUILD PHASE
  | 'acv_collected'
  | 'deductible_collected'
  | 'materials_selected'
  | 'install_scheduled'
  | 'installed'
  // FINALIZING PHASE
  | 'completion_signed'
  | 'invoice_sent'
  | 'depreciation_collected'
  // COMPLETE PHASE
  | 'complete'
  | 'paid'
  // Other
  | 'cancelled'
  | 'on_hold'
  // Legacy (for backwards compatibility)
  | 'permit'
  | 'pending'
  | 'materials_ordered'
  | 'materials_delivered'
  | 'adjuster_scheduled'
  | 'collect_acv'
  | 'collect_deductible';

export interface Deal {
  id: string;
  homeowner_name: string;
  homeowner_phone: string | null;
  homeowner_email: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: DealStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Property details
  roof_type: string | null;
  roof_squares: number | null;
  roof_squares_with_waste: number | null;
  stories: number | null;
  roofing_system_type: string | null;

  // Material details for ACV receipt
  material_category: string | null;  // Single, Metal, Architectural, Architectural Metal
  material_type: string | null;      // Type of metal (only for metal materials)
  material_color: string | null;     // Free-text field
  drip_edge: string | null;          // Free-text field
  vent_color: string | null;         // Free-text field

  // Lost statement (required for full approval)
  lost_statement_url: string | null;

  // Insurance info
  insurance_company: string | null;
  policy_number: string | null;
  claim_number: string | null;
  date_of_loss: string | null;
  deductible: number | null;

  // Inspection scheduling
  inspection_date: string | null;

  // Insurance financials
  rcv: number | null;              // Replacement Cost Value
  acv: number | null;              // Actual Cash Value
  depreciation: number | null;     // Depreciation amount

  // Adjuster info
  adjuster_name: string | null;
  adjuster_phone: string | null;
  adjuster_email: string | null;
  adjuster_meeting_date: string | null;
  adjuster_notes: string | null;
  adjuster_not_assigned: boolean | null;

  // Contract & documents
  contract_signed: boolean | null;
  signed_date: string | null;
  signature_url: string | null;
  signature_date: string | null;
  agreement_document_url: string | null;
  insurance_agreement_url: string | null;  // Uploaded insurance agreement document

  // Payment tracking - SIGN phase
  acv_check_collected: boolean | null;
  acv_check_amount: number | null;
  acv_check_date: string | null;

  // BUILD phase
  materials_ordered_date: string | null;
  materials_delivered_date: string | null;
  install_date: string | null;
  completion_date: string | null;
  permit_file_url: string | null;
  inspection_images: string[] | null;  // Inspection photos (from pin or uploaded)
  install_images: string[] | null;
  completion_images: string[] | null;

  // Receipts
  acv_receipt_url: string | null;
  deductible_receipt_url: string | null;
  depreciation_receipt_url: string | null;

  // COLLECT phase
  invoice_sent_date: string | null;
  invoice_amount: number | null;
  invoice_work_items: string | null;  // Work items text for invoice
  depreciation_check_collected: boolean | null;
  depreciation_check_amount: number | null;
  depreciation_check_date: string | null;

  // Supplements
  supplement_amount: number | null;
  supplement_approved: boolean | null;
  supplement_notes: string | null;

  // Totals
  total_contract_value: number | null;
  total_price: number;  // Legacy field
  payment_requested: boolean | null;
  payment_request_date: string | null;
  sales_tax: number | null;

  // Milestone timestamps (for tracking when each milestone was reached)
  lead_date: string | null;
  inspection_scheduled_date: string | null;
  claim_filed_date: string | null;
  adjuster_met_date: string | null;
  approved_date: string | null;
  approval_type: string | null;  // Type of approval (full, partial, supplement needed)
  collect_acv_date: string | null;
  collect_deductible_date: string | null;
  install_scheduled_date: string | null;
  installed_date: string | null;
  invoice_sent_at: string | null;
  invoice_url: string | null;  // Invoice document URL
  depreciation_collected_date: string | null;
  complete_date: string | null;

  // Rep assignment
  rep_id: string | null;
  rep_name: string | null;

  // Commissions
  deal_commissions?: DealCommission[];
  commission_paid: boolean | null;
  commission_paid_date: string | null;
  commission_override_amount: number | null;
  commission_override_reason: string | null;
  commission_override_date: string | null;
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

export const dealsApi = {
  list: () => fetchApi<Deal[]>('/deals'),

  get: (id: string) => fetchApi<Deal>(`/deals/${id}`),

  create: (deal: Partial<Deal>) =>
    fetchApi<Deal>('/deals', {
      method: 'POST',
      body: JSON.stringify(deal),
    }),

  createFromPin: (pinId: string, dealData?: Partial<Deal>) =>
    fetchApi<{ deal: Deal; pin_id: string }>('/deals', {
      method: 'POST',
      body: JSON.stringify({ pin_id: pinId, ...dealData }),
    }),

  update: (id: string, deal: Partial<Deal>) =>
    fetchApi<Deal>(`/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(deal),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/deals/${id}`, { method: 'DELETE' }),

  // Document management
  listDocuments: (dealId: string) =>
    fetchApi<DealDocument[]>(`/deals/${dealId}/documents`),

  addDocument: (dealId: string, document: Omit<DealDocument, 'id' | 'deal_id' | 'uploaded_by' | 'created_at' | 'updated_at'>) =>
    fetchApi<DealDocument>(`/deals/${dealId}/documents`, {
      method: 'POST',
      body: JSON.stringify(document),
    }),

  deleteDocument: (dealId: string, documentId: string) =>
    fetchApi<void>(`/deals/${dealId}/documents`, {
      method: 'DELETE',
      body: JSON.stringify({ document_id: documentId }),
    }),
};

// Document interface
export interface DealDocument {
  id: string;
  deal_id: string;
  document_type: 'insurance_agreement' | 'permit' | 'receipt_acv' | 'receipt_deductible' | 'receipt_depreciation' | 'contract' | 'other';
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  description?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

// ============ REPS API ============

export interface Rep {
  id: string;
  user_id: string;
  commission_level: string;
  default_commission_percent?: number;
  can_self_gen: boolean;
  manager_id: string | null;
  active: boolean;
  training_completed: boolean;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export const repsApi = {
  list: () => fetchApi<Rep[]>('/reps'),

  listClosers: () => fetchApi<Rep[]>('/reps?for_assignment=true'),

  get: (id: string) => fetchApi<Rep>(`/reps/${id}`),

  create: (rep: Partial<Rep>) =>
    fetchApi<Rep>('/reps', {
      method: 'POST',
      body: JSON.stringify(rep),
    }),

  update: (id: string, rep: Partial<Rep>) =>
    fetchApi<Rep>(`/reps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rep),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/reps/${id}`, { method: 'DELETE' }),
};

// ============ PINS API ============

export interface Pin {
  id: string;
  rep_id: string;
  deal_id: string | null;
  homeowner_name: string;
  homeowner_phone: string | null;
  homeowner_email: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  lat: number;
  lng: number;
  status: string;
  notes: string | null;
  appointment_date: string | null;
  appointment_end_date: string | null;
  appointment_all_day: boolean | null;
  document_url: string | null;
  image_url: string | null;
  utility_url: string | null;
  contract_url: string | null;
  inspection_images: string[] | null;  // Inspection photos uploaded for this pin
  assigned_closer_id: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  rep_name?: string;
  closer_name?: string;
}

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

// ============ COMMISSIONS API ============

export interface Commission {
  id: string;
  deal_id: string;
  rep_id: string;
  commission_type: string;
  commission_percent: number;
  commission_amount: number;
  paid: boolean;
  homeowner_name: string;
  address: string;
  deal_status: string;
  total_price: number;
  rep_name: string;
}

export const commissionsApi = {
  list: (params?: { status?: string; deal_id?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.deal_id) searchParams.set('deal_id', params.deal_id);
    const query = searchParams.toString();
    return fetchApi<Commission[]>(`/commissions${query ? `?${query}` : ''}`);
  },

  create: (commission: Partial<Commission>) =>
    fetchApi<Commission>('/commissions', {
      method: 'POST',
      body: JSON.stringify(commission),
    }),

  update: (id: string, commission: Partial<Commission>) =>
    fetchApi<Commission>(`/commissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(commission),
    }),
};

// ============ UPLOAD API ============

export interface UploadUrlResponse {
  url: string;
  key: string;
  bucket?: string;
}

export const uploadApi = {
  getUploadUrl: (fileName: string, fileType: string, folder?: string) =>
    fetchApi<UploadUrlResponse>('/upload/url', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType, folder, action: 'upload' }),
    }),

  getDownloadUrl: (key: string) =>
    fetchApi<UploadUrlResponse>('/upload/url', {
      method: 'POST',
      body: JSON.stringify({ key, action: 'download' }),
    }),
};

// ============ ADMIN API ============

export interface CreateRepParams {
  email: string;
  password: string;
  fullName: string;
  commissionLevel?: string;
  canSelfGen?: boolean;
  managerId?: string;
}

export interface CreateAdminParams {
  email: string;
  password: string;
  fullName: string;
}

export const adminApi = {
  createRep: (params: CreateRepParams) =>
    fetchApi<{ message: string; userId: string; rep: Rep }>('/admin/create-rep', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  createAdmin: (params: CreateAdminParams) =>
    fetchApi<{ message: string; userId: string }>('/admin/create-admin', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  syncReps: () =>
    fetchApi<{ message: string; synced: number; skipped: number; total: number }>('/admin/sync-reps', {
      method: 'POST',
    }),

  completeTraining: (email: string) =>
    fetchApi<{ message: string; rep_id: string; courses_completed: number }>('/admin/complete-training', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Run database migrations (uses init-db which includes migrations)
  runMigration: () =>
    fetchApi<{ success: boolean; message: string }>('/admin/init-db', {
      method: 'POST',
    }),
};

// ============ TRAINING API ============

export interface CourseProgress {
  course_id: string;
  exam_score: number | null;
  exam_passed: boolean;
  completed_at: string | null;
}

export interface TrainingProgress {
  training_completed: boolean;
  courses: CourseProgress[];
}

export interface ExamSubmission {
  course_id: string;
  answers: Record<string, string | number | boolean>;
}

export interface ExamResult {
  score: number;
  passed: boolean;
  training_completed: boolean;
  progress: CourseProgress;
}

export const trainingApi = {
  getProgress: () => fetchApi<TrainingProgress>('/training'),

  submitExam: (submission: ExamSubmission) =>
    fetchApi<ExamResult>('/training/submit', {
      method: 'POST',
      body: JSON.stringify(submission),
    }),
};
