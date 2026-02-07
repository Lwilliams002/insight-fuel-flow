import { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
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
  invoice_sent: { label: 'Invoice Sent', color: '#6366F1' },
  depreciation_collected: { label: 'Depreciation', color: '#8B5CF6' },
  complete: { label: 'Complete', color: '#10B981' },
  paid: { label: 'Paid', color: '#059669' },
};

export default function AdminDealsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: deals, isLoading, refetch } = useQuery({
    queryKey: ['deals', 'admin'],
    queryFn: async () => {
      const response = await dealsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  const filteredDeals = deals?.filter(deal => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        deal.homeowner_name?.toLowerCase().includes(query) ||
        deal.address?.toLowerCase().includes(query) ||
        deal.city?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    // Status filter
    if (statusFilter && deal.status !== statusFilter) return false;
    return true;
  }) || [];

  // Safe number parsing to handle invalid values
  const safeNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    const num = typeof val === 'number' ? val : Number(val);
    if (isNaN(num) || !isFinite(num)) return 0;
    return num;
  };

  // Get deal value - prefer RCV, fall back to total_price
  const getDealValue = (d: any): number => {
    const rcv = safeNumber(d.rcv);
    const totalPrice = safeNumber(d.total_price);
    return rcv > 0 ? rcv : totalPrice;
  };

  // Format currency for display
  const formatCurrency = (value: number): string => {
    if (!isFinite(value) || isNaN(value)) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value.toLocaleString()}`;
  };

  const totalValue = filteredDeals.reduce((sum, d) => sum + getDealValue(d), 0);

  // Status counts for filter buttons
  const statusCounts = deals?.reduce((acc, deal) => {
    acc[deal.status] = (acc[deal.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Count pending payment requests
  const pendingPaymentRequests = deals?.filter(deal =>
    deal.status === 'complete' &&
    deal.payment_requested &&
    !deal.deal_commissions?.[0]?.paid
  ) || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Pending Payment Requests Banner */}
      {pendingPaymentRequests.length > 0 && (
        <TouchableOpacity
          style={[styles.pendingPaymentBanner, { backgroundColor: colors.primary }]}
          onPress={() => setStatusFilter('complete')}
        >
          <View style={styles.pendingPaymentBannerContent}>
            <View style={styles.pendingPaymentIconContainer}>
              <Ionicons name="cash" size={20} color="#FFF" />
              <View style={styles.pendingPaymentBadge}>
                <Text style={styles.pendingPaymentBadgeText}>{pendingPaymentRequests.length}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingPaymentTitle}>
                {pendingPaymentRequests.length} Commission Request{pendingPaymentRequests.length > 1 ? 's' : ''} Pending
              </Text>
              <Text style={styles.pendingPaymentSubtitle}>Tap to review and approve</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFF" />
          </View>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Pipeline</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {filteredDeals.length} deals · {formatCurrency(totalValue)} total
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            placeholder="Search deals..."
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

        {/* Status Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
            onPress={() => setStatusFilter(null)}
          >
            <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>
              All ({deals?.length || 0})
            </Text>
          </TouchableOpacity>
          {Object.entries(statusConfig).slice(0, 6).map(([key, config]) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, statusFilter === key && styles.filterChipActive]}
              onPress={() => setStatusFilter(statusFilter === key ? null : key)}
            >
              <Text style={[styles.filterChipText, statusFilter === key && styles.filterChipTextActive]}>
                {config.label} ({statusCounts[key] || 0})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Deals List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {filteredDeals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={40} color="#9CA3AF" />
            <Text style={styles.emptyText}>
              {searchQuery ? `No deals found matching "${searchQuery}"` : 'No deals found'}
            </Text>
          </View>
        ) : (
          filteredDeals.map((deal) => {
            const config = statusConfig[deal.status] || statusConfig.lead;
            const hasPendingPayment = deal.status === 'complete' && deal.payment_requested && !deal.deal_commissions?.[0]?.paid;

            return (
              <TouchableOpacity
                key={deal.id}
                activeOpacity={0.7}
                style={[styles.dealCard, hasPendingPayment && styles.dealCardPendingPayment]}
                onPress={() => router.push(`/(admin)/deals/${deal.id}`)}
              >
                {hasPendingPayment && (
                  <View style={styles.pendingPaymentIndicator}>
                    <Ionicons name="cash" size={12} color="#FFF" />
                    <Text style={styles.pendingPaymentIndicatorText}>Payment Request</Text>
                  </View>
                )}
                <View style={styles.dealContent}>
                  <View style={styles.dealInfo}>
                    <View style={styles.dealHeader}>
                      <Text style={styles.dealName}>{deal.homeowner_name}</Text>
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
                      {deal.rep_name && (
                        <Text style={styles.repName}>
                          <Ionicons name="person" size={12} color="#9CA3AF" /> {deal.rep_name}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          })
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
  },
  headerTop: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
  },
  filterScroll: {
    marginTop: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: staticColors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  dealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dealContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  dealInfo: {
    flex: 1,
  },
  dealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dealAddress: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  dealFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dealPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  repName: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  // Pending Payment Banner
  pendingPaymentBanner: {
    backgroundColor: '#F59E0B',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pendingPaymentBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  pendingPaymentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingPaymentBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  pendingPaymentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  pendingPaymentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  pendingPaymentSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Deal Card with pending payment
  dealCardPendingPayment: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  pendingPaymentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  pendingPaymentIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
});
