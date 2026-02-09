import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, TextInput, Modal, Linking, Image, Dimensions, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';
import DateTimePicker from '@react-native-community/datetimepicker';
import { dealsApi, Deal, pinsApi, repsApi, getSignedFileUrl, uploadFile } from '../../../src/services/api';
import { colors as staticColors } from '../../../src/constants/config';
import { useTheme } from '../../../src/contexts/ThemeContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type TabType = 'overview' | 'financials' | 'documents' | 'commissions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Milestone configuration - Owner's workflow
const milestones: { status: string; label: string; icon: IoniconsName; phase: string }[] = [
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
  { status: 'invoice_sent', label: 'RCV Sent', icon: 'send', phase: 'finalizing' },
  { status: 'depreciation_collected', label: 'Depreciation', icon: 'cash', phase: 'finalizing' },
  { status: 'complete', label: 'Complete', icon: 'trophy', phase: 'complete' },
  { status: 'paid', label: 'Paid', icon: 'checkmark-done', phase: 'complete' },
];

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

const statusConfig: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: '#64748B' },
  inspection_scheduled: { label: 'Inspected', color: '#3B82F6' },
  claim_filed: { label: 'Claim Filed', color: '#8B5CF6' },
  signed: { label: 'Signed', color: '#22C55E' },
  adjuster_met: { label: 'Adjuster Met', color: '#EC4899' },
  awaiting_approval: { label: 'Awaiting Approval', color: '#F59E0B' },
  approved: { label: 'Approved', color: '#14B8A6' },
  acv_collected: { label: 'ACV Collected', color: '#F97316' },
  deductible_collected: { label: 'Ded. Collected', color: '#F59E0B' },
  materials_selected: { label: 'Materials Selected', color: '#8B5CF6' },
  install_scheduled: { label: 'Install Scheduled', color: '#06B6D4' },
  installed: { label: 'Installed', color: '#14B8A6' },
  completion_signed: { label: 'Completion Signed', color: '#06B6D4' },
  invoice_sent: { label: 'RCV Sent', color: '#6366F1' },
  depreciation_collected: { label: 'Depreciation Collected', color: '#8B5CF6' },
  complete: { label: 'Complete', color: '#10B981' },
  paid: { label: 'Paid', color: '#059669' },
};

function getMilestoneIndex(status: string): number {
  const index = milestones.findIndex(m => m.status === status);
  return index >= 0 ? index : 0;
}

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

export default function AdminDealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const milestoneScrollRef = useRef<ScrollView>(null);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [installDate, setInstallDate] = useState<Date>(new Date());
  const [installTime, setInstallTime] = useState<Date>(new Date());
  const [crewAssignment, setCrewAssignment] = useState('');
  const [showInstallDateModal, setShowInstallDateModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);

  // Editable financial fields
  const [financialForm, setFinancialForm] = useState({
    rcv: '',
    acv: '',
    deductible: '',
    depreciation: '',
  });

  // Image and document viewing
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewingImages, setViewingImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadingImages, setLoadingImages] = useState(false);

  // Invoice generation
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [uploadingPermit, setUploadingPermit] = useState(false);

  // HTML viewer for agreement documents
  const [showHtmlViewer, setShowHtmlViewer] = useState(false);
  const [htmlViewerContent, setHtmlViewerContent] = useState('');
  const [htmlViewerTitle, setHtmlViewerTitle] = useState('');

  // Commission editing
  const [showCommissionEditModal, setShowCommissionEditModal] = useState(false);
  const [editedCommissionAmount, setEditedCommissionAmount] = useState('');
  const [commissionEditReason, setCommissionEditReason] = useState('');

  // Lost statement viewing
  const [loadingLostStatement, setLoadingLostStatement] = useState(false);

  // Crew selection dropdown
  const [showCrewDropdown, setShowCrewDropdown] = useState(false);

  const { data: deal, isLoading, error, refetch } = useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      const response = await dealsApi.get(id);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
  });

  // Fetch reps to get correct commission level
  const { data: reps } = useQuery({
    queryKey: ['reps'],
    queryFn: async () => {
      const response = await repsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  // Fetch crew leads for the crew assignment dropdown
  const { data: crewLeads } = useQuery({
    queryKey: ['reps', 'crew'],
    queryFn: async () => {
      console.log('[DealDetail] Fetching crew leads...');
      const response = await repsApi.list('crew');
      console.log('[DealDetail] Crew leads response:', JSON.stringify(response));
      if (response.error) throw new Error(response.error);
      console.log('[DealDetail] Crew leads count:', response.data?.length || 0);
      return response.data || [];
    },
  });

  // Commission level percentages - matches web app
  const commissionLevelPercentages: Record<string, number> = {
    'junior': 5,
    'senior': 10,
    'manager': 13,
  };

  useEffect(() => {
    if (deal) {
      // Parse install date
      if (deal.install_date) {
        const parsedDate = new Date(deal.install_date);
        if (!isNaN(parsedDate.getTime())) {
          setInstallDate(parsedDate);
        }
      }
      // Parse install time (stored as "HH:MM AM/PM" string)
      if ((deal as any).install_time) {
        const timeStr = (deal as any).install_time;
        // Try to parse time string into a Date
        const today = new Date();
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const period = timeMatch[3]?.toUpperCase();
          if (period === 'PM' && hours < 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          today.setHours(hours, minutes, 0, 0);
          setInstallTime(today);
        }
      }
      setCrewAssignment((deal as any).crew_assignment || '');
      setFinancialForm({
        rcv: deal.rcv?.toString() || '',
        acv: deal.acv?.toString() || '',
        deductible: deal.deductible?.toString() || '',
        depreciation: deal.depreciation?.toString() || '',
      });
    }
  }, [deal]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Deal>) => {
      const response = await dealsApi.update(id, updates);
      if (response.error) throw new Error(response.error);
      if (updates.status === 'installed') {
        try {
          const pinsResponse = await pinsApi.list();
          if (pinsResponse.data) {
            const dealPins = pinsResponse.data.filter(pin => pin.deal_id === id);
            for (const pin of dealPins) {
              await pinsApi.update(pin.id, { status: 'installed' });
            }
          }
        } catch (e) {
          console.warn('Could not update pins:', e);
        }
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      Alert.alert('Success', 'Deal updated!');
      refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    },
  });

  const handleStatusChange = (newStatus: string, extras?: Partial<Deal>) => {
    if (!deal) return;

    // Prevent going backwards in status
    const currentIndex = getMilestoneIndex(deal.status);
    const newIndex = getMilestoneIndex(newStatus);
    if (newIndex < currentIndex) {
      Alert.alert('Cannot Go Back', 'Status can only move forward in the deal progress.');
      return;
    }

    const updates: Partial<Deal> = { status: newStatus, ...extras };
    if (newStatus === 'installed') {
      updates.completion_date = new Date().toISOString().split('T')[0];
    }
    updateMutation.mutate(updates);
    setShowStatusModal(false);
  };

  const handleCall = () => deal?.homeowner_phone && Linking.openURL(`tel:${deal.homeowner_phone}`);
  const handleEmail = () => deal?.homeowner_email && Linking.openURL(`mailto:${deal.homeowner_email}`);
  const handleDirections = () => {
    if (deal?.address) {
      Linking.openURL(`https://maps.apple.com/?daddr=${encodeURIComponent(`${deal.address}, ${deal.city || ''}, ${deal.state || ''}`)}`);
    }
  };

  // View document
  const handleViewDocument = async (fileKey: string | null | undefined, docName: string) => {
    if (!fileKey) {
      Alert.alert('Not Available', `${docName} has not been uploaded yet.`);
      return;
    }
    try {
      // Check if it's a base64 HTML data URL (agreement document)
      if (fileKey.startsWith('data:text/html;base64,')) {
        // Decode and show in HTML viewer modal
        const base64Data = fileKey.replace('data:text/html;base64,', '');
        const htmlContent = decodeURIComponent(escape(atob(base64Data)));
        setHtmlViewerContent(htmlContent);
        setHtmlViewerTitle(docName);
        setShowHtmlViewer(true);
        return;
      }

      const signedUrl = await getSignedFileUrl(fileKey);
      if (signedUrl) {
        // Check if it's an image - display in image viewer
        const isImage = /\.(jpg|jpeg|png|gif|webp)/i.test(fileKey) || fileKey.includes('image');
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
        Alert.alert('Error', 'Could not load document');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  // View photos
  const handleViewPhotos = async (imageKeys: string[] | null | undefined, category: string) => {
    if (!imageKeys || imageKeys.length === 0) {
      Alert.alert('No Photos', `No ${category} photos have been uploaded.`);
      return;
    }
    setLoadingImages(true);
    try {
      const urls: string[] = [];
      for (const key of imageKeys) {
        const signedUrl = await getSignedFileUrl(key);
        if (signedUrl) urls.push(signedUrl);
      }
      if (urls.length > 0) {
        setViewingImages(urls);
        setCurrentImageIndex(0);
        setShowImageViewer(true);
      } else {
        Alert.alert('Error', 'Could not load photos');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load photos');
    } finally {
      setLoadingImages(false);
    }
  };

  // Upload permit document
  const handleUploadPermit = async () => {
    if (!deal) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setUploadingPermit(true);

      const uploadResult = await uploadFile(
        file.uri,
        file.name || `permit-${Date.now()}.pdf`,
        file.mimeType || 'application/pdf',
        'documents',
        deal.id
      );

      if (uploadResult) {
        await updateMutation.mutateAsync({ permit_file_url: uploadResult.key });
        Alert.alert('Success', 'Permit uploaded successfully!');
      } else {
        Alert.alert('Error', 'Failed to upload permit');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload permit: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploadingPermit(false);
    }
  };

  // Generate and save invoice
  const handleGenerateInvoice = async () => {
    if (!deal) return;

    setGeneratingInvoice(true);
    try {
      // Calculate totals
      const depreciation = deal.depreciation || 0;
      const deductible = deal.deductible || 0;
      const acv = deal.acv || 0;
      const rcv = deal.rcv || 0;
      const salesTax = deal.sales_tax || 0;
      const totalDue = depreciation; // Depreciation is what's owed after ACV is collected

      // Generate invoice HTML
      const invoiceHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice - ${deal.homeowner_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1f2937; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #C9A24D; padding-bottom: 20px; }
            .company { }
            .company-name { font-size: 28px; font-weight: bold; color: #C9A24D; }
            .company-tagline { font-size: 12px; color: #6b7280; margin-top: 4px; }
            .invoice-info { text-align: right; }
            .invoice-title { font-size: 32px; font-weight: bold; color: #374151; }
            .invoice-number { font-size: 14px; color: #6b7280; margin-top: 8px; }
            .invoice-date { font-size: 14px; color: #6b7280; }
            
            .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .party { flex: 1; }
            .party-label { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
            .party-name { font-size: 18px; font-weight: 600; color: #1f2937; }
            .party-detail { font-size: 14px; color: #4b5563; margin-top: 4px; }
            
            .job-details { background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 32px; }
            .job-title { font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 16px; }
            .job-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
            .job-item { }
            .job-label { font-size: 12px; color: #6b7280; }
            .job-value { font-size: 16px; font-weight: 600; color: #1f2937; margin-top: 4px; }
            
            .line-items { margin-bottom: 32px; }
            .line-items-header { display: flex; padding: 12px 16px; background: #C9A24D; color: white; font-weight: 600; font-size: 14px; border-radius: 8px 8px 0 0; }
            .line-items-header .desc { flex: 2; }
            .line-items-header .amount { flex: 1; text-align: right; }
            .line-item { display: flex; padding: 16px; border-bottom: 1px solid #e5e7eb; }
            .line-item .desc { flex: 2; font-size: 14px; color: #374151; }
            .line-item .amount { flex: 1; text-align: right; font-size: 14px; font-weight: 500; color: #1f2937; }
            .line-item:last-child { border-bottom: none; }
            
            .totals { margin-left: auto; width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .total-row.subtotal { border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 8px; }
            .total-row.grand { background: #22c55e; color: white; padding: 16px; border-radius: 8px; font-size: 18px; font-weight: bold; margin-top: 16px; }
            .total-label { color: #6b7280; }
            .total-row.grand .total-label { color: white; }
            .total-value { font-weight: 600; color: #1f2937; }
            .total-row.grand .total-value { color: white; }
            
            .payments { margin-top: 40px; padding: 24px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0; }
            .payments-title { font-size: 14px; font-weight: 600; color: #166534; margin-bottom: 16px; }
            .payment-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .payment-label { color: #166534; }
            .payment-value { font-weight: 600; color: #166534; }
            .payment-status { font-size: 12px; padding: 2px 8px; background: #dcfce7; border-radius: 4px; margin-left: 8px; }
            
            .footer { margin-top: 60px; text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            .footer-text { font-size: 12px; color: #6b7280; }
            .footer-contact { font-size: 14px; color: #C9A24D; font-weight: 600; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">
              <div class="company-name">Zenith Solutions LLC</div>
              <div class="company-tagline">Professional Roofing Services</div>
            </div>
            <div class="invoice-info">
              <div class="invoice-title">INVOICE</div>
              <div class="invoice-number">#INV-${deal.id.slice(0, 8).toUpperCase()}</div>
              <div class="invoice-date">Date: ${format(new Date(), 'MMMM d, yyyy')}</div>
            </div>
          </div>
          
          <div class="parties">
            <div class="party">
              <div class="party-label">Bill To</div>
              <div class="party-name">${deal.homeowner_name}</div>
              <div class="party-detail">${deal.address}</div>
              <div class="party-detail">${deal.city || ''}, ${deal.state || ''} ${deal.zip_code || ''}</div>
              ${deal.homeowner_phone ? `<div class="party-detail">${deal.homeowner_phone}</div>` : ''}
              ${deal.homeowner_email ? `<div class="party-detail">${deal.homeowner_email}</div>` : ''}
            </div>
            <div class="party" style="text-align: right;">
              <div class="party-label">Project Address</div>
              <div class="party-name">${deal.address}</div>
              <div class="party-detail">${deal.city || ''}, ${deal.state || ''} ${deal.zip_code || ''}</div>
            </div>
          </div>
          
          <div class="job-details">
            <div class="job-title">Project Details</div>
            <div class="job-grid">
              <div class="job-item">
                <div class="job-label">Roof Type</div>
                <div class="job-value">${deal.roof_type || 'Shingle'}</div>
              </div>
              <div class="job-item">
                <div class="job-label">Squares</div>
                <div class="job-value">${deal.roof_squares || '-'}</div>
              </div>
              <div class="job-item">
                <div class="job-label">Material</div>
                <div class="job-value">${deal.material_category || '-'} ${deal.material_color ? `- ${deal.material_color}` : ''}</div>
              </div>
              <div class="job-item">
                <div class="job-label">Insurance Claim</div>
                <div class="job-value">${deal.claim_number || 'N/A'}</div>
              </div>
            </div>
          </div>
          
          <div class="line-items">
            <div class="line-items-header">
              <div class="desc">Description</div>
              <div class="amount">Amount</div>
            </div>
            <div class="line-item">
              <div class="desc">Replacement Cost Value (RCV)</div>
              <div class="amount">$${rcv.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="line-item">
              <div class="desc">Less: Depreciation</div>
              <div class="amount">-$${depreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="line-item">
              <div class="desc">Actual Cash Value (ACV)</div>
              <div class="amount">$${acv.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            ${salesTax > 0 ? `
            <div class="line-item">
              <div class="desc">Sales Tax</div>
              <div class="amount">$${salesTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
            ` : ''}
          </div>
          
          <div class="totals">
            <div class="total-row">
              <span class="total-label">Subtotal (RCV)</span>
              <span class="total-value">$${rcv.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Deductible</span>
              <span class="total-value">$${deductible.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="total-row grand">
              <span class="total-label">Amount Due (Depreciation)</span>
              <span class="total-value">$${depreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          
          <div class="payments">
            <div class="payments-title">Payment Summary</div>
            <div class="payment-row">
              <span class="payment-label">ACV Payment from Insurance<span class="payment-status">✓ Collected</span></span>
              <span class="payment-value">$${acv.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="payment-row">
              <span class="payment-label">Deductible from Homeowner<span class="payment-status">✓ Collected</span></span>
              <span class="payment-value">$${deductible.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="payment-row" style="border-top: 1px solid #bbf7d0; padding-top: 12px; margin-top: 8px;">
              <span class="payment-label" style="font-weight: 600;">Remaining Due (Depreciation)</span>
              <span class="payment-value" style="font-size: 18px;">$${depreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-text">Thank you for choosing Zenith Solutions LLC for your roofing needs.</div>
            <div class="footer-contact">Questions? Contact us at support@zenithsolutions.com</div>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html: invoiceHtml });

      // Upload to S3
      const invoiceFileName = `invoice-${deal.id}-${Date.now()}.pdf`;
      const uploadResult = await uploadFile(
        uri,
        invoiceFileName,
        'application/pdf',
        'documents',
        deal.id
      );

      if (uploadResult) {
        // Update deal with invoice URL and advance status to invoice_sent
        await updateMutation.mutateAsync({
          invoice_url: uploadResult.key,
          invoice_sent_date: new Date().toISOString().split('T')[0],
          status: 'invoice_sent',
        });

        // Share the PDF
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Invoice' });
        }

        Alert.alert('Success', 'Invoice generated and sent! Deal status updated to RCV Sent.');
      } else {
        Alert.alert('Error', 'Failed to upload invoice');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate invoice: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setGeneratingInvoice(false);
      setShowInvoiceModal(false);
    }
  };

  // Handle approve commission payment
  const handleApproveCommission = async () => {
    Alert.alert(
      'Approve Commission',
      `Approve commission payment of $${commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} to ${repName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Mark Paid',
          onPress: async () => {
            try {
              // Update deal status to 'paid' and mark commission as paid
              await updateMutation.mutateAsync({
                status: 'paid',
                commission_paid: true,
                commission_paid_date: new Date().toISOString().split('T')[0],
              });

              Alert.alert('Success', `Commission payment of $${commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} approved for ${repName}!`);
            } catch (error) {
              Alert.alert('Error', 'Failed to approve commission: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
          }
        }
      ]
    );
  };

  // Handle editing commission amount with reason
  const handleSaveCommissionEdit = async () => {
    if (!commissionEditReason.trim()) {
      Alert.alert('Error', 'A reason is required when editing commission amount.');
      return;
    }

    const newAmount = parseFloat(editedCommissionAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      Alert.alert('Error', 'Please enter a valid commission amount.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        commission_override_amount: newAmount,
        commission_override_reason: commissionEditReason.trim(),
        commission_override_date: new Date().toISOString(),
      });

      Alert.alert('Success', 'Commission amount updated successfully.');
      setShowCommissionEditModal(false);
      setEditedCommissionAmount('');
      setCommissionEditReason('');
    } catch (error) {
      Alert.alert('Error', 'Failed to update commission: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // View lost statement helper
  const handleViewLostStatement = async () => {
    if (!deal?.lost_statement_url) {
      Alert.alert('No Lost Statement', 'Lost statement has not been uploaded for this deal.');
      return;
    }

    setLoadingLostStatement(true);
    try {
      const signedUrl = await getSignedFileUrl(deal.lost_statement_url);
      if (signedUrl) {
        await WebBrowser.openBrowserAsync(signedUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
      } else {
        Alert.alert('Error', 'Could not load lost statement');
      }
    } catch (error) {
      console.error('Error viewing lost statement:', error);
      Alert.alert('Error', 'Failed to open lost statement');
    } finally {
      setLoadingLostStatement(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={staticColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !deal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Failed to load deal</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentMilestoneIndex = getMilestoneIndex(deal.status);
  const progress = Math.round((currentMilestoneIndex / (milestones.length - 1)) * 100);
  const isComplete = deal.status === 'complete';
  const config = statusConfig[deal.status] || statusConfig.lead;
  const currentPhase = milestones[currentMilestoneIndex]?.phase || 'sign';
  
  // Calculate RCV: Use rcv if set, otherwise ACV + Depreciation
  const numRcv = Number(deal.rcv) || 0;
  const numAcv = Number(deal.acv) || 0;
  const numDepreciation = Number(deal.depreciation) || 0;
  const calculatedRCV = numRcv > 0 ? numRcv : (numAcv + numDepreciation);
  const dealValue = calculatedRCV;
  
  // Find the rep associated with this deal - check multiple possible ID fields
  const dealRepId = deal.rep_id || deal.deal_commissions?.[0]?.rep_id;
  const dealRep = reps?.find(r =>
    r.id === dealRepId ||
    r.user_id === dealRepId ||
    r.id === deal.rep_id ||
    r.user_id === deal.rep_id
  );

  // Debug logging
  console.log('[Commission Debug]', {
    dealRepId,
    'deal.rep_id': deal.rep_id,
    'deal.rep_name': deal.rep_name,
    'deal.deal_commissions': deal.deal_commissions,
    'reps count': reps?.length,
    'dealRep found': !!dealRep,
    'dealRep': dealRep,
  });

  // Get rep info from multiple sources with fallbacks
  const repName = deal.deal_commissions?.[0]?.rep_name || deal.rep_name || dealRep?.full_name || 'Unknown Rep';

  // Get commission percent: priority is deal_commissions, then rep's default_commission_percent, then level-based
  const getRepCommissionPercent = (): number => {
    // First check deal_commissions
    if (deal.deal_commissions?.[0]?.commission_percent && deal.deal_commissions[0].commission_percent > 0) {
      return deal.deal_commissions[0].commission_percent;
    }
    // Then check rep's database commission
    if (dealRep?.default_commission_percent && dealRep.default_commission_percent > 0) {
      return dealRep.default_commission_percent;
    }
    // Fallback to commission level
    if (dealRep?.commission_level && commissionLevelPercentages[dealRep.commission_level]) {
      return commissionLevelPercentages[dealRep.commission_level];
    }
    // Default
    return 10;
  };

  // Get commission level name for display
  const getRepCommissionLevel = (): string => {
    if (dealRep?.commission_level) {
      return dealRep.commission_level.charAt(0).toUpperCase() + dealRep.commission_level.slice(1);
    }
    return '';
  };

  // Calculate commission: (RCV - Sales Tax) × Commission %
  const salesTax = calculatedRCV * 0.0825;
  const baseAmount = calculatedRCV - salesTax;

  // Get commission percent
  const commissionPercent = getRepCommissionPercent();
  const commissionLevel = getRepCommissionLevel();

  // Use override amount if set, then stored commission amount, otherwise calculate
  const commissionAmount = deal.commission_override_amount
    ? deal.commission_override_amount
    : (deal.deal_commissions?.[0]?.commission_amount || (baseAmount * (commissionPercent / 100)));

  const getNextAction = (): { label: string; status: string; icon: IoniconsName; needsDate?: boolean; isInvoice?: boolean } | null => {
    switch (deal.status) {
      case 'awaiting_approval':
        return { label: 'Approve Financials', status: 'approved', icon: 'checkmark-circle' };
      case 'materials_selected':
        return { label: 'Schedule Install', status: 'install_scheduled', icon: 'calendar', needsDate: true };
      case 'install_scheduled':
        return { label: 'Mark Installed', status: 'installed', icon: 'checkmark-circle' };
      case 'installed':
        // Wait for rep to get completion form signed
        return null;
      case 'completion_signed':
        return { label: 'Generate & Send Invoice', status: 'invoice_sent', icon: 'document-text', isInvoice: true };
      case 'invoice_sent':
        // Rep needs to collect depreciation
        return null;
      case 'depreciation_collected':
        // Rep has collected depreciation, admin can complete the deal
        return { label: 'Complete Deal', status: 'complete', icon: 'trophy' };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  const renderOverviewTab = () => (
    <>
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="home" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Property Information</Text>
        </View>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Homeowner</Text>
            <Text style={[styles.infoValueLarge, { color: colors.foreground }]}>{deal.homeowner_name}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Address</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.address}</Text>
            {deal.city && <Text style={[styles.infoValueSub, { color: colors.mutedForeground }]}>{deal.city}, {deal.state} {deal.zip_code}</Text>}
          </View>
          {deal.homeowner_phone && (
            <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
              <Ionicons name="call" size={16} color="#3B82F6" />
              <Text style={styles.contactText}>{deal.homeowner_phone}</Text>
            </TouchableOpacity>
          )}
          {deal.homeowner_email && (
            <TouchableOpacity style={styles.contactRow} onPress={handleEmail}>
              <Ionicons name="mail" size={16} color="#8B5CF6" />
              <Text style={styles.contactText}>{deal.homeowner_email}</Text>
            </TouchableOpacity>
          )}
        </View>
        {(deal.roof_type || deal.roof_squares) && (
          <View style={styles.propertyDetails}>
            {deal.roof_type && <View style={[styles.propertyTag, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}><Text style={[styles.propertyTagText, { color: colors.foreground }]}>{deal.roof_type}</Text></View>}
            {deal.roof_squares && <View style={[styles.propertyTag, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}><Text style={[styles.propertyTagText, { color: colors.foreground }]}>{deal.roof_squares} sq</Text></View>}
            {deal.stories && <View style={[styles.propertyTag, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}><Text style={[styles.propertyTagText, { color: colors.foreground }]}>{deal.stories} story</Text></View>}
          </View>
        )}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-checkmark" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Insurance Details</Text>
        </View>
        <View style={styles.infoGrid}>
          {deal.insurance_company && <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Insurance</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.insurance_company}</Text></View>}
          {deal.claim_number && <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Claim #</Text><Text style={[styles.infoValueMono, { color: colors.foreground }]}>{deal.claim_number}</Text></View>}
          {deal.policy_number && <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Policy #</Text><Text style={[styles.infoValueMono, { color: colors.foreground }]}>{deal.policy_number}</Text></View>}
          {deal.date_of_loss && <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Date of Loss</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{format(new Date(deal.date_of_loss), 'MMM d, yyyy')}</Text></View>}
          {deal.approval_type && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Approval</Text>
              <View style={styles.approvalBadge}><Text style={styles.approvalBadgeText}>{deal.approval_type === 'full' ? 'Full' : deal.approval_type === 'partial' ? 'Partial' : 'Sale'}</Text></View>
            </View>
          )}
        </View>
        {deal.adjuster_name && (
          <View style={[styles.adjusterSection, { borderTopColor: isDark ? colors.border : '#F3F4F6' }]}>
            <Text style={[styles.subSectionTitle, { color: colors.mutedForeground }]}>Adjuster</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.adjuster_name}</Text>
            {deal.adjuster_phone && <Text style={[styles.infoValueSub, { color: colors.mutedForeground }]}>{deal.adjuster_phone}</Text>}
          </View>
        )}
      </View>

      {/* Sales Rep Section with Reassign */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sales Rep</Text>
        </View>
        <View style={styles.repRow}>
          <View style={styles.repInfo}>
            <Text style={[styles.repName, { color: colors.foreground }]}>{repName}</Text>
            {commissionLevel && (
              <View style={styles.repLevelBadge}>
                <Text style={styles.repLevelText}>{commissionLevel}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.reassignButton}
            onPress={() => setShowReassignModal(true)}
          >
            <Ionicons name="swap-horizontal" size={16} color={staticColors.primary} />
            <Text style={styles.reassignButtonText}>Reassign</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Material Specifications Section */}
      {(deal.material_category || deal.material_color || deal.drip_edge || deal.vent_color) && (
        <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct" size={20} color={staticColors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Material Specifications</Text>
          </View>
          <View style={styles.materialGrid}>
            {deal.material_category && (
              <View style={[styles.materialItem, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                <Text style={[styles.materialLabel, { color: colors.mutedForeground }]}>Category</Text>
                <Text style={[styles.materialValue, { color: colors.foreground }]}>{deal.material_category}</Text>
              </View>
            )}
            {deal.material_type && (
              <View style={[styles.materialItem, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                <Text style={[styles.materialLabel, { color: colors.mutedForeground }]}>Type</Text>
                <Text style={[styles.materialValue, { color: colors.foreground }]}>{deal.material_type}</Text>
              </View>
            )}
            {deal.material_color && (
              <View style={[styles.materialItem, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                <Text style={[styles.materialLabel, { color: colors.mutedForeground }]}>Color</Text>
                <Text style={[styles.materialValue, { color: colors.foreground }]}>{deal.material_color}</Text>
              </View>
            )}
            {deal.drip_edge && (
              <View style={[styles.materialItem, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                <Text style={[styles.materialLabel, { color: colors.mutedForeground }]}>Drip Edge</Text>
                <Text style={[styles.materialValue, { color: colors.foreground }]}>{deal.drip_edge}</Text>
              </View>
            )}
            {deal.vent_color && (
              <View style={[styles.materialItem, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                <Text style={[styles.materialLabel, { color: colors.mutedForeground }]}>Vent Color</Text>
                <Text style={[styles.materialValue, { color: colors.foreground }]}>{deal.vent_color}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timeline</Text>
        </View>
        <View style={styles.timeline}>
          {deal.created_at && <View style={styles.timelineItem}><View style={styles.timelineDot} /><Text style={[styles.timelineLabel, { color: colors.foreground }]}>Created</Text><Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.created_at), 'MMM d, yyyy')}</Text></View>}
          {deal.inspection_date && <View style={styles.timelineItem}><View style={styles.timelineDot} /><Text style={[styles.timelineLabel, { color: colors.foreground }]}>Inspection</Text><Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.inspection_date), 'MMM d, yyyy')}</Text></View>}
          {deal.signed_date && <View style={styles.timelineItem}><View style={styles.timelineDot} /><Text style={[styles.timelineLabel, { color: colors.foreground }]}>Signed</Text><Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.signed_date), 'MMM d, yyyy')}</Text></View>}
          {deal.install_date && <View style={styles.timelineItem}><View style={styles.timelineDot} /><Text style={[styles.timelineLabel, { color: colors.foreground }]}>Install</Text><Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.install_date), 'MMM d, yyyy')}</Text></View>}
          {deal.completion_date && <View style={styles.timelineItem}><View style={[styles.timelineDot, { backgroundColor: '#22C55E' }]} /><Text style={[styles.timelineLabel, { color: colors.foreground }]}>Completed</Text><Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{format(new Date(deal.completion_date), 'MMM d, yyyy')}</Text></View>}
        </View>
      </View>

      {/* Install Date Section - Admin can set/edit when deal is at materials_selected (Ready for Install) or beyond */}
      {(() => {
        const materialsSelectedIndex = milestones.findIndex(m => m.status === 'materials_selected');
        const canSetInstallDate = currentMilestoneIndex >= materialsSelectedIndex;

        if (!canSetInstallDate) {
          return (
            <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar" size={20} color="#9CA3AF" />
                <Text style={[styles.sectionTitle, { color: '#9CA3AF' }]}>Installation Schedule</Text>
              </View>
              <View style={[styles.installDateLocked, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}>
                <Ionicons name="lock-closed" size={24} color={colors.mutedForeground} />
                <Text style={[styles.installDateLockedText, { color: colors.mutedForeground }]}>Install schedule can be set once deal reaches "Ready for Install" status</Text>
              </View>
            </View>
          );
        }

        return (
          <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={20} color={staticColors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Installation Schedule</Text>
            </View>
            <View style={styles.installDateContainer}>
              {deal.install_date ? (
                <View>
                  <View style={styles.installDateDisplay}>
                    <View style={styles.installDateInfo}>
                      <Text style={[styles.installDateLabel, { color: colors.mutedForeground }]}>Scheduled Date</Text>
                      <Text style={[styles.installDateValue, { color: colors.foreground }]}>{format(new Date(deal.install_date), 'EEEE, MMMM d, yyyy')}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.editInstallDateBtn}
                      onPress={() => setShowInstallDateModal(true)}
                    >
                      <Ionicons name="pencil" size={16} color={staticColors.primary} />
                      <Text style={styles.editInstallDateText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                  {(deal as any).install_time && (
                    <View style={[styles.installDetailRow, { borderTopColor: isDark ? colors.border : '#F3F4F6' }]}>
                      <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.installDetailLabel, { color: colors.mutedForeground }]}>Time:</Text>
                      <Text style={[styles.installDetailValue, { color: colors.foreground }]}>{(deal as any).install_time}</Text>
                    </View>
                  )}
                  {(deal as any).crew_assignment && (
                    <View style={[styles.installDetailRow, { borderTopColor: isDark ? colors.border : '#F3F4F6' }]}>
                      <Ionicons name="people-outline" size={16} color={colors.mutedForeground} />
                      <Text style={[styles.installDetailLabel, { color: colors.mutedForeground }]}>Crew:</Text>
                      <Text style={[styles.installDetailValue, { color: colors.foreground }]}>{(deal as any).crew_assignment}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.setInstallDateBtn}
                  onPress={() => setShowInstallDateModal(true)}
                >
                  <Ionicons name="add-circle" size={20} color="#FFF" />
                  <Text style={styles.setInstallDateText}>Schedule Installation</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })()}

      {deal.notes && (
        <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={20} color={staticColors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notes</Text>
          </View>
          <Text style={[styles.notesText, { color: colors.foreground }]}>{deal.notes}</Text>
        </View>
      )}
    </>
  );

  const renderFinancialsTab = () => (
    <>
      {/* Approval Section */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-checkmark" size={20} color={deal?.approved_date ? '#22C55E' : '#F59E0B'} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Financial Approval</Text>
        </View>

        {deal?.approval_type && deal?.approved_date ? (
          <View style={styles.approvalStatusCard}>
            <View style={styles.approvalStatusHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <Text style={styles.approvalStatusTitle}>Approved</Text>
            </View>
            <Text style={styles.approvalStatusSubtitle}>
              {deal.approval_type === 'full' ? 'Full Approval' :
               deal.approval_type === 'partial' ? 'Partial Approval' :
               deal.approval_type === 'supplement_needed' ? 'Supplement Needed' :
               deal.approval_type === 'sale' ? 'Sale (Homeowner Pays)' : deal.approval_type}
            </Text>
            <Text style={styles.approvalStatusDate}>
              Approved on {format(new Date(deal.approved_date), 'MMM d, yyyy')}
            </Text>
            <View style={styles.lockedNotice}>
              <Ionicons name="lock-closed" size={14} color="#6B7280" />
              <Text style={styles.lockedNoticeText}>Financial details are locked</Text>
            </View>
          </View>
        ) : (
          <View>
            <Text style={[styles.approvalDescription, { color: colors.mutedForeground }]}>
              Review and edit the financial details below, then approve. Once approved, these values will be locked and commission will be calculated.
            </Text>

            {/* View Lost Statement Button */}
            <TouchableOpacity
              style={[
                styles.viewLostStatementBtn,
                {
                  backgroundColor: deal?.lost_statement_url ? 'rgba(59, 130, 246, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                  borderColor: deal?.lost_statement_url ? '#3B82F6' : '#9CA3AF'
                }
              ]}
              onPress={handleViewLostStatement}
              disabled={!deal?.lost_statement_url || loadingLostStatement}
            >
              {loadingLostStatement ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <>
                  <Ionicons
                    name={deal?.lost_statement_url ? "document-text" : "document-text-outline"}
                    size={18}
                    color={deal?.lost_statement_url ? '#3B82F6' : '#9CA3AF'}
                  />
                  <Text style={[
                    styles.viewLostStatementBtnText,
                    { color: deal?.lost_statement_url ? '#3B82F6' : '#9CA3AF' }
                  ]}>
                    {deal?.lost_statement_url ? 'View Lost Statement' : 'No Lost Statement Uploaded'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Editable Financial Fields */}
            <View style={styles.financialEditGrid}>
              <View style={styles.financialEditRow}>
                <View style={styles.financialEditField}>
                  <Text style={[styles.financialEditLabel, { color: colors.foreground }]}>RCV</Text>
                  <TextInput
                    style={[styles.financialEditInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                    value={financialForm.rcv}
                    onChangeText={(v) => setFinancialForm({ ...financialForm, rcv: v })}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.financialEditField}>
                  <Text style={[styles.financialEditLabel, { color: colors.foreground }]}>ACV</Text>
                  <TextInput
                    style={[styles.financialEditInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                    value={financialForm.acv}
                    onChangeText={(v) => setFinancialForm({ ...financialForm, acv: v })}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={styles.financialEditRow}>
                <View style={styles.financialEditField}>
                  <Text style={[styles.financialEditLabel, { color: colors.foreground }]}>Deductible</Text>
                  <TextInput
                    style={[styles.financialEditInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                    value={financialForm.deductible}
                    onChangeText={(v) => setFinancialForm({ ...financialForm, deductible: v })}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.financialEditField}>
                  <Text style={[styles.financialEditLabel, { color: colors.foreground }]}>Depreciation</Text>
                  <TextInput
                    style={[styles.financialEditInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                    value={financialForm.depreciation}
                    onChangeText={(v) => setFinancialForm({ ...financialForm, depreciation: v })}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            {/* Save Changes Button */}
            <TouchableOpacity
              style={styles.saveFinancialsButton}
              onPress={() => {
                updateMutation.mutate({
                  rcv: financialForm.rcv ? parseFloat(financialForm.rcv) : null,
                  acv: financialForm.acv ? parseFloat(financialForm.acv) : null,
                  deductible: financialForm.deductible ? parseFloat(financialForm.deductible) : null,
                  depreciation: financialForm.depreciation ? parseFloat(financialForm.depreciation) : null,
                });
              }}
            >
              <Ionicons name="save" size={18} color={staticColors.primary} />
              <Text style={styles.saveFinancialsText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.approveFinancialsButton}
              onPress={() => setShowApprovalModal(true)}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.approveFinancialsText}>Approve Financial Details</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.financialSummary}>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}><Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>RCV</Text><Text style={[styles.summaryValue, { color: colors.foreground }]}>${calculatedRCV.toLocaleString()}</Text></View>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}><Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>ACV</Text><Text style={[styles.summaryValue, { color: colors.foreground }]}>${numAcv.toLocaleString()}</Text></View>
      </View>
      <View style={styles.financialSummary}>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}><Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Deductible</Text><Text style={[styles.summaryValue, { color: '#EF4444' }]}>${(deal.deductible || 0).toLocaleString()}</Text></View>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}><Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Depreciation</Text><Text style={[styles.summaryValue, { color: colors.foreground }]}>${numDepreciation.toLocaleString()}</Text></View>
      </View>
      <View style={[styles.totalCard, { borderColor: staticColors.primary + '30' }]}>
        <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total Contract Value</Text>
        <Text style={styles.totalValue}>${dealValue.toLocaleString()}</Text>
      </View>
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="cash" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment Status</Text>
        </View>
        <View style={styles.paymentChecklist}>
          <View style={styles.paymentItem}>
            <Ionicons name={deal.acv_receipt_url ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={deal.acv_receipt_url ? '#22C55E' : '#D1D5DB'} />
            <View style={styles.paymentItemContent}>
              <Text style={[styles.paymentItemLabel, { color: colors.foreground }]}>ACV Collected</Text>
              <Text style={[styles.paymentItemStatus, { color: colors.mutedForeground }]}>{deal.acv_receipt_url ? 'Receipt uploaded' : 'No receipt'}</Text>
            </View>
          </View>
          <View style={styles.paymentItem}>
            <Ionicons name={deal.deductible_receipt_url ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={deal.deductible_receipt_url ? '#22C55E' : '#D1D5DB'} />
            <View style={styles.paymentItemContent}>
              <Text style={[styles.paymentItemLabel, { color: colors.foreground }]}>Deductible Collected</Text>
              <Text style={[styles.paymentItemStatus, { color: colors.mutedForeground }]}>{deal.deductible_receipt_url ? 'Receipt uploaded' : 'No receipt'}</Text>
            </View>
          </View>
          <View style={styles.paymentItem}>
            <Ionicons name={deal.depreciation_receipt_url ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={deal.depreciation_receipt_url ? '#22C55E' : '#D1D5DB'} />
            <View style={styles.paymentItemContent}>
              <Text style={[styles.paymentItemLabel, { color: colors.foreground }]}>Depreciation Collected</Text>
              <Text style={[styles.paymentItemStatus, { color: colors.mutedForeground }]}>{deal.depreciation_receipt_url ? 'Receipt uploaded' : 'No receipt'}</Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );

  const renderDocumentsTab = () => (
    <>
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="create" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contract Signature</Text>
        </View>
        {deal.contract_signed ? (
          <>
            <View style={styles.signatureStatus}>
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <Text style={styles.signedText}>Signed {deal.signed_date && format(new Date(deal.signed_date), 'MMM d, yyyy')}</Text>
            </View>
            {deal.signature_url && (
              <TouchableOpacity
                style={styles.viewSignatureButton}
                onPress={() => handleViewDocument(deal.signature_url, 'Signature')}
              >
                <Ionicons name="eye" size={18} color={staticColors.primary} />
                <Text style={styles.viewSignatureText}>View Signature</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.pendingStatus}>
            <Ionicons name="time" size={24} color="#F59E0B" />
            <Text style={styles.pendingText}>Awaiting Signature</Text>
          </View>
        )}
      </View>

      {/* Insurance Agreement Section */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="document-text" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Insurance Agreement</Text>
        </View>
        <View style={styles.documentList}>
          {/* Signed Agreement (full document with signature) */}
          <TouchableOpacity
            style={[styles.documentItem, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}
            onPress={() => handleViewDocument(deal.agreement_document_url, 'Signed Agreement')}
            disabled={!deal.contract_signed || !deal.agreement_document_url}
          >
            <Ionicons
              name={deal.contract_signed ? 'document' : 'document-outline'}
              size={20}
              color={deal.contract_signed ? '#22C55E' : '#9CA3AF'}
            />
            <Text style={[styles.documentName, { color: colors.foreground }, !deal.contract_signed && styles.documentNameMissing]}>
              Signed Agreement
            </Text>
            {deal.contract_signed && deal.agreement_document_url ? (
              <View style={styles.viewButton}>
                <Ionicons name="eye" size={16} color={staticColors.primary} />
                <Text style={styles.viewButtonText}>View</Text>
              </View>
            ) : deal.contract_signed ? (
              <View style={[styles.viewButton, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text style={[styles.viewButtonText, { color: '#22C55E' }]}>Signed</Text>
              </View>
            ) : (
              <Text style={styles.documentMissing}>Not signed</Text>
            )}
          </TouchableOpacity>

          {/* Uploaded Insurance Agreement */}
          <TouchableOpacity
            style={[styles.documentItem, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}
            onPress={() => handleViewDocument(deal.insurance_agreement_url, 'Uploaded Agreement')}
            disabled={!deal.insurance_agreement_url}
          >
            <Ionicons
              name={deal.insurance_agreement_url ? 'document' : 'document-outline'}
              size={20}
              color={deal.insurance_agreement_url ? staticColors.primary : '#9CA3AF'}
            />
            <Text style={[styles.documentName, { color: colors.foreground }, !deal.insurance_agreement_url && styles.documentNameMissing]}>
              Uploaded Agreement
            </Text>
            {deal.insurance_agreement_url ? (
              <View style={styles.viewButton}>
                <Ionicons name="eye" size={16} color={staticColors.primary} />
                <Text style={styles.viewButtonText}>View</Text>
              </View>
            ) : (
              <Text style={[styles.documentMissing, { color: colors.mutedForeground }]}>Not uploaded</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Lost Statement Section */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="document-attach" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Lost Statement</Text>
        </View>
        <TouchableOpacity
          style={[styles.documentItem, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}
          onPress={() => handleViewDocument(deal.lost_statement_url, 'Lost Statement')}
          disabled={!deal.lost_statement_url}
        >
          <Ionicons
            name={deal.lost_statement_url ? 'document' : 'document-outline'}
            size={20}
            color={deal.lost_statement_url ? staticColors.primary : '#9CA3AF'}
          />
          <Text style={[styles.documentName, { color: colors.foreground }, !deal.lost_statement_url && styles.documentNameMissing]}>
            Insurance Lost Statement
          </Text>
          {deal.lost_statement_url ? (
            <View style={styles.viewButton}>
              <Ionicons name="eye" size={16} color={staticColors.primary} />
              <Text style={styles.viewButtonText}>View</Text>
            </View>
          ) : (
            <Text style={[styles.documentMissing, { color: colors.mutedForeground }]}>Not uploaded</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Receipts Section */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="receipt" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Receipts</Text>
        </View>
        <View style={styles.documentList}>
          {[
            { name: 'ACV Receipt', url: deal.acv_receipt_url },
            { name: 'Deductible Receipt', url: deal.deductible_receipt_url },
            { name: 'Depreciation Receipt', url: deal.depreciation_receipt_url },
          ].map((doc) => (
            <TouchableOpacity
              key={doc.name}
              style={[styles.documentItem, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}
              onPress={() => handleViewDocument(doc.url, doc.name)}
              disabled={!doc.url}
            >
              <Ionicons name={doc.url ? 'document' : 'document-outline'} size={20} color={doc.url ? staticColors.primary : '#9CA3AF'} />
              <Text style={[styles.documentName, { color: colors.foreground }, !doc.url && styles.documentNameMissing]}>{doc.name}</Text>
              {doc.url ? (
                <View style={styles.viewButton}>
                  <Ionicons name="eye" size={16} color={staticColors.primary} />
                  <Text style={styles.viewButtonText}>View</Text>
                </View>
              ) : (
                <Text style={[styles.documentMissing, { color: colors.mutedForeground }]}>Not uploaded</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Other Documents Section */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="folder" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Documents</Text>
        </View>
        <View style={styles.documentList}>
          <TouchableOpacity
            style={[styles.documentItem, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}
            onPress={() => handleViewDocument(deal.invoice_url, 'Invoice')}
            disabled={!deal.invoice_url}
          >
            <Ionicons name={deal.invoice_url ? 'document' : 'document-outline'} size={20} color={deal.invoice_url ? staticColors.primary : '#9CA3AF'} />
            <Text style={[styles.documentName, { color: colors.foreground }, !deal.invoice_url && styles.documentNameMissing]}>Invoice</Text>
            {deal.invoice_url ? (
              <View style={styles.viewButton}>
                <Ionicons name="eye" size={16} color={staticColors.primary} />
                <Text style={styles.viewButtonText}>View</Text>
              </View>
            ) : (
              <Text style={[styles.documentMissing, { color: colors.mutedForeground }]}>Not uploaded</Text>
            )}
          </TouchableOpacity>

          {/* Permit with upload option */}
          <View style={[styles.documentItemWithAction, { borderBottomColor: isDark ? colors.border : '#F3F4F6' }]}>
            <TouchableOpacity
              style={styles.documentItemMain}
              onPress={() => handleViewDocument(deal.permit_file_url, 'Permit')}
              disabled={!deal.permit_file_url}
            >
              <Ionicons name={deal.permit_file_url ? 'document' : 'document-outline'} size={20} color={deal.permit_file_url ? staticColors.primary : '#9CA3AF'} />
              <Text style={[styles.documentName, { color: colors.foreground }, !deal.permit_file_url && styles.documentNameMissing]}>Permit</Text>
              {deal.permit_file_url ? (
                <View style={styles.viewButton}>
                  <Ionicons name="eye" size={16} color={staticColors.primary} />
                  <Text style={styles.viewButtonText}>View</Text>
                </View>
              ) : (
                <Text style={[styles.documentMissing, { color: colors.mutedForeground }]}>Not uploaded</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}
              onPress={handleUploadPermit}
              disabled={uploadingPermit}
            >
              {uploadingPermit ? (
                <ActivityIndicator size="small" color={staticColors.primary} />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={16} color={staticColors.primary} />
                  <Text style={styles.uploadButtonText}>{deal.permit_file_url ? 'Replace' : 'Upload'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Photos Section with View Button */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="images" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Photos</Text>
        </View>
        <View style={styles.photoGrid}>
          <TouchableOpacity
            style={[styles.photoCard, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border }]}
            onPress={() => handleViewPhotos(deal.inspection_images, 'inspection')}
            disabled={!deal.inspection_images?.length || loadingImages}
          >
            <View style={[styles.photoIconContainer, deal.inspection_images?.length ? styles.photoIconActive : null]}>
              <Ionicons name="search" size={24} color={deal.inspection_images?.length ? staticColors.primary : '#9CA3AF'} />
            </View>
            <Text style={styles.photoCountNumber}>{deal.inspection_images?.length || 0}</Text>
            <Text style={[styles.photoCountLabel, { color: colors.mutedForeground }]}>Inspection</Text>
            {deal.inspection_images?.length ? (
              <Text style={styles.photoViewText}>Tap to view</Text>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.photoCard, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border }]}
            onPress={() => handleViewPhotos(deal.install_images, 'install')}
            disabled={!deal.install_images?.length || loadingImages}
          >
            <View style={[styles.photoIconContainer, deal.install_images?.length ? styles.photoIconActive : null]}>
              <Ionicons name="construct" size={24} color={deal.install_images?.length ? staticColors.primary : '#9CA3AF'} />
            </View>
            <Text style={styles.photoCountNumber}>{deal.install_images?.length || 0}</Text>
            <Text style={[styles.photoCountLabel, { color: colors.mutedForeground }]}>Install</Text>
            {deal.install_images?.length ? (
              <Text style={styles.photoViewText}>Tap to view</Text>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.photoCard, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border }]}
            onPress={() => handleViewPhotos(deal.completion_images, 'completion')}
            disabled={!deal.completion_images?.length || loadingImages}
          >
            <View style={[styles.photoIconContainer, deal.completion_images?.length ? styles.photoIconActive : null]}>
              <Ionicons name="checkmark-done" size={24} color={deal.completion_images?.length ? staticColors.primary : '#9CA3AF'} />
            </View>
            <Text style={styles.photoCountNumber}>{deal.completion_images?.length || 0}</Text>
            <Text style={[styles.photoCountLabel, { color: colors.mutedForeground }]}>Completion</Text>
            {deal.completion_images?.length ? (
              <Text style={styles.photoViewText}>Tap to view</Text>
            ) : null}
          </TouchableOpacity>
        </View>
        {loadingImages && (
          <View style={[styles.loadingOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)' }]}>
            <ActivityIndicator size="large" color={staticColors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading photos...</Text>
          </View>
        )}
      </View>
    </>
  );

  const renderCommissionsTab = () => (
    <>
      <View style={styles.commissionSummaryCard}>
        <Text style={styles.commissionSummaryLabel}>Commission Due</Text>
        <Text style={styles.commissionSummaryValue}>${commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        <Text style={styles.commissionSummaryPercent}>{commissionPercent}% of ${dealValue.toLocaleString()}</Text>
        {/* Edit Commission Button */}
        <TouchableOpacity
          style={{ marginTop: 12, backgroundColor: '#3B82F6', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          onPress={() => {
            setEditedCommissionAmount(commissionAmount.toFixed(2));
            setCommissionEditReason('');
            setShowCommissionEditModal(true);
          }}
        >
          <Ionicons name="create" size={16} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Edit Commission</Text>
        </TouchableOpacity>
      </View>

      {/* Commission Override Info */}
      {deal.commission_override_amount && (
        <View style={[styles.sectionCard, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color="#F59E0B" />
            <Text style={[styles.sectionTitle, { color: '#92400E' }]}>Commission Adjusted</Text>
          </View>
          <Text style={{ color: '#92400E', fontSize: 13, marginBottom: 4 }}>
            Original: ${(baseAmount * (commissionPercent / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })} → Adjusted: ${deal.commission_override_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
          <Text style={{ color: '#78350F', fontSize: 12 }}>Reason: {deal.commission_override_reason}</Text>
          {deal.commission_override_date && (
            <Text style={{ color: '#92400E', fontSize: 11, marginTop: 4 }}>
              Adjusted on {format(new Date(deal.commission_override_date), 'MMM d, yyyy')}
            </Text>
          )}
        </View>
      )}

      {/* Commission Paid Card */}
      {(deal.status === 'paid' || deal.commission_paid) && (
        <View style={styles.commissionPaidCard}>
          <View style={styles.commissionPaidHeader}>
            <Ionicons name="checkmark-done-circle" size={32} color="#059669" />
            <Text style={styles.commissionPaidTitle}>Commission Paid</Text>
          </View>
          <Text style={styles.commissionPaidText}>
            Commission of ${commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} was paid to {repName}
            {deal.commission_paid_date && ` on ${format(new Date(deal.commission_paid_date), 'MMMM d, yyyy')}`}.
          </Text>
        </View>
      )}

      {/* Payment Requested Card - only show if not paid */}
      {deal.payment_requested && deal.status !== 'paid' && !deal.commission_paid && (
        <View style={styles.paymentRequestCard}>
          <View style={styles.paymentRequestHeader}>
            <Ionicons name="notifications" size={24} color="#F59E0B" />
            <Text style={styles.paymentRequestTitle}>Payment Requested</Text>
          </View>
          <Text style={styles.paymentRequestText}>The sales rep has requested their commission payment.</Text>
          <TouchableOpacity style={styles.approveCommissionBtn} onPress={handleApproveCommission}>
            <Ionicons name="checkmark" size={20} color="#FFF" />
            <Text style={styles.approveCommissionText}>Approve & Mark Paid</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sales Rep</Text>
        </View>
        <Text style={[styles.repDetailName, { color: colors.foreground }]}>{repName}</Text>
        {commissionLevel && (
          <View style={styles.commissionLevelBadge}>
            <Text style={styles.commissionLevelText}>{commissionLevel} Level</Text>
          </View>
        )}
        <View style={[styles.commissionBreakdown, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
          <View style={styles.breakdownRow}><Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Commission Rate</Text><Text style={[styles.breakdownValue, { color: colors.foreground }]}>{commissionPercent}%</Text></View>
          <View style={styles.breakdownRow}><Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Deal Value (RCV)</Text><Text style={[styles.breakdownValue, { color: colors.foreground }]}>${dealValue.toLocaleString()}</Text></View>
          <View style={styles.breakdownRow}><Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Sales Tax (8.25%)</Text><Text style={[styles.breakdownValue, { color: '#EF4444' }]}>-${salesTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text></View>
          <View style={styles.breakdownRow}><Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Base Amount</Text><Text style={[styles.breakdownValue, { color: colors.foreground }]}>${baseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text></View>
          <View style={[styles.breakdownRow, styles.breakdownTotal, { borderTopColor: isDark ? colors.border : '#E5E7EB' }]}><Text style={[styles.breakdownLabelBold, { color: colors.foreground }]}>Commission</Text><Text style={styles.breakdownValueBold}>${commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text></View>
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="wallet" size={20} color={staticColors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Status</Text>
        </View>
        <View style={styles.commissionStatus}>
          {deal.status === 'paid' || deal.commission_paid ? (
            <><Ionicons name="checkmark-done-circle" size={32} color="#059669" /><Text style={[styles.commissionStatusTitle, { color: '#059669' }]}>Paid</Text></>
          ) : isComplete ? (
            deal.payment_requested ? (
              <><Ionicons name="time" size={32} color="#F59E0B" /><Text style={[styles.commissionStatusTitle, { color: colors.foreground }]}>Pending Approval</Text></>
            ) : (
              <><Ionicons name="hourglass" size={32} color={colors.mutedForeground} /><Text style={[styles.commissionStatusTitle, { color: colors.foreground }]}>Awaiting Request</Text></>
            )
          ) : (
            <><Ionicons name="lock-closed" size={32} color={colors.mutedForeground} /><Text style={[styles.commissionStatusTitle, { color: colors.foreground }]}>Deal Not Complete</Text></>
          )}
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>{deal.homeowner_name}</Text>
          <Text style={[styles.headerAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{deal.address}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowStatusModal(true)}>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '20', borderColor: config.color }]}>
            <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Milestone Progress Section - matching rep view */}
      <View style={[styles.progressSection, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.progressHeader}>
          <View style={styles.progressTitleRow}>
            <Text style={[styles.progressTitle, { color: colors.foreground }]}>Deal Progress</Text>
            <View style={[styles.phaseBadge, { backgroundColor: phaseColors[currentPhase] + '20' }]}>
              <Text style={[styles.phaseBadgeText, { color: phaseColors[currentPhase] }]}>{phaseLabels[currentPhase]}</Text>
            </View>
          </View>
          <Text style={[styles.progressPercent, { color: isComplete ? '#22C55E' : staticColors.primary }]}>{config.label}</Text>
        </View>

        {/* Horizontal Milestone Tracker */}
        <ScrollView
          ref={milestoneScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.milestoneScroll}
          contentContainerStyle={styles.milestoneContent}
        >
          {milestones.map((milestone, index) => {
            const isStepComplete = index < currentMilestoneIndex;
            const isCurrent = index === currentMilestoneIndex;
            const isFuture = index > currentMilestoneIndex;
            const isPhaseStart = index === 0 || milestones[index - 1].phase !== milestone.phase;
            const timestamp = getMilestoneTimestamp(deal, milestone.status, currentMilestoneIndex, index);

            return (
              <View
                key={milestone.status}
                style={styles.milestoneItem}
              >
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
                      (isStepComplete || isCurrent) && styles.milestoneLineComplete
                    ]} />
                  )}
                  <View
                    style={[
                      styles.milestoneCircle,
                      (isStepComplete || isCurrent) && styles.milestoneCircleComplete,
                      isCurrent && styles.milestoneCircleCurrent,
                    ]}
                  >
                    <Ionicons
                      name={milestone.icon}
                      size={isCurrent ? 14 : 12}
                      color={(isStepComplete || isCurrent) ? '#0F1E2E' : '#9CA3AF'}
                    />
                  </View>
                  {index < milestones.length - 1 && (
                    <View style={[
                      styles.milestoneLine,
                      isStepComplete && styles.milestoneLineComplete
                    ]} />
                  )}
                </View>

                {/* Label */}
                <Text style={[
                  styles.milestoneLabel,
                  { color: isDark ? '#FFFFFF' : '#374151' },
                  isCurrent && styles.milestoneLabelCurrent,
                  isFuture && [styles.milestoneLabelFuture, { color: isDark ? '#9CA3AF' : '#9CA3AF' }],
                ]} numberOfLines={2}>
                  {milestone.label}
                </Text>

                {/* Timestamp */}
                {timestamp ? (
                  <Text style={[
                    styles.milestoneTimestamp,
                    { color: isDark ? '#9CA3AF' : '#6B7280' },
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
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: isComplete ? '#22C55E' : staticColors.primary }]} />
          </View>
        </View>
      </View>

      <View style={[styles.quickActionsRow, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleCall} style={[styles.quickActionBtnSmall, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}><Ionicons name="call" size={18} color="#3B82F6" /></TouchableOpacity>
        <TouchableOpacity onPress={handleEmail} style={[styles.quickActionBtnSmall, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}><Ionicons name="mail" size={18} color="#8B5CF6" /></TouchableOpacity>
        <TouchableOpacity onPress={handleDirections} style={[styles.quickActionBtnSmall, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}><Ionicons name="navigate" size={18} color="#22C55E" /></TouchableOpacity>
        {nextAction && !isComplete && (
          <TouchableOpacity
            style={[styles.nextActionBtnSmall, nextAction.isInvoice && { backgroundColor: '#3B82F6' }]}
            onPress={() => {
              if (nextAction.needsDate && !installDate) { setShowInstallDateModal(true); return; }
              if (nextAction.isInvoice) {
                // Generate and send invoice
                Alert.alert(
                  'Generate Invoice',
                  'This will generate an invoice PDF and advance the deal to "RCV Sent" status.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Generate', onPress: handleGenerateInvoice }
                  ]
                );
                return;
              }
              if (nextAction.status === 'installed') {
                Alert.alert('Confirm', 'Mark installation complete?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => handleStatusChange('installed') }]);
                return;
              }
              handleStatusChange(nextAction.status, installDate ? { install_date: installDate.toISOString().split('T')[0] } : undefined);
            }}
            disabled={updateMutation.isPending || generatingInvoice}
          >
            {(updateMutation.isPending || generatingInvoice) ? <ActivityIndicator size="small" color="#FFF" /> : <><Ionicons name={nextAction.icon} size={16} color="#FFF" /><Text style={styles.nextActionBtnSmallText}>{nextAction.label}</Text></>}
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tabContainer, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        {(['overview', 'financials', 'documents', 'commissions'] as TabType[]).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Ionicons name={tab === 'overview' ? 'home' : tab === 'financials' ? 'cash' : tab === 'documents' ? 'folder' : 'wallet'} size={16} color={activeTab === tab ? staticColors.primary : colors.mutedForeground} />
            <Text style={[styles.tabText, { color: colors.mutedForeground }, activeTab === tab && styles.tabTextActive]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.tabContent}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'financials' && renderFinancialsTab()}
          {activeTab === 'documents' && renderDocumentsTab()}
          {activeTab === 'commissions' && renderCommissionsTab()}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={showInstallDateModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => {
          if (!showDatePicker && !showTimePicker) {
            setShowInstallDateModal(false);
          }
        }}>
          <View style={[styles.installScheduleModalContent, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{deal.install_date ? 'Edit Installation Schedule' : 'Schedule Installation'}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Select installation date, time, and crew assignment</Text>

            {/* Date Field with Picker */}
            <View style={styles.installFieldGroup}>
              <Text style={[styles.installFieldLabel, { color: colors.foreground }]}>Installation Date *</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border }]}
                onPress={() => {
                  setShowTimePicker(false);
                  setShowDatePicker(!showDatePicker);
                }}
              >
                <Ionicons name="calendar" size={20} color={staticColors.primary} />
                <Text style={[styles.datePickerButtonText, { color: colors.foreground }]}>
                  {format(installDate, 'EEEE, MMMM d, yyyy')}
                </Text>
                <Ionicons name={showDatePicker ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showDatePicker && (
                <View style={[styles.inlinePicker, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                  <DateTimePicker
                    value={installDate}
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setInstallDate(selectedDate);
                      }
                    }}
                    minimumDate={new Date()}
                    style={{ height: 150 }}
                  />
                </View>
              )}
            </View>

            {/* Time Field with Picker */}
            <View style={styles.installFieldGroup}>
              <Text style={[styles.installFieldLabel, { color: colors.foreground }]}>Installation Time</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border }]}
                onPress={() => {
                  setShowDatePicker(false);
                  setShowTimePicker(!showTimePicker);
                }}
              >
                <Ionicons name="time" size={20} color={staticColors.primary} />
                <Text style={[styles.datePickerButtonText, { color: colors.foreground }]}>
                  {format(installTime, 'h:mm a')}
                </Text>
                <Ionicons name={showTimePicker ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showTimePicker && (
                <View style={[styles.inlinePicker, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                  <DateTimePicker
                    value={installTime}
                    mode="time"
                    display="spinner"
                    onChange={(event, selectedTime) => {
                      if (selectedTime) {
                        setInstallTime(selectedTime);
                      }
                    }}
                    style={{ height: 150 }}
                  />
                </View>
              )}
            </View>

            {/* Crew Field */}
            <View style={styles.installFieldGroup}>
              <Text style={[styles.installFieldLabel, { color: colors.foreground }]}>Crew Assignment</Text>
              <TouchableOpacity
                style={[styles.dateInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setShowCrewDropdown(!showCrewDropdown)}
              >
                <Text style={{ color: crewAssignment ? colors.foreground : colors.mutedForeground }}>
                  {crewAssignment || 'Select Crew Lead'}
                </Text>
                <Ionicons name={showCrewDropdown ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              {showCrewDropdown && (
                <View style={[styles.dropdownContainer, { backgroundColor: isDark ? colors.secondary : '#FFFFFF', borderColor: colors.border }]}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {/* Option to clear selection */}
                    <TouchableOpacity
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setCrewAssignment('');
                        setShowCrewDropdown(false);
                      }}
                    >
                      <Text style={{ color: colors.mutedForeground, fontStyle: 'italic' }}>None (Unassigned)</Text>
                    </TouchableOpacity>

                    {crewLeads && crewLeads.length > 0 ? (
                      crewLeads.map((crew) => (
                        <TouchableOpacity
                          key={crew.id}
                          style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                          onPress={() => {
                            setCrewAssignment(crew.full_name || crew.email);
                            setShowCrewDropdown(false);
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={[styles.crewAvatar, { backgroundColor: staticColors.primary }]}>
                              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>
                                {(crew.full_name || crew.email || '?').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <Text style={{ color: colors.foreground, fontWeight: '500' }}>{crew.full_name || 'Unnamed Crew'}</Text>
                              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{crew.email}</Text>
                            </View>
                          </View>
                          {crewAssignment === (crew.full_name || crew.email) && (
                            <Ionicons name="checkmark" size={18} color={staticColors.primary} />
                          )}
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={{ padding: 16, alignItems: 'center' }}>
                        <Text style={{ color: colors.mutedForeground }}>No crew leads available</Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>Create crew lead accounts in Reps</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]} onPress={() => {
                setShowDatePicker(false);
                setShowTimePicker(false);
                setShowInstallDateModal(false);
              }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  // Format date and time for saving
                  const formattedDate = format(installDate, 'yyyy-MM-dd');
                  const formattedTime = format(installTime, 'h:mm a');

                  // Save install details and move status to install_scheduled
                  const updates: any = {
                    install_date: formattedDate,
                    install_time: formattedTime,
                    crew_assignment: crewAssignment || null,
                  };
                  // If current status is materials_selected (Ready for Install), advance to install_scheduled
                  if (deal.status === 'materials_selected') {
                    updates.status = 'install_scheduled';
                  }
                  updateMutation.mutate(updates);
                  setShowDatePicker(false);
                  setShowTimePicker(false);
                  setShowInstallDateModal(false);
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {deal.status === 'materials_selected' ? 'Save & Schedule' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showStatusModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowStatusModal(false)}>
          <View style={[styles.statusModalContent, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Set Deal Status</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Select any status to fix workflow issues</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {milestones.map((milestone, index) => {
                const cfg = statusConfig[milestone.status] || { label: milestone.label, color: '#6B7280' };
                const isCurrent = deal.status === milestone.status;
                const isPast = index < currentMilestoneIndex;
                const isNextStep = index === currentMilestoneIndex + 1;

                return (
                  <TouchableOpacity
                    key={milestone.status}
                    style={[
                      styles.statusOption,
                      { borderBottomColor: isDark ? colors.border : '#F3F4F6' },
                      isCurrent && styles.statusOptionActive,
                    ]}
                    onPress={() => {
                      if (isCurrent) return;
                      if (isPast) {
                        // Going backward - show confirmation
                        Alert.alert(
                          'Move Status Backward?',
                          `This will move the deal back to "${cfg.label}". Are you sure?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Confirm', style: 'destructive', onPress: () => handleStatusChange(milestone.status) }
                          ]
                        );
                      } else {
                        // Going forward
                        handleStatusChange(milestone.status);
                      }
                    }}
                    disabled={isCurrent}
                  >
                    <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                    <Text style={[
                      styles.statusOptionText,
                      { color: colors.foreground },
                      isCurrent && styles.statusOptionTextActive,
                    ]}>
                      {cfg.label}
                    </Text>
                    {isCurrent && <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>Current</Text></View>}
                    {isPast && <Ionicons name="checkmark-circle" size={18} color="#22C55E" />}
                    {isNextStep && <View style={styles.nextBadge}><Text style={styles.nextBadgeText}>Next</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal visible={showImageViewer} transparent animationType="fade">
        <View style={styles.imageViewerContainer}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerCounter}>{currentImageIndex + 1} / {viewingImages.length}</Text>
            <TouchableOpacity onPress={() => setShowImageViewer(false)} style={styles.imageViewerCloseBtn}>
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

      {/* Approval Modal */}
      <Modal visible={showApprovalModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowApprovalModal(false)}>
          <View style={[styles.approvalModalContent, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Approve Financial Details</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Select approval type. This will lock the financial values below.</Text>

            <View style={[styles.financialPreview, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border }]}>
              <View style={styles.financialPreviewRow}>
                <Text style={[styles.financialPreviewLabel, { color: colors.mutedForeground }]}>RCV</Text>
                <Text style={[styles.financialPreviewValue, { color: colors.foreground }]}>${(parseFloat(financialForm.rcv) || 0).toLocaleString()}</Text>
              </View>
              <View style={styles.financialPreviewRow}>
                <Text style={[styles.financialPreviewLabel, { color: colors.mutedForeground }]}>ACV</Text>
                <Text style={[styles.financialPreviewValue, { color: colors.foreground }]}>${(parseFloat(financialForm.acv) || 0).toLocaleString()}</Text>
              </View>
              <View style={styles.financialPreviewRow}>
                <Text style={[styles.financialPreviewLabel, { color: colors.mutedForeground }]}>Deductible</Text>
                <Text style={[styles.financialPreviewValue, { color: colors.foreground }]}>${(parseFloat(financialForm.deductible) || 0).toLocaleString()}</Text>
              </View>
              <View style={styles.financialPreviewRow}>
                <Text style={[styles.financialPreviewLabel, { color: colors.mutedForeground }]}>Depreciation</Text>
                <Text style={[styles.financialPreviewValue, { color: colors.foreground }]}>${(parseFloat(financialForm.depreciation) || 0).toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.approvalOptions}>
              {[
                { value: 'full', label: 'Full Approval', icon: 'checkmark-circle' as const },
                { value: 'partial', label: 'Partial Approval', icon: 'remove-circle' as const },
                { value: 'supplement_needed', label: 'Supplement Needed', icon: 'add-circle' as const },
                { value: 'sale', label: 'Sale (Homeowner Pays)', icon: 'cash' as const },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.approvalOption, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border }]}
                  onPress={() => {
                    // Save financial values and approve
                    updateMutation.mutate({
                      rcv: financialForm.rcv ? parseFloat(financialForm.rcv) : null,
                      acv: financialForm.acv ? parseFloat(financialForm.acv) : null,
                      deductible: financialForm.deductible ? parseFloat(financialForm.deductible) : null,
                      depreciation: financialForm.depreciation ? parseFloat(financialForm.depreciation) : null,
                      approval_type: option.value,
                      approved_date: new Date().toISOString(),
                      status: 'approved',
                    });
                    setShowApprovalModal(false);
                  }}
                >
                  <Ionicons name={option.icon} size={24} color={staticColors.primary} />
                  <Text style={[styles.approvalOptionText, { color: colors.foreground }]}>{option.label}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]} onPress={() => setShowApprovalModal(false)}>
              <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* HTML Viewer Modal for Agreement Documents */}
      <Modal visible={showHtmlViewer} animationType="slide">
        <SafeAreaView style={styles.htmlViewerContainer}>
          <View style={styles.htmlViewerHeader}>
            <TouchableOpacity onPress={() => setShowHtmlViewer(false)} style={styles.htmlViewerCloseBtn}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.htmlViewerTitle} numberOfLines={1}>{htmlViewerTitle}</Text>
            <View style={{ width: 40 }} />
          </View>
          <WebView
            source={{ html: htmlViewerContent }}
            style={{ flex: 1 }}
            originWhitelist={['*']}
            scalesPageToFit={true}
          />
        </SafeAreaView>
      </Modal>

      {/* Commission Edit Modal */}
      <Modal visible={showCommissionEditModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCommissionEditModal(false)}>
            <View style={[styles.approvalModalContent, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Commission</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Adjust the commission amount. A reason is required.</Text>

              <View style={{ marginTop: 16 }}>
                <Text style={[styles.installFieldLabel, { color: colors.foreground }]}>Commission Amount *</Text>
                <TextInput
                  style={[styles.financialInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground }]}
                  value={editedCommissionAmount}
                  onChangeText={setEditedCommissionAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={{ marginTop: 16 }}>
                <Text style={[styles.installFieldLabel, { color: colors.foreground }]}>Reason for Adjustment *</Text>
                <TextInput
                  style={[styles.financialInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground, minHeight: 80, textAlignVertical: 'top' }]}
                  value={commissionEditReason}
                  onChangeText={setCommissionEditReason}
                  placeholder="Enter reason for commission adjustment..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { flex: 1, backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}
                  onPress={() => setShowCommissionEditModal(false)}
                >
                  <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: staticColors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                  onPress={handleSaveCommissionEdit}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reassign Modal */}
      <Modal visible={showReassignModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReassignModal(false)}>
          <View style={[styles.reassignModalContent, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Reassign Deal</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Select a rep to reassign this deal to</Text>

            <ScrollView style={styles.repsList} showsVerticalScrollIndicator={false}>
              {reps?.filter(r => r.active).map((rep) => {
                const isCurrentRep = rep.id === dealRepId || rep.user_id === dealRepId;
                const isSelected = selectedRepId === rep.id;

                return (
                  <TouchableOpacity
                    key={rep.id}
                    style={[
                      styles.repOption,
                      { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border },
                      isSelected && styles.repOptionSelected,
                      isCurrentRep && styles.repOptionCurrent,
                    ]}
                    onPress={() => setSelectedRepId(rep.id)}
                    disabled={isCurrentRep}
                  >
                    <View style={styles.repOptionInfo}>
                      <Text style={[styles.repOptionName, { color: colors.foreground }, isCurrentRep && { color: colors.mutedForeground }]}>
                        {rep.full_name || rep.email || 'Unknown Rep'}
                      </Text>
                      <Text style={[styles.repOptionLevel, { color: colors.mutedForeground }]}>
                        {rep.commission_level?.charAt(0).toUpperCase() + rep.commission_level?.slice(1)} • {rep.default_commission_percent || commissionLevelPercentages[rep.commission_level] || 10}%
                      </Text>
                    </View>
                    {isCurrentRep ? (
                      <View style={[styles.currentRepBadge, { backgroundColor: isDark ? colors.border : '#E5E7EB' }]}>
                        <Text style={[styles.currentRepBadgeText, { color: colors.mutedForeground }]}>Current</Text>
                      </View>
                    ) : isSelected ? (
                      <Ionicons name="checkmark-circle" size={24} color={staticColors.primary} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={24} color="#D1D5DB" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.reassignModalFooter}>
              <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]} onPress={() => {
                setShowReassignModal(false);
                setSelectedRepId(null);
              }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reassignConfirmBtn, !selectedRepId && { opacity: 0.5 }]}
                onPress={() => {
                  if (!selectedRepId) return;
                  const selectedRep = reps?.find(r => r.id === selectedRepId);
                  if (!selectedRep) return;

                  updateMutation.mutate({
                    rep_id: selectedRep.user_id || selectedRep.id,
                    rep_name: selectedRep.full_name || selectedRep.email || 'Unknown',
                  });
                  setShowReassignModal(false);
                  setSelectedRepId(null);
                }}
                disabled={!selectedRepId}
              >
                <Ionicons name="swap-horizontal" size={18} color="#FFF" />
                <Text style={styles.reassignConfirmText}>Reassign Deal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: staticColors.primary, borderRadius: 8 },
  retryText: { color: '#FFF', fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, marginHorizontal: 12 },
  headerName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  headerAddress: { fontSize: 13, color: '#6B7280' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },

  // Milestone Progress Section
  progressSection: { backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  progressTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  phaseBadgeText: { fontSize: 12, fontWeight: '600' },
  progressPercent: { fontSize: 16, fontWeight: '700' },

  // Milestone Tracker
  milestoneScroll: { marginHorizontal: -16, marginTop: 16 },
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

  progressBarContainer: { marginTop: 16 },
  progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  quickActionsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFF', gap: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginTop: 12, justifyContent: 'center', alignItems: 'center' },
  quickActionBtnSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  nextActionBtnSmall: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, backgroundColor: staticColors.primary, borderRadius: 20, paddingHorizontal: 16 },
  nextActionBtnSmallText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  tabContainer: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: staticColors.primary },
  tabText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: staticColors.primary, fontWeight: '600' },

  scrollView: { flex: 1 },
  tabContent: { padding: 16 },

  sectionCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  subSectionTitle: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 12, marginBottom: 4 },

  infoGrid: { gap: 8 },
  infoItem: { marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  infoValueLarge: { fontSize: 16, color: '#111827', fontWeight: '600' },
  infoValueSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  infoValueMono: { fontSize: 14, color: '#111827', fontFamily: 'monospace' },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  contactText: { fontSize: 14, color: '#3B82F6' },

  propertyDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  propertyTag: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  propertyTagText: { fontSize: 12, color: '#374151', fontWeight: '500' },

  approvalBadge: { backgroundColor: '#22C55E20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  approvalBadgeText: { fontSize: 12, fontWeight: '600', color: '#16A34A' },

  adjusterSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  repName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  repDetailName: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  commissionLevelBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(201, 162, 77, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 12 },
  commissionLevelText: { fontSize: 12, fontWeight: '600', color: staticColors.primary },

  timeline: { gap: 8 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: staticColors.primary },
  timelineLabel: { flex: 1, fontSize: 14, color: '#374151' },
  timelineDate: { fontSize: 13, color: '#6B7280' },

  notesText: { fontSize: 14, color: '#374151', lineHeight: 20 },

  financialSummary: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginTop: 4 },

  totalCard: { backgroundColor: staticColors.primary + '15', borderRadius: 12, padding: 20, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: staticColors.primary + '30' },
  totalLabel: { fontSize: 14, color: '#6B7280' },
  totalValue: { fontSize: 28, fontWeight: 'bold', color: staticColors.primary, marginTop: 4 },

  paymentChecklist: { gap: 12 },
  paymentItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentItemContent: { flex: 1 },
  paymentItemLabel: { fontSize: 14, color: '#374151' },
  paymentItemStatus: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  signatureStatus: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#22C55E10', borderRadius: 8 },
  signedText: { fontSize: 14, fontWeight: '600', color: '#16A34A' },
  viewSignatureButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 10, backgroundColor: 'rgba(201, 162, 77, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)' },
  viewSignatureText: { fontSize: 13, fontWeight: '600', color: staticColors.primary },
  pendingStatus: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#F59E0B10', borderRadius: 8 },
  pendingText: { fontSize: 14, fontWeight: '500', color: '#92400E' },

  documentList: { gap: 8 },
  documentItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  documentItemWithAction: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 8 },
  documentItemMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  documentName: { flex: 1, fontSize: 14, color: '#374151' },
  documentNameMissing: { color: '#9CA3AF' },
  documentMissing: { fontSize: 12, color: '#9CA3AF' },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: staticColors.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  viewButtonText: { fontSize: 12, fontWeight: '600', color: staticColors.primary },
  uploadButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginTop: 8, alignSelf: 'flex-start' },
  uploadButtonText: { fontSize: 12, fontWeight: '600', color: staticColors.primary },

  // Photo Grid
  photoGrid: { flexDirection: 'row', gap: 12 },
  photoCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  photoIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  photoIconActive: { backgroundColor: staticColors.primary + '20' },
  photoCountNumber: { fontSize: 24, fontWeight: 'bold', color: staticColors.primary },
  photoCountLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  photoViewText: { fontSize: 10, color: staticColors.primary, marginTop: 4, fontWeight: '500' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  loadingText: { fontSize: 13, color: '#6B7280', marginTop: 8 },

  // Image Viewer
  imageViewerContainer: { flex: 1, backgroundColor: '#000' },
  imageViewerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
  imageViewerCounter: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  imageViewerCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  imageViewerSlide: { width: SCREEN_WIDTH, height: '100%', alignItems: 'center', justifyContent: 'center' },
  imageViewerImage: { width: SCREEN_WIDTH, height: '70%' },
  imageViewerNav: { position: 'absolute', bottom: 100, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  imageNavButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  photoCounts: { flexDirection: 'row', justifyContent: 'space-around' },
  photoCountItem: { alignItems: 'center' },

  commissionSummaryCard: { backgroundColor: staticColors.primary, borderRadius: 16, padding: 24, marginBottom: 16, alignItems: 'center' },
  commissionSummaryLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  commissionSummaryValue: { fontSize: 36, fontWeight: 'bold', color: '#FFF', marginTop: 4 },
  commissionSummaryPercent: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  paymentRequestCard: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F59E0B' },
  paymentRequestHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  paymentRequestTitle: { fontSize: 15, fontWeight: '600', color: '#92400E' },
  paymentRequestText: { fontSize: 13, color: '#78350F', marginBottom: 16 },
  approveCommissionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22C55E', paddingVertical: 14, borderRadius: 8 },
  approveCommissionText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  commissionBreakdown: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownLabel: { fontSize: 13, color: '#6B7280' },
  breakdownValue: { fontSize: 13, color: '#374151', fontWeight: '500' },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 8, paddingTop: 12 },
  breakdownLabelBold: { fontSize: 14, color: '#111827', fontWeight: '600' },
  breakdownValueBold: { fontSize: 16, color: '#22C55E', fontWeight: 'bold' },

  commissionStatus: { alignItems: 'center', padding: 24 },
  commissionStatusTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  statusModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  dateInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 8, backgroundColor: '#F3F4F6' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalConfirmBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 8, backgroundColor: staticColors.primary },
  modalConfirmText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  statusOptionActive: { backgroundColor: staticColors.primary + '10' },
  statusOptionDisabled: { opacity: 0.5 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusOptionText: { flex: 1, fontSize: 15, color: '#374151' },
  statusOptionTextActive: { color: staticColors.primary, fontWeight: '600' },
  statusOptionTextDisabled: { color: '#9CA3AF' },
  currentBadge: { backgroundColor: staticColors.primary + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  currentBadgeText: { fontSize: 11, fontWeight: '600', color: staticColors.primary },
  nextBadge: { backgroundColor: '#22C55E20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  nextBadgeText: { fontSize: 11, fontWeight: '600', color: '#22C55E' },

  // Milestone timestamps
  milestoneTimestamp: { fontSize: 8, color: '#6B7280', textAlign: 'center', marginTop: 2 },
  milestoneTimestampCurrent: { color: staticColors.primary, fontWeight: '500' },

  // Install date section
  installDateContainer: {},
  installDateDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  installDateInfo: { flex: 1 },
  installDateLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  installDateValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  editInstallDateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: staticColors.primary + '15', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  editInstallDateText: { fontSize: 13, fontWeight: '600', color: staticColors.primary },
  setInstallDateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: staticColors.primary, paddingVertical: 14, borderRadius: 10 },
  setInstallDateText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  installDateLocked: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#F3F4F6', borderRadius: 8 },
  installDateLockedText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // Approval Section Styles
  approvalStatusCard: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' },
  approvalStatusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approvalStatusTitle: { fontSize: 18, fontWeight: '700', color: '#22C55E' },
  approvalStatusSubtitle: { fontSize: 14, color: '#374151', marginTop: 4 },
  approvalStatusDate: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  lockedNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(34, 197, 94, 0.3)' },
  lockedNoticeText: { fontSize: 12, color: '#6B7280' },
  approvalDescription: { fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  approveFinancialsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22C55E', paddingVertical: 14, borderRadius: 10, marginTop: 12 },
  approveFinancialsText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // Editable Financial Fields
  financialEditGrid: { gap: 12, marginBottom: 16 },
  financialEditRow: { flexDirection: 'row', gap: 12 },
  financialEditField: { flex: 1 },
  financialEditLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  financialEditInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827' },
  saveFinancialsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(201, 162, 77, 0.1)', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)' },
  saveFinancialsText: { fontSize: 14, fontWeight: '600', color: staticColors.primary },

  // Approval Modal Styles
  approvalModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  financialPreview: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 16, marginVertical: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  financialPreviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  financialPreviewLabel: { fontSize: 14, color: '#6B7280' },
  financialPreviewValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  approvalOptions: { gap: 8, marginBottom: 16 },
  approvalOption: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  approvalOptionText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#374151' },

  // HTML Viewer Modal
  htmlViewerContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  htmlViewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  htmlViewerCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  htmlViewerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827', textAlign: 'center' },

  // Rep Row with Reassign
  repRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  repInfo: { flex: 1 },
  repLevelBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(201, 162, 77, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  repLevelText: { fontSize: 11, fontWeight: '600', color: staticColors.primary },
  reassignButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(201, 162, 77, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)' },
  reassignButtonText: { fontSize: 13, fontWeight: '600', color: staticColors.primary },

  // Reassign Modal
  reassignModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '70%' },
  repsList: { marginVertical: 16 },
  repOption: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  repOptionSelected: { backgroundColor: 'rgba(201, 162, 77, 0.1)', borderColor: staticColors.primary },
  repOptionCurrent: { opacity: 0.5 },
  repOptionInfo: { flex: 1 },
  repOptionName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  repOptionLevel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  currentRepBadge: { backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  currentRepBadgeText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  reassignModalFooter: { flexDirection: 'row', gap: 12 },
  reassignConfirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: staticColors.primary, paddingVertical: 14, borderRadius: 10 },
  reassignConfirmText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // Material Specifications
  materialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  materialItem: { width: '47%', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8 },
  materialLabel: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  materialValue: { fontSize: 14, fontWeight: '600', color: '#111827' },

  // Install Schedule Modal
  installScheduleModalContent: { backgroundColor: '#FFF', borderRadius: 16, margin: 20, padding: 20, maxHeight: '90%' },
  installFieldGroup: { marginBottom: 12 },
  installFieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  installDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  installDetailLabel: { fontSize: 13, color: '#6B7280' },
  installDetailValue: { fontSize: 14, fontWeight: '500', color: '#111827' },

  // Date/Time Picker Styles
  datePickerButton: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14 },
  datePickerButtonText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' },
  inlinePicker: { marginTop: 8, backgroundColor: '#F9FAFB', borderRadius: 10, overflow: 'hidden' },
  pickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  pickerTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
  pickerDoneText: { fontSize: 16, fontWeight: '600', color: staticColors.primary },


  // Commission Paid Card
  commissionPaidCard: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#6EE7B7' },
  commissionPaidHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  commissionPaidTitle: { fontSize: 18, fontWeight: '700', color: '#059669' },
  commissionPaidText: { fontSize: 14, color: '#047857', lineHeight: 20 },

  // View Lost Statement Button
  viewLostStatementBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, marginBottom: 16 },
  viewLostStatementBtnText: { fontSize: 15, fontWeight: '600' },

  // Crew Dropdown Styles
  dropdownContainer: { marginTop: 4, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  crewAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
