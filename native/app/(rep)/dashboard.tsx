import { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { dealsApi, pinsApi } from '../../src/services/api';
import { colors } from '../../src/constants/config';

export default function RepDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const { data: deals, isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const response = await dealsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    staleTime: 30000,
    refetchOnMount: 'always',
  });

  const { data: pins, isLoading: pinsLoading, refetch: refetchPins } = useQuery({
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
      refetchDeals();
      refetchPins();
    }, [refetchDeals, refetchPins])
  );

  const refreshing = dealsLoading || pinsLoading;

  const onRefresh = () => {
    refetchDeals();
    refetchPins();
  };

  // Calculate lead stats like web app
  const leadStats = useMemo(() => {
    if (!pins) return { totalLeads: 0, todayAppointments: 0, thisWeekAppointments: 0, installedCount: 0, conversionRate: 0 };

    const totalLeads = pins.length;
    const installedCount = pins.filter(pin => pin.status === 'installed').length;
    const conversionRate = totalLeads > 0 ? Math.round((installedCount / totalLeads) * 100) : 0;

    const appointmentPins = pins.filter(pin => pin.status === 'appointment' && pin.appointment_date);
    const todayAppointments = appointmentPins.filter(pin =>
      pin.appointment_date && isToday(new Date(pin.appointment_date))
    ).length;

    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(new Date());
    const thisWeekAppointments = appointmentPins.filter(pin => {
      if (!pin.appointment_date) return false;
      const apptDate = new Date(pin.appointment_date);
      return apptDate >= weekStart && apptDate <= weekEnd;
    }).length;

    return { totalLeads, todayAppointments, thisWeekAppointments, installedCount, conversionRate };
  }, [pins]);

  // Recent activity (last 7 days)
  const recentActivity = useMemo(() => {
    if (!pins) return [];
    const sevenDaysAgo = subDays(new Date(), 7);
    return pins
      .filter(pin => new Date(pin.created_at) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [pins]);

  // Pipeline stats
  const activeDeals = deals?.filter(d => !['complete', 'cancelled', 'lead'].includes(d.status)) || [];
  const pipelineValue = activeDeals.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header Bar - matching web */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>TP</Text>
          </View>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Lead Generation KPI Cards - matching web */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>Total Leads</Text>
              <Text style={styles.kpiValue}>{leadStats.totalLeads}</Text>
            </View>
            <View style={[styles.kpiIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Ionicons name="people" size={20} color="#3B82F6" />
            </View>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>Today</Text>
              <Text style={styles.kpiValue}>{leadStats.todayAppointments}</Text>
            </View>
            <View style={[styles.kpiIcon, { backgroundColor: 'rgba(201, 162, 77, 0.1)' }]}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
            </View>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>This Week</Text>
              <Text style={styles.kpiValue}>{leadStats.thisWeekAppointments}</Text>
            </View>
            <View style={[styles.kpiIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
              <Ionicons name="trending-up" size={20} color="#22C55E" />
            </View>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>Conversion</Text>
              <Text style={styles.kpiValue}>{leadStats.conversionRate}%</Text>
            </View>
            <View style={[styles.kpiIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
              <Ionicons name="checkmark-done" size={20} color="#8B5CF6" />
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recent Activity</Text>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No recent activity</Text>
            </View>
          ) : (
            recentActivity.map((pin) => (
              <View key={pin.id} style={styles.activityCard}>
                <View style={styles.activityRow}>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>
                      {pin.homeowner_name || 'Unknown'} - {pin.status}
                    </Text>
                    <Text style={styles.activityDate}>
                      {format(new Date(pin.created_at), 'MMM d, h:mm a')}
                    </Text>
                  </View>
                  <Text style={styles.activityAddress} numberOfLines={1}>
                    {pin.address ? pin.address.split(',')[0] : 'No address'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Pipeline Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pipeline Overview</Text>
          <View style={styles.pipelineCard}>
            <View style={styles.pipelineRow}>
              <View style={styles.pipelineStat}>
                <Ionicons name="document-text" size={24} color={colors.primary} />
                <View>
                  <Text style={styles.pipelineValue}>{activeDeals.length}</Text>
                  <Text style={styles.pipelineLabel}>Active Deals</Text>
                </View>
              </View>
              <View style={styles.pipelineDivider} />
              <View style={styles.pipelineStat}>
                <Ionicons name="cash" size={24} color="#22C55E" />
                <View>
                  <Text style={[styles.pipelineValue, { color: '#22C55E' }]}>
                    ${(pipelineValue / 1000).toFixed(0)}k
                  </Text>
                  <Text style={styles.pipelineLabel}>Pipeline Value</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.viewPipelineButton}
              onPress={() => router.push('/(rep)/deals')}
            >
              <Text style={styles.viewPipelineText}>View Pipeline</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push({ pathname: '/(rep)/deals/new' })}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(201, 162, 77, 0.1)' }]}>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>New Deal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(rep)/map')}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="map" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.actionLabel}>Add Pin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(rep)/calendar')}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                <Ionicons name="calendar" size={24} color="#8B5CF6" />
              </View>
              <Text style={styles.actionLabel}>Calendar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(rep)/deals')}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Ionicons name="list" size={24} color="#22C55E" />
              </View>
              <Text style={styles.actionLabel}>My Deals</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 32,
    height: 32,
    backgroundColor: colors.secondary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  signOutButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  kpiContent: {
    flex: 1,
  },
  kpiLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  activityDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  activityAddress: {
    fontSize: 12,
    color: '#6B7280',
    maxWidth: 120,
    textAlign: 'right',
  },
  pipelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipelineStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pipelineDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  pipelineValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  pipelineLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  viewPipelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 4,
  },
  viewPipelineText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
});
