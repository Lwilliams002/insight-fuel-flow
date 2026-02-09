import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { dealsApi } from '../../../src/services/api';
import { colors as staticColors } from '../../../src/constants/config';
import { useTheme } from '../../../src/contexts/ThemeContext';

const statusConfig: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: '#64748B' },
  inspection_scheduled: { label: 'Inspected', color: '#3B82F6' },
  claim_filed: { label: 'Claim Filed', color: '#8B5CF6' },
  signed: { label: 'Signed', color: '#22C55E' },
  adjuster_met: { label: 'Adjuster Met', color: '#EC4899' },
  awaiting_approval: { label: 'Awaiting Approval', color: '#F59E0B' },
  approved: { label: 'Approved', color: '#14B8A6' },
  acv_collected: { label: 'ACV Collected', color: '#F97316' },
  deductible_collected: { label: 'Ded. Collected', color: '#F59E0B' },
  materials_selected: { label: 'Materials', color: '#8B5CF6' },
  install_scheduled: { label: 'Scheduled', color: '#06B6D4' },
  installed: { label: 'Installed', color: '#14B8A6' },
  completion_signed: { label: 'Completion Form', color: '#06B6D4' },
  invoice_sent: { label: 'RCV Sent', color: '#6366F1' },
  depreciation_collected: { label: 'Depreciation', color: '#8B5CF6' },
  complete: { label: 'Complete', color: '#10B981' },
  paid: { label: 'Paid', color: '#059669' },
};

const phaseConfig = {
  sign: { label: 'Sign', icon: '✍️', color: '#3B82F6', borderColor: '#3B82F6' },
  build: { label: 'Build', icon: '🔨', color: '#F97316', borderColor: '#F97316' },
  finalizing: { label: 'Finalizing', icon: '📋', color: '#EAB308', borderColor: '#EAB308' },
  complete: { label: 'Complete', icon: '✅', color: '#22C55E', borderColor: '#22C55E' },
};

type ViewMode = 'pipeline' | 'leads';
type PhaseFilter = 'sign' | 'build' | 'finalizing' | 'complete' | null;

export default function DealsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>(null);

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
    sign: deals?.filter(d => ['inspection_scheduled', 'claim_filed', 'signed', 'adjuster_met', 'awaiting_approval', 'approved'].includes(d.status)) || [],
    build: deals?.filter(d => ['acv_collected', 'deductible_collected', 'materials_selected', 'install_scheduled', 'installed'].includes(d.status)) || [],
    finalizing: deals?.filter(d => ['completion_signed', 'invoice_sent', 'depreciation_collected'].includes(d.status)) || [],
    complete: deals?.filter(d => ['complete', 'paid'].includes(d.status)) || [],
  }), [deals]);

  // Filter leads separately
  const leads = deals?.filter(d => d.status === 'lead') || [];

  // Calculate phase values with proper number validation
  const safeNumber = (val: string | number | null | undefined): number => {
    if (val === null || val === undefined || val === '') return 0;
    const num = typeof val === 'number' ? val : Number(val);
    // Only filter out truly invalid numbers, not legitimate large values
    if (isNaN(num) || !isFinite(num)) return 0;
    return num;
  };

  // Get deal value - prefer RCV, fall back to total_price
  const getDealValue = (d: { rcv?: number | null; total_price?: number | null }): number => {
    const rcv = safeNumber(d.rcv);
    const totalPrice = safeNumber(d.total_price);
    return rcv > 0 ? rcv : totalPrice;
  };

  const phaseValues = useMemo(() => ({
    sign: dealsByPhase.sign.reduce((sum, d) => sum + getDealValue(d), 0),
    build: dealsByPhase.build.reduce((sum, d) => sum + getDealValue(d), 0),
    finalizing: dealsByPhase.finalizing.reduce((sum, d) => sum + getDealValue(d), 0),
    complete: dealsByPhase.complete.reduce((sum, d) => sum + getDealValue(d), 0),
  }), [dealsByPhase]);

  const filteredDeals = useMemo(() => {
    let dealsToFilter = viewMode === 'leads' ? leads : deals?.filter(d => d.status !== 'lead') || [];

    // Apply phase filter if set
    if (phaseFilter && viewMode === 'pipeline') {
      dealsToFilter = dealsByPhase[phaseFilter];
    }

    if (!searchQuery.trim()) return dealsToFilter;

    const query = searchQuery.toLowerCase();
    return dealsToFilter.filter(deal =>
      deal.homeowner_name?.toLowerCase().includes(query) ||
      deal.address?.toLowerCase().includes(query) ||
      deal.city?.toLowerCase().includes(query)
    );
  }, [deals, leads, searchQuery, viewMode, phaseFilter, dealsByPhase]);

  const pipelineValue = filteredDeals.reduce((sum, d) => sum + getDealValue(d), 0);

  // Format currency for display
  const formatCurrency = (value: number): string => {
    if (!isFinite(value) || isNaN(value)) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>My Pipeline</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {viewMode === 'leads'
                ? `${leads.length} leads`
                : `${filteredDeals.length} deals · ${formatCurrency(pipelineValue)}`
              }
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/(rep)/deals/new' })}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* View Toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'pipeline' && [styles.toggleButtonActive, { backgroundColor: colors.primary }]]}
            onPress={() => setViewMode('pipeline')}
          >
            <Ionicons name="grid" size={16} color={viewMode === 'pipeline' ? '#FFFFFF' : colors.mutedForeground} />
            <Text style={[styles.toggleText, { color: colors.mutedForeground }, viewMode === 'pipeline' && styles.toggleTextActive]}>Pipeline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'leads' && [styles.toggleButtonActive, { backgroundColor: colors.primary }]]}
            onPress={() => setViewMode('leads')}
          >
            <Ionicons name="list" size={16} color={viewMode === 'leads' ? '#FFFFFF' : colors.mutedForeground} />
            <Text style={[styles.toggleText, { color: colors.mutedForeground }, viewMode === 'leads' && styles.toggleTextActive]}>Leads ({leads.length})</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            placeholder="Search by name, address..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholderTextColor={colors.mutedForeground}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
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
          <>
            {/* Phase filter indicator */}
            {phaseFilter && (
              <View style={[styles.filterIndicator, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: phaseConfig[phaseFilter].borderColor }]}>
                <Text style={[styles.filterIndicatorText, { color: colors.foreground }]}>
                  Showing: {phaseConfig[phaseFilter].icon} {phaseConfig[phaseFilter].label} ({dealsByPhase[phaseFilter].length} deals)
                </Text>
                <TouchableOpacity onPress={() => setPhaseFilter(null)}>
                  <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.phaseGrid}>
              {(['sign', 'build', 'finalizing', 'complete'] as const).map((phase) => (
                <TouchableOpacity
                  key={phase}
                  style={[
                    styles.phaseCard,
                    {
                      backgroundColor: isDark ? colors.muted : '#FFFFFF',
                      borderLeftColor: phaseConfig[phase].borderColor,
                      borderWidth: phaseFilter === phase ? 2 : 0,
                      borderColor: phaseFilter === phase ? phaseConfig[phase].borderColor : 'transparent',
                    }
                  ]}
                  onPress={() => setPhaseFilter(phaseFilter === phase ? null : phase)}
                  activeOpacity={0.7}
                >
                  <View style={styles.phaseHeader}>
                    <Text style={styles.phaseIcon}>{phaseConfig[phase].icon}</Text>
                    <Text style={[styles.phaseLabel, { color: colors.mutedForeground }]}>{phaseConfig[phase].label}</Text>
                  </View>
                  <Text style={[styles.phaseCount, { color: phaseFilter === phase ? phaseConfig[phase].color : colors.foreground }]}>{dealsByPhase[phase].length}</Text>
                  <Text style={[styles.phaseValue, { color: colors.mutedForeground }]}>{formatCurrency(phaseValues[phase])}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Deals List */}
        {filteredDeals.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <Ionicons name="document-text-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {searchQuery
                ? `No ${viewMode === 'leads' ? 'leads' : 'deals'} found matching "${searchQuery}"`
                : viewMode === 'leads'
                  ? 'No leads yet'
                  : 'No deals in pipeline'
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push({ pathname: '/(rep)/deals/new' })}
              >
                <Text style={styles.createButtonText}>Create New Deal</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredDeals.map((deal) => {
            const config = statusConfig[deal.status] || statusConfig.lead;

            return (
              <TouchableOpacity
                key={deal.id}
                onPress={() => router.push({ pathname: '/(rep)/deals/[id]', params: { id: deal.id } })}
                activeOpacity={0.7}
                style={[styles.dealCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}
              >
                <View style={styles.dealContent}>
                  <View style={styles.dealInfo}>
                    <View style={styles.dealHeader}>
                      <Text style={[styles.dealName, { color: colors.foreground }]} numberOfLines={1}>{deal.homeowner_name}</Text>
                      <View style={[styles.badge, { borderColor: config.color }]}>
                        <Text style={[styles.badgeText, { color: config.color }]}>
                          {config.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.dealAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {deal.address}
                      {deal.city && `, ${deal.city}`}
                    </Text>
                    <View style={styles.dealFooter}>
                      <Text style={[styles.dealPrice, { color: colors.foreground }]}>
                        ${(deal.rcv || deal.total_price || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
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
    backgroundColor: staticColors.primary,
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
    backgroundColor: staticColors.primary,
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
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  phaseCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    marginBottom: 8,
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
    backgroundColor: staticColors.primary,
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
  filterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  filterIndicatorText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
