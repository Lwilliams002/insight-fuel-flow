import { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Image, Linking, Modal, Dimensions } from 'react-native';
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
  const [crewSignature, setCrewSignature] = useState<string | null>(null);
  const [savingCompletion, setSavingCompletion] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signatureRef = useRef<any>(null);

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

  const handleSaveCompletionForm = async () => {
    if (!crewSignature) {
      Alert.alert('Signature Required', 'Please sign the completion form');
      return;
    }

    setSavingCompletion(true);
    try {
      // Upload crew signature
      const signatureFileName = `crew_signature_${Date.now()}.png`;
      const signatureResult = await uploadFile(crewSignature, signatureFileName, 'image/png', 'signatures', id);

      if (signatureResult) {
        // Generate completion form HTML
        const completionHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Installation Completion Form</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #0F1E2E; margin: 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .label { font-weight: bold; color: #666; }
    .signature-section { margin-top: 40px; padding-top: 20px; border-top: 2px solid #0F1E2E; }
    .signature-box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-top: 10px; }
    .signature-image { max-width: 200px; max-height: 60px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>TITAN PRIME SOLUTIONS</h1>
    <h2>Installation Completion Form</h2>
  </div>

  <div class="info-row"><span class="label">Homeowner:</span><span>${deal?.homeowner_name || ''}</span></div>
  <div class="info-row"><span class="label">Address:</span><span>${deal?.address || ''}</span></div>
  <div class="info-row"><span class="label">Install Date:</span><span>${deal?.install_date ? format(new Date(deal.install_date), 'MMMM d, yyyy') : ''}</span></div>
  <div class="info-row"><span class="label">Completion Date:</span><span>${format(new Date(), 'MMMM d, yyyy')}</span></div>
  <div class="info-row"><span class="label">Photos Uploaded:</span><span>${(deal?.install_images?.length || 0)} photos</span></div>

  <div class="signature-section">
    <h3>Crew Certification</h3>
    <p>I certify that the installation has been completed according to specifications and all work has been performed professionally.</p>
    <div class="signature-box">
      <p style="font-size: 12px; color: #666;">Crew Member Signature</p>
      <img src="${crewSignature}" class="signature-image" alt="Crew Signature" />
      <p style="font-size: 12px; color: #666;">Date: ${format(new Date(), 'MMMM d, yyyy')}</p>
    </div>
  </div>
</body>
</html>
        `;

        // Save the HTML as base64
        const completionBase64 = btoa(unescape(encodeURIComponent(completionHtml)));
        const completionDataUrl = `data:text/html;base64,${completionBase64}`;

        await updateMutation.mutateAsync({
          completion_form_signature_url: signatureResult.key,
          completion_form_url: completionDataUrl,
          completion_date: new Date().toISOString(),
          status: 'installed', // Crew marks as installed, homeowner signature comes later
        });

        Alert.alert('Success', 'Completion form submitted! Waiting for homeowner signature.');
        setShowCompletionForm(false);
        refetch();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save completion form');
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

      {/* Completion Form Modal */}
      <Modal visible={showCompletionForm} animationType="slide">
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCompletionForm(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Completion Form</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Installation Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Homeowner</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>{deal.homeowner_name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Address</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>{deal.address}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Install Date</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {deal.install_date ? format(new Date(deal.install_date), 'MMMM d, yyyy') : 'N/A'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Photos Uploaded</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>{deal.install_images?.length || 0}</Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Crew Signature</Text>
              <Text style={[styles.cardDescription, { color: colors.mutedForeground }]}>
                I certify that the installation has been completed according to specifications.
              </Text>

              <View style={[styles.signatureContainer, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}>
                <SignatureCanvas
                  ref={signatureRef}
                  onOK={(sig: string) => setCrewSignature(sig)}
                  onEmpty={() => Alert.alert('Error', 'Please sign before continuing')}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Confirm"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; }
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; }
                    body { background-color: #FFFFFF; margin: 0; padding: 0; }
                  `}
                  backgroundColor="#FFFFFF"
                  penColor="#111827"
                />
              </View>

              <View style={styles.signatureActions}>
                <TouchableOpacity
                  onPress={() => signatureRef.current?.clearSignature()}
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                >
                  <Ionicons name="refresh" size={18} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, marginLeft: 6 }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => signatureRef.current?.readSignature()}
                  style={[styles.secondaryButton, { borderColor: colors.primary, backgroundColor: 'rgba(201, 162, 77, 0.1)' }]}
                >
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, marginLeft: 6 }}>Confirm</Text>
                </TouchableOpacity>
              </View>

              {crewSignature && (
                <View style={styles.signaturePreview}>
                  <Text style={{ color: '#22C55E', fontWeight: '600' }}>✓ Signature captured</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => setShowCompletionForm(false)}
            >
              <Text style={{ color: colors.foreground }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: crewSignature ? '#22C55E' : colors.muted }]}
              onPress={handleSaveCompletionForm}
              disabled={!crewSignature || savingCompletion}
            >
              {savingCompletion ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={crewSignature ? '#FFF' : colors.mutedForeground} />
                  <Text style={{ color: crewSignature ? '#FFF' : colors.mutedForeground, fontWeight: '600', marginLeft: 6 }}>
                    Submit Completion
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
});




