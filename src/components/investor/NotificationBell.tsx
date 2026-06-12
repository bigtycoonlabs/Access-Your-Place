import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, FileText, Home, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isRealtimeUnavailable } from '@/hooks/useDealFlowRealtime';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  investorId: string;
}

const POLL_INTERVAL_MS = 25_000; // 25 seconds

export function NotificationBell({ investorId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('manage-notifications', {
        body: { action: 'get', investorId }
      });
      if (mountedRef.current && data?.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.warn('[NotificationBell] Fetch error:', err);
    }
  }, [investorId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();

    // Polling — always active, replaces Realtime subscription
    const pollHandle = setInterval(() => {
      if (mountedRef.current) fetchNotifications();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(pollHandle);
    };
  }, [fetchNotifications]);



  const markAsRead = async (id: string, title: string) => {
    await supabase.functions.invoke('manage-notifications', {
      body: { action: 'markRead', notificationId: id }
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    setAnnouncement(`Marked "${title}" as read`);
  };

  const markAllRead = async () => {
    await supabase.functions.invoke('manage-notifications', {
      body: { action: 'markAllRead', investorId }
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    setAnnouncement('All notifications marked as read');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'inquiry_status': return <FileText className="w-4 h-4 text-blue-500" aria-hidden="true" />;
      case 'new_deal': return <Home className="w-4 h-4 text-green-500" aria-hidden="true" />;
      case 'acquisition_update': return <TrendingUp className="w-4 h-4 text-purple-500" aria-hidden="true" />;
      default: return <Bell className="w-4 h-4 text-gray-500" aria-hidden="true" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'inquiry_status': return 'Inquiry update';
      case 'new_deal': return 'New deal';
      case 'acquisition_update': return 'Acquisition update';
      default: return 'Notification';
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000 / 60;
    if (diff < 60) return `${Math.floor(diff)} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return d.toLocaleDateString();
  };

  const getAriaLabel = () => {
    if (unreadCount === 0) {
      return 'Notifications - no unread notifications';
    } else if (unreadCount === 1) {
      return 'Notifications - 1 unread notification';
    } else if (unreadCount > 9) {
      return 'Notifications - more than 9 unread notifications';
    }
    return `Notifications - ${unreadCount} unread notifications`;
  };

  // Handle keyboard navigation within notification list
  const handleKeyDown = (e: React.KeyboardEvent, index: number, notification: Notification) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!notification.read) {
        markAsRead(notification.id, notification.title);
      }
    }
  };

  return (
    <>
      {/* Live region for announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {announcement}
      </div>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="relative text-white hover:bg-white/10 p-2 focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#1a365d]"
            aria-label={getAriaLabel()}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs"
                aria-hidden="true"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-80 p-0"
          role="dialog"
          aria-label="Notifications panel"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <span className="font-semibold" id="notifications-title">Notifications</span>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllRead} 
                className="text-xs text-[#d4a574] focus:ring-2 focus:ring-[#d4a574]"
                aria-label={`Mark all ${unreadCount} notifications as read`}
              >
                <Check className="w-3 h-3 mr-1" aria-hidden="true" /> Mark all read
              </Button>
            )}
          </div>
          <ScrollArea className="h-80" ref={listRef}>
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500" role="status">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <ul 
                role="list" 
                aria-label="Notification list"
                className="divide-y"
              >
                {notifications.map((n, index) => (
                  <li key={n.id}>
                    <button
                      className={`w-full text-left p-3 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#d4a574] ${!n.read ? 'bg-blue-50/50' : ''}`}
                      onClick={() => !n.read && markAsRead(n.id, n.title)}
                      onKeyDown={(e) => handleKeyDown(e, index, n)}
                      aria-label={`${n.read ? '' : 'Unread: '}${getTypeLabel(n.type)} - ${n.title}. ${n.message}. ${formatTime(n.created_at)}${!n.read ? '. Press Enter to mark as read.' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1" aria-hidden="true">{getIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.read ? 'font-semibold' : ''}`}>{n.title}</p>
                          <p className="text-xs text-gray-600 truncate">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            <time dateTime={n.created_at}>{formatTime(n.created_at)}</time>
                          </p>
                        </div>
                        {!n.read && (
                          <div 
                            className="w-2 h-2 rounded-full bg-blue-500 mt-2" 
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
