import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';

interface MessageNotificationBadgeProps {
  investorId: string;
  onClick?: () => void;
}

export function MessageNotificationBadge({ investorId, onClick }: MessageNotificationBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new messages every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [investorId]);

  const fetchUnreadCount = async () => {
    try {
      const { data } = await supabase.functions.invoke('investor-messaging', {
        body: { action: 'get_unread_count', investor_id: investorId }
      });
      if (data?.count !== undefined) {
        setUnreadCount(data.count);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const getAriaLabel = () => {
    if (unreadCount === 0) {
      return 'Messages - no unread messages';
    } else if (unreadCount === 1) {
      return 'Messages - 1 unread message';
    } else if (unreadCount > 9) {
      return 'Messages - more than 9 unread messages';
    }
    return `Messages - ${unreadCount} unread messages`;
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Open messages"
      className="relative text-white hover:bg-white/10 focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#1a365d]"
      onClick={onClick}
      aria-label={getAriaLabel()}
      aria-haspopup="dialog"
    >
      <MessageSquare className="w-5 h-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <Badge 
          className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center bg-red-500 text-white text-xs px-1"
          aria-hidden="true"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
      {/* Screen reader only live region for count updates */}
      <span className="sr-only" role="status" aria-live="polite">
        {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}` : ''}
      </span>
    </Button>
  );
}
