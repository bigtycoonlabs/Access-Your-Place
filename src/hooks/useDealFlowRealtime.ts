import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface DealFlowNotification {
  id: string;
  type: string;
  property_id: string;
  property_title: string;
  property_address: string;
  property_city: string;
  property_state: string;
  submitted_by_staff_id: string;
  submitted_by_staff_name: string;
  approved_by_staff_name: string;
  recipient_type: string;
  recipient_staff_id: string;
  recipient_email: string;
  message: string;
  read: boolean;
  email_sent: boolean;
  created_at: string;
}

interface UseDealFlowRealtimeOptions {
  staffId?: string;
  staffName?: string;
  isSuccessManager?: boolean;
  isAcquisitionManager?: boolean;
  enabled?: boolean;
}

interface UseDealFlowRealtimeReturn {
  unverifiedCount: number;
  newDealCount: number;
  notifications: DealFlowNotification[];
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

/**
 * Polling interval in milliseconds.
 *
 * Supabase Realtime postgres_changes require the target tables to be added
 * to the `supabase_realtime` publication.  In this environment the
 * publication is empty and cannot be modified via the SQL guard, so every
 * channel subscription times out — producing error-log entries.
 *
 * We use polling exclusively.  15 s keeps the UI reasonably fresh
 * without hammering the API.
 */
const POLL_INTERVAL_MS = 15_000;

/**
 * Realtime is permanently disabled in this environment.  Exported so other
 * components can check (all currently return `true`).
 */
export function isRealtimeUnavailable(): boolean {
  return true;
}

export function useDealFlowRealtime({
  staffId,
  staffName,
  isSuccessManager = false,
  isAcquisitionManager = false,
  enabled = true,
}: UseDealFlowRealtimeOptions): UseDealFlowRealtimeReturn {
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const [newDealCount, setNewDealCount] = useState(0);
  const [notifications, setNotifications] = useState<DealFlowNotification[]>([]);
  const { toast } = useToast();
  const mountedRef = useRef(true);

  // Track previous counts so we can detect new deals for toast notifications
  const prevUnverifiedRef = useRef<number | null>(null);
  const prevNewDealRef = useRef<number | null>(null);

  // ── Data fetchers ──────────────────────────────────────────────────

  const fetchUnverifiedCount = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('properties')
        .select('id')
        .or('is_verified.is.null,is_verified.eq.false')
        .not('status', 'in', '("deleted","archived")');

      if (mountedRef.current) {
        const count = data?.length || 0;

        // Detect new unverified properties since last poll
        if (prevUnverifiedRef.current !== null && count > prevUnverifiedRef.current && isSuccessManager) {
          toast({
            title: 'New Deal Submitted',
            description: `${count - prevUnverifiedRef.current} new deal(s) need verification`,
            duration: 8000,
          });
        }
        prevUnverifiedRef.current = count;
        setUnverifiedCount(count);
      }
    } catch (err) {
      console.warn('[useDealFlowRealtime] Error fetching unverified count:', err);
    }
  }, [isSuccessManager, toast]);

  const fetchNotificationCount = useCallback(async () => {
    if (!staffId) return;
    try {
      const { data, error } = await supabase.functions.invoke('deal-flow-notifications', {
        body: {
          action: 'get_notifications',
          staff_id: staffId,
          unread_only: true,
          limit: 50,
        },
      });

      if (error) {
        console.warn('[useDealFlowRealtime] Notification fetch error:', error);
        return;
      }

      if (mountedRef.current && data?.notifications) {
        setNotifications(data.notifications);
        const newDeals = data.notifications.filter(
          (n: DealFlowNotification) => n.type === 'new_deal_submitted' && !n.read,
        );
        const newCount = newDeals.length;

        if (
          isAcquisitionManager &&
          prevNewDealRef.current !== null &&
          newCount < prevNewDealRef.current
        ) {
          // Approved — handled by explicit action toasts elsewhere
        }

        prevNewDealRef.current = newCount;
        setNewDealCount(newCount);
      }
    } catch (err) {
      console.warn('[useDealFlowRealtime] Error fetching notifications:', err);
    }
  }, [staffId, isAcquisitionManager]);

  const refreshCounts = useCallback(async () => {
    await Promise.allSettled([fetchUnverifiedCount(), fetchNotificationCount()]);
  }, [fetchUnverifiedCount, fetchNotificationCount]);

  // ── Mark as read ───────────────────────────────────────────────────

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await supabase.functions.invoke('deal-flow-notifications', {
        body: { action: 'mark_read', notification_id: notificationId },
      });

      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
        );
        setNewDealCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.warn('[useDealFlowRealtime] Error marking as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!staffId) return;
    try {
      const recipientType = isSuccessManager ? 'success_team' : undefined;
      await supabase.functions.invoke('deal-flow-notifications', {
        body: {
          action: 'mark_read',
          mark_all: true,
          staff_id: staffId,
          recipient_type: recipientType,
        },
      });

      if (mountedRef.current) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setNewDealCount(0);
      }
    } catch (err) {
      console.warn('[useDealFlowRealtime] Error marking all as read:', err);
    }
  }, [staffId, isSuccessManager]);

  // ── Polling-only (Realtime disabled in this env) ───────────────────
  //
  // We intentionally do NOT attempt supabase.channel() subscriptions.
  // The `supabase_realtime` publication is not configured for the
  // `properties` / `deal_flow_notifications` tables in this environment,
  // so every subscription produces a "Channel timed out" error that
  // floods the error_logs table (previously 200+ entries per session).
  //
  // Polling at 15-second intervals provides adequate freshness for the
  // staff dashboard counters and notification list.

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) return;

    // ── Initial data fetch ──
    fetchUnverifiedCount();
    fetchNotificationCount();

    // ── Polling ──
    const pollHandle = setInterval(() => {
      if (mountedRef.current) {
        fetchUnverifiedCount();
        fetchNotificationCount();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(pollHandle);
    };
  }, [enabled, staffId, isSuccessManager, isAcquisitionManager, fetchUnverifiedCount, fetchNotificationCount]);

  return {
    unverifiedCount,
    newDealCount,
    notifications,
    markAsRead,
    markAllAsRead,
    refreshCounts,
  };
}


// Helper to send deal flow notification (used by components)
export async function sendDealFlowNotification(params: {
  action: 'new_deal_submitted' | 'deal_approved' | 'deal_published';
  property_id: string;
  property_title?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  submitted_by_staff_id?: string;
  submitted_by_staff_name?: string;
  submitted_by_staff_email?: string;
  approved_by_staff_name?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthly_rent?: number;
  operation_type?: string;
}) {
  try {
    const { data, error } = await supabase.functions.invoke('deal-flow-notifications', {
      body: params,
    });

    if (error) {
      console.warn('[sendDealFlowNotification] Error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.warn('[sendDealFlowNotification] Exception:', err);
    return { success: false, error: err };
  }
}
