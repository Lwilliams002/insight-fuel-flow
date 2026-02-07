import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, StyleSheet, Modal, TextInput, ScrollView, KeyboardAvoidingView, Animated, Dimensions, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, LongPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { pinsApi, dealsApi, Pin } from '../../src/services/api';
import { colors as staticColors } from '../../src/constants/config';
import { useTheme } from '../../src/contexts/ThemeContext';

type MapType = 'standard' | 'hybrid';
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

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { pinId } = useLocalSearchParams<{ pinId?: string }>();
  const { colors, isDark } = useTheme();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapType, setMapType] = useState<MapType>('standard');
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [uploadLater, setUploadLater] = useState(true);
  const [initialPinIdHandled, setInitialPinIdHandled] = useState<string | null>(null);

  // New pin modal state
  const [showNewPinModal, setShowNewPinModal] = useState(false);
  const [newPinCoords, setNewPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [newPinForm, setNewPinForm] = useState({
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    address: '',
    status: 'lead' as PinStatus,
    notes: '',
  });
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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

  // Handle pinId from URL params (when navigating from calendar)
  useEffect(() => {
    if (pinId && pins && pins.length > 0 && initialPinIdHandled !== pinId) {
      const pin = pins.find(p => p.id === pinId);
      if (pin) {
        setInitialPinIdHandled(pinId);
        // Center map on the pin
        if (mapRef.current && pin.latitude && pin.longitude) {
          mapRef.current.animateToRegion({
            latitude: pin.latitude,
            longitude: pin.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 500);
        }
        // Set up pin details and open modal after a short delay
        setTimeout(() => {
          setSelectedPin(pin);
          setEditPinForm({
            homeowner_name: pin.homeowner_name || '',
            homeowner_phone: pin.homeowner_phone || '',
            homeowner_email: pin.homeowner_email || '',
            address: pin.address || '',
            status: (pin.status as PinStatus) || 'lead',
            notes: pin.notes || '',
          });
          setShowPinDetailModal(true);
          Animated.spring(pinDetailSlideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }, 600);
      }
    }
  }, [pinId, pins, initialPinIdHandled, pinDetailSlideAnim]);

  const createPinMutation = useMutation({
    mutationFn: async (pinData: Partial<Pin>) => {
      const response = await pinsApi.create(pinData);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure map updates immediately
      await queryClient.invalidateQueries({ queryKey: ['pins'] });
      await refetch();
      Alert.alert('Success', 'Pin added successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to add pin');
    },
  });

  // Update pin mutation
  const updatePinMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pin> }) => {
      const response = await pinsApi.update(id, data);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pins'] });
      await refetch();
      Alert.alert('Success', 'Pin updated successfully');
      closePinDetailModal();
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to update pin');
    },
  });

  // Convert pin to deal mutation
  const convertToDealMutation = useMutation({
    mutationFn: async (pinId: string) => {
      const response = await dealsApi.createFromPin(pinId);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: async (deal) => {
      await queryClient.invalidateQueries({ queryKey: ['pins'] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
      await refetch();
      
      // Close the modal first
      setShowPinDetailModal(false);
      setSelectedPin(null);
      pinDetailSlideAnim.setValue(SCREEN_HEIGHT);
      
      // Show alert after a brief delay to let modal close
      setTimeout(() => {
        Alert.alert(
          'Success',
          'Pin converted to deal successfully!',
          [
            {
              text: 'View Deal',
              onPress: () => {
                if (deal?.id) {
                  // Use setTimeout to ensure alert is fully dismissed before navigation
                  setTimeout(() => {
                    router.push(`/(rep)/deals/${deal.id}`);
                  }, 100);
                }
              },
            },
            { text: 'OK' },
          ]
        );
      }, 300);
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to convert to deal');
    },
  });

  // Pin detail modal state
  const [showPinDetailModal, setShowPinDetailModal] = useState(false);
  const [editPinForm, setEditPinForm] = useState({
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    address: '',
    status: 'lead' as PinStatus,
    notes: '',
  });
  const pinDetailSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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

    // Reverse geocode to get address
    let addressString = '';
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (reverseGeocode && reverseGeocode.length > 0) {
        const location = reverseGeocode[0];
        const parts = [];
        if (location.streetNumber) parts.push(location.streetNumber);
        if (location.street) parts.push(location.street);
        addressString = parts.join(' ');

        // Also capture city, state, zip for the full address
        if (location.city) addressString += addressString ? `, ${location.city}` : location.city;
        if (location.region) addressString += `, ${location.region}`;
        if (location.postalCode) addressString += ` ${location.postalCode}`;
      }
    } catch (error) {
      console.log('Reverse geocode error:', error);
    }

    setNewPinForm({
      homeowner_name: '',
      homeowner_phone: '',
      homeowner_email: '',
      address: addressString,
      status: 'lead',
      notes: '',
    });
    openNewPinModal();
  };

  // Handle pin marker press - open detail modal
  const handlePinPress = (pin: Pin) => {
    setSelectedPin(pin);
    setEditPinForm({
      homeowner_name: pin.homeowner_name || '',
      homeowner_phone: pin.homeowner_phone || '',
      homeowner_email: pin.homeowner_email || '',
      address: pin.address || '',
      status: (pin.status as PinStatus) || 'lead',
      notes: pin.notes || '',
    });
    openPinDetailModal();
  };

  const openPinDetailModal = () => {
    setShowPinDetailModal(true);
    Animated.spring(pinDetailSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closePinDetailModal = () => {
    Animated.timing(pinDetailSlideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowPinDetailModal(false);
      setSelectedPin(null);
    });
  };

  const handleUpdatePin = () => {
    if (!selectedPin) return;

    updatePinMutation.mutate({
      id: selectedPin.id,
      data: {
        status: editPinForm.status,
        homeowner_name: editPinForm.homeowner_name || null,
        homeowner_phone: editPinForm.homeowner_phone || null,
        homeowner_email: editPinForm.homeowner_email || null,
        address: editPinForm.address || null,
        notes: editPinForm.notes || null,
      },
    });
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
    });
  };

  const handleSaveNewPin = () => {
    if (!newPinCoords) return;

    createPinMutation.mutate({
      lat: newPinCoords.latitude,
      lng: newPinCoords.longitude,
      status: newPinForm.status,
      homeowner_name: newPinForm.homeowner_name || null,
      homeowner_phone: newPinForm.homeowner_phone || null,
      homeowner_email: newPinForm.homeowner_email || null,
      address: newPinForm.address || null,
      notes: newPinForm.notes || null,
    });
    closeNewPinModal();
  };

  const toggleMapType = () => {
    setMapType(current => current === 'standard' ? 'hybrid' : 'standard');
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
            onPress={() => handlePinPress(pin)}
          />
        ))}
      </MapView>

      {/* Top Controls */}
      <SafeAreaView style={styles.topControls} edges={['top']}>
        <View style={[styles.pinCount, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
          <Text style={[styles.pinCountText, { color: colors.foreground }]}>{pins?.length || 0} Pins</Text>
        </View>
      </SafeAreaView>

      {/* Bottom Controls */}
      <SafeAreaView style={styles.bottomControls} edges={['bottom']}>
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={centerOnUser} style={[styles.locationButton, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
            <Ionicons name="navigate" size={20} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleMapType} style={[styles.mapTypeButton, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
            <Ionicons
              name={mapType === 'standard' ? 'map-outline' : 'earth'}
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.mapTypeText, { color: colors.foreground }]}>
              {mapType === 'standard' ? 'Standard' : 'Hybrid'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.hintContainer, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>Long press on map to add a pin</Text>
        </View>
      </SafeAreaView>


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
              {
                transform: [{ translateY: slideAnim }],
                backgroundColor: isDark ? colors.background : '#FFFFFF',
              }
            ]}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? colors.border : '#E5E7EB' }]}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Pin</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                {newPinCoords ? `${newPinCoords.latitude.toFixed(5)}, ${newPinCoords.longitude.toFixed(5)}` : ''}
              </Text>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Status Selection */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll}>
                  <View style={styles.statusRow}>
                    {statusOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.statusChip,
                          { backgroundColor: isDark ? colors.muted : '#F3F4F6', borderColor: isDark ? colors.border : '#E5E7EB' },
                          newPinForm.status === option.value && { backgroundColor: option.color },
                        ]}
                        onPress={() => setNewPinForm({ ...newPinForm, status: option.value })}
                      >
                        <View style={[styles.statusChipDot, { backgroundColor: option.color }]} />
                        <Text style={[
                          styles.statusChipText,
                          { color: isDark ? colors.foreground : '#374151' },
                          newPinForm.status === option.value && styles.statusChipTextActive
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Homeowner Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Homeowner Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={newPinForm.homeowner_name}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, homeowner_name: text })}
                  placeholder="Enter name"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Phone Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={newPinForm.homeowner_phone}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, homeowner_phone: text })}
                  placeholder="Enter phone"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={newPinForm.homeowner_email}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, homeowner_email: text })}
                  placeholder="Enter email"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Address */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={newPinForm.address}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, address: text })}
                  placeholder="Enter address"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={newPinForm.notes}
                  onChangeText={(text) => setNewPinForm({ ...newPinForm, notes: text })}
                  placeholder="Add notes..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, { borderTopColor: isDark ? colors.border : '#E5E7EB' }]}>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]} onPress={closeNewPinModal}>
                <Text style={[styles.cancelButtonText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveNewPin}
                disabled={createPinMutation.isPending}
              >
                <Ionicons name="location" size={18} color="#FFF" />
                <Text style={styles.saveButtonText}>
                  {createPinMutation.isPending ? 'Saving...' : 'Save Pin'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Pin Detail Modal */}
      {selectedPin && (
        <Modal
          visible={showPinDetailModal}
          transparent
          animationType="none"
          onRequestClose={closePinDetailModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={closePinDetailModal}
            />
            <Animated.View
              style={[
                styles.modalContent,
                {
                  transform: [{ translateY: pinDetailSlideAnim }],
                  backgroundColor: isDark ? colors.background : '#FFFFFF',
                }
              ]}
            >
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: isDark ? colors.border : '#E5E7EB' }]}>
                <View style={styles.modalHandle} />
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Pin Details</Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                  {selectedPin.address || 'No address'}
                </Text>
              </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Status Selection */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusScroll}>
                  <View style={styles.statusRow}>
                    {statusOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.statusChip,
                          { backgroundColor: isDark ? colors.muted : '#F3F4F6', borderColor: isDark ? colors.border : '#E5E7EB' },
                          editPinForm.status === option.value && { backgroundColor: option.color },
                        ]}
                        onPress={() => setEditPinForm({ ...editPinForm, status: option.value })}
                      >
                        <View style={[styles.statusChipDot, { backgroundColor: option.color }]} />
                        <Text style={[
                          styles.statusChipText,
                          { color: isDark ? colors.foreground : '#374151' },
                          editPinForm.status === option.value && styles.statusChipTextActive
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Homeowner Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Homeowner Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={editPinForm.homeowner_name}
                  onChangeText={(text) => setEditPinForm({ ...editPinForm, homeowner_name: text })}
                  placeholder="Enter name"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Phone Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={editPinForm.homeowner_phone}
                  onChangeText={(text) => setEditPinForm({ ...editPinForm, homeowner_phone: text })}
                  placeholder="Enter phone"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={editPinForm.homeowner_email}
                  onChangeText={(text) => setEditPinForm({ ...editPinForm, homeowner_email: text })}
                  placeholder="Enter email"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Address */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={editPinForm.address}
                  onChangeText={(text) => setEditPinForm({ ...editPinForm, address: text })}
                  placeholder="Enter address"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: isDark ? colors.muted : '#F9FAFB', borderColor: isDark ? colors.border : '#E5E7EB', color: colors.foreground }]}
                  value={editPinForm.notes}
                  onChangeText={(text) => setEditPinForm({ ...editPinForm, notes: text })}
                  placeholder="Add notes..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Insurance Agreement Section - Only show if not already a deal */}
              {!selectedPin.deal_id && (
                <>
                  {/* Insurance Agreement Toggle */}
                  <View style={[styles.toggleRow, { backgroundColor: isDark ? colors.muted : '#F9FAFB' }]}>
                    <View style={styles.toggleInfo}>
                      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Upload Insurance Agreement Later</Text>
                      <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>
                        {uploadLater ? 'Agreement can be uploaded after conversion' : 'Upload agreement before converting'}
                      </Text>
                    </View>
                    <Switch
                      value={uploadLater}
                      onValueChange={setUploadLater}
                      trackColor={{ false: '#D1D5DB', true: colors.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {/* Upload Insurance Agreement Button - Shows when toggle is OFF */}
                  {!uploadLater && (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={() => {
                        Alert.alert('Upload', 'Insurance agreement upload will be implemented with document picker');
                        // TODO: Implement document picker for insurance agreement
                      }}
                    >
                      <Ionicons name="cloud-upload" size={20} color={colors.primary} />
                      <Text style={styles.uploadButtonText}>Upload Insurance Agreement</Text>
                    </TouchableOpacity>
                  )}

                  {/* Convert to Deal Button */}
                  <TouchableOpacity
                    style={[
                      styles.convertButton,
                      (!editPinForm.homeowner_name.trim()) && styles.convertButtonDisabled
                    ]}
                    onPress={() => {
                      if (!editPinForm.homeowner_name.trim()) {
                        Alert.alert('Required', 'Homeowner name is required to convert to a deal');
                        return;
                      }
                      Alert.alert(
                        'Convert to Deal',
                        `Convert pin for "${editPinForm.homeowner_name}" to a deal?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Convert',
                            onPress: async () => {
                              try {
                                // First update the pin with current form data
                                const updateResponse = await pinsApi.update(selectedPin.id, {
                                  status: editPinForm.status,
                                  homeowner_name: editPinForm.homeowner_name || null,
                                  homeowner_phone: editPinForm.homeowner_phone || null,
                                  homeowner_email: editPinForm.homeowner_email || null,
                                  address: editPinForm.address || null,
                                  notes: editPinForm.notes || null,
                                });

                                if (updateResponse.error) {
                                  Alert.alert('Error', updateResponse.error);
                                  return;
                                }

                                // Then convert to deal
                                convertToDealMutation.mutate(selectedPin.id);
                              } catch (error) {
                                Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update pin');
                              }
                            },
                          },
                        ]
                      );
                    }}
                    disabled={convertToDealMutation.isPending || !editPinForm.homeowner_name.trim()}
                  >
                    {convertToDealMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.convertButtonText}>Convert to Deal</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {!editPinForm.homeowner_name.trim() && (
                    <Text style={styles.requiredHint}>* Homeowner name is required to convert</Text>
                  )}
                </>
              )}

              {selectedPin.deal_id && (
                <TouchableOpacity
                  style={styles.viewDealButton}
                  onPress={() => {
                    closePinDetailModal();
                    router.push(`/(rep)/deals/${selectedPin.deal_id}`);
                  }}
                >
                  <Ionicons name="open" size={20} color={colors.primary} />
                  <Text style={styles.viewDealButtonText}>View Linked Deal</Text>
                </TouchableOpacity>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, { borderTopColor: isDark ? colors.border : '#E5E7EB' }]}>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]} onPress={closePinDetailModal}>
                <Text style={[styles.cancelButtonText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleUpdatePin}
                disabled={updatePinMutation.isPending}
              >
                <Ionicons name="checkmark" size={18} color="#FFF" />
                <Text style={styles.saveButtonText}>
                  {updatePinMutation.isPending ? 'Saving...' : 'Update Pin'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      )}
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
    color: staticColors.secondary,
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
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
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
    backgroundColor: staticColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 16,
    marginTop: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  toggleHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  convertButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewDealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(201, 162, 77, 0.1)',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: staticColors.primary,
  },
  viewDealButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: staticColors.primary,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: staticColors.primary,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: staticColors.primary,
  },
  convertButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  requiredHint: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
    textAlign: 'center',
  },
});
