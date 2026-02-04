import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, StyleSheet, Modal, TextInput, ScrollView, KeyboardAvoidingView, Animated, Dimensions, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, LongPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { pinsApi, dealsApi, Pin, uploadFile } from '../../src/services/api';
import { colors } from '../../src/constants/config';

type MapType = 'standard' | 'satellite' | 'hybrid';
type PinStatus = 'lead' | 'followup' | 'appointment' | 'installed' | 'renter' | 'not_interested';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const pinColors: Record<string, string> = {
  lead: '#3B82F6',
  followup: '#F59E0B',
  appointment: '#8B5CF6',
  installed: '#22C55E',
  renter: '#64748B',
  not_interested: '#EF4444',
};

const statusOptions: { value: PinStatus; label: string; color: string }[] = [
  { value: 'lead', label: 'Lead', color: '#3B82F6' },
  { value: 'followup', label: 'Follow Up', color: '#F59E0B' },
  { value: 'appointment', label: 'Appointment', color: '#8B5CF6' },
  { value: 'installed', label: 'Installed', color: '#22C55E' },
  { value: 'renter', label: 'Renter', color: '#64748B' },
  { value: 'not_interested', label: 'Not Interested', color: '#EF4444' },
];

// Helper to generate time options
const generateTimeOptions = () => {
  const times = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const label = `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      times.push({ label, value });
    }
  }
  return times;
};

const timeOptions = generateTimeOptions();

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapType, setMapType] = useState<MapType>('standard');
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);

  // New pin modal state
  const [showNewPinModal, setShowNewPinModal] = useState(false);
  const [newPinCoords, setNewPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [newPinForm, setNewPinForm] = useState({
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    status: 'lead' as PinStatus,
    notes: '',
    // Appointment fields
    appointment_date: '',
    appointment_start_time: '09:00',
    appointment_end_time: '10:00',
  });
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Convert to deal state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [uploadLater, setUploadLater] = useState(false);
  const [contractFile, setContractFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [pendingPinId, setPendingPinId] = useState<string | null>(null);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const { data: pins, refetch } = useQuery({
    queryKey: ['pins'],
    queryFn: async () => {
      const response = await pinsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    staleTime: 30000,
    refetchOnMount: 'always',
  });

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const createPinMutation = useMutation({
    mutationFn: async (pinData: Partial<Pin>) => {
      const response = await pinsApi.create(pinData);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pins'] });
      Alert.alert('Success', 'Pin added successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to add pin');
    },
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  const handleLongPress = async (event: LongPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setNewPinCoords({ latitude, longitude });
    setNewPinForm({
      homeowner_name: '',
      homeowner_phone: '',
      homeowner_email: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      status: 'lead',
      notes: '',
      appointment_date: format(new Date(), 'yyyy-MM-dd'),
      appointment_start_time: '09:00',
      appointment_end_time: '10:00',
    });
    openNewPinModal();

    // Reverse geocode to get address
    setIsLoadingAddress(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const addr = results[0];
        const streetAddress = [addr.streetNumber, addr.street].filter(Boolean).join(' ');
        setNewPinForm(prev => ({
          ...prev,
          address: streetAddress || '',
          city: addr.city || '',
          state: addr.region || '',
          zip_code: addr.postalCode || '',
        }));
      }
    } catch (error) {
      console.log('Reverse geocoding failed:', error);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const openNewPinModal = () => {
    setShowNewPinModal(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeNewPinModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowNewPinModal(false);
      setNewPinCoords(null);
      setContractFile(null);
      setUploadLater(false);
    });
  };

  // Pick contract document
  const pickContractDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setContractFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  // Convert pin to deal
  const handleConvertToDeal = async (pinId: string) => {
    setIsConverting(true);
    try {
      // If contract file exists, upload it first
      if (contractFile && !uploadLater) {
        const uploadResult = await uploadFile(
          contractFile.uri,
          contractFile.name,
          contractFile.type,
          'contract',
          undefined,
          pinId
        );
        if (uploadResult) {
          await pinsApi.update(pinId, { contract_url: uploadResult.key });
        }
      }

      // Convert pin to deal
      const response = await dealsApi.createFromPin(pinId);
      if (response.error) throw new Error(response.error);

      queryClient.invalidateQueries({ queryKey: ['pins'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });

      Alert.alert('Success', 'Deal created successfully!', [
        { text: 'View Deal', onPress: () => router.push(`/deals/${response.data?.id}`) },
        { text: 'OK' },
      ]);

      setShowConvertModal(false);
      closeNewPinModal();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to convert to deal');
    } finally {
      setIsConverting(false);
    }
  };

  const handleSaveNewPin = async () => {
    if (!newPinCoords) return;

    // Build appointment date if status is appointment
    let appointmentDate = null;
    let appointmentEndDate = null;
    if (newPinForm.status === 'appointment' && newPinForm.appointment_date) {
      appointmentDate = `${newPinForm.appointment_date}T${newPinForm.appointment_start_time}:00`;
      appointmentEndDate = `${newPinForm.appointment_date}T${newPinForm.appointment_end_time}:00`;
    }

    // Combine address parts
    const fullAddress = [
      newPinForm.address,
      newPinForm.city,
      newPinForm.state,
      newPinForm.zip_code
    ].filter(Boolean).join(', ');

    createPinMutation.mutate({
      lat: newPinCoords.latitude,
      lng: newPinCoords.longitude,
      status: newPinForm.status,
      homeowner_name: newPinForm.homeowner_name || null,
      homeowner_phone: newPinForm.homeowner_phone || null,
      homeowner_email: newPinForm.homeowner_email || null,
      address: fullAddress || null,
      city: newPinForm.city || null,
      state: newPinForm.state || null,
      zip_code: newPinForm.zip_code || null,
      notes: newPinForm.notes || null,
      appointment_date: appointmentDate,
      appointment_end_date: appointmentEndDate,
    });
    closeNewPinModal();
  };

  // Save and convert to deal
  const handleSaveAndConvert = async () => {
    if (!newPinCoords) return;

    // Validate appointment has contract or upload later
    if (!uploadLater && !contractFile) {
      Alert.alert('Contract Required', 'Please upload a contract or select "Upload Later"');
      return;
    }

    // Build appointment date if status is appointment
    let appointmentDate = null;
    let appointmentEndDate = null;
    if (newPinForm.status === 'appointment' && newPinForm.appointment_date) {
      appointmentDate = `${newPinForm.appointment_date}T${newPinForm.appointment_start_time}:00`;
      appointmentEndDate = `${newPinForm.appointment_date}T${newPinForm.appointment_end_time}:00`;
    }

    // Combine address parts
    const fullAddress = [
      newPinForm.address,
      newPinForm.city,
      newPinForm.state,
      newPinForm.zip_code
    ].filter(Boolean).join(', ');

    setIsConverting(true);
    try {
      // First create the pin
      const pinResponse = await pinsApi.create({
        lat: newPinCoords.latitude,
        lng: newPinCoords.longitude,
        status: newPinForm.status,
        homeowner_name: newPinForm.homeowner_name || null,
        homeowner_phone: newPinForm.homeowner_phone || null,
        homeowner_email: newPinForm.homeowner_email || null,
        address: fullAddress || null,
        city: newPinForm.city || null,
        state: newPinForm.state || null,
        zip_code: newPinForm.zip_code || null,
        notes: newPinForm.notes || null,
        appointment_date: appointmentDate,
        appointment_end_date: appointmentEndDate,
      });

      if (pinResponse.error) throw new Error(pinResponse.error);
      const newPin = pinResponse.data!;

      // Upload contract if provided
      if (contractFile && !uploadLater) {
        const uploadResult = await uploadFile(
          contractFile.uri,
          contractFile.name,
          contractFile.type,
          'contract',
          undefined,
          newPin.id
        );
        if (uploadResult) {
          await pinsApi.update(newPin.id, { contract_url: uploadResult.key });
        }
      }

      // Convert to deal
      const dealResponse = await dealsApi.createFromPin(newPin.id);
      if (dealResponse.error) throw new Error(dealResponse.error);

      queryClient.invalidateQueries({ queryKey: ['pins'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });

      Alert.alert('Success', 'Deal created successfully!', [
        { text: 'View Deal', onPress: () => router.push(`/deals/${dealResponse.data?.id}`) },
        { text: 'OK' },
      ]);

      closeNewPinModal();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create deal');
    } finally {
      setIsConverting(false);
    }
  };

  const toggleMapType = () => {
    setMapType(current => {
      if (current === 'standard') return 'satellite';
      if (current === 'satellite') return 'hybrid';
      return 'standard';
    });
  };

  const centerOnUser = async () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const initialRegion = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 36.3302,
        longitude: -119.2921,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        mapType={mapType}
        showsUserLocation
        showsMyLocationButton={false}
        onLongPress={handleLongPress}
      >
        {pins?.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{
              latitude: pin.lat,
              longitude: pin.lng,
            }}
            pinColor={pinColors[pin.status] || pinColors.lead}
            onPress={() => setSelectedPin(pin)}
          />
        ))}
      </MapView>

      {/* Top Controls */}
      <SafeAreaView style={styles.topControls} edges={['top']}>
        <View style={styles.pinCount}>
          <Text style={styles.pinCountText}>{pins?.length || 0} Pins</Text>
        </View>
      </SafeAreaView>

      {/* Bottom Controls */}
      <SafeAreaView style={styles.bottomControls} edges={['bottom']}>
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={centerOnUser} style={styles.locationButton}>
            <Ionicons name="navigate" size={20} color={colors.secondary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleMapType} style={styles.mapTypeButton}>
            <Ionicons
              name={mapType === 'standard' ? 'globe-outline' : mapType === 'satellite' ? 'earth' : 'layers'}
              size={20}
              color={colors.secondary}
            />
            <Text style={styles.mapTypeText}>
              {mapType === 'standard' ? 'Standard' : mapType === 'satellite' ? 'Satellite' : 'Hybrid'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Long press on map to add a pin</Text>
        </View>
      </SafeAreaView>

      {/* Selected Pin Card */}
      {selectedPin && (
        <View style={styles.pinCard}>
          <View style={styles.pinCardRow}>
            <View style={styles.pinCardInfo}>
              <Text style={styles.pinCardName}>
                {selectedPin.homeowner_name || 'Unknown'}
              </Text>
              <Text style={styles.pinCardAddress} numberOfLines={1}>
                {selectedPin.address || 'No address'}
              </Text>
              <View style={styles.pinCardStatus}>
                <View style={[styles.statusDot, { backgroundColor: pinColors[selectedPin.status] }]} />
                <Text style={styles.statusLabel}>{selectedPin.status}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedPin(null)}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* New Pin Modal */}
      <Modal
        visible={showNewPinModal}
        transparent
        animationType="none"
        onRequestClose={closeNewPinModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeNewPinModal}
          />
          <Animated.View
            style={[
              styles.modalContent,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>New Pin</Text>
              <Text style={styles.modalSubtitle}>
                {newPinCoords ? `${newPinCoords.latitude.toFixed(5)}, ${newPinCoords.longitude.toFixed(5)}` : ''}
              </Text>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Status Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll}>
                  <View style={styles.statusRow}>
                    {statusOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.statusChip,
                          newPinForm.status === option.value && { backgroundColor: option.color },
                        ]}
                        onPress={() => setNewPinForm({ ...newPinForm, status: option.value })}
                      >
                        <View style={[styles.statusChipDot, { backgroundColor: option.color }]} />
                        <Text style={[
                          styles.statusChipText,
                          newPinForm.status === option.value && styles.statusChipTextActive
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Appointment Date/Time (only show if status is appointment) */}
              {newPinForm.status === 'appointment' && (
                <View style={styles.appointmentSection}>
                  <Text style={styles.sectionTitle}>
                    <Ionicons name="calendar" size={16} color={colors.primary} /> Appointment Details
                  </Text>

                  {/* Date */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Date</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                      <Text style={styles.datePickerText}>
                        {newPinForm.appointment_date
                          ? format(new Date(newPinForm.appointment_date), 'MMMM d, yyyy')
                          : 'Select date'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Time Row */}
                  <View style={styles.timeRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Start Time</Text>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => setShowStartTimePicker(true)}
                      >
                        <Ionicons name="time-outline" size={18} color="#6B7280" />
                        <Text style={styles.datePickerText}>
                          {timeOptions.find(t => t.value === newPinForm.appointment_start_time)?.label || '9:00 AM'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>End Time</Text>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => setShowEndTimePicker(true)}
                      >
                        <Ionicons name="time-outline" size={18} color="#6B7280" />
                        <Text style={styles.datePickerText}>
                          {timeOptions.find(t => t.value === newPinForm.appointment_end_time)?.label || '10:00 AM'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Homeowner Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Homeowner Name</Text>
                <TextInput
                  style={styles.input}
                  value={newPinForm.homeowner_name}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, homeowner_name: text })}
                  placeholder="Enter name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={newPinForm.homeowner_phone}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, homeowner_phone: text })}
                  placeholder="Enter phone"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={newPinForm.homeowner_email}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, homeowner_email: text })}
                  placeholder="Enter email"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Address with loading indicator */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>Street Address</Text>
                  {isLoadingAddress && (
                    <View style={styles.loadingAddress}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.loadingAddressText}>Getting address...</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  value={newPinForm.address}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, address: text })}
                  placeholder="Street address"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* City, State, Zip Row */}
              <View style={styles.addressRow}>
                <View style={[styles.inputGroup, { flex: 2 }]}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.input}
                    value={newPinForm.city}
                    onChangeText={(text) => setNewPinForm({ ...newPinForm, city: text })}
                    placeholder="City"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput
                    style={styles.input}
                    value={newPinForm.state}
                    onChangeText={(text) => setNewPinForm({ ...newPinForm, state: text })}
                    placeholder="TX"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1.2 }]}>
                  <Text style={styles.inputLabel}>ZIP</Text>
                  <TextInput
                    style={styles.input}
                    value={newPinForm.zip_code}
                    onChangeText={(text) => setNewPinForm({ ...newPinForm, zip_code: text })}
                    placeholder="12345"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={newPinForm.notes}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, notes: text })}
                  placeholder="Add notes..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Convert to Deal Section */}
              <View style={styles.convertSection}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="briefcase" size={16} color={colors.primary} /> Convert to Deal
                </Text>

                {/* Contract Upload */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Insurance Agreement / Contract</Text>
                  {contractFile ? (
                    <View style={styles.fileSelected}>
                      <Ionicons name="document-text" size={20} color={colors.primary} />
                      <Text style={styles.fileName} numberOfLines={1}>{contractFile.name}</Text>
                      <TouchableOpacity onPress={() => setContractFile(null)}>
                        <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.uploadButton} onPress={pickContractDocument}>
                      <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                      <Text style={styles.uploadButtonText}>Upload Contract</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Upload Later Toggle */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Upload Later</Text>
                    <Text style={styles.toggleDescription}>Skip contract upload for now</Text>
                  </View>
                  <Switch
                    value={uploadLater}
                    onValueChange={setUploadLater}
                    trackColor={{ false: '#E5E7EB', true: colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeNewPinModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveNewPin}
                disabled={createPinMutation.isPending || isConverting}
              >
                <Ionicons name="location" size={18} color="#FFF" />
                <Text style={styles.saveButtonText}>
                  {createPinMutation.isPending ? 'Saving...' : 'Save Pin'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Convert to Deal Button */}
            <View style={styles.convertFooter}>
              <TouchableOpacity
                style={[styles.convertButton, (!uploadLater && !contractFile) && styles.convertButtonDisabled]}
                onPress={handleSaveAndConvert}
                disabled={isConverting || (!uploadLater && !contractFile)}
              >
                {isConverting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="briefcase" size={18} color="#FFF" />
                    <Text style={styles.convertButtonText}>Save & Convert to Deal</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Date</Text>
            <ScrollView style={styles.pickerScroll}>
              {Array.from({ length: 30 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dateStr = format(date, 'yyyy-MM-dd');
                const isSelected = newPinForm.appointment_date === dateStr;
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                    onPress={() => {
                      setNewPinForm({ ...newPinForm, appointment_date: dateStr });
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextSelected]}>
                      {format(date, 'EEEE, MMMM d, yyyy')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Start Time Picker Modal */}
      <Modal visible={showStartTimePicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowStartTimePicker(false)}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Start Time</Text>
            <ScrollView style={styles.pickerScroll}>
              {timeOptions.map((time) => {
                const isSelected = newPinForm.appointment_start_time === time.value;
                return (
                  <TouchableOpacity
                    key={time.value}
                    style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                    onPress={() => {
                      setNewPinForm({ ...newPinForm, appointment_start_time: time.value });
                      setShowStartTimePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextSelected]}>
                      {time.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* End Time Picker Modal */}
      <Modal visible={showEndTimePicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowEndTimePicker(false)}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>End Time</Text>
            <ScrollView style={styles.pickerScroll}>
              {timeOptions.map((time) => {
                const isSelected = newPinForm.appointment_end_time === time.value;
                return (
                  <TouchableOpacity
                    key={time.value}
                    style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                    onPress={() => {
                      setNewPinForm({ ...newPinForm, appointment_end_time: time.value });
                      setShowEndTimePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextSelected]}>
                      {time.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  pinCount: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pinCountText: {
    fontWeight: '600',
    color: '#111827',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  locationButton: {
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  mapTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  mapTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
  },
  hintContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hintText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
    fontSize: 13,
  },
  pinCard: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  pinCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinCardInfo: {
    flex: 1,
  },
  pinCardName: {
    fontWeight: 'bold',
    color: '#111827',
    fontSize: 16,
  },
  pinCardAddress: {
    color: '#6B7280',
    fontSize: 14,
  },
  pinCardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    color: '#6B7280',
    fontSize: 12,
    textTransform: 'capitalize',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  statusScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Appointment Section
  appointmentSection: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  datePickerText: {
    fontSize: 15,
    color: '#111827',
  },

  // Address Row
  addressRow: {
    flexDirection: 'row',
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingAddressText: {
    fontSize: 12,
    color: colors.primary,
  },

  // Convert to Deal Section
  convertSection: {
    backgroundColor: 'rgba(201, 162, 77, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 77, 0.2)',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  fileSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  toggleDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  convertFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 10,
  },
  convertButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  convertButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Picker Modals
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerScroll: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(201, 162, 77, 0.1)',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  pickerOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});
