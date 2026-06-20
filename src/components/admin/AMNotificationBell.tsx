import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Check, CheckCheck, Clock, Building, ShieldCheck, ShieldX, Globe, FileCheck, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';

interface DealStatusNotification {
  id: string;
  property_id: string;
  property_title: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  recipient_staff_id: string;
  reviewer_staff_name: string | null;
  old_status: string | null;
  new_status: string;
  notification_type: string;
  message: string | null;
  is_read: boolean;
  email_sent: boolean;
  created_at: string;
}

interface AMNotificationBellProps {
  staffId: string;
  staffName?: string;
}

const NOTIFICATION_TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bgColor: string; label: string }> = {
  deal_submitted: { icon: FileCheck, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200', label: 'Submitted' },
  deal_under_review: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', label: 'Under Review' },
  deal_approved: { icon: ShieldCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', label: 'Approved' },
  deal_rejected: { icon: ShieldX, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', label: 'Not Approved' },
  deal_published: { icon: Globe, color: 'text-violet-600', bgColor: 'bg-violet-50 border-violet-200', label: 'Published' },
  deal_verified: { icon: ShieldCheck, color: 'text-sky-600', bgColor: 'bg-sky-50 border-sky-200', label: 'Verified' },
  deal_archived: { icon: Building, color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', label: 'Archived' },
  deal_status_change: { icon: Building, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', label: 'Status Change' },
  deal_needs_changes: { icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', label: 'Needs Changes' },
  deal_unpublished: { icon: Globe, color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', label: 'Unpublished' },
};

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AMNotificationBell({ staffId, staffName }: AMNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<DealStatusNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('deal-flow-notifications', {
        body: { action: 'get_am_unread_count', staff_id: staffId }
      });
      if (!error && data?.unread_count !== undefined) {
        setUnreadCount(data.unread_count);
      }
    } catch (e) {
      console.warn('[AMNotificationBell] Failed to fetch unread count:', e);
    }
  }, [staffId]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('deal-flow-notifications', {
        body: { action: 'get_am_notifications', staff_id: staffId, limit: 20 }
      });
      if (!error && data?.notifications) {
        setNotifications(data.notifications);
        if (data.unread_count !== undefined) {
          setUnreadCount(data.unread_count);
        }
      }
    } catch (e) {
      console.warn('[AMNotificationBell] Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    setMarkingRead(notificationId);
    try {
      await supabase.functions.invoke('deal-flow-notifications', {
        body: { action: 'mark_am_notification_read', staff_id: staffId, notification_id: notificationId }
      });
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.warn('[AMNotificationBell] Failed to mark as read:', e);
    } finally {
      setMarkingRead(null);
    }
  }, [staffId]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      await supabase.functions.invoke('deal-flow-notifications', {
        body: { action: 'mark_am_notification_read', staff_id: staffId, mark_all: true }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn('[AMNotificationBell] Failed to mark all as read:', e);
    } finally {
      setMarkingAllRead(false);
    }
  }, [staffId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchUnreadCount();

    // Poll every 30 seconds
    pollIntervalRef.current = setInterval(fetchUnreadCount, 30000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchUnreadCount]);

  // Fetch full notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        bellRef.current && !bellRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);


  // ── No Realtime subscription ──────────────────────────────────────
  // Supabase Realtime postgres_changes require the target tables to be
  // added to the `supabase_realtime` publication.  In this environment
  // the publication is not configured, so channel subscriptions always
  // time out — producing "Channel timed out" error-log entries.
  //
  // Instead we rely on the 30-second polling interval above which keeps
  // the unread count and notification list reasonably fresh without
  // generating any errors.  If Realtime is ever configured, a channel
  // subscription on `deal_status_notifications` filtered by
  // `recipient_staff_id=eq.${staffId}` can be added here.


  return (
    <div className="relative">
      {/* Bell Button */}
      <Button
        ref={bellRef}
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        aria-label={`Deal notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
          role="dialog"
          aria-label="Deal status notifications"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#1a365d] to-[#2d5a87] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#d4a574]" />
              <h3 className="text-sm font-semibold text-white">Deal Notifications</h3>
              {unreadCount > 0 && (
                <Badge className="bg-red-500/90 text-white text-[10px] px-1.5 py-0 h-5">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={markingAllRead}
                  className="text-white/80 hover:text-white hover:bg-white/10 text-xs h-7 px-2"
                  aria-label="Mark all notifications as read"
                >
                  {markingAllRead ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <CheckCheck className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">Mark all read</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white hover:bg-white/10 h-7 w-7"
                aria-label="Close notifications"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Notification List */}
          <ScrollArea className="max-h-[400px]">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  You'll be notified when your deals are reviewed
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notif) => {
                  const config = NOTIFICATION_TYPE_CONFIG[notif.notification_type] || NOTIFICATION_TYPE_CONFIG.deal_status_change;
                  const IconComponent = config.icon;
                  const isUnread = !notif.is_read;
                  const isMarking = markingRead === notif.id;

                  return (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 transition-colors ${
                        isUnread 
                          ? 'bg-blue-50/50 hover:bg-blue-50' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${config.bgColor}`}>
                          <IconComponent className={`w-4 h-4 ${config.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Title + Status Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`text-sm leading-tight ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {notif.property_title || 'Deal Update'}
                              </p>
                              {notif.property_city && notif.property_state && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {notif.property_city}, {notif.property_state}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-5 flex-shrink-0 border ${config.bgColor} ${config.color}`}
                            >
                              {config.label}
                            </Badge>
                          </div>

                          {/* Message */}
                          {notif.message && (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                              {notif.message}
                            </p>
                          )}

                          {/* Footer: reviewer + time + mark read */}
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                              {notif.reviewer_staff_name && (
                                <span>by {notif.reviewer_staff_name}</span>
                              )}
                              <span>{getTimeAgo(notif.created_at)}</span>
                              {notif.email_sent && (
                                <span className="text-emerald-500" title="Email notification sent">
                                  <Check className="w-3 h-3 inline" /> Email
                                </span>
                              )}
                            </div>
                            {isUnread && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notif.id);
                                }}
                                disabled={isMarking}
                                className="text-[11px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5 transition-colors"
                                aria-label={`Mark "${notif.property_title}" notification as read`}
                              >
                                {isMarking ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="w-3 h-3" />
                                    Read
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Unread dot */}
                        {isUnread && (
                          <div className="flex-shrink-0 mt-1.5">
                            <div className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-[11px] text-gray-400">
                Showing {notifications.length} most recent notification{notifications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
