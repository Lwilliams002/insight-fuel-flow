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
  | 'adjuster_met'
  | 'approved'
  | 'signed'
  // BUILD PHASE
  | 'collect_acv'
  | 'collect_deductible'
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
  | 'paid'
  | 'materials_ordered'
  | 'materials_delivered'
  | 'adjuster_scheduled';

export type CRMPhase = 'sign' | 'build' | 'finalizing' | 'complete' | 'other';

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
    nextStatus: 'signed',
    prevStatus: 'inspection_scheduled',
    stepNumber: 3,
    actionLabel: 'Get Signature',
    requiredFields: ['insurance_company', 'claim_number'],
  },
  adjuster_met: {
    label: 'Awaiting Approval',
    phase: 'sign',
    color: '#EC407A', // Pink
    description: 'Met with adjuster, waiting for insurance approval',
    nextStatus: 'approved',
    prevStatus: 'signed',
    stepNumber: 5,
    actionLabel: 'Mark Approved',
  },
  approved: {
    label: 'Approved',
    phase: 'sign',
    color: '#26A69A', // Teal
    description: 'Insurance approved claim - ready for ACV collection',
    nextStatus: 'collect_acv',
    prevStatus: 'adjuster_met',
    stepNumber: 6,
    actionLabel: 'Collect ACV',
    requiredFields: ['rcv', 'acv', 'depreciation', 'deductible'],
  },
  signed: {
    label: 'Signed',
    phase: 'sign',
    color: '#66BB6A', // Green
    description: 'Agreement signed with homeowner',
    nextStatus: 'adjuster_met',
    prevStatus: 'claim_filed',
    stepNumber: 4,
    actionLabel: 'Meet Adjuster',
    requiredFields: ['signed_date'],
  },

  // ==========================================
  // BUILD PHASE (Steps 7-10)
  // ==========================================
  collect_acv: {
    label: 'Collect ACV',
    phase: 'build',
    color: '#FFA726', // Orange
    description: 'Collect ACV check from insurance',
    nextStatus: 'collect_deductible',
    prevStatus: 'approved',
    stepNumber: 7,
    actionLabel: 'Collect Deductible',
    requiredFields: ['acv'],
  },
  collect_deductible: {
    label: 'Collect Deductible',
    phase: 'build',
    color: '#FF7043', // Deep Orange
    description: 'Collect deductible from homeowner',
    nextStatus: 'install_scheduled',
    prevStatus: 'collect_acv',
    stepNumber: 8,
    actionLabel: 'Schedule Install',
    requiredFields: ['deductible'],
  },
  install_scheduled: {
    label: 'Install Scheduled',
    phase: 'build',
    color: '#8D6E63', // Brown
    description: 'Installation date is set',
    nextStatus: 'installed',
    prevStatus: 'collect_deductible',
    stepNumber: 9,
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
    stepNumber: 10,
    actionLabel: 'Send Invoice',
    requiredFields: ['completion_date'],
  },

  // ==========================================
  // COLLECT PHASE (Steps 11-13)
  // ==========================================
  invoice_sent: {
    label: 'RCV Sent',
    phase: 'finalizing',
    color: '#5C6BC0', // Indigo
    description: 'Invoice sent to insurance for depreciation release',
    nextStatus: 'depreciation_collected',
    prevStatus: 'installed',
    stepNumber: 11,
    actionLabel: 'Collect Depreciation',
    requiredFields: ['invoice_sent_date', 'invoice_amount'],
  },
  depreciation_collected: {
    label: 'Depreciation Collected',
    phase: 'finalizing',
    color: '#26A69A', // Teal
    description: 'Depreciation check collected - ready to close job',
    nextStatus: 'complete',
    prevStatus: 'invoice_sent',
    stepNumber: 12,
    actionLabel: 'Complete Job',
    requiredFields: ['depreciation_check_collected', 'depreciation_check_amount'],
  },
  complete: {
    label: 'Complete',
    phase: 'complete',
    color: '#2E7D32', // Dark Green
    description: 'Job complete! Commissions paid.',
    nextStatus: null,
    prevStatus: 'depreciation_collected',
    stepNumber: 13,
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
    phase: 'finalizing',
    color: '#2E7D32',
    description: 'Legacy: Paid status',
    nextStatus: null,
    prevStatus: 'complete',
    stepNumber: 14,
  },
  // Legacy materials statuses (mapped to new collect flow)
  materials_ordered: {
    label: 'Materials Ordered',
    phase: 'build',
    color: '#FFA726',
    description: 'Legacy: Materials ordered status',
    nextStatus: 'install_scheduled',
    prevStatus: 'signed',
    stepNumber: 8,
  },
  materials_delivered: {
    label: 'Materials Delivered',
    phase: 'build',
    color: '#FF7043',
    description: 'Legacy: Materials delivered status',
    nextStatus: 'install_scheduled',
    prevStatus: 'signed',
    stepNumber: 9,
  },
  adjuster_scheduled: {
    label: 'Adjuster Scheduled',
    phase: 'sign',
    color: '#AB47BC',
    description: 'Legacy: Adjuster scheduled status',
    nextStatus: 'adjuster_met',
    prevStatus: 'claim_filed',
    stepNumber: 4,
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
  return Math.round((config.stepNumber / 12) * 100);
}

/**
 * Phase summary with colors and labels
 */
export const phaseConfig: Record<CRMPhase, { label: string; color: string; icon: string }> = {
  sign: { label: 'Signed', color: '#4A6FA5', icon: '✍️' },
  build: { label: 'Install Review', color: '#FF7043', icon: '🔨' },
  finalizing: { label: 'Finalizing', color: '#2E7D32', icon: '💰' },
  complete: { label: 'Complete', color: '#1B5E20', icon: '✅' },
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
  { step: 15, description: 'Invoice sent to insurance company for release of depreciation', phase: 'finalizing' },
  { step: 16, description: 'Depreciation check collected', phase: 'finalizing' },
  { step: 17, description: 'Job capped out & commissions paid', phase: 'finalizing' },
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

/**
 * Determine what the deal's status should be based on its data
 * This is the auto-progression logic
 */
export interface DealForProgression {
  status?: string;
  // Inspection phase
  inspection_images?: string[] | null;
  // Claim filed phase
  insurance_company?: string | null;
  policy_number?: string | null;
  claim_number?: string | null;
  // Signed phase
  contract_signed?: boolean | null;
  insurance_agreement_url?: string | null;
  signature_url?: string | null;
  // Approval phase
  approval_type?: string | null;
  approved_date?: string | null;
  lost_statement_url?: string | null;  // Required for full approval
  // ACV phase
  acv_receipt_url?: string | null;
  acv_check_collected?: boolean | null;
  // Deductible phase
  deductible_receipt_url?: string | null;
  collect_deductible_date?: string | null;
  // Install phase
  install_date?: string | null;
  install_images?: string[] | null;
  // Invoice phase
  invoice_url?: string | null;
  invoice_sent_date?: string | null;
  // Depreciation phase
  depreciation_receipt_url?: string | null;
  depreciation_check_collected?: boolean | null;
}

/**
 * Calculate the appropriate status based on deal data
 * Returns the status the deal should be at given its current data
 */
export function calculateDealStatus(deal: DealForProgression): DealStatus {
  // Check from the end of the workflow backwards

  // Complete - depreciation receipt generated
  if (deal.depreciation_receipt_url && deal.depreciation_check_collected) {
    return 'complete';
  }

  // Depreciation Collected - invoice sent
  if (deal.invoice_url || deal.invoice_sent_date) {
    if (deal.depreciation_receipt_url) {
      return 'depreciation_collected';
    }
    return 'invoice_sent';
  }

  // Installed - install photos uploaded
  if (deal.install_images && deal.install_images.length > 0) {
    return 'installed';
  }

  // Install Scheduled - install date set
  if (deal.install_date) {
    return 'install_scheduled';
  }

  // Collect Deductible - deductible receipt generated
  if (deal.deductible_receipt_url || deal.collect_deductible_date) {
    return 'collect_deductible';
  }

  // Collect ACV - ACV receipt generated
  if (deal.acv_receipt_url || deal.acv_check_collected) {
    return 'collect_acv';
  }

  // Check if approved and signed
  const hasAgreement = deal.contract_signed || deal.insurance_agreement_url || deal.signature_url;
  const hasApproval = deal.approval_type && ['full', 'partial', 'sale'].includes(deal.approval_type);

  // Signed - agreement signed/uploaded AND approved
  if (hasAgreement && hasApproval) {
    // For full approval, require lost statement to progress to signed
    if (deal.approval_type === 'full' && !deal.lost_statement_url) {
      return 'approved'; // Stay at approved until lost statement uploaded
    }
    return 'signed';
  }

  // Approved - approval type set but not yet signed, OR signed but supplement needed
  if (hasApproval) {
    // For full approval, require lost statement
    if (deal.approval_type === 'full' && !deal.lost_statement_url) {
      return 'approved'; // Approved but need lost statement
    }
    // If approved but no agreement yet
    if (!hasAgreement) {
      return 'approved';
    }
    return 'signed';
  }

  // If agreement is signed but no approval yet - awaiting approval
  if (hasAgreement) {
    // Legacy support: if approved_date is set, consider it approved
    if (deal.approved_date) {
      return 'signed';
    }
    return 'adjuster_met'; // Awaiting approval
  }

  // Claim Filed - insurance details filled
  if (deal.insurance_company && deal.claim_number) {
    return 'claim_filed';
  }

  // Inspection Scheduled - inspection photos uploaded
  if (deal.inspection_images && deal.inspection_images.length > 0) {
    return 'inspection_scheduled';
  }

  // Default to lead
  return 'lead';
}

/**
 * Get what's needed to progress to the next status
 */
export function getProgressionRequirements(status: DealStatus): string[] {
  switch (status) {
    case 'lead':
      return ['Upload inspection photos'];
    case 'inspection_scheduled':
      return ['Fill insurance details (company, policy number, claim number)'];
    case 'claim_filed':
      return ['Sign agreement or upload insurance agreement'];
    case 'adjuster_met':
      return ['Select approval type and mark as approved', 'Upload Lost Statement (required for Full Approval)'];
    case 'approved':
      return ['Agreement already signed - move to collect ACV'];
    case 'signed':
      return ['Generate ACV receipt'];
    case 'collect_acv':
      return ['Generate Deductible receipt'];
    case 'collect_deductible':
      return ['Schedule install date'];
    case 'install_scheduled':
      return ['Upload install photos'];
    case 'installed':
      return ['Generate and send invoice (Admin only)'];
    case 'invoice_sent':
      return ['Generate Depreciation receipt'];
    case 'depreciation_collected':
      return ['Mark job as complete'];
    case 'complete':
      return ['Job complete!'];
    default:
      return [];
  }
}
