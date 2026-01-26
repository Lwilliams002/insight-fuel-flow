import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pinsApi } from '@/integrations/aws/api';
import { useNotifications } from './useNotifications';

interface Appointment {
  id: string;
  homeowner_name: string;
  address: string;
  appointment_date: string;
  appointment_end_date?: string;
  appointment_all_day?: boolean;
}

const DAILY_SUMMARY_SENT_KEY = 'daily_summary_sent_date';
const PROCESSED_REMINDERS_KEY = 'processed_appointment_reminders';

export function useAppointmentNotifications() {
  const {
    permission,
    showNotification,
    checkScheduledNotifications
  } = useNotifications();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDailySummaryRef = useRef<string | null>(null);

  // Fetch appointments (pins with status 'appointment')
  const { data: appointments } = useQuery({
    queryKey: ['appointments-for-notifications'],
    queryFn: async () => {
      const result = await pinsApi.list();
      if (result.error) throw new Error(result.error);
      // Filter for appointments only
      return (result.data || []).filter(
        (pin: Appointment & { status: string }) => pin.status === 'appointment' && pin.appointment_date
      ) as Appointment[];
    },
    enabled: permission === 'granted',
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Get processed reminders from localStorage
  const getProcessedReminders = useCallback((): Set<string> => {
    try {
      const stored = localStorage.getItem(PROCESSED_REMINDERS_KEY);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  }, []);

  // Mark reminder as processed
  const markReminderProcessed = useCallback((id: string) => {
    const processed = getProcessedReminders();
    processed.add(id);
    // Keep only last 100 to prevent localStorage bloat
    const arr = Array.from(processed).slice(-100);
    localStorage.setItem(PROCESSED_REMINDERS_KEY, JSON.stringify(arr));
  }, [getProcessedReminders]);

  // Check if daily summary was already sent today
  const wasDailySummarySentToday = useCallback((): boolean => {
    const today = new Date().toDateString();
    const lastSent = localStorage.getItem(DAILY_SUMMARY_SENT_KEY);
    return lastSent === today;
  }, []);

  // Mark daily summary as sent
  const markDailySummarySent = useCallback(() => {
    const today = new Date().toDateString();
    localStorage.setItem(DAILY_SUMMARY_SENT_KEY, today);
    lastDailySummaryRef.current = today;
  }, []);

  // Send daily summary at 8 AM
  const checkDailySummary = useCallback(() => {
    if (permission !== 'granted' || !appointments || appointments.length === 0) return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Check if it's between 8:00 AM and 8:05 AM and summary wasn't sent today
    if (hour === 8 && minute < 5 && !wasDailySummarySentToday()) {
      const today = now.toDateString();

      // Get today's appointments
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

        showNotification(`📅 Today's Appointments (${todaysAppointments.length})`, {
          body: appointmentList,
          tag: 'daily-summary',
          requireInteraction: true,
        });
      } else {
        showNotification('📅 No Appointments Today', {
          body: 'You have no scheduled appointments for today.',
          tag: 'daily-summary',
        });
      }

      markDailySummarySent();
    }
  }, [permission, appointments, wasDailySummarySentToday, showNotification, markDailySummarySent]);

  // Check for 1-hour reminders
  const checkOneHourReminders = useCallback(() => {
    if (permission !== 'granted' || !appointments) return;

    const now = new Date();
    const processedReminders = getProcessedReminders();

    appointments.forEach(appointment => {
      const appointmentTime = new Date(appointment.appointment_date);
      const reminderId = `1h-${appointment.id}-${appointmentTime.toISOString()}`;

      // Check if this reminder was already sent
      if (processedReminders.has(reminderId)) return;

      // Check if appointment is within the next hour (55-65 minutes from now to allow for timing variance)
      const timeDiff = appointmentTime.getTime() - now.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff > 55 && minutesDiff <= 65) {
        const timeStr = appointment.appointment_all_day
          ? 'Today (All Day)'
          : appointmentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        showNotification('⏰ Appointment in 1 Hour', {
          body: `${appointment.homeowner_name}\n${appointment.address}\n${timeStr}`,
          tag: `reminder-${appointment.id}`,
          requireInteraction: true,
        });

        markReminderProcessed(reminderId);
      }
    });
  }, [permission, appointments, getProcessedReminders, markReminderProcessed, showNotification]);

  // Main check function that runs periodically
  const runNotificationChecks = useCallback(() => {
    checkScheduledNotifications();
    checkDailySummary();
    checkOneHourReminders();
  }, [checkScheduledNotifications, checkDailySummary, checkOneHourReminders]);

  // Set up interval to check notifications
  useEffect(() => {
    if (permission !== 'granted') return;

    // Run immediately on mount
    runNotificationChecks();

    // Then run every minute
    intervalRef.current = setInterval(runNotificationChecks, 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [permission, runNotificationChecks]);

  return {
    appointmentsCount: appointments?.length || 0,
  };
}
