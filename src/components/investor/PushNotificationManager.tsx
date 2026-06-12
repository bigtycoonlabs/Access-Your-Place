/**
 * PushNotificationManager
 * 
 * Invisible component that handles:
 * - Registering device tokens on mount (after login)
 * - Listening for foreground notifications and showing toast
 * - Handling notification tap actions to navigate to correct tab
 * - Token refresh on app resume
 */

import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isNative } from '@/lib/capacitor';
import {
  initializePushNotifications,
  registerDeviceToken,
  onNotificationTap,
  onForegroundNotification,
  refreshToken,
} from '@/services/PushNotificationService';

interface PushNotificationManagerProps {
  investorId: string;
  investorName: string;
  onNavigateToTab: (tab: string) => void;
}

export function PushNotificationManager({ 
  investorId, 
  investorName,
  onNavigateToTab 
}: PushNotificationManagerProps) {
  const { toast } = useToast();
  const initialized = useRef(false);

  useEffect(() => {
    if (!investorId || initialized.current) return;
    initialized.current = true;

    const setup = async () => {
      // Initialize push notification listeners
      await initializePushNotifications();

      // Register device token
      const token = await registerDeviceToken(investorId);
      if (token) {
        console.log('[PushManager] Device token registered for', investorName);
      }
    };

    setup();
  }, [investorId, investorName]);

  // Handle notification taps - navigate to correct tab
  useEffect(() => {
    if (!isNative()) return;

    const unsubTap = onNotificationTap(({ tab, params, notification }) => {
      console.log('[PushManager] Notification tapped, navigating to:', tab, params);
      
      // Navigate to the target tab
      onNavigateToTab(tab);

      // Show a brief toast confirming navigation
      const title = notification?.title || notification?.data?.title || 'Notification';
      toast({
        title,
        description: `Navigated to ${tab.replace(/-/g, ' ')}`,
        duration: 2000,
      });
    });

    return () => {
      unsubTap();
    };
  }, [onNavigateToTab, toast]);

  // Handle foreground notifications - show toast
  useEffect(() => {
    if (!isNative()) return;

    const unsubForeground = onForegroundNotification((notification) => {
      console.log('[PushManager] Foreground notification:', notification);

      const title = notification.title || 'New Notification';
      const body = notification.body || '';
      const notificationType = notification.data?.notification_type || 'general';

      // Map notification type to icon description
      const typeLabels: Record<string, string> = {
        deal_alert: 'Deal Alert',
        document_update: 'Document Update',
        acquisition_milestone: 'Acquisition Update',
        message: 'New Message',
        general: 'Notification',
      };

      toast({
        title: `${typeLabels[notificationType] || 'Notification'}: ${title}`,
        description: body,
        duration: 5000,
      });
    });

    return () => {
      unsubForeground();
    };
  }, [toast]);

  // Refresh token on app resume
  useEffect(() => {
    if (!isNative()) return;

    const handleResume = () => {
      console.log('[PushManager] App resumed, refreshing token...');
      refreshToken();
    };

    document.addEventListener('app-resumed', handleResume);
    return () => {
      document.removeEventListener('app-resumed', handleResume);
    };
  }, []);

  // This component renders nothing - it's purely for side effects
  return null;
}
