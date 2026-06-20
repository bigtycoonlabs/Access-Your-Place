/**
 * Push Notification Service
 * 
 * Manages the full push notification lifecycle:
 * - Device token registration with backend
 * - Notification permission requests
 * - Incoming notification handling (foreground + background)
 * - Notification tap deep linking to correct portal tab
 * - Token refresh and cleanup
 */

import { supabase } from '@/lib/supabase';
import { 
  isNative, getPlatform, getDeviceInfo, getDeviceId,
  registerPushNotifications, onPushNotificationReceived, 
  onPushNotificationAction, hapticFeedback
} from '@/lib/capacitor';

// Deep link route mapping for notification tap actions
const DEEP_LINK_TAB_MAP: Record<string, string> = {
  'deal_alert': 'deal-alerts',
  'deal-alerts': 'deal-alerts',
  'document_update': 'documents',
  'documents': 'documents',
  'acquisition_milestone': 'acquisitions',
  'acquisitions': 'acquisitions',
  'message': 'messages',
  'messages': 'messages',
  'marketplace': 'marketplace',
  'portfolio': 'portfolio',
  'financial': 'financial',
  'signatures': 'signatures',
  'settings': 'settings',
  'notifications': 'notifications-hub',
  'general': 'dashboard',
};

// Parse deep link URL to extract tab and params
function parseDeepLink(url: string): { tab: string; params: Record<string, string> } {
  try {
    // Handle custom scheme: accessyourplace://investor?tab=deal-alerts
    if (url.startsWith('accessyourplace://')) {
      const path = url.replace('accessyourplace://', '');
      const [route, queryString] = path.split('?');
      const params: Record<string, string> = {};
      
      if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        searchParams.forEach((value, key) => {
          params[key] = value;
        });
      }
      
      // If tab is specified in params, use it
      if (params.tab) {
        return { tab: DEEP_LINK_TAB_MAP[params.tab] || params.tab, params };
      }
      
      // Map route to tab
      if (route.startsWith('deals/')) {
        params.deal_id = route.replace('deals/', '');
        return { tab: 'deal-alerts', params };
      }
      if (route.startsWith('investor')) {
        return { tab: params.tab || 'dashboard', params };
      }
      
      return { tab: DEEP_LINK_TAB_MAP[route] || 'dashboard', params };
    }
    
    // Handle https links: https://accessyourplace.com/investor?tab=...
    const urlObj = new URL(url);
    const tab = urlObj.searchParams.get('tab') || 'dashboard';
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return { tab: DEEP_LINK_TAB_MAP[tab] || tab, params };
  } catch {
    return { tab: 'dashboard', params: {} };
  }
}

// Notification event callbacks
type NotificationCallback = (data: {
  tab: string;
  params: Record<string, string>;
  notification?: any;
}) => void;

let notificationTapCallback: NotificationCallback | null = null;
let foregroundNotificationCallback: ((notification: any) => void) | null = null;
let isInitialized = false;

/**
 * Initialize push notification listeners
 * Call this once when the app starts
 */
export async function initializePushNotifications(): Promise<void> {
  if (isInitialized || !isNative()) return;
  
  try {
    // Listen for notifications received while app is in foreground
    await onPushNotificationReceived((notification) => {
      console.log('[PushService] Notification received in foreground:', notification);
      
      // Trigger haptic feedback
      hapticFeedback('light');
      
      // Call the foreground callback if registered
      if (foregroundNotificationCallback) {
        foregroundNotificationCallback(notification);
      }
    });
    
    // Listen for notification tap actions
    await onPushNotificationAction((action) => {
      console.log('[PushService] Notification action performed:', action);
      
      const notification = action.notification;
      const data = notification?.data || {};
      
      // Parse the deep link from notification data
      const deepLink = data.deep_link || data.deepLink || '';
      const notificationType = data.notification_type || data.notificationType || 'general';
      
      let tab = 'dashboard';
      let params: Record<string, string> = {};
      
      if (deepLink) {
        const parsed = parseDeepLink(deepLink);
        tab = parsed.tab;
        params = parsed.params;
      } else {
        // Fallback: map notification type to tab
        tab = DEEP_LINK_TAB_MAP[notificationType] || 'dashboard';
      }
      
      // Add all notification data to params
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string') {
          params[key] = data[key];
        }
      });
      
      // Trigger haptic feedback
      hapticFeedback('medium');
      
      // Call the tap callback
      if (notificationTapCallback) {
        notificationTapCallback({ tab, params, notification });
      }
      
      // Mark notification as clicked in backend
      if (data.notification_id) {
        markNotificationClicked(data.notification_id).catch(console.error);
      }
    });
    
    isInitialized = true;
    console.log('[PushService] Push notification listeners initialized');
  } catch (error) {
    console.error('[PushService] Failed to initialize:', error);
  }
}

/**
 * Register a callback for when a notification is tapped
 * The callback receives the target tab and any params from the notification
 */
export function onNotificationTap(callback: NotificationCallback): () => void {
  notificationTapCallback = callback;
  return () => {
    notificationTapCallback = null;
  };
}

/**
 * Register a callback for foreground notifications
 */
export function onForegroundNotification(callback: (notification: any) => void): () => void {
  foregroundNotificationCallback = callback;
  return () => {
    foregroundNotificationCallback = null;
  };
}

/**
 * Register device token with the backend
 * Call this after successful login
 */
export async function registerDeviceToken(investorId: string): Promise<string | null> {
  if (!isNative()) {
    console.log('[PushService] Not native platform, skipping token registration');
    return null;
  }
  
  try {
    // Request permission and get token
    const token = await registerPushNotifications();
    
    if (!token) {
      console.log('[PushService] No token received (permission denied or error)');
      return null;
    }
    
    console.log('[PushService] Got push token:', token.substring(0, 20) + '...');
    
    // Get device info for registration
    const [deviceInfo, deviceId] = await Promise.all([
      getDeviceInfo(),
      getDeviceId()
    ]);
    
    // Register token with backend
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'register_token',
        investor_id: investorId,
        token,
        platform: getPlatform(),
        device_id: deviceId?.identifier || undefined,
        device_model: deviceInfo?.model || undefined,
        os_version: deviceInfo?.osVersion || undefined,
        app_version: '1.0.0',
      }
    });
    
    if (error) {
      console.error('[PushService] Token registration error:', error);
      return null;
    }
    
    if (data?.success) {
      console.log('[PushService] Token registered successfully');
      // Store token locally for reference
      localStorage.setItem('pushNotificationToken', token);
      localStorage.setItem('pushTokenInvestorId', investorId);
      return token;
    }
    
    console.error('[PushService] Token registration failed:', data?.error);
    return null;
  } catch (error) {
    console.error('[PushService] registerDeviceToken error:', error);
    return null;
  }
}

/**
 * Unregister device token (call on logout)
 */
export async function unregisterDeviceToken(investorId: string): Promise<void> {
  const token = localStorage.getItem('pushNotificationToken');
  
  if (!token || !investorId) return;
  
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'unregister_token',
        investor_id: investorId,
        token,
      }
    });
    
    localStorage.removeItem('pushNotificationToken');
    localStorage.removeItem('pushTokenInvestorId');
    console.log('[PushService] Token unregistered');
  } catch (error) {
    console.error('[PushService] Unregister error:', error);
  }
}

/**
 * Mark a notification as clicked (for analytics)
 */
async function markNotificationClicked(notificationId: string): Promise<void> {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'mark_clicked',
        data: { notification_id: notificationId }
      }
    });
  } catch (error) {
    console.error('[PushService] Mark clicked error:', error);
  }
}

/**
 * Get push notification history for the current investor
 */
export async function getNotificationHistory(investorId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'get_history',
        investor_id: investorId
      }
    });
    
    if (error) throw error;
    return data?.notifications || [];
  } catch (error) {
    console.error('[PushService] Get history error:', error);
    return [];
  }
}

/**
 * Get registered device tokens for the current investor
 */
export async function getDeviceTokens(investorId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        action: 'get_tokens',
        investor_id: investorId
      }
    });
    
    if (error) throw error;
    return data?.tokens || [];
  } catch (error) {
    console.error('[PushService] Get tokens error:', error);
    return [];
  }
}

/**
 * Check if push notifications are currently enabled
 */
export function isPushEnabled(): boolean {
  return !!localStorage.getItem('pushNotificationToken');
}

/**
 * Get the stored push token
 */
export function getStoredToken(): string | null {
  return localStorage.getItem('pushNotificationToken');
}

/**
 * Refresh the push token (call periodically or on app resume)
 */
export async function refreshToken(): Promise<void> {
  const investorId = localStorage.getItem('pushTokenInvestorId');
  if (!investorId || !isNative()) return;
  
  try {
    await registerDeviceToken(investorId);
  } catch (error) {
    console.error('[PushService] Token refresh error:', error);
  }
}
