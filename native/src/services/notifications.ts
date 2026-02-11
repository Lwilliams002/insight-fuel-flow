import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

export interface NotificationSettings {
  enabled: boolean;
  appointmentReminders: boolean;
  eventReminders: boolean;
  reminderMinutes: number; // Minutes before appointment/event
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  appointmentReminders: true,
  eventReminders: true,
  reminderMinutes: 60, // 1 hour before
};

// Get notification settings from storage
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
    return defaultSettings;
  } catch (error) {
    console.error('Error loading notification settings:', error);
    return defaultSettings;
  }
}

// Save notification settings
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving notification settings:', error);
  }
}

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Notifications require a physical device');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permissions not granted');
    return false;
  }

  // Set up notification channel for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Appointments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C9A24D',
    });

    await Notifications.setNotificationChannelAsync('events', {
      name: 'Events',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
  }

  return true;
}

// Schedule an appointment reminder
export async function scheduleAppointmentReminder(
  appointmentId: string,
  title: string,
  address: string,
  appointmentDate: Date,
  reminderMinutesBefore: number = 30
): Promise<string | null> {
  const settings = await getNotificationSettings();

  if (!settings.enabled || !settings.appointmentReminders) {
    return null;
  }

  // Calculate reminder time
  const reminderTime = new Date(appointmentDate.getTime() - reminderMinutesBefore * 60 * 1000);

  // Don't schedule if reminder time is in the past
  if (reminderTime <= new Date()) {
    return null;
  }

  try {
    // Cancel any existing notification for this appointment
    await cancelNotification(`appointment-${appointmentId}`);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📅 Upcoming Appointment',
        body: `${title} at ${address} in ${reminderMinutesBefore} minutes`,
        data: { type: 'appointment', id: appointmentId },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
        channelId: Platform.OS === 'android' ? 'appointments' : undefined,
      },
      identifier: `appointment-${appointmentId}`,
    });

    return `appointment-${appointmentId}`;
  } catch (error) {
    console.error('Error scheduling appointment reminder:', error);
    return null;
  }
}

// Schedule an event reminder
export async function scheduleEventReminder(
  eventId: string,
  title: string,
  eventDate: Date,
  reminderMinutesBefore: number = 30
): Promise<string | null> {
  const settings = await getNotificationSettings();

  if (!settings.enabled || !settings.eventReminders) {
    return null;
  }

  // Calculate reminder time
  const reminderTime = new Date(eventDate.getTime() - reminderMinutesBefore * 60 * 1000);

  // Don't schedule if reminder time is in the past
  if (reminderTime <= new Date()) {
    return null;
  }

  try {
    // Cancel any existing notification for this event
    await cancelNotification(`event-${eventId}`);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🗓️ Event Reminder',
        body: `${title} starts in ${reminderMinutesBefore} minutes`,
        data: { type: 'event', id: eventId },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
        channelId: Platform.OS === 'android' ? 'events' : undefined,
      },
      identifier: `event-${eventId}`,
    });

    return `event-${eventId}`;
  } catch (error) {
    console.error('Error scheduling event reminder:', error);
    return null;
  }
}

// Cancel a specific notification
export async function cancelNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    // Ignore error if notification doesn't exist
  }
}

// Cancel all scheduled notifications
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Get all scheduled notifications
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

// Send immediate test notification
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Test Notification',
      body: 'Notifications are working! You will receive reminders for your appointments and events.',
      sound: true,
    },
    trigger: null, // Send immediately
  });
}



