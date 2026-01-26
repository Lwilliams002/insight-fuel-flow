import { useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, BellOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'notification_prompt_dismissed';

export function NotificationPrompt() {
  const { isSupported, permission, requestPermission } = useNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Show prompt if notifications are supported but not yet granted
    if (isSupported && permission === 'default') {
      // Check if user dismissed the prompt before
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) {
        // Delay showing the prompt slightly for better UX
        const timer = setTimeout(() => setIsVisible(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isSupported, permission]);

  const handleEnable = async () => {
    setIsLoading(true);
    const granted = await requestPermission();
    setIsLoading(false);
    if (granted) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(DISMISSED_KEY, 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300 sm:left-auto sm:right-4 sm:max-w-sm">
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground text-sm">Enable Notifications</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Get reminders 1 hour before appointments and a daily summary at 8 AM.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleEnable}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? 'Enabling...' : 'Enable'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                >
                  Later
                </Button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Status indicator for settings
export function NotificationStatus() {
  const { isSupported, permission, requestPermission } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
        <BellOff className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Notifications Not Supported</p>
          <p className="text-xs text-muted-foreground">Your browser doesn't support push notifications.</p>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (permission === 'granted') {
      // Can't revoke programmatically - direct user to settings
      alert('To disable notifications, go to your browser settings and revoke notification permissions for this site.');
      return;
    }

    setIsLoading(true);
    await requestPermission();
    setIsLoading(false);
  };

  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-xl",
      permission === 'granted' ? "bg-green-500/10" : "bg-muted/50"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-full",
          permission === 'granted' ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
        )}>
          {permission === 'granted' ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-medium">
            {permission === 'granted' ? 'Notifications Enabled' : 'Notifications Disabled'}
          </p>
          <p className="text-xs text-muted-foreground">
            {permission === 'granted'
              ? 'You\'ll receive appointment reminders'
              : permission === 'denied'
                ? 'Blocked in browser settings'
                : 'Enable to get appointment reminders'}
          </p>
        </div>
      </div>
      {permission !== 'denied' && (
        <Button
          size="sm"
          variant={permission === 'granted' ? 'outline' : 'default'}
          onClick={handleToggle}
          disabled={isLoading || permission === 'granted'}
        >
          {isLoading ? 'Enabling...' : permission === 'granted' ? 'Enabled' : 'Enable'}
        </Button>
      )}
    </div>
  );
}
