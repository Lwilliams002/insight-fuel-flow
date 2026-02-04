import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { dealsApi } from '../../../src/services/api';
import { colors } from '../../../src/constants/config';

const statusConfig: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: '#64748B' },
  inspection_scheduled: { label: 'Inspected', color: '#3B82F6' },
  claim_filed: { label: 'Claim Filed', color: '#8B5CF6' },
  adjuster_met: { label: 'Adjuster Met', color: '#EC4899' },
  approved: { label: 'Approved', color: '#14B8A6' },
  signed: { label: 'Signed', color: '#22C55E' },
  collect_acv: { label: 'Collect ACV', color: '#F97316' },
  collect_deductible: { label: 'Collect Ded.', color: '#F59E0B' },
  install_scheduled: { label: 'Scheduled', color: '#06B6D4' },
  installed: { label: 'Installed', color: '#14B8A6' },
  invoice_sent: { label: 'Invoice Sent', color: '#6366F1' },
  complete: { label: 'Complete', color: '#10B981' },
};

const phaseConfig = {
  sign: { label: 'Sign', icon: '✍️', color: '#3B82F6', borderColor: '#3B82F6' },
  build: { label: 'Build', icon: '🔨', color: '#F97316', borderColor: '#F97316' },
  finalizing: { label: 'Finalizing', icon: '📋', color: '#EAB308', borderColor: '#EAB308' },
  complete: { label: 'Complete', icon: '✅', color: '#22C55E', borderColor: '#22C55E' },
};

function getProgressPercentage(status: string): number {
  const statusOrder = [
    'lead', 'inspection_scheduled', 'claim_filed', 'adjuster_met',
    'approved', 'signed', 'collect_acv', 'collect_deductible',
    'install_scheduled', 'installed', 'invoice_sent', 'complete'
  ];
  const index = statusOrder.indexOf(status);
  if (index === -1) return 0;
  return Math.round(((index + 1) / statusOrder.length) * 100);
}

type ViewMode = 'pipeline' | 'leads';

export default function DealsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');

  const { data: deals, isLoading, refetch } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const response = await dealsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    staleTime: 30000, // 30 seconds
    refetchOnMount: 'always',
  });

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Group deals by phase like web app
  const dealsByPhase = useMemo(() => ({
    sign: deals?.filter(d => ['inspection_scheduled', 'claim_filed', 'adjuster_met', 'approved', 'signed'].includes(d.status)) || [],
    build: deals?.filter(d => ['collect_acv', 'collect_deductible', 'install_scheduled', 'installed'].includes(d.status)) || [],
    finalizing: deals?.filter(d => ['invoice_sent', 'depreciation_collected'].includes(d.status)) || [],
    complete: deals?.filter(d => d.status === 'complete') || [],
  }), [deals]);

  // Filter leads separately
  const leads = deals?.filter(d => d.status === 'lead') || [];

  // Calculate phase values
  const phaseValues = useMemo(() => ({
    sign: dealsByPhase.sign.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
    build: dealsByPhase.build.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
    finalizing: dealsByPhase.finalizing.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
    complete: dealsByPhase.complete.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
  }), [dealsByPhase]);

  const filteredDeals = useMemo(() => {
    const dealsToFilter = viewMode === 'leads' ? leads : deals?.filter(d => d.status !== 'lead') || [];

    if (!searchQuery.trim()) return dealsToFilter;

    const query = searchQuery.toLowerCase();
    return dealsToFilter.filter(deal =>
      deal.homeowner_name?.toLowerCase().includes(query) ||
      deal.address?.toLowerCase().includes(query) ||
      deal.city?.toLowerCase().includes(query)
    );
  }, [deals, leads, searchQuery, viewMode]);

  const pipelineValue = filteredDeals.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>My Pipeline</Text>
            <Text style={styles.subtitle}>
              {viewMode === 'leads'
                ? `${leads.length} leads`
                : `${filteredDeals.length} deals · $${(pipelineValue / 1000).toFixed(0)}k`
              }
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push({ pathname: '/(rep)/deals/new' })}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* View Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'pipeline' && styles.toggleButtonActive]}
            onPress={() => setViewMode('pipeline')}
          >
            <Ionicons name="grid" size={16} color={viewMode === 'pipeline' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.toggleText, viewMode === 'pipeline' && styles.toggleTextActive]}>Pipeline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'leads' && styles.toggleButtonActive]}
            onPress={() => setViewMode('leads')}
          >
            <Ionicons name="list" size={16} color={viewMode === 'leads' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.toggleText, viewMode === 'leads' && styles.toggleTextActive]}>Leads ({leads.length})</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            placeholder="Search by name, address..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {/* Phase Summary Cards - only show in pipeline view */}
        {viewMode === 'pipeline' && (
          <View style={styles.phaseGrid}>
            {(['sign', 'build', 'finalizing', 'complete'] as const).map((phase) => (
              <View key={phase} style={[styles.phaseCard, { borderLeftColor: phaseConfig[phase].borderColor }]}>
                <View style={styles.phaseHeader}>
                  <Text style={styles.phaseIcon}>{phaseConfig[phase].icon}</Text>
                  <Text style={styles.phaseLabel}>{phaseConfig[phase].label}</Text>
                </View>
                <Text style={styles.phaseCount}>{dealsByPhase[phase].length}</Text>
                <Text style={styles.phaseValue}>${(phaseValues[phase] / 1000).toFixed(0)}k</Text>
              </View>
            ))}
          </View>
        )}

        {/* Deals List */}
        {filteredDeals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={40} color="#9CA3AF" />
            <Text style={styles.emptyText}>
              {searchQuery
                ? `No ${viewMode === 'leads' ? 'leads' : 'deals'} found matching "${searchQuery}"`
                : viewMode === 'leads'
                  ? 'No leads yet'
                  : 'No deals in pipeline'
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push({ pathname: '/(rep)/deals/new' })}
              >
                <Text style={styles.createButtonText}>Create New Deal</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredDeals.map((deal) => {
            const config = statusConfig[deal.status] || statusConfig.lead;
            const progress = getProgressPercentage(deal.status);

            return (
              <TouchableOpacity
                key={deal.id}
                onPress={() => router.push({ pathname: '/(rep)/deals/[id]', params: { id: deal.id } })}
                activeOpacity={0.7}
                style={styles.dealCard}
              >
                <View style={styles.dealContent}>
                  <View style={styles.dealInfo}>
                    <View style={styles.dealHeader}>
                      <Text style={styles.dealName} numberOfLines={1}>{deal.homeowner_name}</Text>
                      <View style={[styles.badge, { borderColor: config.color }]}>
                        <Text style={[styles.badgeText, { color: config.color }]}>
                          {config.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.dealAddress} numberOfLines={1}>
                      {deal.address}
                      {deal.city && `, ${deal.city}`}
                    </Text>
                    <View style={styles.dealFooter}>
                      <Text style={styles.dealPrice}>
                        ${(deal.rcv || deal.total_price || 0).toLocaleString()}
                      </Text>
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{progress}%</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          })
        )}
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  phaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  phaseCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  phaseIcon: {
    fontSize: 14,
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  phaseCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  phaseValue: {
    fontSize: 11,
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
  createButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dealContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  dealInfo: {
    flex: 1,
  },
  dealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dealName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dealAddress: {
    fontSize: 13,
    color: '#6B7280',
  },
  dealFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dealPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    width: 60,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: '#9CA3AF',
    width: 30,
  },
});
