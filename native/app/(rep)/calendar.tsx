import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Modal, TextInput, Switch, Animated, Dimensions, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
} from 'date-fns';
import { pinsApi, Pin } from '../../src/services/api';
import { colors } from '../../src/constants/config';
import { useAuth } from '../../src/contexts/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const statusColors: Record<string, string> = {
  lead: '#3B82F6',
  followup: '#F59E0B',
  appointment: '#8B5CF6',
  installed: '#22C55E',
  renter: '#64748B',
  not_interested: '#EF4444',
};

// Time options for pickers
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

// Calendar event interface (stored locally)
interface CalendarEvent {
  id: string;
  title: string;
  notes?: string;
  date: string;
  time?: string;
  end_time?: string;
  all_day: boolean;
  created_at: string;
}

export default function CalendarScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Modal state
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Add Appointment form
  const [appointmentForm, setAppointmentForm] = useState({
    homeowner_name: '',
    homeowner_phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    appointment_date: format(new Date(), 'yyyy-MM-dd'),
    appointment_time: '09:00',
    appointment_end_time: '10:00',
    all_day: false,
    notes: '',
  });
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Add Event form
  const [eventForm, setEventForm] = useState({
    title: '',
    event_date: format(new Date(), 'yyyy-MM-dd'),
    event_time: '09:00',
    event_end_time: '10:00',
    all_day: false,
    notes: '',
  });

  // Picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'appointment' | 'event'>('appointment');

  const { data: pins, isLoading, refetch } = useQuery({
    queryKey: ['pins'],
    queryFn: async () => {
      const response = await pinsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    staleTime: 30000,
    refetchOnMount: 'always',
  });

  // Load calendar events from AsyncStorage
  const calendarStorageKey = user?.sub ? `calendar-events-${user.sub}` : 'calendar-events';

  const { data: calendarEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['calendar-events', user?.sub],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(calendarStorageKey);
      return stored ? JSON.parse(stored) as CalendarEvent[] : [];
    },
    enabled: !!user?.sub,
  });

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchEvents();
    }, [refetch, refetchEvents])
  );

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: typeof appointmentForm) => {
      const appointmentData = {
        homeowner_name: data.homeowner_name,
        homeowner_phone: data.homeowner_phone || null,
        address: data.address,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        lat: 0,
        lng: 0,
        status: 'appointment' as const,
        appointment_date: data.all_day
          ? `${data.appointment_date}T09:00:00`
          : `${data.appointment_date}T${data.appointment_time}:00`,
        appointment_end_date: data.all_day
          ? null
          : `${data.appointment_date}T${data.appointment_end_time}:00`,
        appointment_all_day: data.all_day,
        notes: data.notes || null,
      };
      const result = await pinsApi.create(appointmentData);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pins'] });
      closeAddAppointmentModal();
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: typeof eventForm) => {
      const events = await AsyncStorage.getItem(calendarStorageKey);
      const existingEvents: CalendarEvent[] = events ? JSON.parse(events) : [];
      const newEvent: CalendarEvent = {
        id: Date.now().toString(),
        title: data.title,
        notes: data.notes,
        date: data.event_date,
        time: data.all_day ? undefined : data.event_time,
        end_time: data.all_day ? undefined : data.event_end_time,
        all_day: data.all_day,
        created_at: new Date().toISOString(),
      };
      existingEvents.push(newEvent);
      await AsyncStorage.setItem(calendarStorageKey, JSON.stringify(existingEvents));
      return newEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      closeAddEventModal();
    },
  });

  // Modal open/close functions
  const openAddAppointmentModal = () => {
    setAppointmentForm({
      homeowner_name: '',
      homeowner_phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      appointment_date: format(selectedDate || new Date(), 'yyyy-MM-dd'),
      appointment_time: '09:00',
      appointment_end_time: '10:00',
      all_day: false,
      notes: '',
    });
    setShowAddAppointmentModal(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeAddAppointmentModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowAddAppointmentModal(false);
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    });
  };

  const openAddEventModal = () => {
    setEventForm({
      title: '',
      event_date: format(selectedDate || new Date(), 'yyyy-MM-dd'),
      event_time: '09:00',
      event_end_time: '10:00',
      all_day: false,
      notes: '',
    });
    setShowAddEventModal(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeAddEventModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowAddEventModal(false);
    });
  };

  // Address autocomplete using reverse geocoding
  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    setIsSearchingAddress(true);
    try {
      // Use expo-location for geocoding
      const results = await Location.geocodeAsync(query);
      if (results.length > 0) {
        // Get reverse geocode for each result to get full address
        const suggestions = await Promise.all(
          results.slice(0, 5).map(async (result) => {
            const reverseResults = await Location.reverseGeocodeAsync({
              latitude: result.latitude,
              longitude: result.longitude,
            });
            if (reverseResults.length > 0) {
              const addr = reverseResults[0];
              return {
                ...result,
                address: addr,
                display: [
                  addr.streetNumber,
                  addr.street,
                  addr.city,
                  addr.region,
                  addr.postalCode,
                ].filter(Boolean).join(', '),
              };
            }
            return null;
          })
        );
        setAddressSuggestions(suggestions.filter(Boolean));
        setShowAddressSuggestions(true);
      }
    } catch (error) {
      console.log('Address search error:', error);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const selectAddressSuggestion = (suggestion: any) => {
    setAppointmentForm(prev => ({
      ...prev,
      address: [suggestion.address.streetNumber, suggestion.address.street].filter(Boolean).join(' '),
      city: suggestion.address.city || '',
      state: suggestion.address.region || '',
      zip_code: suggestion.address.postalCode || '',
    }));
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  // Filter pins with appointments
  const appointmentPins = useMemo(() => {
    return (pins || []).filter((pin) => pin.status === 'appointment' && pin.appointment_date);
  }, [pins]);

  // Get calendar grid days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  // Get appointments for each day
  const daysWithAppointments = useMemo(() => {
    const map = new Map<string, Pin[]>();
    appointmentPins.forEach((pin) => {
      if (pin.appointment_date) {
        const key = format(new Date(pin.appointment_date), 'yyyy-MM-dd');
        const existing = map.get(key) || [];
        map.set(key, [...existing, pin]);
      }
    });
    return map;
  }, [appointmentPins]);

  // Appointments for selected date
  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return daysWithAppointments.get(key) || [];
  }, [selectedDate, daysWithAppointments]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayAppts = appointmentPins.filter(
      (pin) => pin.appointment_date && isSameDay(new Date(pin.appointment_date), today)
    ).length;

    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    const thisWeekAppts = appointmentPins.filter((pin) => {
      if (!pin.appointment_date) return false;
      const date = new Date(pin.appointment_date);
      return date >= weekStart && date <= weekEnd;
    }).length;

    return { todayAppts, thisWeekAppts, totalAppts: appointmentPins.length };
  }, [appointmentPins]);

  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDayPress = (day: Date) => {
    setSelectedDate(isSameDay(day, selectedDate || new Date(0)) ? null : day);
  };

  const handleAppointmentPress = (pin: Pin) => {
    // Navigate to map with pin selected
    router.push(`/(rep)/map?pinId=${pin.id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
            <Ionicons name="chevron-back" size={20} color={colors.secondary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={20} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="today" size={16} color="#F59E0B" />
            <Text style={styles.statValue}>{stats.todayAppts}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="calendar" size={16} color="#8B5CF6" />
            <Text style={styles.statValue}>{stats.thisWeekAppts}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="list" size={16} color="#3B82F6" />
            <Text style={styles.statValue}>{stats.totalAppts}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.addAppointmentButton} onPress={openAddAppointmentModal}>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addButtonText}>Add Appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addEventButton} onPress={openAddEventModal}>
            <Ionicons name="calendar-outline" size={18} color={colors.secondary} />
            <Text style={styles.addEventButtonText}>Add Event</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Calendar Grid */}
        <View style={styles.calendarCard}>
          {/* Weekday Headers */}
          <View style={styles.weekdayRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={styles.weekdayText}>
                {day}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {calendarDays.map((day, index) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayAppointments = daysWithAppointments.get(key) || [];
              const hasAppointments = dayAppointments.length > 0;
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isTodayDate && styles.dayCellToday,
                  ]}
                  onPress={() => handleDayPress(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !isCurrentMonth && styles.dayTextMuted,
                      isSelected && styles.dayTextSelected,
                      isTodayDate && styles.dayTextToday,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                  {hasAppointments && (
                    <View style={styles.appointmentDots}>
                      {dayAppointments.slice(0, 3).map((_, i) => (
                        <View key={i} style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected Date Appointments */}
        {selectedDate && (
          <View style={styles.appointmentsSection}>
            <Text style={styles.sectionTitle}>
              {format(selectedDate, 'EEEE, MMMM d')}
            </Text>
            {selectedDateAppointments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={40} color="#9CA3AF" />
                <Text style={styles.emptyText}>No appointments scheduled</Text>
              </View>
            ) : (
              selectedDateAppointments.map((pin) => (
                <TouchableOpacity
                  key={pin.id}
                  style={styles.appointmentCard}
                  onPress={() => handleAppointmentPress(pin)}
                >
                  <View style={styles.appointmentTime}>
                    <Ionicons name="time" size={16} color="#8B5CF6" />
                    <Text style={styles.appointmentTimeText}>
                      {pin.appointment_date
                        ? format(new Date(pin.appointment_date), 'h:mm a')
                        : 'All day'}
                    </Text>
                  </View>
                  <View style={styles.appointmentDetails}>
                    <Text style={styles.appointmentName}>
                      {pin.homeowner_name || 'Unknown'}
                    </Text>
                    <Text style={styles.appointmentAddress} numberOfLines={1}>
                      {pin.address || 'No address'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Upcoming Appointments */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
          {appointmentPins.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={40} color="#9CA3AF" />
              <Text style={styles.emptyText}>No upcoming appointments</Text>
              <Text style={styles.emptySubtext}>
                Schedule appointments from the Map tab
              </Text>
            </View>
          ) : (
            appointmentPins
              .filter((pin) => pin.appointment_date && new Date(pin.appointment_date) >= new Date())
              .sort((a, b) => {
                const dateA = new Date(a.appointment_date || 0);
                const dateB = new Date(b.appointment_date || 0);
                return dateA.getTime() - dateB.getTime();
              })
              .slice(0, 5)
              .map((pin) => (
                <TouchableOpacity
                  key={pin.id}
                  style={styles.upcomingCard}
                  onPress={() => handleAppointmentPress(pin)}
                >
                  <View style={styles.upcomingDate}>
                    <Text style={styles.upcomingDay}>
                      {format(new Date(pin.appointment_date!), 'd')}
                    </Text>
                    <Text style={styles.upcomingMonth}>
                      {format(new Date(pin.appointment_date!), 'MMM')}
                    </Text>
                  </View>
                  <View style={styles.upcomingDetails}>
                    <Text style={styles.upcomingName}>
                      {pin.homeowner_name || 'Unknown'}
                    </Text>
                    <Text style={styles.upcomingAddress} numberOfLines={1}>
                      {pin.address || 'No address'}
                    </Text>
                    <Text style={styles.upcomingTime}>
                      {format(new Date(pin.appointment_date!), 'EEEE, h:mm a')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Appointment Modal */}
      <Modal
        visible={showAddAppointmentModal}
        transparent
        animationType="none"
        onRequestClose={closeAddAppointmentModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeAddAppointmentModal} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Appointment</Text>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Homeowner Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Homeowner Name *</Text>
                <TextInput
                  style={styles.input}
                  value={appointmentForm.homeowner_name}
                  onChangeText={(text) => setAppointmentForm(prev => ({ ...prev, homeowner_name: text }))}
                  placeholder="Enter name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={appointmentForm.homeowner_phone}
                  onChangeText={(text) => setAppointmentForm(prev => ({ ...prev, homeowner_phone: text }))}
                  placeholder="Enter phone"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>

              {/* Address with autocomplete */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>Address *</Text>
                  {isSearchingAddress && <ActivityIndicator size="small" color={colors.primary} />}
                </View>
                <TextInput
                  style={styles.input}
                  value={appointmentForm.address}
                  onChangeText={(text) => {
                    setAppointmentForm(prev => ({ ...prev, address: text }));
                    searchAddress(text);
                  }}
                  placeholder="Start typing address..."
                  placeholderTextColor="#9CA3AF"
                />
                {showAddressSuggestions && addressSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {addressSuggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => selectAddressSuggestion(suggestion)}
                      >
                        <Ionicons name="location-outline" size={16} color="#6B7280" />
                        <Text style={styles.suggestionText} numberOfLines={2}>
                          {suggestion.display}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* City, State, Zip */}
              <View style={styles.addressRow}>
                <View style={[styles.inputGroup, { flex: 2 }]}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.input}
                    value={appointmentForm.city}
                    onChangeText={(text) => setAppointmentForm(prev => ({ ...prev, city: text }))}
                    placeholder="City"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput
                    style={styles.input}
                    value={appointmentForm.state}
                    onChangeText={(text) => setAppointmentForm(prev => ({ ...prev, state: text }))}
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
                    value={appointmentForm.zip_code}
                    onChangeText={(text) => setAppointmentForm(prev => ({ ...prev, zip_code: text }))}
                    placeholder="12345"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
              </View>

              {/* Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date *</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => { setPickerTarget('appointment'); setShowDatePicker(true); }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  <Text style={styles.datePickerText}>
                    {format(new Date(appointmentForm.appointment_date), 'MMMM d, yyyy')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* All Day Toggle */}
              <View style={styles.toggleRow}>
                <Text style={styles.inputLabel}>All day appointment</Text>
                <Switch
                  value={appointmentForm.all_day}
                  onValueChange={(val) => setAppointmentForm(prev => ({ ...prev, all_day: val }))}
                  trackColor={{ false: '#E5E7EB', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Time */}
              {!appointmentForm.all_day && (
                <View style={styles.timeRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Start Time</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => { setPickerTarget('appointment'); setShowStartTimePicker(true); }}
                    >
                      <Ionicons name="time-outline" size={18} color="#6B7280" />
                      <Text style={styles.datePickerText}>
                        {timeOptions.find(t => t.value === appointmentForm.appointment_time)?.label || '9:00 AM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>End Time</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => { setPickerTarget('appointment'); setShowEndTimePicker(true); }}
                    >
                      <Ionicons name="time-outline" size={18} color="#6B7280" />
                      <Text style={styles.datePickerText}>
                        {timeOptions.find(t => t.value === appointmentForm.appointment_end_time)?.label || '10:00 AM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={appointmentForm.notes}
                  onChangeText={(text) => setAppointmentForm(prev => ({ ...prev, notes: text }))}
                  placeholder="Add notes..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeAddAppointmentModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!appointmentForm.homeowner_name || !appointmentForm.address) && styles.saveButtonDisabled]}
                onPress={() => createAppointmentMutation.mutate(appointmentForm)}
                disabled={createAppointmentMutation.isPending || !appointmentForm.homeowner_name || !appointmentForm.address}
              >
                {createAppointmentMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="calendar" size={18} color="#FFF" />
                    <Text style={styles.saveButtonText}>Create</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Event Modal */}
      <Modal
        visible={showAddEventModal}
        transparent
        animationType="none"
        onRequestClose={closeAddEventModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeAddEventModal} />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Event</Text>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Event Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Event Title *</Text>
                <TextInput
                  style={styles.input}
                  value={eventForm.title}
                  onChangeText={(text) => setEventForm(prev => ({ ...prev, title: text }))}
                  placeholder="Enter event title"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date *</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => { setPickerTarget('event'); setShowDatePicker(true); }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  <Text style={styles.datePickerText}>
                    {format(new Date(eventForm.event_date), 'MMMM d, yyyy')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* All Day Toggle */}
              <View style={styles.toggleRow}>
                <Text style={styles.inputLabel}>All day event</Text>
                <Switch
                  value={eventForm.all_day}
                  onValueChange={(val) => setEventForm(prev => ({ ...prev, all_day: val }))}
                  trackColor={{ false: '#E5E7EB', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Time */}
              {!eventForm.all_day && (
                <View style={styles.timeRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Start Time</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => { setPickerTarget('event'); setShowStartTimePicker(true); }}
                    >
                      <Ionicons name="time-outline" size={18} color="#6B7280" />
                      <Text style={styles.datePickerText}>
                        {timeOptions.find(t => t.value === eventForm.event_time)?.label || '9:00 AM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>End Time</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => { setPickerTarget('event'); setShowEndTimePicker(true); }}
                    >
                      <Ionicons name="time-outline" size={18} color="#6B7280" />
                      <Text style={styles.datePickerText}>
                        {timeOptions.find(t => t.value === eventForm.event_end_time)?.label || '10:00 AM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={eventForm.notes}
                  onChangeText={(text) => setEventForm(prev => ({ ...prev, notes: text }))}
                  placeholder="Add notes..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeAddEventModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, styles.eventSaveButton, !eventForm.title && styles.saveButtonDisabled]}
                onPress={() => createEventMutation.mutate(eventForm)}
                disabled={createEventMutation.isPending || !eventForm.title}
              >
                {createEventMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={styles.saveButtonText}>Create</Text>
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
              {Array.from({ length: 60 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dateStr = format(date, 'yyyy-MM-dd');
                const currentValue = pickerTarget === 'appointment' ? appointmentForm.appointment_date : eventForm.event_date;
                const isSelected = currentValue === dateStr;
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                    onPress={() => {
                      if (pickerTarget === 'appointment') {
                        setAppointmentForm(prev => ({ ...prev, appointment_date: dateStr }));
                      } else {
                        setEventForm(prev => ({ ...prev, event_date: dateStr }));
                      }
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
                const currentValue = pickerTarget === 'appointment' ? appointmentForm.appointment_time : eventForm.event_time;
                const isSelected = currentValue === time.value;
                return (
                  <TouchableOpacity
                    key={time.value}
                    style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                    onPress={() => {
                      if (pickerTarget === 'appointment') {
                        setAppointmentForm(prev => ({ ...prev, appointment_time: time.value }));
                      } else {
                        setEventForm(prev => ({ ...prev, event_time: time.value }));
                      }
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
                const currentValue = pickerTarget === 'appointment' ? appointmentForm.appointment_end_time : eventForm.event_end_time;
                const isSelected = currentValue === time.value;
                return (
                  <TouchableOpacity
                    key={time.value}
                    style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                    onPress={() => {
                      if (pickerTarget === 'appointment') {
                        setAppointmentForm(prev => ({ ...prev, appointment_end_time: time.value }));
                      } else {
                        setEventForm(prev => ({ ...prev, event_end_time: time.value }));
                      }
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  navButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    minWidth: 150,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  calendarCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  dayTextMuted: {
    color: '#D1D5DB',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  appointmentDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  appointmentsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appointmentTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 90,
  },
  appointmentTimeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  appointmentDetails: {
    flex: 1,
    marginLeft: 8,
  },
  appointmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  appointmentAddress: {
    fontSize: 12,
    color: '#6B7280',
  },
  upcomingSection: {
    paddingHorizontal: 16,
  },
  upcomingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  upcomingDate: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  upcomingMonth: {
    fontSize: 11,
    color: '#8B5CF6',
    textTransform: 'uppercase',
  },
  upcomingDetails: {
    flex: 1,
    marginLeft: 12,
  },
  upcomingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  upcomingAddress: {
    fontSize: 12,
    color: '#6B7280',
  },
  upcomingTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  addAppointmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#8B5CF6',
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addEventButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addEventButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
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
    maxHeight: SCREEN_HEIGHT * 0.9,
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
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    textAlignVertical: 'top',
  },
  addressRow: {
    flexDirection: 'row',
    gap: 10,
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 150,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
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
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventSaveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Picker Modal Styles
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
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  pickerOptionTextSelected: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
});
