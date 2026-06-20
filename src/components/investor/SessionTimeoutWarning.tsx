import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Clock, LogOut, RefreshCw, AlertTriangle, Loader2, X } from 'lucide-react';

interface SessionTimeoutWarningProps {
  // Session duration in milliseconds (default: 24 hours for normal, 30 days for remember me)
  sessionDuration?: number;
  // Time before expiration to show warning (default: 5 minutes)
  warningTime?: number;
  // Interval for silent background refresh when active (default: 15 minutes)
  silentRefreshInterval?: number;
  // Callback when session expires
  onSessionExpired?: () => void;
}

export default function SessionTimeoutWarning({
  sessionDuration,
  warningTime = 5 * 60 * 1000, // 5 minutes
  silentRefreshInterval = 15 * 60 * 1000, // 15 minutes
  onSessionExpired,
}: SessionTimeoutWarningProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [extending, setExtending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Track last user activity time
  const lastActivityRef = useRef<number>(Date.now());
  // Track when we last refreshed the session
  const lastRefreshRef = useRef<number>(Date.now());
  // Track if user has been active since last check
  const hasActivitySinceLastCheckRef = useRef<boolean>(true);
  
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silentRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoLogoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Get the effective session duration
  const getEffectiveSessionDuration = useCallback(() => {
    const rememberMe = localStorage.getItem('investorRememberMe') === 'true';
    return sessionDuration || (rememberMe 
      ? 30 * 24 * 60 * 60 * 1000  // 30 days
      : 24 * 60 * 60 * 1000);     // 24 hours
  }, [sessionDuration]);

  // Check if session exists
  const hasValidSession = useCallback(() => {
    const sessionToken = localStorage.getItem('investorSessionToken');
    const stored = localStorage.getItem('investorSession');
    return !!(sessionToken && stored);
  }, []);

  // Update activity timestamp - called on user interactions
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    hasActivitySinceLastCheckRef.current = true;
  }, []);

  // Silently refresh session with backend (no UI feedback)
  const silentRefreshSession = useCallback(async () => {
    const sessionToken = localStorage.getItem('investorSessionToken');
    if (!sessionToken) {
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('investor-session', {
        body: { action: 'refresh_session', session_token: sessionToken }
      });

      if (error || !data?.success) {
        console.log('Silent session refresh failed:', error || data?.error);
        return false;
      }

      // Update local session with new login time
      const stored = localStorage.getItem('investorSession');
      if (stored) {
        try {
          const session = JSON.parse(stored);
          session.loginTime = Date.now();
          localStorage.setItem('investorSession', JSON.stringify(session));
        } catch (e) {
          console.error('Error updating local session:', e);
        }
      }

      lastRefreshRef.current = Date.now();
      console.log('Session silently refreshed at', new Date().toLocaleTimeString());
      return true;
    } catch (err) {
      console.error('Silent session refresh exception:', err);
      return false;
    }
  }, []);

  // Clear all timers helper
  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (silentRefreshTimerRef.current) clearInterval(silentRefreshTimerRef.current);
    if (inactivityCheckTimerRef.current) clearInterval(inactivityCheckTimerRef.current);
    if (autoLogoutTimerRef.current) clearTimeout(autoLogoutTimerRef.current);
  }, []);

  // Handle logout
  const handleLogout = useCallback(async (isAutomatic = false) => {
    setLoggingOut(true);
    
    const sessionToken = localStorage.getItem('investorSessionToken');
    
    // Try to invalidate session on server
    if (sessionToken) {
      supabase.functions.invoke('investor-login', {
        body: { action: 'logout', session_token: sessionToken }
      }).catch(err => {
        console.error('Logout error:', err);
      });
    }
    
    // Clear local storage
    localStorage.removeItem('investorSession');
    localStorage.removeItem('investorSessionToken');
    localStorage.removeItem('investorRememberMe');
    
    // Clear all timers
    clearAllTimers();
    
    // Call callback if provided
    if (onSessionExpired) {
      onSessionExpired();
    }
    
    // Navigate to login with message
    const message = isAutomatic 
      ? 'Your session has expired due to inactivity. Please log in again.'
      : 'You have been logged out successfully.';
    
    navigate('/investor/login', { 
      state: { message, type: isAutomatic ? 'timeout' : 'logout' } 
    });
  }, [navigate, onSessionExpired, clearAllTimers]);

  // Start countdown timer for warning dialog
  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    
    countdownTimerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Start auto-logout timer
  const startAutoLogoutTimer = useCallback((duration: number) => {
    if (autoLogoutTimerRef.current) {
      clearTimeout(autoLogoutTimerRef.current);
    }
    
    autoLogoutTimerRef.current = setTimeout(() => {
      handleLogout(true);
    }, duration);
  }, [handleLogout]);

  // Show the warning dialog
  const showWarningDialog = useCallback(() => {
    if (showWarning) return; // Already showing
    
    const remaining = Math.ceil(warningTime / 1000);
    setTimeRemaining(remaining);
    setShowWarning(true);
    startCountdown();
    startAutoLogoutTimer(warningTime);
    
    console.log('Showing session warning - user inactive for too long');
  }, [showWarning, warningTime, startCountdown, startAutoLogoutTimer]);

  // Dismiss the warning dialog
  const handleDismiss = useCallback(() => {
    setShowWarning(false);
    
    // Clear auto-logout timer
    if (autoLogoutTimerRef.current) {
      clearTimeout(autoLogoutTimerRef.current);
      autoLogoutTimerRef.current = null;
    }
    
    // Clear countdown timer
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    
    // Update activity since user interacted
    updateActivity();
    
    // Silently refresh the session
    silentRefreshSession();
    
    toast({
      title: 'Session Extended',
      description: 'You can continue using the portal.',
    });
  }, [updateActivity, silentRefreshSession, toast]);

  // Handle extending the session (button click)
  const handleExtendSession = async () => {
    setExtending(true);
    
    const success = await silentRefreshSession();
    
    setShowWarning(false);
    
    // Clear auto-logout timer
    if (autoLogoutTimerRef.current) {
      clearTimeout(autoLogoutTimerRef.current);
      autoLogoutTimerRef.current = null;
    }
    
    // Clear countdown timer
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    
    // Update activity
    updateActivity();
    
    toast({
      title: 'Session Extended',
      description: success 
        ? 'Your session has been extended successfully.'
        : 'Your session has been extended.',
    });
    
    setExtending(false);
  };

  // Check for inactivity and potentially show warning
  const checkInactivity = useCallback(() => {
    if (!hasValidSession()) return;
    
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    const effectiveDuration = getEffectiveSessionDuration();
    const inactivityThreshold = effectiveDuration - warningTime;
    
    // If user has been inactive for longer than (session duration - warning time), show warning
    if (timeSinceLastActivity >= inactivityThreshold && !showWarning) {
      showWarningDialog();
    }
  }, [hasValidSession, getEffectiveSessionDuration, warningTime, showWarning, showWarningDialog]);

  // Silent background refresh - only if user has been active
  const performSilentRefresh = useCallback(async () => {
    if (!hasValidSession()) return;
    
    // Only refresh if user has been active since last check
    if (hasActivitySinceLastCheckRef.current) {
      await silentRefreshSession();
      hasActivitySinceLastCheckRef.current = false;
      console.log('Background refresh completed - user was active');
    } else {
      console.log('Skipping background refresh - no user activity');
    }
  }, [hasValidSession, silentRefreshSession]);

  // Set up activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'keypress'];
    
    // Throttle activity updates to prevent excessive calls
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledUpdate = () => {
      if (throttleTimeout) return;
      
      updateActivity();
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 1000); // Throttle to once per second
    };
    
    events.forEach((event) => {
      document.addEventListener(event, throttledUpdate, { passive: true });
    });
    
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledUpdate);
      });
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [updateActivity]);

  // Initialize timers
  useEffect(() => {
    // Only initialize if we have a valid session
    if (!hasValidSession()) {
      setIsInitialized(true);
      return;
    }

    setIsInitialized(true);
    
    // Set up silent background refresh every 15 minutes (only if active)
    silentRefreshTimerRef.current = setInterval(performSilentRefresh, silentRefreshInterval);
    
    // Check for inactivity every minute
    inactivityCheckTimerRef.current = setInterval(checkInactivity, 60 * 1000);
    
    // Initial activity timestamp
    lastActivityRef.current = Date.now();
    lastRefreshRef.current = Date.now();
    
    console.log('Session manager initialized - silent refresh every', silentRefreshInterval / 60000, 'minutes');
    
    return () => {
      clearAllTimers();
    };
  }, [hasValidSession, performSilentRefresh, silentRefreshInterval, checkInactivity, clearAllTimers]);

  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercentage = Math.max(0, (timeRemaining / (warningTime / 1000)) * 100);

  // Don't render anything if not initialized or no session
  if (!isInitialized || !hasValidSession()) {
    return null;
  }

  return (
    <Dialog open={showWarning} onOpenChange={(open) => {
      if (!open) {
        handleDismiss();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        {/* Close button in top right */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          aria-label="Close and continue session"
        >
          <X className="h-4 w-4" />
        </button>
        
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <DialogTitle className="text-xl text-center">Session Expiring Soon</DialogTitle>
          <DialogDescription className="text-center">
            You've been inactive for a while. Your session will expire soon.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Countdown Timer */}
          <div className="text-center mb-6">
            <div className="relative inline-flex items-center justify-center">
              {/* Progress Circle */}
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - progressPercentage / 100)}`}
                  className={`transition-all duration-1000 ${
                    timeRemaining <= 60 ? 'text-red-500' : 
                    timeRemaining <= 120 ? 'text-amber-500' : 'text-[#d4a574]'
                  }`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Clock className={`w-6 h-6 mb-1 ${
                  timeRemaining <= 60 ? 'text-red-500' : 
                  timeRemaining <= 120 ? 'text-amber-500' : 'text-gray-600'
                }`} />
                <span className={`text-3xl font-bold ${
                  timeRemaining <= 60 ? 'text-red-600' : 
                  timeRemaining <= 120 ? 'text-amber-600' : 'text-gray-900'
                }`}>
                  {formatTime(timeRemaining)}
                </span>
                <span className="text-xs text-gray-500">remaining</span>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          {timeRemaining <= 60 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 text-center flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                You will be logged out in less than a minute!
              </p>
            </div>
          )}

          {/* Info Text */}
          <p className="text-sm text-gray-500 text-center">
            Click "Stay Logged In" or interact with the page to extend your session.
          </p>
        </div>

        <DialogFooter className="flex gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => handleLogout(false)}
            disabled={extending || loggingOut}
            className="flex-1"
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 mr-2" />
            )}
            Log Out
          </Button>
          <Button
            onClick={handleExtendSession}
            disabled={extending || loggingOut}
            className="flex-1 bg-[#d4a574] hover:bg-[#c49464]"
          >
            {extending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
