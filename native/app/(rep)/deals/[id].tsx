import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, StyleSheet, TextInput, Modal, Image, FlatList, Dimensions, RefreshControl } from 'react-native';
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
import { WebView } from 'react-native-webview';
import SignatureCanvas from 'react-native-signature-canvas';
import { dealsApi, Deal, uploadFile, getSignedFileUrl, repsApi } from '../../../src/services/api';
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
  { status: 'signed', label: 'Signed', icon: 'create', phase: 'sign' },
  { status: 'adjuster_met', label: 'Adjuster Met', icon: 'people', phase: 'sign' },
  { status: 'awaiting_approval', label: 'Awaiting Appr.', icon: 'time', phase: 'sign' },
  { status: 'approved', label: 'Approved', icon: 'checkmark-circle', phase: 'build' },
  { status: 'acv_collected', label: 'ACV Collected', icon: 'cash', phase: 'build' },
  { status: 'deductible_collected', label: 'Ded. Collected', icon: 'cash', phase: 'build' },
  { status: 'materials_selected', label: 'Materials', icon: 'construct', phase: 'build' },
  { status: 'install_scheduled', label: 'Install Sched.', icon: 'calendar', phase: 'build' },
  { status: 'installed', label: 'Installed', icon: 'home', phase: 'build' },
  { status: 'completion_signed', label: 'Completion Form', icon: 'create', phase: 'finalizing' },
  { status: 'invoice_sent', label: 'Invoice Sent', icon: 'send', phase: 'finalizing' },
  { status: 'depreciation_collected', label: 'Depreciation', icon: 'cash', phase: 'finalizing' },
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
      { field: 'adjuster_name', label: 'Adjuster Name', type: 'text' },
      { field: 'adjuster_phone', label: 'Adjuster Phone', type: 'phone' },
      { field: 'adjuster_meeting_date', label: 'Adjuster Appointment Date', type: 'date' },
    ],
    // Note: agreement must be signed in Docs tab
  },
  {
    status: 'claim_filed',
    label: 'Meet Adjuster',
    description: 'Meet adjuster at appointment to inspect the roof',
    icon: 'people',
    requiredFields: [],
  },
  {
    status: 'signed',
    label: 'Awaiting Insurance Decision',
    description: 'Waiting for insurance approval/denial/partial approval',
    icon: 'time',
    requiredFields: [],
  },
  {
    status: 'adjuster_met',
    label: 'Awaiting Admin Approval',
    description: 'Upload loss statement. Wait for admin to approve financials (RCV, ACV, deductible, depreciation)',
    icon: 'time',
    requiredFields: [],
    adminOnly: true, // Admin must approve financials
  },
  {
    status: 'awaiting_approval',
    label: 'Approved',
    description: 'Insurance approved! Admin reviewed financials.',
    icon: 'checkmark-circle',
    requiredFields: [],
    adminOnly: true,
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
    label: 'Invoice Sent',
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
  claim_filed: { label: 'Claim Filed', color: '#7E57C2', description: 'Claim filed, agreement signed', nextAction: 'Meet Adjuster' },
  signed: { label: 'Signed', color: '#66BB6A', description: 'Agreement signed', nextAction: 'Wait for Approval' },
  adjuster_met: { label: 'Adjuster Met', color: '#EC407A', description: 'Adjuster inspected roof', nextAction: 'Wait for Decision' },
  awaiting_approval: { label: 'Awaiting Approval', color: '#F59E0B', description: 'Waiting for admin to approve financials', nextAction: 'Upload Loss Statement' },
  approved: { label: 'Approved', color: '#26A69A', description: 'Insurance approved!', nextAction: 'Collect ACV' },
  acv_collected: { label: 'ACV Collected', color: '#FFA726', description: 'ACV payment collected', nextAction: 'Collect Deductible' },
  deductible_collected: { label: 'Deductible Collected', color: '#FF7043', description: 'Deductible collected', nextAction: 'Select Materials' },
  materials_selected: { label: 'Materials Selected', color: '#8B5CF6', description: 'Materials and colors picked', nextAction: 'Wait for Install' },
  install_scheduled: { label: 'Install Scheduled', color: '#8D6E63', description: 'Installation date is set', nextAction: 'Wait for Crew' },
  installed: { label: 'Installed', color: '#78909C', description: 'Installation completed', nextAction: 'Get Completion Form' },
  completion_signed: { label: 'Completion Form Signed', color: '#06B6D4', description: 'Homeowner signed completion', nextAction: 'Wait for Invoice' },
  invoice_sent: { label: 'Invoice Sent', color: '#5C6BC0', description: 'Invoice sent to insurance', nextAction: 'Collect Depreciation' },
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

  // Workflow form state for step completion
  const [workflowForm, setWorkflowForm] = useState<Record<string, string | number | null>>({});
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

  // Handle workflow form field change
  const handleWorkflowFieldChange = (field: string, value: string | number | null) => {
    setWorkflowForm(prev => ({ ...prev, [field]: value }));
  };

  // Handle signature save
  const handleSignatureSave = async (signature: string) => {
    if (!deal) return;
    setShowSignaturePad(false);
    setSavingWorkflow(true);

    try {
      // Upload the signature image
      const signatureFileName = `signature-${Date.now()}.png`;
      const signatureUploadResult = await uploadFile(
        signature,
        signatureFileName,
        'image/png',
        'signatures',
        deal.id
      );

      // Generate the full agreement HTML document with embedded signature
      const agreementHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Insurance Agreement - ${deal.homeowner_name}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    .header { background: #0F1E2E; color: white; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; opacity: 0.8; font-size: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .info-item { background: #f9fafb; padding: 12px; border-radius: 6px; }
    .info-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
    .info-value { font-size: 14px; font-weight: 600; color: #111827; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .section-content { font-size: 12px; color: #4b5563; line-height: 1.6; }
    .highlight { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .warranty { background: rgba(201, 162, 77, 0.1); border: 1px solid rgba(201, 162, 77, 0.3); padding: 15px; border-radius: 8px; }
    .warranty-title { color: #C9A24D; font-weight: 700; margin-bottom: 8px; }
    .warning { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 15px; border-radius: 8px; color: #dc2626; font-weight: 600; }
    .signature-section { margin-top: 30px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
    .signature-label { font-size: 12px; color: #6b7280; margin-bottom: 10px; }
    .signature-image { max-width: 300px; max-height: 100px; border: 1px solid #e5e7eb; border-radius: 4px; }
    .signature-date { font-size: 12px; color: #6b7280; margin-top: 10px; }
    .materials { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .materials-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>TITAN PRIME SOLUTIONS</h1>
    <p>INSURED & BONDED</p>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Homeowner Name</div>
      <div class="info-value">${deal.homeowner_name || '-'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Date</div>
      <div class="info-value">${new Date().toLocaleDateString()}</div>
    </div>
    <div class="info-item" style="grid-column: span 2;">
      <div class="info-label">Address</div>
      <div class="info-value">${deal.address || ''}${deal.city ? `, ${deal.city}` : ''}${deal.state ? `, ${deal.state}` : ''} ${deal.zip_code || ''}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Insurance Company</div>
      <div class="info-value">${deal.insurance_company || '-'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Claim Number</div>
      <div class="info-value">${deal.claim_number || '-'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">INSURANCE AGREEMENT</div>
    <div class="section-content">
      <p>This agreement is contingent upon the approval of your claim by your insurance company. Upon claim approval, Titan Prime Solutions will perform the repairs or replacements specified by the "loss statement" provided by your insurance company. Repairs will be performed for insurance funds only, with the homeowner being responsible for paying their insurance deductible.</p>
      <p>Any material upgrade or additional work authorized by the Homeowner will be an additional charge to be paid for by the homeowner. The homeowner agrees to provide Titan Prime Solutions with a copy of the insurance loss statement. In addition, Homeowner will pay Titan Prime Solutions for any supplemental work approved by the insurance company for the amount of the insurance quote.</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">CANCELLATION POLICY</div>
    <div class="section-content">
      <p>If this agreement is canceled by the Homeowner after the three days right of rescission, but after approval for the claim, the homeowner agrees to pay Titan Prime Solutions for 20% of the contract price outlined on the insurance loss statement as the "RCV" or "Replacement Cost Value". This is not as a penalty, but as compensation for claim services provided by the project manager up to the time of cancellation.</p>
    </div>
  </div>

  <div class="highlight">
    <div class="section-title">3 DAY RIGHT OF RESCISSION</div>
    <div class="section-content">
      <p>Homeowners shall have the right to cancel this contract within three (3) days after the signing of the contract. Should the Homeowner decide to cancel the contract, the homeowner must notify Titan Prime Solutions in writing. The notice of cancellation must be signed and dated, and Homeowner must clearly state the intention to cancel.</p>
    </div>
  </div>

  <div class="materials">
    <div class="section-title">MATERIAL SPECIFICATIONS</div>
    <div class="materials-grid">
      <div class="info-item">
        <div class="info-label">Category</div>
        <div class="info-value">${deal.material_category || '-'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Material Color</div>
        <div class="info-value">${deal.material_color || '-'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Drip Edge</div>
        <div class="info-value">${deal.drip_edge || '-'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Vent Color</div>
        <div class="info-value">${deal.vent_color || '-'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Roof Squares</div>
        <div class="info-value">${deal.roof_squares || '-'}</div>
      </div>
    </div>
  </div>

  <div class="warranty">
    <div class="warranty-title">Warranty Information</div>
    <ul style="margin: 0; padding-left: 20px; font-size: 12px;">
      <li>5 Year Labor Warranty provided by Titan Prime Solutions</li>
      <li>30-Year Manufacturer Warranty (No Charge Upgrade) (110 Mph Wind Rated)</li>
      <li>40 Year Manufacturer Warranty (No Charge Upgrade) (150 Mph Wind Rated) on Metal Panels</li>
    </ul>
  </div>

  <div class="warning">
    **ROTTED OSB WILL COST AN ADDITIONAL $3.00 PER SQFT TO REPLACE.
  </div>

  <div class="signature-section">
    <div class="section-title">HOMEOWNER SIGNATURE</div>
    <p class="signature-label">By signing below, I agree to and understand the terms above.</p>
    <img src="${signature}" class="signature-image" alt="Homeowner Signature" />
    <p class="signature-date">Signed on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>
</body>
</html>
      `.trim();

      // Store the agreement document as a data URL (base64 HTML)
      const agreementBase64 = btoa(unescape(encodeURIComponent(agreementHtml)));
      const agreementDataUrl = `data:text/html;base64,${agreementBase64}`;

      // Update deal with signature and agreement document
      const updates: Partial<Deal> = {
        contract_signed: true,
        signed_date: new Date().toISOString().split('T')[0],
        signature_url: signatureUploadResult?.key || signature,
        agreement_document_url: agreementDataUrl, // Store full agreement as base64 HTML
      };

      const result = await dealsApi.update(deal.id, updates);
      if (result.error) throw new Error(result.error);

      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', id] });

      Alert.alert('Success', 'Contract signed successfully!');
      setSignatureData(null);
      setAgreementScrollEnabled(true);
      refetch();
    } catch (error) {
      console.error('Signature save error:', error);
      Alert.alert('Error', 'Failed to save signature: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSavingWorkflow(false);
    }
  };

  // Save and progress workflow
  const handleSaveAndProgress = async () => {
    if (!deal) return;
    setSavingWorkflow(true);

    try {
      const currentStep = getCurrentWorkflowStep();
      if (!currentStep) return;

      const updates: Partial<Deal> = { ...workflowForm };

      // Check if all requirements for current step will be met after this save
      const simulatedDeal = { ...deal, ...updates };
      const allRequirementsMet = currentStep.requiredFields.every(req => {
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
            <Text style={[styles.progressPercent, { color: colors.primary }]}>{progressPercent}%</Text>
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
            // Calculate commission amount
            const rcv = Number(deal.rcv) || 0;
            const salesTax = rcv * 0.0825;
            const baseAmount = rcv - salesTax;
            const commissionPercent = deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent || 10;
            const commissionAmount = deal.deal_commissions?.[0]?.commission_amount || (baseAmount * (commissionPercent / 100));

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
            // Calculate commission for display - use rep's commission percent
            const rcv = Number(deal.rcv) || 0;
            const salesTax = rcv * 0.0825;
            const baseAmount = rcv - salesTax;
            // Priority: deal_commissions, then rep's default_commission_percent
            const commissionPercent = deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent || 10;
            const estimatedCommission = baseAmount * (commissionPercent / 100);

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
                  <View style={styles.commissionSummaryRow}>
                    <Text style={[styles.commissionSummaryLabel, { color: colors.mutedForeground }]}>Deal Value (RCV)</Text>
                    <Text style={[styles.commissionSummaryValue, { color: colors.foreground }]}>${rcv.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={styles.commissionSummaryRow}>
                    <Text style={[styles.commissionSummaryLabel, { color: colors.mutedForeground }]}>Less: Sales Tax (8.25%)</Text>
                    <Text style={[styles.commissionSummaryValue, { color: '#EF4444' }]}>-${salesTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={styles.commissionSummaryRow}>
                    <Text style={[styles.commissionSummaryLabel, { color: colors.mutedForeground }]}>Commission Rate</Text>
                    <Text style={[styles.commissionSummaryValue, { color: colors.foreground }]}>{commissionPercent}%</Text>
                  </View>
                  <View style={[styles.commissionSummaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 8 }]}>
                    <Text style={[styles.commissionSummaryLabel, { fontWeight: '700', color: colors.foreground }]}>Estimated Commission</Text>
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
            // Special handling for adjuster_met (Awaiting Approval) - show submitted financials
            if (deal.status === 'adjuster_met') {
              return (
                <View style={styles.workflowCard}>
                  <View style={styles.workflowCardHeader}>
                    <Ionicons name="time" size={24} color="#F59E0B" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workflowCardTitle}>Awaiting Admin Approval</Text>
                      <Text style={styles.workflowCardDescription}>Financial details submitted for review</Text>
                    </View>
                  </View>

                  {/* Submitted Financial Details */}
                  <View style={styles.submittedFinancials}>
                    <Text style={styles.submittedFinancialsTitle}>Submitted Values</Text>
                    <View style={styles.submittedFinancialsGrid}>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={styles.submittedFinancialLabel}>RCV</Text>
                        <Text style={styles.submittedFinancialValue}>${(Number(deal.rcv) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={styles.submittedFinancialLabel}>ACV</Text>
                        <Text style={styles.submittedFinancialValue}>${(Number(deal.acv) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={styles.submittedFinancialLabel}>Deductible</Text>
                        <Text style={styles.submittedFinancialValue}>${(Number(deal.deductible) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      </View>
                      <View style={styles.submittedFinancialItem}>
                        <Text style={styles.submittedFinancialLabel}>Depreciation</Text>
                        <Text style={styles.submittedFinancialValue}>${(Number(deal.depreciation) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.awaitingApprovalNote}>
                    <Ionicons name="information-circle" size={18} color="#6B7280" />
                    <Text style={styles.awaitingApprovalText}>
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
            const allFinancialsComplete = hasRcv && hasAcv && hasDeductible && hasDepreciation;
            const allFieldsComplete = allFinancialsComplete && hasAdjusterName && hasAdjusterDate && hasLostStatement;

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
                </View>

                {/* Save Button - disabled if requirements not met */}
                <TouchableOpacity
                  style={[styles.workflowSaveButton, (!allFieldsComplete || savingWorkflow) && { opacity: 0.5 }]}
                  onPress={handleSaveAndProgress}
                  disabled={!allFieldsComplete || savingWorkflow}
                >
                  {savingWorkflow ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.workflowSaveButtonText}>Save & Submit for Approval</Text>
                    </>
                  )}
                </TouchableOpacity>

                {!allFieldsComplete && (
                  <Text style={styles.workflowWarning}>
                    {!hasLostStatement ? '⚠ Lost statement must be uploaded' :
                     !allFinancialsComplete ? '⚠ All financial fields are required' :
                     '⚠ Adjuster information is required'}
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

                {!hasDeductibleReceipt && (
                  <Text style={styles.workflowWarning}>
                    ⚠ Deductible receipt must be uploaded before proceeding
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
              <View style={styles.workflowCard}>
                <View style={styles.workflowCardHeader}>
                  <Ionicons name="clipboard" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workflowCardTitle}>{currentStep.label}</Text>
                    <Text style={styles.workflowCardDescription}>{currentStep.description}</Text>
                  </View>
                </View>

                {/* Required Fields */}
                <View style={styles.workflowFields}>
                  {currentStep.requiredFields.map((req) => {
                    const currentValue = workflowForm[req.field] ?? deal[req.field] ?? '';
                    const isFieldComplete = currentValue !== '' && currentValue !== null && currentValue !== undefined;


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

                    return (
                      <View key={req.field} style={styles.workflowFieldContainer}>
                        <View style={styles.workflowFieldLabel}>
                          <Text style={styles.workflowFieldLabelText}>{req.label}</Text>
                          {isFieldComplete && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                        </View>
                        <TextInput
                          style={styles.workflowInput}
                          value={String(workflowForm[req.field] ?? deal[req.field] ?? '')}
                          onChangeText={(text) => {
                            const value = req.type === 'number' ? (parseFloat(text) || null) : text;
                            handleWorkflowFieldChange(req.field, value);
                          }}
                          placeholder={`Enter ${req.label.toLowerCase()}`}
                          placeholderTextColor="#9CA3AF"
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
                      <Text style={styles.workflowFieldLabelText}>Agreement Signature</Text>
                      {(deal.contract_signed || deal.insurance_agreement_url) && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                    </View>
                    {deal.contract_signed ? (
                      <View style={styles.signatureComplete}>
                        <Text style={styles.signatureCompleteText}>✓ Contract signed on {deal.signed_date ? format(new Date(deal.signed_date), 'MMM d, yyyy') : 'N/A'}</Text>
                      </View>
                    ) : deal.insurance_agreement_url ? (
                      <View style={styles.signatureComplete}>
                        <Text style={styles.signatureCompleteText}>✓ Agreement document uploaded</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={() => setActiveTab('docs')}
                      >
                        <Ionicons name="document-text" size={20} color={colors.primary} />
                        <Text style={styles.signatureButtonText}>Go to Docs Tab to Sign or Upload Agreement</Text>
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
                <TouchableOpacity onPress={() => setIsEditingOverview(!isEditingOverview)}>
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
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.roof_type || '-'}</Text>
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
                      {['Single', 'Metal', 'Architectural', 'Architectural Metal'].map((cat) => (
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
                  <TouchableOpacity onPress={() => setIsEditingInsurance(!isEditingInsurance)}>
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

                  {/* Commission Amount */}
                  <View style={styles.commissionTotal}>
                    <Text style={styles.commissionTotalLabel}>Your Commission</Text>
                    <Text style={styles.commissionTotalValue}>
                      ${(Number(deal.deal_commissions?.[0]?.commission_amount) || ((Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))) * 0.9175 * ((deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent) / 100))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                  {/* View Signature if available */}
                  {deal.signature_url && (
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

      {/* Agreement & Signature Modal */}
      <Modal visible={showSignaturePad} animationType="slide">
        <SafeAreaView style={styles.signatureModalContainer}>
          <View style={[styles.signatureModalHeader, { paddingTop: 16 }]}>
            <TouchableOpacity onPress={() => setShowSignaturePad(false)} style={styles.signatureCloseBtn}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.signatureModalTitle}>Insurance Agreement</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            style={styles.agreementScrollView}
            showsVerticalScrollIndicator={false}
            scrollEnabled={agreementScrollEnabled}
          >
            {/* Company Header */}
            <View style={styles.agreementHeader}>
              <Text style={styles.agreementCompanyName}>TITAN PRIME SOLUTIONS</Text>
              <Text style={styles.agreementTagline}>INSURED & BONDED</Text>
            </View>

            {/* Deal Info */}
            <View style={styles.agreementInfoGrid}>
              <View style={styles.agreementInfoItem}>
                <Text style={styles.agreementInfoLabel}>Homeowner Name</Text>
                <Text style={styles.agreementInfoValue}>{deal.homeowner_name}</Text>
              </View>
              <View style={styles.agreementInfoItem}>
                <Text style={styles.agreementInfoLabel}>Date</Text>
                <Text style={styles.agreementInfoValue}>{format(new Date(), 'MMM d, yyyy')}</Text>
              </View>
              <View style={[styles.agreementInfoItem, { flex: 2 }]}>
                <Text style={styles.agreementInfoLabel}>Address</Text>
                <Text style={styles.agreementInfoValue}>
                  {deal.address}{deal.city ? `, ${deal.city}` : ''}{deal.state ? `, ${deal.state}` : ''} {deal.zip_code || ''}
                </Text>
              </View>
              <View style={styles.agreementInfoItem}>
                <Text style={styles.agreementInfoLabel}>Insurance Company</Text>
                <Text style={styles.agreementInfoValue}>{deal.insurance_company || '-'}</Text>
              </View>
              <View style={styles.agreementInfoItem}>
                <Text style={styles.agreementInfoLabel}>Claim Number</Text>
                <Text style={styles.agreementInfoValue}>{deal.claim_number || '-'}</Text>
              </View>
            </View>

            <View style={styles.agreementDivider} />

            {/* Agreement Terms */}
            <View style={styles.agreementSection}>
              <Text style={styles.agreementSectionTitle}>INSURANCE AGREEMENT</Text>
              <Text style={styles.agreementText}>
                This agreement is contingent upon the approval of your claim by your insurance company.
                Upon claim approval, Titan Prime Solutions will perform the repairs or replacements
                specified by the "loss statement" provided by your insurance company. Repairs will be
                performed for insurance funds only, with the homeowner being responsible for paying their
                insurance deductible.
              </Text>
              <Text style={styles.agreementText}>
                Any material upgrade or additional work authorized by the Homeowner will be an additional
                charge to be paid for by the homeowner. The homeowner agrees to provide Titan Prime Solutions
                with a copy of the insurance loss statement. In addition, Homeowner will pay Titan Prime Solutions
                for any supplemental work approved by the insurance company for the amount of the insurance quote.
              </Text>
            </View>

            {/* Cancellation Policy */}
            <View style={styles.agreementSection}>
              <Text style={styles.agreementSectionTitle}>CANCELLATION POLICY</Text>
              <Text style={styles.agreementText}>
                If this agreement is canceled by the Homeowner after the three days right of rescission,
                but after approval for the claim, the homeowner agrees to pay Titan Prime Solutions for
                20% of the contract price outlined on the insurance loss statement as the "RCV" or
                "Replacement Cost Value". This is not as a penalty, but as compensation for claim services
                provided by the project manager up to the time of cancellation.
              </Text>
            </View>

            {/* Right of Rescission */}
            <View style={[styles.agreementSection, styles.agreementHighlight]}>
              <Text style={styles.agreementSectionTitle}>3 DAY RIGHT OF RESCISSION</Text>
              <Text style={styles.agreementText}>
                Homeowners shall have the right to cancel this contract within three (3) days after the
                signing of the contract. Should the Homeowner decide to cancel the contract, the homeowner
                must notify Titan Prime Solutions in writing. The notice of cancellation must be signed
                and dated, and Homeowner must clearly state the intention to cancel.
              </Text>
            </View>

            <View style={styles.agreementDivider} />

            {/* Material Specifications */}
            <View style={styles.agreementSection}>
              <Text style={styles.agreementSectionTitle}>Material Specifications</Text>
              <View style={styles.agreementInfoGrid}>
                <View style={styles.agreementInfoItem}>
                  <Text style={styles.agreementInfoLabel}>Category</Text>
                  <Text style={styles.agreementInfoValue}>{deal.material_category || '-'}</Text>
                </View>
                {(deal.material_category === 'Metal' || deal.material_category === 'Architectural Metal') && (
                  <View style={styles.agreementInfoItem}>
                    <Text style={styles.agreementInfoLabel}>Metal Type</Text>
                    <Text style={styles.agreementInfoValue}>{deal.material_type || '-'}</Text>
                  </View>
                )}
                <View style={styles.agreementInfoItem}>
                  <Text style={styles.agreementInfoLabel}>Material Color</Text>
                  <Text style={styles.agreementInfoValue}>{deal.material_color || '-'}</Text>
                </View>
                <View style={styles.agreementInfoItem}>
                  <Text style={styles.agreementInfoLabel}>Drip Edge</Text>
                  <Text style={styles.agreementInfoValue}>{deal.drip_edge || '-'}</Text>
                </View>
                <View style={styles.agreementInfoItem}>
                  <Text style={styles.agreementInfoLabel}>Vent Color</Text>
                  <Text style={styles.agreementInfoValue}>{deal.vent_color || '-'}</Text>
                </View>
                <View style={styles.agreementInfoItem}>
                  <Text style={styles.agreementInfoLabel}>Roof Squares</Text>
                  <Text style={styles.agreementInfoValue}>{deal.roof_squares || '-'}</Text>
                </View>
              </View>
            </View>

            {/* Warranty */}
            <View style={[styles.agreementSection, styles.warrantySection]}>
              <Text style={[styles.agreementSectionTitle, { color: colors.primary }]}>Warranty Information</Text>
              <Text style={styles.warrantyItem}>• 5 Year Labor Warranty provided by Titan Prime Solutions</Text>
              <Text style={styles.warrantyItem}>• 30-Year Manufacturer Warranty (No Charge Upgrade) (110 Mph Wind Rated)</Text>
              <Text style={styles.warrantyItem}>• 40 Year Manufacturer Warranty (No Charge Upgrade) (150 Mph Wind Rated) on Metal Panels</Text>
            </View>

            {/* OSB Notice */}
            <View style={[styles.agreementSection, styles.warningSection]}>
              <Text style={styles.warningText}>
                **ROTTED OSB WILL COST AN ADDITIONAL $3.00 PER SQFT TO REPLACE.
              </Text>
            </View>

            <View style={styles.agreementDivider} />

            {/* Signature Section */}
            <View style={styles.agreementSignatureSection}>
              <Text style={styles.agreementSectionTitle}>Homeowner Signature</Text>
              <Text style={styles.agreementText}>
                By signing below, I agree to and understand the terms above.
              </Text>

              <View style={styles.signatureCanvasContainer}>
                <SignatureCanvas
                  ref={signatureRef}
                  onOK={handleSignatureSave}
                  onEmpty={() => Alert.alert('Error', 'Please sign before saving')}
                  onBegin={() => setAgreementScrollEnabled(false)}
                  onEnd={() => setAgreementScrollEnabled(true)}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Save Signature"
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

              <TouchableOpacity
                onPress={() => signatureRef.current?.clearSignature()}
                style={styles.clearSignatureBtn}
              >
                <Ionicons name="refresh" size={16} color="#6B7280" />
                <Text style={styles.clearSignatureText}>Clear Signature</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.signatureActions}>
            <TouchableOpacity
              style={styles.signatureCancelButton}
              onPress={() => setShowSignaturePad(false)}
            >
              <Text style={styles.signatureCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signatureSaveButton}
              onPress={() => signatureRef.current?.readSignature()}
            >
              <Ionicons name="checkmark" size={20} color="#FFF" />
              <Text style={styles.signatureSaveText}>Sign Agreement</Text>
            </TouchableOpacity>
          </View>
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

      {/* Completion Form Signature Modal */}
      <Modal visible={showCompletionFormSignature} animationType="slide">
        <SafeAreaView style={styles.signatureModalContainer}>
          <View style={[styles.signatureModalHeader, { paddingTop: 16 }]}>
            <TouchableOpacity onPress={() => setShowCompletionFormSignature(false)} style={styles.signatureCloseBtn}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.signatureModalTitle}>Final Inspection Statement</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            style={styles.agreementScrollView}
            showsVerticalScrollIndicator={false}
            scrollEnabled={agreementScrollEnabled}
          >
            {/* Company Header */}
            <View style={styles.agreementHeader}>
              <Text style={styles.agreementCompanyName}>TITAN PRIME SOLUTIONS</Text>
              <Text style={styles.agreementTagline}>FINAL INSPECTION STATEMENT</Text>
            </View>

            {/* Property Info */}
            <View style={styles.agreementInfoGrid}>
              <View style={styles.agreementInfoItem}>
                <Text style={styles.agreementInfoLabel}>Homeowner Name</Text>
                <Text style={styles.agreementInfoValue}>{deal.homeowner_name}</Text>
              </View>
              <View style={styles.agreementInfoItem}>
                <Text style={styles.agreementInfoLabel}>Date</Text>
                <Text style={styles.agreementInfoValue}>{format(new Date(), 'MMM d, yyyy')}</Text>
              </View>
              <View style={[styles.agreementInfoItem, { flex: 2 }]}>
                <Text style={styles.agreementInfoLabel}>Property Address</Text>
                <Text style={styles.agreementInfoValue}>
                  {deal.address}{deal.city ? `, ${deal.city}` : ''}{deal.state ? `, ${deal.state}` : ''} {deal.zip_code || ''}
                </Text>
              </View>
            </View>

            {/* Work Completed Section */}
            <View style={styles.agreementSection}>
              <Text style={styles.agreementSectionTitle}>Work Completed</Text>
              <View style={styles.agreementInfoGrid}>
                <View style={styles.agreementInfoItem}>
                  <Text style={styles.agreementInfoLabel}>Material Category</Text>
                  <Text style={styles.agreementInfoValue}>{deal.material_category || '-'}</Text>
                </View>
                <View style={styles.agreementInfoItem}>
                  <Text style={styles.agreementInfoLabel}>Material Color</Text>
                  <Text style={styles.agreementInfoValue}>{deal.material_color || '-'}</Text>
                </View>
                <View style={styles.agreementInfoItem}>
                  <Text style={styles.agreementInfoLabel}>Drip Edge</Text>
                  <Text style={styles.agreementInfoValue}>{deal.drip_edge || '-'}</Text>
                </View>
                <View style={styles.agreementInfoItem}>
                  <Text style={styles.agreementInfoLabel}>Vent Color</Text>
                  <Text style={styles.agreementInfoValue}>{deal.vent_color || '-'}</Text>
                </View>
              </View>
            </View>

            {/* Inspection Checklist */}
            <View style={styles.agreementSection}>
              <Text style={styles.agreementSectionTitle}>Final Inspection Checklist</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                <Text style={styles.agreementText}>✓ All roofing materials have been installed according to manufacturer specifications</Text>
                <Text style={styles.agreementText}>✓ All debris and materials have been removed from the property</Text>
                <Text style={styles.agreementText}>✓ Gutters and downspouts have been cleared and are functional</Text>
                <Text style={styles.agreementText}>✓ All flashing and vents have been properly installed</Text>
                <Text style={styles.agreementText}>✓ Final walkthrough has been completed with homeowner</Text>
              </View>
            </View>

            {/* Statement */}
            <View style={styles.agreementSection}>
              <Text style={styles.agreementSectionTitle}>Homeowner Acknowledgment</Text>
              <Text style={styles.agreementText}>
                I, the homeowner, have inspected the completed roofing work at the above address and confirm that:
              </Text>
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={styles.agreementText}>
                  1. The work has been completed to my satisfaction.
                </Text>
                <Text style={styles.agreementText}>
                  2. The work area has been cleaned and all debris has been removed.
                </Text>
                <Text style={styles.agreementText}>
                  3. I have received information regarding the warranty for materials and workmanship.
                </Text>
                <Text style={styles.agreementText}>
                  4. I authorize Titan Prime Solutions to collect any remaining balance due, including depreciation payments from the insurance company.
                </Text>
              </View>
            </View>

            {/* Warranty Info */}
            <View style={styles.agreementSection}>
              <Text style={styles.agreementSectionTitle}>Warranty Information</Text>
              <Text style={styles.agreementText}>
                Titan Prime Solutions provides a workmanship warranty for all labor and installation.
                Material warranties are provided by the manufacturer. Please keep this document for your records.
              </Text>
            </View>

            {/* Rep Signature Pad */}
            <View style={styles.agreementSignatureSection}>
              <Text style={styles.agreementSectionTitle}>Representative Signature</Text>
              <Text style={styles.agreementText}>
                By signing below, I (the representative) confirm this work has been completed.
              </Text>

              {deal.completion_form_signature_url ? (
                <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#F0FDF4', borderRadius: 8, marginTop: 8 }}>
                  <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  <Text style={{ color: '#22C55E', fontWeight: '600', marginTop: 4 }}>Rep Signature Saved</Text>
                  {signedRepCompletionSigUrl && (
                    <Image
                      source={{ uri: signedRepCompletionSigUrl }}
                      style={{ width: '100%', height: 80, resizeMode: 'contain', marginTop: 8 }}
                    />
                  )}
                </View>
              ) : (
                <>
                  <View style={styles.signatureCanvasContainer}>
                    <SignatureCanvas
                      ref={completionSignatureRef}
                      onOK={(signature: string) => setRepCompletionSignature(signature)}
                      onEmpty={() => {}}
                      onBegin={() => setAgreementScrollEnabled(false)}
                      onEnd={() => {
                        setAgreementScrollEnabled(true);
                        // Auto-capture signature when user lifts finger
                        setTimeout(() => {
                          completionSignatureRef.current?.readSignature();
                        }, 100);
                      }}
                      descriptionText=""
                      clearText="Clear"
                      confirmText="Save"
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        completionSignatureRef.current?.clearSignature();
                        setRepCompletionSignature(null);
                      }}
                      style={styles.clearSignatureBtn}
                    >
                      <Ionicons name="refresh" size={16} color="#6B7280" />
                      <Text style={styles.clearSignatureText}>Clear</Text>
                    </TouchableOpacity>
                    {repCompletionSignature && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                        <Text style={{ color: '#22C55E', marginLeft: 4, fontSize: 12 }}>Captured</Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>

            {/* Homeowner Signature Pad */}
            <View style={styles.agreementSignatureSection}>
              <Text style={styles.agreementSectionTitle}>Homeowner Signature</Text>
              <Text style={styles.agreementText}>
                By signing below, I (the homeowner) confirm the work is complete and satisfactory.
              </Text>

              {deal.homeowner_completion_signature_url ? (
                <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#F0FDF4', borderRadius: 8, marginTop: 8 }}>
                  <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  <Text style={{ color: '#22C55E', fontWeight: '600', marginTop: 4 }}>Homeowner Signature Saved</Text>
                  {signedHomeownerCompletionSigUrl && (
                    <Image
                      source={{ uri: signedHomeownerCompletionSigUrl }}
                      style={{ width: '100%', height: 80, resizeMode: 'contain', marginTop: 8 }}
                    />
                  )}
                </View>
              ) : (
                <>
                  <View style={styles.signatureCanvasContainer}>
                    <SignatureCanvas
                      ref={homeownerCompletionSignatureRef}
                      onOK={(signature: string) => setHomeownerCompletionSignature(signature)}
                      onEmpty={() => {}}
                      onBegin={() => setAgreementScrollEnabled(false)}
                      onEnd={() => {
                        setAgreementScrollEnabled(true);
                        // Auto-capture signature when user lifts finger
                        setTimeout(() => {
                          homeownerCompletionSignatureRef.current?.readSignature();
                        }, 100);
                      }}
                      descriptionText=""
                      clearText="Clear"
                      confirmText="Save"
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        homeownerCompletionSignatureRef.current?.clearSignature();
                        setHomeownerCompletionSignature(null);
                      }}
                      style={styles.clearSignatureBtn}
                    >
                      <Ionicons name="refresh" size={16} color="#6B7280" />
                      <Text style={styles.clearSignatureText}>Clear</Text>
                    </TouchableOpacity>
                    {homeownerCompletionSignature && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                        <Text style={{ color: '#22C55E', marginLeft: 4, fontSize: 12 }}>Captured</Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.signatureActions}>
            <TouchableOpacity
              style={styles.signatureCancelButton}
              onPress={() => {
                setShowCompletionFormSignature(false);
                setRepCompletionSignature(null);
                setHomeownerCompletionSignature(null);
              }}
            >
              <Text style={styles.signatureCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.signatureSaveButton,
                savingCompletionForm && { opacity: 0.7 }
              ]}
              disabled={savingCompletionForm}
              onPress={async () => {
                // Check if we have both signatures (either new or existing)
                const hasRepSig = deal.completion_form_signature_url || repCompletionSignature;
                const hasHomeownerSig = deal.homeowner_completion_signature_url || homeownerCompletionSignature;

                if (!hasRepSig || !hasHomeownerSig) {
                  Alert.alert('Signatures Required', 'Both representative and homeowner signatures are required. Please sign in both signature areas.');
                  return;
                }

                setSavingCompletionForm(true);

                try {
                  const updates: Partial<Deal> = {};

                  console.log('[Completion Form] Starting save process...');
                  console.log('[Completion Form] Rep signature exists:', !!repCompletionSignature);
                  console.log('[Completion Form] Homeowner signature exists:', !!homeownerCompletionSignature);
                  console.log('[Completion Form] Existing rep sig URL:', deal.completion_form_signature_url);
                  console.log('[Completion Form] Existing homeowner sig URL:', deal.homeowner_completion_signature_url);

                  // Upload rep signature if new
                  if (repCompletionSignature && !deal.completion_form_signature_url) {
                    console.log('[Completion Form] Uploading rep signature...');
                    const repSignatureFileName = `rep_completion_signature-${Date.now()}.png`;
                    const result = await uploadFile(
                      repCompletionSignature,
                      repSignatureFileName,
                      'image/png',
                      'completion_form',
                      deal.id
                    );
                    console.log('[Completion Form] Rep signature upload result:', result);
                    if (!result || !result.url) {
                      // If upload failed to return URL, store the key instead so we can fetch signed URL later
                      if (result?.key) {
                        console.log('[Completion Form] No URL returned, storing key:', result.key);
                        updates.completion_form_signature_url = result.key;
                      } else {
                        throw new Error('Failed to upload rep signature');
                      }
                    } else {
                      updates.completion_form_signature_url = result.url;
                    }
                  }

                  // Upload homeowner signature if new
                  if (homeownerCompletionSignature && !deal.homeowner_completion_signature_url) {
                    console.log('[Completion Form] Uploading homeowner signature...');
                    const homeownerSignatureFileName = `homeowner_completion_signature-${Date.now()}.png`;
                    const result = await uploadFile(
                      homeownerCompletionSignature,
                      homeownerSignatureFileName,
                      'image/png',
                      'completion_form',
                      deal.id
                    );
                    console.log('[Completion Form] Homeowner signature upload result:', result);
                    if (!result || !result.url) {
                      // If upload failed to return URL, store the key instead so we can fetch signed URL later
                      if (result?.key) {
                        console.log('[Completion Form] No URL returned, storing key:', result.key);
                        updates.homeowner_completion_signature_url = result.key;
                      } else {
                        throw new Error('Failed to upload homeowner signature');
                      }
                    } else {
                      updates.homeowner_completion_signature_url = result.url;
                    }
                  }

                  // Generate the full completion form HTML document with embedded signatures
                  // Use base64 signatures for embedding in HTML (won't expire like signed URLs)
                  const repSigUrl = repCompletionSignature || updates.completion_form_signature_url || deal.completion_form_signature_url;
                  const homeownerSigUrl = homeownerCompletionSignature || updates.homeowner_completion_signature_url || deal.homeowner_completion_signature_url;

                  const completionFormHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Final Inspection Statement - ${deal.homeowner_name}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    .header { background: #0F1E2E; color: white; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; opacity: 0.8; font-size: 14px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .info-item { background: #f9fafb; padding: 12px; border-radius: 6px; }
    .info-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
    .info-value { font-size: 14px; font-weight: 600; color: #111827; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .section-content { font-size: 12px; color: #4b5563; line-height: 1.6; }
    .checklist { background: #f9fafb; padding: 15px; border-radius: 8px; }
    .checklist-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; }
    .check { color: #22c55e; font-weight: bold; }
    .materials { background: rgba(201, 162, 77, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0; }
    .materials-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .warranty { background: #f0fdf4; border: 1px solid #22c55e; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .signature-section { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
    .signature-row { display: flex; gap: 40px; justify-content: space-between; }
    .signature-box { flex: 1; }
    .signature-label { font-size: 12px; color: #6b7280; margin-bottom: 10px; font-weight: 600; }
    .signature-image { max-width: 250px; max-height: 80px; border: 1px solid #e5e7eb; border-radius: 4px; background: white; }
    .signature-date { font-size: 11px; color: #6b7280; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>TITAN PRIME SOLUTIONS</h1>
    <p>FINAL INSPECTION STATEMENT</p>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Homeowner Name</div>
      <div class="info-value">${deal.homeowner_name || '-'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Date</div>
      <div class="info-value">${format(new Date(), 'MMMM d, yyyy')}</div>
    </div>
    <div class="info-item" style="grid-column: span 2;">
      <div class="info-label">Property Address</div>
      <div class="info-value">${deal.address || ''}${deal.city ? `, ${deal.city}` : ''}${deal.state ? `, ${deal.state}` : ''} ${deal.zip_code || ''}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Work Completed</div>
    <div class="materials">
      <div class="materials-grid">
        <div class="info-item">
          <div class="info-label">Material Category</div>
          <div class="info-value">${deal.material_category || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Material Color</div>
          <div class="info-value">${deal.material_color || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Drip Edge</div>
          <div class="info-value">${deal.drip_edge || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Vent Color</div>
          <div class="info-value">${deal.vent_color || '-'}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Final Inspection Checklist</div>
    <div class="checklist">
      <div class="checklist-item"><span class="check">✓</span> All roofing materials have been installed according to manufacturer specifications</div>
      <div class="checklist-item"><span class="check">✓</span> All debris and materials have been removed from the property</div>
      <div class="checklist-item"><span class="check">✓</span> Gutters and downspouts have been cleared and are functional</div>
      <div class="checklist-item"><span class="check">✓</span> All flashing and vents have been properly installed</div>
      <div class="checklist-item"><span class="check">✓</span> Final walkthrough has been completed with homeowner</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Homeowner Acknowledgment</div>
    <div class="section-content">
      <p>I, the homeowner, have inspected the completed roofing work at the above address and confirm that:</p>
      <ol style="margin-top: 10px; padding-left: 20px;">
        <li style="margin-bottom: 8px;">The work has been completed to my satisfaction.</li>
        <li style="margin-bottom: 8px;">The work area has been cleaned and all debris has been removed.</li>
        <li style="margin-bottom: 8px;">I have received information regarding the warranty for materials and workmanship.</li>
        <li style="margin-bottom: 8px;">I authorize Titan Prime Solutions to collect any remaining balance due, including depreciation payments from the insurance company.</li>
      </ol>
    </div>
  </div>

  <div class="warranty">
    <div class="section-title" style="color: #22c55e; border: none;">Warranty Information</div>
    <p style="font-size: 13px; margin: 0;">Titan Prime Solutions provides a workmanship warranty for all labor and installation. Material warranties are provided by the manufacturer. Please keep this document for your records.</p>
  </div>

  <div class="signature-section">
    <div class="section-title">Signatures</div>
    <div class="signature-row">
      <div class="signature-box">
        <div class="signature-label">Representative Signature</div>
        <img src="${repSigUrl}" class="signature-image" alt="Rep Signature" />
        <div class="signature-date">Signed on: ${format(new Date(), 'MMMM d, yyyy')} at ${format(new Date(), 'h:mm a')}</div>
      </div>
      <div class="signature-box">
        <div class="signature-label">Homeowner Signature</div>
        <img src="${homeownerSigUrl}" class="signature-image" alt="Homeowner Signature" />
        <div class="signature-date">Signed on: ${format(new Date(), 'MMMM d, yyyy')} at ${format(new Date(), 'h:mm a')}</div>
      </div>
    </div>
  </div>
</body>
</html>
                  `.trim();

                  // Store the completion form document as a data URL (base64 HTML)
                  const completionFormBase64 = btoa(unescape(encodeURIComponent(completionFormHtml)));
                  const completionFormDataUrl = `data:text/html;base64,${completionFormBase64}`;
                  updates.completion_form_url = completionFormDataUrl;

                  // Update status since both signatures are complete
                  updates.status = 'completion_signed';
                  updates.completion_signed_date = new Date().toISOString();

                  console.log('[Completion Form] Saving updates:', {
                    completion_form_signature_url: updates.completion_form_signature_url ? 'SET' : 'NOT SET',
                    homeowner_completion_signature_url: updates.homeowner_completion_signature_url ? 'SET' : 'NOT SET',
                    completion_form_url: updates.completion_form_url ? 'SET (length: ' + updates.completion_form_url.length + ')' : 'NOT SET',
                    status: updates.status,
                    completion_signed_date: updates.completion_signed_date,
                  });

                  // Use mutateAsync to wait for the mutation to complete
                  await updateMutation.mutateAsync(updates);

                  // Refetch the deal to get the updated data
                  await refetch();

                  setShowCompletionFormSignature(false);
                  setRepCompletionSignature(null);
                  setHomeownerCompletionSignature(null);
                  // Don't show alert here - the mutation onSuccess already shows one
                } catch (error) {
                  console.error('[Completion Form] Error saving:', error);
                  Alert.alert('Error', `Failed to save signatures: ${error instanceof Error ? error.message : 'Unknown error'}`);
                } finally {
                  setSavingCompletionForm(false);
                }
              }}
            >
              {savingCompletionForm ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="checkmark" size={20} color="#FFF" />
              )}
              <Text style={styles.signatureSaveText}>Save Form</Text>
            </TouchableOpacity>
          </View>
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
});
