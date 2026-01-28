import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Install and activate
self.skipWaiting();
self.clientsClaim();

// Precache assets
precacheAndRoute(self.__WB_MANIFEST || []);

// Clean up old caches
cleanupOutdatedCaches();

// Cache API calls
registerRoute(
  /^https:\/\/.*\.execute-api\..*\.amazonaws\.com\/.*/i,
  new NetworkFirst({
    cacheName: 'aws-api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 86400
      })
    ]
  }),
  'GET'
);

// Cache Mapbox API
registerRoute(
  /^https:\/\/api\.mapbox\.com\/.*/i,
  new CacheFirst({
    cacheName: 'mapbox-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 604800
      })
    ]
  }),
  'GET'
);

// Handle push events (for future push notification implementation)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Notification', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab with the target URL
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for notifications (check every 5 minutes)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'notification-check') {
    event.waitUntil(checkForNotifications());
  }
});

// Also check on service worker activation and periodically
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Start periodic checks
      scheduleNotificationChecks()
    ])
  );
});

// Function to schedule periodic notification checks
async function scheduleNotificationChecks() {
  // Check every 5 minutes
  setInterval(async () => {
    try {
      await checkForNotifications();
    } catch (error) {
      console.error('Periodic notification check failed:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Function to check for notifications in background
async function checkForNotifications() {
  try {
    // Get stored auth data
    const authData = await getStoredAuthData();
    if (!authData || !authData.token || Date.now() > authData.expires) {
      console.log('No valid auth data for background notifications');
      return;
    }

    // Get stored user data
    const userData = await getStoredUserData();
    if (!userData || !userData.sub) {
      console.log('No user data for background notifications');
      return;
    }

    // Get API config
    const apiConfig = await getStoredApiConfig();
    if (!apiConfig || !apiConfig.baseUrl) {
      console.log('No API config for background notifications');
      return;
    }

    // Fetch appointments using the stored API endpoint
    const appointmentsResponse = await fetch(`${apiConfig.baseUrl}/pins`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!appointmentsResponse.ok) {
      console.error('Failed to fetch appointments:', appointmentsResponse.status);
      return;
    }

    const result = await appointmentsResponse.json();
    const appointments = (result.data || []).filter(
      pin => pin.status === 'appointment' && pin.appointment_date && pin.rep_id === userData.sub
    );

    // Check for reminders (similar logic to the frontend)
    const now = new Date();
    const processedReminders = await getProcessedReminders();

    for (const appointment of appointments) {
      const appointmentTime = new Date(appointment.appointment_date);
      const reminderId = `1h-${appointment.id}-${appointmentTime.toISOString()}`;

      // Skip if already processed
      if (processedReminders.has(reminderId)) continue;

      // Check if appointment is within the next hour
      const timeDiff = appointmentTime.getTime() - now.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff > 55 && minutesDiff <= 65) {
        const timeStr = appointment.appointment_all_day
          ? 'Today (All Day)'
          : appointmentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        self.registration.showNotification('⏰ Appointment in 1 Hour', {
          body: `${appointment.homeowner_name}\n${appointment.address}\n${timeStr}`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `reminder-${appointment.id}`,
          requireInteraction: true,
          data: { appointmentId: appointment.id }
        });

        processedReminders.add(reminderId);
        await storeProcessedReminders(processedReminders);
      }
    }

    // Check for daily summary at 8 AM
    const hour = now.getHours();
    const minute = now.getMinutes();
    const today = now.toDateString();
    const lastSummaryDate = await getLastSummaryDate();

    if (hour === 8 && minute < 5 && lastSummaryDate !== today) {
      const todaysAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.appointment_date);
        return aptDate.toDateString() === today;
      });

      if (todaysAppointments.length > 0) {
        const appointmentList = todaysAppointments
          .map(apt => {
            const time = apt.appointment_all_day
              ? 'All Day'
              : new Date(apt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${time} - ${apt.homeowner_name}`;
          })
          .join('\n');

        self.registration.showNotification(`📅 Today's Appointments (${todaysAppointments.length})`, {
          body: appointmentList,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'daily-summary',
          requireInteraction: true
        });
      } else {
        self.registration.showNotification('📅 No Appointments Today', {
          body: 'You have no scheduled appointments for today.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'daily-summary'
        });
      }

      await storeLastSummaryDate(today);
    }

  } catch (error) {
    console.error('Background notification check failed:', error);
  }
}

// Helper functions for storage (using Cache API since localStorage isn't available in SW)
async function getStoredAuthData() {
  try {
    const cache = await caches.open('auth-cache');
    const response = await cache.match('/auth-data');
    if (response) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to get auth data:', error);
  }
  return null;
}

async function getStoredUserData() {
  try {
    const cache = await caches.open('user-cache');
    const response = await cache.match('/user-data');
    if (response) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to get user data:', error);
  }
  return null;
}

async function getProcessedReminders() {
  try {
    const cache = await caches.open('notification-cache');
    const response = await cache.match('/processed-reminders');
    if (response) {
      const data = await response.json();
      return new Set(data);
    }
  } catch (error) {
    console.error('Failed to get processed reminders:', error);
  }
  return new Set();
}

async function storeProcessedReminders(reminders) {
  try {
    const cache = await caches.open('notification-cache');
    const response = new Response(JSON.stringify(Array.from(reminders).slice(-100)));
    await cache.put('/processed-reminders', response);
  } catch (error) {
    console.error('Failed to store processed reminders:', error);
  }
}

async function getLastSummaryDate() {
  try {
    const cache = await caches.open('notification-cache');
    const response = await cache.match('/last-summary-date');
    if (response) {
      return await response.text();
    }
  } catch (error) {
    console.error('Failed to get last summary date:', error);
  }
  return null;
}

async function storeLastSummaryDate(date) {
  try {
    const cache = await caches.open('notification-cache');
    const response = new Response(date);
    await cache.put('/last-summary-date', response);
  } catch (error) {
    console.error('Failed to store last summary date:', error);
  }
}

async function getStoredApiConfig() {
  try {
    const cache = await caches.open('api-cache');
    const response = await cache.match('/api-config');
    if (response) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to get API config:', error);
  }
  return null;
}
