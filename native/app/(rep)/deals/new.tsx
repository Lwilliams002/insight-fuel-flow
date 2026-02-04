import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { dealsApi } from '../../../src/services/api';
import { colors } from '../../../src/constants/config';

export default function NewDealScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    insurance_company: '',
    claim_number: '',
    rcv: '',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await dealsApi.create({
        ...data,
        rcv: data.rcv ? parseFloat(data.rcv) : undefined,
        status: 'lead',
      });
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      Alert.alert('Success', 'Deal created successfully');
      router.replace({ pathname: '/(rep)/deals/[id]', params: { id: deal?.id } });
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to create deal');
    },
  });

  const handleSubmit = () => {
    if (!formData.homeowner_name.trim()) {
      Alert.alert('Error', 'Homeowner name is required');
      return;
    }
    if (!formData.address.trim()) {
      Alert.alert('Error', 'Address is required');
      return;
    }

    createMutation.mutate(formData);
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Deal</Text>
        <TouchableOpacity
          style={[styles.saveButton, createMutation.isPending && styles.saveButtonDisabled]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          {/* Homeowner Info */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="person" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Homeowner Info</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="John Smith"
                placeholderTextColor="#9CA3AF"
                value={formData.homeowner_name}
                onChangeText={(v) => updateField('homeowner_name', v)}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="(555) 555-5555"
                placeholderTextColor="#9CA3AF"
                value={formData.homeowner_phone}
                onChangeText={(v) => updateField('homeowner_phone', v)}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="john@example.com"
                placeholderTextColor="#9CA3AF"
                value={formData.homeowner_email}
                onChangeText={(v) => updateField('homeowner_email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Property Info */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="location" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Property Address</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Street Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="123 Main St"
                placeholderTextColor="#9CA3AF"
                value={formData.address}
                onChangeText={(v) => updateField('address', v)}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="City"
                  placeholderTextColor="#9CA3AF"
                  value={formData.city}
                  onChangeText={(v) => updateField('city', v)}
                />
              </View>
              <View style={[styles.inputGroup, { width: 80 }]}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  style={styles.input}
                  placeholder="CA"
                  placeholderTextColor="#9CA3AF"
                  value={formData.state}
                  onChangeText={(v) => updateField('state', v)}
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ZIP Code</Text>
              <TextInput
                style={styles.input}
                placeholder="12345"
                placeholderTextColor="#9CA3AF"
                value={formData.zip_code}
                onChangeText={(v) => updateField('zip_code', v)}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          </View>

          {/* Insurance Info */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="business" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Insurance (Optional)</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Insurance Company</Text>
              <TextInput
                style={styles.input}
                placeholder="State Farm"
                placeholderTextColor="#9CA3AF"
                value={formData.insurance_company}
                onChangeText={(v) => updateField('insurance_company', v)}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Claim Number</Text>
              <TextInput
                style={styles.input}
                placeholder="CLM-12345"
                placeholderTextColor="#9CA3AF"
                value={formData.claim_number}
                onChangeText={(v) => updateField('claim_number', v)}
              />
            </View>
          </View>

          {/* Value */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="cash" size={18} color="#22C55E" />
              <Text style={styles.cardTitle}>Estimated Value</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>RCV (Replacement Cost Value)</Text>
              <TextInput
                style={styles.input}
                placeholder="15000"
                placeholderTextColor="#9CA3AF"
                value={formData.rcv}
                onChangeText={(v) => updateField('rcv', v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Notes */}
          <View style={[styles.card, { marginBottom: 24 }]}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any additional notes..."
                placeholderTextColor="#9CA3AF"
                value={formData.notes}
                onChangeText={(v) => updateField('notes', v)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
