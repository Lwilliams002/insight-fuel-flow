/**
 * CRM Process Flow based on Roof Sales Mastery Training
 *
 * The job cycle follows 3 main stages:
 * 1. SIGN - Get the homeowner agreement
 * 2. BUILD - Complete the construction work
 * 3. COLLECT - Collect all payments including depreciation
 */

export type DealStatus =
  // SIGN PHASE
  | 'lead'
  | 'inspection_scheduled'
  | 'claim_filed'
  | 'adjuster_scheduled'
  | 'adjuster_met'
  | 'approved'
  | 'signed'
  // BUILD PHASE
  | 'materials_ordered'
  | 'materials_delivered'
  | 'install_scheduled'
  | 'installed'
  // COLLECT PHASE
  | 'invoice_sent'
  | 'depreciation_collected'
  | 'complete'
  // Other
  | 'cancelled'
  | 'on_hold'
  // Legacy
  | 'permit'
  | 'pending'
  | 'paid';

export type CRMPhase = 'sign' | 'build' | 'collect' | 'other';

export interface StatusConfig {
  label: string;
  phase: CRMPhase;
  color: string;
  description: string;
  nextStatus: DealStatus | null;
  prevStatus: DealStatus | null;
  stepNumber: number;
  actionLabel?: string;
  requiredFields?: string[];
}

/**
 * Complete status configuration with workflow information
 */
export const dealStatusConfig: Record<DealStatus, StatusConfig> = {
  // ==========================================
  // SIGN PHASE (Steps 1-7)
  // ==========================================
  lead: {
    label: 'Lead',
    phase: 'sign',
    color: '#4A6FA5', // Steel Blue
    description: 'Initial contact, inspection not yet scheduled',
    nextStatus: 'inspection_scheduled',
    prevStatus: null,
    stepNumber: 1,
    actionLabel: 'Schedule Inspection',
  },
  inspection_scheduled: {
    label: 'Inspection Scheduled',
    phase: 'sign',
    color: '#5C6BC0', // Indigo
    description: 'Free inspection appointment set with homeowner',
    nextStatus: 'claim_filed',
    prevStatus: 'lead',
    stepNumber: 2,
    actionLabel: 'Complete Inspection',
    requiredFields: ['appointment_date'],
  },
  claim_filed: {
    label: 'Claim Filed',
    phase: 'sign',
    color: '#7E57C2', // Purple
    description: 'Homeowner filed claim with insurance company',
    nextStatus: 'adjuster_scheduled',
    prevStatus: 'inspection_scheduled',
    stepNumber: 3,
    actionLabel: 'Schedule Adjuster',
    requiredFields: ['insurance_company', 'claim_number'],
  },
  adjuster_scheduled: {
    label: 'Adjuster Scheduled',
    phase: 'sign',
    color: '#AB47BC', // Pink Purple
    description: 'Adjuster meeting scheduled - prepare your packet!',
    nextStatus: 'adjuster_met',
    prevStatus: 'claim_filed',
    stepNumber: 4,
    actionLabel: 'Meet Adjuster',
    requiredFields: ['adjuster_name', 'adjuster_meeting_date'],
  },
  adjuster_met: {
    label: 'Awaiting Approval',
    phase: 'sign',
    color: '#EC407A', // Pink
    description: 'Met with adjuster, waiting for insurance approval',
    nextStatus: 'approved',
    prevStatus: 'adjuster_scheduled',
    stepNumber: 5,
    actionLabel: 'Mark Approved',
  },
  approved: {
    label: 'Approved',
    phase: 'sign',
    color: '#26A69A', // Teal
    description: 'Insurance approved claim - get paperwork signed!',
    nextStatus: 'signed',
    prevStatus: 'adjuster_met',
    stepNumber: 6,
    actionLabel: 'Get Signature',
    requiredFields: ['rcv', 'acv', 'depreciation', 'deductible'],
  },
  signed: {
    label: 'Signed',
    phase: 'sign',
    color: '#66BB6A', // Green
    description: 'Agreement signed, ACV check collected as deposit',
    nextStatus: 'materials_ordered',
    prevStatus: 'approved',
    stepNumber: 7,
    actionLabel: 'Order Materials',
    requiredFields: ['signed_date', 'acv_check_collected'],
  },

  // ==========================================
  // BUILD PHASE (Steps 8-11)
  // ==========================================
  materials_ordered: {
    label: 'Materials Ordered',
    phase: 'build',
    color: '#FFA726', // Orange
    description: 'Materials have been ordered from supplier',
    nextStatus: 'materials_delivered',
    prevStatus: 'signed',
    stepNumber: 8,
    actionLabel: 'Mark Delivered',
    requiredFields: ['materials_ordered_date'],
  },
  materials_delivered: {
    label: 'Materials Delivered',
    phase: 'build',
    color: '#FF7043', // Deep Orange
    description: 'Materials delivered to property, ready to schedule install',
    nextStatus: 'install_scheduled',
    prevStatus: 'materials_ordered',
    stepNumber: 9,
    actionLabel: 'Schedule Install',
    requiredFields: ['materials_delivered_date'],
  },
  install_scheduled: {
    label: 'Install Scheduled',
    phase: 'build',
    color: '#8D6E63', // Brown
    description: 'Installation date is set',
    nextStatus: 'installed',
    prevStatus: 'materials_delivered',
    stepNumber: 10,
    actionLabel: 'Mark Installed',
    requiredFields: ['install_date'],
  },
  installed: {
    label: 'Installed',
    phase: 'build',
    color: '#78909C', // Blue Grey
    description: 'Construction completed - take completion photos!',
    nextStatus: 'invoice_sent',
    prevStatus: 'install_scheduled',
    stepNumber: 11,
    actionLabel: 'Send Invoice',
    requiredFields: ['completion_date'],
  },

  // ==========================================
  // COLLECT PHASE (Steps 12-14)
  // ==========================================
  invoice_sent: {
    label: 'Invoice Sent',
    phase: 'collect',
    color: '#5C6BC0', // Indigo
    description: 'Invoice sent to insurance for depreciation release',
    nextStatus: 'depreciation_collected',
    prevStatus: 'installed',
    stepNumber: 12,
    actionLabel: 'Collect Depreciation',
    requiredFields: ['invoice_sent_date', 'invoice_amount'],
  },
  depreciation_collected: {
    label: 'Depreciation Collected',
    phase: 'collect',
    color: '#26A69A', // Teal
    description: 'Depreciation check collected - ready to close job',
    nextStatus: 'complete',
    prevStatus: 'invoice_sent',
    stepNumber: 13,
    actionLabel: 'Complete Job',
    requiredFields: ['depreciation_check_collected', 'depreciation_check_amount'],
  },
  complete: {
    label: 'Complete',
    phase: 'collect',
    color: '#2E7D32', // Dark Green
    description: 'Job complete! Commissions paid.',
    nextStatus: null,
    prevStatus: 'depreciation_collected',
    stepNumber: 14,
    actionLabel: null,
  },

  // ==========================================
  // OTHER STATUSES
  // ==========================================
  cancelled: {
    label: 'Cancelled',
    phase: 'other',
    color: '#B71C1C', // Dark Red
    description: 'Deal cancelled or lost',
    nextStatus: null,
    prevStatus: null,
    stepNumber: 0,
  },
  on_hold: {
    label: 'On Hold',
    phase: 'other',
    color: '#757575', // Grey
    description: 'Deal temporarily on hold',
    nextStatus: null,
    prevStatus: null,
    stepNumber: 0,
  },
  // Legacy statuses (for backwards compatibility)
  permit: {
    label: 'Permit',
    phase: 'build',
    color: '#8D6E63',
    description: 'Legacy: Permit status',
    nextStatus: 'install_scheduled',
    prevStatus: 'signed',
    stepNumber: 8,
  },
  pending: {
    label: 'Pending',
    phase: 'sign',
    color: '#FFA726',
    description: 'Legacy: Pending status',
    nextStatus: 'signed',
    prevStatus: 'lead',
    stepNumber: 3,
  },
  paid: {
    label: 'Paid',
    phase: 'collect',
    color: '#2E7D32',
    description: 'Legacy: Paid status',
    nextStatus: null,
    prevStatus: 'complete',
    stepNumber: 14,
  },
};

/**
 * Get all statuses for a specific phase
 */
export function getStatusesByPhase(phase: CRMPhase): DealStatus[] {
  return Object.entries(dealStatusConfig)
    .filter(([_, config]) => config.phase === phase)
    .sort((a, b) => a[1].stepNumber - b[1].stepNumber)
    .map(([status]) => status as DealStatus);
}

/**
 * Get the phase for a given status
 */
export function getPhaseForStatus(status: DealStatus): CRMPhase {
  return dealStatusConfig[status]?.phase || 'other';
}

/**
 * Get progress percentage through the job cycle
 */
export function getProgressPercentage(status: DealStatus): number {
  const config = dealStatusConfig[status];
  if (!config || config.stepNumber === 0) return 0;
  return Math.round((config.stepNumber / 14) * 100);
}

/**
 * Phase summary with colors and labels
 */
export const phaseConfig: Record<CRMPhase, { label: string; color: string; icon: string }> = {
  sign: { label: 'Sign', color: '#4A6FA5', icon: '✍️' },
  build: { label: 'Build', color: '#FF7043', icon: '🔨' },
  collect: { label: 'Collect', color: '#2E7D32', icon: '💰' },
  other: { label: 'Other', color: '#757575', icon: '📋' },
};

/**
 * Insurance calculation helpers (from training)
 */
export function calculateInsuranceAmounts(rcv: number, depreciationPercent: number, deductible: number) {
  const depreciation = rcv * (depreciationPercent / 100);
  const acv = rcv - depreciation;
  const firstCheck = acv - deductible;
  const secondCheck = depreciation;

  return {
    rcv,                    // Total claim value
    depreciation,           // Amount held back
    acv,                    // Actual cash value
    deductible,             // Homeowner pays this
    firstCheck,             // ACV - deductible (issued immediately)
    secondCheck,            // Depreciation (released after work complete)
    homeownerOutOfPocket: deductible,
  };
}

/**
 * Waste calculation helpers (from measuring training)
 */
export function calculateWaste(actualSquares: number, roofType: 'gable' | 'hip' | 'mixed'): number {
  const wastePercentage = roofType === 'hip' ? 0.15 : roofType === 'gable' ? 0.10 : 0.12;
  return actualSquares * wastePercentage;
}

export function calculateTotalSquares(actualSquares: number, roofType: 'gable' | 'hip' | 'mixed'): number {
  return actualSquares + calculateWaste(actualSquares, roofType);
}

/**
 * Job cycle steps from training (17 steps total)
 */
export const jobCycleSteps = [
  { step: 1, description: 'Hail and/or wind storm hits an area, damaging thousands of homes', phase: 'sign' },
  { step: 2, description: 'Storm restoration contractors set up free inspections with homeowners', phase: 'sign' },
  { step: 3, description: 'Inspection completed, damage photographed, documented, and presented', phase: 'sign' },
  { step: 4, description: 'Homeowner and contractor make agreement contingent upon insurance approval', phase: 'sign' },
  { step: 5, description: 'Homeowner files a claim', phase: 'sign' },
  { step: 6, description: 'Contractor measures, diagrams, & estimates damages', phase: 'sign' },
  { step: 7, description: 'Insurance adjuster sets appointment to assess property', phase: 'sign' },
  { step: 8, description: 'Contractor meets with adjuster to review scope of damages', phase: 'sign' },
  { step: 9, description: 'Adjuster approves claim', phase: 'sign' },
  { step: 10, description: 'Homeowner receives insurance paperwork/estimate & 1st check (ACV)', phase: 'sign' },
  { step: 11, description: 'Scope of work confirmed (roof, siding, gutters, etc.)', phase: 'sign' },
  { step: 12, description: '1st check collected as material deposit', phase: 'build' },
  { step: 13, description: 'Materials ordered and delivered', phase: 'build' },
  { step: 14, description: 'Construction completed', phase: 'build' },
  { step: 15, description: 'Invoice sent to insurance company for release of depreciation', phase: 'collect' },
  { step: 16, description: 'Depreciation check collected', phase: 'collect' },
  { step: 17, description: 'Job capped out & commissions paid', phase: 'collect' },
];

/**
 * Adjuster meeting packet checklist (from training)
 */
export const adjusterMeetingChecklist = [
  { id: 'xactimate', label: 'Xactimate estimate', required: true },
  { id: 'diagram', label: 'Diagram/EagleView + notes', required: true },
  { id: 'agreement', label: 'Copy of agreement with homeowner', required: true },
  { id: 'business_cards', label: 'Business cards (leave on top)', required: false },
  { id: 'arrive_early', label: 'Arrive 30 minutes ahead', required: true },
  { id: 'ladder_setup', label: 'Set up ladder', required: true },
  { id: 'circle_hits', label: 'Circle 5-7 hail hits on roof', required: true },
  { id: 'highlight_damage', label: 'Highlight soft metal damages', required: false },
];
