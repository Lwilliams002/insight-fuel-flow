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

// ============ DEALS API ============

export type DealStatus = 'lead' | 'signed' | 'permit' | 'install_scheduled' | 'installed' | 'complete' | 'pending' | 'paid' | 'cancelled';

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
  total_price: number;
  signed_date: string | null;
  install_date: string | null;
  completion_date: string | null;
  created_at: string;
  updated_at: string;
  contract_signed: boolean | null;
  notes: string | null;
  permit_file_url: string | null;
  install_images: string[] | null;
  completion_images: string[] | null;
  payment_requested: boolean | null;
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
};

// ============ REPS API ============

export interface Rep {
  id: string;
  user_id: string;
  commission_level: string;
  default_commission_percent?: number;
  can_self_gen: boolean;
  manager_id: string | null;
  active: boolean;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export const repsApi = {
  list: () => fetchApi<Rep[]>('/reps'),

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
};
