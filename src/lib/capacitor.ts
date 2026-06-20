/**
 * Capacitor Platform Utilities
 * 
 * Provides platform detection, native API wrappers, and cross-platform
 * utilities for iOS, Android, and Web deployment.
 */

import { Capacitor } from '@capacitor/core';

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

export type Platform = 'ios' | 'android' | 'web';

/**
 * Get the current platform
 */
export const getPlatform = (): Platform => {
  return Capacitor.getPlatform() as Platform;
};

/**
 * Check if running as a native app (iOS or Android)
 */
export const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  return Capacitor.getPlatform() === 'ios';
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  return Capacitor.getPlatform() === 'android';
};

/**
 * Check if running on web
 */
export const isWeb = (): boolean => {
  return Capacitor.getPlatform() === 'web';
};

/**
 * Check if a specific plugin is available on the current platform
 */
export const isPluginAvailable = (pluginName: string): boolean => {
  return Capacitor.isPluginAvailable(pluginName);
};

// ============================================================================
// STATUS BAR
// ============================================================================

/**
 * Configure the native status bar
 */
export const configureStatusBar = async (options?: {
  style?: 'Dark' | 'Light' | 'Default';
  backgroundColor?: string;
  overlaysWebView?: boolean;
}) => {
  if (!isNative()) return;
  
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    
    const style = options?.style === 'Dark' 
      ? Style.Dark 
      : options?.style === 'Light' 
        ? Style.Light 
        : Style.Default;
    
    await StatusBar.setStyle({ style });
    
    if (isAndroid() && options?.backgroundColor) {
      await StatusBar.setBackgroundColor({ color: options.backgroundColor });
    }
    
    if (options?.overlaysWebView !== undefined) {
      await StatusBar.setOverlaysWebView({ overlay: options.overlaysWebView });
    }
  } catch (error) {
    console.warn('StatusBar plugin not available:', error);
  }
};

/**
 * Hide the status bar
 */
export const hideStatusBar = async () => {
  if (!isNative()) return;
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.hide();
  } catch (error) {
    console.warn('StatusBar hide failed:', error);
  }
};

/**
 * Show the status bar
 */
export const showStatusBar = async () => {
  if (!isNative()) return;
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.show();
  } catch (error) {
    console.warn('StatusBar show failed:', error);
  }
};

// ============================================================================
// SPLASH SCREEN
// ============================================================================

/**
 * Hide the splash screen
 */
export const hideSplashScreen = async (fadeOutDuration?: number) => {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: fadeOutDuration || 500 });
  } catch (error) {
    console.warn('SplashScreen hide failed:', error);
  }
};

// ============================================================================
// HAPTICS
// ============================================================================

/**
 * Trigger haptic feedback
 */
export const hapticFeedback = async (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'medium') => {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        break;
    }
  } catch (error) {
    console.warn('Haptics not available:', error);
  }
};

/**
 * Trigger selection haptic (for UI selections)
 */
export const hapticSelection = async () => {
  if (!isNative()) return;
  try {
    const { Haptics } = await import('@capacitor/haptics');
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (error) {
    console.warn('Haptics selection not available:', error);
  }
};

// ============================================================================
// KEYBOARD
// ============================================================================

/**
 * Configure keyboard behavior
 */
export const configureKeyboard = async () => {
  if (!isNative()) return;
  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    await Keyboard.setScroll({ isDisabled: false });
    
    // Add keyboard event listeners
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      document.body.classList.add('keyboard-open');
    });
    
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.style.setProperty('--keyboard-height', '0px');
      document.body.classList.remove('keyboard-open');
    });
  } catch (error) {
    console.warn('Keyboard plugin not available:', error);
  }
};

// ============================================================================
// NETWORK
// ============================================================================

/**
 * Get current network status
 */
export const getNetworkStatus = async () => {
  try {
    const { Network } = await import('@capacitor/network');
    return await Network.getStatus();
  } catch (error) {
    console.warn('Network plugin not available:', error);
    return { connected: navigator.onLine, connectionType: 'unknown' as const };
  }
};

/**
 * Listen for network status changes
 */
export const onNetworkChange = async (callback: (status: { connected: boolean; connectionType: string }) => void) => {
  try {
    const { Network } = await import('@capacitor/network');
    const handle = await Network.addListener('networkStatusChange', callback);
    return handle;
  } catch (error) {
    console.warn('Network listener not available:', error);
    // Fallback to web API
    const handler = () => callback({ connected: navigator.onLine, connectionType: 'unknown' });
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return {
      remove: () => {
        window.removeEventListener('online', handler);
        window.removeEventListener('offline', handler);
      }
    };
  }
};

// ============================================================================
// SHARE
// ============================================================================

/**
 * Share content using native share sheet
 */
export const shareContent = async (options: {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}) => {
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: options.dialogTitle || 'Share',
    });
  } catch (error) {
    // Fallback to Web Share API
    if (navigator.share) {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
    } else {
      // Fallback: copy to clipboard
      const shareText = options.url || options.text || '';
      await navigator.clipboard.writeText(shareText);
      console.log('Content copied to clipboard');
    }
  }
};

// ============================================================================
// BROWSER
// ============================================================================

/**
 * Open URL in native browser (SFSafariViewController / Chrome Custom Tabs)
 */
export const openExternalUrl = async (url: string) => {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch (error) {
    // Fallback to window.open
    window.open(url, '_blank');
  }
};

/**
 * Close the in-app browser
 */
export const closeExternalBrowser = async () => {
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch (error) {
    console.warn('Browser close not available:', error);
  }
};

// ============================================================================
// CLIPBOARD
// ============================================================================

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string) => {
  try {
    const { Clipboard } = await import('@capacitor/clipboard');
    await Clipboard.write({ string: text });
  } catch (error) {
    // Fallback to web API
    await navigator.clipboard.writeText(text);
  }
};

/**
 * Read text from clipboard
 */
export const readFromClipboard = async (): Promise<string> => {
  try {
    const { Clipboard } = await import('@capacitor/clipboard');
    const result = await Clipboard.read();
    return result.value;
  } catch (error) {
    // Fallback to web API
    return await navigator.clipboard.readText();
  }
};

// ============================================================================
// DEVICE INFO
// ============================================================================

/**
 * Get device information
 */
export const getDeviceInfo = async () => {
  try {
    const { Device } = await import('@capacitor/device');
    return await Device.getInfo();
  } catch (error) {
    console.warn('Device plugin not available:', error);
    return {
      model: 'unknown',
      platform: getPlatform(),
      operatingSystem: getPlatform(),
      osVersion: 'unknown',
      manufacturer: 'unknown',
      isVirtual: false,
      webViewVersion: 'unknown',
    };
  }
};

/**
 * Get device unique ID
 */
export const getDeviceId = async () => {
  try {
    const { Device } = await import('@capacitor/device');
    return await Device.getId();
  } catch (error) {
    console.warn('Device ID not available:', error);
    return { identifier: 'web-' + Date.now() };
  }
};

// ============================================================================
// TOAST (Native)
// ============================================================================

/**
 * Show a native toast message
 */
export const showNativeToast = async (text: string, duration: 'short' | 'long' = 'short', position: 'top' | 'center' | 'bottom' = 'bottom') => {
  if (!isNative()) return;
  try {
    const { Toast } = await import('@capacitor/toast');
    await Toast.show({ text, duration, position });
  } catch (error) {
    console.warn('Toast not available:', error);
  }
};

// ============================================================================
// APP LIFECYCLE
// ============================================================================

/**
 * Listen for app state changes (foreground/background)
 */
export const onAppStateChange = async (callback: (state: { isActive: boolean }) => void) => {
  try {
    const { App } = await import('@capacitor/app');
    const handle = await App.addListener('appStateChange', callback);
    return handle;
  } catch (error) {
    console.warn('App state listener not available:', error);
    // Fallback to web visibility API
    const handler = () => callback({ isActive: !document.hidden });
    document.addEventListener('visibilitychange', handler);
    return {
      remove: () => document.removeEventListener('visibilitychange', handler),
    };
  }
};

/**
 * Listen for back button press (Android)
 */
export const onBackButton = async (callback: () => void) => {
  if (!isAndroid()) return;
  try {
    const { App } = await import('@capacitor/app');
    const handle = await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        callback();
      }
    });
    return handle;
  } catch (error) {
    console.warn('Back button listener not available:', error);
  }
};

/**
 * Listen for deep links / URL opens
 */
export const onDeepLink = async (callback: (url: string) => void) => {
  try {
    const { App } = await import('@capacitor/app');
    const handle = await App.addListener('appUrlOpen', (event) => {
      callback(event.url);
    });
    return handle;
  } catch (error) {
    console.warn('Deep link listener not available:', error);
  }
};

/**
 * Exit the app (Android only)
 */
export const exitApp = async () => {
  if (!isAndroid()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.exitApp();
  } catch (error) {
    console.warn('Exit app not available:', error);
  }
};

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

/**
 * Register for push notifications
 */
export const registerPushNotifications = async () => {
  if (!isNative()) return null;
  
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    
    if (permResult.receive === 'granted') {
      // Register with APNS/FCM
      await PushNotifications.register();
      
      // Return a promise that resolves with the token
      return new Promise<string>((resolve) => {
        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token:', token.value);
          resolve(token.value);
        });
        
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
          resolve('');
        });
      });
    }
    
    return null;
  } catch (error) {
    console.warn('Push notifications not available:', error);
    return null;
  }
};

/**
 * Listen for push notification received
 */
export const onPushNotificationReceived = async (callback: (notification: any) => void) => {
  if (!isNative()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return PushNotifications.addListener('pushNotificationReceived', callback);
  } catch (error) {
    console.warn('Push notification listener not available:', error);
  }
};

/**
 * Listen for push notification action (tap)
 */
export const onPushNotificationAction = async (callback: (notification: any) => void) => {
  if (!isNative()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return PushNotifications.addListener('pushNotificationActionPerformed', callback);
  } catch (error) {
    console.warn('Push notification action listener not available:', error);
  }
};

// ============================================================================
// LOCAL NOTIFICATIONS
// ============================================================================

/**
 * Schedule a local notification
 */
export const scheduleLocalNotification = async (options: {
  title: string;
  body: string;
  id?: number;
  schedule?: { at: Date };
  extra?: any;
}) => {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    
    const permResult = await LocalNotifications.requestPermissions();
    if (permResult.display === 'granted') {
      await LocalNotifications.schedule({
        notifications: [{
          title: options.title,
          body: options.body,
          id: options.id || Math.floor(Math.random() * 100000),
          schedule: options.schedule,
          extra: options.extra,
        }],
      });
    }
  } catch (error) {
    console.warn('Local notifications not available:', error);
    // Fallback to web notifications
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(options.title, { body: options.body });
    }
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize all Capacitor plugins and configure the app for native
 */
export const initializeCapacitor = async () => {
  console.log(`[Capacitor] Platform: ${getPlatform()}, Native: ${isNative()}`);
  
  if (!isNative()) {
    console.log('[Capacitor] Running on web - skipping native initialization');
    return;
  }
  
  try {
    // Configure status bar
    await configureStatusBar({
      style: 'Light',
      backgroundColor: '#1a365d',
      overlaysWebView: false,
    });
    
    // Configure keyboard
    await configureKeyboard();
    
    // Hide splash screen after a short delay
    setTimeout(() => {
      hideSplashScreen(500);
    }, 1000);
    
    // Set up Android back button handler
    if (isAndroid()) {
      await onBackButton(() => {
        // Show exit confirmation or minimize app
        exitApp();
      });
    }
    
    // Listen for deep links
    await onDeepLink((url) => {
      console.log('[Capacitor] Deep link received:', url);
      // Parse the URL and navigate accordingly
      const path = new URL(url).pathname;
      if (path) {
        window.location.hash = path;
      }
    });
    
    // Listen for app state changes
    await onAppStateChange((state) => {
      console.log('[Capacitor] App state changed:', state.isActive ? 'active' : 'background');
      // You can refresh data when app comes to foreground
      if (state.isActive) {
        document.dispatchEvent(new CustomEvent('app-resumed'));
      }
    });
    
    console.log('[Capacitor] Native initialization complete');
  } catch (error) {
    console.error('[Capacitor] Initialization error:', error);
  }
};
