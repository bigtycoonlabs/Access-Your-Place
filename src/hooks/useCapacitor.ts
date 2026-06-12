/**
 * React Hooks for Capacitor Native Features
 * 
 * Provides easy-to-use hooks for platform detection, network monitoring,
 * app lifecycle, and native feature access.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getPlatform,
  isNative,
  isIOS,
  isAndroid,
  isWeb,
  getNetworkStatus,
  onNetworkChange,
  onAppStateChange,
  hapticFeedback,
  hapticSelection,
  shareContent,
  copyToClipboard,
  openExternalUrl,
  showNativeToast,
  getDeviceInfo,
  type Platform,
} from '@/lib/capacitor';

// ============================================================================
// PLATFORM HOOK
// ============================================================================

export interface PlatformInfo {
  platform: Platform;
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWeb: boolean;
}

/**
 * Hook to get current platform information
 */
export const usePlatform = (): PlatformInfo => {
  const [platformInfo] = useState<PlatformInfo>(() => ({
    platform: getPlatform(),
    isNative: isNative(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isWeb: isWeb(),
  }));

  return platformInfo;
};

// ============================================================================
// NETWORK HOOK
// ============================================================================

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

/**
 * Hook to monitor network connectivity
 */
export const useNetwork = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    connected: navigator.onLine,
    connectionType: 'unknown',
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      // Get initial status
      const currentStatus = await getNetworkStatus();
      setStatus({
        connected: currentStatus.connected,
        connectionType: currentStatus.connectionType,
      });

      // Listen for changes
      const handle = await onNetworkChange((newStatus) => {
        setStatus({
          connected: newStatus.connected,
          connectionType: newStatus.connectionType,
        });
      });

      cleanup = () => handle?.remove?.();
    };

    init();

    return () => {
      cleanup?.();
    };
  }, []);

  return status;
};

// ============================================================================
// APP STATE HOOK
// ============================================================================

/**
 * Hook to monitor app foreground/background state
 */
export const useAppState = () => {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      const handle = await onAppStateChange((state) => {
        setIsActive(state.isActive);
      });
      cleanup = () => handle?.remove?.();
    };

    init();

    return () => {
      cleanup?.();
    };
  }, []);

  return { isActive };
};

// ============================================================================
// HAPTICS HOOK
// ============================================================================

/**
 * Hook for haptic feedback
 */
export const useHaptics = () => {
  const impact = useCallback(async (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    await hapticFeedback(type);
  }, []);

  const notification = useCallback(async (type: 'success' | 'warning' | 'error' = 'success') => {
    await hapticFeedback(type);
  }, []);

  const selection = useCallback(async () => {
    await hapticSelection();
  }, []);

  return { impact, notification, selection };
};

// ============================================================================
// SHARE HOOK
// ============================================================================

/**
 * Hook for native sharing
 */
export const useShare = () => {
  const share = useCallback(async (options: {
    title?: string;
    text?: string;
    url?: string;
  }) => {
    await shareContent({
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: 'Share via',
    });
  }, []);

  return { share };
};

// ============================================================================
// CLIPBOARD HOOK
// ============================================================================

/**
 * Hook for clipboard operations
 */
export const useClipboard = () => {
  const copy = useCallback(async (text: string) => {
    await copyToClipboard(text);
    if (isNative()) {
      await showNativeToast('Copied to clipboard', 'short');
    }
  }, []);

  return { copy };
};

// ============================================================================
// EXTERNAL LINK HOOK
// ============================================================================

/**
 * Hook for opening external URLs
 */
export const useExternalLink = () => {
  const open = useCallback(async (url: string) => {
    await openExternalUrl(url);
  }, []);

  return { open };
};

// ============================================================================
// DEVICE INFO HOOK
// ============================================================================

/**
 * Hook to get device information
 */
export const useDeviceInfo = () => {
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      const info = await getDeviceInfo();
      setDeviceInfo(info);
      setLoading(false);
    };
    fetchInfo();
  }, []);

  return { deviceInfo, loading };
};

// ============================================================================
// SAFE AREA HOOK
// ============================================================================

/**
 * Hook to get safe area insets for notched devices
 */
export const useSafeArea = () => {
  const [insets, setInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const updateInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(computedStyle.getPropertyValue('--sat') || '0', 10),
        bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0', 10),
        left: parseInt(computedStyle.getPropertyValue('--sal') || '0', 10),
        right: parseInt(computedStyle.getPropertyValue('--sar') || '0', 10),
      });
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);
    return () => window.removeEventListener('resize', updateInsets);
  }, []);

  return insets;
};

// ============================================================================
// KEYBOARD HOOK
// ============================================================================

/**
 * Hook to detect keyboard visibility (mobile)
 */
export const useKeyboard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!isNative()) return;

    const handleShow = () => {
      setIsOpen(true);
      const h = parseInt(
        document.body.style.getPropertyValue('--keyboard-height') || '0',
        10
      );
      setHeight(h);
    };

    const handleHide = () => {
      setIsOpen(false);
      setHeight(0);
    };

    // Listen for CSS class changes set by capacitor.ts keyboard handler
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          if (document.body.classList.contains('keyboard-open')) {
            handleShow();
          } else {
            handleHide();
          }
        }
      });
    });

    observer.observe(document.body, { attributes: true });

    return () => observer.disconnect();
  }, []);

  return { isOpen, height };
};

// ============================================================================
// APP RESUME HOOK
// ============================================================================

/**
 * Hook to run callback when app resumes from background
 */
export const useAppResume = (callback: () => void) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = () => callbackRef.current();
    document.addEventListener('app-resumed', handler);
    return () => document.removeEventListener('app-resumed', handler);
  }, []);
};
