/**
 * NativeShell Component
 * 
 * Wraps the entire app to provide:
 * - Safe area padding for notched devices (iPhone, Android)
 * - Network connectivity indicator
 * - Platform-specific UI adjustments
 * - Keyboard avoidance
 */

import React, { useEffect, useState } from 'react';
import { usePlatform, useNetwork, useKeyboard } from '@/hooks/useCapacitor';
import { WifiOff } from 'lucide-react';

interface NativeShellProps {
  children: React.ReactNode;
}

const NativeShell: React.FC<NativeShellProps> = ({ children }) => {
  const { isNative: isNativeApp, isIOS, isAndroid } = usePlatform();
  const { connected } = useNetwork();
  const { isOpen: keyboardOpen } = useKeyboard();
  const [showOffline, setShowOffline] = useState(false);

  // Show offline banner with a delay to avoid flicker
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!connected) {
      timer = setTimeout(() => setShowOffline(true), 1000);
    } else {
      setShowOffline(false);
    }
    return () => clearTimeout(timer);
  }, [connected]);

  // Add platform classes to body
  useEffect(() => {
    const body = document.body;
    
    if (isNativeApp) {
      body.classList.add('capacitor-native');
    }
    if (isIOS) {
      body.classList.add('capacitor-ios');
    }
    if (isAndroid) {
      body.classList.add('capacitor-android');
    }
    
    return () => {
      body.classList.remove('capacitor-native', 'capacitor-ios', 'capacitor-android');
    };
  }, [isNativeApp, isIOS, isAndroid]);

  return (
    <div
      className={`native-shell min-h-screen ${isNativeApp ? 'native-app' : 'web-app'} ${keyboardOpen ? 'keyboard-visible' : ''}`}
      style={{
        // Apply safe area padding for native apps
        paddingTop: isNativeApp ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: isNativeApp ? 'env(safe-area-inset-bottom)' : undefined,
        paddingLeft: isNativeApp ? 'env(safe-area-inset-left)' : undefined,
        paddingRight: isNativeApp ? 'env(safe-area-inset-right)' : undefined,
      }}
    >
      {/* Offline Banner */}
      {showOffline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white text-center py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium"
          style={{
            paddingTop: isNativeApp ? 'calc(env(safe-area-inset-top) + 8px)' : '8px',
          }}
        >
          <WifiOff className="w-4 h-4" />
          <span>No internet connection. Some features may be unavailable.</span>
        </div>
      )}

      {/* Main Content */}
      {children}
    </div>
  );
};

export default NativeShell;
