import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { 
  Bell, 
  Check, 
  UserPlus, 
  MessageSquare, 
  Loader2, 
  ClipboardList,
  Mail,
  RefreshCw,
  CheckCheck,
  Trash2,
  Filter
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  investor_id?: string;
  investor_name?: string;
  investor_email?: string;
  read: boolean;
  created_at: string;
}

interface Props { onClose: () => void; }

export function StaffNotifications({ onClose }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('deal-flow-notifications', { body: { action: 'get_notifications' } });
    if (data?.notifications) setNotifications(data.notifications);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.functions.invoke('manage-investor-admin', { body: { action: 'mark_notification_read', notification_id: id } });
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    for (const n of notifications.filter(n => !n.read)) {
      await supabase.functions.invoke('manage-investor-admin', { body: { action: 'mark_notification_read', notification_id: n.id } });
    }
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_investor': return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'new_inquiry': return <ClipboardList className="w-5 h-5 text-blue-500" />;
      case 'investor_message': return <Mail className="w-5 h-5 text-purple-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'new_investor': return 'New Signup';
      case 'new_inquiry': return 'Inquiry';
      case 'investor_message': return 'Message';
      default: return 'Notification';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'new_investor': return 'bg-green-100 text-green-800';
      case 'new_inquiry': return 'bg-blue-100 text-blue-800';
      case 'investor_message': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read) 
    : notifications;

  const groupedByDate = filteredNotifications.reduce((acc, n) => {
    const date = new Date(n.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(n);
    return acc;
  }, {} as Record<string, Notification[]>);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-[#1a365d] to-[#2d4a7c]">
          <div className="flex justify-between items-center">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Bell className="w-5 h-5 text-[#d4a574]" />
              Staff Notifications
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white ml-2">{unreadCount} new</Badge>
              )}
            </DialogTitle>
            <div className="flex gap-2">
              {/* Icon-only with no label: VoiceOver announced it as just "button". */}
              <Button size="sm" variant="ghost" aria-label="Refresh notifications" className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px]" onClick={fetchNotifications}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'bg-[#d4a574]' : ''}
            >
              All ({notifications.length})
            </Button>
            <Button 
              size="sm" 
              variant={filter === 'unread' ? 'default' : 'outline'}
              onClick={() => setFilter('unread')}
              className={filter === 'unread' ? 'bg-[#d4a574]' : ''}
            >
              Unread ({unreadCount})
            </Button>
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4 mr-1" />Mark All Read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="px-6 py-4">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No notifications</p>
                  <p className="text-sm">{filter === 'unread' ? 'All caught up!' : 'Notifications will appear here'}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedByDate).map(([date, notifs]) => (
                    <div key={date}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{date}</p>
                      <div className="space-y-2">
                        {notifs.map(n => (
                          <div 
                            key={n.id} 
                            className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                              n.read 
                                ? 'bg-white border-gray-200' 
                                : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-sm'
                            }`}
                            onClick={() => !n.read && markRead(n.id)}
                          >
                            <div className="flex gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  n.read ? 'bg-gray-100' : 'bg-white shadow-sm'
                                }`}>
                                  {getIcon(n.type)}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className={`font-semibold ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>
                                        {n.title}
                                      </p>
                                      {!n.read && (
                                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                                      )}
                                    </div>
                                    <Badge className={`text-xs ${getTypeBadgeColor(n.type)}`}>
                                      {getTypeLabel(n.type)}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-gray-400 whitespace-nowrap">
                                    {formatTime(n.created_at)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{n.message}</p>
                                {n.investor_email && (
                                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {n.investor_email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
