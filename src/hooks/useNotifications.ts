import { useState, useEffect, useCallback } from 'react';

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  scheduledTime: Date;
  tag: string;
}

const NOTIFICATION_PERMISSION_KEY = 'notification_permission_granted';
const SCHEDULED_NOTIFICATIONS_KEY = 'scheduled_notifications';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
        // Show a test notification
        showNotification('Notifications Enabled', {
          body: 'You will receive appointment reminders.',
          icon: '/pwa-192x192.png',
          tag: 'permission-granted'
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.warn('Cannot show notification - not permitted or supported');
      return;
    }

    // Try to use service worker notification first (works in background)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          requireInteraction: true,
          ...options,
        });
      });
    } else {
      // Fallback to regular notification
      new Notification(title, {
        icon: '/pwa-192x192.png',
        ...options,
      });
    }
  }, [isSupported, permission]);

  const scheduleNotification = useCallback((notification: ScheduledNotification) => {
    const scheduled = getScheduledNotifications();
    // Avoid duplicates
    const exists = scheduled.some(n => n.id === notification.id);
    if (!exists) {
      scheduled.push(notification);
      localStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(scheduled));
    }
  }, []);

  const getScheduledNotifications = useCallback((): ScheduledNotification[] => {
    try {
      const stored = localStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const clearScheduledNotification = useCallback((id: string) => {
    const scheduled = getScheduledNotifications().filter(n => n.id !== id);
    localStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(scheduled));
  }, [getScheduledNotifications]);

  const clearAllScheduledNotifications = useCallback(() => {
    localStorage.removeItem(SCHEDULED_NOTIFICATIONS_KEY);
  }, []);

  // Schedule appointment reminder (1 hour before)
  const scheduleAppointmentReminder = useCallback((appointment: {
    id: string;
    homeownerName: string;
    address: string;
    appointmentDate: Date;
  }) => {
    const oneHourBefore = new Date(appointment.appointmentDate.getTime() - 60 * 60 * 1000);

    // Only schedule if it's in the future
    if (oneHourBefore > new Date()) {
      scheduleNotification({
        id: `reminder-1h-${appointment.id}`,
        title: 'Appointment in 1 Hour',
        body: `${appointment.homeownerName} - ${appointment.address}`,
        scheduledTime: oneHourBefore,
        tag: `appointment-${appointment.id}`
      });
    }
  }, [scheduleNotification]);

  // Check and trigger due notifications
  const checkScheduledNotifications = useCallback(() => {
    if (permission !== 'granted') return;

    const now = new Date();
    const scheduled = getScheduledNotifications();
    const due = scheduled.filter(n => new Date(n.scheduledTime) <= now);

    due.forEach(notification => {
      showNotification(notification.title, {
        body: notification.body,
        tag: notification.tag,
      });
      clearScheduledNotification(notification.id);
    });
  }, [permission, getScheduledNotifications, showNotification, clearScheduledNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    scheduleNotification,
    scheduleAppointmentReminder,
    checkScheduledNotifications,
    getScheduledNotifications,
    clearScheduledNotification,
    clearAllScheduledNotifications,
  };
}
