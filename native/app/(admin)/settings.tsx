import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView, ActivityIndicator, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { colors as staticColors } from '../../src/constants/config';
import { adminApi } from '../../src/services/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [migrating, setMigrating] = useState(false);

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
            await signOut();
            // Navigate to root which will redirect to login
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleRunMigration = async () => {
    setMigrating(true);
    try {
      const response = await adminApi.runMigration();
      if (response.error) {
        Alert.alert('Migration Failed', response.error);
      } else if (response.data?.success) {
        Alert.alert('Success', 'Database migration completed successfully! All columns have been updated.');
      } else {
        Alert.alert('Warning', 'Migration may have completed with issues. Check the console.');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error occurred');
    }
    setMigrating(false);
  };

  const menuItems = [
    { icon: 'notifications-outline' as const, label: 'Notifications' },
    { icon: 'shield-outline' as const, label: 'Privacy & Security' },
    { icon: 'server-outline' as const, label: 'Data Management' },
    { icon: 'help-circle-outline' as const, label: 'Help & Support' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header Bar - matching dashboard */}
      <View style={[styles.headerBar, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}33` }]}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.userName, { color: colors.foreground }]}>{user?.fullName || 'Admin'}</Text>
            <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: `${colors.primary}20` }]}>
              <Text style={[styles.roleText, { color: colors.primary }]}>Administrator</Text>
            </View>
          </View>
        </View>

        {/* Dark Mode Toggle */}
        <View style={[styles.migrationCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.themeRow}>
            <View style={styles.themeRowLeft}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={24} color={isDark ? colors.primary : '#F59E0B'} />
              <View>
                <Text style={[styles.migrationTitle, { color: colors.foreground }]}>Dark Mode</Text>
                <Text style={[styles.migrationDescription, { color: colors.mutedForeground, marginBottom: 0 }]}>
                  {isDark ? 'Currently using dark theme' : 'Currently using light theme'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D1D5DB"
            />
          </View>
        </View>

        {/* Database Migration Card */}
        <View style={[styles.migrationCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.migrationHeader}>
            <Ionicons name="server" size={24} color={colors.primary} />
            <Text style={[styles.migrationTitle, { color: colors.foreground }]}>Database Migration</Text>
          </View>
          <Text style={[styles.migrationDescription, { color: colors.mutedForeground }]}>
            Run database migrations to add any missing columns. This is safe to run multiple times and won't affect existing data.
          </Text>
          <TouchableOpacity
            style={[styles.migrationButton, { backgroundColor: colors.primary }, migrating && styles.migrationButtonDisabled]}
            onPress={handleRunMigration}
            disabled={migrating}
          >
            {migrating ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.migrationButtonText}>Running Migration...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sync" size={18} color="#FFFFFF" />
                <Text style={styles.migrationButtonText}>Run Database Migration</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Menu */}
        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && styles.menuItemBorder,
              ]}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIconContainer}>
                  <Ionicons name={item.icon} size={20} color="#6B7280" />
                </View>
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutCard}>
          <View style={styles.signOutContent}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </View>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Titan Prime CRM v1.0.0 (Admin)</Text>
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
  headerLogo: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(201, 162, 77, 0.15)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: 'rgba(201, 162, 77, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  migrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  migrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  migrationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  migrationDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 16,
  },
  migrationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: staticColors.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  migrationButtonDisabled: {
    opacity: 0.7,
  },
  migrationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 4,
  },
  themeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  signOutCard: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  signOutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
  },
  versionText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 24,
  },
});
