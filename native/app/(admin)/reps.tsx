import { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, TextInput, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { repsApi, adminApi, Rep, CreateRepParams, AccountType } from '../../src/services/api';
import { colors as staticColors } from '../../src/constants/config';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Coaching log interface
interface CoachingLog {
  id: string;
  date: string;
  coach: string;
  topic: string;
  notes: string;
  actionItems: string;
  rating: number;
}

const getCoachingLogsKey = (repId: string) => `coaching_logs_${repId}`;

type CommissionLevel = 'junior' | 'senior' | 'manager';

interface CommissionLevelInfo {
  level: CommissionLevel;
  display_name: string;
  commission_percent: number;
  description: string;
}

const commissionLevels: CommissionLevelInfo[] = [
  { level: 'junior', display_name: 'Junior', commission_percent: 5, description: 'Entry level' },
  { level: 'senior', display_name: 'Senior', commission_percent: 10, description: 'Experienced rep' },
  { level: 'manager', display_name: 'Manager', commission_percent: 13, description: 'Team manager' },
];

const levelColors: Record<CommissionLevel, string> = {
  'junior': '#4A6FA5',
  'senior': '#C9A24D',
  'manager': '#22C55E',
};

// Account type configuration
interface AccountTypeInfo {
  type: AccountType;
  label: string;
  pluralLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
}

const accountTypes: AccountTypeInfo[] = [
  { type: 'admin', label: 'Admin', pluralLabel: 'Admins', icon: 'shield-checkmark', color: '#EF4444', description: 'Full system access' },
  { type: 'rep', label: 'Sales Rep', pluralLabel: 'Sales Reps', icon: 'person', color: '#C9A24D', description: 'Sales representative' },
  { type: 'crew', label: 'Crew Lead', pluralLabel: 'Crew Leads', icon: 'construct', color: '#3B82F6', description: 'Installation crew leader' },
];

export default function RepsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Tab state for viewing different account types
  const [activeTab, setActiveTab] = useState<AccountType>('rep');


  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createAccountType, setCreateAccountType] = useState<AccountType>('rep');
  const [editingRep, setEditingRep] = useState<Rep | null>(null);
  const [selectedCommissionLevel, setSelectedCommissionLevel] = useState<CommissionLevel>('junior');

  // Rep options modal state
  const [selectedRep, setSelectedRep] = useState<Rep | null>(null);

  // Coaching logs states
  const [coachingRep, setCoachingRep] = useState<Rep | null>(null);
  const [coachingLogs, setCoachingLogs] = useState<CoachingLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [showAddCoachingLog, setShowAddCoachingLog] = useState(false);
  const [newCoachingLog, setNewCoachingLog] = useState({
    topic: '',
    notes: '',
    actionItems: '',
    rating: 5,
  });

  // Create form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    accountType: 'rep' as AccountType,
    commissionLevel: 'junior' as CommissionLevel,
  });

  const { data: reps, isLoading, refetch, error: repsError } = useQuery({
    queryKey: ['reps', activeTab],
    queryFn: async () => {
      console.log('[Reps] Fetching for tab:', activeTab);
      const response = await repsApi.list(activeTab);
      console.log('[Reps] API response:', JSON.stringify(response));
      if (response.error) {
        console.error('[Reps] API error:', response.error);
        throw new Error(response.error);
      }
      console.log('[Reps] Received data:', response.data?.length, 'items');
      return response.data || [];
    },
    refetchOnMount: true,
  });

  const createRepMutation = useMutation({
    mutationFn: async (data: CreateRepParams) => {
      const response = await adminApi.createRep(data);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      setIsCreateModalOpen(false);
      const typeLabel = accountTypes.find(t => t.type === formData.accountType)?.label || 'Account';
      resetForm();
      Alert.alert('Success', `${typeLabel} created successfully`);
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to create account: ' + error.message);
    },
  });

  const updateRepMutation = useMutation({
    mutationFn: async ({ repId, commissionLevel }: { repId: string; commissionLevel: CommissionLevel }) => {
      const response = await repsApi.update(repId, { commission_level: commissionLevel });
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      setEditingRep(null);
      Alert.alert('Success', 'Rep updated successfully');
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to update rep: ' + error.message);
    },
  });

  const deleteRepMutation = useMutation({
    mutationFn: async (repId: string) => {
      const response = await repsApi.delete(repId);
      if (response.error) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      Alert.alert('Success', 'Rep deleted successfully');
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to delete rep: ' + error.message);
    },
  });

  const syncRepsMutation = useMutation({
    mutationFn: async () => {
      const response = await adminApi.syncReps();
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      Alert.alert('Success', data?.message || 'Reps synced successfully');
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to sync reps: ' + error.message);
    },
  });

  const runMigrationMutation = useMutation({
    mutationFn: async () => {
      const response = await adminApi.runMigration();
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      const results = data?.results?.join('\n') || 'No migration results';
      Alert.alert('Migration Complete', data?.message || 'Database migration completed successfully\n\n' + results);
    },
    onError: (error) => {
      Alert.alert('Migration Error', 'Failed to run migration: ' + error.message);
    },
  });

  const completeTrainingMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await adminApi.completeTraining(email);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      Alert.alert('Success', data?.message || 'Training marked as complete');
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to complete training: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      accountType: 'rep',
      commissionLevel: 'junior',
    });
  };

  const handleCreateRep = () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    createRepMutation.mutate({
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      accountType: formData.accountType,
      commissionLevel: formData.accountType === 'rep' ? formData.commissionLevel : undefined,
    });
  };

  const openCreateModal = (type: AccountType) => {
    setCreateAccountType(type);
    setFormData({
      ...formData,
      email: '',
      password: '',
      fullName: '',
      accountType: type,
      commissionLevel: 'junior',
    });
    setIsCreateModalOpen(true);
  };

  const handleUpdateRep = () => {
    if (!editingRep) return;
    updateRepMutation.mutate({
      repId: editingRep.id,
      commissionLevel: selectedCommissionLevel,
    });
  };

  const handleDeleteRep = (rep: Rep) => {
    Alert.alert(
      'Delete Rep',
      `Are you sure you want to delete ${rep.full_name || rep.email || 'this rep'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteRepMutation.mutate(rep.id),
        },
      ]
    );
  };

  const handleCompleteTraining = (rep: Rep) => {
    if (!rep.email) {
      Alert.alert('Error', 'Rep has no email address');
      return;
    }
    if (rep.training_completed) {
      Alert.alert('Info', `${rep.full_name || rep.email} has already completed training.`);
      return;
    }
    Alert.alert(
      'Complete Training',
      `Mark training as complete for ${rep.full_name || rep.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => completeTrainingMutation.mutate(rep.email!),
        },
      ]
    );
  };

  const openEditModal = (rep: Rep) => {
    setEditingRep(rep);
    setSelectedCommissionLevel((rep.commission_level as CommissionLevel) || 'junior');
  };

  const activeReps = reps?.filter(r => r.active) || [];
  const inactiveReps = reps?.filter(r => !r.active) || [];

  const getLevelInfo = (level: string) => commissionLevels.find(l => l.level === level);

  // Coaching logs functions
  const loadCoachingLogs = async (repId: string) => {
    setIsLoadingLogs(true);
    try {
      const stored = await AsyncStorage.getItem(getCoachingLogsKey(repId));
      if (stored) {
        setCoachingLogs(JSON.parse(stored));
      } else {
        setCoachingLogs([]);
      }
    } catch (error) {
      console.error('Error loading coaching logs:', error);
      setCoachingLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const saveCoachingLogs = async (repId: string, logs: CoachingLog[]) => {
    try {
      await AsyncStorage.setItem(getCoachingLogsKey(repId), JSON.stringify(logs));
    } catch (error) {
      console.error('Error saving coaching logs:', error);
    }
  };

  const handleOpenCoachingLogs = async (rep: Rep) => {
    setCoachingRep(rep);
    setSelectedRep(null);
    // Use user_id (Supabase auth ID) to match what the rep uses
    await loadCoachingLogs(rep.user_id);
  };

  const handleAddCoachingLog = async () => {
    if (!coachingRep || !newCoachingLog.topic.trim()) {
      Alert.alert('Error', 'Please enter a topic for the coaching log');
      return;
    }

    const newLog: CoachingLog = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      coach: user?.fullName || user?.email || 'Admin',
      topic: newCoachingLog.topic.trim(),
      notes: newCoachingLog.notes.trim(),
      actionItems: newCoachingLog.actionItems.trim(),
      rating: newCoachingLog.rating,
    };

    const updatedLogs = [newLog, ...coachingLogs];
    setCoachingLogs(updatedLogs);
    // Use user_id (Supabase auth ID) to match what the rep uses
    await saveCoachingLogs(coachingRep.user_id, updatedLogs);

    setNewCoachingLog({ topic: '', notes: '', actionItems: '', rating: 5 });
    setShowAddCoachingLog(false);
    Alert.alert('Success', 'Coaching log added successfully');
  };

  const handleDeleteCoachingLog = (logId: string) => {
    if (!coachingRep) return;

    Alert.alert(
      'Delete Coaching Log',
      'Are you sure you want to delete this coaching log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedLogs = coachingLogs.filter(log => log.id !== logId);
            setCoachingLogs(updatedLogs);
            // Use user_id (Supabase auth ID) to match what the rep uses
            await saveCoachingLogs(coachingRep.user_id, updatedLogs);
            Alert.alert('Success', 'Coaching log deleted');
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderRatingStars = (rating: number, editable = false, onPress?: (star: number) => void) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            disabled={!editable}
            onPress={() => onPress?.(star)}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={editable ? 28 : 16}
              color={star <= rating ? '#F59E0B' : colors.mutedForeground}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const handleRepCardPress = (rep: Rep) => {
    setSelectedRep(rep);
  };

  // Get current account type info
  const currentTypeInfo = accountTypes.find(t => t.type === activeTab) || accountTypes[1];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Team Management</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {reps?.length || 0} total members
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.syncButton, { backgroundColor: isDark ? colors.muted : '#F3F4F6', marginRight: 8 }]}
            onPress={() => {
              Alert.alert(
                'Run Database Migration',
                'This will update the database schema to add crew lead support. Continue?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Run Migration', onPress: () => runMigrationMutation.mutate() }
                ]
              );
            }}
            disabled={runMigrationMutation.isPending}
          >
            {runMigrationMutation.isPending ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name="git-merge" size={16} color="#EF4444" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.syncButton, { backgroundColor: isDark ? colors.muted : '#F3F4F6' }]}
            onPress={() => syncRepsMutation.mutate()}
            disabled={syncRepsMutation.isPending}
          >
            {syncRepsMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="sync" size={16} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Account Type Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        {accountTypes.map((type) => (
          <TouchableOpacity
            key={type.type}
            style={[
              styles.tab,
              activeTab === type.type && [styles.tabActive, { borderBottomColor: type.color }]
            ]}
            onPress={() => setActiveTab(type.type)}
          >
            <Ionicons
              name={type.icon}
              size={18}
              color={activeTab === type.type ? type.color : colors.mutedForeground}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === type.type ? colors.foreground : colors.mutedForeground },
              activeTab === type.type && styles.tabTextActive
            ]}>
              {type.pluralLabel}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {/* Add New Button for current type */}
        <TouchableOpacity
          style={[styles.addNewCard, { backgroundColor: `${currentTypeInfo.color}15`, borderColor: `${currentTypeInfo.color}40` }]}
          onPress={() => openCreateModal(activeTab)}
        >
          <View style={[styles.addNewIconContainer, { backgroundColor: `${currentTypeInfo.color}25` }]}>
            <Ionicons name="add" size={24} color={currentTypeInfo.color} />
          </View>
          <View style={styles.addNewTextContainer}>
            <Text style={[styles.addNewTitle, { color: colors.foreground }]}>Add New {currentTypeInfo.label}</Text>
            <Text style={[styles.addNewDescription, { color: colors.mutedForeground }]}>{currentTypeInfo.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* List of reps/users - filtered by tab (for now showing all since we don't have account_type on Rep) */}
        {repsError ? (
          <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: '#EF4444' }]}>
            <Ionicons name="alert-circle" size={40} color="#EF4444" />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Error Loading {currentTypeInfo.pluralLabel}</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{repsError.message}</Text>
            <TouchableOpacity
              style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: staticColors.primary, borderRadius: 8 }}
              onPress={() => refetch()}
            >
              <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : reps?.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <Ionicons name={currentTypeInfo.icon} size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No {currentTypeInfo.pluralLabel} Yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap the button above to create your first {currentTypeInfo.label.toLowerCase()}.</Text>
          </View>
        ) : (
          reps?.map((rep) => {
            const levelInfo = getLevelInfo(rep.commission_level);
            const accountTypeInfo = accountTypes.find(t => t.type === (rep.account_type || activeTab)) || accountTypes[1];
            const cardColor = activeTab === 'rep'
              ? (levelColors[rep.commission_level as CommissionLevel] || colors.primary)
              : accountTypeInfo.color;

            return (
              <TouchableOpacity
                key={rep.id || rep.user_id}
                style={[styles.repCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}
                onPress={() => handleRepCardPress(rep)}
                activeOpacity={0.7}
              >
                <View style={styles.repContent}>
                  <View style={[styles.avatar, { backgroundColor: `${cardColor}1A` }]}>
                    <Ionicons name={accountTypeInfo.icon} size={24} color={cardColor} />
                  </View>
                  <View style={styles.repInfo}>
                    <Text style={[styles.repName, { color: colors.foreground }]}>
                      {rep.full_name || rep.email || 'Unknown'}
                    </Text>
                    <Text style={[styles.repEmail, { color: colors.mutedForeground }]}>{rep.email}</Text>
                    <View style={styles.repMeta}>
                      <View style={[styles.badge, rep.active ? styles.badgeActive : [styles.badgeInactive, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]]}>
                        <Text style={[styles.badgeText, rep.active ? styles.badgeTextActive : [styles.badgeTextInactive, { color: colors.mutedForeground }]]}>
                          {rep.active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      {/* Show training badge only for reps */}
                      {activeTab === 'rep' && (
                        <View style={[styles.badge, rep.training_completed ? styles.badgeTrainingComplete : styles.badgeTrainingPending]}>
                          <Ionicons
                            name={rep.training_completed ? "checkmark-circle" : "time"}
                            size={12}
                            color={rep.training_completed ? '#22C55E' : '#F59E0B'}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.badgeText, rep.training_completed ? styles.badgeTextTrainingComplete : styles.badgeTextTrainingPending]}>
                            {rep.training_completed ? 'Trained' : 'Training'}
                          </Text>
                        </View>
                      )}
                      {/* Show commission level badge only for reps */}
                      {activeTab === 'rep' && (
                        <View style={[styles.levelBadge, { backgroundColor: `${cardColor}20`, borderColor: `${cardColor}50` }]}>
                          <Text style={[styles.levelBadgeText, { color: cardColor }]}>
                            {levelInfo?.display_name || rep.commission_level} ({levelInfo?.commission_percent || rep.default_commission_percent}%)
                          </Text>
                        </View>
                      )}
                      {/* Show role badge for admins and crew */}
                      {activeTab !== 'rep' && (
                        <View style={[styles.levelBadge, { backgroundColor: `${cardColor}20`, borderColor: `${cardColor}50` }]}>
                          <Text style={[styles.levelBadgeText, { color: cardColor }]}>
                            {accountTypeInfo.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.actionButtons}>
                  {/* Training button - only for reps */}
                  {activeTab === 'rep' && (
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: rep.training_completed ? 'rgba(34, 197, 94, 0.1)' : (isDark ? colors.secondary : '#FEF3C7') }
                      ]}
                      onPress={() => handleCompleteTraining(rep)}
                    >
                      <Ionicons
                        name={rep.training_completed ? "checkmark-circle" : "school"}
                        size={18}
                        color={rep.training_completed ? '#22C55E' : '#F59E0B'}
                      />
                    </TouchableOpacity>
                  )}
                  {/* Edit button - only for reps (commission level) */}
                  {activeTab === 'rep' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}
                      onPress={() => openEditModal(rep)}
                    >
                      <Ionicons name="pencil" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => handleDeleteRep(rep)}
                  >
                    <Ionicons name="trash" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Create Account Modal */}
      <Modal
        visible={isCreateModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalHeaderIcon, { backgroundColor: `${accountTypes.find(t => t.type === createAccountType)?.color}20` }]}>
                  <Ionicons
                    name={accountTypes.find(t => t.type === createAccountType)?.icon || 'person'}
                    size={20}
                    color={accountTypes.find(t => t.type === createAccountType)?.color}
                  />
                </View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Create {accountTypes.find(t => t.type === createAccountType)?.label}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>Full Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', color: colors.foreground, borderColor: colors.border }]}
                  value={formData.fullName}
                  onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                  placeholder="Enter full name"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>Email *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', color: colors.foreground, borderColor: colors.border }]}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="Enter email"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>Password *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', color: colors.foreground, borderColor: colors.border }]}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  placeholder="Enter password (min 8 characters)"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry
                  textContentType="oneTimeCode"
                  autoComplete="off"
                />
              </View>

              {/* Commission Level - Only for Sales Reps */}
              {createAccountType === 'rep' && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Commission Level</Text>
                  <View style={styles.levelSelector}>
                    {commissionLevels.map((level) => (
                      <TouchableOpacity
                        key={level.level}
                        style={[
                          styles.levelOption,
                          {
                            backgroundColor: formData.commissionLevel === level.level ? levelColors[level.level] : (isDark ? colors.secondary : '#F3F4F6'),
                            borderColor: formData.commissionLevel === level.level ? levelColors[level.level] : colors.border,
                          },
                        ]}
                        onPress={() => setFormData({ ...formData, commissionLevel: level.level })}
                      >
                        <Text style={[
                          styles.levelOptionText,
                          { color: formData.commissionLevel === level.level ? '#FFFFFF' : colors.foreground }
                        ]}>
                          {level.display_name}
                        </Text>
                        <Text style={[
                          styles.levelOptionPercent,
                          { color: formData.commissionLevel === level.level ? '#FFFFFF' : colors.mutedForeground }
                        ]}>
                          {level.commission_percent}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.levelDescription, { color: colors.mutedForeground }]}>
                    {getLevelInfo(formData.commissionLevel)?.description}
                  </Text>
                </View>
              )}

              {/* Info for Admin */}
              {createAccountType === 'admin' && (
                <View style={[styles.infoBox, { backgroundColor: isDark ? colors.secondary : '#FEF3C7', borderColor: isDark ? colors.border : '#FCD34D' }]}>
                  <Ionicons name="information-circle" size={20} color="#F59E0B" />
                  <Text style={[styles.infoBoxText, { color: isDark ? colors.foreground : '#92400E' }]}>
                    Admins have full access to manage reps, deals, and system settings.
                  </Text>
                </View>
              )}

              {/* Info for Crew Lead */}
              {createAccountType === 'crew' && (
                <View style={[styles.infoBox, { backgroundColor: isDark ? colors.secondary : '#DBEAFE', borderColor: isDark ? colors.border : '#93C5FD' }]}>
                  <Ionicons name="information-circle" size={20} color="#3B82F6" />
                  <Text style={[styles.infoBoxText, { color: isDark ? colors.foreground : '#1E40AF' }]}>
                    Crew Leads can view assigned jobs and manage installation schedules.
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: accountTypes.find(t => t.type === createAccountType)?.color || colors.primary }]}
              onPress={handleCreateRep}
              disabled={createRepMutation.isPending}
            >
              {createRepMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create {accountTypes.find(t => t.type === createAccountType)?.label}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Rep Modal */}
      <Modal
        visible={!!editingRep}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingRep(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Rep</Text>
              <TouchableOpacity onPress={() => setEditingRep(null)}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>Name</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled, { backgroundColor: isDark ? colors.secondary : '#F3F4F6', color: colors.mutedForeground, borderColor: colors.border }]}
                  value={editingRep?.full_name || ''}
                  editable={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled, { backgroundColor: isDark ? colors.secondary : '#F3F4F6', color: colors.mutedForeground, borderColor: colors.border }]}
                  value={editingRep?.email || ''}
                  editable={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>Commission Level</Text>
                <View style={styles.levelSelector}>
                  {commissionLevels.map((level) => (
                    <TouchableOpacity
                      key={level.level}
                      style={[
                        styles.levelOption,
                        {
                          backgroundColor: selectedCommissionLevel === level.level ? levelColors[level.level] : (isDark ? colors.secondary : '#F3F4F6'),
                          borderColor: selectedCommissionLevel === level.level ? levelColors[level.level] : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedCommissionLevel(level.level)}
                    >
                      <Text style={[
                        styles.levelOptionText,
                        { color: selectedCommissionLevel === level.level ? '#FFFFFF' : colors.foreground }
                      ]}>
                        {level.display_name}
                      </Text>
                      <Text style={[
                        styles.levelOptionPercent,
                        { color: selectedCommissionLevel === level.level ? '#FFFFFF' : colors.mutedForeground }
                      ]}>
                        {level.commission_percent}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.levelDescription, { color: colors.mutedForeground }]}>
                  {getLevelInfo(selectedCommissionLevel)?.description}
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={handleUpdateRep}
              disabled={updateRepMutation.isPending}
            >
              {updateRepMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rep Options Modal */}
      <Modal
        visible={!!selectedRep}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedRep(null)}
      >
        <TouchableOpacity
          style={styles.optionsModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedRep(null)}
        >
          <View style={[styles.optionsModalContent, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
            <View style={styles.optionsModalHeader}>
              <View style={[styles.avatar, { backgroundColor: `${currentTypeInfo.color}1A`, marginRight: 12 }]}>
                <Ionicons name={currentTypeInfo.icon} size={24} color={currentTypeInfo.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionsRepName, { color: colors.foreground }]}>
                  {selectedRep?.full_name || selectedRep?.email || 'Unknown'}
                </Text>
                <Text style={[styles.optionsRepEmail, { color: colors.mutedForeground }]}>{selectedRep?.email}</Text>
              </View>
            </View>

            <View style={styles.optionsDivider} />

            {/* Coaching Logs - Only for reps */}
            {activeTab === 'rep' && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => selectedRep && handleOpenCoachingLogs(selectedRep)}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Ionicons name="clipboard" size={20} color="#3B82F6" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: colors.foreground }]}>Coaching Logs</Text>
                  <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>View and manage coaching sessions</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}

            {/* Edit Rep - Only for reps */}
            {activeTab === 'rep' && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  if (selectedRep) {
                    openEditModal(selectedRep);
                    setSelectedRep(null);
                  }
                }}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(201, 162, 77, 0.1)' }]}>
                  <Ionicons name="pencil" size={20} color="#C9A24D" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: colors.foreground }]}>Edit Rep</Text>
                  <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>Change commission level</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}

            {/* Complete Training - Only for reps */}
            {activeTab === 'rep' && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  if (selectedRep) {
                    handleCompleteTraining(selectedRep);
                    setSelectedRep(null);
                  }
                }}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: selectedRep?.training_completed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
                  <Ionicons
                    name={selectedRep?.training_completed ? "checkmark-circle" : "school"}
                    size={20}
                    color={selectedRep?.training_completed ? '#22C55E' : '#F59E0B'}
                  />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                    {selectedRep?.training_completed ? 'Training Complete' : 'Complete Training'}
                  </Text>
                  <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>
                    {selectedRep?.training_completed ? 'Already marked as trained' : 'Mark training as complete'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}

            <View style={styles.optionsDivider} />

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                if (selectedRep) {
                  handleDeleteRep(selectedRep);
                  setSelectedRep(null);
                }
              }}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="trash" size={20} color="#EF4444" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: '#EF4444' }]}>Delete {currentTypeInfo.label}</Text>
                <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>Remove this {currentTypeInfo.label.toLowerCase()} permanently</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}
              onPress={() => setSelectedRep(null)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Coaching Logs Modal */}
      <Modal
        visible={!!coachingRep}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setCoachingRep(null);
          setShowAddCoachingLog(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.coachingModalContent, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Coaching Logs</Text>
                <Text style={[styles.coachingSubtitle, { color: colors.mutedForeground }]}>
                  {coachingRep?.full_name || coachingRep?.email}
                </Text>
              </View>
              <TouchableOpacity onPress={() => {
                setCoachingRep(null);
                setShowAddCoachingLog(false);
              }}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {showAddCoachingLog ? (
              <ScrollView style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Topic *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', color: colors.foreground, borderColor: colors.border }]}
                    value={newCoachingLog.topic}
                    onChangeText={(text) => setNewCoachingLog({ ...newCoachingLog, topic: text })}
                    placeholder="e.g., Sales Techniques, Customer Handling"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', color: colors.foreground, borderColor: colors.border }]}
                    value={newCoachingLog.notes}
                    onChangeText={(text) => setNewCoachingLog({ ...newCoachingLog, notes: text })}
                    placeholder="Session notes..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Action Items</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', color: colors.foreground, borderColor: colors.border }]}
                    value={newCoachingLog.actionItems}
                    onChangeText={(text) => setNewCoachingLog({ ...newCoachingLog, actionItems: text })}
                    placeholder="Follow-up tasks..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Rating</Text>
                  <View style={styles.ratingSelector}>
                    {renderRatingStars(newCoachingLog.rating, true, (star) =>
                      setNewCoachingLog({ ...newCoachingLog, rating: star })
                    )}
                  </View>
                </View>

                <View style={styles.formButtonsRow}>
                  <TouchableOpacity
                    style={[styles.cancelFormButton, { backgroundColor: isDark ? colors.secondary : '#F3F4F6' }]}
                    onPress={() => setShowAddCoachingLog(false)}
                  >
                    <Text style={[styles.cancelFormButtonText, { color: colors.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitFormButton, { backgroundColor: colors.primary }]}
                    onPress={handleAddCoachingLog}
                  >
                    <Text style={styles.submitButtonText}>Add Log</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.addLogButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowAddCoachingLog(true)}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.addLogButtonText}>Add Coaching Log</Text>
                </TouchableOpacity>

                <ScrollView style={styles.logsScrollView}>
                  {isLoadingLogs ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
                  ) : coachingLogs.length === 0 ? (
                    <View style={[styles.emptyLogsCard, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border }]}>
                      <Ionicons name="clipboard-outline" size={40} color={colors.mutedForeground} />
                      <Text style={[styles.emptyLogsTitle, { color: colors.foreground }]}>No Coaching Logs</Text>
                      <Text style={[styles.emptyLogsText, { color: colors.mutedForeground }]}>
                        Tap the button above to add the first coaching log for this rep.
                      </Text>
                    </View>
                  ) : (
                    coachingLogs.map((log) => (
                      <View
                        key={log.id}
                        style={[styles.logCard, { backgroundColor: isDark ? colors.secondary : '#F9FAFB', borderColor: colors.border }]}
                      >
                        <View style={styles.logHeader}>
                          <View style={styles.logHeaderLeft}>
                            <Ionicons name="calendar" size={14} color={colors.primary} />
                            <Text style={[styles.logDate, { color: colors.mutedForeground }]}>{formatDate(log.date)}</Text>
                          </View>
                          <View style={styles.logHeaderRight}>
                            {renderRatingStars(log.rating)}
                            <TouchableOpacity
                              style={styles.deleteLogButton}
                              onPress={() => handleDeleteCoachingLog(log.id)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <Text style={[styles.logTopic, { color: colors.foreground }]}>{log.topic}</Text>
                        <Text style={[styles.logCoach, { color: colors.mutedForeground }]}>Coach: {log.coach}</Text>

                        {log.notes && (
                          <View style={[styles.logSection, { borderTopColor: colors.border }]}>
                            <Text style={[styles.logSectionTitle, { color: colors.mutedForeground }]}>Notes</Text>
                            <Text style={[styles.logSectionText, { color: colors.foreground }]}>{log.notes}</Text>
                          </View>
                        )}

                        {log.actionItems && (
                          <View style={[styles.logSection, { borderTopColor: colors.border }]}>
                            <Text style={[styles.logSectionTitle, { color: colors.mutedForeground }]}>Action Items</Text>
                            <Text style={[styles.logSectionText, { color: colors.foreground }]}>{log.actionItems}</Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                  <View style={{ height: 20 }} />
                </ScrollView>
              </>
            )}
          </KeyboardAvoidingView>
        </View>
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
    borderBottomWidth: 0,
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  syncButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  // Add New Card
  addNewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addNewIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addNewTextContainer: {
    flex: 1,
  },
  addNewTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  addNewDescription: {
    fontSize: 12,
    marginTop: 2,
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
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  repCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  repContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginTop: 6,
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  badgeInactive: {
    backgroundColor: '#F3F4F6',
  },
  badgeTrainingComplete: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  badgeTrainingPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
  badgeTextTrainingComplete: {
    color: '#22C55E',
  },
  badgeTextTrainingPending: {
    color: '#F59E0B',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  levelSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  levelOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  levelOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  levelOptionPercent: {
    fontSize: 12,
    marginTop: 2,
  },
  levelDescription: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Options Modal styles
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  optionsModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  optionsRepName: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionsRepEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  optionsDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  optionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Coaching Logs Modal styles
  coachingModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    flex: 1,
    paddingBottom: 34,
  },
  coachingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  addLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addLogButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  logsScrollView: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  emptyLogsCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyLogsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyLogsText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  logCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  logTopic: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  logCoach: {
    fontSize: 12,
    marginBottom: 10,
  },
  logSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  logSectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  logSectionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteLogButton: {
    padding: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  ratingSelector: {
    marginTop: 4,
  },
  formButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelFormButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelFormButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  submitFormButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
