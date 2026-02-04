import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { dealsApi, repsApi } from '../../src/services/api';
import { colors } from '../../src/constants/config';

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: deals, isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ['deals', 'admin'],
    queryFn: async () => {
      const response = await dealsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  const { data: reps, isLoading: repsLoading, refetch: refetchReps } = useQuery({
    queryKey: ['reps'],
    queryFn: async () => {
      const response = await repsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  const refreshing = dealsLoading || repsLoading;

  const onRefresh = () => {
    refetchDeals();
    refetchReps();
  };

  const totalDeals = deals?.length || 0;
  const totalValue = deals?.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0) || 0;
  const activeReps = reps?.filter(r => r.active)?.length || 0;
  const needsAction = deals?.filter(d =>
    ['signed', 'collect_acv', 'collect_deductible', 'install_scheduled', 'installed'].includes(d.status)
  )?.length || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Admin Dashboard</Text>
          <Text style={styles.userName}>{user?.fullName || 'Admin'}</Text>
          <Text style={styles.dateText}>
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statLabel}>Total Deals</Text>
                <Text style={styles.statValue}>{totalDeals}</Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(201, 162, 77, 0.1)' }]}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statLabel}>Needs Action</Text>
                <Text style={[styles.statValue, { color: '#F97316' }]}>{needsAction}</Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
                <Ionicons name="alert-circle" size={20} color="#F97316" />
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statLabel}>Total Value</Text>
                <Text style={[styles.statValue, { color: '#22C55E' }]}>
                  ${(totalValue / 1000).toFixed(0)}k
                </Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Ionicons name="cash" size={20} color="#22C55E" />
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statLabel}>Active Reps</Text>
                <Text style={styles.statValue}>{activeReps}</Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="people" size={20} color="#3B82F6" />
              </View>
            </View>
          </View>
        </View>

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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.secondary,
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  dateText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
