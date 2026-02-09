import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CoachingLog {
  id: string;
  date: string;
  coach: string;
  topic: string;
  notes: string;
  actionItems: string;
  rating: number;
  repId?: string; // ID of the rep this log is for
}

// Key for storing coaching logs - admin stores them per rep
export const getCoachingLogsKey = (repId: string) => `coaching_logs_${repId}`;

export default function CoachingLogsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [logs, setLogs] = useState<CoachingLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!user?.sub) return;
    try {
      // Load logs for this rep (stored by admin)
      const stored = await AsyncStorage.getItem(getCoachingLogsKey(user.sub));
      if (stored) {
        setLogs(JSON.parse(stored));
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Error loading coaching logs:', error);
    }
  }, [user?.sub]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderRatingStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color={star <= rating ? '#F59E0B' : colors.mutedForeground}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Coaching Logs</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: isDark ? colors.muted : '#EFF6FF', borderColor: isDark ? colors.border : '#BFDBFE' }]}>
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <Text style={[styles.infoText, { color: isDark ? colors.foreground : '#1E40AF' }]}>
            Coaching logs are added by your manager. Pull down to refresh.
          </Text>
        </View>

        {/* Logs List */}
        {logs.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
            <Ionicons name="clipboard-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Coaching Logs Yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Your coaching sessions will appear here once your manager adds them.
            </Text>
          </View>
        ) : (
          logs.map((log) => (
            <View
              key={log.id}
              style={[styles.logCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}
            >
              <View style={styles.logHeader}>
                <View style={styles.logHeaderLeft}>
                  <Ionicons name="calendar" size={16} color={colors.primary} />
                  <Text style={[styles.logDate, { color: colors.mutedForeground }]}>{formatDate(log.date)}</Text>
                </View>
                {renderRatingStars(log.rating)}
              </View>

              <Text style={[styles.logTopic, { color: colors.foreground }]}>{log.topic}</Text>
              <Text style={[styles.logCoach, { color: colors.mutedForeground }]}>Coach: {log.coach}</Text>

              {log.notes && (
                <View style={styles.logSection}>
                  <Text style={[styles.logSectionTitle, { color: colors.mutedForeground }]}>Notes</Text>
                  <Text style={[styles.logSectionText, { color: colors.foreground }]}>{log.notes}</Text>
                </View>
              )}

              {log.actionItems && (
                <View style={styles.logSection}>
                  <Text style={[styles.logSectionTitle, { color: colors.mutedForeground }]}>Action Items</Text>
                  <Text style={[styles.logSectionText, { color: colors.foreground }]}>{log.actionItems}</Text>
                </View>
              )}
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  logCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  logTopic: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  logCoach: {
    fontSize: 13,
    marginBottom: 12,
  },
  logSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  logSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  logSectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
