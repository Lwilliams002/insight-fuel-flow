import { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { dealsApi, Deal } from '../../src/services/api';
import { colors as staticColors } from '../../src/constants/config';

// Import logo
const logo = require('../../assets/logo.png');

export default function CrewDashboard() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  // Handle sign out with confirmation
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Navigate to login after sign out
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Sign out error:', error);
              // Still try to navigate even if sign out had an error
              router.replace('/(auth)/login');
            }
          },
        },
      ]
    );
  };

  // Fetch deals that are scheduled for install or installed (need completion photos)
  const { data: deals, isLoading, refetch } = useQuery({
    queryKey: ['deals', 'crew'],
    queryFn: async () => {
      const response = await dealsApi.list();
      if (response.error) throw new Error(response.error);
      // Filter to only show deals that need crew action
      return (response.data || []).filter(d =>
        ['install_scheduled', 'installed'].includes(d.status)
      );
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const scheduledJobs = deals?.filter(d => d.status === 'install_scheduled') || [];
  const needsCompletion = deals?.filter(d => d.status === 'installed') || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Image source={logo} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Crew Dashboard</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{format(new Date(), 'EEEE, MMMM d')}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Welcome Message */}
        <View style={[styles.welcomeCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <Ionicons name="construct" size={28} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>Welcome, {user?.fullName || 'Crew Member'}</Text>
            <Text style={[styles.welcomeText, { color: colors.mutedForeground }]}>
              You have {scheduledJobs.length} scheduled job(s) and {needsCompletion.length} needing completion photos
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Ionicons name="calendar" size={20} color="#3B82F6" />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{scheduledJobs.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Scheduled</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Ionicons name="camera" size={20} color="#F59E0B" />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{needsCompletion.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Need Photos</Text>
          </View>
        </View>

        {/* Scheduled Jobs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={20} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Scheduled Installations</Text>
          </View>

          {scheduledJobs.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Scheduled Jobs</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Check back later for new assignments</Text>
            </View>
          ) : (
            scheduledJobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}
                onPress={() => router.push(`/(crew)/jobs/${job.id}`)}
              >
                <View style={styles.jobCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.jobCardTitle, { color: colors.foreground }]}>{job.homeowner_name}</Text>
                    <Text style={[styles.jobCardAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{job.address}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#DBEAFE' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#1D4ED8' }]}>Scheduled</Text>
                  </View>
                </View>
                {job.install_date && (
                  <View style={[styles.jobCardDate, { borderTopColor: colors.border }]}>
                    <Ionicons name="calendar" size={16} color={colors.primary} />
                    <Text style={[styles.jobCardDateText, { color: colors.foreground }]}>
                      {format(new Date(job.install_date), 'EEEE, MMMM d, yyyy')}
                    </Text>
                    {job.install_time && (
                      <Text style={[styles.jobCardTime, { color: colors.mutedForeground }]}>
                        at {job.install_time}
                      </Text>
                    )}
                  </View>
                )}
                <View style={styles.jobCardFooter}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}
                    onPress={() => router.push(`/(crew)/jobs/${job.id}`)}
                  >
                    <Ionicons name="arrow-forward" size={16} color="#3B82F6" />
                    <Text style={{ color: '#3B82F6', fontSize: 13, fontWeight: '600' }}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Needs Completion Photos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera" size={20} color="#F59E0B" />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Needs Completion Photos</Text>
          </View>

          {needsCompletion.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All Caught Up!</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No jobs needing completion photos</Text>
            </View>
          ) : (
            needsCompletion.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: '#F59E0B', borderLeftWidth: 4 }]}
                onPress={() => router.push(`/(crew)/jobs/${job.id}`)}
              >
                <View style={styles.jobCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.jobCardTitle, { color: colors.foreground }]}>{job.homeowner_name}</Text>
                    <Text style={[styles.jobCardAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{job.address}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>Needs Photos</Text>
                  </View>
                </View>
                <View style={styles.jobCardFooter}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}
                    onPress={() => router.push(`/(crew)/jobs/${job.id}`)}
                  >
                    <Ionicons name="camera" size={16} color="#F59E0B" />
                    <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '600' }}>Upload Photos</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogo: { width: 40, height: 40 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 12 },
  logoutButton: { padding: 8 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  welcomeTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  welcomeText: { fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12 },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  jobCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  jobCardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  jobCardAddress: { fontSize: 13 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  jobCardDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  jobCardDateText: { fontSize: 14, fontWeight: '500' },
  jobCardTime: { fontSize: 13 },
  jobCardFooter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});



