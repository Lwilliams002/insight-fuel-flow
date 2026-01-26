import { createContext, useContext, ReactNode } from 'react';
import { useAppointmentNotifications } from '@/hooks/useAppointmentNotifications';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPrompt } from '@/components/NotificationPrompt';

interface NotificationContextValue {
  isSupported: boolean;
  permission: NotificationPermission;
  requestPermission: () => Promise<boolean>;
  appointmentsCount: number;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isSupported, permission, requestPermission } = useNotifications();
  const { appointmentsCount } = useAppointmentNotifications();

  return (
    <NotificationContext.Provider value={{
      isSupported,
      permission,
      requestPermission,
      appointmentsCount,
    }}>
      {children}
      <NotificationPrompt />
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}
