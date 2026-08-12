import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type CallerType = 'staff' | 'funded_investor' | 'investor' | 'public';

interface CallerInfo {
  callerType: CallerType;
  investorId: string | null;
  isFunded: boolean;
  isLoggedIn: boolean;
  loading: boolean;
}

/**
 * Determines the caller_type for get-properties API calls.
 * Checks investor session from localStorage and fetches funding status.
 * 
 * Returns:
 * - 'funded_investor' if logged in and account is funded (sees addresses)
 * - 'investor' if logged in but not funded (sees ZIP only)
 * - 'public' if not logged in (sees ZIP only)
 */
export function useCallerType(): CallerInfo {
  const [callerType, setCallerType] = useState<CallerType>('public');
  const [investorId, setInvestorId] = useState<string | null>(null);
  const [isFunded, setIsFunded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    determineCallerType();
  }, []);

  const determineCallerType = async () => {
    try {
      // Check for investor session
      const stored = localStorage.getItem('investorSession');
      if (!stored) {
        setCallerType('public');
        setLoading(false);
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(stored);
      } catch {
        setCallerType('public');
        setLoading(false);
        return;
      }

      // Validate session age
      const sessionAge = Date.now() - (parsed.loginTime || 0);
      const rememberMe = localStorage.getItem('investorRememberMe') === 'true';
      const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

      if (sessionAge > maxAge || !parsed.id) {
        setCallerType('public');
        setLoading(false);
        return;
      }

      // Investor is logged in
      setInvestorId(parsed.id);
      setIsLoggedIn(true);

      // Check if the session already has funding info cached
      if (parsed.is_funded === true) {
        setIsFunded(true);
        setCallerType('funded_investor');
        setLoading(false);
        return;
      }

      // process-account-funding was TOMBSTONED on 6 August 2026 for creating card payment
      // intents against a third-party gateway the owner does not control. It returns 410
      // and must stay dead. This hook runs on every screen that uses it, so the dead call
      // produced a CORS failure on essentially every operator page load.
      //
      // Falling through is the SAFE direction: an unconfirmed caller is treated as not
      // funded, so property addresses stay hidden rather than being revealed by a check
      // that failed. Card funding is retired; the rails are Zelle, wire, Cash App, Bitcoin.
      try {
        const { data, error } = { data: null as any, error: null as any };

        if (!error && data?.funding_status?.is_funded) {
          setIsFunded(true);
          setCallerType('funded_investor');
          
          // Cache funding status in session for future use
          try {
            const updatedSession = { ...parsed, is_funded: true };
            localStorage.setItem('investorSession', JSON.stringify(updatedSession));
          } catch { /* ignore cache failure */ }
        } else {
          setCallerType('investor');
        }
      } catch {
        // If funding check fails, default to unfunded investor
        setCallerType('investor');
      }
    } catch {
      setCallerType('public');
    } finally {
      setLoading(false);
    }
  };

  return { callerType, investorId, isFunded, isLoggedIn, loading };
}

/**
 * Synchronous version that reads from localStorage only (no async funding check).
 * Use this for components that need immediate caller type without waiting.
 * Falls back to 'investor' for logged-in users (conservative - hides addresses).
 */
export function getCallerTypeSync(): { callerType: CallerType; investorId: string | null } {
  try {
    const stored = localStorage.getItem('investorSession');
    if (!stored) return { callerType: 'public', investorId: null };

    const parsed = JSON.parse(stored);
    const sessionAge = Date.now() - (parsed.loginTime || 0);
    const rememberMe = localStorage.getItem('investorRememberMe') === 'true';
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    if (sessionAge > maxAge || !parsed.id) return { callerType: 'public', investorId: null };

    // Check cached funding status
    if (parsed.is_funded === true) {
      return { callerType: 'funded_investor', investorId: parsed.id };
    }

    return { callerType: 'investor', investorId: parsed.id };
  } catch {
    return { callerType: 'public', investorId: null };
  }
}
