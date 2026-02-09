import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { colors as staticColors } from '../../src/constants/config';
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermissions,
  sendTestNotification,
  NotificationSettings,
} from '../../src/services/notifications';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled: true,
    appointmentReminders: true,
    eventReminders: true,
    reminderMinutes: 30,
  });
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // Load notification settings on mount
  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    const settings = await getNotificationSettings();
    setNotificationSettings(settings);

    // Check if permissions are granted
    const granted = await requestNotificationPermissions();
    setPermissionsGranted(granted);
  };

  const updateNotificationSetting = async (key: keyof NotificationSettings, value: boolean | number) => {
    const newSettings = { ...notificationSettings, [key]: value };
    setNotificationSettings(newSettings);
    await saveNotificationSettings(newSettings);
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermissions();
    setPermissionsGranted(granted);

    if (granted) {
      await updateNotificationSetting('enabled', true);
      Alert.alert('Success', 'Notifications enabled! You will receive reminders for appointments and events.');
    } else {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive reminders.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleTestNotification = async () => {
    if (!permissionsGranted) {
      Alert.alert('Notifications Disabled', 'Please enable notifications first.');
      return;
    }
    await sendTestNotification();
    Alert.alert('Test Sent', 'Check your notification panel!');
  };

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

  const menuItems = [
    { icon: 'shield-outline' as const, label: 'Privacy & Security' },
    { icon: 'help-circle-outline' as const, label: 'Help & Support' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.secondary }]}>
        <View style={styles.headerContent}>
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}33` }]}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.userName}>{user?.fullName || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Appearance</Text>
        <View style={[styles.menuCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.themeRow}>
            <View style={styles.menuItemLeft}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={isDark ? colors.primary : '#F59E0B'} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Dark Mode</Text>
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

        {/* Notifications Section */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 20 }]}>Notifications</Text>
        <View style={[styles.menuCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          {/* Enable Notifications */}
          <View style={[styles.themeRow, styles.menuItemBorder, { borderBottomColor: colors.border }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications" size={20} color={notificationSettings.enabled ? colors.primary : colors.mutedForeground} />
              <View>
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>Push Notifications</Text>
                <Text style={[styles.menuItemSubtext, { color: colors.mutedForeground }]}>
                  {permissionsGranted ? 'Enabled' : 'Tap to enable'}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.enabled && permissionsGranted}
              onValueChange={(value) => {
                if (value && !permissionsGranted) {
                  handleEnableNotifications();
                } else {
                  updateNotificationSetting('enabled', value);
                }
              }}
              trackColor={{ false: '#D1D5DB', true: colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D1D5DB"
            />
          </View>

          {/* Appointment Reminders */}
          <View style={[styles.themeRow, styles.menuItemBorder, { borderBottomColor: colors.border }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="calendar" size={20} color={notificationSettings.appointmentReminders ? '#8B5CF6' : colors.mutedForeground} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Appointment Reminders</Text>
            </View>
            <Switch
              value={notificationSettings.appointmentReminders}
              onValueChange={(value) => updateNotificationSetting('appointmentReminders', value)}
              trackColor={{ false: '#D1D5DB', true: '#8B5CF6' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D1D5DB"
              disabled={!notificationSettings.enabled || !permissionsGranted}
            />
          </View>

          {/* Event Reminders */}
          <View style={[styles.themeRow, styles.menuItemBorder, { borderBottomColor: colors.border }]}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="time" size={20} color={notificationSettings.eventReminders ? '#22C55E' : colors.mutedForeground} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Event Reminders</Text>
            </View>
            <Switch
              value={notificationSettings.eventReminders}
              onValueChange={(value) => updateNotificationSetting('eventReminders', value)}
              trackColor={{ false: '#D1D5DB', true: '#22C55E' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D1D5DB"
              disabled={!notificationSettings.enabled || !permissionsGranted}
            />
          </View>

          {/* Test Notification */}
          <TouchableOpacity
            style={styles.themeRow}
            onPress={handleTestNotification}
            disabled={!notificationSettings.enabled || !permissionsGranted}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="send" size={20} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Send Test Notification</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Reminder Time Info */}
        <Text style={[styles.reminderInfo, { color: colors.mutedForeground }]}>
          You'll receive reminders 30 minutes before appointments and events.
        </Text>

        {/* Training Section */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 20 }]}>Learning</Text>
        <View style={[styles.menuCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/(rep)/training')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="school" size={20} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Training Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(rep)/coaching')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="clipboard" size={20} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Coaching Logs</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Settings Section */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 20 }]}>Settings</Text>
        <View style={[styles.menuCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && [styles.menuItemBorder, { borderBottomColor: colors.border }],
              ]}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon} size={20} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.foreground }]}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity onPress={handleSignOut} style={[styles.signOutCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.signOutContent}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </View>
        </TouchableOpacity>

        {/* Version */}
        <Text style={[styles.versionText, { color: colors.mutedForeground }]}>Titan Prime CRM v1.0.0</Text>

        <View style={{ height: 40 }} />
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
    paddingVertical: 24,
    backgroundColor: staticColors.secondary,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(201, 162, 77, 0.2)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  menuContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
  },
  menuItemSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  reminderInfo: {
    fontSize: 12,
    marginTop: 8,
    marginHorizontal: 4,
    fontStyle: 'italic',
  },
  signOutCard: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    fontSize: 14,
    marginTop: 24,
  },
});
