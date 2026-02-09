import { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Image, Linking, Modal, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import SignatureCanvas from 'react-native-signature-canvas';
import { dealsApi, Deal, uploadFile, getSignedFileUrl } from '../../../src/services/api';
import { colors as staticColors } from '../../../src/constants/config';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useAuth } from '../../../src/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Image thumbnail component
function ImageThumbnail({ imageKey, size = 80 }: { imageKey: string; size?: number }) {
  const { colors } = useTheme();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    getSignedFileUrl(imageKey).then(url => {
      setImageUrl(url);
      setLoading(false);
    });
  });

  if (loading) {
    return (
      <View style={[styles.imageThumbnail, { width: size, height: size, backgroundColor: colors.muted }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl || undefined }}
      style={[styles.imageThumbnail, { width: size, height: size }]}
      resizeMode="cover"
    />
  );
}

export default function CrewJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [savingCompletion, setSavingCompletion] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signatureRef = useRef<any>(null);
  const completionFormSignatureRef = useRef<any>(null);

  // Completion form state - matching rep deal form
  const [completionFormStep, setCompletionFormStep] = useState(0); // 0=reading, 1=section1 initials, 2=section2 initials, 3=owner sig, 4=titan pro sig
  const [crewLeadName, setCrewLeadName] = useState('');
  const [walkThroughType, setWalkThroughType] = useState<'in_person' | 'virtual' | 'declined' | null>(null);
  const [individualsOwners, setIndividualsOwners] = useState('');
  const [individualsTitanPro, setIndividualsTitanPro] = useState('');
  const [individualsOthers, setIndividualsOthers] = useState('');
  const [section1Initials, setSection1Initials] = useState<string | null>(null);
  const [section2Initials, setSection2Initials] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState('');
  const [homeownerCompletionSignature, setHomeownerCompletionSignature] = useState<string | null>(null);
  const [repCompletionSignature, setRepCompletionSignature] = useState<string | null>(null);

  const { data: deal, isLoading, refetch } = useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      const response = await dealsApi.get(id);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    enabled: !!id,
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
    },
  });

  const handleTakePhotos = async () => {
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
      });

      if (!result.canceled && result.assets[0]) {
        photos.push(result.assets[0].uri);

        await new Promise<void>((resolve) => {
          Alert.alert(
            `${photos.length} Photo(s) Captured`,
            'Do you want to take another photo?',
            [
              { text: 'Take Another', onPress: () => resolve() },
              { text: 'Done', onPress: () => { keepTaking = false; resolve(); } },
            ],
            { cancelable: false }
          );
        });
      } else {
        keepTaking = false;
      }
    }

    if (photos.length > 0) {
      setUploadingPhotos(true);
      try {
        const uploadedKeys: string[] = [];
        for (const uri of photos) {
          const fileName = `install_photo_${Date.now()}.jpg`;
          const result = await uploadFile(uri, fileName, 'image/jpeg', 'install', id);
          if (result) {
            uploadedKeys.push(result.key);
          }
        }

        if (uploadedKeys.length > 0) {
          const currentImages = deal?.install_images || [];
          const newImages = [...currentImages, ...uploadedKeys];
          await updateMutation.mutateAsync({ install_images: newImages });
          Alert.alert('Success', `${uploadedKeys.length} photo(s) uploaded successfully`);
          refetch();
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to upload photos');
      } finally {
        setUploadingPhotos(false);
      }
    }
  };

  const handlePickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library permission is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 20,
    });

    if (!result.canceled && result.assets.length > 0) {
      setUploadingPhotos(true);
      try {
        const uploadedKeys: string[] = [];
        for (const asset of result.assets) {
          const fileName = `install_photo_${Date.now()}.jpg`;
          const uploadResult = await uploadFile(asset.uri, fileName, 'image/jpeg', 'install', id);
          if (uploadResult) {
            uploadedKeys.push(uploadResult.key);
          }
        }

        if (uploadedKeys.length > 0) {
          const currentImages = deal?.install_images || [];
          const newImages = [...currentImages, ...uploadedKeys];
          await updateMutation.mutateAsync({ install_images: newImages });
          Alert.alert('Success', `${uploadedKeys.length} photo(s) uploaded successfully`);
          refetch();
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to upload photos');
      } finally {
        setUploadingPhotos(false);
      }
    }
  };

  const handleSaveCompletionForm = async (titanProSig: string) => {
    if (!deal) return;
    setSavingCompletion(true);

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

      setShowCompletionForm(false);
      Alert.alert('Success', 'Completion form signed successfully!');
      refetch();
    } catch (error) {
      console.error('[Completion Form] Error saving:', error);
      Alert.alert('Error', 'Failed to save completion form: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSavingCompletion(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!deal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.foreground }}>Job not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasInstallPhotos = (deal.install_images?.length || 0) > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{deal.homeowner_name}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>{deal.address}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: deal.status === 'installed' ? '#FEF3C7' : '#DBEAFE' }]}>
          <Text style={[styles.statusBadgeText, { color: deal.status === 'installed' ? '#D97706' : '#1D4ED8' }]}>
            {deal.status === 'installed' ? 'Installed' : 'Scheduled'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Job Info Card */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Job Information</Text>

          <View style={styles.infoRow}>
            <Ionicons name="person" size={18} color={colors.mutedForeground} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Homeowner</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.homeowner_name}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location" size={18} color={colors.mutedForeground} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Address</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.address}</Text>
              {deal.city && <Text style={[styles.infoSubvalue, { color: colors.mutedForeground }]}>{deal.city}, {deal.state} {deal.zip_code}</Text>}
            </View>
            <TouchableOpacity
              onPress={() => {
                const address = `${deal.address}, ${deal.city || ''}, ${deal.state || ''} ${deal.zip_code || ''}`;
                const url = `maps://?daddr=${encodeURIComponent(address)}`;
                Linking.openURL(url);
              }}
              style={[styles.iconButton, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}
            >
              <Ionicons name="navigate" size={18} color="#22C55E" />
            </TouchableOpacity>
          </View>

          {deal.homeowner_phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call" size={18} color={colors.mutedForeground} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Phone</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{deal.homeowner_phone}</Text>
              </View>
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${deal.homeowner_phone}`)}
                style={[styles.iconButton, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}
              >
                <Ionicons name="call" size={18} color="#3B82F6" />
              </TouchableOpacity>
            </View>
          )}

          {deal.install_date && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={18} color={colors.mutedForeground} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Install Date</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {format(new Date(deal.install_date), 'EEEE, MMMM d, yyyy')}
                </Text>
              </View>
            </View>
          )}

          {deal.material_category && (
            <View style={styles.infoRow}>
              <Ionicons name="construct" size={18} color={colors.mutedForeground} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Materials</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {deal.material_category} {deal.material_color ? `- ${deal.material_color}` : ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Upload Photos Section */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Installation Photos</Text>
            {hasInstallPhotos && (
              <View style={[styles.countBadge, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '600' }}>{deal.install_images?.length} uploaded</Text>
              </View>
            )}
          </View>

          {/* Display existing photos */}
          {hasInstallPhotos && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {deal.install_images?.map((imageKey, idx) => (
                <ImageThumbnail key={idx} imageKey={imageKey} size={80} />
              ))}
            </ScrollView>
          )}

          <View style={styles.uploadActions}>
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: colors.primary }]}
              onPress={handleTakePhotos}
              disabled={uploadingPhotos}
            >
              {uploadingPhotos ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="camera" size={20} color="#FFF" />
                  <Text style={styles.uploadButtonText}>Take Photos</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderWidth: 1, borderColor: colors.border }]}
              onPress={handlePickFromLibrary}
              disabled={uploadingPhotos}
            >
              <Ionicons name="images" size={20} color={colors.foreground} />
              <Text style={[styles.uploadButtonText, { color: colors.foreground }]}>From Library</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Completion Form Section */}
        <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Completion Form</Text>

          {deal.completion_form_signature_url ? (
            <View style={[styles.completedBadge, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <Text style={{ color: '#22C55E', fontWeight: '600', marginLeft: 8 }}>Crew Signature Submitted</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.cardDescription, { color: colors.mutedForeground }]}>
                After completing the installation and uploading photos, sign the completion form to certify the work is done.
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: hasInstallPhotos ? colors.primary : colors.muted }]}
                onPress={() => setShowCompletionForm(true)}
                disabled={!hasInstallPhotos}
              >
                <Ionicons name="create" size={20} color={hasInstallPhotos ? '#FFF' : colors.mutedForeground} />
                <Text style={[styles.primaryButtonText, { color: hasInstallPhotos ? '#FFF' : colors.mutedForeground }]}>
                  Sign Completion Form
                </Text>
              </TouchableOpacity>

              {!hasInstallPhotos && (
                <Text style={[styles.warningText, { color: '#F59E0B' }]}>
                  ⚠ Upload installation photos before signing
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Completion Form Modal - FINAL COMPLETION & WALK-THROUGH RECORD */}
      <Modal visible={showCompletionForm} animationType="slide">
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => {
                setShowCompletionForm(false);
                setCompletionFormStep(0);
                setSection1Initials(null);
                setSection2Initials(null);
                setRepCompletionSignature(null);
                setHomeownerCompletionSignature(null);
              }}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Final Completion & Walk-Through</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Step indicator */}
          {completionFormStep > 0 && (
            <View style={styles.signatureStepIndicator}>
              <Text style={styles.signatureStepText}>Signature {completionFormStep} of 4</Text>
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
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {/* Company Header */}
              <View style={styles.agreementHeader}>
                <Text style={styles.agreementCompanyName}>TITAN PRIME SOLUTIONS</Text>
                <Text style={styles.agreementTagline}>FINAL COMPLETION & WALK-THROUGH RECORD</Text>
              </View>

              <Text style={[styles.agreementText, { fontStyle: 'italic', marginBottom: 16, color: colors.mutedForeground }]}>
                This record relates to and is incorporated into the Roofing Agreement between Owner and Titan Prime Solutions.
              </Text>

              {/* Project Info */}
              <View style={styles.contractField}>
                <Text style={[styles.contractFieldLabel, { color: colors.mutedForeground }]}>Project Address:</Text>
                <Text style={[styles.contractFieldValue, { color: colors.foreground }]}>
                  {deal.address || ''}
                  {deal.city ? `, ${deal.city}` : ''}
                  {deal.state ? `, ${deal.state}` : ''}
                  {deal.zip_code ? ` ${deal.zip_code}` : ''}
                </Text>
              </View>

              <View style={styles.contractField}>
                <Text style={[styles.contractFieldLabel, { color: colors.mutedForeground }]}>Crew Lead Name:</Text>
                <TextInput
                  style={[styles.workflowInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground, marginTop: 4 }]}
                  value={crewLeadName}
                  onChangeText={setCrewLeadName}
                  placeholder="Enter crew lead name"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.contractField}>
                <Text style={[styles.contractFieldLabel, { color: colors.mutedForeground }]}>Date of Review:</Text>
                <Text style={[styles.contractFieldValue, { color: colors.foreground }]}>{format(new Date(), 'MMMM d, yyyy')}</Text>
              </View>

              {/* Walk-Through Type */}
              <View style={[styles.agreementSection, { marginTop: 16 }]}>
                <Text style={[styles.contractFieldLabel, { color: colors.mutedForeground }]}>Walk-Through Conducted (select one):</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  {(['in_person', 'virtual', 'declined'] as const).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.categoryButton,
                        { flex: 1, backgroundColor: isDark ? colors.muted : '#F3F4F6', borderColor: colors.border },
                        walkThroughType === type && styles.categoryButtonActive
                      ]}
                      onPress={() => setWalkThroughType(type)}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        { color: colors.foreground },
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
                <Text style={[styles.agreementSectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>Individuals Present</Text>

                <View style={styles.contractField}>
                  <Text style={[styles.contractFieldLabel, { color: colors.mutedForeground }]}>Owner(s):</Text>
                  <TextInput
                    style={[styles.workflowInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground, marginTop: 4 }]}
                    value={individualsOwners || deal.homeowner_name || ''}
                    onChangeText={setIndividualsOwners}
                    placeholder="Owner name(s)"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={styles.contractField}>
                  <Text style={[styles.contractFieldLabel, { color: colors.mutedForeground }]}>Titan PRO Crew Lead / Representative:</Text>
                  <TextInput
                    style={[styles.workflowInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground, marginTop: 4 }]}
                    value={individualsTitanPro || deal.rep_name || ''}
                    onChangeText={setIndividualsTitanPro}
                    placeholder="Rep name"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={styles.contractField}>
                  <Text style={[styles.contractFieldLabel, { color: colors.mutedForeground }]}>Other(s):</Text>
                  <TextInput
                    style={[styles.workflowInput, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: colors.border, color: colors.foreground, marginTop: 4 }]}
                    value={individualsOthers}
                    onChangeText={setIndividualsOthers}
                    placeholder="Other individuals present (optional)"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>

              <View style={[styles.agreementDivider, { backgroundColor: colors.border }]} />

              {/* SECTION 1 */}
              <View style={styles.agreementSection}>
                <Text style={[styles.agreementSectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>SECTION 1 – WALK-THROUGH STATUS</Text>
                <Text style={[styles.agreementText, { color: colors.foreground }]}>
                  Owner acknowledges that a final walk-through of the roofing work was offered and either completed or declined at Owner's discretion. If declined, Owner accepts the condition of the work as observed at the time of completion.
                </Text>
                <Text style={[styles.agreementText, { marginTop: 8, color: colors.foreground }]}>
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

              <View style={[styles.agreementDivider, { backgroundColor: colors.border }]} />

              {/* SECTION 2 */}
              <View style={styles.agreementSection}>
                <Text style={[styles.agreementSectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>SECTION 2 – ITEMS REQUIRING REVIEW (IF ANY)</Text>
                <Text style={[styles.agreementText, { color: colors.foreground }]}>
                  If Owner believes any portion of the work is incomplete or requires attention, list below:
                </Text>

                <TextInput
                  style={[styles.workflowInput, {
                    backgroundColor: isDark ? colors.muted : '#F9FAFB',
                    borderColor: colors.border,
                    color: colors.foreground,
                    marginTop: 8,
                    minHeight: 100,
                    textAlignVertical: 'top',
                    paddingTop: 12
                  }]}
                  value={reviewItems}
                  onChangeText={setReviewItems}
                  placeholder="List any items requiring review (leave blank if none)"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={4}
                />

                <Text style={[styles.agreementText, { marginTop: 16, color: colors.foreground }]}>
                  Titan Prime Solutions acknowledges receipt of the items listed above and will review them. This section establishes a seven (7) day review and resolution period.
                </Text>
                <Text style={[styles.agreementText, { marginTop: 8, color: colors.foreground }]}>
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

              <View style={[styles.agreementDivider, { backgroundColor: colors.border }]} />

              {/* SECTION 3 */}
              <View style={styles.agreementSection}>
                <Text style={[styles.agreementSectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>SECTION 3 – COMPLETION CONFIRMATION</Text>
                <Text style={[styles.agreementText, { color: colors.foreground }]}>
                  Owner confirms that all agreed-upon roofing work has been completed in accordance with the Agreement and that the Property is in substantially the same condition as prior to installation, reasonable wear and tear excepted.
                </Text>
                <Text style={[styles.agreementText, { marginTop: 8, color: colors.foreground }]}>
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

              {/* Proceed to Signatures Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: walkThroughType && crewLeadName.trim() ? colors.primary : colors.muted,
                    marginTop: 16,
                  }
                ]}
                onPress={() => {
                  if (!walkThroughType) {
                    Alert.alert('Required', 'Please select a walk-through type');
                    return;
                  }
                  if (!crewLeadName.trim()) {
                    Alert.alert('Required', 'Please enter crew lead name');
                    return;
                  }
                  setCompletionFormStep(1);
                }}
                disabled={!walkThroughType || !crewLeadName.trim()}
              >
                <Text style={[styles.primaryButtonText, { color: walkThroughType && crewLeadName.trim() ? '#FFF' : colors.mutedForeground }]}>
                  Proceed to Signatures
                </Text>
                <Ionicons name="arrow-forward" size={18} color={walkThroughType && crewLeadName.trim() ? '#FFF' : colors.mutedForeground} />
              </TouchableOpacity>

              <View style={{ height: 100 }} />
            </ScrollView>
          )}

          {/* Step 1: Section 1 Owner Initials */}
          {completionFormStep === 1 && (
            <View style={[styles.signatureStepContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.signatureStepTitle, { color: colors.foreground }]}>Section 1 - Walk-Through Status</Text>
              <Text style={styles.signatureStepSubtitle}>Owner Initials Required</Text>
              <Text style={[styles.signatureStepDescription, { color: colors.mutedForeground }]}>
                Owner acknowledges the walk-through was offered and either completed or declined.
              </Text>

              <View style={[styles.signatureCanvasContainer, { borderColor: colors.border }]}>
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
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.clearSignature()} style={[styles.clearSignatureBtn, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}>
                  <Ionicons name="refresh" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.clearSignatureText, { color: colors.mutedForeground }]}>Clear</Text>
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
              <Text style={styles.signatureStepSubtitle}>Owner Initials Required</Text>
              <Text style={[styles.signatureStepDescription, { color: colors.mutedForeground }]}>
                Confirming listed items are complete and accurate, or no issues identified.
              </Text>

              <View style={[styles.signatureCanvasContainer, { borderColor: colors.border }]}>
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
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.clearSignature()} style={[styles.clearSignatureBtn, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}>
                  <Ionicons name="refresh" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.clearSignatureText, { color: colors.mutedForeground }]}>Clear</Text>
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
              <Text style={styles.signatureStepSubtitle}>Owner Signature</Text>
              <Text style={[styles.signatureStepDescription, { color: colors.mutedForeground }]}>
                Owner confirms all agreed-upon roofing work has been completed.
              </Text>

              <View style={[styles.signatureCanvasContainer, { borderColor: colors.border }]}>
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
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.clearSignature()} style={[styles.clearSignatureBtn, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}>
                  <Ionicons name="refresh" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.clearSignatureText, { color: colors.mutedForeground }]}>Clear</Text>
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
              <Text style={styles.signatureStepSubtitle}>Titan PRO Signature</Text>
              <Text style={[styles.signatureStepDescription, { color: colors.mutedForeground }]}>
                Representative confirms the work is complete.
              </Text>

              <View style={[styles.signatureCanvasContainer, { borderColor: colors.border }]}>
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
                <TouchableOpacity onPress={() => completionFormSignatureRef.current?.clearSignature()} style={[styles.clearSignatureBtn, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}>
                  <Ionicons name="refresh" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.clearSignatureText, { color: colors.mutedForeground }]}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => completionFormSignatureRef.current?.readSignature()}
                  style={[styles.confirmSignatureBtn, savingCompletion && { opacity: 0.7 }]}
                  disabled={savingCompletion}
                >
                  {savingCompletion ? (
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
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowCompletionForm(false);
                  setCompletionFormStep(0);
                }}
              >
                <Text style={{ color: colors.foreground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: (crewLeadName && walkThroughType) ? colors.primary : colors.muted }
                ]}
                disabled={!crewLeadName || !walkThroughType}
                onPress={() => setCompletionFormStep(1)}
              >
                <Text style={{ color: (crewLeadName && walkThroughType) ? '#FFF' : colors.mutedForeground, fontWeight: '600' }}>
                  Begin Signing
                </Text>
                <Ionicons name="arrow-forward" size={18} color={(crewLeadName && walkThroughType) ? '#FFF' : colors.mutedForeground} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerSubtitle: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  cardDescription: { fontSize: 13, marginBottom: 16, lineHeight: 20 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: 11, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '500' },
  infoSubvalue: { fontSize: 12, marginTop: 2 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoScroll: { marginBottom: 16 },
  imageThumbnail: {
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  uploadActions: { flexDirection: 'row', gap: 12 },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  uploadButtonText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '600' },
  warningText: { fontSize: 12, textAlign: 'center', marginTop: 12 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '500' },
  signatureContainer: {
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  signatureActions: { flexDirection: 'row', gap: 12 },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  signaturePreview: {
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  // Completion Form Styles (matching rep deal page)
  signatureStepIndicator: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  signatureStepText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  signatureStepDots: {
    flexDirection: 'row',
    gap: 8,
  },
  signatureStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  signatureStepDotActive: {
    backgroundColor: '#C9A24D',
  },
  agreementHeader: {
    backgroundColor: '#0F1E2E',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  agreementCompanyName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  agreementTagline: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
  },
  agreementText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  agreementSection: {
    marginBottom: 16,
  },
  agreementSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textTransform: 'uppercase',
    borderBottomWidth: 2,
    borderBottomColor: '#0F1E2E',
    paddingBottom: 6,
  },
  agreementDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  contractField: {
    marginBottom: 12,
  },
  contractFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  contractFieldValue: {
    fontSize: 14,
    color: '#111827',
  },
  workflowInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#C9A24D',
    borderColor: '#C9A24D',
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  signatureRequiredBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  signatureCompletedBox: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  signatureRequiredLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textAlign: 'center',
  },
  signatureRequiredText: {
    fontSize: 12,
    color: '#6B7280',
  },
  miniSignaturePreview: {
    width: 100,
    height: 40,
    resizeMode: 'contain',
  },
  signatureStepContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  signatureStepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  signatureStepSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C9A24D',
    textAlign: 'center',
    marginBottom: 8,
  },
  signatureStepDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  signatureCanvasContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  signatureStepActions: {
    flexDirection: 'row',
    gap: 12,
  },
  clearSignatureBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  clearSignatureText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  confirmSignatureBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#C9A24D',
    gap: 6,
  },
  confirmSignatureText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});




