import React from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { dealsApi, repsApi, Deal } from '../../src/services/api';
import { colors as staticColors } from '../../src/constants/config';

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();

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

  const approvePaymentMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const response = await dealsApi.update(dealId, {
        payment_requested: false,
      });
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      Alert.alert('Success', 'Commission payment approved!');
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to approve payment');
    },
  });

  const refreshing = dealsLoading || repsLoading;

  const onRefresh = () => {
    refetchDeals();
    refetchReps();
  };

  // Calculate stats
  const totalDeals = deals?.length || 0;

  // Helper to calculate RCV: ACV + Depreciation = RCV (matching web app logic)
  const calculateRCV = (d: Deal) => {
    const numRcv = Number(d.rcv) || 0;
    const numAcv = Number(d.acv) || 0;
    const numDepreciation = Number(d.depreciation) || 0;

    // If RCV is explicitly set and > 0, use it
    if (numRcv > 0) {
      return numRcv;
    }
    // Otherwise calculate from ACV + Depreciation
    return numAcv + numDepreciation;
  };

  // Helper to get deal value - use calculated RCV, filter unrealistic values
  const getDealValue = (d: Deal) => {
    const value = calculateRCV(d);
    // Filter out unrealistic values (more than $10 million per deal is likely test/bad data)
    return value > 10000000 ? 0 : value;
  };

  // Total value should only count completed/installed deals that have been paid
  const completedDeals = deals?.filter(d =>
    ['complete', 'installed', 'completion_signed', 'invoice_sent', 'depreciation_collected', 'paid'].includes(d.status)
  ) || [];
  const totalValue = completedDeals.reduce((sum, d) => sum + getDealValue(d), 0);

  // Pipeline value = all active deals
  const pipelineValue = deals?.reduce((sum, d) => sum + getDealValue(d), 0) || 0;

  const activeReps = reps?.filter(r => r.active)?.length || 0;

  // Deals needing admin action
  const needsAction = deals?.filter(d =>
    ['awaiting_approval', 'materials_selected', 'install_scheduled', 'completion_signed'].includes(d.status)
  )?.length || 0;

  // Commission payment requests
  const paymentRequests = deals?.filter(d => d.payment_requested && d.status === 'complete') || [];

  // Commission level percentages - matches web app and AWS database
  // These are the levels stored in the database: junior=5%, senior=10%, manager=13%
  const commissionLevelPercentages: Record<string, number> = {
    'junior': 5,
    'senior': 10,
    'manager': 13,
  };

  // Get rep's commission percentage from their profile (stored in AWS database)
  const getRepCommissionPercent = (deal: Deal): number => {
    // First, check if there's a commission percent stored in deal_commissions
    if (deal.deal_commissions && deal.deal_commissions.length > 0) {
      const storedPercent = deal.deal_commissions[0]?.commission_percent;
      if (storedPercent && storedPercent > 0) {
        return storedPercent;
      }

      // Try to find the rep from deal_commissions
      const commissionRepId = deal.deal_commissions[0]?.rep_id;
      if (commissionRepId && reps) {
        const rep = reps.find(r => r.id === commissionRepId);
        if (rep) {
          // Use default_commission_percent if set, otherwise lookup by commission_level
          if (rep.default_commission_percent && rep.default_commission_percent > 0) {
            return rep.default_commission_percent;
          }
          const levelPercent = commissionLevelPercentages[rep.commission_level];
          if (levelPercent) {
            return levelPercent;
          }
        }
      }
    }

    // Look up the rep by rep_id from the deal
    const dealRepId = deal.rep_id;
    if (dealRepId && reps) {
      const rep = reps.find(r => r.id === dealRepId || r.user_id === dealRepId);
      if (rep) {
        // Use default_commission_percent if set, otherwise lookup by commission_level
        if (rep.default_commission_percent && rep.default_commission_percent > 0) {
          return rep.default_commission_percent;
        }
        const levelPercent = commissionLevelPercentages[rep.commission_level];
        if (levelPercent) {
          return levelPercent;
        }
      }
    }
    
    // Default to 5% (junior level) if nothing found
    return 5;
  };

  // Calculate commission for a deal: (RCV - Sales Tax) × Commission Level %
  // Matching web app logic from DealCRMComponents.tsx
  const getCommissionAmount = (deal: Deal) => {
    // If commission is already calculated and stored, use it
    if (deal.deal_commissions && deal.deal_commissions.length > 0) {
      const storedCommission = deal.deal_commissions.reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
      if (storedCommission > 0) {
        return storedCommission;
      }
    }

    // Calculate RCV (this is the deal value)
    const rcv = calculateRCV(deal);
    
    // If RCV is 0, we can't calculate commission
    if (rcv === 0) return 0;

    // Calculate sales tax at 8.25% (matching web app)
    const salesTax = rcv * 0.0825;

    // Base amount = RCV - Sales Tax
    const baseAmount = rcv - salesTax;

    // Get commission percent from rep's level
    const commissionPercent = getRepCommissionPercent(deal);

    // Commission = (RCV - Sales Tax) × Commission %
    return baseAmount * (commissionPercent / 100);
  };

  const handleApprovePayment = (deal: Deal) => {
    Alert.alert(
      'Approve Commission Payment',
      `Approve commission payment of $${getCommissionAmount(deal).toLocaleString(undefined, { minimumFractionDigits: 2 })} for ${deal.homeowner_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => approvePaymentMutation.mutate(deal.id)
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header Bar - matching rep dashboard */}
      <View style={[styles.headerBar, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Admin Dashboard</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{format(new Date(), 'EEEE, MMMM d')}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.welcomeText, { color: colors.mutedForeground }]}>{user?.fullName || 'Admin'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total Deals</Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{totalDeals}</Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(201, 162, 77, 0.1)' }]}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
              </View>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Needs Action</Text>
                <Text style={[styles.statValue, { color: '#F97316' }]}>{needsAction}</Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
                <Ionicons name="alert-circle" size={20} color="#F97316" />
              </View>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Completed Value</Text>
                <Text style={[styles.statValue, { color: '#22C55E', fontSize: 20 }]}>
                  ${totalValue >= 1000000
                    ? (totalValue / 1000000).toFixed(1) + 'M'
                    : (totalValue / 1000).toFixed(0) + 'k'}
                </Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              </View>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Pipeline Value</Text>
                <Text style={[styles.statValue, { color: '#3B82F6', fontSize: 20 }]}>
                  ${pipelineValue >= 1000000
                    ? (pipelineValue / 1000000).toFixed(1) + 'M'
                    : (pipelineValue / 1000).toFixed(0) + 'k'}
                </Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="trending-up" size={20} color="#3B82F6" />
              </View>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active Reps</Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{activeReps}</Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                <Ionicons name="people" size={20} color="#8B5CF6" />
              </View>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Pay Requests</Text>
                <Text style={[styles.statValue, { color: paymentRequests.length > 0 ? '#F59E0B' : '#6B7280' }]}>
                  {paymentRequests.length}
                </Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: paymentRequests.length > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(107, 114, 128, 0.1)' }]}>
                <Ionicons name="wallet" size={20} color={paymentRequests.length > 0 ? '#F59E0B' : '#6B7280'} />
              </View>
            </View>
          </View>
        </View>

        {/* Awaiting Financial Approval Section */}
        {(() => {
          // Include awaiting_approval, adjuster_met with financials, and claim_filed with financials
          const awaitingApproval = deals?.filter(d =>
            d.status === 'awaiting_approval' ||
            (d.status === 'adjuster_met' && (d.rcv || d.acv)) ||
            (d.status === 'claim_filed' && (d.rcv || d.acv))
          ) || [];
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="time" size={20} color="#F59E0B" />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Awaiting Financial Approval</Text>
                </View>
                {awaitingApproval.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.countBadgeText, { color: '#D97706' }]}>{awaitingApproval.length}</Text>
                  </View>
                )}
              </View>

              {awaitingApproval.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All Caught Up!</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No deals awaiting financial approval</Text>
                </View>
              ) : (
                awaitingApproval.map((deal) => {
                  const rcv = calculateRCV(deal);
                  const repName = deal.rep_name || 'Unknown Rep';
                  const statusLabel = deal.status === 'awaiting_approval' ? 'Awaiting Approval' :
                                     deal.status === 'adjuster_met' ? 'Adjuster Met' : 'Claim Filed';
                  const badgeBgColor = deal.status === 'awaiting_approval' ? '#FEF3C7' :
                                       deal.status === 'adjuster_met' ? '#DBEAFE' : '#E0E7FF';
                  const badgeTextColor = deal.status === 'awaiting_approval' ? '#D97706' :
                                         deal.status === 'adjuster_met' ? '#2563EB' : '#4F46E5';

                  return (
                    <TouchableOpacity
                      key={deal.id}
                      style={[styles.requestCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}
                      onPress={() => router.push(`/(admin)/deals/${deal.id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.requestCardHeader}>
                        <View style={styles.requestCardInfo}>
                          <Text style={[styles.requestCardName, { color: colors.foreground }]}>{deal.homeowner_name}</Text>
                          <Text style={[styles.requestCardAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {deal.address}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: badgeBgColor }]}>
                          <Text style={[styles.statusBadgeText, { color: badgeTextColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.financialPreview, { borderTopColor: isDark ? colors.border : '#F3F4F6' }]}>
                        <View style={styles.financialPreviewRow}>
                          <Text style={[styles.financialPreviewLabel, { color: colors.mutedForeground }]}>RCV</Text>
                          <Text style={[styles.financialPreviewValue, { color: colors.foreground }]}>
                            ${rcv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                        <View style={styles.financialPreviewRow}>
                          <Text style={[styles.financialPreviewLabel, { color: colors.mutedForeground }]}>ACV</Text>
                          <Text style={[styles.financialPreviewValue, { color: colors.foreground }]}>
                            ${(Number(deal.acv) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                        <View style={styles.financialPreviewRow}>
                          <Text style={[styles.financialPreviewLabel, { color: colors.mutedForeground }]}>Deductible</Text>
                          <Text style={[styles.financialPreviewValue, { color: colors.foreground }]}>
                            ${(Number(deal.deductible) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                        <View style={styles.financialPreviewRow}>
                          <Text style={[styles.financialPreviewLabel, { color: colors.mutedForeground }]}>Rep</Text>
                          <Text style={[styles.financialPreviewValue, { color: colors.foreground }]}>{repName}</Text>
                        </View>
                      </View>

                      <View style={styles.requestCardFooter}>
                        <TouchableOpacity
                          style={[styles.viewDealBtn, { backgroundColor: 'rgba(201, 162, 77, 0.1)' }]}
                          onPress={() => router.push(`/(admin)/deals/${deal.id}`)}
                        >
                          <Text style={[styles.viewDealText, { color: staticColors.primary }]}>Review & Approve</Text>
                          <Ionicons name="chevron-forward" size={16} color={staticColors.primary} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          );
        })()}

        {/* Schedule Install Requests Section */}
        {(() => {
          const installRequests = deals?.filter(d => d.status === 'materials_selected') || [];
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="hammer" size={20} color="#06B6D4" />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Schedule Install Requests</Text>
                </View>
                {installRequests.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: '#CFFAFE' }]}>
                    <Text style={[styles.countBadgeText, { color: '#0891B2' }]}>{installRequests.length}</Text>
                  </View>
                )}
              </View>

              {installRequests.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All Caught Up!</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending install scheduling requests</Text>
                </View>
              ) : (
                installRequests.map((deal) => (
                  <TouchableOpacity
                    key={deal.id}
                    style={[styles.requestCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border, borderLeftColor: '#06B6D4' }]}
                    onPress={() => router.push(`/(admin)/deals/${deal.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.requestCardHeader}>
                      <View style={styles.requestCardInfo}>
                        <Text style={[styles.requestCardName, { color: colors.foreground }]}>{deal.homeowner_name}</Text>
                        <Text style={[styles.requestCardAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {deal.address}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: '#CFFAFE' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#0891B2' }]}>Ready to Schedule</Text>
                      </View>
                    </View>

                    <View style={[styles.financialPreview, { borderTopColor: isDark ? colors.border : '#F3F4F6' }]}>
                      <View style={styles.financialPreviewRow}>
                        <Text style={[styles.financialPreviewLabel, { color: colors.mutedForeground }]}>Materials</Text>
                        <Text style={[styles.financialPreviewValue, { color: colors.foreground }]}>
                          {deal.material_category || 'Selected'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.requestCardFooter}>
                      <TouchableOpacity
                        style={[styles.viewDealBtn, { backgroundColor: 'rgba(6, 182, 212, 0.1)' }]}
                        onPress={() => router.push(`/(admin)/deals/${deal.id}`)}
                      >
                        <Text style={[styles.viewDealText, { color: '#0891B2' }]}>Schedule Install</Text>
                        <Ionicons name="chevron-forward" size={16} color="#0891B2" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })()}

        {/* Commission Payment Requests Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="cash" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Commission Pay Requests</Text>
            </View>
            {paymentRequests.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{paymentRequests.length}</Text>
              </View>
            )}
          </View>

          {paymentRequests.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All Caught Up!</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending commission payment requests</Text>
            </View>
          ) : (
            paymentRequests.map((deal) => {
              const rcv = calculateRCV(deal);
              const salesTax = rcv * 0.0825;
              const baseAmount = rcv - salesTax;
              const commissionPercent = getRepCommissionPercent(deal);
              const commission = getCommissionAmount(deal);
              const repName = deal.rep_name || deal.deal_commissions?.[0]?.rep_name || 'Unknown Rep';
              
              // Find the rep for their commission level
              const dealRepId = deal.rep_id;
              const rep = reps?.find(r => r.id === dealRepId || r.user_id === dealRepId);
              const commissionLevelName = rep?.commission_level 
                ? rep.commission_level.charAt(0).toUpperCase() + rep.commission_level.slice(1)
                : 'Rep';

              return (
                <View key={deal.id} style={[styles.requestCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestInfo}>
                      <Text style={[styles.requestName, { color: colors.foreground }]}>{deal.homeowner_name}</Text>
                      <Text style={[styles.requestAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{deal.address}</Text>
                    </View>
                    <View style={styles.requestAmount}>
                      <Text style={[styles.requestAmountLabel, { color: colors.mutedForeground }]}>Commission</Text>
                      <Text style={styles.requestAmountValue}>
                        ${commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>

                  {/* Commission Breakdown */}
                  <View style={[styles.commissionBreakdown, { backgroundColor: isDark ? colors.secondary : '#F9FAFB' }]}>
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>RCV (Deal Value)</Text>
                      <Text style={[styles.breakdownValue, { color: colors.foreground }]}>${rcv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Sales Tax (8.25%)</Text>
                      <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>-${salesTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Base Amount</Text>
                      <Text style={[styles.breakdownValue, { color: colors.foreground }]}>${baseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>Commission Rate ({commissionLevelName})</Text>
                      <Text style={[styles.breakdownValue, { color: colors.primary }]}>×{commissionPercent}%</Text>
                    </View>
                  </View>

                  <View style={[styles.requestDetails, { borderTopColor: isDark ? colors.border : '#F3F4F6' }]}>
                    <View style={styles.requestDetailItem}>
                      <Ionicons name="person" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.requestDetailText, { color: colors.mutedForeground }]}>{repName}</Text>
                    </View>
                  </View>

                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.viewDealBtn}
                      onPress={() => router.push(`/(admin)/deals/${deal.id}`)}
                    >
                      <Ionicons name="eye" size={16} color={colors.primary} />
                      <Text style={styles.viewDealText}>View Deal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprovePayment(deal)}
                      disabled={approvePaymentMutation.isPending}
                    >
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
  headerLogo: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  welcomeText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section styles
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  countBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },

  // Request card
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  requestCardInfo: {
    flex: 1,
    marginRight: 12,
  },
  requestCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  requestCardAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  requestAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  requestAmount: {
    alignItems: 'flex-end',
  },
  requestAmountLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  requestAmountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  commissionBreakdown: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  requestDetails: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  requestDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requestDetailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  viewDealBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: staticColors.primary,
  },
  viewDealText: {
    fontSize: 14,
    fontWeight: '600',
    color: staticColors.primary,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#22C55E',
  },
  approveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  financialPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  financialPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialPreviewLabel: {
    fontSize: 13,
  },
  financialPreviewValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  requestCardFooter: {
    marginTop: 12,
  },
});
