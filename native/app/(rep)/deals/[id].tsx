import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, StyleSheet, TextInput, Modal, Image, FlatList, Dimensions, RefreshControl, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';
import SignatureCanvas from 'react-native-signature-canvas';
import DateTimePicker from '@react-native-community/datetimepicker';
import { dealsApi, Deal, uploadFile, uploadLargeFile, getSignedFileUrl, repsApi } from '../../../src/services/api';
import { colors as staticColors } from '../../../src/constants/config';
import { InspectionReport } from '../../../src/components/InspectionReport';
import { PaymentReceipt, ReceiptType } from '../../../src/components/PaymentReceipt';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useTheme } from '../../../src/contexts/ThemeContext';

// Image thumbnail component that fetches signed URL and displays the actual image
function ImageThumbnail({ imageKey, size = 56 }: { imageKey: string; size?: number }) {
  const { colors } = useTheme();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadImage() {
      try {
        const signedUrl = await getSignedFileUrl(imageKey);
        if (mounted) {
          if (signedUrl) {
            setImageUrl(signedUrl);
          } else {
            setError(true);
          }
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadImage();
    return () => { mounted = false; };
  }, [imageKey]);

  if (loading) {
    return (
      <View style={[styles.imageThumb, { width: size, height: size }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error || !imageUrl) {
    return (
      <View style={[styles.imageThumb, { width: size, height: size }]}>
        <Ionicons name="image-outline" size={24} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={[styles.imageThumbImage, { width: size, height: size }]}
      resizeMode="cover"
    />
  );
}

// Milestone configuration - Owner's workflow:
// 1. Knock → Lead
// 2. Set lead for inspection → Schedule inspection
// 3. Inspect roof and take pictures → Upload inspection photos
// 4. Show homeowner inspection report
// 5. File the claim (get adjuster info, schedule adjuster appt, claim info)
// 6. Sign the insurance agreement with homeowner
// 7. Meet adjuster at appt
// 8. Awaiting approval (approval/denial/partial from insurance)
// 9. Collect ACV & deductible, pick materials, schedule install, give receipt
// 10. Install (crew takes progress + completion photos)
// 11. Homeowner signs install completion form
// 12. Send invoice to insurance (if depreciation to collect)
// 13. Collect depreciation, give receipt + roof certificate
// 14. Rep requests payment
// 15. Crew requests payment (after completion photos)
const milestones = [
  { status: 'lead', label: 'Lead', icon: 'person', phase: 'sign' },
  { status: 'inspection_scheduled', label: 'Inspected', icon: 'camera', phase: 'sign' },
  { status: 'claim_filed', label: 'Claim Filed', icon: 'document-text', phase: 'sign' },
  { status: 'adjuster_met', label: 'Adjuster Sched.', icon: 'people', phase: 'sign' },
  { status: 'awaiting_approval', label: 'Awaiting Appr.', icon: 'time', phase: 'sign' },
  { status: 'approved', label: 'Approved', icon: 'checkmark-circle', phase: 'build' },
  { status: 'acv_collected', label: 'ACV Collected', icon: 'cash', phase: 'build' },
  { status: 'deductible_collected', label: 'Ded. Collected', icon: 'cash', phase: 'build' },
  { status: 'materials_selected', label: 'Materials', icon: 'construct', phase: 'build' },
  { status: 'install_scheduled', label: 'Install Sched.', icon: 'calendar', phase: 'build' },
  { status: 'installed', label: 'Installed', icon: 'home', phase: 'build' },
  { status: 'completion_signed', label: 'Completion Form', icon: 'create', phase: 'finalizing' },
  { status: 'invoice_sent', label: 'RCV Sent', icon: 'send', phase: 'finalizing' },
  { status: 'depreciation_collected', label: 'Dep. Collected', icon: 'cash', phase: 'finalizing' },
  { status: 'complete', label: 'Complete', icon: 'trophy', phase: 'complete' },
  { status: 'paid', label: 'Paid', icon: 'checkmark-done', phase: 'complete' },
];

// Workflow steps for rep - matching web app
type RequiredField = {
  field: keyof Deal;
  label: string;
  type: 'text' | 'date' | 'phone' | 'email' | 'number' | 'signature';
};

interface WorkflowStep {
  status: string;
  label: string;
  description: string;
  icon: string;
  requiredFields: RequiredField[];
  adminOnly?: boolean;
}

const workflowSteps: WorkflowStep[] = [
  {
    status: 'lead',
    label: 'Schedule & Complete Inspection',
    description: 'Take inspection photos and show homeowner the report',
    icon: 'camera',
    requiredFields: [],  // Upload photos via docs tab
  },
  {
    status: 'inspection_scheduled',
    label: 'File Claim & Sign Agreement',
    description: 'Call insurance to file claim, get adjuster info, and sign agreement with homeowner',
    icon: 'document-text',
    requiredFields: [
      { field: 'insurance_company', label: 'Insurance Company', type: 'text' },
      { field: 'policy_number', label: 'Policy Number', type: 'text' },
      { field: 'claim_number', label: 'Claim Number', type: 'text' },
      { field: 'date_of_loss', label: 'Date of Loss', type: 'date' },
      { field: 'adjuster_name', label: 'Adjuster Name', type: 'text' },
      { field: 'adjuster_phone', label: 'Adjuster Phone', type: 'phone' },
      { field: 'adjuster_meeting_date', label: 'Adjuster Appointment Date', type: 'date' },
    ],
    // Note: agreement must be signed in Docs tab
  },
  {
    status: 'claim_filed',
    label: 'Enter Financial Details',
    description: 'Upload lost statement, enter insurance values, and schedule adjuster appointment',
    icon: 'document-text',
    requiredFields: [],
  },
  {
    status: 'adjuster_met',
    label: 'Adjuster Scheduled',
    description: 'Adjuster appointment scheduled. Confirm when meeting is complete.',
    icon: 'people',
    requiredFields: [],
    adminOnly: false, // Rep can confirm meeting happened
  },
  {
    status: 'awaiting_approval',
    label: 'Awaiting Admin Approval',
    description: 'Waiting for admin to approve financials.',
    icon: 'time',
    requiredFields: [],
    adminOnly: true, // Admin must approve financials
  },
  {
    status: 'approved',
    label: 'Collect ACV Payment',
    description: 'Collect ACV check from homeowner and give them a receipt',
    icon: 'cash',
    requiredFields: [],
    // acv_receipt required
  },
  {
    status: 'acv_collected',
    label: 'Collect Deductible',
    description: 'Collect deductible from homeowner and give them a receipt',
    icon: 'cash',
    requiredFields: [],
    // deductible_receipt required
  },
  {
    status: 'deductible_collected',
    label: 'Select Materials',
    description: 'Pick roof materials and colors with homeowner',
    icon: 'construct',
    requiredFields: [],
    // Material specs required
  },
  {
    status: 'materials_selected',
    label: 'Ready for Install',
    description: 'All info collected - waiting for admin to schedule install',
    icon: 'calendar',
    requiredFields: [],
    adminOnly: true, // Admin schedules install
  },
  {
    status: 'install_scheduled',
    label: 'Installation In Progress',
    description: 'Crew is installing. They will upload progress & completion photos.',
    icon: 'hammer',
    requiredFields: [],
    adminOnly: true, // Crew/Admin handles
  },
  {
    status: 'installed',
    label: 'Get Completion Signature',
    description: 'Have homeowner sign the installation completion form',
    icon: 'create',
    requiredFields: [],
    // completion form signature required
  },
  {
    status: 'completion_signed',
    label: 'RCV Sent',
    description: 'Final invoice sent to insurance for depreciation (if applicable)',
    icon: 'send',
    requiredFields: [],
    adminOnly: true, // Admin sends invoice
  },
  {
    status: 'invoice_sent',
    label: 'Collect Depreciation',
    description: 'Collect depreciation payment from homeowner, give receipt + roof certificate',
    icon: 'receipt',
    requiredFields: [],
    // depreciation_receipt required
  },
  {
    status: 'depreciation_collected',
    label: 'Request Commission',
    description: 'All payments collected! Request your commission.',
    icon: 'trophy',
    requiredFields: [],
  },
  {
    status: 'complete',
    label: 'Waiting for Commission',
    description: 'Waiting for admin to approve commission payment',
    icon: 'time',
    requiredFields: [],
    adminOnly: true,
  },
  {
    status: 'paid',
    label: 'Paid!',
    description: 'Commission has been paid! 💰',
    icon: 'checkmark-done',
    requiredFields: [],
    adminOnly: true,
  },
];

// Get current workflow step index
function getWorkflowStepIndex(status: string): number {
  const index = workflowSteps.findIndex(s => s.status === status);
  return index >= 0 ? index : 0;
}

// Check if step requirements are met
function isStepComplete(deal: Deal, step: WorkflowStep): boolean {
  if (step.requiredFields.length === 0) return true;
  return step.requiredFields.every(req => {
    const value = deal[req.field];
    if (req.type === 'signature') {
      return deal.contract_signed === true;
    }
    if (value === null || value === undefined || value === '') return false;
    return true;
  });
}

const statusConfig: Record<string, { label: string; color: string; description: string; nextAction: string }> = {
  lead: { label: 'Lead', color: '#4A6FA5', description: 'Take inspection photos and show report', nextAction: 'Upload Photos' },
  inspection_scheduled: { label: 'Inspected', color: '#5C6BC0', description: 'Inspection complete', nextAction: 'File Claim' },
  claim_filed: { label: 'Claim Filed', color: '#7E57C2', description: 'Claim filed, agreement signed', nextAction: 'Schedule Adjuster' },
  adjuster_met: { label: 'Adjuster Scheduled', color: '#EC407A', description: 'Adjuster appointment scheduled', nextAction: 'Wait for Decision' },
  awaiting_approval: { label: 'Awaiting Approval', color: '#F59E0B', description: 'Waiting for admin to approve financials', nextAction: 'Upload Loss Statement' },
  approved: { label: 'Approved', color: '#26A69A', description: 'Insurance approved!', nextAction: 'Collect ACV' },
  acv_collected: { label: 'ACV Collected', color: '#FFA726', description: 'ACV payment collected', nextAction: 'Collect Deductible' },
  deductible_collected: { label: 'Deductible Collected', color: '#FF7043', description: 'Deductible collected', nextAction: 'Select Materials' },
  materials_selected: { label: 'Materials Selected', color: '#8B5CF6', description: 'Materials and colors picked', nextAction: 'Wait for Install' },
  install_scheduled: { label: 'Install Scheduled', color: '#8D6E63', description: 'Installation date is set', nextAction: 'Wait for Crew' },
  installed: { label: 'Installed', color: '#78909C', description: 'Installation completed', nextAction: 'Get Completion Form' },
  completion_signed: { label: 'Completion Form Signed', color: '#06B6D4', description: 'Homeowner signed completion', nextAction: 'Wait for Invoice' },
  invoice_sent: { label: 'RCV Sent', color: '#5C6BC0', description: 'RCV sent to insurance', nextAction: 'Collect Depreciation' },
  depreciation_collected: { label: 'Depreciation Collected', color: '#26A69A', description: 'Final payment collected', nextAction: 'Request Commission' },
  complete: { label: 'Complete', color: '#2E7D32', description: 'Job complete! 🎉', nextAction: 'Wait for Payment' },
  paid: { label: 'Paid', color: '#059669', description: 'Commission paid! 💰', nextAction: '' },
};

const phaseLabels: Record<string, string> = {
  sign: 'SIGN',
  build: 'BUILD',
  finalizing: 'FINALIZING',
  complete: 'COMPLETE',
};

const phaseColors: Record<string, string> = {
  sign: '#3B82F6',
  build: '#F97316',
  finalizing: '#EAB308',
  complete: '#22C55E',
};

// Helper function to get milestone timestamp from deal data
const getMilestoneTimestamp = (deal: Deal, milestoneStatus: string, currentIndex: number, milestoneIndex: number): string | null => {
  // Only show timestamps for completed milestones
  const isComplete = milestoneIndex <= currentIndex;
  if (!isComplete) return null;

  // Map milestone status to the most relevant date field
  const statusToDateField: Record<string, keyof Deal> = {
    'lead': 'created_at',
    'inspection_scheduled': 'inspection_date',
    'claim_filed': 'claim_filed_date',
    'signed': 'signed_date',
    'adjuster_met': 'adjuster_meeting_date',
    'awaiting_approval': 'updated_at',
    'approved': 'approved_date',
    'acv_collected': 'collect_acv_date',
    'deductible_collected': 'collect_deductible_date',
    'materials_selected': 'updated_at',
    'install_scheduled': 'install_date',
    'installed': 'installed_date',
    'completion_signed': 'updated_at',
    'invoice_sent': 'invoice_sent_date',
    'depreciation_collected': 'depreciation_collected_date',
    'complete': 'complete_date',
    'paid': 'commission_paid_date',
  };

  const dateField = statusToDateField[milestoneStatus];
  if (!dateField) return null;

  let dateValue = deal[dateField];

  // Fallback to updated_at if the specific field is empty
  if (!dateValue && dateField !== 'updated_at') {
    dateValue = deal.updated_at;
  }

  if (!dateValue) return null;

  try {
    const date = new Date(dateValue as string);
    if (isNaN(date.getTime())) return null;
    return format(date, 'MM/dd/yy');
  } catch {
    return null;
  }
};

type TabType = 'overview' | 'insurance' | 'docs';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const milestoneScrollRef = useRef<ScrollView>(null);
  const { user } = useAuth();
  const { colors, isDark } = useTheme();

  // Commission level percentages - matches web app RepsManagement
  const commissionLevelPercentages: Record<string, number> = {
    'junior': 5,
    'senior': 10,
    'manager': 13,
  };

  // Commission level display names
  const commissionLevelDisplayNames: Record<string, string> = {
    'junior': 'Junior',
    'senior': 'Senior',
    'manager': 'Manager',
  };

  // Fetch current rep's info for commission level
  const { data: currentRep } = useQuery({
    queryKey: ['currentRep', user?.sub],
    queryFn: async () => {
      if (!user?.sub) return null;
      const result = await repsApi.list();
      if (result.error) return null;
      const rep = result.data?.find(r => r.user_id === user.sub);
      return rep || null;
    },
    enabled: !!user?.sub,
  });

  // Get the rep's commission percentage - prioritize the database value
  const repCommissionPercent =
    (currentRep?.default_commission_percent && currentRep.default_commission_percent > 0)
      ? currentRep.default_commission_percent
      : commissionLevelPercentages[currentRep?.commission_level || ''] || 0;

  // Get the rep's commission level display name
  const repCommissionLevelName = commissionLevelDisplayNames[currentRep?.commission_level || ''] || currentRep?.commission_level || '';

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [isEditingInsurance, setIsEditingInsurance] = useState(false);
  const [isEditingMaterials, setIsEditingMaterials] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewingImages, setViewingImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [showInspectionReport, setShowInspectionReport] = useState(false);
  const [showPaymentReceipt, setShowPaymentReceipt] = useState(false);
  const [receiptType, setReceiptType] = useState<ReceiptType>('acv');
  const [showHtmlViewer, setShowHtmlViewer] = useState(false);
  const [htmlViewerContent, setHtmlViewerContent] = useState<string>('');
  const [hideCommission, setHideCommission] = useState(true); // Hide commission by default when presenting to homeowner
  const [htmlViewerTitle, setHtmlViewerTitle] = useState<string>('');

  // Form state
  const [overviewForm, setOverviewForm] = useState({
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    roof_type: '',
    roof_squares: '',
    notes: '',
  });

  const [insuranceForm, setInsuranceForm] = useState({
    insurance_company: '',
    policy_number: '',
    claim_number: '',
    date_of_loss: '',
    deductible: '',
    rcv: '',
    acv: '',
    depreciation: '',
    adjuster_name: '',
    adjuster_phone: '',
  });

  const [materialsForm, setMaterialsForm] = useState({
    material_category: '',
    material_type: '',
    material_color: '',
    drip_edge: '',
    vent_color: '',
  });

  // Autosave state for materials
  const [materialsLastSaved, setMaterialsLastSaved] = useState<Date | null>(null);
  const [materialsSaving, setMaterialsSaving] = useState(false);
  const materialsAutosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Workflow form state for step completion
  const [workflowForm, setWorkflowForm] = useState<Record<string, string | number | boolean | null>>({});
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showCompletionFormSignature, setShowCompletionFormSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreementScrollEnabled, setAgreementScrollEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdjusterDatePicker, setShowAdjusterDatePicker] = useState(false);
  const [adjusterDatePickerValue, setAdjusterDatePickerValue] = useState<Date>(new Date());
  const signatureRef = useRef<any>(null);
  const completionSignatureRef = useRef<any>(null);
  const homeownerCompletionSignatureRef = useRef<any>(null);
  const [savingCompletionForm, setSavingCompletionForm] = useState(false);
  const [repCompletionSignature, setRepCompletionSignature] = useState<string | null>(null);
  const [homeownerCompletionSignature, setHomeownerCompletionSignature] = useState<string | null>(null);
  const [showCompletionFormViewer, setShowCompletionFormViewer] = useState(false);
  const [completionFormHtmlContent, setCompletionFormHtmlContent] = useState<string | null>(null);
  const [signedRepCompletionSigUrl, setSignedRepCompletionSigUrl] = useState<string | null>(null);
  const [signedHomeownerCompletionSigUrl, setSignedHomeownerCompletionSigUrl] = useState<string | null>(null);

  // Completion form additional state - for new form fields
  const [completionFormStep, setCompletionFormStep] = useState(0); // 0=reading, 1=section1 initials, 2=section2 initials, 3=owner sig, 4=titan pro sig
  const [crewLeadName, setCrewLeadName] = useState('');
  const [walkThroughType, setWalkThroughType] = useState<'in_person' | 'virtual' | 'declined' | null>(null);
  const [individualsOwners, setIndividualsOwners] = useState('');
  const [individualsTitanPro, setIndividualsTitanPro] = useState('');
  const [individualsOthers, setIndividualsOthers] = useState('');
  const [section1Initials, setSection1Initials] = useState<string | null>(null);
  const [section2Initials, setSection2Initials] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState('');
  const completionFormSignatureRef = useRef<any>(null);

  // Agreement signature state - multiple signatures/initials
  const [agreementStep, setAgreementStep] = useState(0); // 0=reading, 1-6=signing steps
  const [feeInitials, setFeeInitials] = useState<string | null>(null);
  const [repSignature, setRepSignature] = useState<string | null>(null);
  const [ownerSignature, setOwnerSignature] = useState<string | null>(null);
  const [deckingInitials, setDeckingInitials] = useState<string | null>(null);
  const [constructionSignature, setConstructionSignature] = useState<string | null>(null);
  const [supplementsSignature, setSupplementsSignature] = useState<string | null>(null);
  const agreementSignatureRef = useRef<any>(null);

  // Date picker states
  const [showDateOfLossPicker, setShowDateOfLossPicker] = useState(false);
  const [dateOfLossPickerValue, setDateOfLossPickerValue] = useState<Date>(new Date());

  const { data: deal, isLoading, error, refetch } = useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      const response = await dealsApi.get(id);
      if (response.error) throw new Error(response.error);
      const d = response.data!;
      // Initialize forms
      setOverviewForm({
        homeowner_name: d.homeowner_name || '',
        homeowner_phone: d.homeowner_phone || '',
        homeowner_email: d.homeowner_email || '',
        address: d.address || '',
        city: d.city || '',
        state: d.state || '',
        zip_code: d.zip_code || '',
        roof_type: d.roof_type || '',
        roof_squares: d.roof_squares?.toString() || '',
        notes: d.notes || '',
      });
      setInsuranceForm({
        insurance_company: d.insurance_company || '',
        policy_number: d.policy_number || '',
        claim_number: d.claim_number || '',
        date_of_loss: d.date_of_loss || '',
        deductible: d.deductible?.toString() || '',
        rcv: d.rcv?.toString() || '',
        acv: d.acv?.toString() || '',
        depreciation: d.depreciation?.toString() || '',
        adjuster_name: d.adjuster_name || '',
        adjuster_phone: d.adjuster_phone || '',
      });
      setMaterialsForm({
        material_category: d.material_category || '',
        material_type: d.material_type || '',
        material_color: d.material_color || '',
        drip_edge: d.drip_edge || '',
        vent_color: d.vent_color || '',
      });
      return d;
    },
    enabled: !!id,
    staleTime: 10000, // 10 seconds
    refetchInterval: 15000, // Auto-refresh every 15 seconds to get admin updates
    refetchOnMount: 'always',
  });

  // Fetch signed URLs for completion form signatures when deal loads
  useEffect(() => {
    async function fetchSignedSignatureUrls() {
      if (deal?.completion_form_signature_url) {
        const signedUrl = await getSignedFileUrl(deal.completion_form_signature_url);
        setSignedRepCompletionSigUrl(signedUrl);
      }
      if (deal?.homeowner_completion_signature_url) {
        const signedUrl = await getSignedFileUrl(deal.homeowner_completion_signature_url);
        setSignedHomeownerCompletionSigUrl(signedUrl);
      }
    }
    fetchSignedSignatureUrls();
  }, [deal?.completion_form_signature_url, deal?.homeowner_completion_signature_url]);

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Deal>) => {
      const response = await dealsApi.update(id, updates);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsEditingOverview(false);
      setIsEditingInsurance(false);
      setIsEditingMaterials(false);
      Alert.alert('Success', 'Deal updated successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to update deal');
    },
  });

  // Silent update mutation for autosave (no alerts)
  const silentUpdateMutation = useMutation({
    mutationFn: async (updates: Partial<Deal>) => {
      const response = await dealsApi.update(id, updates);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  // Autosave effect for materials
  useEffect(() => {
    if (!isEditingMaterials || !deal) return;

    // Check if form has changes from saved deal
    const hasChanges =
      materialsForm.material_category !== (deal.material_category || '') ||
      materialsForm.material_type !== (deal.material_type || '') ||
      materialsForm.material_color !== (deal.material_color || '') ||
      materialsForm.drip_edge !== (deal.drip_edge || '') ||
      materialsForm.vent_color !== (deal.vent_color || '');

    if (!hasChanges) return;

    // Clear existing timeout
    if (materialsAutosaveTimeoutRef.current) {
      clearTimeout(materialsAutosaveTimeoutRef.current);
    }

    // Set new autosave timeout (2 seconds after last change)
    materialsAutosaveTimeoutRef.current = setTimeout(() => {
      setMaterialsSaving(true);
      silentUpdateMutation.mutate(
        {
          material_category: materialsForm.material_category || null,
          material_type: materialsForm.material_type || null,
          material_color: materialsForm.material_color || null,
          drip_edge: materialsForm.drip_edge || null,
          vent_color: materialsForm.vent_color || null,
        },
        {
          onSuccess: () => {
            setMaterialsLastSaved(new Date());
            setMaterialsSaving(false);
          },
          onError: () => {
            setMaterialsSaving(false);
          },
        }
      );
    }, 2000);

    return () => {
      if (materialsAutosaveTimeoutRef.current) {
        clearTimeout(materialsAutosaveTimeoutRef.current);
      }
    };
  }, [materialsForm, isEditingMaterials, deal]);

  const handleSaveOverview = () => {
    updateMutation.mutate({
      homeowner_name: overviewForm.homeowner_name,
      homeowner_phone: overviewForm.homeowner_phone || null,
      homeowner_email: overviewForm.homeowner_email || null,
      address: overviewForm.address,
      city: overviewForm.city || null,
      state: overviewForm.state || null,
      zip_code: overviewForm.zip_code || null,
      roof_type: overviewForm.roof_type || null,
      roof_squares: overviewForm.roof_squares ? parseFloat(overviewForm.roof_squares) : null,
      notes: overviewForm.notes || null,
    });
  };

  const handleSaveInsurance = () => {
    updateMutation.mutate({
      insurance_company: insuranceForm.insurance_company || null,
      policy_number: insuranceForm.policy_number || null,
      claim_number: insuranceForm.claim_number || null,
      date_of_loss: insuranceForm.date_of_loss || null,
      deductible: insuranceForm.deductible ? parseFloat(insuranceForm.deductible) : null,
      rcv: insuranceForm.rcv ? parseFloat(insuranceForm.rcv) : null,
      acv: insuranceForm.acv ? parseFloat(insuranceForm.acv) : null,
      depreciation: insuranceForm.depreciation ? parseFloat(insuranceForm.depreciation) : null,
      adjuster_name: insuranceForm.adjuster_name || null,
      adjuster_phone: insuranceForm.adjuster_phone || null,
    });
  };

  const handleStatusChange = (newStatus: string) => {
    // Reps can no longer arbitrarily change status - only through workflow completion
    setShowStatusPicker(false);
    Alert.alert(
      'Status Change',
      'Status changes happen automatically when you complete the required fields for each step.',
      [{ text: 'OK' }]
    );
  };

  // Get current workflow step
  const getCurrentWorkflowStep = () => {
    if (!deal) return null;
    return workflowSteps.find(s => s.status === deal.status) || workflowSteps[0];
  };

  // Get next status based on workflow
  const getNextStatus = () => {
    if (!deal) return null;
    const currentStepIndex = getWorkflowStepIndex(deal.status);
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= workflowSteps.length) return null;
    return workflowSteps[nextIndex].status;
  };

  // Debounce timer ref for auto-saving
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle workflow form field change - auto-saves to database
  const handleWorkflowFieldChange = (field: string, value: string | number | boolean | null) => {
    setWorkflowForm(prev => ({ ...prev, [field]: value }));

    // Also update insuranceForm if it's an insurance-related field so the Insurance tab reflects changes
    const insuranceFields = ['insurance_company', 'policy_number', 'claim_number', 'date_of_loss', 'deductible', 'rcv', 'acv', 'depreciation', 'adjuster_name', 'adjuster_phone'];
    if (insuranceFields.includes(field)) {
      setInsuranceForm(prev => ({
        ...prev,
        [field]: value !== null ? String(value) : ''
      }));
    }

    // Fields that may not exist in database yet - skip auto-save for these
    // They will be saved when the user clicks "Save & Continue"
    const newFieldsToSkip = ['date_type', 'adjuster_not_assigned'];
    if (newFieldsToSkip.includes(field)) {
      return; // Don't auto-save these fields
    }

    // Auto-save to database with debounce (500ms delay)
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      if (!deal) return;
      try {
        // Save just this field to the database
        await dealsApi.update(deal.id, { [field]: value });
        // Silently invalidate the cache so next refetch has latest data
        queryClient.invalidateQueries({ queryKey: ['deal', id] });
      } catch (error) {
        console.warn('[Auto-save] Failed to save field:', field, error);
      }
    }, 500);
  };

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Handle signature save - called after all 6 signatures are collected
  const handleSignatureSave = async (finalSignature: string) => {
    if (!deal) return;
    setShowSignaturePad(false);
    setAgreementStep(0);
    setSavingWorkflow(true);

    // Use the collected signatures - capture them before any state changes
    const feeInitialsSig = feeInitials || '';
    const repSig = repSignature || '';
    const ownerSig = ownerSignature || '';
    const deckingInitialsSig = deckingInitials || '';
    const constructionSig = constructionSignature || '';
    const supplementsSig = finalSignature; // This is the last one captured

    console.log('[handleSignatureSave] Signatures collected:', {
      feeInitials: feeInitialsSig ? 'yes' : 'no',
      repSignature: repSig ? 'yes' : 'no',
      ownerSignature: ownerSig ? 'yes' : 'no',
      deckingInitials: deckingInitialsSig ? 'yes' : 'no',
      constructionSignature: constructionSig ? 'yes' : 'no',
      supplementsSignature: supplementsSig ? 'yes' : 'no',
    });

    try {
      // Upload the main owner signature image
      const signatureFileName = `signature-${Date.now()}.png`;
      const signatureUploadResult = await uploadFile(
        ownerSig,
        signatureFileName,
        'image/png',
        'signatures',
        deal.id
      );

      // Generate the full agreement HTML document with all embedded signatures
      const agreementHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Insurance-Contingent Roofing Agreement - ${deal.homeowner_name}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; font-size: 12px; line-height: 1.5; }
    .header { background: #0F1E2E; color: white; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
    .header h2 { margin: 8px 0 0; font-size: 14px; font-weight: normal; }
    .divider { text-align: center; margin: 20px 0; color: #666; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 10px; text-transform: uppercase; border-bottom: 2px solid #0F1E2E; padding-bottom: 5px; }
    .info-row { display: flex; border-bottom: 1px solid #ddd; padding: 8px 0; }
    .info-label { font-weight: 600; width: 180px; flex-shrink: 0; }
    .info-value { flex: 1; }
    .content-text { margin-bottom: 15px; text-align: justify; }
    .fee-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .fee-highlight { font-weight: 700; color: #0F1E2E; }
    .cancel-box { background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .notice-box { background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .notice-title { font-weight: 700; color: #92400e; margin-bottom: 10px; }
    .warning-box { background: #fee2e2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .warning-text { color: #dc2626; font-weight: 600; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px; }
    .signature-box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
    .signature-label { font-size: 11px; color: #6b7280; margin-bottom: 5px; }
    .signature-line { border-bottom: 1px solid #333; min-height: 30px; margin-bottom: 5px; padding: 5px; }
    .signature-image { max-width: 200px; max-height: 60px; display: block; margin: 5px 0; }
    .initials-image { max-width: 100px; max-height: 50px; display: inline-block; margin-left: 10px; }
    .signature-date { font-size: 11px; color: #6b7280; margin-top: 8px; }
    .acknowledgment { margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc; }
    .ack-title { font-weight: 700; text-align: center; margin-bottom: 15px; font-size: 14px; }
    .ack-row { display: flex; align-items: flex-end; gap: 20px; margin-top: 15px; }
    .ack-sig { flex: 2; }
    .ack-date { flex: 1; }
    p { margin: 0 0 12px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>TITAN PRIME SOLUTIONS</h1>
    <h2>INSURANCE-CONTINGENT ROOFING AGREEMENT</h2>
  </div>

  <div class="section">
    <div class="section-title">Owner & Claim Information</div>
    <div class="info-row"><span class="info-label">Owner Full Name:</span><span class="info-value">${deal.homeowner_name || ''}</span></div>
    <div class="info-row"><span class="info-label">Property Address:</span><span class="info-value">${deal.address || ''}${deal.city ? `, ${deal.city}` : ''}${deal.state ? `, ${deal.state}` : ''}${deal.zip_code ? ` ${deal.zip_code}` : ''}</span></div>
    <div class="info-row"><span class="info-label">Primary Phone:</span><span class="info-value">${deal.homeowner_phone || ''}</span></div>
    <div class="info-row"><span class="info-label">Email Address:</span><span class="info-value">${deal.homeowner_email || ''}</span></div>
    <div class="info-row"><span class="info-label">Insurance Carrier:</span><span class="info-value">${deal.insurance_company || ''}</span></div>
    <div class="info-row"><span class="info-label">Policy ID:</span><span class="info-value">${deal.policy_number || ''}</span></div>
    <div class="info-row"><span class="info-label">Claim Reference #:</span><span class="info-value">${deal.claim_number || ''}</span></div>
    <div class="info-row"><span class="info-label">Reported Date of Loss:</span><span class="info-value">${deal.date_of_loss ? format(new Date(deal.date_of_loss), 'MMMM d, yyyy') : ''}</span></div>
    <div class="info-row"><span class="info-label">Roofing System Type:</span><span class="info-value">${deal.roofing_system_type || deal.roof_type || deal.material_category || ''}</span></div>
    <div class="info-row"><span class="info-label">Assigned Adjuster Name:</span><span class="info-value">${deal.adjuster_not_assigned ? 'N/A' : (deal.adjuster_name || '')}</span></div>
    <div class="info-row"><span class="info-label">Adjuster Phone #:</span><span class="info-value">${deal.adjuster_not_assigned ? 'N/A' : (deal.adjuster_phone || '')}</span></div>
    <div class="info-row"><span class="info-label">Sales Rep (Prime PRO):</span><span class="info-value">${deal.rep_name || currentRep?.full_name || user?.fullName || ''}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Insurance Contingency & Claim Services</div>
    <p class="content-text">This Agreement is entered into based on the outcome of the insurance claim process. Titan Prime Solutions' scope of work is limited to items approved by the insurer. Owner is responsible for any applicable deductible and for any upgrades, additions, or services not included in the insurer's determination of coverage. Owner agrees to provide Titan Prime Solutions with relevant insurance documentation necessary to perform the work.</p>
  </div>


  <div class="section">
    <div class="section-title">Insurance Claim Services Fee (Approval-Based)</div>
    <p class="content-text">If Owner cancels this Agreement after insurance approval and after Titan Prime Solutions has performed insurance-related services, including inspections, measurements, documentation, claim preparation, or insurer coordination, Owner agrees to pay Titan Prime Solutions a flat claim services fee of <strong>$1,250</strong>.</p>
    <p class="content-text">This fee reflects the reasonable value of services rendered and is not based on insurance proceeds. The fee becomes due and payable upon cancellation following claim approval.</p>
    <div class="fee-box">
      <span class="fee-highlight">$1,250 Claim Services Fee – Owner Initials:</span>
      ${feeInitialsSig ? `<img src="${feeInitialsSig}" class="initials-image" alt="Fee Initials" />` : '<span style="color:#999;">Not signed</span>'}
    </div>
  </div>

  <div class="section">
    <div class="section-title">3-Day Right to Cancel</div>
    <div class="cancel-box">
      <p class="content-text" style="margin-bottom: 10px;">Owner may terminate this Agreement within three (3) business days of execution by providing written notice via email to <strong>titanprimesolutionstx@gmail.com</strong>, which must be received no later than the close of business on the third business day following execution of this Agreement.</p>
      <p class="content-text" style="margin-bottom: 0;">This Agreement is governed by the laws of the State of Texas.</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Acceptance</div>
    <div class="signature-grid">
      <div class="signature-box">
        <div class="signature-label">Prime PRO (Printed Name)</div>
        <div class="signature-line">${deal.rep_name || currentRep?.full_name || user?.fullName || ''}</div>
        <div class="signature-label">Signature</div>
        ${repSig ? `<img src="${repSig}" class="signature-image" alt="Rep Signature" />` : '<div class="signature-line"></div>'}
      </div>
      <div class="signature-box">
        <div class="signature-label">Property Owner (Printed Name)</div>
        <div class="signature-line">${deal.homeowner_name || ''}</div>
        <div class="signature-label">Signature</div>
        ${ownerSig ? `<img src="${ownerSig}" class="signature-image" alt="Owner Signature" />` : '<div class="signature-line"></div>'}
        <div class="signature-date">Date Signed: ${format(new Date(), 'MMMM d, yyyy')}</div>
      </div>
    </div>
  </div>


  <div class="notice-box">
    <div class="notice-title">IMPORTANT NOTICE TO PROPERTY OWNER</div>
    <p>Titan Prime Solutions will begin work on the scheduled installation date during normal construction hours and may mobilize crews, equipment, and materials without additional notice.</p>
    <p>Roof installation requires fastening materials through roof decking in accordance with applicable building codes. As a result, fasteners may be visible from attic or interior roof areas.</p>
    <p>Authorized representatives of Titan Prime Solutions, including crew members, supervisors, inspectors, and documentation personnel, may access the Property as required to perform or document the work.</p>
    <p>The Owner is responsible for removing vehicles, personal property, and exterior items from areas surrounding the Property that could be affected by falling debris.</p>
    <p>A dumpster or equipment trailer may be placed in the most accessible area of the Property and may temporarily block driveway or garage access.</p>
    <p>Construction vibration may occur. The Owner should remove or secure items mounted on interior walls.</p>
    <p>Certain existing components, including skylights, drywall, ceiling finishes, gutters, stucco, paint, patio covers, or HVAC components, may be affected due to age, prior installation, or vibration. Titan Prime Solutions is not responsible for incidental damage to pre-existing materials resulting from normal and non-negligent construction activities.</p>
    <p>Construction areas may contain nails, tools, cords, or debris. The Owner is responsible for keeping occupants and visitors clear of work areas.</p>
    <p>Permits may be posted on the Property as required and must remain until inspections are completed.</p>
    <p>If satellite, internet, or similar services require disconnection or adjustment, the Owner is responsible for coordinating reconnection.</p>
    <p>The Owner must disclose any concealed utilities or systems beneath the roof decking prior to installation.</p>
    <p>Existing HVAC components showing corrosion or deterioration will be reinstalled as-is unless replacement is authorized.</p>
    <p>The Owner is responsible for HOA compliance, including material and color approvals.</p>
    <div class="warning-box">
      <p class="warning-text" style="margin: 0 0 10px 0;">Replacement of rotted decking, if discovered, will be charged at $3.00 per square foot.</p>
      <div>
        <span>Owner Initials:</span>
        ${deckingInitialsSig ? `<img src="${deckingInitialsSig}" class="initials-image" alt="Decking Initials" />` : '<span style="color:#999;">Not signed</span>'}
      </div>
    </div>
    <p>Abusive or unprofessional conduct toward Contractor personnel may result in suspension of work and termination of the Agreement, with the Owner responsible for costs incurred.</p>
  </div>

  <div class="acknowledgment">
    <div class="ack-title">ACKNOWLEDGMENT – CONSTRUCTION NOTICE</div>
    <div class="info-row"><span class="info-label">Owner Name:</span><span class="info-value">${deal.homeowner_name || ''}</span></div>
    <div class="info-row"><span class="info-label">Property Address:</span><span class="info-value">${deal.address || ''}</span></div>
    <div class="ack-row">
      <div class="ack-sig">
        <div class="signature-label">Owner Signature:</div>
        ${constructionSig ? `<img src="${constructionSig}" class="signature-image" alt="Construction Notice Signature" />` : '<div class="signature-line"></div>'}
      </div>
      <div class="ack-date">
        <div class="signature-label">Date:</div>
        <div>${format(new Date(), 'MM/dd/yyyy')}</div>
      </div>
    </div>
  </div>

  <div class="divider">⸻</div>

  <div class="section">
    <div class="section-title">Notice Regarding Additional Insurance Requests (Supplements)</div>
    <p class="content-text">During the course of an insurance-related roofing project, additional damage, labor, or materials may be identified that were not included in the insurer's initial estimate. When this occurs, Contractor may submit additional documentation to the insurance company requesting review of those items.</p>
    <p class="content-text">These requests may be necessary when certain conditions were not visible at the time of the original inspection or when quantities differ from the insurer's original assessment.</p>
    <p class="content-text">For example, if the insurer's estimate is based on one material quantity, but actual installation requires a greater amount due to roof configuration, waste factors, or hidden conditions, additional documentation may be submitted for the difference.</p>
    <p class="content-text">Insurance coverage decisions are governed by the terms and exclusions of the policy.</p>
  </div>

  <div class="acknowledgment">
    <div class="ack-title">ACKNOWLEDGMENT – INSURANCE SUPPLEMENTS</div>
    <div class="info-row"><span class="info-label">Owner Name:</span><span class="info-value">${deal.homeowner_name || ''}</span></div>
    <div class="info-row"><span class="info-label">Property Address:</span><span class="info-value">${deal.address || ''}</span></div>
    <div class="ack-row">
      <div class="ack-sig">
        <div class="signature-label">Owner Signature:</div>
        ${supplementsSig ? `<img src="${supplementsSig}" class="signature-image" alt="Supplements Signature" />` : '<div class="signature-line"></div>'}
      </div>
      <div class="ack-date">
        <div class="signature-label">Date:</div>
        <div>${format(new Date(), 'MM/dd/yyyy')}</div>
      </div>
    </div>
  </div>

</body>
</html>
      `.trim();

      // Generate PDF from HTML and upload to Wasabi (like receipts do)
      let agreementUrl = '';
      try {
        const { uri } = await Print.printToFileAsync({ html: agreementHtml });
        console.log('[handleSignatureSave] Generated PDF at:', uri);

        // Upload PDF to Wasabi
        const pdfFileName = `agreement-${deal.id}-${Date.now()}.pdf`;
        const uploadResult = await uploadFile(
          uri,
          pdfFileName,
          'application/pdf',
          'agreements',
          deal.id
        );

        if (uploadResult?.key) {
          agreementUrl = uploadResult.key;
          console.log('[handleSignatureSave] Uploaded agreement to:', agreementUrl);
        }
      } catch (pdfError) {
        console.warn('[handleSignatureSave] PDF generation failed, falling back to base64:', pdfError);
        // Fallback to base64 if PDF generation fails
        const agreementBase64 = btoa(unescape(encodeURIComponent(agreementHtml)));
        agreementUrl = `data:text/html;base64,${agreementBase64}`;
      }

      // Update deal with signature and agreement document
      const updates: Partial<Deal> = {
        contract_signed: true,
        signed_date: new Date().toISOString().split('T')[0],
        signature_url: signatureUploadResult?.key || ownerSig,
        agreement_document_url: agreementUrl,
      };

      const result = await dealsApi.update(deal.id, updates);
      if (result.error) throw new Error(result.error);

      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', id] });

      // Reset all signature state
      setFeeInitials(null);
      setRepSignature(null);
      setOwnerSignature(null);
      setDeckingInitials(null);
      setConstructionSignature(null);
      setSupplementsSignature(null);

      Alert.alert('Success', 'Agreement signed successfully with all signatures!');
      setSignatureData(null);
      setAgreementScrollEnabled(true);
      refetch();
    } catch (error) {
      console.error('Signature save error:', error);
      Alert.alert('Error', 'Failed to save agreement: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSavingWorkflow(false);
    }
  };

  // Handle completion form save - called after all 4 signatures are collected
  const handleSaveCompletionForm = async (titanProSig: string) => {
    if (!deal) return;
    setSavingCompletionForm(true);

    // Capture all signatures before state changes
    const sec1Initials = section1Initials || '';
    const sec2Initials = section2Initials || '';
    const ownerSig = homeownerCompletionSignature || '';
    const proSig = titanProSig;

    console.log('[Completion Form] Signatures collected:', {
      section1Initials: sec1Initials ? 'yes' : 'no',
      section2Initials: sec2Initials ? 'yes' : 'no',
      ownerSignature: ownerSig ? 'yes' : 'no',
      titanProSignature: proSig ? 'yes' : 'no',
    });

    try {
      const updates: Partial<Deal> = {};

      // Upload owner signature
      if (ownerSig) {
        const ownerSigFileName = `homeowner_completion_signature-${Date.now()}.png`;
        const result = await uploadFile(ownerSig, ownerSigFileName, 'image/png', 'completion_form', deal.id);
        if (result?.key) {
          updates.homeowner_completion_signature_url = result.key;
        }
      }

      // Upload Titan PRO signature
      if (proSig) {
        const proSigFileName = `rep_completion_signature-${Date.now()}.png`;
        const result = await uploadFile(proSig, proSigFileName, 'image/png', 'completion_form', deal.id);
        if (result?.key) {
          updates.completion_form_signature_url = result.key;
        }
      }

      // Generate the full completion form HTML document
      const completionFormHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Final Completion & Walk-Through Record - ${deal.homeowner_name}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; font-size: 12px; line-height: 1.5; }
    .header { background: #0F1E2E; color: white; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
    .header h2 { margin: 8px 0 0; font-size: 14px; font-weight: normal; }
    .intro { font-style: italic; margin-bottom: 20px; color: #4b5563; }
    .divider { text-align: center; margin: 20px 0; color: #666; }
    .info-row { display: flex; border-bottom: 1px solid #ddd; padding: 8px 0; }
    .info-label { font-weight: 600; width: 220px; flex-shrink: 0; }
    .info-value { flex: 1; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 10px; text-transform: uppercase; border-bottom: 2px solid #0F1E2E; padding-bottom: 5px; }
    .content-text { margin-bottom: 12px; text-align: justify; }
    .signature-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .signature-label { font-size: 11px; color: #6b7280; margin-bottom: 5px; font-weight: 600; }
    .signature-image { max-width: 150px; max-height: 50px; display: inline-block; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px; }
    .signature-date { font-size: 11px; color: #6b7280; margin-top: 8px; }
    .review-items { background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; min-height: 80px; margin: 10px 0; white-space: pre-wrap; }
    .walkthrough-type { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; margin-left: 10px; }
    .walkthrough-inperson { background: #dcfce7; color: #166534; }
    .walkthrough-virtual { background: #dbeafe; color: #1e40af; }
    .walkthrough-declined { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="header">
    <h1>TITAN PRIME SOLUTIONS</h1>
    <h2>FINAL COMPLETION & WALK-THROUGH RECORD</h2>
  </div>

  <p class="intro">This record relates to and is incorporated into the Roofing Agreement between Owner and Titan Prime Solutions.</p>

  <div class="section">
    <div class="info-row"><span class="info-label">Project Address:</span><span class="info-value">${deal.address || ''}${deal.city ? `, ${deal.city}` : ''}${deal.state ? `, ${deal.state}` : ''}${deal.zip_code ? ` ${deal.zip_code}` : ''}</span></div>
    <div class="info-row"><span class="info-label">Crew Lead Name:</span><span class="info-value">${crewLeadName || ''}</span></div>
    <div class="info-row"><span class="info-label">Date of Review:</span><span class="info-value">${format(new Date(), 'MMMM d, yyyy')}</span></div>
    <div class="info-row">
      <span class="info-label">Walk-Through Conducted:</span>
      <span class="info-value">
        <span class="walkthrough-type ${walkThroughType === 'in_person' ? 'walkthrough-inperson' : walkThroughType === 'virtual' ? 'walkthrough-virtual' : 'walkthrough-declined'}">
          ${walkThroughType === 'in_person' ? '☑ In Person' : walkThroughType === 'virtual' ? '☑ Virtual' : '☑ Declined'}
        </span>
      </span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Individuals Present</div>
    <div class="info-row"><span class="info-label">Owner(s):</span><span class="info-value">${individualsOwners || deal.homeowner_name || ''}</span></div>
    <div class="info-row"><span class="info-label">Titan PRO Crew Lead / Representative:</span><span class="info-value">${individualsTitanPro || deal.rep_name || ''}</span></div>
    <div class="info-row"><span class="info-label">Other(s):</span><span class="info-value">${individualsOthers || ''}</span></div>
  </div>

  <div class="divider">⸻</div>

  <div class="section">
    <div class="section-title">SECTION 1 – WALK-THROUGH STATUS</div>
    <p class="content-text">Owner acknowledges that a final walk-through of the roofing work was offered and either completed or declined at Owner's discretion. If declined, Owner accepts the condition of the work as observed at the time of completion.</p>
    <p class="content-text">Owner signing below represents and warrants that they have authority to sign on behalf of all owners of the Property.</p>
    <div class="signature-box" style="display: flex; align-items: center; gap: 20px;">
      <span class="signature-label">Owner Initials:</span>
      ${sec1Initials ? `<img src="${sec1Initials}" class="signature-image" alt="Owner Initials" />` : '<span style="color:#999;">Not signed</span>'}
      <span style="margin-left: auto; font-size: 11px; color: #6b7280;">Date: ${format(new Date(), 'MM/dd/yyyy')}</span>
    </div>
  </div>

  <div class="divider">⸻</div>

  <div class="section">
    <div class="section-title">SECTION 2 – ITEMS REQUIRING REVIEW (IF ANY)</div>
    <p class="content-text">If Owner believes any portion of the work is incomplete or requires attention, list below:</p>
    <div class="review-items">${reviewItems || '(No items listed)'}</div>
    <p class="content-text">Titan Prime Solutions acknowledges receipt of the items listed above and will review them. This section establishes a seven (7) day review and resolution period.</p>
    <p class="content-text">If no items are listed above, Owner acknowledges that no outstanding issues were identified at the time of review.</p>
    <div class="signature-box" style="display: flex; align-items: center; gap: 20px;">
      <span class="signature-label">Owner Initials (confirming listed items are complete and accurate):</span>
      ${sec2Initials ? `<img src="${sec2Initials}" class="signature-image" alt="Owner Initials" />` : '<span style="color:#999;">Not signed</span>'}
      <span style="margin-left: auto; font-size: 11px; color: #6b7280;">Date: ${format(new Date(), 'MM/dd/yyyy')}</span>
    </div>
  </div>

  <div class="divider">⸻</div>

  <div class="section">
    <div class="section-title">SECTION 3 – COMPLETION CONFIRMATION</div>
    <p class="content-text">Owner confirms that all agreed-upon roofing work has been completed in accordance with the Agreement and that the Property is in substantially the same condition as prior to installation, reasonable wear and tear excepted.</p>
    <p class="content-text">This acknowledgment does not modify, expand, or replace any manufacturer or contractor warranties provided under the Agreement.</p>
    
    <div class="signature-grid">
      <div class="signature-box">
        <div class="signature-label">Owner Signature</div>
        ${ownerSig ? `<img src="${ownerSig}" style="max-width: 200px; max-height: 60px; display: block; margin: 5px 0;" alt="Owner Signature" />` : '<div style="border-bottom: 1px solid #333; height: 40px;"></div>'}
        <div class="signature-date">Date: ${format(new Date(), 'MM/dd/yyyy')}</div>
      </div>
      <div class="signature-box">
        <div class="signature-label">Titan PRO Signature</div>
        ${proSig ? `<img src="${proSig}" style="max-width: 200px; max-height: 60px; display: block; margin: 5px 0;" alt="Titan PRO Signature" />` : '<div style="border-bottom: 1px solid #333; height: 40px;"></div>'}
        <div class="signature-date">Date: ${format(new Date(), 'MM/dd/yyyy')}</div>
      </div>
    </div>
  </div>

</body>
</html>
      `.trim();

      // Generate PDF and upload to Wasabi
      let completionFormUrl = '';
      try {
        const { uri } = await Print.printToFileAsync({ html: completionFormHtml });
        console.log('[Completion Form] Generated PDF at:', uri);

        const pdfFileName = `completion-form-${deal.id}-${Date.now()}.pdf`;
        const uploadResult = await uploadFile(uri, pdfFileName, 'application/pdf', 'completion_form', deal.id);

        if (uploadResult?.key) {
          completionFormUrl = uploadResult.key;
          console.log('[Completion Form] Uploaded to:', completionFormUrl);
        }
      } catch (pdfError) {
        console.warn('[Completion Form] PDF generation failed, falling back to base64:', pdfError);
        const completionFormBase64 = btoa(unescape(encodeURIComponent(completionFormHtml)));
        completionFormUrl = `data:text/html;base64,${completionFormBase64}`;
      }

      updates.completion_form_url = completionFormUrl;
      updates.status = 'completion_signed';
      updates.completion_signed_date = new Date().toISOString();

      const result = await dealsApi.update(deal.id, updates);
      if (result.error) throw new Error(result.error);

      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', id] });

      // Reset all completion form state
      setCompletionFormStep(0);
      setSection1Initials(null);
      setSection2Initials(null);
      setHomeownerCompletionSignature(null);
      setRepCompletionSignature(null);
      setCrewLeadName('');
      setWalkThroughType(null);
      setIndividualsOwners('');
      setIndividualsTitanPro('');
      setIndividualsOthers('');
      setReviewItems('');

      setShowCompletionFormSignature(false);
      Alert.alert('Success', 'Completion form signed successfully!');
      refetch();
    } catch (error) {
      console.error('[Completion Form] Error saving:', error);
      Alert.alert('Error', 'Failed to save completion form: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSavingCompletionForm(false);
    }
  };

  // Save and progress workflow
  const handleSaveAndProgress = async () => {
    if (!deal) return;
    setSavingWorkflow(true);

    try {
      const currentStep = getCurrentWorkflowStep();
      if (!currentStep) return;

      // Filter out fields that might not exist in database yet or have invalid values
      const newFieldsToFilterOut = ['date_type', 'adjuster_not_assigned'];
      const filteredWorkflowForm = Object.fromEntries(
        Object.entries(workflowForm).filter(([key, value]) => {
          // Filter out new fields that may not exist in DB
          if (newFieldsToFilterOut.includes(key)) return false;
          // Filter out timestamp fields with invalid string values like "N/A"
          if (key === 'adjuster_meeting_date' && (value === 'N/A' || value === '')) return false;
          return true;
        })
      );

      const updates: Partial<Deal> = { ...filteredWorkflowForm };

      // Check if all requirements for current step will be met after this save
      const simulatedDeal = { ...deal, ...updates };
      const adjusterNotAssigned = workflowForm.adjuster_not_assigned === true ||
                                  (workflowForm.adjuster_not_assigned === undefined && deal.adjuster_not_assigned === true);

      const allRequirementsMet = currentStep.requiredFields.every(req => {
        // Skip adjuster fields if adjuster is not assigned
        if (adjusterNotAssigned && (req.field === 'adjuster_name' || req.field === 'adjuster_phone' || req.field === 'adjuster_meeting_date')) {
          return true;
        }

        const value = simulatedDeal[req.field];
        if (req.type === 'signature') {
          // Accept either in-app signature OR uploaded agreement document
          return simulatedDeal.contract_signed === true || !!simulatedDeal.insurance_agreement_url;
        }
        return value !== null && value !== undefined && value !== '';
      });

      // If all requirements met, auto-progress to next status
      if (allRequirementsMet) {
        const nextStatus = getNextStatus();
        const currentStepIndex = getWorkflowStepIndex(deal.status);
        if (nextStatus && !workflowSteps[currentStepIndex + 1]?.adminOnly) {
          updates.status = nextStatus;
        }
        // If next step is admin-only, don't change status - let admin handle it
      }

      // Update via API
      const response = await dealsApi.update(deal.id, updates);
      if (response.error) throw new Error(response.error);

      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', id] });

      if (updates.status && updates.status !== deal.status) {
        Alert.alert('Success', `Deal moved to: ${statusConfig[updates.status]?.label || updates.status}`);
      } else {
        Alert.alert('Success', 'Deal updated successfully');
      }

      setWorkflowForm({});
      refetch();
    } catch (error) {
      Alert.alert('Error', 'Failed to update: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleAdvanceStatus = () => {
    // This is now handled by handleSaveAndProgress when requirements are met
    const currentStep = getCurrentWorkflowStep();
    if (currentStep?.adminOnly) {
      Alert.alert('Admin Required', 'This step requires admin action. Your deal info has been submitted.');
      return;
    }
    if (!currentStep || currentStep.requiredFields.length === 0) {
      handleSaveAndProgress();
    }
  };

  // Photo upload handler
  const handleAddPhotos = async (category: 'inspection' | 'install' | 'completion') => {
    const fieldMap = {
      inspection: 'inspection_images',
      install: 'install_images',
      completion: 'completion_images',
    };

    // Multi-photo to PDF conversion helper
    const captureMultiplePhotosAsPdf = async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Camera permission is required to take photos');
        return;
      }

      const photos: string[] = [];
      let keepTaking = true;

      while (keepTaking) {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: false,
        });

        if (!result.canceled && result.assets[0]) {
          photos.push(result.assets[0].uri);

          // Ask if user wants to take another photo
          await new Promise<void>((resolve) => {
            Alert.alert(
              `${photos.length} Photo(s) Captured`,
              'Do you want to take another photo?',
              [
                {
                  text: 'Take Another',
                  onPress: () => resolve(),
                },
                {
                  text: 'Done - Create PDF',
                  onPress: () => {
                    keepTaking = false;
                    resolve();
                  },
                },
              ],
              { cancelable: false }
            );
          });
        } else {
          keepTaking = false;
        }
      }

      if (photos.length > 0) {
        setUploadingCategory(category);
        try {
          // Convert photos to PDF using expo-print
          const imagesHtml = photos.map(uri => `
            <div style="page-break-after: always; text-align: center; padding: 20px;">
              <img src="${uri}" style="max-width: 100%; max-height: 90vh; object-fit: contain;" />
            </div>
          `).join('');

          const html = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  @page { margin: 0.5in; }
                  body { margin: 0; padding: 0; }
                  div:last-child { page-break-after: avoid; }
                </style>
              </head>
              <body>${imagesHtml}</body>
            </html>
          `;

          const { uri: pdfUri } = await Print.printToFileAsync({ html });

          // Upload the PDF
          const fileName = `${category}_photos_${Date.now()}.pdf`;
          const result = await uploadFile(pdfUri, fileName, 'application/pdf', category, id);

          if (result) {
            const currentImages = (deal as any)[fieldMap[category]] || [];
            const newImages = [...currentImages, result.key];
            const updates: Partial<Deal> = { [fieldMap[category]]: newImages };

            if (category === 'inspection' && deal?.status === 'lead') {
              updates.status = 'inspection_scheduled';
              Alert.alert('Success', `${photos.length} photos converted to PDF and uploaded! Deal moved to next step.`);
            } else {
              Alert.alert('Success', `${photos.length} photos converted to PDF and uploaded successfully`);
            }

            updateMutation.mutate(updates);
          } else {
            Alert.alert('Error', 'Failed to upload PDF');
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to create PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
          setUploadingCategory(null);
        }
      }
    };

    Alert.alert(
      'Add Photos',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              Alert.alert('Permission required', 'Camera permission is required to take photos');
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: false,
            });

            if (!result.canceled && result.assets[0]) {
              await uploadPhoto(result.assets[0].uri, category, fieldMap[category]);
            }
          },
        },
        {
          text: 'Take Multiple → PDF',
          onPress: captureMultiplePhotosAsPdf,
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              Alert.alert('Permission required', 'Photo library permission is required');
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsMultipleSelection: true,
              selectionLimit: 10,
            });

            if (!result.canceled && result.assets.length > 0) {
              for (const asset of result.assets) {
                await uploadPhoto(asset.uri, category, fieldMap[category]);
              }
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadPhoto = async (uri: string, category: string, field: string) => {
    setUploadingCategory(category);
    try {
      const fileName = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      const result = await uploadFile(uri, fileName, 'image/jpeg', category, id);

      if (result) {
        const currentImages = (deal as any)[field] || [];
        const newImages = [...currentImages, result.key];

        // Build update object
        const updates: Partial<Deal> = { [field]: newImages };

        // Auto-progress from lead to inspection_scheduled when first inspection photo is uploaded
        if (category === 'inspection' && deal?.status === 'lead') {
          updates.status = 'inspection_scheduled';
          Alert.alert('Success', 'Photo uploaded! Deal moved to next step.');
        } else {
          Alert.alert('Success', 'Photo uploaded successfully');
        }

        updateMutation.mutate(updates);
      } else {
        Alert.alert('Error', 'Failed to upload photo');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploadingCategory(null);
    }
  };

  // Document upload handler
  const handleUploadDocument = async (docType: 'permit' | 'lost_statement' | 'insurance_agreement' | 'acv_receipt' | 'deductible_receipt') => {
    const fieldMap: Record<string, string> = {
      permit: 'permit_file_url',
      lost_statement: 'lost_statement_url',
      insurance_agreement: 'insurance_agreement_url',
      acv_receipt: 'acv_receipt_url',
      deductible_receipt: 'deductible_receipt_url',
    };

    const docNames: Record<string, string> = {
      permit: 'Permit',
      lost_statement: 'Lost Statement',
      insurance_agreement: 'Insurance Agreement',
      acv_receipt: 'ACV Receipt',
      deductible_receipt: 'Deductible Receipt',
    };

    Alert.alert(
      `Upload ${docNames[docType]}`,
      docType === 'lost_statement' ? 'Choose an option (you can select multiple photos to combine into a PDF)' : 'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              Alert.alert('Permission required', 'Camera permission is required to take photos');
              return;
            }

            setUploadingCategory(docType);
            try {
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const fileName = `${docType}_${Date.now()}.jpg`;
                const uploadResult = await uploadFile(
                  asset.uri,
                  fileName,
                  'image/jpeg',
                  docType,
                  id
                );

                if (uploadResult) {
                  const updateResponse = await dealsApi.update(id, { [fieldMap[docType]]: uploadResult.key });
                  if (updateResponse.error) {
                    Alert.alert('Error', updateResponse.error);
                  } else {
                    queryClient.invalidateQueries({ queryKey: ['deal', id] });
                    queryClient.invalidateQueries({ queryKey: ['deals'] });
                    await refetch();
                    Alert.alert('Success', 'Document uploaded successfully');
                  }
                } else {
                  Alert.alert('Error', 'Failed to upload document');
                }
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to upload document');
            } finally {
              setUploadingCategory(null);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            setUploadingCategory(docType);
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
              });

              if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const uploadResult = await uploadFile(
                  asset.uri,
                  asset.name,
                  asset.mimeType || 'application/pdf',
                  docType,
                  id
                );

                if (uploadResult) {
                  const updateResponse = await dealsApi.update(id, { [fieldMap[docType]]: uploadResult.key });
                  if (updateResponse.error) {
                    Alert.alert('Error', updateResponse.error);
                  } else {
                    queryClient.invalidateQueries({ queryKey: ['deal', id] });
                    queryClient.invalidateQueries({ queryKey: ['deals'] });
                    await refetch();
                    Alert.alert('Success', 'Document uploaded successfully');
                  }
                } else {
                  Alert.alert('Error', 'Failed to upload document');
                }
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to upload document');
            } finally {
              setUploadingCategory(null);
            }
          },
        },
        // Only add "Multiple Photos as PDF" option for lost_statement
        ...(docType === 'lost_statement' ? [{
          text: 'Multiple Photos as PDF',
          onPress: async () => {
            try {
              const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) {
                Alert.alert('Permission required', 'Photo library permission is required');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.3, // Lower quality to reduce file size
                selectionLimit: 5, // Limit to 5 photos to keep file size manageable
              });

              if (!result.canceled && result.assets.length > 0) {
                setUploadingCategory(docType);
                console.log('[Multi-photo PDF] Processing', result.assets.length, 'images');

                // Use file URIs directly in HTML (expo-print handles local files)
                const imagesHtml = result.assets.map((asset, index) => `
                  <div style="page-break-after: ${index < result.assets.length - 1 ? 'always' : 'auto'}; display: flex; justify-content: center; align-items: center; min-height: 90vh; padding: 20px;">
                    <img src="${asset.uri}" style="max-width: 100%; max-height: 90vh; object-fit: contain;" />
                  </div>
                `).join('');

                const html = `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="utf-8">
                      <title>Lost Statement</title>
                      <style>
                        body { margin: 0; padding: 0; }
                        @page { margin: 5mm; }
                      </style>
                    </head>
                    <body>
                      ${imagesHtml}
                    </body>
                  </html>
                `;

                // Generate PDF
                const { uri: pdfUri } = await Print.printToFileAsync({ html });
                console.log('[Multi-photo PDF] Generated PDF at:', pdfUri);

                // Upload the PDF using presigned URL (bypasses API Gateway payload limit)
                const fileName = `lost_statement_${Date.now()}.pdf`;
                const uploadResult = await uploadLargeFile(
                  pdfUri,
                  fileName,
                  'application/pdf',
                  docType,
                  id
                );

                if (uploadResult) {
                  const updateResponse = await dealsApi.update(id, { [fieldMap[docType]]: uploadResult.key });
                  if (updateResponse.error) {
                    Alert.alert('Error', updateResponse.error);
                  } else {
                    queryClient.invalidateQueries({ queryKey: ['deal', id] });
                    queryClient.invalidateQueries({ queryKey: ['deals'] });
                    await refetch();
                    Alert.alert('Success', `${result.assets.length} photos combined into PDF and uploaded`);
                  }
                } else {
                  Alert.alert('Error', 'Failed to upload PDF');
                }

                setUploadingCategory(null);
              }
            } catch (error) {
              console.error('Multi-photo upload error:', error);
              Alert.alert('Error', 'Failed to create PDF from photos');
              setUploadingCategory(null);
            }
          },
        }] : []),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // View images handler - getSignedFileUrl handles key extraction from URLs
  const handleViewImages = async (images: string[]) => {
    if (!images || images.length === 0) return;

    console.log('[handleViewImages] Starting with images:', images);
    setLoadingImages(true);

    // Get fresh signed URLs for viewing
    const signedUrls: string[] = [];
    for (const img of images) {
      try {
        // getSignedFileUrl handles both raw keys and full URLs
        const signedUrl = await getSignedFileUrl(img);
        console.log('[handleViewImages] Got signed URL for:', img, '->', signedUrl ? 'success' : 'failed');
        if (signedUrl) {
          signedUrls.push(signedUrl);
        }
      } catch (error) {
        console.error('[handleViewImages] Error getting signed URL:', error);
      }
    }

    setLoadingImages(false);

    console.log('[handleViewImages] Got', signedUrls.length, 'signed URLs');
    if (signedUrls.length > 0) {
      setViewingImages(signedUrls);
      setCurrentImageIndex(0);
      setShowImageViewer(true);
    } else {
      Alert.alert('Error', 'Could not load images. Please try again.');
    }
  };

  // View document handler - opens in-app WebView for better UX
  const handleViewDocument = async (url: string, documentName: string = 'Document') => {
    const requestId = Math.random().toString(36).substring(7);

    if (!url) {
      console.log(`[handleViewDocument:${requestId}] No URL provided`);
      return;
    }

    console.log(`[handleViewDocument:${requestId}] Starting with URL:`, url.substring(0, 50));

    try {
      // Check if it's a base64 data URL (HTML content stored in database)
      if (url.startsWith('data:text/html;base64,')) {
        const base64Content = url.replace('data:text/html;base64,', '');
        try {
          const htmlContent = decodeURIComponent(escape(atob(base64Content)));
          setHtmlViewerContent(htmlContent);
          setHtmlViewerTitle(documentName);
          setShowHtmlViewer(true);
        } catch (decodeError) {
          console.error(`[handleViewDocument:${requestId}] Failed to decode base64:`, decodeError);
          Alert.alert('Error', 'Failed to decode document');
        }
        return;
      }

      // For Wasabi keys/URLs, get a signed URL then display in WebView
      const signedUrl = await getSignedFileUrl(url);
      console.log(`[handleViewDocument:${requestId}] Got signedUrl:`, signedUrl ? 'yes' : 'no');

      if (signedUrl) {
        // Check if it's an image - display in image viewer
        const isImage = /\.(jpg|jpeg|png|gif|webp)/i.test(url) || url.includes('image');
        if (isImage) {
          setViewingImages([signedUrl]);
          setCurrentImageIndex(0);
          setShowImageViewer(true);
        } else {
          // For PDFs and other documents, use in-app WebBrowser with page sheet style
          await WebBrowser.openBrowserAsync(signedUrl, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          });
        }
      } else {
        Alert.alert('Error', 'Could not load document. Please try again.');
      }
    } catch (error) {
      console.error(`[handleViewDocument:${requestId}] Error:`, error);
      Alert.alert('Error', 'Could not open document. Please try again.');
    }
  };

  // View receipt/invoice handler
  const handleViewReceipt = async (key: string, documentName: string) => {
    if (!key) {
      Alert.alert('Error', 'No receipt found');
      return;
    }

    console.log(`[handleViewReceipt] Viewing ${documentName}:`, key.substring(0, 50) + '...');

    try {
      // Check if it's a base64 data URL (legacy format)
      if (key.startsWith('data:text/html;base64,')) {
        // Decode the base64 HTML and display in WebView
        const base64Content = key.replace('data:text/html;base64,', '');
        try {
          const htmlContent = decodeURIComponent(escape(atob(base64Content)));
          setHtmlViewerContent(htmlContent);
          setHtmlViewerTitle(documentName);
          setShowHtmlViewer(true);
        } catch (decodeError) {
          console.error('[handleViewReceipt] Failed to decode base64:', decodeError);
          Alert.alert('Error', 'Failed to decode document');
        }
        return;
      }

      // For Wasabi keys, get a signed URL
      const signedUrl = await getSignedFileUrl(key);
      if (signedUrl) {
        // Use WebBrowser for a better in-app experience
        await WebBrowser.openBrowserAsync(signedUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
      } else {
        Alert.alert('Error', `Could not load ${documentName}. Please try again.`);
      }
    } catch (error) {
      console.error(`[handleViewReceipt] Error viewing ${documentName}:`, error);
      Alert.alert('Error', `Could not open ${documentName}. Please try again.`);
    }
  };

  // Receipt save callback - refetch deal to get updated receipt URLs
  const handleReceiptSave = () => {
    queryClient.invalidateQueries({ queryKey: ['deal', id] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    setShowPaymentReceipt(false);
  };

  // Share HTML document as PDF
  const handleShareHtmlDocument = async () => {
    if (!htmlViewerContent) return;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlViewerContent });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: htmlViewerTitle,
        UTI: 'com.adobe.pdf'
      });
    } catch (error) {
      console.error('Error sharing document:', error);
      Alert.alert('Error', 'Failed to share document');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !deal) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Deal not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Deals</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentIndex = milestones.findIndex(m => m.status === deal.status);
  const config = statusConfig[deal.status] || statusConfig.lead;
  const progressPercent = currentIndex >= 0 ? Math.round((currentIndex / (milestones.length - 1)) * 100) : 0;
  const currentPhase = milestones[currentIndex]?.phase || 'sign';

  const handleCall = () => {
    if (deal.homeowner_phone) Linking.openURL(`tel:${deal.homeowner_phone}`);
  };

  const handleEmail = () => {
    if (deal.homeowner_email) Linking.openURL(`mailto:${deal.homeowner_email}`);
  };

  const handleDirections = () => {
    const address = encodeURIComponent(`${deal.address}, ${deal.city}, ${deal.state} ${deal.zip_code}`);
    Linking.openURL(`maps://?daddr=${address}`);
  };

  const handleCallAdjuster = () => {
    if (deal.adjuster_phone) Linking.openURL(`tel:${deal.adjuster_phone}`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>{deal.homeowner_name}</Text>
          <Text style={[styles.headerAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{deal.address}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowStatusPicker(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={staticColors.primary}
            colors={[staticColors.primary]}
          />
        }
      >
        {/* Deal Progress Section */}
        <View style={[styles.progressSection, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.progressHeader}>
            <View style={styles.progressTitleRow}>
              <Text style={[styles.progressTitle, { color: colors.foreground }]}>Deal Progress</Text>
              <View style={[styles.phaseBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.phaseBadgeText}>{config.label}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.progressDescription, { color: colors.mutedForeground }]}>{config.description}</Text>

          {/* Horizontal Milestone Tracker */}
          <ScrollView
            ref={milestoneScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.milestoneScroll}
            contentContainerStyle={styles.milestoneContent}
          >
            {milestones.map((milestone, index) => {
              const isComplete = index < currentIndex;
              const isCurrent = index === currentIndex;
              const isFuture = index > currentIndex;
              const isPhaseStart = index === 0 || milestones[index - 1].phase !== milestone.phase;
              const timestamp = getMilestoneTimestamp(deal, milestone.status, currentIndex, index);

              return (
                <View key={milestone.status} style={styles.milestoneItem}>
                  {/* Phase label */}
                  {isPhaseStart && (
                    <Text style={[styles.phaseLabel, { color: phaseColors[milestone.phase] }]}>
                      {phaseLabels[milestone.phase]}
                    </Text>
                  )}
                  {!isPhaseStart && <View style={{ height: 16 }} />}

                  {/* Node with line */}
                  <View style={styles.milestoneNodeRow}>
                    {index > 0 && (
                      <View style={[
                        styles.milestoneLine,
                        { backgroundColor: isDark ? colors.secondary : '#E5E7EB' },
                        (isComplete || isCurrent) && styles.milestoneLineComplete
                      ]} />
                    )}
                    <View
                      style={[
                        styles.milestoneCircle,
                        { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderColor: isDark ? colors.border : '#D1D5DB' },
                        (isComplete || isCurrent) && styles.milestoneCircleComplete,
                        isCurrent && styles.milestoneCircleCurrent,
                      ]}
                    >
                      <Ionicons
                        name={milestone.icon as any}
                        size={isCurrent ? 14 : 12}
                        color={(isComplete || isCurrent) ? '#0F1E2E' : colors.mutedForeground}
                      />
                    </View>
                    {index < milestones.length - 1 && (
                      <View style={[
                        styles.milestoneLine,
                        { backgroundColor: isDark ? colors.secondary : '#E5E7EB' },
                        isComplete && styles.milestoneLineComplete
                      ]} />
                    )}
                  </View>

                  {/* Label */}
                  <Text style={[
                    styles.milestoneLabel,
                    { color: colors.foreground },
                    isCurrent && styles.milestoneLabelCurrent,
                    isFuture && { color: colors.mutedForeground },
                  ]} numberOfLines={2}>
                    {milestone.label}
                  </Text>

                  {/* Timestamp */}
                  {timestamp ? (
                    <Text style={[
                      styles.milestoneTimestamp,
                      { color: colors.mutedForeground },
                      isCurrent && styles.milestoneTimestampCurrent,
                    ]}>
                      {timestamp}
                    </Text>
                  ) : (
                    <View style={{ height: 12 }} />
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { backgroundColor: isDark ? colors.secondary : '#E5E7EB' }]}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        </View>

        {/* Workflow Step Card */}
        {(() => {
          const currentStep = getCurrentWorkflowStep();
          if (!currentStep) return null;

          const isAdminStep = currentStep.adminOnly;
          const hasRequiredFields = currentStep.requiredFields.length > 0;

          // Check if deal status is 'paid' OR commission has been marked as paid
          const isCommissionPaid = deal.status === 'paid' || deal.commission_paid === true || deal.deal_commissions?.[0]?.paid;

          if (isCommissionPaid) {
            // Calculate commission amount - check for override first
            const rcv = Number(deal.rcv) || 0;
            const salesTax = rcv * 0.0825;
            const baseAmount = rcv - salesTax;
            const commissionPercent = deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent || 10;
            // Use override amount if set by admin, then stored commission amount, otherwise calculate
            const commissionAmount = deal.commission_override_amount
              ? Number(deal.commission_override_amount)
              : (deal.deal_commissions?.[0]?.commission_amount || (baseAmount * (commissionPercent / 100)));

            return (
              <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="checkmark-done" size={24} color="#059669" />
                  <Text style={[styles.workflowCardTitle, { color: '#059669' }]}>Commission Paid!</Text>
                </View>
                <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>
                  Congratulations! Your commission of ${commissionAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} has been paid.
                </Text>
              </View>
            );
          }

          // Check if deal is complete and payment is requested
          const isWaitingForCommissionApproval = deal.status === 'complete' && deal.payment_requested && !deal.deal_commissions?.[0]?.paid;

          if (isWaitingForCommissionApproval) {
            return (
              <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="time" size={24} color="#F59E0B" />
                  <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>Waiting for Commission Approval</Text>
                </View>
                <Text style={styles.workflowCardDescription}>
                  Your commission payment request has been submitted. Admin will review and approve your payment.
                </Text>
              </View>
            );
          }

          // Check if deal is complete but payment not yet requested
          const canRequestPayment = deal.status === 'complete' && !deal.payment_requested;

          if (canRequestPayment) {
            // Calculate commission for display - use override if set, otherwise calculate
            const rcv = Number(deal.rcv) || 0;
            const salesTax = rcv * 0.0825;
            const baseAmount = rcv - salesTax;
            // Priority: deal_commissions, then rep's default_commission_percent
            const commissionPercent = deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent || 10;
            const calculatedCommission = baseAmount * (commissionPercent / 100);
            // Use override amount if set by admin
            const estimatedCommission = deal.commission_override_amount
              ? Number(deal.commission_override_amount)
              : calculatedCommission;
            const hasOverride = !!deal.commission_override_amount;

            return (
              <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="trophy" size={24} color="#22C55E" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workflowCardTitle, { color: '#22C55E' }]}>Deal Complete!</Text>
                    <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>Congratulations on completing this deal!</Text>
                  </View>
                </View>

                {/* Commission Summary */}
                <View style={[styles.commissionSummary, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border }]}>
                  {hasOverride && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, padding: 8, backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)', borderRadius: 6 }}>
                      <Ionicons name="information-circle" size={16} color="#F59E0B" />
                      <Text style={{ fontSize: 12, color: isDark ? '#FCD34D' : '#92400E', flex: 1 }}>
                        Commission adjusted by admin{deal.commission_override_reason ? `: ${deal.commission_override_reason}` : ''}
                      </Text>
                    </View>
                  )}
                  <View style={styles.commissionSummaryRow}>
                    <Text style={[styles.commissionSummaryLabel, { color: colors.mutedForeground }]}>Deal Value (RCV)</Text>
                    <Text style={[styles.commissionSummaryValue, { color: colors.foreground }]}>${rcv.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  {!hasOverride && (
                    <>
                      <View style={styles.commissionSummaryRow}>
                        <Text style={[styles.commissionSummaryLabel, { color: colors.mutedForeground }]}>Less: Sales Tax (8.25%)</Text>
                        <Text style={[styles.commissionSummaryValue, { color: '#EF4444' }]}>-${salesTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={styles.commissionSummaryRow}>
                        <Text style={[styles.commissionSummaryLabel, { color: colors.mutedForeground }]}>Commission Rate</Text>
                        <Text style={[styles.commissionSummaryValue, { color: colors.foreground }]}>{commissionPercent}%</Text>
                      </View>
                    </>
                  )}
                  <View style={[styles.commissionSummaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 8 }]}>
                    <Text style={[styles.commissionSummaryLabel, { fontWeight: '700', color: colors.foreground }]}>
                      {hasOverride ? 'Adjusted Commission' : 'Estimated Commission'}
                    </Text>
                    <Text style={[styles.commissionSummaryValue, { fontSize: 18, fontWeight: '700', color: '#22C55E' }]}>${estimatedCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.workflowSaveButton, { backgroundColor: '#22C55E' }]}
                  onPress={() => {
                    Alert.alert(
                      'Request Commission Payment',
                      `You are requesting a commission payment of approximately $${estimatedCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}. This will be reviewed and approved by admin.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Request Payment',
                          onPress: () => {
                            updateMutation.mutate({
                              payment_requested: true,
                            });
                          }
                        }
                      ]
                    );
                  }}
                  disabled={savingWorkflow}
                >
                  {savingWorkflow ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="cash" size={20} color="#FFF" />
                      <Text style={styles.workflowSaveButtonText}>Request Commission Payment</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          }

          // Admin step - show waiting message
          if (isAdminStep) {
            // Special handling for adjuster_met (Adjuster Scheduled) - rep can confirm meeting happened
            if (deal.status === 'adjuster_met') {
              return (
                <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                  <View style={styles.workflowCardHeader}>
                    <Ionicons name="people" size={24} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>Adjuster Appointment Scheduled</Text>
                      <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>
                        {deal.adjuster_meeting_date
                          ? `Scheduled for ${format(new Date(deal.adjuster_meeting_date), 'MMMM d, yyyy')}`
                          : 'Confirm when the adjuster meeting is complete'
                        }
                      </Text>
                    </View>
                  </View>

                  {/* Adjuster Info */}
                  <View style={[styles.submittedFinancials, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                    <Text style={[styles.submittedFinancialsTitle, { color: colors.foreground }]}>Adjuster Information</Text>
                    <View style={styles.submittedFinancialsGrid}>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={[styles.submittedFinancialLabel, { color: colors.mutedForeground }]}>Name</Text>
                        <Text style={[styles.submittedFinancialValue, { color: colors.foreground }]}>{deal.adjuster_name || '-'}</Text>
                      </View>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={[styles.submittedFinancialLabel, { color: colors.mutedForeground }]}>Phone</Text>
                        <Text style={[styles.submittedFinancialValue, { color: colors.foreground }]}>{deal.adjuster_phone || '-'}</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.workflowSaveButton}
                    onPress={() => {
                      updateMutation.mutate({
                        status: 'awaiting_approval',
                        awaiting_approval_date: new Date().toISOString(),
                      });
                    }}
                    disabled={savingWorkflow}
                  >
                    {savingWorkflow ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color="#FFF" />
                        <Text style={styles.workflowSaveButtonText}>Confirm Meeting & Submit for Approval</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }

            // awaiting_approval status - show submitted financials, waiting for admin
            if (deal.status === 'awaiting_approval') {
              return (
                <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                  <View style={styles.workflowCardHeader}>
                    <Ionicons name="time" size={24} color="#F59E0B" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>Awaiting Admin Approval</Text>
                      <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>Financial details submitted for review</Text>
                    </View>
                  </View>

                  {/* Submitted Financial Details */}
                  <View style={[styles.submittedFinancials, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                    <Text style={[styles.submittedFinancialsTitle, { color: colors.foreground }]}>Submitted Values</Text>
                    <View style={styles.submittedFinancialsGrid}>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={[styles.submittedFinancialLabel, { color: colors.mutedForeground }]}>RCV</Text>
                        <Text style={[styles.submittedFinancialValue, { color: colors.foreground }]}>${(Number(deal.rcv) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={[styles.submittedFinancialLabel, { color: colors.mutedForeground }]}>ACV</Text>
                        <Text style={[styles.submittedFinancialValue, { color: colors.foreground }]}>${(Number(deal.acv) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={[styles.submittedFinancialLabel, { color: colors.mutedForeground }]}>Deductible</Text>
                        <Text style={[styles.submittedFinancialValue, { color: colors.foreground }]}>${(Number(deal.deductible) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={[styles.submittedFinancialLabel, { color: colors.mutedForeground }]}>Depreciation</Text>
                        <Text style={[styles.submittedFinancialValue, { color: colors.foreground }]}>${(Number(deal.depreciation) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.awaitingApprovalNote, { backgroundColor: isDark ? colors.muted : undefined }]}>
                    <Ionicons name="information-circle" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.awaitingApprovalText, { color: colors.mutedForeground }]}>
                      Admin will review and approve these values. Once approved, your commission will be calculated.
                    </Text>
                  </View>
                </View>
              );
            }

            // Default admin step message - show status-specific messages
            let adminTitle = 'Waiting for Admin';
            let adminDescription = 'Your deal is signed and complete! Admin will handle materials and installation.';
            let adminIcon: 'lock-closed' | 'calendar' | 'construct' | 'document-text' | 'cash' | 'trophy' = 'lock-closed';

            if (deal.status === 'materials_selected') {
              adminTitle = 'Ready for Install';
              adminDescription = 'Materials selected! Admin will schedule the installation with the crew.';
              adminIcon = 'calendar';
            } else if (deal.status === 'install_scheduled') {
              adminTitle = 'Installation Scheduled';
              adminDescription = deal.install_date
                ? `Installation is scheduled for ${format(new Date(deal.install_date), 'MMMM d, yyyy')}${(deal as any).install_time ? ` at ${(deal as any).install_time}` : ''}.`
                : 'Installation has been scheduled. Crew will complete the work.';
              adminIcon = 'calendar';
            } else if (deal.status === 'installed') {
              // Rep needs to get completion form signed
              return (
                <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                  <View style={styles.workflowCardHeader}>
                    <Ionicons name="create" size={24} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>Get Completion Form Signed</Text>
                      <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>
                        Have the homeowner sign the installation completion form.
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.workflowSaveButton}
                    onPress={() => {
                      updateMutation.mutate({ status: 'completion_signed' });
                    }}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                    <Text style={styles.workflowSaveButtonText}>Completion Form Signed</Text>
                  </TouchableOpacity>
                </View>
              );
            } else if (deal.status === 'completion_signed') {
              adminTitle = 'Waiting for Invoice';
              adminDescription = 'Completion form signed! Admin will generate and send the invoice to insurance.';
              adminIcon = 'document-text';
            } else if (deal.status === 'invoice_sent') {
              // Rep needs to collect depreciation receipt at this step
              const hasDepreciationReceipt = !!deal.depreciation_receipt_url;
              return (
                <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                  <View style={styles.workflowCardHeader}>
                    <Ionicons name="receipt" size={24} color={hasDepreciationReceipt ? '#22C55E' : colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>Collect Depreciation</Text>
                      <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>
                        {hasDepreciationReceipt
                          ? 'Depreciation receipt uploaded. Waiting for admin to complete the deal.'
                          : `Collect depreciation payment of $${(deal.depreciation || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} and upload receipt.`
                        }
                      </Text>
                    </View>
                  </View>

                  {!hasDepreciationReceipt && (
                    <TouchableOpacity
                      style={styles.workflowSaveButton}
                      onPress={() => {
                        setReceiptType('depreciation');
                        setShowPaymentReceipt(true);
                      }}
                    >
                      <Ionicons name="receipt" size={20} color="#FFF" />
                      <Text style={styles.workflowSaveButtonText}>Upload Depreciation Receipt</Text>
                    </TouchableOpacity>
                  )}

                  {hasDepreciationReceipt && (
                    <TouchableOpacity
                      style={[styles.workflowSaveButton, { backgroundColor: '#22C55E' }]}
                      onPress={() => {
                        // Advance to depreciation_collected status
                        updateMutation.mutate({
                          status: 'depreciation_collected',
                          depreciation_collected_date: new Date().toISOString().split('T')[0],
                          depreciation_check_collected: true
                        });
                      }}
                      disabled={savingWorkflow}
                    >
                      {savingWorkflow ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={20} color="#FFF" />
                          <Text style={styles.workflowSaveButtonText}>Mark Depreciation Collected</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            } else if (deal.status === 'depreciation_collected') {
              adminTitle = 'Depreciation Collected';
              adminDescription = 'All payments collected! Admin will mark the deal as complete.';
              adminIcon = 'cash';
            }

            return (
              <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name={adminIcon} size={24} color="#22C55E" />
                  <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>{adminTitle}</Text>
                </View>
                <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>{adminDescription}</Text>
              </View>
            );
          }

          // Lead status - prompt to upload inspection photos
          if (deal.status === 'lead') {
            return (
              <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="camera" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>Upload Inspection Photos</Text>
                    <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>Take and upload photos of the inspection to proceed</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.workflowSaveButton}
                  onPress={() => handleAddPhotos('inspection')}
                  disabled={uploadingCategory === 'inspection'}
                >
                  {uploadingCategory === 'inspection' ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={20} color="#FFF" />
                      <Text style={styles.workflowSaveButtonText}>Add Inspection Photos</Text>
                    </>
                  )}
                </TouchableOpacity>

                {deal.inspection_images && deal.inspection_images.length > 0 && (
                  <View style={{ marginTop: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '500' }}>
                      ✓ {deal.inspection_images.length} photo(s) uploaded
                    </Text>
                  </View>
                )}
              </View>
            );
          }

          // claim_filed status - requires financial details and lost statement before proceeding
          if (deal.status === 'claim_filed') {
            const hasLostStatement = !!deal.lost_statement_url;
            const hasRcv = !!(workflowForm.rcv ?? deal.rcv);
            const hasAcv = !!(workflowForm.acv ?? deal.acv);
            const hasDeductible = !!(workflowForm.deductible ?? deal.deductible);
            const hasDepreciation = !!(workflowForm.depreciation ?? deal.depreciation);
            const hasAdjusterName = !!(workflowForm.adjuster_name ?? deal.adjuster_name);
            const hasAdjusterDate = !!(workflowForm.adjuster_meeting_date ?? deal.adjuster_meeting_date);

            // Check if adjuster is marked as not assigned - use explicit boolean check
            const adjusterNotAssigned = workflowForm.adjuster_not_assigned === true ||
                                        (workflowForm.adjuster_not_assigned === undefined && deal.adjuster_not_assigned === true);

            const allFinancialsComplete = hasRcv && hasAcv && hasDeductible && hasDepreciation;

            // If adjuster is not assigned, adjuster fields are NOT required
            // Otherwise, both name and date are required
            const adjusterFieldsComplete = adjusterNotAssigned ? true : (hasAdjusterName && hasAdjusterDate);

            const allFieldsComplete = allFinancialsComplete && adjusterFieldsComplete && hasLostStatement;

            return (
              <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="document-text" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>Enter Financial Details & Schedule Adjuster</Text>
                    <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>Enter insurance values, upload lost statement, and schedule adjuster</Text>
                  </View>
                </View>

                {/* Lost Statement Status */}
                <View style={[styles.docRequirementRow, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border }]}>
                  <Ionicons
                    name={hasLostStatement ? "checkmark-circle" : "alert-circle"}
                    size={20}
                    color={hasLostStatement ? "#22C55E" : "#F59E0B"}
                  />
                  <Text style={[styles.docRequirementText, { color: colors.foreground }, hasLostStatement && { color: '#22C55E' }]}>
                    {hasLostStatement ? 'Lost Statement Uploaded' : 'Lost Statement Required'}
                  </Text>
                  {!hasLostStatement && (
                    <TouchableOpacity
                      style={styles.docRequirementButton}
                      onPress={() => handleUploadDocument('lost_statement')}
                      disabled={uploadingCategory === 'lost_statement'}
                    >
                      {uploadingCategory === 'lost_statement' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.docRequirementButtonText}>Upload</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Financial Fields */}
                <View style={styles.workflowFields}>
                  <Text style={[styles.workflowFieldLabelText, { marginBottom: 8, fontWeight: '700', color: colors.foreground }]}>Financial Details (from Lost Statement)</Text>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[styles.workflowFieldContainer, { flex: 1 }]}>
                      <View style={styles.workflowFieldLabel}>
                        <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>RCV</Text>
                        {hasRcv && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                      </View>
                      <TextInput
                        style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                        value={String(workflowForm.rcv ?? deal.rcv ?? '')}
                        onChangeText={(text) => handleWorkflowFieldChange('rcv', parseFloat(text) || null)}
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.workflowFieldContainer, { flex: 1 }]}>
                      <View style={styles.workflowFieldLabel}>
                        <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>ACV</Text>
                        {hasAcv && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                      </View>
                      <TextInput
                        style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                        value={String(workflowForm.acv ?? deal.acv ?? '')}
                        onChangeText={(text) => handleWorkflowFieldChange('acv', parseFloat(text) || null)}
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[styles.workflowFieldContainer, { flex: 1 }]}>
                      <View style={styles.workflowFieldLabel}>
                        <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>Deductible</Text>
                        {hasDeductible && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                      </View>
                      <TextInput
                        style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                        value={String(workflowForm.deductible ?? deal.deductible ?? '')}
                        onChangeText={(text) => handleWorkflowFieldChange('deductible', parseFloat(text) || null)}
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.workflowFieldContainer, { flex: 1 }]}>
                      <View style={styles.workflowFieldLabel}>
                        <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>Depreciation</Text>
                        {hasDepreciation && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                      </View>
                      <TextInput
                        style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                        value={String(workflowForm.depreciation ?? deal.depreciation ?? '')}
                        onChangeText={(text) => handleWorkflowFieldChange('depreciation', parseFloat(text) || null)}
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  <Text style={[styles.workflowFieldLabelText, { marginTop: 16, marginBottom: 8, fontWeight: '700', color: colors.foreground }]}>Adjuster Information</Text>

                  {/* Date Type Toggle */}
                  <View style={[styles.workflowFieldContainer, { marginBottom: 12 }]}>
                    <View style={styles.workflowFieldLabel}>
                      <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>Date Type</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={[
                          styles.toggleButton,
                          { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderColor: isDark ? colors.border : '#E5E7EB' },
                          (workflowForm.date_type ?? deal.date_type ?? 'discovery') === 'discovery' && styles.toggleButtonActive
                        ]}
                        onPress={() => handleWorkflowFieldChange('date_type', 'discovery')}
                      >
                        <Text style={[
                          styles.toggleButtonText,
                          (workflowForm.date_type ?? deal.date_type ?? 'discovery') === 'discovery' && styles.toggleButtonTextActive
                        ]}>Date of Discovery</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.toggleButton,
                          { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderColor: isDark ? colors.border : '#E5E7EB' },
                          (workflowForm.date_type ?? deal.date_type) === 'loss' && styles.toggleButtonActive
                        ]}
                        onPress={() => handleWorkflowFieldChange('date_type', 'loss')}
                      >
                        <Text style={[
                          styles.toggleButtonText,
                          (workflowForm.date_type ?? deal.date_type) === 'loss' && styles.toggleButtonTextActive
                        ]}>Date of Loss</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.workflowFieldContainer}>
                    <View style={styles.workflowFieldLabel}>
                      <Text style={[styles.workflowFieldLabelText, { color: colors.foreground }]}>
                        {(workflowForm.date_type ?? deal.date_type ?? 'discovery') === 'discovery' ? 'Date of Discovery' : 'Date of Loss'}
                      </Text>
                      {!!(workflowForm.date_of_loss ?? deal.date_of_loss) && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                    </View>
                    <TouchableOpacity
                      style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                      onPress={() => {
                        const currentValue = workflowForm.date_of_loss ?? deal.date_of_loss;
                        if (currentValue && typeof currentValue === 'string') {
                          try {
                            setDateOfLossPickerValue(new Date(currentValue));
                          } catch {
                            setDateOfLossPickerValue(new Date());
                          }
                        } else {
                          setDateOfLossPickerValue(new Date());
                        }
                        setShowDateOfLossPicker(true);
                      }}
                    >
                      <Text style={{ color: (workflowForm.date_of_loss ?? deal.date_of_loss) ? colors.foreground : colors.mutedForeground }}>
                        {(workflowForm.date_of_loss ?? deal.date_of_loss)
                          ? format(new Date(String(workflowForm.date_of_loss ?? deal.date_of_loss)), 'MMM d, yyyy')
                          : 'Select date'}
                      </Text>
                      <Ionicons name="calendar" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    {showDateOfLossPicker && (
                      Platform.OS === 'ios' ? (
                        <Modal transparent animationType="slide" visible={showDateOfLossPicker}>
                          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                            <View style={{ backgroundColor: isDark ? colors.muted : '#FFFFFF', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                <TouchableOpacity onPress={() => setShowDateOfLossPicker(false)}>
                                  <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                  handleWorkflowFieldChange('date_of_loss', format(dateOfLossPickerValue, 'yyyy-MM-dd'));
                                  setShowDateOfLossPicker(false);
                                }}>
                                  <Text style={{ color: staticColors.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
                                </TouchableOpacity>
                              </View>
                              <DateTimePicker
                                value={dateOfLossPickerValue}
                                mode="date"
                                display="spinner"
                                onChange={(event, date) => {
                                  if (date) setDateOfLossPickerValue(date);
                                }}
                                textColor={colors.foreground}
                              />
                            </View>
                          </View>
                        </Modal>
                      ) : (
                        <DateTimePicker
                          value={dateOfLossPickerValue}
                          mode="date"
                          display="default"
                          onChange={(event, date) => {
                            setShowDateOfLossPicker(false);
                            if (event.type === 'set' && date) {
                              handleWorkflowFieldChange('date_of_loss', format(date, 'yyyy-MM-dd'));
                            }
                          }}
                        />
                      )
                    )}
                  </View>

                  {/* Adjuster Not Assigned Toggle */}
                  <View style={[styles.workflowFieldContainer, { marginTop: 16, marginBottom: 12 }]}>
                    <TouchableOpacity
                      style={[
                        styles.checkboxRow,
                        { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB' }
                      ]}
                      onPress={() => {
                        const newValue = !(workflowForm.adjuster_not_assigned ?? deal.adjuster_not_assigned);
                        handleWorkflowFieldChange('adjuster_not_assigned', newValue);
                        if (newValue) {
                          // Auto-fill N/A values
                          handleWorkflowFieldChange('adjuster_name', 'N/A');
                          handleWorkflowFieldChange('adjuster_phone', 'N/A');
                          handleWorkflowFieldChange('adjuster_meeting_date', null);
                        } else {
                          // Clear N/A values
                          handleWorkflowFieldChange('adjuster_name', '');
                          handleWorkflowFieldChange('adjuster_phone', '');
                        }
                      }}
                    >
                      <View style={[
                        styles.checkbox,
                        !!(workflowForm.adjuster_not_assigned ?? deal.adjuster_not_assigned) && styles.checkboxActive
                      ]}>
                        {!!(workflowForm.adjuster_not_assigned ?? deal.adjuster_not_assigned) && (
                          <Ionicons name="checkmark" size={14} color="#FFF" />
                        )}
                      </View>
                      <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>Adjuster Not Yet Assigned</Text>
                    </TouchableOpacity>
                    <Text style={[styles.checkboxHint, { color: colors.mutedForeground }]}>
                      Check this if the claim hasn't been assigned to an adjuster yet
                    </Text>
                  </View>

                  {/* Only show adjuster fields if not marked as N/A */}
                  {!(workflowForm.adjuster_not_assigned ?? deal.adjuster_not_assigned) && (
                    <>
                      <View style={styles.workflowFieldContainer}>
                        <View style={styles.workflowFieldLabel}>
                          <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>Adjuster Name</Text>
                          {hasAdjusterName && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                        </View>
                        <TextInput
                          style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                          value={String(workflowForm.adjuster_name ?? deal.adjuster_name ?? '')}
                          onChangeText={(text) => handleWorkflowFieldChange('adjuster_name', text)}
                          placeholder="Enter adjuster name"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </View>

                      <View style={styles.workflowFieldContainer}>
                        <View style={styles.workflowFieldLabel}>
                          <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>Adjuster Phone</Text>
                          {!!(workflowForm.adjuster_phone ?? deal.adjuster_phone) && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                        </View>
                        <TextInput
                          style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                          value={String(workflowForm.adjuster_phone ?? deal.adjuster_phone ?? '')}
                          onChangeText={(text) => handleWorkflowFieldChange('adjuster_phone', text)}
                          placeholder="Enter adjuster phone"
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="phone-pad"
                        />
                        {/* Call Adjuster Button */}
                        {!!(workflowForm.adjuster_phone ?? deal.adjuster_phone) && (workflowForm.adjuster_phone ?? deal.adjuster_phone) !== 'N/A' && (
                          <TouchableOpacity
                            style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' }}
                            onPress={() => {
                              const rawPhone = String(workflowForm.adjuster_phone ?? deal.adjuster_phone);
                              // Keep + for international, remove other non-digits
                              const phone = rawPhone.replace(/[^\d+]/g, '');
                              if (phone && phone.length >= 7) {
                                Linking.openURL(`tel:${phone}`).catch(() => {
                                  Alert.alert('Error', 'Unable to make phone call');
                                });
                              } else {
                                Alert.alert('Invalid Phone', 'Please enter a valid phone number');
                              }
                            }}
                          >
                            <Ionicons name="call" size={16} color="#3B82F6" />
                            <Text style={{ color: '#3B82F6', fontSize: 14, fontWeight: '500' }}>Call Adjuster</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Notes Section */}
                      <View style={styles.workflowFieldContainer}>
                        <View style={styles.workflowFieldLabel}>
                          <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>Notes</Text>
                        </View>
                        <TextInput
                          style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, color: colors.foreground, minHeight: 80, textAlignVertical: 'top' }]}
                          value={String(workflowForm.notes ?? deal.notes ?? '')}
                          onChangeText={(text) => handleWorkflowFieldChange('notes', text)}
                          placeholder="Add notes about the deal..."
                          placeholderTextColor={colors.mutedForeground}
                          multiline
                          numberOfLines={3}
                        />
                      </View>

                      <View style={styles.workflowFieldContainer}>
                        <View style={styles.workflowFieldLabel}>
                          <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>Adjuster Meeting Date</Text>
                          {hasAdjusterDate && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                        </View>
                        <TouchableOpacity
                          style={[styles.datePickerButton, { backgroundColor: isDark ? colors.secondary : '#FFFFFF', borderColor: colors.border }]}
                          onPress={() => {
                            const currentDate = workflowForm.adjuster_meeting_date || deal.adjuster_meeting_date;
                            if (currentDate) {
                              setAdjusterDatePickerValue(new Date(currentDate as string));
                            } else {
                              setAdjusterDatePickerValue(new Date());
                            }
                            setShowAdjusterDatePicker(true);
                          }}
                        >
                          <Ionicons name="calendar" size={20} color={colors.primary} />
                          <Text style={[styles.datePickerButtonText, { color: colors.foreground }, !(workflowForm.adjuster_meeting_date ?? deal.adjuster_meeting_date) && { color: colors.mutedForeground }]}>
                            {workflowForm.adjuster_meeting_date || deal.adjuster_meeting_date
                              ? format(new Date(String(workflowForm.adjuster_meeting_date || deal.adjuster_meeting_date)), 'MMMM d, yyyy')
                              : 'Select date'
                            }
                          </Text>
                          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>

                {/* Save Button - disabled if requirements not met */}
                <TouchableOpacity
                  style={[styles.workflowSaveButton, (!allFieldsComplete || savingWorkflow) && { opacity: 0.5 }]}
                  onPress={async () => {
                    setSavingWorkflow(true);
                    try {
                      // Filter out fields that might not exist in database yet or have invalid values
                      const newFieldsToFilterOut = ['date_type', 'adjuster_not_assigned'];
                      const filteredWorkflowForm = Object.fromEntries(
                        Object.entries(workflowForm).filter(([key, value]) => {
                          // Filter out new fields that may not exist in DB
                          if (newFieldsToFilterOut.includes(key)) return false;
                          // Filter out timestamp fields with invalid string values like "N/A"
                          if (key === 'adjuster_meeting_date' && (value === 'N/A' || value === '')) return false;
                          return true;
                        })
                      );

                      const updates: Partial<Deal> = { ...filteredWorkflowForm };

                      // Determine next status based on adjuster_not_assigned
                      if (adjusterNotAssigned) {
                        // Skip adjuster_met and go directly to awaiting_approval
                        updates.status = 'awaiting_approval';
                        updates.awaiting_approval_date = new Date().toISOString();
                      } else {
                        // Go to adjuster_met (adjuster scheduled)
                        updates.status = 'adjuster_met';
                        // Note: adjuster_meeting_date is already set from the form
                      }

                      const response = await dealsApi.update(deal.id, updates);
                      if (response.error) throw new Error(response.error);

                      queryClient.invalidateQueries({ queryKey: ['deals'] });
                      queryClient.invalidateQueries({ queryKey: ['deal', id] });

                      Alert.alert('Success', `Deal moved to: ${statusConfig[updates.status]?.label || updates.status}`);
                      setWorkflowForm({});
                      refetch();
                    } catch (error) {
                      Alert.alert('Error', 'Failed to update: ' + (error instanceof Error ? error.message : 'Unknown error'));
                    } finally {
                      setSavingWorkflow(false);
                    }
                  }}
                  disabled={!allFieldsComplete || savingWorkflow}
                >
                  {savingWorkflow ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.workflowSaveButtonText}>
                        {adjusterNotAssigned ? 'Save & Submit for Approval' : 'Save & Schedule Adjuster'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {!allFieldsComplete && (
                  <Text style={styles.workflowWarning}>
                    {!hasLostStatement ? '⚠ Lost statement must be uploaded' :
                     !allFinancialsComplete ? '⚠ All financial fields are required' :
                     !adjusterFieldsComplete ? '⚠ Adjuster information is required (or mark as "Adjuster Later")' :
                     '⚠ Please complete all required fields'}
                  </Text>
                )}
              </View>
            );
          }

          // approved status - collect ACV with receipt
          if (deal.status === 'approved') {
            const hasAcvReceipt = !!deal.acv_receipt_url;
            const acvAmount = Number(deal.acv) || 0;

            return (
              <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="cash" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>Collect ACV Payment</Text>
                    <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>Collect ACV check from insurance company</Text>
                  </View>
                </View>

                {/* ACV Amount Display */}
                <View style={[styles.paymentAmountCard, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                  <Text style={[styles.paymentAmountLabel, { color: colors.mutedForeground }]}>ACV Amount to Collect</Text>
                  <Text style={styles.paymentAmountValue}>${acvAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  <TouchableOpacity
                    style={styles.viewInsuranceLink}
                    onPress={() => setActiveTab('insurance')}
                  >
                    <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                    <Text style={styles.viewInsuranceLinkText}>View Insurance Details</Text>
                  </TouchableOpacity>
                </View>

                {/* ACV Receipt Status */}
                <TouchableOpacity
                  style={[styles.docRequirementRow, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB' }]}
                  onPress={() => setActiveTab('insurance')}
                >
                  <Ionicons
                    name={hasAcvReceipt ? "checkmark-circle" : "alert-circle"}
                    size={20}
                    color={hasAcvReceipt ? "#22C55E" : "#F59E0B"}
                  />
                  <Text style={[styles.docRequirementText, { color: colors.foreground }, hasAcvReceipt && { color: '#22C55E' }]}>
                    {hasAcvReceipt ? 'ACV Receipt Uploaded' : 'Go to Insurance tab to upload receipt'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>

                {/* Continue Button - disabled if no receipt */}
                <TouchableOpacity
                  style={[styles.workflowSaveButton, (!hasAcvReceipt || savingWorkflow) && { opacity: 0.5 }]}
                  onPress={() => {
                    if (hasAcvReceipt) {
                      updateMutation.mutate({ status: 'acv_collected', collect_acv_date: new Date().toISOString() });
                    }
                  }}
                  disabled={!hasAcvReceipt || savingWorkflow}
                >
                  {savingWorkflow ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.workflowSaveButtonText}>Continue to Collect Deductible</Text>
                    </>
                  )}
                </TouchableOpacity>

                {!hasAcvReceipt && (
                  <Text style={styles.workflowWarning}>
                    ⚠ ACV receipt must be uploaded before proceeding
                  </Text>
                )}
              </View>
            );
          }

          // acv_collected status - collect deductible with receipt
          if (deal.status === 'acv_collected') {
            const hasDeductibleReceipt = !!deal.deductible_receipt_url;
            const deductibleAmount = Number(deal.deductible) || 0;

            return (
              <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="cash" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>Collect Deductible</Text>
                    <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>Collect deductible payment from homeowner</Text>
                  </View>
                </View>

                {/* Deductible Amount Display */}
                <View style={[styles.paymentAmountCard, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                  <Text style={[styles.paymentAmountLabel, { color: colors.mutedForeground }]}>Deductible Amount to Collect</Text>
                  <Text style={styles.paymentAmountValue}>${deductibleAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  <TouchableOpacity
                    style={styles.viewInsuranceLink}
                    onPress={() => setActiveTab('insurance')}
                  >
                    <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                    <Text style={styles.viewInsuranceLinkText}>View Insurance Details</Text>
                  </TouchableOpacity>
                </View>

                {/* Deductible Receipt Status */}
                <TouchableOpacity
                  style={[styles.docRequirementRow, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB' }]}
                  onPress={() => setActiveTab('insurance')}
                >
                  <Ionicons
                    name={hasDeductibleReceipt ? "checkmark-circle" : "alert-circle"}
                    size={20}
                    color={hasDeductibleReceipt ? "#22C55E" : "#F59E0B"}
                  />
                  <Text style={[styles.docRequirementText, { color: colors.foreground }, hasDeductibleReceipt && { color: '#22C55E' }]}>
                    {hasDeductibleReceipt ? 'Deductible Receipt Uploaded' : 'Go to Insurance tab to upload receipt'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>

                {/* Continue Button - disabled if no receipt */}
                <TouchableOpacity
                  style={[styles.workflowSaveButton, (!hasDeductibleReceipt || savingWorkflow) && { opacity: 0.5 }]}
                  onPress={() => {
                    if (hasDeductibleReceipt) {
                      updateMutation.mutate({ status: 'deductible_collected', collect_deductible_date: new Date().toISOString() });
                    }
                  }}
                  disabled={!hasDeductibleReceipt || savingWorkflow}
                >
                  {savingWorkflow ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.workflowSaveButtonText}>Continue to Select Materials</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Skip for now option */}
                {!hasDeductibleReceipt && (
                  <TouchableOpacity
                    style={[styles.skipButton, { borderColor: colors.border, marginTop: 8 }]}
                    onPress={() => {
                      Alert.alert(
                        'Skip Deductible Collection?',
                        'You can continue to material selection, but you must collect the deductible before the deal can be marked complete.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Skip for Now',
                            onPress: () => {
                              updateMutation.mutate({ status: 'deductible_collected', collect_deductible_date: null });
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="arrow-forward" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.skipButtonText, { color: colors.mutedForeground }]}>Skip for Now (collect later)</Text>
                  </TouchableOpacity>
                )}

                {!hasDeductibleReceipt && (
                  <Text style={styles.workflowWarning}>
                    ⚠ Deductible must be collected before deal completion
                  </Text>
                )}
              </View>
            );
          }

          // deductible_collected status - select materials
          if (deal.status === 'deductible_collected') {
            // Check if basic material specs are filled - check both deal data and form state
            const category = deal.material_category || materialsForm.material_category;
            const materialType = deal.material_type || materialsForm.material_type;
            const materialColor = deal.material_color || materialsForm.material_color;

            // material_type is only required for Metal categories
            const isMetalCategory = category === 'Metal' || category === 'Architectural Metal';
            const hasMaterialSpecs = isMetalCategory
              ? !!(category && materialType)  // Metal needs category + type
              : !!(category && materialColor); // Non-metal needs category + color

            // Debug log to help troubleshoot
            console.log('[Materials Check]', {
              category,
              materialType,
              materialColor,
              isMetalCategory,
              hasMaterialSpecs
            });

            return (
              <View style={styles.workflowCard}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="construct" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workflowCardTitle}>Select Materials</Text>
                    <Text style={styles.workflowCardDescription}>Pick roof materials and colors with the homeowner</Text>
                  </View>
                </View>

                {/* Material specs status */}
                <TouchableOpacity
                  style={styles.docRequirementRow}
                  onPress={() => setActiveTab('overview')}
                >
                  <Ionicons
                    name={hasMaterialSpecs ? "checkmark-circle" : "alert-circle"}
                    size={20}
                    color={hasMaterialSpecs ? "#22C55E" : "#F59E0B"}
                  />
                  <Text style={[styles.docRequirementText, hasMaterialSpecs && { color: '#22C55E' }]}>
                    {hasMaterialSpecs ? 'Materials Selected ✓' : 'Go to Overview tab to select materials'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Continue Button */}
                <TouchableOpacity
                  style={[styles.workflowSaveButton, (!hasMaterialSpecs || savingWorkflow) && { opacity: 0.5 }]}
                  onPress={() => {
                    if (hasMaterialSpecs) {
                      updateMutation.mutate({ status: 'materials_selected' });
                    }
                  }}
                  disabled={!hasMaterialSpecs || savingWorkflow}
                >
                  {savingWorkflow ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.workflowSaveButtonText}>Ready for Install</Text>
                    </>
                  )}
                </TouchableOpacity>

                {!hasMaterialSpecs && (
                  <Text style={styles.workflowWarning}>
                    ⚠ Material specifications must be filled before proceeding
                  </Text>
                )}
              </View>
            );
          }

          // Rep step with required fields
          if (hasRequiredFields) {
            return (
              <View style={[styles.workflowCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="clipboard" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workflowCardTitle, { color: colors.foreground }]}>{currentStep.label}</Text>
                    <Text style={[styles.workflowCardDescription, { color: colors.mutedForeground }]}>{currentStep.description}</Text>
                  </View>
                </View>

                {/* Required Fields */}
                <View style={styles.workflowFields}>
                  {currentStep.requiredFields.map((req) => {
                    const currentValue = workflowForm[req.field] ?? deal[req.field] ?? '';
                    const isFieldComplete = currentValue !== '' && currentValue !== null && currentValue !== undefined;

                    // Special handling for date_of_loss field - with Date Type toggle
                    if (req.field === 'date_of_loss') {
                      return (
                        <View key={req.field}>
                          {/* Date Type Toggle */}
                          <View style={[styles.workflowFieldContainer, { marginBottom: 8 }]}>
                            <View style={styles.workflowFieldLabel}>
                              <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>Date Type</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity
                                style={[
                                  styles.toggleButton,
                                  { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderColor: isDark ? colors.border : '#E5E7EB' },
                                  (workflowForm.date_type ?? deal.date_type ?? 'discovery') === 'discovery' && styles.toggleButtonActive
                                ]}
                                onPress={() => handleWorkflowFieldChange('date_type', 'discovery')}
                              >
                                <Text style={[
                                  styles.toggleButtonText,
                                  (workflowForm.date_type ?? deal.date_type ?? 'discovery') === 'discovery' && styles.toggleButtonTextActive
                                ]}>Date of Discovery</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.toggleButton,
                                  { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderColor: isDark ? colors.border : '#E5E7EB' },
                                  (workflowForm.date_type ?? deal.date_type ?? 'loss') === 'loss' && styles.toggleButtonActive
                                ]}
                                onPress={() => handleWorkflowFieldChange('date_type', 'loss')}
                              >
                                <Text style={[
                                  styles.toggleButtonText,
                                  (workflowForm.date_type ?? deal.date_type ?? 'loss') === 'loss' && styles.toggleButtonTextActive
                                ]}>Date of Loss</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={styles.workflowFieldContainer}>
                            <View style={styles.workflowFieldLabel}>
                              <Text style={[styles.workflowFieldLabelText, { color: colors.foreground }]}>
                                {(workflowForm.date_type ?? deal.date_type ?? 'loss') === 'discovery' ? 'Date of Discovery' : 'Date of Loss'}
                              </Text>
                              {isFieldComplete && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                            </View>
                            <TouchableOpacity
                              style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                              onPress={() => {
                                const currentValue = workflowForm[req.field] ?? deal[req.field];
                                if (currentValue) {
                                  try {
                                    setDateOfLossPickerValue(new Date(currentValue as string));
                                  } catch {
                                    setDateOfLossPickerValue(new Date());
                                  }
                                } else {
                                  setDateOfLossPickerValue(new Date());
                                }
                                setShowDateOfLossPicker(true);
                              }}
                            >
                              <Text style={{ color: (workflowForm[req.field] ?? deal[req.field]) ? colors.foreground : colors.mutedForeground }}>
                                {(workflowForm[req.field] ?? deal[req.field])
                                  ? format(new Date(workflowForm[req.field] as string ?? deal[req.field] as string), 'MMM d, yyyy')
                                  : 'Select date'}
                              </Text>
                              <Ionicons name="calendar" size={20} color={colors.mutedForeground} />
                            </TouchableOpacity>
                            {showDateOfLossPicker && (
                              Platform.OS === 'ios' ? (
                                <Modal transparent animationType="slide" visible={showDateOfLossPicker}>
                                  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                                    <View style={{ backgroundColor: isDark ? colors.muted : '#FFFFFF', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <TouchableOpacity onPress={() => setShowDateOfLossPicker(false)}>
                                          <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => {
                                          handleWorkflowFieldChange(req.field, format(dateOfLossPickerValue, 'yyyy-MM-dd'));
                                          setShowDateOfLossPicker(false);
                                        }}>
                                          <Text style={{ color: staticColors.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
                                        </TouchableOpacity>
                                      </View>
                                      <DateTimePicker
                                        value={dateOfLossPickerValue}
                                        mode="date"
                                        display="spinner"
                                        onChange={(event, date) => {
                                          if (date) setDateOfLossPickerValue(date);
                                        }}
                                        textColor={colors.foreground}
                                      />
                                    </View>
                                  </View>
                                </Modal>
                              ) : (
                                <DateTimePicker
                                  value={dateOfLossPickerValue}
                                  mode="date"
                                  display="default"
                                  onChange={(event, date) => {
                                    setShowDateOfLossPicker(false);
                                    if (event.type === 'set' && date) {
                                      handleWorkflowFieldChange(req.field, format(date, 'yyyy-MM-dd'));
                                    }
                                  }}
                                />
                              )
                            )}
                          </View>
                        </View>
                      );
                    }

                    if (req.type === 'text' && req.field === 'approval_type') {
                      return (
                        <View key={req.field} style={styles.workflowFieldContainer}>
                          <View style={styles.workflowFieldLabel}>
                            <Text style={styles.workflowFieldLabelText}>{req.label}</Text>
                            {isFieldComplete && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                          </View>
                          <View style={styles.approvalTypeButtons}>
                            {['full', 'partial', 'sale'].map((type) => (
                              <TouchableOpacity
                                key={type}
                                style={[
                                  styles.approvalTypeButton,
                                  (workflowForm.approval_type || deal.approval_type) === type && styles.approvalTypeButtonActive
                                ]}
                                onPress={() => handleWorkflowFieldChange('approval_type', type)}
                              >
                                <Text style={[
                                  styles.approvalTypeButtonText,
                                  (workflowForm.approval_type || deal.approval_type) === type && styles.approvalTypeButtonTextActive
                                ]}>
                                  {type === 'full' ? 'Full' : type === 'partial' ? 'Partial' : 'Sale'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      );
                    }

                    // Special handling for adjuster_name - add the toggle before it
                    if (req.field === 'adjuster_name') {
                      const adjusterNotAssigned = !!(workflowForm.adjuster_not_assigned ?? deal.adjuster_not_assigned);
                      return (
                        <View key={req.field}>
                          {/* Adjuster Not Assigned Toggle */}
                          <View style={[styles.workflowFieldContainer, { marginTop: 12, marginBottom: 8 }]}>
                            <TouchableOpacity
                              style={[
                                styles.checkboxRow,
                                { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB' }
                              ]}
                              onPress={() => {
                                const newValue = !adjusterNotAssigned;
                                handleWorkflowFieldChange('adjuster_not_assigned', newValue);
                                if (newValue) {
                                  handleWorkflowFieldChange('adjuster_name', 'N/A');
                                  handleWorkflowFieldChange('adjuster_phone', 'N/A');
                                  // Don't set adjuster_meeting_date - it's a timestamp and can't be "N/A"
                                } else {
                                  handleWorkflowFieldChange('adjuster_name', '');
                                  handleWorkflowFieldChange('adjuster_phone', '');
                                }
                              }}
                            >
                              <View style={[
                                styles.checkbox,
                                adjusterNotAssigned && styles.checkboxActive
                              ]}>
                                {adjusterNotAssigned && (
                                  <Ionicons name="checkmark" size={14} color="#FFF" />
                                )}
                              </View>
                              <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>Adjuster Not Yet Assigned</Text>
                            </TouchableOpacity>
                            <Text style={[styles.checkboxHint, { color: colors.mutedForeground }]}>
                              Check this if the claim hasn't been assigned to an adjuster yet
                            </Text>
                          </View>

                          {/* Only show adjuster name field if not marked as N/A */}
                          {!adjusterNotAssigned && (
                            <View style={styles.workflowFieldContainer}>
                              <View style={styles.workflowFieldLabel}>
                                <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>{req.label}</Text>
                                {isFieldComplete && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                              </View>
                              <TextInput
                                style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                                value={String(workflowForm[req.field] ?? deal[req.field] ?? '')}
                                onChangeText={(text) => handleWorkflowFieldChange(req.field, text)}
                                placeholder={`Enter ${req.label.toLowerCase()}`}
                                placeholderTextColor={colors.mutedForeground}
                              />
                            </View>
                          )}
                        </View>
                      );
                    }

                    // Skip adjuster_phone and adjuster_meeting_date if adjuster not assigned
                    if ((req.field === 'adjuster_phone' || req.field === 'adjuster_meeting_date') &&
                        (workflowForm.adjuster_not_assigned ?? deal.adjuster_not_assigned)) {
                      return null;
                    }

                    return (
                      <View key={req.field} style={styles.workflowFieldContainer}>
                        <View style={styles.workflowFieldLabel}>
                          <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>{req.label}</Text>
                          {isFieldComplete && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                        </View>
                        <TextInput
                          style={[styles.workflowInput, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                          value={String(workflowForm[req.field] ?? deal[req.field] ?? '')}
                          onChangeText={(text) => {
                            const value = req.type === 'number' ? (parseFloat(text) || null) : text;
                            handleWorkflowFieldChange(req.field, value);
                          }}
                          placeholder={`Enter ${req.label.toLowerCase()}`}
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType={req.type === 'number' ? 'numeric' : req.type === 'date' ? 'default' : 'default'}
                        />
                      </View>
                    );
                  })}
                </View>

                {/* Contract Signature Section - For inspection_scheduled status */}
                {deal.status === 'inspection_scheduled' && (
                  <View style={styles.workflowFieldContainer}>
                    <View style={styles.workflowFieldLabel}>
                      <Text style={[styles.workflowFieldLabelText, { color: colors.mutedForeground }]}>Agreement Signature</Text>
                      {(deal.contract_signed || deal.insurance_agreement_url) && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                    </View>
                    {deal.contract_signed ? (
                      <View style={[styles.signatureComplete, { backgroundColor: isDark ? colors.secondary : '#ECFDF5' }]}>
                        <Text style={[styles.signatureCompleteText, { color: '#22C55E' }]}>✓ Contract signed on {deal.signed_date ? format(new Date(deal.signed_date), 'MMM d, yyyy') : 'N/A'}</Text>
                      </View>
                    ) : deal.insurance_agreement_url ? (
                      <View style={[styles.signatureComplete, { backgroundColor: isDark ? colors.secondary : '#ECFDF5' }]}>
                        <Text style={[styles.signatureCompleteText, { color: '#22C55E' }]}>✓ Agreement document uploaded</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.signatureButton, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border }]}
                        onPress={() => setActiveTab('docs')}
                      >
                        <Ionicons name="document-text" size={20} color={colors.primary} />
                        <Text style={[styles.signatureButtonText, { color: colors.foreground }]}>Go to Docs Tab to Sign or Upload Agreement</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.workflowSaveButton, savingWorkflow && { opacity: 0.7 }]}
                  onPress={handleSaveAndProgress}
                  disabled={savingWorkflow || (deal.status === 'inspection_scheduled' && !deal.contract_signed && !deal.insurance_agreement_url)}
                >
                  {savingWorkflow ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.workflowSaveButtonText}>Save & Continue</Text>
                    </>
                  )}
                </TouchableOpacity>

                {deal.status === 'inspection_scheduled' && !deal.contract_signed && !deal.insurance_agreement_url && (
                  <Text style={{ color: '#F59E0B', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                    ⚠ Contract must be signed or uploaded in the Docs tab before continuing
                  </Text>
                )}
              </View>
            );
          }

          // No required fields - just show next step info
          return (
            <TouchableOpacity style={styles.nextActionCard} onPress={handleAdvanceStatus}>
              <View style={styles.nextActionContent}>
                <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />
                <View style={styles.nextActionText}>
                  <Text style={styles.nextActionLabel}>Next Step</Text>
                  <Text style={styles.nextActionValue}>{config.nextAction}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          );
        })()}

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={handleCall} style={[styles.actionButton, { backgroundColor: '#EFF6FF' }]} disabled={!deal.homeowner_phone}>
            <Ionicons name="call" size={20} color="#3B82F6" />
            <Text style={[styles.actionText, { color: '#3B82F6' }]}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEmail} style={[styles.actionButton, { backgroundColor: '#F5F3FF' }]} disabled={!deal.homeowner_email}>
            <Ionicons name="mail" size={20} color="#8B5CF6" />
            <Text style={[styles.actionText, { color: '#8B5CF6' }]}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDirections} style={[styles.actionButton, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="navigate" size={20} color="#22C55E" />
            <Text style={[styles.actionText, { color: '#22C55E' }]}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}>
          {(['overview', 'insurance', 'docs'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && [styles.tabActive, { backgroundColor: isDark ? colors.secondary : '#FFFFFF' }]]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: colors.mutedForeground }, activeTab === tab && { color: colors.foreground, fontWeight: '600' }]}>
                {tab === 'overview' ? 'Overview' : tab === 'insurance' ? 'Insurance' : 'Docs'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* Homeowner Card */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="person" size={18} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Homeowner</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  if (!isEditingOverview) {
                    // Starting to edit - populate form with current deal values
                    setOverviewForm({
                      homeowner_name: deal.homeowner_name || '',
                      homeowner_phone: deal.homeowner_phone || '',
                      homeowner_email: deal.homeowner_email || '',
                      address: deal.address || '',
                      city: deal.city || '',
                      state: deal.state || '',
                      zip_code: deal.zip_code || '',
                      roof_type: deal.roof_type || '',
                      roof_squares: deal.roof_squares?.toString() || '',
                      notes: deal.notes || '',
                    });
                  }
                  setIsEditingOverview(!isEditingOverview);
                }}>
                  <Ionicons name={isEditingOverview ? "close" : "pencil"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {isEditingOverview ? (
                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                      value={overviewForm.homeowner_name}
                      onChangeText={(v) => setOverviewForm({ ...overviewForm, homeowner_name: v })}
                      placeholder="Name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Phone</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={overviewForm.homeowner_phone}
                        onChangeText={(v) => setOverviewForm({ ...overviewForm, homeowner_phone: v })}
                        placeholder="Phone"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="phone-pad"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Email</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={overviewForm.homeowner_email}
                        onChangeText={(v) => setOverviewForm({ ...overviewForm, homeowner_email: v })}
                        placeholder="Email"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Roofing System Type</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                      value={overviewForm.roof_type}
                      onChangeText={(v) => setOverviewForm({ ...overviewForm, roof_type: v })}
                      placeholder="e.g., Composition Shingle, Metal, Tile"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveOverview} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Name</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.homeowner_name || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Phone</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.homeowner_phone || '-'}</Text>
                  </View>
                  <View style={styles.infoItemFull}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Email</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.homeowner_email || '-'}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Property Card */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="home" size={18} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Property</Text>
              </View>
              <View style={styles.infoGrid}>
                <View style={styles.infoItemFull}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Address</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    {deal.address}{deal.city && `, ${deal.city}`}{deal.state && `, ${deal.state}`}{deal.zip_code && ` ${deal.zip_code}`}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Roof Type</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.roofing_system_type || deal.roof_type || '-'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Squares</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.roof_squares || '-'}</Text>
                </View>
              </View>
            </View>

            {/* Material Specifications Card */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="construct" size={18} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Material Specifications</Text>
                  {/* Autosave indicator */}
                  {isEditingMaterials && (
                    <View style={{ marginLeft: 8 }}>
                      {materialsSaving ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <ActivityIndicator size="small" color="#F59E0B" />
                          <Text style={{ color: '#F59E0B', fontSize: 11 }}>Saving...</Text>
                        </View>
                      ) : materialsLastSaved ? (
                        <Text style={{ color: '#22C55E', fontSize: 11 }}>✓ Saved</Text>
                      ) : null}
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (isEditingMaterials) {
                      // Save
                      updateMutation.mutate({
                        material_category: materialsForm.material_category || null,
                        material_type: materialsForm.material_type || null,
                        material_color: materialsForm.material_color || null,
                        drip_edge: materialsForm.drip_edge || null,
                        vent_color: materialsForm.vent_color || null,
                      });
                    } else {
                      // Starting to edit - populate form with current deal values
                      setMaterialsForm({
                        material_category: deal.material_category || '',
                        material_type: deal.material_type || '',
                        material_color: deal.material_color || '',
                        drip_edge: deal.drip_edge || '',
                        vent_color: deal.vent_color || '',
                      });
                    }
                    setIsEditingMaterials(!isEditingMaterials);
                  }}
                >
                  {isEditingMaterials ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="checkmark" size={18} color="#22C55E" />
                      <Text style={{ color: '#22C55E', fontWeight: '600', fontSize: 13 }}>Save</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="pencil" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontWeight: '500', fontSize: 13 }}>Edit</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {isEditingMaterials ? (
                <View style={styles.formContainer}>
                  {/* Material Category */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Material Category</Text>
                    <View style={styles.categoryButtons}>
                      {['Shingle', 'Metal', 'Architectural', 'Architectural Metal'].map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryButton,
                            { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderColor: isDark ? colors.border : '#E5E7EB' },
                            materialsForm.material_category === cat && styles.categoryButtonActive
                          ]}
                          onPress={() => setMaterialsForm({ ...materialsForm, material_category: cat, material_type: cat === 'Metal' || cat === 'Architectural Metal' ? materialsForm.material_type : '' })}
                        >
                          <Text style={[
                            styles.categoryButtonText,
                            { color: isDark ? colors.foreground : '#374151' },
                            materialsForm.material_category === cat && styles.categoryButtonTextActive
                          ]}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Metal Type - only show for metal categories */}
                  {(materialsForm.material_category === 'Metal' || materialsForm.material_category === 'Architectural Metal') && (
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Metal Type</Text>
                      <View style={styles.categoryButtons}>
                        {['29 Gauge', '26 Gauge', '24 Gauge'].map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[
                              styles.categoryButton,
                              { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderColor: isDark ? colors.border : '#E5E7EB' },
                              materialsForm.material_type === type && styles.categoryButtonActive
                            ]}
                            onPress={() => setMaterialsForm({ ...materialsForm, material_type: type })}
                          >
                            <Text style={[
                              styles.categoryButtonText,
                              { color: isDark ? colors.foreground : '#374151' },
                              materialsForm.material_type === type && styles.categoryButtonTextActive
                            ]}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Material Color</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={materialsForm.material_color}
                        onChangeText={(v) => setMaterialsForm({ ...materialsForm, material_color: v })}
                        placeholder="e.g., Weathered Wood"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Drip Edge</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={materialsForm.drip_edge}
                        onChangeText={(v) => setMaterialsForm({ ...materialsForm, drip_edge: v })}
                        placeholder="e.g., Brown"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Vent Color</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={materialsForm.vent_color}
                        onChangeText={(v) => setMaterialsForm({ ...materialsForm, vent_color: v })}
                        placeholder="e.g., Black"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Category</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.material_category || '-'}</Text>
                  </View>
                  {(deal.material_category === 'Metal' || deal.material_category === 'Architectural Metal') && (
                    <View style={styles.infoItem}>
                      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Metal Type</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.material_type || '-'}</Text>
                    </View>
                  )}
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Material Color</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.material_color || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Drip Edge</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.drip_edge || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Vent Color</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.vent_color || '-'}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Notes Card */}
            {deal.notes && (
              <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Notes</Text>
                </View>
                <Text style={[styles.notesText, { color: colors.foreground }]}>{deal.notes}</Text>
              </View>
            )}

            {/* Timeline Card */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="time" size={18} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Timeline</Text>
              </View>
              <View style={styles.timelineList}>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <Text style={[styles.timelineLabel, { color: colors.foreground }]}>Created</Text>
                  <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.created_at), 'MMM d, yyyy')}</Text>
                </View>
                {deal.inspection_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#5C6BC0' }]} />
                    <Text style={[styles.timelineLabel, { color: colors.foreground }]}>Inspection</Text>
                    <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.inspection_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
                {deal.signed_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#66BB6A' }]} />
                    <Text style={[styles.timelineLabel, { color: colors.foreground }]}>Contract Signed</Text>
                    <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.signed_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
                {deal.adjuster_meeting_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#EC407A' }]} />
                    <Text style={[styles.timelineLabel, { color: colors.foreground }]}>Adjuster Meeting</Text>
                    <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.adjuster_meeting_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
                {deal.install_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={[styles.timelineLabel, { color: colors.foreground }]}>Install Date</Text>
                    <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.install_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
                {deal.completion_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                    <Text style={[styles.timelineLabel, { color: colors.foreground }]}>Completed</Text>
                    <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.completion_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {activeTab === 'insurance' && (
          <View style={styles.tabContent}>
            {/* Insurance Card */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="shield" size={18} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Insurance Details</Text>
                </View>
                {/* Only allow editing if financials are not locked */}
                {!deal.approved_date && (
                  <TouchableOpacity onPress={() => {
                    if (!isEditingInsurance) {
                      // Starting to edit - populate form with current deal values
                      setInsuranceForm({
                        insurance_company: deal.insurance_company || '',
                        policy_number: deal.policy_number || '',
                        claim_number: deal.claim_number || '',
                        date_of_loss: deal.date_of_loss || '',
                        deductible: deal.deductible?.toString() || '',
                        rcv: deal.rcv?.toString() || '',
                        acv: deal.acv?.toString() || '',
                        depreciation: deal.depreciation?.toString() || '',
                        adjuster_name: deal.adjuster_name || '',
                        adjuster_phone: deal.adjuster_phone || '',
                      });
                    }
                    setIsEditingInsurance(!isEditingInsurance);
                  }}>
                    <Ionicons name={isEditingInsurance ? "close" : "pencil"} size={18} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Approval Status Banner */}
              {deal.approval_type && deal.approved_date ? (
                <View style={[styles.approvalBanner, styles.approvalBannerApproved]}>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.approvalBannerTitle}>Approved by Admin</Text>
                    <Text style={styles.approvalBannerSubtitle}>
                      {deal.approval_type === 'full' ? 'Full Approval' :
                       deal.approval_type === 'partial' ? 'Partial Approval' :
                       deal.approval_type === 'supplement_needed' ? 'Supplement Needed' :
                       deal.approval_type === 'sale' ? 'Sale (Homeowner Pays)' : deal.approval_type}
                    </Text>
                  </View>
                  <Ionicons name="lock-closed" size={16} color="#22C55E" />
                </View>
              ) : (deal.rcv || deal.acv) ? (
                <View style={[styles.approvalBanner, styles.approvalBannerPending]}>
                  <Ionicons name="time" size={20} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.approvalBannerTitle, { color: '#F59E0B' }]}>Pending Admin Approval</Text>
                    <Text style={styles.approvalBannerSubtitle}>Financial details will be locked once approved</Text>
                  </View>
                </View>
              ) : null}

              {isEditingInsurance ? (
                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Company</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                      value={insuranceForm.insurance_company}
                      onChangeText={(v) => setInsuranceForm({ ...insuranceForm, insurance_company: v })}
                      placeholder="Insurance Company"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Policy #</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={insuranceForm.policy_number}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, policy_number: v })}
                        placeholder="Policy Number"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Claim #</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={insuranceForm.claim_number}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, claim_number: v })}
                        placeholder="Claim Number"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Date of Loss</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                      value={insuranceForm.date_of_loss}
                      onChangeText={(v) => setInsuranceForm({ ...insuranceForm, date_of_loss: v })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>RCV</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={insuranceForm.rcv}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, rcv: v })}
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>ACV</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={insuranceForm.acv}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, acv: v })}
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Depreciation</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={insuranceForm.depreciation}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, depreciation: v })}
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Deductible</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={insuranceForm.deductible}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, deductible: v })}
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Adjuster Name</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={insuranceForm.adjuster_name}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, adjuster_name: v })}
                        placeholder="Adjuster Name"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Adjuster Phone</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                        value={insuranceForm.adjuster_phone}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, adjuster_phone: v })}
                        placeholder="Phone"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveInsurance} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.infoGrid}>
                  <View style={styles.infoItemFull}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Company</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.insurance_company || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Policy #</Text>
                    <Text style={[styles.infoValueMono, { color: colors.foreground }]}>{deal.policy_number || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Claim #</Text>
                    <Text style={[styles.infoValueMono, { color: colors.foreground }]}>{deal.claim_number || '-'}</Text>
                  </View>
                  {deal.date_of_loss && (
                    <View style={styles.infoItemFull}>
                      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Date of Loss</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>{format(new Date(deal.date_of_loss), 'MMM d, yyyy')}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Insurance Details Card */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Financial Details</Text>
                </View>
                {deal.approved_date && (
                  <View style={styles.lockedBadge}>
                    <Ionicons name="lock-closed" size={12} color="#22C55E" />
                    <Text style={styles.lockedBadgeText}>Locked</Text>
                  </View>
                )}
              </View>

              {/* Approval Status for Financial Section */}
              {deal.approval_type && deal.approved_date && (
                <View style={[styles.approvalBannerSmall, { marginBottom: 12 }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text style={styles.approvalBannerSmallText}>
                    Admin approved - {deal.approval_type === 'full' ? 'Full Approval' :
                     deal.approval_type === 'partial' ? 'Partial Approval' :
                     deal.approval_type === 'supplement_needed' ? 'Supplement Needed' :
                     deal.approval_type === 'sale' ? 'Sale' : deal.approval_type}
                  </Text>
                </View>
              )}

              <View style={styles.financialGrid}>
                <View style={styles.financialItem}>
                  <Text style={[styles.financialLabel, { color: colors.mutedForeground }]}>RCV (Total Claim)</Text>
                  <Text style={[styles.financialValue, { color: colors.primary }]}>
                    ${(Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={[styles.financialLabel, { color: colors.mutedForeground }]}>ACV</Text>
                  <Text style={[styles.financialValue, { color: colors.foreground }]}>${Number(deal.acv || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={[styles.financialLabel, { color: colors.mutedForeground }]}>Depreciation</Text>
                  <Text style={[styles.financialValue, { color: '#F97316' }]}>
                    ${Number(deal.depreciation || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={[styles.financialLabel, { color: colors.mutedForeground }]}>Deductible</Text>
                  <Text style={[styles.financialValue, { color: '#EF4444' }]}>${Number(deal.deductible || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>

              {/* Formula Reminder */}
              <View style={[styles.formulaReminder, { backgroundColor: isDark ? 'rgba(201, 162, 77, 0.15)' : 'rgba(201, 162, 77, 0.1)' }]}>
                <Text style={[styles.formulaReminderText, { color: colors.mutedForeground }]}>ACV + Depreciation = RCV</Text>
                <Text style={[styles.formulaReminderValues, { color: colors.foreground }]}>
                  ${Number(deal.acv || 0).toLocaleString()} + ${Number(deal.depreciation || 0).toLocaleString()} = ${(Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))).toLocaleString()}
                </Text>
              </View>

              {/* Checks Collection */}
              <View style={[styles.checksSection, { borderTopColor: isDark ? colors.border : '#E5E7EB' }]}>
                <View style={[styles.checkRow, { backgroundColor: isDark ? colors.secondary : '#F9FAFB' }]}>
                  <View style={styles.checkStatus}>
                    <Ionicons
                      name={deal.acv_check_collected ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={deal.acv_check_collected ? "#22C55E" : "#9CA3AF"}
                    />
                    <Text style={[styles.checkLabel, { color: colors.foreground }]}>1st Check (ACV - Deductible)</Text>
                  </View>
                  <Text style={[styles.checkAmount, { color: colors.foreground }]}>${(Number(deal.acv || 0) - Number(deal.deductible || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={[styles.checkRow, { backgroundColor: isDark ? colors.secondary : '#F9FAFB' }]}>
                  <View style={styles.checkStatus}>
                    <Ionicons
                      name={deal.depreciation_check_collected ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={deal.depreciation_check_collected ? "#22C55E" : "#9CA3AF"}
                    />
                    <Text style={[styles.checkLabel, { color: colors.foreground }]}>2nd Check (Depreciation)</Text>
                  </View>
                  <Text style={[styles.checkAmount, { color: '#F97316' }]}>${Number(deal.depreciation || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>

              {/* Payment Summary */}
              <View style={[styles.paymentSummary, { borderTopColor: isDark ? colors.border : '#E5E7EB' }]}>
                <View style={styles.paymentRow}>
                  <Text style={[styles.paymentLabel, { color: colors.mutedForeground }]}>Insurance Pays</Text>
                  <Text style={[styles.paymentValue, { color: colors.foreground }]}>${((Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))) - Number(deal.deductible || 0)).toLocaleString()}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={[styles.paymentLabel, { color: colors.mutedForeground }]}>Homeowner Pays</Text>
                  <Text style={[styles.paymentValue, { color: colors.foreground }]}>${Number(deal.deductible || 0).toLocaleString()}</Text>
                </View>
              </View>

              {/* Receipt Buttons */}
              <View style={[styles.receiptButtonsContainer, { borderTopColor: isDark ? colors.border : '#E5E7EB' }]}>
                <Text style={[styles.receiptButtonsTitle, { color: colors.mutedForeground }]}>Receipts</Text>
                <View style={styles.receiptButtons}>
                  <View style={styles.receiptButtonWrapper}>
                    <TouchableOpacity
                      style={styles.receiptButton}
                      onPress={() => { setReceiptType('acv'); setShowPaymentReceipt(true); }}
                    >
                      <Ionicons name="cash-outline" size={18} color={colors.primary} />
                      <Text style={styles.receiptButtonText}>ACV</Text>
                    </TouchableOpacity>
                    {deal.acv_receipt_url && (
                      <TouchableOpacity
                        style={styles.viewReceiptButton}
                        onPress={() => handleViewReceipt(deal.acv_receipt_url!, 'ACV Receipt')}
                      >
                        <Ionicons name="eye" size={14} color="#22C55E" />
                        <Text style={styles.viewReceiptText}>View</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.receiptButtonWrapper}>
                    <TouchableOpacity
                      style={styles.receiptButton}
                      onPress={() => { setReceiptType('deductible'); setShowPaymentReceipt(true); }}
                    >
                      <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                      <Text style={styles.receiptButtonText}>Deductible</Text>
                    </TouchableOpacity>
                    {deal.deductible_receipt_url && (
                      <TouchableOpacity
                        style={styles.viewReceiptButton}
                        onPress={() => handleViewReceipt(deal.deductible_receipt_url!, 'Deductible Receipt')}
                      >
                        <Ionicons name="eye" size={14} color="#22C55E" />
                        <Text style={styles.viewReceiptText}>View</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.receiptButtonWrapper}>
                    <TouchableOpacity
                      style={styles.receiptButton}
                      onPress={() => { setReceiptType('depreciation'); setShowPaymentReceipt(true); }}
                    >
                      <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
                      <Text style={styles.receiptButtonText}>Depreciation</Text>
                    </TouchableOpacity>
                    {deal.depreciation_receipt_url && (
                      <TouchableOpacity
                        style={styles.viewReceiptButton}
                        onPress={() => handleViewReceipt(deal.depreciation_receipt_url!, 'Depreciation Receipt')}
                      >
                        <Ionicons name="eye" size={14} color="#22C55E" />
                        <Text style={styles.viewReceiptText}>View</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* View Saved Invoice */}
                {deal.invoice_url && (
                  <TouchableOpacity
                    style={styles.viewInvoiceButton}
                    onPress={() => handleViewReceipt(deal.invoice_url!, 'Invoice')}
                  >
                    <Ionicons name="document-text" size={18} color="#FFF" />
                    <Text style={styles.viewInvoiceText}>View Saved Invoice</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Commission Details Card - Only show after admin approves financials */}
            {/* Hide/Show toggle for presenting to homeowner */}
            <TouchableOpacity
              style={[styles.hideCommissionToggle, { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderColor: colors.border }]}
              onPress={() => setHideCommission(!hideCommission)}
            >
              <Ionicons name={hideCommission ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 13, marginLeft: 6 }}>
                {hideCommission ? 'More Info' : 'Hide Info'}
              </Text>
            </TouchableOpacity>

            {!hideCommission && (
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="cash" size={18} color="#22C55E" />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Commission Details</Text>
              </View>

              {deal.approved_date ? (
                <>
                  {/* Commission Breakdown */}
                  <View style={[styles.commissionBreakdown, { backgroundColor: isDark ? colors.secondary : '#F9FAFB' }]}>
                    <View style={styles.commissionRow}>
                      <Text style={[styles.commissionLabel, { color: colors.mutedForeground }]}>RCV (Total Claim)</Text>
                      <Text style={[styles.commissionValue, { color: colors.foreground }]}>
                        ${(Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={styles.commissionRow}>
                      <Text style={[styles.commissionLabel, { color: colors.mutedForeground }]}>Sales Tax (8.25%)</Text>
                      <Text style={[styles.commissionValue, { color: '#EF4444' }]}>
                        -${((Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))) * 0.0825).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={[styles.commissionDivider, { backgroundColor: isDark ? colors.border : '#E5E7EB' }]} />
                    <View style={styles.commissionRow}>
                      <Text style={[styles.commissionLabel, { color: colors.mutedForeground }]}>Base Amount</Text>
                      <Text style={[styles.commissionValue, { color: colors.foreground }]}>
                        ${((Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))) * 0.9175).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={styles.commissionRow}>
                      <Text style={[styles.commissionLabel, { color: colors.mutedForeground }]}>
                        Commission Level {repCommissionLevelName ? `(${repCommissionLevelName})` : ''} @ {deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent}%
                      </Text>
                      <Text style={[styles.commissionValue, { color: colors.foreground }]}>
                        ×{deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent}%
                      </Text>
                    </View>
                  </View>

                  {/* Commission Formula */}
                  <View style={[styles.commissionFormula, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                    <Text style={[styles.formulaText, { color: colors.mutedForeground }]}>(RCV - Sales Tax) × Commission % = Commission</Text>
                  </View>

                  {/* Commission Override Banner - show if admin adjusted */}
                  {deal.commission_override_amount && (
                    <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.4)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="information-circle" size={16} color="#F59E0B" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#FCD34D' : '#92400E' }}>Commission Adjusted by Admin</Text>
                      </View>
                      {deal.commission_override_reason && (
                        <Text style={{ fontSize: 12, color: isDark ? '#FCD34D' : '#92400E', marginTop: 2 }}>Reason: {deal.commission_override_reason}</Text>
                      )}
                    </View>
                  )}

                  {/* Commission Amount */}
                  <View style={styles.commissionTotal}>
                    <Text style={styles.commissionTotalLabel}>Your Commission</Text>
                    <Text style={styles.commissionTotalValue}>
                      ${(
                        deal.commission_override_amount
                          ? Number(deal.commission_override_amount)
                          : (Number(deal.deal_commissions?.[0]?.commission_amount) || ((Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))) * 0.9175 * ((deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent) / 100)))
                      ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>

                  {/* Payment Status */}
                  {deal.deal_commissions?.[0] && (
                    <View style={[styles.paymentStatusBadge, deal.deal_commissions[0].paid ? styles.paymentStatusPaid : styles.paymentStatusUnpaid]}>
                      <Ionicons
                        name={deal.deal_commissions[0].paid ? "checkmark-circle" : "time"}
                        size={16}
                        color={deal.deal_commissions[0].paid ? "#22C55E" : "#F59E0B"}
                      />
                      <Text style={[styles.paymentStatusText, deal.deal_commissions[0].paid ? styles.paymentStatusTextPaid : styles.paymentStatusTextUnpaid]}>
                        {deal.deal_commissions[0].paid
                          ? 'Commission Paid'
                          : deal.payment_requested
                            ? 'Waiting for Commission Approval'
                            : 'Commission Pending'}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.commissionPendingApproval}>
                  <Ionicons name="lock-closed" size={24} color="#9CA3AF" />
                  <Text style={[styles.commissionPendingTitle, { color: colors.mutedForeground }]}>Pending Admin Approval</Text>
                  <Text style={[styles.commissionPendingText, { color: isDark ? colors.mutedForeground : '#9CA3AF' }]}>
                    Commission details will be available after admin approves the financial details.
                  </Text>
                </View>
              )}
            </View>
            )}

            {/* Adjuster Card */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="person-circle" size={18} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Adjuster</Text>
                </View>
                {deal.adjuster_phone && (
                  <TouchableOpacity style={styles.callAdjusterBtn} onPress={handleCallAdjuster}>
                    <Ionicons name="call" size={14} color="#3B82F6" />
                    <Text style={styles.callAdjusterText}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Name</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.adjuster_name || '-'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Phone</Text>
                  <Text style={[styles.infoValue, deal.adjuster_phone && { color: '#3B82F6' }]}>
                    {deal.adjuster_phone || '-'}
                  </Text>
                </View>
                {deal.adjuster_meeting_date && (
                  <View style={styles.infoItemFull}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Meeting Date</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{format(new Date(deal.adjuster_meeting_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {activeTab === 'docs' && (
          <View style={styles.tabContent}>
            {/* Inspection Report Generator */}
            <TouchableOpacity
              style={[styles.generateReportCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}
              onPress={() => setShowInspectionReport(true)}
            >
              <View style={styles.generateReportIcon}>
                <Ionicons name="document-text" size={24} color="#FFF" />
              </View>
              <View style={styles.generateReportContent}>
                <Text style={[styles.generateReportTitle, { color: colors.foreground }]}>Inspection Report</Text>
                <Text style={[styles.generateReportSubtitle, { color: colors.mutedForeground }]}>
                  Generate professional inspection report with photos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Contract / Agreement */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="document-text" size={18} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Contract / Agreement</Text>
              </View>

              {deal.contract_signed ? (
                <>
                  {/* Signed Status */}
                  <View style={[styles.docComplete, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                    <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                    <View style={styles.docCompleteText}>
                      <Text style={styles.docCompleteTitle}>Contract Signed</Text>
                      <Text style={[styles.docCompleteDate, { color: colors.mutedForeground }]}>
                        {deal.signed_date ? format(new Date(deal.signed_date), 'MMM d, yyyy') : 'Signed'}
                      </Text>
                    </View>
                  </View>

                  {/* View Full Agreement Document */}
                  {deal.agreement_document_url && (
                    <TouchableOpacity
                      style={[styles.docAction, { marginTop: 10 }]}
                      onPress={() => handleViewReceipt(deal.agreement_document_url!, 'Signed Agreement')}
                    >
                      <Ionicons name="document-text" size={20} color={colors.primary} />
                      <Text style={styles.docActionText}>View Full Agreement</Text>
                    </TouchableOpacity>
                  )}

                  {/* View Signature only if no full agreement */}
                  {deal.signature_url && !deal.agreement_document_url && (
                    <TouchableOpacity
                      style={[styles.docAction, { marginTop: 10 }]}
                      onPress={() => handleViewDocument(deal.signature_url!)}
                    >
                      <Ionicons name="eye" size={20} color={colors.primary} />
                      <Text style={styles.docActionText}>View Signature</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (deal.inspection_images && deal.inspection_images.length > 0) ? (
                <View style={{ gap: 10 }}>
                  {/* Sign Agreement Button */}
                  <TouchableOpacity
                    style={styles.docAction}
                    onPress={() => setShowSignaturePad(true)}
                  >
                    <Ionicons name="create" size={20} color={colors.primary} />
                    <Text style={styles.docActionText}>Sign Agreement</Text>
                  </TouchableOpacity>

                  {/* Upload Agreement Button */}
                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                    onPress={() => handleUploadDocument('insurance_agreement')}
                    disabled={uploadingCategory === 'insurance_agreement'}
                  >
                    {uploadingCategory === 'insurance_agreement' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                        <Text style={styles.uploadButtonText}>Upload Insurance Agreement</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Show uploaded agreement if exists */}
                  {deal.insurance_agreement_url && (
                    <TouchableOpacity
                      style={[styles.viewDocButton, { marginTop: 4 }]}
                      onPress={() => handleViewDocument(deal.insurance_agreement_url!, 'Insurance Agreement')}
                    >
                      <Ionicons name="document-attach" size={18} color={colors.primary} />
                      <Text style={styles.viewDocText}>View Uploaded Agreement</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={[styles.docLocked, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}>
                  <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
                  <Text style={[styles.docLockedText, { color: colors.mutedForeground }]}>Upload inspection photos first</Text>
                </View>
              )}
            </View>

            {/* Lost Statement */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="document-attach" size={18} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Lost Statement</Text>
              </View>
              {deal.lost_statement_url ? (
                <View style={[styles.docComplete, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                  <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  <View style={styles.docCompleteText}>
                    <Text style={styles.docCompleteTitle}>Lost Statement Uploaded</Text>
                    <TouchableOpacity onPress={() => handleViewDocument(deal.lost_statement_url!, 'Lost Statement')}>
                      <Text style={[styles.docCompleteDate, { color: colors.primary }]}>View Document</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                  onPress={() => handleUploadDocument('lost_statement')}
                  disabled={uploadingCategory === 'lost_statement'}
                >
                  {uploadingCategory === 'lost_statement' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                      <Text style={styles.uploadButtonText}>Upload Lost Statement</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* ACV Receipt */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="receipt" size={18} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>ACV Receipt</Text>
              </View>
              {deal.acv_receipt_url ? (
                <View style={[styles.docComplete, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                  <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  <View style={styles.docCompleteText}>
                    <Text style={styles.docCompleteTitle}>ACV Receipt Uploaded</Text>
                    <TouchableOpacity onPress={() => handleViewDocument(deal.acv_receipt_url!, 'ACV Receipt')}>
                      <Text style={[styles.docCompleteDate, { color: colors.primary }]}>View Receipt</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : deal.approved_date ? (
                <TouchableOpacity
                  style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                  onPress={() => handleUploadDocument('acv_receipt')}
                  disabled={uploadingCategory === 'acv_receipt'}
                >
                  {uploadingCategory === 'acv_receipt' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                      <Text style={styles.uploadButtonText}>Upload ACV Receipt</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.docLocked, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}>
                  <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
                  <Text style={[styles.docLockedText, { color: colors.mutedForeground }]}>Available after admin approval</Text>
                </View>
              )}
            </View>

            {/* Deductible Receipt */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="receipt" size={18} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Deductible Receipt</Text>
              </View>
              {deal.deductible_receipt_url ? (
                <View style={[styles.docComplete, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                  <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  <View style={styles.docCompleteText}>
                    <Text style={styles.docCompleteTitle}>Deductible Receipt Uploaded</Text>
                    <TouchableOpacity onPress={() => handleViewDocument(deal.deductible_receipt_url!, 'Deductible Receipt')}>
                      <Text style={[styles.docCompleteDate, { color: colors.primary }]}>View Receipt</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : deal.approved_date ? (
                <TouchableOpacity
                  style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                  onPress={() => handleUploadDocument('deductible_receipt')}
                  disabled={uploadingCategory === 'deductible_receipt'}
                >
                  {uploadingCategory === 'deductible_receipt' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                      <Text style={styles.uploadButtonText}>Upload Deductible Receipt</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.docLocked, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}>
                  <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
                  <Text style={[styles.docLockedText, { color: colors.mutedForeground }]}>Available after admin approval</Text>
                </View>
              )}
            </View>

            {/* Photos */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="camera" size={18} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Photos</Text>
                {loadingImages && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
              </View>

              {/* Inspection Photos */}
              <View style={[styles.docSection, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}>
                <View style={styles.docSectionHeader}>
                  <Text style={[styles.docSectionTitle, { color: colors.foreground }]}>Inspection Photos</Text>
                  <Text style={[styles.docSectionCount, { backgroundColor: isDark ? colors.secondary : '#F3F4F6', color: colors.mutedForeground }]}>{deal.inspection_images?.length || 0}</Text>
                </View>
                {deal.inspection_images && deal.inspection_images.length > 0 && (
                  <TouchableOpacity
                    style={styles.imagePreviewRow}
                    onPress={() => handleViewImages(deal.inspection_images!)}
                  >
                    {deal.inspection_images.slice(0, 4).map((img, idx) => (
                      <ImageThumbnail key={idx} imageKey={img} size={56} />
                    ))}
                    {deal.inspection_images.length > 4 && (
                      <View style={styles.imageThumbMore}>
                        <Text style={styles.imageThumbMoreText}>+{deal.inspection_images.length - 4}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                  onPress={() => handleAddPhotos('inspection')}
                  disabled={uploadingCategory === 'inspection'}
                >
                  {uploadingCategory === 'inspection' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={20} color={colors.primary} />
                      <Text style={styles.uploadButtonText}>Add Photos</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Install Photos */}
              <View style={[styles.docSection, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}>
                <View style={styles.docSectionHeader}>
                  <Text style={[styles.docSectionTitle, { color: colors.foreground }]}>Install Photos</Text>
                  <Text style={[styles.docSectionCount, { backgroundColor: isDark ? colors.secondary : '#F3F4F6', color: colors.mutedForeground }]}>{deal.install_images?.length || 0}</Text>
                </View>
                {deal.install_images && deal.install_images.length > 0 && (
                  <TouchableOpacity
                    style={styles.imagePreviewRow}
                    onPress={() => handleViewImages(deal.install_images!)}
                  >
                    {deal.install_images.slice(0, 4).map((img, idx) => (
                      <ImageThumbnail key={idx} imageKey={img} size={56} />
                    ))}
                    {deal.install_images.length > 4 && (
                      <View style={styles.imageThumbMore}>
                        <Text style={styles.imageThumbMoreText}>+{deal.install_images.length - 4}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                {currentIndex >= 8 ? (
                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                    onPress={() => handleAddPhotos('install')}
                    disabled={uploadingCategory === 'install'}
                  >
                    {uploadingCategory === 'install' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={20} color={colors.primary} />
                        <Text style={styles.uploadButtonText}>Add Photos</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.docLocked, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}>
                    <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                    <Text style={[styles.docLockedText, { color: colors.mutedForeground }]}>Available after install scheduled</Text>
                  </View>
                )}
              </View>

              {/* Completion Photos */}
              <View style={[styles.docSection, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}>
                <View style={styles.docSectionHeader}>
                  <Text style={[styles.docSectionTitle, { color: colors.foreground }]}>Completion Photos</Text>
                  <Text style={[styles.docSectionCount, { backgroundColor: isDark ? colors.secondary : '#F3F4F6', color: colors.mutedForeground }]}>{deal.completion_images?.length || 0}</Text>
                </View>
                {deal.completion_images && deal.completion_images.length > 0 && (
                  <TouchableOpacity
                    style={styles.imagePreviewRow}
                    onPress={() => handleViewImages(deal.completion_images!)}
                  >
                    {deal.completion_images.slice(0, 4).map((img, idx) => (
                      <ImageThumbnail key={idx} imageKey={img} size={56} />
                    ))}
                    {deal.completion_images.length > 4 && (
                      <View style={styles.imageThumbMore}>
                        <Text style={styles.imageThumbMoreText}>+{deal.completion_images.length - 4}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                {currentIndex >= 9 ? (
                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                    onPress={() => handleAddPhotos('completion')}
                    disabled={uploadingCategory === 'completion'}
                  >
                    {uploadingCategory === 'completion' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={20} color={colors.primary} />
                        <Text style={styles.uploadButtonText}>Add Photos</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.docLocked, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}>
                    <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                    <Text style={[styles.docLockedText, { color: colors.mutedForeground }]}>Available after installation</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Final Inspection / Completion Form */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Final Inspection Statement</Text>
              </View>

              {(() => {
                // Check if we're at or past the installed milestone
                const installedIndex = milestones.findIndex(m => m.status === 'installed');
                const isAtOrPastInstalled = currentIndex >= installedIndex;
                const hasCompletionSignature = !!deal.completion_form_signature_url;
                const hasHomeownerSignature = !!deal.homeowner_completion_signature_url;
                const bothSigned = hasCompletionSignature && hasHomeownerSignature;

                console.log('[Completion Form UI] Check:', {
                  isAtOrPastInstalled,
                  hasCompletionSignature,
                  hasHomeownerSignature,
                  bothSigned,
                  completion_form_signature_url: deal.completion_form_signature_url ? 'SET' : 'NOT SET',
                  homeowner_completion_signature_url: deal.homeowner_completion_signature_url ? 'SET' : 'NOT SET',
                });

                if (!isAtOrPastInstalled) {
                  return (
                    <View style={[styles.docLocked, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}>
                      <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
                      <Text style={[styles.docLockedText, { color: colors.mutedForeground }]}>Available after installation is complete</Text>
                    </View>
                  );
                }

                if (bothSigned) {
                  return (
                    <View style={{ gap: 12 }}>
                      <View style={[styles.docComplete, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)' }]}>
                        <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                        <View style={styles.docCompleteText}>
                          <Text style={styles.docCompleteTitle}>Completion Form Signed</Text>
                          <Text style={[styles.docCompleteDate, { color: colors.mutedForeground }]}>
                            Both parties have signed
                          </Text>
                        </View>
                      </View>

                      {/* View Completion Form button */}
                      <TouchableOpacity
                        style={styles.viewDocButton}
                        onPress={() => {
                          // If we have the saved HTML document, show it in a viewer
                          if (deal.completion_form_url && deal.completion_form_url.startsWith('data:text/html;base64,')) {
                            try {
                              const base64Content = deal.completion_form_url.replace('data:text/html;base64,', '');
                              const htmlContent = decodeURIComponent(escape(atob(base64Content)));
                              setCompletionFormHtmlContent(htmlContent);
                              setShowCompletionFormViewer(true);
                            } catch (e) {
                              console.error('[Completion Form] Error decoding HTML:', e);
                              // Fallback to signature view
                              setShowCompletionFormSignature(true);
                            }
                          } else {
                            // Fallback to signature view showing the saved signatures
                            setShowCompletionFormSignature(true);
                          }
                        }}
                      >
                        <Ionicons name="eye" size={18} color={colors.primary} />
                        <Text style={styles.viewDocText}>View Completion Form</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View style={{ gap: 10 }}>
                    <Text style={styles.docDescription}>
                      Have the homeowner review and sign the final inspection statement to confirm the work is complete.
                    </Text>

                    {/* Rep Signature */}
                    <View style={styles.signatureStatusRow}>
                      <Ionicons
                        name={hasCompletionSignature ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={hasCompletionSignature ? "#22C55E" : "#9CA3AF"}
                      />
                      <Text style={[styles.signatureStatusText, hasCompletionSignature && { color: '#22C55E' }]}>
                        {hasCompletionSignature ? 'Rep Signature ✓' : 'Rep Signature Required'}
                      </Text>
                    </View>

                    {/* Homeowner Signature */}
                    <View style={styles.signatureStatusRow}>
                      <Ionicons
                        name={hasHomeownerSignature ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={hasHomeownerSignature ? "#22C55E" : "#9CA3AF"}
                      />
                      <Text style={[styles.signatureStatusText, hasHomeownerSignature && { color: '#22C55E' }]}>
                        {hasHomeownerSignature ? 'Homeowner Signature ✓' : 'Homeowner Signature Required'}
                      </Text>
                    </View>

                    {/* Sign Button */}
                    <TouchableOpacity
                      style={styles.docAction}
                      onPress={() => setShowCompletionFormSignature(true)}
                    >
                      <Ionicons name="create" size={20} color={colors.primary} />
                      <Text style={styles.docActionText}>Sign Completion Form</Text>
                    </TouchableOpacity>

                    {/* Upload Option */}
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={() => handleUploadDocument('completion_form')}
                      disabled={uploadingCategory === 'completion_form'}
                    >
                      {uploadingCategory === 'completion_form' ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                          <Text style={styles.uploadButtonText}>Upload Signed Form</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </View>

            {/* Documents */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="folder" size={18} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Documents</Text>
              </View>

              {/* Permit */}
              <View style={[styles.docSection, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}>
                <View style={styles.docSectionHeader}>
                  <Text style={[styles.docSectionTitle, { color: colors.foreground }]}>Permit</Text>
                  {deal.permit_file_url && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                </View>
                {deal.permit_file_url ? (
                  <TouchableOpacity
                    style={[styles.viewDocButton, { backgroundColor: isDark ? 'rgba(201, 162, 77, 0.15)' : 'rgba(201, 162, 77, 0.1)' }]}
                    onPress={() => handleViewDocument(deal.permit_file_url!)}
                  >
                    <Ionicons name="eye" size={18} color={colors.primary} />
                    <Text style={styles.viewDocText}>View Document</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                    onPress={() => handleUploadDocument('permit')}
                    disabled={uploadingCategory === 'permit'}
                  >
                    {uploadingCategory === 'permit' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                        <Text style={styles.uploadButtonText}>Upload Permit</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Lost Statement */}
              <View style={[styles.docSection, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}>
                <View style={styles.docSectionHeader}>
                  <Text style={[styles.docSectionTitle, { color: colors.foreground }]}>Lost Statement</Text>
                  {deal.lost_statement_url && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                </View>
                {deal.lost_statement_url ? (
                  <TouchableOpacity
                    style={[styles.viewDocButton, { backgroundColor: isDark ? 'rgba(201, 162, 77, 0.15)' : 'rgba(201, 162, 77, 0.1)' }]}
                    onPress={() => handleViewDocument(deal.lost_statement_url!)}
                  >
                    <Ionicons name="eye" size={18} color={colors.primary} />
                    <Text style={styles.viewDocText}>View Document</Text>
                  </TouchableOpacity>
                ) : currentIndex >= 3 ? (
                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                    onPress={() => handleUploadDocument('lost_statement')}
                    disabled={uploadingCategory === 'lost_statement'}
                  >
                    {uploadingCategory === 'lost_statement' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                        <Text style={styles.uploadButtonText}>Upload Lost Statement</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.docLocked, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}>
                    <Ionicons name="lock-closed" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.docLockedText, { color: colors.mutedForeground }]}>Available after signing</Text>
                  </View>
                )}
              </View>

              {/* Insurance Agreement */}
              <View style={[styles.docSection, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}>
                <View style={styles.docSectionHeader}>
                  <Text style={[styles.docSectionTitle, { color: colors.foreground }]}>Insurance Agreement</Text>
                  {deal.insurance_agreement_url && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                </View>
                {deal.insurance_agreement_url ? (
                  <TouchableOpacity
                    style={[styles.viewDocButton, { backgroundColor: isDark ? 'rgba(201, 162, 77, 0.15)' : 'rgba(201, 162, 77, 0.1)' }]}
                    onPress={() => handleViewDocument(deal.insurance_agreement_url!)}
                  >
                    <Ionicons name="eye" size={18} color={colors.primary} />
                    <Text style={styles.viewDocText}>View Document</Text>
                  </TouchableOpacity>
                ) : currentIndex >= 2 ? (
                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor: isDark ? colors.border : '#E5E7EB' }]}
                    onPress={() => handleUploadDocument('insurance_agreement')}
                    disabled={uploadingCategory === 'insurance_agreement'}
                  >
                    {uploadingCategory === 'insurance_agreement' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                        <Text style={styles.uploadButtonText}>Upload Agreement</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.docLocked, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}>
                    <Ionicons name="lock-closed" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.docLockedText, { color: colors.mutedForeground }]}>Available after inspection</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal visible={showImageViewer} transparent animationType="fade">
        <View style={styles.imageViewerOverlay}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>
              {currentImageIndex + 1} / {viewingImages.length}
            </Text>
            <TouchableOpacity onPress={() => setShowImageViewer(false)}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentImageIndex(index);
            }}
            contentOffset={{ x: currentImageIndex * SCREEN_WIDTH, y: 0 }}
          >
            {viewingImages.map((img, idx) => (
              <View key={idx} style={styles.imageViewerSlide}>
                <Image
                  source={{ uri: img }}
                  style={styles.imageViewerImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.imageViewerNav}>
            <TouchableOpacity
              onPress={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
              disabled={currentImageIndex === 0}
              style={[styles.imageNavButton, currentImageIndex === 0 && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-back" size={32} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCurrentImageIndex(Math.min(viewingImages.length - 1, currentImageIndex + 1))}
              disabled={currentImageIndex === viewingImages.length - 1}
              style={[styles.imageNavButton, currentImageIndex === viewingImages.length - 1 && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-forward" size={32} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Status</Text>
              <TouchableOpacity onPress={() => setShowStatusPicker(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.statusList}>
              {milestones.map((milestone) => {
                const conf = statusConfig[milestone.status];
                const isSelected = deal.status === milestone.status;
                const isPhaseStart = milestones.indexOf(milestone) === 0 ||
                  milestones[milestones.indexOf(milestone) - 1].phase !== milestone.phase;

                return (
                  <View key={milestone.status}>
                    {isPhaseStart && (
                      <Text style={[styles.modalPhaseLabel, { color: phaseColors[milestone.phase] }]}>
                        {phaseLabels[milestone.phase]}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.statusOption, isSelected && styles.statusOptionSelected]}
                      onPress={() => handleStatusChange(milestone.status)}
                    >
                      <View style={[styles.statusDot, { backgroundColor: conf.color }]} />
                      <View style={styles.statusOptionContent}>
                        <Text style={[styles.statusOptionText, isSelected && styles.statusOptionTextSelected]}>
                          {conf.label}
                        </Text>
                        <Text style={styles.statusOptionDesc} numberOfLines={1}>{conf.description}</Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Inspection Report Modal */}
      <Modal visible={showInspectionReport} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
          <InspectionReport
            deal={deal}
            onClose={() => setShowInspectionReport(false)}
          />
        </SafeAreaView>
      </Modal>

      {/* Payment Receipt Modal */}
      <Modal visible={showPaymentReceipt} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
          <PaymentReceipt
            deal={deal}
            repName="Sales Rep"
            type={receiptType}
            onClose={() => setShowPaymentReceipt(false)}
            onSave={handleReceiptSave}
          />
        </SafeAreaView>
      </Modal>

      {/* HTML Viewer Modal for base64 content */}
      <Modal visible={showHtmlViewer} animationType="slide">
        <View style={styles.htmlViewerContainer}>
          <View style={styles.htmlViewerHeader}>
            <TouchableOpacity onPress={() => setShowHtmlViewer(false)} style={styles.htmlViewerCloseBtn}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.htmlViewerTitle} numberOfLines={1}>{htmlViewerTitle}</Text>
            <TouchableOpacity onPress={handleShareHtmlDocument} style={styles.htmlViewerShareBtn}>
              <Ionicons name="share-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: htmlViewerContent }}
            style={{ flex: 1 }}
            originWhitelist={['*']}
            scalesPageToFit={true}
          />
        </View>
      </Modal>

      {/* Agreement & Signature Modal - Stepped Signing Flow */}
      <Modal visible={showSignaturePad} animationType="slide">
        <SafeAreaView style={styles.signatureModalContainer}>
          <View style={[styles.signatureModalHeader, { paddingTop: 16 }]}>
            <TouchableOpacity onPress={() => {
              setShowSignaturePad(false);
              setAgreementStep(0);
              setFeeInitials(null);
              setRepSignature(null);
              setOwnerSignature(null);
              setDeckingInitials(null);
              setConstructionSignature(null);
              setSupplementsSignature(null);
            }} style={styles.signatureCloseBtn}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.signatureModalTitle}>
              {agreementStep === 0 ? 'Insurance Agreement' : `Signature ${agreementStep} of 6`}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Progress indicator */}
          {agreementStep > 0 && (
            <View style={styles.signatureProgress}>
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <View
                  key={step}
                  style={[
                    styles.signatureProgressDot,
                    step <= agreementStep && { backgroundColor: colors.primary },
                    step < agreementStep && { backgroundColor: '#22C55E' },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Step 0: Read Agreement */}
          {agreementStep === 0 && (
            <>
              <ScrollView
                style={styles.agreementScrollView}
                showsVerticalScrollIndicator={false}
              >
                {/* Company Header */}
                <View style={styles.agreementHeader}>
                  <Text style={styles.agreementCompanyName}>TITAN PRIME SOLUTIONS</Text>
                  <Text style={styles.agreementTagline}>INSURANCE-CONTINGENT ROOFING AGREEMENT</Text>
                </View>

                <View style={styles.agreementDivider} />

                {/* OWNER & CLAIM INFORMATION */}
                <View style={styles.agreementSection}>
                  <Text style={styles.agreementSectionTitle}>OWNER & CLAIM INFORMATION</Text>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Owner Full Name:</Text>
                    <Text style={styles.contractFieldValue}>{deal.homeowner_name || '________________________________'}</Text>
                  </View>

              <View style={styles.contractField}>
                <Text style={styles.contractFieldLabel}>Property Address:</Text>
                <Text style={styles.contractFieldValue}>
                  {deal.address || '________________________________'}
                  {deal.city ? `, ${deal.city}` : ''}
                  {deal.state ? `, ${deal.state}` : ''}
                  {deal.zip_code ? ` ${deal.zip_code}` : ''}
                </Text>
              </View>

              <View style={styles.contractField}>
                <Text style={styles.contractFieldLabel}>Primary Phone:</Text>
                    <Text style={styles.contractFieldValue}>{deal.homeowner_phone || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Email Address:</Text>
                    <Text style={styles.contractFieldValue}>{deal.homeowner_email || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Insurance Carrier:</Text>
                    <Text style={styles.contractFieldValue}>{deal.insurance_company || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Policy ID:</Text>
                    <Text style={styles.contractFieldValue}>{deal.policy_number || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Claim Reference #:</Text>
                    <Text style={styles.contractFieldValue}>{deal.claim_number || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Reported Date of Loss:</Text>
                    <Text style={styles.contractFieldValue}>{deal.date_of_loss ? format(new Date(deal.date_of_loss), 'MMMM d, yyyy') : '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Roofing System Type (Existing):</Text>
                    <Text style={styles.contractFieldValue}>{deal.roof_type || deal.material_category || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Assigned Adjuster Name:</Text>
                    <Text style={styles.contractFieldValue}>{deal.adjuster_name || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Adjuster Phone #:</Text>
                    <Text style={styles.contractFieldValue}>{deal.adjuster_phone || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Prime PRO:</Text>
                    <Text style={styles.contractFieldValue}>{deal.rep_name || '________________________________'}</Text>
                  </View>
                </View>

                <View style={styles.agreementDivider} />

                {/* INSURANCE CONTINGENCY & CLAIM SERVICES */}
                <View style={styles.agreementSection}>
                  <Text style={styles.agreementSectionTitle}>INSURANCE CONTINGENCY & CLAIM SERVICES</Text>
                  <Text style={styles.agreementText}>
                    This Agreement is entered into based on the outcome of the insurance claim process. Titan Prime Solutions' scope of work is limited to items approved by the insurer. Owner is responsible for any applicable deductible and for any upgrades, additions, or services not included in the insurer's determination of coverage. Owner agrees to provide Titan Prime Solutions with relevant insurance documentation necessary to perform the work.
                  </Text>
                </View>

                <View style={styles.agreementDivider} />

                {/* INSURANCE CLAIM SERVICES FEE */}
                <View style={styles.agreementSection}>
                  <Text style={styles.agreementSectionTitle}>INSURANCE CLAIM SERVICES FEE (APPROVAL-BASED)</Text>
                  <Text style={styles.agreementText}>
                    If Owner cancels this Agreement after insurance approval and after Titan Prime Solutions has performed insurance-related services, including inspections, measurements, documentation, claim preparation, or insurer coordination, Owner agrees to pay Titan Prime Solutions a flat claim services fee of $1,250.
                  </Text>
                  <Text style={styles.agreementText}>
                    This fee reflects the reasonable value of services rendered and is not based on insurance proceeds. The fee becomes due and payable upon cancellation following claim approval.
                  </Text>
                  <View style={[styles.signatureRequiredBox, feeInitials && styles.signatureCompletedBox]}>
                    <Text style={styles.signatureRequiredLabel}>$1,250 Claim Services Fee – Owner Initials</Text>
                    {feeInitials ? (
                      <Image source={{ uri: feeInitials }} style={styles.miniSignaturePreview} />
                    ) : (
                      <Text style={styles.signatureRequiredText}>Signature required in Step 1</Text>
                    )}
                  </View>
                </View>

                <View style={styles.agreementDivider} />

                {/* 3-DAY RIGHT TO CANCEL */}
                <View style={styles.agreementSection}>
                  <Text style={styles.agreementSectionTitle}>3-DAY RIGHT TO CANCEL</Text>
                  <Text style={styles.agreementText}>
                    Owner may terminate this Agreement within three (3) business days of execution by providing written notice via email to titanprimesolutionstx@gmail.com, which must be received no later than the close of business on the third business day following execution of this Agreement.
                  </Text>
                  <Text style={styles.agreementText}>
                    This Agreement is governed by the laws of the State of Texas.
                  </Text>
                </View>

                <View style={styles.agreementDivider} />

                {/* ACCEPTANCE */}
                <View style={styles.agreementSection}>
                  <Text style={styles.agreementSectionTitle}>ACCEPTANCE</Text>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Prime PRO (Printed Name):</Text>
                    <Text style={styles.contractFieldValue}>{deal.rep_name || '________________________________'}</Text>
                  </View>
                  <View style={[styles.signatureRequiredBox, repSignature && styles.signatureCompletedBox]}>
                    <Text style={styles.signatureRequiredLabel}>Prime PRO Signature</Text>
                    {repSignature ? (
                      <Image source={{ uri: repSignature }} style={styles.miniSignaturePreview} />
                    ) : (
                      <Text style={styles.signatureRequiredText}>Signature required in Step 2</Text>
                    )}
                  </View>

                  <View style={[styles.contractField, { marginTop: 16 }]}>
                    <Text style={styles.contractFieldLabel}>Property Owner (Printed Name):</Text>
                    <Text style={styles.contractFieldValue}>{deal.homeowner_name || '________________________________'}</Text>
                  </View>
                  <View style={[styles.signatureRequiredBox, ownerSignature && styles.signatureCompletedBox]}>
                    <Text style={styles.signatureRequiredLabel}>Property Owner Signature</Text>
                    {ownerSignature ? (
                      <Image source={{ uri: ownerSignature }} style={styles.miniSignaturePreview} />
                    ) : (
                      <Text style={styles.signatureRequiredText}>Signature required in Step 3</Text>
                    )}
                  </View>

                  <View style={[styles.contractField, { marginTop: 16 }]}>
                    <Text style={styles.contractFieldLabel}>Date Signed:</Text>
                    <Text style={styles.contractFieldValue}>{format(new Date(), 'MMMM d, yyyy')}</Text>
                  </View>
                </View>

                <View style={styles.agreementDivider} />
                <View style={styles.agreementDivider} />

                {/* IMPORTANT NOTICE TO PROPERTY OWNER */}
                <View style={styles.agreementSection}>
                  <Text style={[styles.agreementSectionTitle, { color: '#92400E' }]}>IMPORTANT NOTICE TO PROPERTY OWNER</Text>

                  <Text style={styles.agreementText}>
                    Titan Prime Solutions will begin work on the scheduled installation date during normal construction hours and may mobilize crews, equipment, and materials without additional notice.
                  </Text>

                  <Text style={styles.agreementText}>
                    Roof installation requires fastening materials through roof decking in accordance with applicable building codes. As a result, fasteners may be visible from attic or interior roof areas.
                  </Text>

                  <Text style={styles.agreementText}>
                    Authorized representatives of Titan Prime Solutions, including crew members, supervisors, inspectors, and documentation personnel, may access the Property as required to perform or document the work.
                  </Text>

                  <Text style={styles.agreementText}>
                    The Owner is responsible for removing vehicles, personal property, and exterior items from areas surrounding the Property that could be affected by falling debris, including furniture, planters, trailers, and patio or pool items.
                  </Text>

                  <Text style={styles.agreementText}>
                    A dumpster or equipment trailer may be placed in the most accessible area of the Property and may temporarily block driveway or garage access.
                  </Text>

                  <Text style={styles.agreementText}>
                    Construction vibration may occur. The Owner should remove or secure items mounted on interior walls. Titan Prime Solutions is not responsible for damage to unsecured interior items.
                  </Text>

                  <Text style={styles.agreementText}>
                    Certain existing components, including skylights, drywall, ceiling finishes, gutters, stucco, paint, patio covers, or HVAC components, may be affected due to age, prior installation, or vibration. Titan Prime Solutions is not responsible for incidental damage to pre-existing materials resulting from normal and non-negligent construction activities.
                  </Text>

                  <Text style={styles.agreementText}>
                    Construction areas may contain nails, tools, cords, or debris. The Owner is responsible for keeping occupants and visitors clear of work areas. Titan Prime Solutions is not responsible for injuries resulting from failure to do so.
                  </Text>

                  <Text style={styles.agreementText}>
                    Permits may be posted on the Property as required and must remain until inspections are completed.
                  </Text>

                  <Text style={styles.agreementText}>
                    If satellite, internet, or similar services require disconnection or adjustment, the Owner is responsible for coordinating reconnection. Titan Prime Solutions is not responsible for service interruptions or implied solar warranties.
                  </Text>

                  <Text style={styles.agreementText}>
                    The Owner must disclose any concealed utilities, gas lines, electrical lines, refrigerant lines, or other systems beneath the roof decking prior to installation. Titan Prime Solutions is not responsible for damage to undisclosed conditions.
                  </Text>

                  <Text style={styles.agreementText}>
                    Existing HVAC components showing corrosion or deterioration will be reinstalled as-is unless replacement is authorized. Titan Prime Solutions is not responsible for issues related to pre-existing conditions.
                  </Text>

                  <Text style={styles.agreementText}>
                    The Owner is responsible for HOA compliance, including material and color approvals.
                  </Text>

                  <View style={[styles.signatureRequiredBox, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }, deckingInitials && styles.signatureCompletedBox]}>
                    <Text style={[styles.agreementText, { color: '#DC2626', fontWeight: '600', marginBottom: 8 }]}>
                      Replacement of rotted decking, if discovered, will be charged at $3.00 per square foot.
                    </Text>
                    <Text style={styles.signatureRequiredLabel}>Owner Initials</Text>
                    {deckingInitials ? (
                      <Image source={{ uri: deckingInitials }} style={styles.miniSignaturePreview} />
                    ) : (
                      <Text style={styles.signatureRequiredText}>Signature required in Step 4</Text>
                    )}
                  </View>

                  <Text style={styles.agreementText}>
                    Abusive, threatening, or unprofessional conduct toward Contractor personnel will result in immediate suspension of work and termination of the Agreement, with the Owner responsible for costs incurred.
                  </Text>
                </View>

                <View style={styles.agreementDivider} />

                {/* ACKNOWLEDGMENT – CONSTRUCTION NOTICE */}
                <View style={styles.agreementSection}>
                  <Text style={styles.agreementSectionTitle}>ACKNOWLEDGMENT – CONSTRUCTION NOTICE</Text>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Owner Name:</Text>
                    <Text style={styles.contractFieldValue}>{deal.homeowner_name || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Property Address:</Text>
                    <Text style={styles.contractFieldValue}>{deal.address || '________________________________'}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                    <View style={{ flex: 2 }}>
                      <View style={[styles.signatureRequiredBox, constructionSignature && styles.signatureCompletedBox]}>
                        <Text style={styles.signatureRequiredLabel}>Owner Signature</Text>
                        {constructionSignature ? (
                          <Image source={{ uri: constructionSignature }} style={styles.miniSignaturePreview} />
                        ) : (
                          <Text style={styles.signatureRequiredText}>Signature required in Step 5</Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contractFieldLabel}>Date:</Text>
                      <Text style={styles.contractFieldValue}>{format(new Date(), 'MM/dd/yyyy')}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.agreementDivider} />
                <View style={styles.agreementDivider} />

                {/* NOTICE REGARDING ADDITIONAL INSURANCE REQUESTS (SUPPLEMENTS) */}
                <View style={styles.agreementSection}>
                  <Text style={styles.agreementSectionTitle}>NOTICE REGARDING ADDITIONAL INSURANCE REQUESTS (SUPPLEMENTS)</Text>

                  <Text style={styles.agreementText}>
                    During the course of an insurance-related roofing project, additional damage, labor, or materials may be identified that were not included in the insurer's initial estimate. When this occurs, Contractor may submit additional documentation to the insurance company requesting review of those items.
                  </Text>

                  <Text style={styles.agreementText}>
                    These requests may be necessary when certain conditions were not visible at the time of the original inspection or when quantities differ from the insurer's original assessment. Examples may include additional roofing layers, damaged decking, required code items, disposal costs, or adjustments resulting from field measurements.
                  </Text>

                  <Text style={styles.agreementText}>
                    For example, if the insurer's estimate is based on one material quantity, but actual installation requires a greater amount due to roof configuration, waste factors, or hidden conditions, additional documentation may be submitted for the difference.
                  </Text>

                  <Text style={styles.agreementText}>
                    Insurance coverage decisions are governed by the terms and exclusions of the policy.
                  </Text>
                </View>

                <View style={styles.agreementDivider} />

                {/* ACKNOWLEDGMENT – INSURANCE SUPPLEMENTS */}
                <View style={styles.agreementSection}>
                  <Text style={styles.agreementSectionTitle}>ACKNOWLEDGMENT – INSURANCE SUPPLEMENTS</Text>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Owner Name:</Text>
                    <Text style={styles.contractFieldValue}>{deal.homeowner_name || '________________________________'}</Text>
                  </View>

                  <View style={styles.contractField}>
                    <Text style={styles.contractFieldLabel}>Property Address:</Text>
                    <Text style={styles.contractFieldValue}>{deal.address || '________________________________'}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                    <View style={{ flex: 2 }}>
                      <View style={[styles.signatureRequiredBox, supplementsSignature && styles.signatureCompletedBox]}>
                        <Text style={styles.signatureRequiredLabel}>Owner Signature</Text>
                        {supplementsSignature ? (
                          <Image source={{ uri: supplementsSignature }} style={styles.miniSignaturePreview} />
                        ) : (
                          <Text style={styles.signatureRequiredText}>Signature required in Step 6</Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contractFieldLabel}>Date:</Text>
                      <Text style={styles.contractFieldValue}>{format(new Date(), 'MM/dd/yyyy')}</Text>
                    </View>
                  </View>
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>

              {/* Footer - Start Signing */}
              <View style={styles.signatureActions}>
                <TouchableOpacity
                  style={styles.signatureCancelButton}
                  onPress={() => setShowSignaturePad(false)}
                >
                  <Text style={styles.signatureCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.signatureSaveButton}
                  onPress={() => setAgreementStep(1)}
                >
                  <Ionicons name="create" size={20} color="#FFF" />
                  <Text style={styles.signatureSaveText}>Start Signing (6 signatures)</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Step 1: $1,250 Fee Initials */}
          {agreementStep === 1 && (
            <View style={styles.signatureStepContainer}>
              <Text style={styles.signatureStepTitle}>$1,250 Claim Services Fee</Text>
              <Text style={styles.signatureStepSubtitle}>Owner Initials Required</Text>
              <Text style={styles.signatureStepDescription}>
                By initialing below, Owner acknowledges the $1,250 claim services fee if canceling after insurance approval.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={agreementSignatureRef}
                  onOK={(sig: string) => {
                    setFeeInitials(sig);
                    setAgreementStep(2);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please provide your initials')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm Initials"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => setAgreementStep(0)} style={[styles.clearSignatureBtn, { marginRight: 8 }]}>
                  <Ionicons name="arrow-back" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.readSignature()} style={styles.confirmSignatureBtn}>
                  <Text style={styles.confirmSignatureText}>Confirm & Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 2: Prime PRO Signature */}
          {agreementStep === 2 && (
            <View style={styles.signatureStepContainer}>
              <Text style={styles.signatureStepTitle}>Prime PRO Signature</Text>
              <Text style={styles.signatureStepSubtitle}>{deal.rep_name || 'Sales Representative'}</Text>
              <Text style={styles.signatureStepDescription}>
                Prime PRO signature for the Acceptance section.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={agreementSignatureRef}
                  onOK={(sig: string) => {
                    setRepSignature(sig);
                    setAgreementStep(3);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please sign before continuing')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm Signature"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => setAgreementStep(1)} style={[styles.clearSignatureBtn, { marginRight: 8 }]}>
                  <Ionicons name="arrow-back" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.readSignature()} style={styles.confirmSignatureBtn}>
                  <Text style={styles.confirmSignatureText}>Confirm & Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Property Owner Signature */}
          {agreementStep === 3 && (
            <View style={styles.signatureStepContainer}>
              <Text style={styles.signatureStepTitle}>Property Owner Signature</Text>
              <Text style={styles.signatureStepSubtitle}>{deal.homeowner_name}</Text>
              <Text style={styles.signatureStepDescription}>
                Property owner signature for the Acceptance section.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={agreementSignatureRef}
                  onOK={(sig: string) => {
                    setOwnerSignature(sig);
                    setAgreementStep(4);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please sign before continuing')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm Signature"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => setAgreementStep(2)} style={[styles.clearSignatureBtn, { marginRight: 8 }]}>
                  <Ionicons name="arrow-back" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.readSignature()} style={styles.confirmSignatureBtn}>
                  <Text style={styles.confirmSignatureText}>Confirm & Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 4: Rotted Decking Initials */}
          {agreementStep === 4 && (
            <View style={styles.signatureStepContainer}>
              <Text style={styles.signatureStepTitle}>Rotted Decking Fee</Text>
              <Text style={styles.signatureStepSubtitle}>Owner Initials Required</Text>
              <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <Text style={{ color: '#DC2626', fontWeight: '600', fontSize: 14 }}>
                  Replacement of rotted decking, if discovered, will be charged at $3.00 per square foot.
                </Text>
              </View>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={agreementSignatureRef}
                  onOK={(sig: string) => {
                    setDeckingInitials(sig);
                    setAgreementStep(5);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please provide your initials')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm Initials"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => setAgreementStep(3)} style={[styles.clearSignatureBtn, { marginRight: 8 }]}>
                  <Ionicons name="arrow-back" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.readSignature()} style={styles.confirmSignatureBtn}>
                  <Text style={styles.confirmSignatureText}>Confirm & Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 5: Construction Notice Signature */}
          {agreementStep === 5 && (
            <View style={styles.signatureStepContainer}>
              <Text style={styles.signatureStepTitle}>Construction Notice</Text>
              <Text style={styles.signatureStepSubtitle}>Acknowledgment Signature</Text>
              <Text style={styles.signatureStepDescription}>
                By signing, you acknowledge receipt of the Important Notice to Property Owner.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={agreementSignatureRef}
                  onOK={(sig: string) => {
                    setConstructionSignature(sig);
                    setAgreementStep(6);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please sign before continuing')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm Signature"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => setAgreementStep(4)} style={[styles.clearSignatureBtn, { marginRight: 8 }]}>
                  <Ionicons name="arrow-back" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.readSignature()} style={styles.confirmSignatureBtn}>
                  <Text style={styles.confirmSignatureText}>Confirm & Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 6: Insurance Supplements Signature */}
          {agreementStep === 6 && (
            <View style={styles.signatureStepContainer}>
              <Text style={styles.signatureStepTitle}>Insurance Supplements</Text>
              <Text style={styles.signatureStepSubtitle}>Acknowledgment Signature</Text>
              <Text style={styles.signatureStepDescription}>
                By signing, you acknowledge the Notice Regarding Additional Insurance Requests.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={agreementSignatureRef}
                  onOK={(sig: string) => {
                    setSupplementsSignature(sig);
                    // All signatures complete - save agreement
                    handleSignatureSave(sig);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please sign before continuing')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Complete Agreement"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => setAgreementStep(5)} style={[styles.clearSignatureBtn, { marginRight: 8 }]}>
                  <Ionicons name="arrow-back" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => agreementSignatureRef.current?.readSignature()} style={[styles.confirmSignatureBtn, { backgroundColor: '#22C55E' }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.confirmSignatureText}>Complete & Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Adjuster Date Picker Modal */}
      <Modal visible={showAdjusterDatePicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.datePickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowAdjusterDatePicker(false)}
        >
          <View style={styles.datePickerModalContent}>
            <View style={styles.datePickerModalHeader}>
              <Text style={styles.datePickerModalTitle}>Select Adjuster Meeting Date</Text>
              <TouchableOpacity onPress={() => setShowAdjusterDatePicker(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Simple date selection with month/day/year pickers */}
            <View style={styles.datePickerRow}>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Month</Text>
                <ScrollView style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.datePickerItem,
                        adjusterDatePickerValue.getMonth() + 1 === month && styles.datePickerItemActive
                      ]}
                      onPress={() => {
                        const newDate = new Date(adjusterDatePickerValue);
                        newDate.setMonth(month - 1);
                        setAdjusterDatePickerValue(newDate);
                      }}
                    >
                      <Text style={[
                        styles.datePickerItemText,
                        adjusterDatePickerValue.getMonth() + 1 === month && styles.datePickerItemTextActive
                      ]}>
                        {format(new Date(2024, month - 1, 1), 'MMM')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Day</Text>
                <ScrollView style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.datePickerItem,
                        adjusterDatePickerValue.getDate() === day && styles.datePickerItemActive
                      ]}
                      onPress={() => {
                        const newDate = new Date(adjusterDatePickerValue);
                        newDate.setDate(day);
                        setAdjusterDatePickerValue(newDate);
                      }}
                    >
                      <Text style={[
                        styles.datePickerItemText,
                        adjusterDatePickerValue.getDate() === day && styles.datePickerItemTextActive
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>Year</Text>
                <ScrollView style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.datePickerItem,
                        adjusterDatePickerValue.getFullYear() === year && styles.datePickerItemActive
                      ]}
                      onPress={() => {
                        const newDate = new Date(adjusterDatePickerValue);
                        newDate.setFullYear(year);
                        setAdjusterDatePickerValue(newDate);
                      }}
                    >
                      <Text style={[
                        styles.datePickerItemText,
                        adjusterDatePickerValue.getFullYear() === year && styles.datePickerItemTextActive
                      ]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Selected date preview */}
            <View style={styles.datePickerPreview}>
              <Text style={styles.datePickerPreviewText}>
                {format(adjusterDatePickerValue, 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>

            {/* Confirm button */}
            <TouchableOpacity
              style={styles.datePickerConfirmBtn}
              onPress={() => {
                const formattedDate = format(adjusterDatePickerValue, 'yyyy-MM-dd');
                handleWorkflowFieldChange('adjuster_meeting_date', formattedDate);
                setShowAdjusterDatePicker(false);
              }}
            >
              <Ionicons name="checkmark" size={20} color="#FFF" />
              <Text style={styles.datePickerConfirmText}>Confirm Date</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Completion Form Signature Modal - FINAL COMPLETION & WALK-THROUGH RECORD */}
      <Modal visible={showCompletionFormSignature} animationType="slide">
        <SafeAreaView style={[styles.signatureModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.signatureModalHeader, { paddingTop: 16 }]}>
            <TouchableOpacity onPress={() => {
              setShowCompletionFormSignature(false);
              setCompletionFormStep(0);
              setSection1Initials(null);
              setSection2Initials(null);
              setRepCompletionSignature(null);
              setHomeownerCompletionSignature(null);
            }} style={styles.signatureCloseBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.signatureModalTitle, { color: colors.foreground }]}>Final Completion & Walk-Through</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Step indicator */}
          {completionFormStep > 0 && (
            <View style={[styles.signatureStepIndicator, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderBottomColor: colors.border }]}>
              <Text style={[styles.signatureStepText, { color: colors.foreground }]}>Signature {completionFormStep} of 4</Text>
              <View style={styles.signatureStepDots}>
                {[1, 2, 3, 4].map(step => (
                  <View
                    key={step}
                    style={[
                      styles.signatureStepDot,
                      step <= completionFormStep && styles.signatureStepDotActive
                    ]}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Step 0: Read and fill form */}
          {completionFormStep === 0 && (
            <ScrollView
              style={styles.agreementScrollView}
              showsVerticalScrollIndicator={false}
            >
              {/* Company Header */}
              <View style={styles.agreementHeader}>
                <Text style={styles.agreementCompanyName}>TITAN PRIME SOLUTIONS</Text>
                <Text style={styles.agreementTagline}>FINAL COMPLETION & WALK-THROUGH RECORD</Text>
              </View>

              <Text style={[styles.agreementText, { fontStyle: 'italic', marginBottom: 16 }]}>
                This record relates to and is incorporated into the Roofing Agreement between Owner and Titan Prime Solutions.
              </Text>

              {/* Project Info */}
              <View style={styles.contractField}>
                <Text style={styles.contractFieldLabel}>Project Address:</Text>
                <Text style={styles.contractFieldValue}>
                  {deal.address || ''}
                  {deal.city ? `, ${deal.city}` : ''}
                  {deal.state ? `, ${deal.state}` : ''}
                  {deal.zip_code ? ` ${deal.zip_code}` : ''}
                </Text>
              </View>

              <View style={styles.contractField}>
                <Text style={styles.contractFieldLabel}>Crew Lead Name:</Text>
                <TextInput
                  style={[styles.workflowInput, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', marginTop: 4 }]}
                  value={crewLeadName}
                  onChangeText={setCrewLeadName}
                  placeholder="Enter crew lead name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.contractField}>
                <Text style={styles.contractFieldLabel}>Date of Review:</Text>
                <Text style={styles.contractFieldValue}>{format(new Date(), 'MMMM d, yyyy')}</Text>
              </View>

              {/* Walk-Through Type */}
              <View style={[styles.agreementSection, { marginTop: 16 }]}>
                <Text style={styles.contractFieldLabel}>Walk-Through Conducted (select one):</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  {(['in_person', 'virtual', 'declined'] as const).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.categoryButton,
                        { flex: 1, backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
                        walkThroughType === type && styles.categoryButtonActive
                      ]}
                      onPress={() => setWalkThroughType(type)}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        walkThroughType === type && styles.categoryButtonTextActive
                      ]}>
                        {type === 'in_person' ? 'In Person' : type === 'virtual' ? 'Virtual' : 'Declined'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Individuals Present */}
              <View style={[styles.agreementSection, { marginTop: 16 }]}>
                <Text style={styles.agreementSectionTitle}>Individuals Present</Text>

                <View style={styles.contractField}>
                  <Text style={styles.contractFieldLabel}>Owner(s):</Text>
                  <TextInput
                    style={[styles.workflowInput, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', marginTop: 4 }]}
                    value={individualsOwners || deal.homeowner_name}
                    onChangeText={setIndividualsOwners}
                    placeholder="Owner name(s)"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.contractField}>
                  <Text style={styles.contractFieldLabel}>Titan PRO Crew Lead / Representative:</Text>
                  <TextInput
                    style={[styles.workflowInput, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', marginTop: 4 }]}
                    value={individualsTitanPro || deal.rep_name || ''}
                    onChangeText={setIndividualsTitanPro}
                    placeholder="Rep name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.contractField}>
                  <Text style={styles.contractFieldLabel}>Other(s):</Text>
                  <TextInput
                    style={[styles.workflowInput, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', marginTop: 4 }]}
                    value={individualsOthers}
                    onChangeText={setIndividualsOthers}
                    placeholder="Other individuals present (optional)"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <View style={styles.agreementDivider} />

              {/* SECTION 1 */}
              <View style={styles.agreementSection}>
                <Text style={styles.agreementSectionTitle}>SECTION 1 – WALK-THROUGH STATUS</Text>
                <Text style={styles.agreementText}>
                  Owner acknowledges that a final walk-through of the roofing work was offered and either completed or declined at Owner's discretion. If declined, Owner accepts the condition of the work as observed at the time of completion.
                </Text>
                <Text style={[styles.agreementText, { marginTop: 8 }]}>
                  Owner signing below represents and warrants that they have authority to sign on behalf of all owners of the Property.
                </Text>

                <View style={[styles.signatureRequiredBox, section1Initials && styles.signatureCompletedBox, { marginTop: 12 }]}>
                  <Text style={styles.signatureRequiredLabel}>Owner Initials</Text>
                  {section1Initials ? (
                    <Image source={{ uri: section1Initials }} style={styles.miniSignaturePreview} />
                  ) : (
                    <Text style={styles.signatureRequiredText}>Signature required in Step 1</Text>
                  )}
                </View>
              </View>

              <View style={styles.agreementDivider} />

              {/* SECTION 2 */}
              <View style={styles.agreementSection}>
                <Text style={styles.agreementSectionTitle}>SECTION 2 – ITEMS REQUIRING REVIEW (IF ANY)</Text>
                <Text style={styles.agreementText}>
                  If Owner believes any portion of the work is incomplete or requires attention, list below:
                </Text>

                <TextInput
                  style={[styles.workflowInput, {
                    backgroundColor: '#F9FAFB',
                    borderColor: '#E5E7EB',
                    marginTop: 8,
                    minHeight: 100,
                    textAlignVertical: 'top',
                    paddingTop: 12
                  }]}
                  value={reviewItems}
                  onChangeText={setReviewItems}
                  placeholder="List any items requiring review (leave blank if none)"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                />

                <Text style={[styles.agreementText, { marginTop: 16 }]}>
                  Titan Prime Solutions acknowledges receipt of the items listed above and will review them. This section establishes a seven (7) day review and resolution period.
                </Text>
                <Text style={[styles.agreementText, { marginTop: 8 }]}>
                  If no items are listed above, Owner acknowledges that no outstanding issues were identified at the time of review.
                </Text>

                <View style={[styles.signatureRequiredBox, section2Initials && styles.signatureCompletedBox, { marginTop: 12 }]}>
                  <Text style={styles.signatureRequiredLabel}>Owner Initials (confirming listed items are complete and accurate)</Text>
                  {section2Initials ? (
                    <Image source={{ uri: section2Initials }} style={styles.miniSignaturePreview} />
                  ) : (
                    <Text style={styles.signatureRequiredText}>Signature required in Step 2</Text>
                  )}
                </View>
              </View>

              <View style={styles.agreementDivider} />

              {/* SECTION 3 */}
              <View style={styles.agreementSection}>
                <Text style={styles.agreementSectionTitle}>SECTION 3 – COMPLETION CONFIRMATION</Text>
                <Text style={styles.agreementText}>
                  Owner confirms that all agreed-upon roofing work has been completed in accordance with the Agreement and that the Property is in substantially the same condition as prior to installation, reasonable wear and tear excepted.
                </Text>
                <Text style={[styles.agreementText, { marginTop: 8 }]}>
                  This acknowledgment does not modify, expand, or replace any manufacturer or contractor warranties provided under the Agreement.
                </Text>

                <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
                  <View style={{ flex: 1 }}>
                    <View style={[styles.signatureRequiredBox, homeownerCompletionSignature && styles.signatureCompletedBox]}>
                      <Text style={styles.signatureRequiredLabel}>Owner Signature</Text>
                      {homeownerCompletionSignature ? (
                        <Image source={{ uri: homeownerCompletionSignature }} style={styles.miniSignaturePreview} />
                      ) : (
                        <Text style={styles.signatureRequiredText}>Step 3</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={[styles.signatureRequiredBox, repCompletionSignature && styles.signatureCompletedBox]}>
                      <Text style={styles.signatureRequiredLabel}>Titan PRO Signature</Text>
                      {repCompletionSignature ? (
                        <Image source={{ uri: repCompletionSignature }} style={styles.miniSignaturePreview} />
                      ) : (
                        <Text style={styles.signatureRequiredText}>Step 4</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>
          )}

          {/* Step 1: Section 1 Owner Initials */}
          {completionFormStep === 1 && (
            <View style={[styles.signatureStepContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.signatureStepTitle, { color: colors.foreground }]}>Section 1 - Walk-Through Status</Text>
              <Text style={[styles.signatureStepSubtitle, { color: colors.primary }]}>Owner Initials Required</Text>
              <Text style={[styles.signatureStepDescription, { color: colors.mutedForeground }]}>
                Owner acknowledges the walk-through was offered and either completed or declined.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={completionFormSignatureRef}
                  onOK={(sig: string) => {
                    setSection1Initials(sig);
                    setCompletionFormStep(2);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please sign before continuing')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.readSignature()} style={styles.confirmSignatureBtn}>
                  <Text style={styles.confirmSignatureText}>Confirm & Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 2: Section 2 Owner Initials */}
          {completionFormStep === 2 && (
            <View style={[styles.signatureStepContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.signatureStepTitle, { color: colors.foreground }]}>Section 2 - Items Review</Text>
              <Text style={[styles.signatureStepSubtitle, { color: colors.primary }]}>Owner Initials Required</Text>
              <Text style={[styles.signatureStepDescription, { color: colors.mutedForeground }]}>
                Confirming listed items are complete and accurate, or no issues identified.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={completionFormSignatureRef}
                  onOK={(sig: string) => {
                    setSection2Initials(sig);
                    setCompletionFormStep(3);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please sign before continuing')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.readSignature()} style={styles.confirmSignatureBtn}>
                  <Text style={styles.confirmSignatureText}>Confirm & Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Owner Signature */}
          {completionFormStep === 3 && (
            <View style={[styles.signatureStepContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.signatureStepTitle, { color: colors.foreground }]}>Section 3 - Completion Confirmation</Text>
              <Text style={[styles.signatureStepSubtitle, { color: colors.primary }]}>Owner Signature</Text>
              <Text style={[styles.signatureStepDescription, { color: colors.mutedForeground }]}>
                Owner confirms all agreed-upon roofing work has been completed.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={completionFormSignatureRef}
                  onOK={(sig: string) => {
                    setHomeownerCompletionSignature(sig);
                    setCompletionFormStep(4);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please sign before continuing')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.readSignature()} style={styles.confirmSignatureBtn}>
                  <Text style={styles.confirmSignatureText}>Confirm & Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 4: Titan PRO Signature */}
          {completionFormStep === 4 && (
            <View style={[styles.signatureStepContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.signatureStepTitle, { color: colors.foreground }]}>Section 3 - Completion Confirmation</Text>
              <Text style={[styles.signatureStepSubtitle, { color: colors.primary }]}>Titan PRO Signature</Text>
              <Text style={[styles.signatureStepDescription, { color: colors.mutedForeground }]}>
                Representative confirms the work is complete.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={completionFormSignatureRef}
                  onOK={async (sig: string) => {
                    setRepCompletionSignature(sig);
                    // All signatures collected - save the form
                    await handleSaveCompletionForm(sig);
                  }}
                  onEmpty={() => Alert.alert('Error', 'Please sign before continuing')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; border-radius: 0; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                    canvas { width: 100% !important; height: 100% !important; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureStepActions}>
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.clearSignature()} style={styles.clearSignatureBtn}>
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                  <Text style={styles.clearSignatureText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => completionFormSignatureRef.current?.readSignature()}
                  style={[styles.confirmSignatureBtn, savingCompletionForm && { opacity: 0.7 }]}
                  disabled={savingCompletionForm}
                >
                  {savingCompletionForm ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.confirmSignatureText}>Save & Complete</Text>
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Footer - only show on Step 0 */}
          {completionFormStep === 0 && (
            <View style={styles.signatureActions}>
              <TouchableOpacity
                style={styles.signatureCancelButton}
                onPress={() => {
                  setShowCompletionFormSignature(false);
                  setCompletionFormStep(0);
                }}
              >
                <Text style={styles.signatureCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.signatureSaveButton,
                  (!crewLeadName || !walkThroughType) && { opacity: 0.5 }
                ]}
                disabled={!crewLeadName || !walkThroughType}
                onPress={() => setCompletionFormStep(1)}
              >
                <Text style={styles.signatureSaveText}>Begin Signing</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Completion Form HTML Viewer Modal */}
      <Modal visible={showCompletionFormViewer} animationType="slide">
        <SafeAreaView style={styles.htmlViewerContainer}>
          <View style={styles.htmlViewerHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowCompletionFormViewer(false);
                setCompletionFormHtmlContent(null);
              }}
              style={styles.htmlViewerCloseBtn}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.htmlViewerTitle}>Completion Form</Text>
            <TouchableOpacity
              style={styles.htmlViewerShareBtn}
              onPress={async () => {
                if (completionFormHtmlContent && deal) {
                  try {
                    // Generate and share the PDF
                    const { uri } = await Print.printToFileAsync({
                      html: completionFormHtmlContent,
                      base64: false,
                    });
                    await Sharing.shareAsync(uri, {
                      mimeType: 'application/pdf',
                      dialogTitle: 'Share Completion Form',
                    });
                  } catch (error) {
                    console.error('Share error:', error);
                    Alert.alert('Error', 'Failed to share document');
                  }
                }
              }}
            >
              <Ionicons name="share-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {completionFormHtmlContent && (
            <WebView
              source={{ html: completionFormHtmlContent }}
              style={{ flex: 1 }}
              scalesPageToFit={true}
              showsVerticalScrollIndicator={true}
            />
          )}
        </SafeAreaView>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 16 },
  errorText: { color: '#6B7280', fontSize: 16, marginTop: 12 },
  backButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: staticColors.primary, borderRadius: 8 },
  backButtonText: { color: '#FFF', fontWeight: '600' },

  // HTML Viewer Modal
  htmlViewerContainer: { flex: 1, backgroundColor: '#FFF', paddingTop: 50 },
  htmlViewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  htmlViewerCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 20 },
  htmlViewerShareBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(201, 162, 77, 0.1)', borderRadius: 20 },
  htmlViewerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#111827', textAlign: 'center', marginHorizontal: 8 },

  // Signature Modal
  signatureModalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  signatureModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  signatureCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 20 },
  signatureModalTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  signatureClearBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  signatureClearText: { fontSize: 14, fontWeight: '600', color: staticColors.primary },
  signatureInstructions: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  signatureCanvasContainer: { height: 200, marginHorizontal: 16, marginBottom: 16, marginTop: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  signatureActions: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  signatureCancelButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 8, backgroundColor: '#F3F4F6' },
  signatureCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  signatureSaveButton: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 8, backgroundColor: staticColors.primary },
  signatureSaveText: { fontSize: 15, fontWeight: '600', color: '#FFF' },


  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, marginHorizontal: 12 },
  headerName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  headerAddress: { fontSize: 13, color: '#6B7280' },

  scrollView: { flex: 1 },

  // Progress Section
  progressSection: { backgroundColor: '#FFF', margin: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  progressTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  phaseBadgeText: { fontSize: 12, fontWeight: '600', color: '#0F1E2E' },
  progressPercent: { fontSize: 16, fontWeight: '700' },
  progressDescription: { fontSize: 13, color: '#6B7280', marginTop: 4, marginBottom: 16 },

  // Milestone Tracker
  milestoneScroll: { marginHorizontal: -16 },
  milestoneContent: { paddingHorizontal: 16, paddingVertical: 8 },
  milestoneItem: { alignItems: 'center', width: 70 },
  phaseLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  milestoneNodeRow: { flexDirection: 'row', alignItems: 'center' },
  milestoneLine: { width: 20, height: 3, backgroundColor: '#E5E7EB' },
  milestoneLineComplete: { backgroundColor: staticColors.primary },
  milestoneCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D1D5DB' },
  milestoneCircleComplete: { backgroundColor: staticColors.primary, borderColor: staticColors.primary },
  milestoneCircleCurrent: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: 'rgba(201, 162, 77, 0.4)' },
  milestoneLabel: { fontSize: 9, color: '#374151', textAlign: 'center', marginTop: 6, lineHeight: 12 },
  milestoneLabelCurrent: { fontWeight: '600', color: staticColors.primary },
  milestoneLabelFuture: { color: '#9CA3AF' },
  milestoneTimestamp: { fontSize: 8, color: '#6B7280', textAlign: 'center', marginTop: 2 },
  milestoneTimestampCurrent: { color: staticColors.primary, fontWeight: '500' },

  progressBarContainer: { marginTop: 16 },
  progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: staticColors.primary, borderRadius: 4 },

  // Next Action Card
  nextActionCard: { backgroundColor: 'rgba(201, 162, 77, 0.1)', marginHorizontal: 16, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)' },
  nextActionContent: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  nextActionText: { flex: 1 },
  nextActionLabel: { fontSize: 11, fontWeight: '600', color: staticColors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  nextActionValue: { fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 2 },

  // Workflow Card Styles
  workflowCard: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  workflowCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  workflowCardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  workflowCardDescription: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  workflowFields: { gap: 12, marginTop: 8 },
  workflowFieldContainer: { marginBottom: 4 },
  workflowFieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  workflowFieldLabelText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  workflowInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  workflowSaveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: staticColors.primary, paddingVertical: 14, borderRadius: 8, marginTop: 16 },
  workflowSaveButtonText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  signatureComplete: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)', borderRadius: 8, padding: 12 },
  signatureCompleteText: { fontSize: 14, color: '#16A34A', fontWeight: '500' },
  signatureButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(201, 162, 77, 0.1)', borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)', borderRadius: 8, paddingVertical: 14 },
  signatureButtonText: { fontSize: 14, fontWeight: '600', color: staticColors.primary },
  approvalTypeButtons: { flexDirection: 'row', gap: 8 },
  approvalTypeButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  approvalTypeButtonActive: { backgroundColor: staticColors.primary },
  approvalTypeButtonText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  approvalTypeButtonTextActive: { color: '#FFF' },

  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  actionText: { fontWeight: '600', fontSize: 14 },

  tabContainer: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#111827', fontWeight: '600' },

  tabContent: { paddingHorizontal: 16, paddingTop: 16 },

  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },

  infoGrid: { gap: 12 },
  infoItem: { flexDirection: 'row', justifyContent: 'space-between' },
  infoItemFull: { marginBottom: 8 },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  infoValueMono: { fontSize: 14, color: '#111827', fontWeight: '500', fontFamily: 'monospace' },

  formContainer: { gap: 12 },
  inputGroup: { marginBottom: 8 },
  inputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  inputRow: { flexDirection: 'row', gap: 12 },

  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: staticColors.primary, paddingVertical: 12, borderRadius: 8, marginTop: 8 },
  saveButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  notesText: { fontSize: 14, color: '#374151', lineHeight: 20 },

  timelineList: { gap: 12 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: staticColors.primary },
  timelineLabel: { flex: 1, fontSize: 14, color: '#374151' },
  timelineDate: { fontSize: 13, color: '#6B7280' },

  financialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  financialItem: { width: '45%' },
  financialLabel: { fontSize: 12, color: '#6B7280' },
  financialValue: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginTop: 2 },

  paymentSummary: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  paymentLabel: { fontSize: 13, color: '#6B7280' },
  paymentValue: { fontSize: 14, fontWeight: '600', color: '#111827' },

  // Formula Reminder
  formulaReminder: { backgroundColor: 'rgba(201, 162, 77, 0.1)', borderRadius: 8, padding: 10, marginTop: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.2)' },
  formulaReminderText: { fontSize: 12, color: '#6B7280' },
  formulaReminderValues: { fontSize: 12, fontWeight: '600', color: '#111827', marginTop: 4 },

  // Checks Section
  checksSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 10 },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8 },
  checkStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontSize: 13, color: '#374151' },
  checkAmount: { fontSize: 15, fontWeight: 'bold', color: '#111827' },

  // Receipt Buttons
  receiptButtonsContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  receiptButtonsTitle: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  receiptButtons: { flexDirection: 'row', gap: 8 },
  receiptButtonWrapper: { flex: 1, gap: 4 },
  receiptButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: 'rgba(201, 162, 77, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)' },
  receiptButtonText: { fontSize: 12, fontWeight: '600', color: staticColors.primary },
  viewReceiptButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 6 },
  viewReceiptText: { fontSize: 11, fontWeight: '500', color: '#22C55E' },
  viewInvoiceButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, backgroundColor: '#3B82F6', borderRadius: 8 },
  viewInvoiceText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  // Toggle buttons for date type
  toggleButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toggleButtonActive: { backgroundColor: staticColors.primary, borderColor: staticColors.primary },
  toggleButtonText: { fontSize: 12, fontWeight: '500', color: '#374151' },
  toggleButtonTextActive: { color: '#FFF' },

  // Checkbox for adjuster not assigned
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, borderWidth: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: staticColors.primary, borderColor: staticColors.primary },
  checkboxLabel: { fontSize: 14, fontWeight: '500' },
  checkboxHint: { fontSize: 12, marginTop: 6, marginLeft: 34 },

  // Commission Details
  commissionBreakdown: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, gap: 8 },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commissionLabel: { fontSize: 13, color: '#6B7280' },
  commissionValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  commissionDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  commissionFormula: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 8, padding: 10, marginTop: 12, alignItems: 'center' },
  formulaText: { fontSize: 12, color: '#6B7280' },
  commissionTotal: { backgroundColor: '#22C55E', borderRadius: 10, padding: 16, marginTop: 12, alignItems: 'center' },
  commissionTotalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  commissionTotalValue: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginTop: 4 },
  paymentStatusBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: 10, borderRadius: 8 },
  paymentStatusPaid: { backgroundColor: 'rgba(34, 197, 94, 0.1)' },
  paymentStatusUnpaid: { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
  paymentStatusText: { fontSize: 13, fontWeight: '500' },
  paymentStatusTextPaid: { color: '#22C55E' },
  paymentStatusTextUnpaid: { color: '#F59E0B' },

  // Generate Report Card
  generateReportCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginBottom: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  generateReportIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: staticColors.primary, alignItems: 'center', justifyContent: 'center' },
  generateReportContent: { flex: 1, marginLeft: 12 },
  generateReportTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  generateReportSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  callAdjusterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 6 },
  callAdjusterText: { fontSize: 12, fontWeight: '500', color: '#3B82F6' },

  // Docs Tab
  docComplete: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 10 },
  docCompleteText: { flex: 1 },
  docCompleteTitle: { fontSize: 14, fontWeight: '600', color: '#22C55E' },
  docCompleteDate: { fontSize: 12, color: '#6B7280' },

  docAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: 'rgba(201, 162, 77, 0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)' },
  docActionText: { fontSize: 14, fontWeight: '600', color: staticColors.primary },

  docLocked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 10 },
  docLockedText: { fontSize: 13, color: '#9CA3AF' },
  docDescription: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  signatureStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  signatureStatusText: { fontSize: 14, color: '#6B7280' },

  docSection: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  docSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  docSectionTitle: { fontSize: 14, fontWeight: '500', color: '#374151' },
  docSectionCount: { fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },

  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, borderStyle: 'dashed' },
  uploadButtonText: { fontSize: 14, fontWeight: '500', color: staticColors.primary },

  viewDocButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: 'rgba(201, 162, 77, 0.1)', borderRadius: 8 },
  viewDocText: { fontSize: 13, fontWeight: '500', color: staticColors.primary },

  // Image Preview
  imagePreviewRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  imageThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  imageThumbImage: { width: 56, height: 56, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  imageThumbMore: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'rgba(201, 162, 77, 0.2)', alignItems: 'center', justifyContent: 'center' },
  imageThumbMoreText: { fontSize: 14, fontWeight: '600', color: staticColors.primary },

  // Image Viewer Modal
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  imageViewerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50 },
  imageViewerTitle: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  imageViewerSlide: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 200, alignItems: 'center', justifyContent: 'center' },
  imageViewerImage: { width: SCREEN_WIDTH - 40, height: SCREEN_HEIGHT - 250 },
  imageViewerNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 40 },
  imageNavButton: { padding: 10 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  statusList: { padding: 16 },
  modalPhaseLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  statusOptionSelected: { backgroundColor: 'rgba(201, 162, 77, 0.1)' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusOptionContent: { flex: 1 },
  statusOptionText: { fontSize: 15, color: '#374151' },
  statusOptionTextSelected: { fontWeight: '600', color: '#111827' },
  statusOptionDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // Material Category Buttons
  categoryButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  categoryButtonActive: { backgroundColor: staticColors.primary, borderColor: staticColors.primary },
  categoryButtonText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  categoryButtonTextActive: { color: '#FFFFFF' },

  // Approval Banner Styles
  approvalBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, marginBottom: 12 },
  approvalBannerApproved: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' },
  approvalBannerPending: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  approvalBannerTitle: { fontSize: 14, fontWeight: '600', color: '#22C55E' },
  approvalBannerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  approvalBannerSmall: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 6 },
  approvalBannerSmallText: { fontSize: 12, color: '#22C55E', fontWeight: '500' },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 6 },
  lockedBadgeText: { fontSize: 11, fontWeight: '600', color: '#22C55E' },

  // Agreement Modal Styles
  agreementScrollView: { flex: 1, paddingHorizontal: 16 },
  agreementHeader: { backgroundColor: '#0F1E2E', padding: 20, borderRadius: 12, alignItems: 'center', marginVertical: 16 },
  agreementCompanyName: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  agreementTagline: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  agreementInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 12 },
  agreementInfoItem: { flex: 1, minWidth: '45%', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8 },
  agreementInfoLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  agreementInfoValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  agreementDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  agreementSection: { marginBottom: 16 },
  agreementSectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  agreementText: { fontSize: 12, color: '#4B5563', lineHeight: 20, marginBottom: 8 },
  agreementHighlight: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 10 },
  warrantySection: { backgroundColor: 'rgba(201, 162, 77, 0.1)', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)' },
  warrantyItem: { fontSize: 12, color: '#374151', marginBottom: 6 },
  warningSection: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  warningText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  feeBox: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  feeText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  noticeItem: { fontSize: 12, color: '#374151', lineHeight: 20, marginBottom: 8 },
  contractField: { marginBottom: 12 },
  contractFieldLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  contractFieldValue: { fontSize: 14, color: '#111827', fontWeight: '500', borderBottomWidth: 1, borderBottomColor: '#D1D5DB', paddingBottom: 4 },
  initialsBox: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 12 },
  initialsLabel: { fontSize: 12, color: '#374151', fontWeight: '500' },
  initialsLine: { flex: 1, height: 1, backgroundColor: '#111827', marginLeft: 8, marginBottom: 2 },
  signatureLine: { height: 40, borderBottomWidth: 1, borderBottomColor: '#111827' },
  signatureProgress: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  signatureProgressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  signatureRequiredBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D', marginTop: 8 },
  signatureCompletedBox: { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' },
  signatureRequiredLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  signatureRequiredText: { fontSize: 11, color: '#6B7280', fontStyle: 'italic' },
  miniSignaturePreview: { width: 120, height: 40, resizeMode: 'contain', marginTop: 4 },
  signatureStepContainer: { flex: 1, padding: 20 },
  signatureStepTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  signatureStepSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 4 },
  signatureStepDescription: { fontSize: 13, color: '#374151', textAlign: 'center', marginTop: 12, lineHeight: 20, paddingHorizontal: 20 },
  signatureStepActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, gap: 12 },
  signatureStepIndicator: { alignItems: 'center', paddingVertical: 12, backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  signatureStepText: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  signatureStepDots: { flexDirection: 'row', gap: 8 },
  signatureStepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  signatureStepDotActive: { backgroundColor: staticColors.primary },
  confirmSignatureBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: staticColors.primary, paddingVertical: 14, borderRadius: 10 },
  confirmSignatureText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  agreementSignatureSection: { marginTop: 16 },
  clearSignatureBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 8 },
  clearSignatureText: { fontSize: 13, color: '#6B7280' },


  // Commission Pending Approval
  commissionPendingApproval: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  commissionPendingTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 },
  commissionPendingText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // Commission Summary in Request Payment Card
  commissionSummary: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginVertical: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  commissionSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  commissionSummaryLabel: { fontSize: 14, color: '#6B7280' },
  commissionSummaryValue: { fontSize: 14, fontWeight: '600', color: '#111827' },

  // Document Requirement Row
  docRequirementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  docRequirementText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#374151' },
  docRequirementButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: staticColors.primary, borderRadius: 6 },
  docRequirementButtonText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },

  // Workflow Warning
  workflowWarning: { color: '#F59E0B', fontSize: 12, textAlign: 'center', marginTop: 8 },

  // Skip Button
  skipButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: 'transparent' },
  skipButtonText: { fontSize: 14, fontWeight: '500' },

  // Payment Amount Card (for Collect ACV/Deductible)
  paymentAmountCard: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 10, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' },
  paymentAmountLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  paymentAmountValue: { fontSize: 28, fontWeight: 'bold', color: '#22C55E', marginTop: 4 },
  viewInsuranceLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(201, 162, 77, 0.15)', borderRadius: 16 },
  viewInsuranceLinkText: { fontSize: 12, fontWeight: '600', color: staticColors.primary },

  // Submitted Financials (Awaiting Approval)
  submittedFinancials: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  submittedFinancialsTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 12 },
  submittedFinancialsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  submittedFinancialItem: { width: '47%' },
  submittedFinancialLabel: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  submittedFinancialValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  awaitingApprovalNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: 12, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 8 },
  awaitingApprovalText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },

  // Date Picker Button
  datePickerButton: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8 },
  datePickerButtonText: { flex: 1, fontSize: 15, color: '#111827' },

  // Date Picker Modal
  datePickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  datePickerModalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360 },
  datePickerModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  datePickerModalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  datePickerRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  datePickerColumn: { flex: 1 },
  datePickerLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8, textAlign: 'center' },
  datePickerScroll: { height: 150, backgroundColor: '#F9FAFB', borderRadius: 8 },
  datePickerItem: { paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  datePickerItemActive: { backgroundColor: staticColors.primary, borderRadius: 6 },
  datePickerItemText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  datePickerItemTextActive: { color: '#FFFFFF', fontWeight: '700' },
  datePickerPreview: { alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  datePickerPreviewText: { fontSize: 16, fontWeight: '600', color: staticColors.primary },
  datePickerConfirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: staticColors.primary, paddingVertical: 14, borderRadius: 10, marginTop: 12 },
  datePickerConfirmText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  // Hide Commission Toggle
  hideCommissionToggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
});
