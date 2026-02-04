import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, StyleSheet, TextInput, Modal, Image, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { dealsApi, Deal, uploadFile, getSignedFileUrl, repsApi } from '../../../src/services/api';
import { colors } from '../../../src/constants/config';
import { InspectionReport } from '../../../src/components/InspectionReport';
import { PaymentReceipt, ReceiptType } from '../../../src/components/PaymentReceipt';
import { useAuth } from '../../../src/contexts/AuthContext';

// Image thumbnail component that fetches signed URL and displays the actual image
function ImageThumbnail({ imageKey, size = 56 }: { imageKey: string; size?: number }) {
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

// Milestone configuration matching web app
const milestones = [
  { status: 'lead', label: 'Lead', icon: 'person', phase: 'sign' },
  { status: 'inspection_scheduled', label: 'Inspection', icon: 'search', phase: 'sign' },
  { status: 'claim_filed', label: 'Claim Filed', icon: 'document-text', phase: 'sign' },
  { status: 'signed', label: 'Signed', icon: 'create', phase: 'sign' },
  { status: 'adjuster_met', label: 'Awaiting Appr.', icon: 'time', phase: 'sign' },
  { status: 'approved', label: 'Approved', icon: 'checkmark-circle', phase: 'sign' },
  { status: 'collect_acv', label: 'Collect ACV', icon: 'cash', phase: 'build' },
  { status: 'collect_deductible', label: 'Collect Ded.', icon: 'cash', phase: 'build' },
  { status: 'install_scheduled', label: 'Install Sched.', icon: 'calendar', phase: 'build' },
  { status: 'installed', label: 'Installed', icon: 'home', phase: 'build' },
  { status: 'invoice_sent', label: 'Invoice Sent', icon: 'send', phase: 'finalizing' },
  { status: 'depreciation_collected', label: 'Depreciation', icon: 'cash', phase: 'finalizing' },
  { status: 'complete', label: 'Complete', icon: 'trophy', phase: 'complete' },
];

const statusConfig: Record<string, { label: string; color: string; description: string; nextAction: string }> = {
  lead: { label: 'Lead', color: '#4A6FA5', description: 'Initial contact, inspection not yet scheduled', nextAction: 'Schedule Inspection' },
  inspection_scheduled: { label: 'Inspection', color: '#5C6BC0', description: 'Inspection appointment set', nextAction: 'Complete Inspection' },
  claim_filed: { label: 'Claim Filed', color: '#7E57C2', description: 'Claim filed with insurance', nextAction: 'Get Signature' },
  signed: { label: 'Signed', color: '#66BB6A', description: 'Agreement signed', nextAction: 'Meet Adjuster' },
  adjuster_met: { label: 'Awaiting Approval', color: '#EC407A', description: 'Waiting for insurance approval', nextAction: 'Mark Approved' },
  approved: { label: 'Approved', color: '#26A69A', description: 'Insurance approved claim', nextAction: 'Collect ACV' },
  collect_acv: { label: 'Collect ACV', color: '#FFA726', description: 'Collect ACV check', nextAction: 'Collect Deductible' },
  collect_deductible: { label: 'Collect Deductible', color: '#FF7043', description: 'Collect deductible from homeowner', nextAction: 'Schedule Install' },
  install_scheduled: { label: 'Install Scheduled', color: '#8D6E63', description: 'Installation date is set', nextAction: 'Mark Installed' },
  installed: { label: 'Installed', color: '#78909C', description: 'Construction completed', nextAction: 'Send Invoice' },
  invoice_sent: { label: 'Invoice Sent', color: '#5C6BC0', description: 'Invoice sent to insurance', nextAction: 'Collect Depreciation' },
  depreciation_collected: { label: 'Depreciation Collected', color: '#26A69A', description: 'Depreciation check collected', nextAction: 'Complete Job' },
  complete: { label: 'Complete', color: '#2E7D32', description: 'Job complete! 🎉', nextAction: '' },
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

type TabType = 'overview' | 'insurance' | 'docs';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const milestoneScrollRef = useRef<ScrollView>(null);
  const { user } = useAuth();

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
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewingImages, setViewingImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [showInspectionReport, setShowInspectionReport] = useState(false);
  const [showPaymentReceipt, setShowPaymentReceipt] = useState(false);
  const [receiptType, setReceiptType] = useState<ReceiptType>('acv');

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
      return d;
    },
    enabled: !!id,
    staleTime: 30000, // 30 seconds
    refetchOnMount: 'always',
  });

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
    setShowStatusPicker(false);
    updateMutation.mutate({ status: newStatus });
  };

  const handleAdvanceStatus = () => {
    if (!deal) return;
    const currentIndex = milestones.findIndex(m => m.status === deal.status);
    if (currentIndex < milestones.length - 1) {
      const nextStatus = milestones[currentIndex + 1].status;
      updateMutation.mutate({ status: nextStatus });
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
        // Store the key so we can get fresh signed URLs when viewing
        updateMutation.mutate({ [field]: [...currentImages, result.key] });
        Alert.alert('Success', 'Photo uploaded successfully');
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
  const handleUploadDocument = async (docType: 'permit' | 'lost_statement' | 'insurance_agreement') => {
    const fieldMap = {
      permit: 'permit_file_url',
      lost_statement: 'lost_statement_url',
      insurance_agreement: 'insurance_agreement_url',
    };

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
          // Store the key so we can get fresh signed URLs when viewing
          updateMutation.mutate({ [fieldMap[docType]]: uploadResult.key });
          Alert.alert('Success', 'Document uploaded successfully');
        } else {
          Alert.alert('Error', 'Failed to upload document');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploadingCategory(null);
    }
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

  // View document handler
  const handleViewDocument = async (url: string) => {
    const requestId = Math.random().toString(36).substring(7);

    if (!url) {
      console.log(`[handleViewDocument:${requestId}] No URL provided`);
      return;
    }

    console.log(`[handleViewDocument:${requestId}] Starting with URL:`, url);

    try {
      // getSignedFileUrl handles both raw keys and full URLs
      const signedUrl = await getSignedFileUrl(url);
      console.log(`[handleViewDocument:${requestId}] Got signedUrl:`, signedUrl ? `yes (${typeof signedUrl}, length: ${signedUrl.length})` : `no (${signedUrl})`);

      if (signedUrl) {
        console.log(`[handleViewDocument:${requestId}] Opening URL in browser...`);
        const canOpen = await Linking.canOpenURL(signedUrl);
        console.log(`[handleViewDocument:${requestId}] Can open URL:`, canOpen);
        if (canOpen) {
          await Linking.openURL(signedUrl);
        } else {
          Alert.alert('Error', 'Cannot open this URL');
        }
      } else {
        Alert.alert('Error', 'Could not get signed URL. Please try again.');
      }
    } catch (error) {
      console.error(`[handleViewDocument:${requestId}] Error:`, error);
      Alert.alert('Error', 'Could not open document. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !deal) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Deal not found</Text>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerName} numberOfLines={1}>{deal.homeowner_name}</Text>
          <Text style={styles.headerAddress} numberOfLines={1}>{deal.address}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowStatusPicker(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Deal Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressTitleRow}>
              <Text style={styles.progressTitle}>Deal Progress</Text>
              <View style={[styles.phaseBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.phaseBadgeText}>{config.label}</Text>
              </View>
            </View>
            <Text style={[styles.progressPercent, { color: colors.primary }]}>{progressPercent}%</Text>
          </View>

          <Text style={styles.progressDescription}>{config.description}</Text>

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
                        (isComplete || isCurrent) && styles.milestoneLineComplete
                      ]} />
                    )}
                    <TouchableOpacity
                      style={[
                        styles.milestoneCircle,
                        (isComplete || isCurrent) && styles.milestoneCircleComplete,
                        isCurrent && styles.milestoneCircleCurrent,
                      ]}
                      onPress={() => handleStatusChange(milestone.status)}
                    >
                      <Ionicons
                        name={milestone.icon as any}
                        size={isCurrent ? 14 : 12}
                        color={(isComplete || isCurrent) ? '#0F1E2E' : '#9CA3AF'}
                      />
                    </TouchableOpacity>
                    {index < milestones.length - 1 && (
                      <View style={[
                        styles.milestoneLine,
                        isComplete && styles.milestoneLineComplete
                      ]} />
                    )}
                  </View>

                  {/* Label */}
                  <Text style={[
                    styles.milestoneLabel,
                    isCurrent && styles.milestoneLabelCurrent,
                    isFuture && styles.milestoneLabelFuture,
                  ]} numberOfLines={2}>
                    {milestone.label}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        </View>

        {/* Next Action Card */}
        {config.nextAction && (
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
        )}

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
        <View style={styles.tabContainer}>
          {(['overview', 'insurance', 'docs'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'overview' ? 'Overview' : tab === 'insurance' ? 'Insurance' : 'Docs'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* Homeowner Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="person" size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>Homeowner</Text>
                </View>
                <TouchableOpacity onPress={() => setIsEditingOverview(!isEditingOverview)}>
                  <Ionicons name={isEditingOverview ? "close" : "pencil"} size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {isEditingOverview ? (
                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={overviewForm.homeowner_name}
                      onChangeText={(v) => setOverviewForm({ ...overviewForm, homeowner_name: v })}
                      placeholder="Name"
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Phone</Text>
                      <TextInput
                        style={styles.input}
                        value={overviewForm.homeowner_phone}
                        onChangeText={(v) => setOverviewForm({ ...overviewForm, homeowner_phone: v })}
                        placeholder="Phone"
                        keyboardType="phone-pad"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Email</Text>
                      <TextInput
                        style={styles.input}
                        value={overviewForm.homeowner_email}
                        onChangeText={(v) => setOverviewForm({ ...overviewForm, homeowner_email: v })}
                        placeholder="Email"
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
                    <Text style={styles.infoLabel}>Name</Text>
                    <Text style={styles.infoValue}>{deal.homeowner_name || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{deal.homeowner_phone || '-'}</Text>
                  </View>
                  <View style={styles.infoItemFull}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{deal.homeowner_email || '-'}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Property Card */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="home" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Property</Text>
              </View>
              <View style={styles.infoGrid}>
                <View style={styles.infoItemFull}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>
                    {deal.address}{deal.city && `, ${deal.city}`}{deal.state && `, ${deal.state}`}{deal.zip_code && ` ${deal.zip_code}`}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Roof Type</Text>
                  <Text style={styles.infoValue}>{deal.roof_type || '-'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Squares</Text>
                  <Text style={styles.infoValue}>{deal.roof_squares || '-'}</Text>
                </View>
              </View>
            </View>

            {/* Notes Card */}
            {deal.notes && (
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>Notes</Text>
                </View>
                <Text style={styles.notesText}>{deal.notes}</Text>
              </View>
            )}

            {/* Timeline Card */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="time" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Timeline</Text>
              </View>
              <View style={styles.timelineList}>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <Text style={styles.timelineLabel}>Created</Text>
                  <Text style={styles.timelineDate}>{format(new Date(deal.created_at), 'MMM d, yyyy')}</Text>
                </View>
                {deal.inspection_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#5C6BC0' }]} />
                    <Text style={styles.timelineLabel}>Inspection</Text>
                    <Text style={styles.timelineDate}>{format(new Date(deal.inspection_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
                {deal.signed_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#66BB6A' }]} />
                    <Text style={styles.timelineLabel}>Contract Signed</Text>
                    <Text style={styles.timelineDate}>{format(new Date(deal.signed_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
                {deal.adjuster_meeting_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#EC407A' }]} />
                    <Text style={styles.timelineLabel}>Adjuster Meeting</Text>
                    <Text style={styles.timelineDate}>{format(new Date(deal.adjuster_meeting_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
                {deal.install_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={styles.timelineLabel}>Install Date</Text>
                    <Text style={styles.timelineDate}>{format(new Date(deal.install_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
                {deal.completion_date && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.timelineLabel}>Completed</Text>
                    <Text style={styles.timelineDate}>{format(new Date(deal.completion_date), 'MMM d, yyyy')}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {activeTab === 'insurance' && (
          <View style={styles.tabContent}>
            {/* Insurance Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="shield" size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>Insurance Details</Text>
                </View>
                <TouchableOpacity onPress={() => setIsEditingInsurance(!isEditingInsurance)}>
                  <Ionicons name={isEditingInsurance ? "close" : "pencil"} size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {isEditingInsurance ? (
                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Company</Text>
                    <TextInput
                      style={styles.input}
                      value={insuranceForm.insurance_company}
                      onChangeText={(v) => setInsuranceForm({ ...insuranceForm, insurance_company: v })}
                      placeholder="Insurance Company"
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Policy #</Text>
                      <TextInput
                        style={styles.input}
                        value={insuranceForm.policy_number}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, policy_number: v })}
                        placeholder="Policy Number"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Claim #</Text>
                      <TextInput
                        style={styles.input}
                        value={insuranceForm.claim_number}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, claim_number: v })}
                        placeholder="Claim Number"
                      />
                    </View>
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>RCV</Text>
                      <TextInput
                        style={styles.input}
                        value={insuranceForm.rcv}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, rcv: v })}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>ACV</Text>
                      <TextInput
                        style={styles.input}
                        value={insuranceForm.acv}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, acv: v })}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Depreciation</Text>
                      <TextInput
                        style={styles.input}
                        value={insuranceForm.depreciation}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, depreciation: v })}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Deductible</Text>
                      <TextInput
                        style={styles.input}
                        value={insuranceForm.deductible}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, deductible: v })}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Adjuster Name</Text>
                      <TextInput
                        style={styles.input}
                        value={insuranceForm.adjuster_name}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, adjuster_name: v })}
                        placeholder="Adjuster Name"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Adjuster Phone</Text>
                      <TextInput
                        style={styles.input}
                        value={insuranceForm.adjuster_phone}
                        onChangeText={(v) => setInsuranceForm({ ...insuranceForm, adjuster_phone: v })}
                        placeholder="Phone"
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
                    <Text style={styles.infoLabel}>Company</Text>
                    <Text style={styles.infoValue}>{deal.insurance_company || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Policy #</Text>
                    <Text style={styles.infoValueMono}>{deal.policy_number || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Claim #</Text>
                    <Text style={styles.infoValueMono}>{deal.claim_number || '-'}</Text>
                  </View>
                  {deal.date_of_loss && (
                    <View style={styles.infoItemFull}>
                      <Text style={styles.infoLabel}>Date of Loss</Text>
                      <Text style={styles.infoValue}>{format(new Date(deal.date_of_loss), 'MMM d, yyyy')}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Insurance Details Card */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
                <Text style={styles.cardTitle}>Insurance Details</Text>
              </View>
              <View style={styles.financialGrid}>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>RCV (Total Claim)</Text>
                  <Text style={[styles.financialValue, { color: colors.primary }]}>
                    ${(Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>ACV</Text>
                  <Text style={styles.financialValue}>${Number(deal.acv || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>Depreciation</Text>
                  <Text style={[styles.financialValue, { color: '#F97316' }]}>
                    ${Number(deal.depreciation || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>Deductible</Text>
                  <Text style={[styles.financialValue, { color: '#EF4444' }]}>${Number(deal.deductible || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>

              {/* Formula Reminder */}
              <View style={styles.formulaReminder}>
                <Text style={styles.formulaReminderText}>ACV + Depreciation = RCV</Text>
                <Text style={styles.formulaReminderValues}>
                  ${Number(deal.acv || 0).toLocaleString()} + ${Number(deal.depreciation || 0).toLocaleString()} = ${(Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))).toLocaleString()}
                </Text>
              </View>

              {/* Checks Collection */}
              <View style={styles.checksSection}>
                <View style={styles.checkRow}>
                  <View style={styles.checkStatus}>
                    <Ionicons
                      name={deal.acv_check_collected ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={deal.acv_check_collected ? "#22C55E" : "#9CA3AF"}
                    />
                    <Text style={styles.checkLabel}>1st Check (ACV - Deductible)</Text>
                  </View>
                  <Text style={styles.checkAmount}>${(Number(deal.acv || 0) - Number(deal.deductible || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.checkRow}>
                  <View style={styles.checkStatus}>
                    <Ionicons
                      name={deal.depreciation_check_collected ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={deal.depreciation_check_collected ? "#22C55E" : "#9CA3AF"}
                    />
                    <Text style={styles.checkLabel}>2nd Check (Depreciation)</Text>
                  </View>
                  <Text style={[styles.checkAmount, { color: '#F97316' }]}>${Number(deal.depreciation || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>

              {/* Payment Summary */}
              <View style={styles.paymentSummary}>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Insurance Pays</Text>
                  <Text style={styles.paymentValue}>${((Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))) - Number(deal.deductible || 0)).toLocaleString()}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Homeowner Pays</Text>
                  <Text style={styles.paymentValue}>${Number(deal.deductible || 0).toLocaleString()}</Text>
                </View>
              </View>

              {/* Receipt Buttons */}
              <View style={styles.receiptButtonsContainer}>
                <Text style={styles.receiptButtonsTitle}>Generate Receipts</Text>
                <View style={styles.receiptButtons}>
                  <TouchableOpacity
                    style={styles.receiptButton}
                    onPress={() => { setReceiptType('acv'); setShowPaymentReceipt(true); }}
                  >
                    <Ionicons name="cash-outline" size={18} color={colors.primary} />
                    <Text style={styles.receiptButtonText}>ACV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.receiptButton}
                    onPress={() => { setReceiptType('deductible'); setShowPaymentReceipt(true); }}
                  >
                    <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                    <Text style={styles.receiptButtonText}>Deductible</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.receiptButton}
                    onPress={() => { setReceiptType('depreciation'); setShowPaymentReceipt(true); }}
                  >
                    <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
                    <Text style={styles.receiptButtonText}>Depreciation</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Commission Details Card */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="cash" size={18} color="#22C55E" />
                <Text style={styles.cardTitle}>Commission Details</Text>
              </View>

              {/* Commission Breakdown */}
              <View style={styles.commissionBreakdown}>
                <View style={styles.commissionRow}>
                  <Text style={styles.commissionLabel}>RCV (Total Claim)</Text>
                  <Text style={styles.commissionValue}>
                    ${(Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.commissionRow}>
                  <Text style={styles.commissionLabel}>Sales Tax (8.25%)</Text>
                  <Text style={[styles.commissionValue, { color: '#EF4444' }]}>
                    -${((Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))) * 0.0825).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.commissionDivider} />
                <View style={styles.commissionRow}>
                  <Text style={styles.commissionLabel}>Base Amount</Text>
                  <Text style={styles.commissionValue}>
                    ${((Number(deal.rcv) || (Number(deal.acv || 0) + Number(deal.depreciation || 0))) * 0.9175).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.commissionRow}>
                  <Text style={styles.commissionLabel}>
                    Commission Level {repCommissionLevelName ? `(${repCommissionLevelName})` : ''} @ {deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent}%
                  </Text>
                  <Text style={styles.commissionValue}>
                    ×{deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent}%
                  </Text>
                </View>
              </View>

              {/* Commission Formula */}
              <View style={styles.commissionFormula}>
                <Text style={styles.formulaText}>(RCV - Sales Tax) × Commission % = Commission</Text>
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
                    {deal.deal_commissions[0].paid ? 'Commission Paid' : 'Commission Pending'}
                  </Text>
                </View>
              )}
            </View>

            {/* Adjuster Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="person-circle" size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>Adjuster</Text>
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
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>{deal.adjuster_name || '-'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={[styles.infoValue, deal.adjuster_phone && { color: '#3B82F6' }]}>
                    {deal.adjuster_phone || '-'}
                  </Text>
                </View>
                {deal.adjuster_meeting_date && (
                  <View style={styles.infoItemFull}>
                    <Text style={styles.infoLabel}>Meeting Date</Text>
                    <Text style={styles.infoValue}>{format(new Date(deal.adjuster_meeting_date), 'MMM d, yyyy')}</Text>
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
              style={styles.generateReportCard}
              onPress={() => setShowInspectionReport(true)}
            >
              <View style={styles.generateReportIcon}>
                <Ionicons name="document-text" size={24} color="#FFF" />
              </View>
              <View style={styles.generateReportContent}>
                <Text style={styles.generateReportTitle}>Inspection Report</Text>
                <Text style={styles.generateReportSubtitle}>
                  Generate professional inspection report with photos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            </TouchableOpacity>

            {/* Contract */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="document-text" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Contract / Agreement</Text>
              </View>
              {deal.contract_signed ? (
                <View style={styles.docComplete}>
                  <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  <View style={styles.docCompleteText}>
                    <Text style={styles.docCompleteTitle}>Contract Signed</Text>
                    <Text style={styles.docCompleteDate}>
                      {deal.signed_date ? format(new Date(deal.signed_date), 'MMM d, yyyy') : 'Signed'}
                    </Text>
                  </View>
                </View>
              ) : currentIndex >= 2 ? (
                <TouchableOpacity style={styles.docAction}>
                  <Ionicons name="create" size={20} color={colors.primary} />
                  <Text style={styles.docActionText}>Sign Agreement</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.docLocked}>
                  <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
                  <Text style={styles.docLockedText}>Complete inspection first</Text>
                </View>
              )}
            </View>

            {/* Photos */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="camera" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Photos</Text>
                {loadingImages && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
              </View>

              {/* Inspection Photos */}
              <View style={styles.docSection}>
                <View style={styles.docSectionHeader}>
                  <Text style={styles.docSectionTitle}>Inspection Photos</Text>
                  <Text style={styles.docSectionCount}>{deal.inspection_images?.length || 0}</Text>
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
                  style={styles.uploadButton}
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
              <View style={styles.docSection}>
                <View style={styles.docSectionHeader}>
                  <Text style={styles.docSectionTitle}>Install Photos</Text>
                  <Text style={styles.docSectionCount}>{deal.install_images?.length || 0}</Text>
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
                    style={styles.uploadButton}
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
                  <View style={styles.docLocked}>
                    <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                    <Text style={styles.docLockedText}>Available after install scheduled</Text>
                  </View>
                )}
              </View>

              {/* Completion Photos */}
              <View style={styles.docSection}>
                <View style={styles.docSectionHeader}>
                  <Text style={styles.docSectionTitle}>Completion Photos</Text>
                  <Text style={styles.docSectionCount}>{deal.completion_images?.length || 0}</Text>
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
                    style={styles.uploadButton}
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
                  <View style={styles.docLocked}>
                    <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                    <Text style={styles.docLockedText}>Available after installation</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Documents */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="folder" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Documents</Text>
              </View>

              {/* Permit */}
              <View style={styles.docSection}>
                <View style={styles.docSectionHeader}>
                  <Text style={styles.docSectionTitle}>Permit</Text>
                  {deal.permit_file_url && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                </View>
                {deal.permit_file_url ? (
                  <TouchableOpacity
                    style={styles.viewDocButton}
                    onPress={() => handleViewDocument(deal.permit_file_url!)}
                  >
                    <Ionicons name="eye" size={18} color={colors.primary} />
                    <Text style={styles.viewDocText}>View Document</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadButton}
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
              <View style={styles.docSection}>
                <View style={styles.docSectionHeader}>
                  <Text style={styles.docSectionTitle}>Lost Statement</Text>
                  {deal.lost_statement_url && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                </View>
                {deal.lost_statement_url ? (
                  <TouchableOpacity
                    style={styles.viewDocButton}
                    onPress={() => handleViewDocument(deal.lost_statement_url!)}
                  >
                    <Ionicons name="eye" size={18} color={colors.primary} />
                    <Text style={styles.viewDocText}>View Document</Text>
                  </TouchableOpacity>
                ) : currentIndex >= 3 ? (
                  <TouchableOpacity
                    style={styles.uploadButton}
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
                  <View style={styles.docLocked}>
                    <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                    <Text style={styles.docLockedText}>Available after signing</Text>
                  </View>
                )}
              </View>

              {/* Insurance Agreement */}
              <View style={styles.docSection}>
                <View style={styles.docSectionHeader}>
                  <Text style={styles.docSectionTitle}>Insurance Agreement</Text>
                  {deal.insurance_agreement_url && <Ionicons name="checkmark-circle" size={16} color="#22C55E" />}
                </View>
                {deal.insurance_agreement_url ? (
                  <TouchableOpacity
                    style={styles.viewDocButton}
                    onPress={() => handleViewDocument(deal.insurance_agreement_url!)}
                  >
                    <Ionicons name="eye" size={18} color={colors.primary} />
                    <Text style={styles.viewDocText}>View Document</Text>
                  </TouchableOpacity>
                ) : currentIndex >= 2 ? (
                  <TouchableOpacity
                    style={styles.uploadButton}
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
                  <View style={styles.docLocked}>
                    <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
                    <Text style={styles.docLockedText}>Available after inspection</Text>
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
          />
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
  backButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 8 },
  backButtonText: { color: '#FFF', fontWeight: '600' },

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
  milestoneLineComplete: { backgroundColor: colors.primary },
  milestoneCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D1D5DB' },
  milestoneCircleComplete: { backgroundColor: colors.primary, borderColor: colors.primary },
  milestoneCircleCurrent: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: 'rgba(201, 162, 77, 0.4)' },
  milestoneLabel: { fontSize: 9, color: '#374151', textAlign: 'center', marginTop: 6, lineHeight: 12 },
  milestoneLabelCurrent: { fontWeight: '600', color: colors.primary },
  milestoneLabelFuture: { color: '#9CA3AF' },

  progressBarContainer: { marginTop: 16 },
  progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },

  // Next Action Card
  nextActionCard: { backgroundColor: 'rgba(201, 162, 77, 0.1)', marginHorizontal: 16, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)' },
  nextActionContent: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  nextActionText: { flex: 1 },
  nextActionLabel: { fontSize: 11, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  nextActionValue: { fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 2 },

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

  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 8, marginTop: 8 },
  saveButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  notesText: { fontSize: 14, color: '#374151', lineHeight: 20 },

  timelineList: { gap: 12 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
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
  receiptButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: 'rgba(201, 162, 77, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(201, 162, 77, 0.3)' },
  receiptButtonText: { fontSize: 12, fontWeight: '600', color: colors.primary },

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
  generateReportIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
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
  docActionText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  docLocked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 10 },
  docLockedText: { fontSize: 13, color: '#9CA3AF' },

  docSection: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  docSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  docSectionTitle: { fontSize: 14, fontWeight: '500', color: '#374151' },
  docSectionCount: { fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },

  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, borderStyle: 'dashed' },
  uploadButtonText: { fontSize: 14, fontWeight: '500', color: colors.primary },

  viewDocButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: 'rgba(201, 162, 77, 0.1)', borderRadius: 8 },
  viewDocText: { fontSize: 13, fontWeight: '500', color: colors.primary },

  // Image Preview
  imagePreviewRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  imageThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  imageThumbImage: { width: 56, height: 56, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  imageThumbMore: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'rgba(201, 162, 77, 0.2)', alignItems: 'center', justifyContent: 'center' },
  imageThumbMoreText: { fontSize: 14, fontWeight: '600', color: colors.primary },

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
});
