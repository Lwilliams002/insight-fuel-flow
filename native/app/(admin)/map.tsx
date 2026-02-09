import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { pinsApi, Pin } from '../../src/services/api';
import { colors as staticColors } from '../../src/constants/config';
import { useTheme } from '../../src/contexts/ThemeContext';

type MapType = 'standard' | 'satellite' | 'hybrid';

const pinColors: Record<string, string> = {
  lead: '#3B82F6',
  followup: '#F59E0B',
  appointment: '#8B5CF6',
  installed: '#22C55E',
  renter: '#64748B',
  not_interested: '#EF4444',
};

export default function AdminMapScreen() {
  const mapRef = useRef<MapView>(null);
  const { colors, isDark } = useTheme();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [mapType, setMapType] = useState<MapType>('standard');

  const { data: pins } = useQuery({
    queryKey: ['pins', 'admin'],
    queryFn: async () => {
      const response = await pinsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  const filteredPins = statusFilter
    ? pins?.filter(p => p.status === statusFilter)
    : pins;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

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
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  };

  const initialRegion = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : {
        latitude: 36.3302,
        longitude: -119.2921,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };

  // Status counts
  const statusCounts = pins?.reduce((acc, pin) => {
    acc[pin.status] = (acc[pin.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

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
      >
        {filteredPins?.map((pin) => (
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
        <View style={styles.headerRow}>
          <View style={[styles.pinCount, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
            <Text style={[styles.pinCountText, { color: colors.foreground }]}>
              {filteredPins?.length || 0} / {pins?.length || 0} Pins
            </Text>
          </View>
        </View>

        {/* Status Filter */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }, !statusFilter && { backgroundColor: colors.primary }]}
            onPress={() => setStatusFilter(null)}
          >
            <Text style={[styles.filterChipText, { color: isDark ? colors.foreground : '#374151' }, !statusFilter && styles.filterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {Object.entries(pinColors).map(([status, color]) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                { backgroundColor: isDark ? colors.muted : '#FFFFFF' },
                statusFilter === status && { backgroundColor: color },
              ]}
              onPress={() => setStatusFilter(statusFilter === status ? null : status)}
            >
              <View style={[styles.colorDot, { backgroundColor: color }]} />
              <Text
                style={[
                  styles.filterChipText,
                  { color: isDark ? colors.foreground : '#374151' },
                  statusFilter === status && styles.filterChipTextActive,
                ]}
              >
                {statusCounts[status] || 0}
              </Text>
            </TouchableOpacity>
          ))}
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
              name={mapType === 'standard' ? 'globe-outline' : mapType === 'satellite' ? 'earth' : 'layers'}
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.mapTypeText, { color: colors.foreground }]}>
              {mapType === 'standard' ? 'Standard' : mapType === 'satellite' ? 'Satellite' : 'Hybrid'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Selected Pin Card */}
      {selectedPin && (
        <View style={[styles.pinCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
          <View style={styles.pinCardRow}>
            <View style={styles.pinCardInfo}>
              <Text style={[styles.pinCardName, { color: colors.foreground }]}>
                {selectedPin.homeowner_name || 'Unknown'}
              </Text>
              <Text style={[styles.pinCardAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
                {selectedPin.address || 'No address'}
              </Text>
              <View style={styles.pinCardMeta}>
                <View style={styles.pinCardStatus}>
                  <View style={[styles.statusDot, { backgroundColor: pinColors[selectedPin.status] }]} />
                  <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>{selectedPin.status}</Text>
                </View>
                {selectedPin.rep_name && (
                  <Text style={[styles.repName, { color: colors.mutedForeground }]}>
                    <Ionicons name="person" size={12} color={colors.mutedForeground} /> {selectedPin.rep_name}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedPin(null)}>
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  pinCount: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: staticColors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
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
  pinCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pinCardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
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
  repName: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
