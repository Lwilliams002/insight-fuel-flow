import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { repsApi } from '../../src/services/api';
import { colors } from '../../src/constants/config';

export default function RepsScreen() {
  const { data: reps, isLoading, refetch } = useQuery({
    queryKey: ['reps'],
    queryFn: async () => {
      const response = await repsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  const activeReps = reps?.filter(r => r.active) || [];
  const inactiveReps = reps?.filter(r => !r.active) || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sales Reps</Text>
          <Text style={styles.subtitle}>
            {activeReps.length} active · {inactiveReps.length} inactive
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="person-add" size={16} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {reps?.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No reps found</Text>
          </View>
        ) : (
          reps?.map((rep) => (
            <TouchableOpacity key={rep.id} activeOpacity={0.7} style={styles.repCard}>
              <View style={styles.repContent}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color={colors.primary} />
                </View>
                <View style={styles.repInfo}>
                  <Text style={styles.repName}>
                    {rep.full_name || rep.email || 'Unknown'}
                  </Text>
                  <Text style={styles.repEmail}>{rep.email}</Text>
                  <View style={styles.repMeta}>
                    <View style={[styles.badge, rep.active ? styles.badgeActive : styles.badgeInactive]}>
                      <Text style={[styles.badgeText, rep.active ? styles.badgeTextActive : styles.badgeTextInactive]}>
                        {rep.active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    <Text style={styles.commissionText}>
                      {rep.commission_level} · {rep.default_commission_percent}%
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
    color: '#6B7280',
  },
  repCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  repContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(201, 162, 77, 0.1)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  repInfo: {
    flex: 1,
  },
  repName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  repEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  repMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  badgeInactive: {
    backgroundColor: '#F3F4F6',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgeTextActive: {
    color: '#22C55E',
  },
  badgeTextInactive: {
    color: '#6B7280',
  },
  commissionText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
