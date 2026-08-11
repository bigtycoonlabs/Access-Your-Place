import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { PushNotificationManager } from './PushNotificationManager';
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Clock,
  DollarSign,
  FileText,
  Home,
  Loader2,
  Mail,
  Settings,
  User,
  AlertCircle,
  Smartphone,
  Phone,
  MessageSquare
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  notification_type: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

interface NotificationPreferences {
  id?: string;
  // Email preferences
  email_first_refusal: boolean;
  email_deal_available: boolean;
  email_payment_success: boolean;
  email_manager_assigned: boolean;
  email_new_deals: boolean;
  email_market_reports: boolean;
  email_platform_updates: boolean;
  in_app_enabled: boolean;
  // SMS preferences
  sms_enabled: boolean;
  sms_phone_number: string;
  sms_first_refusal: boolean;
  sms_documents: boolean;
  sms_payments: boolean;
  sms_deal_alerts: boolean;
  sms_account_updates: boolean;
  // Push preferences
  push_enabled: boolean;
  push_first_refusal: boolean;
  push_documents: boolean;
  push_payments: boolean;
  push_deal_alerts: boolean;
  push_account_updates: boolean;
}

const defaultPreferences: NotificationPreferences = {
  email_first_refusal: true,
  email_deal_available: true,
  email_payment_success: true,
  email_manager_assigned: true,
  email_new_deals: true,
  email_market_reports: true,
  email_platform_updates: false,
  in_app_enabled: true,
  // SMS defaults
  sms_enabled: false,
  sms_phone_number: '',
  sms_first_refusal: true,
  sms_documents: true,
  sms_payments: true,
  sms_deal_alerts: true,
  sms_account_updates: true,
  // Push defaults
  push_enabled: false,
  push_first_refusal: true,
  push_documents: true,
  push_payments: true,
  push_deal_alerts: true,
  push_account_updates: true
};

const notificationTypeIcons: Record<string, any> = {
  deals: Home,
  payments: DollarSign,
  account: User,
  documents: FileText,
  general: Bell
};

const notificationTypeColors: Record<string, string> = {
  deals: 'bg-green-100 text-green-800',
  payments: 'bg-blue-100 text-blue-800',
  account: 'bg-purple-100 text-purple-800',
  documents: 'bg-orange-100 text-orange-800',
  general: 'bg-gray-100 text-gray-800'
};




// The table grant is closed: notifications carry a client's property address and their
// private Penny score, and a browser filter is not a permission. Everything now goes
// through investor-notifications, which scopes to the session on the server.
function getInvestorSessionToken(): string | null {
  try {
    const direct = window.localStorage.getItem('investorSessionToken');
    if (direct) return direct;
    const raw = window.localStorage.getItem('investorSession');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.session_token || parsed?.token || null;
  } catch {
    return null;
  }
}

export function NotificationCenter({ investorId }: { investorId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [phoneError, setPhoneError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (investorId) {
      fetchNotifications();
      fetchPreferences();
    }
  }, [investorId]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('investor-notifications', {
        body: { action: 'list', session_token: getInvestorSessionToken() },
      });
      if (error) throw error;
      if (!data?.success) {
        // A failed read is not an empty inbox, so do not render one.
        console.error('Notifications unavailable:', data?.message);
        setLoadError(data?.message || 'We could not load your notifications just now.');
        setLoading(false);
        return;
      }
      setLoadError(null);
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setLoadError('We could not load your notifications just now. This is not the same as you having none.');
    }
    setLoading(false);
  };

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('investor-notifications', {
        body: { action: 'get_preferences', session_token: getInvestorSessionToken() },
      });
      if (error) throw error;
      if (data?.success && data.preferences) {
        setPreferences({ ...defaultPreferences, ...data.preferences });
      }
      // No row yet is legitimate: a new account has no saved preferences and the
      // defaults are correct. A FAILED read is different and is logged rather than
      // silently treated as "no preferences".
      if (data && !data.success) {
        console.error('Notification preferences unavailable:', data.message);
      }
    } catch (err) {
      console.error('Error loading notification preferences:', err);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.functions.invoke('investor-notifications', {
        body: { action: 'mark_read', session_token: getInvestorSessionToken(), notification_id: notificationId },
      });
      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      
      if (unreadIds.length === 0) return;

      const { error } = await supabase.functions.invoke('investor-notifications', {
        body: { action: 'mark_all_read', session_token: getInvestorSessionToken() },
      });
      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({
          ...n,
          is_read: true,
          read_at: n.read_at || new Date().toISOString()
        }))
      );

      toast({ title: 'All notifications marked as read' });
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast({ title: 'Error updating notifications', variant: 'destructive' });
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const validatePhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 0) return true; // Empty is valid (SMS disabled)
    if (digits.length !== 10) return false;
    return true;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPreferences({ ...preferences, sms_phone_number: formatted });
    
    if (preferences.sms_enabled && !validatePhoneNumber(formatted)) {
      setPhoneError('Please enter a valid 10-digit phone number');
    } else {
      setPhoneError('');
    }
  };

  const savePreferences = async () => {
    // Validate phone if SMS is enabled
    if (preferences.sms_enabled) {
      if (!preferences.sms_phone_number || !validatePhoneNumber(preferences.sms_phone_number)) {
        setPhoneError('Please enter a valid 10-digit phone number to enable SMS');
        return;
      }
    }

    setSavingPrefs(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-notifications', {
        body: { action: 'save_preferences', session_token: getInvestorSessionToken(), preferences },
      });
      if (error) throw error;
      // Do not say "saved" unless it saved.
      if (!data?.success) {
        toast({
          title: 'Settings not saved',
          description: data?.message || 'Please try again.',
          variant: 'destructive',
        });
        setSavingPrefs(false);
        return;
      }

      toast({ 
        title: 'Preferences saved!',
        description: preferences.sms_enabled 
          ? 'You will now receive SMS notifications for time-sensitive alerts.'
          : undefined
      });
      setSettingsOpen(false);
    } catch (err) {
      console.error('Error saving preferences:', err);
      toast({ title: 'Error saving preferences', variant: 'destructive' });
    }
    setSavingPrefs(false);
  };

  const getFilteredNotifications = () => {
    if (activeTab === 'all') return notifications;
    if (activeTab === 'unread') return notifications.filter(n => !n.is_read);
    return notifications.filter(n => n.notification_type === activeTab);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filteredNotifications = getFilteredNotifications();

  const formatDate = (dateStr: string) => {
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

  const getNotificationIcon = (type: string) => {
    const Icon = notificationTypeIcons[type] || Bell;
    return <Icon className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1e3a5f] rounded-lg">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Notification Center</CardTitle>
                <CardDescription>
                  {unreadCount > 0
                    ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                    : 'All caught up!'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Mark All Read
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Preferences
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>


      {/* Push Notification Banner */}
      <PushNotificationManager investorId={investorId} />

      {/* SMS Opt-in Banner */}
      {!preferences.sms_enabled && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-900">Enable SMS Notifications</p>
                  <p className="text-sm text-blue-700">
                    Get instant text alerts for time-sensitive deals and important updates
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setSettingsOpen(true)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Enable SMS
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all" className="relative">
            All
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {notifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="relative">
            Unread
            {unreadCount > 0 && (
              <Badge className="ml-2 text-xs bg-red-500">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <BellOff className="w-12 h-12 mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No notifications</p>
                  <p className="text-sm">
                    {activeTab === 'unread'
                      ? "You're all caught up!"
                      : `No ${activeTab === 'all' ? '' : activeTab + ' '}notifications yet`}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="divide-y">
                    {filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notification.is_read ? 'bg-blue-50/50' : ''
                        }`}
                        onClick={() => {
                          setSelectedNotification(notification);
                          if (!notification.is_read) {
                            markAsRead(notification.id);
                          }
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`p-2 rounded-lg ${
                              notificationTypeColors[notification.notification_type] ||
                              notificationTypeColors.general
                            }`}
                          >
                            {getNotificationIcon(notification.notification_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 truncate">
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              {formatDate(notification.created_at)}
                            </div>
                          </div>
                          {notification.is_read && (
                            <Check className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notification Detail Modal */}
      <Dialog
        open={!!selectedNotification}
        onOpenChange={() => setSelectedNotification(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification && (
                <>
                  <div
                    className={`p-2 rounded-lg ${
                      notificationTypeColors[selectedNotification.notification_type] ||
                      notificationTypeColors.general
                    }`}
                  >
                    {getNotificationIcon(selectedNotification.notification_type)}
                  </div>
                  {selectedNotification.title}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-4">
              <p className="text-gray-700">{selectedNotification.message}</p>

              {selectedNotification.data && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {selectedNotification.data.city && (
                    <p className="text-sm">
                      <span className="text-gray-500">Location:</span>{' '}
                      <span className="font-medium">
                        {selectedNotification.data.city}, {selectedNotification.data.state}
                      </span>
                    </p>
                  )}
                  {selectedNotification.data.address && (
                    <p className="text-sm">
                      <span className="text-gray-500">Address:</span>{' '}
                      <span className="font-medium">{selectedNotification.data.address}</span>
                    </p>
                  )}
                  {selectedNotification.data.expires_at && (
                    <p className="text-sm">
                      <span className="text-gray-500">Expires:</span>{' '}
                      <span className="font-medium text-orange-600">
                        {new Date(selectedNotification.data.expires_at).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {selectedNotification.data.manager_name && (
                    <p className="text-sm">
                      <span className="text-gray-500">Manager:</span>{' '}
                      <span className="font-medium">{selectedNotification.data.manager_name}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="text-xs text-gray-400 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Received {new Date(selectedNotification.created_at).toLocaleString()}
                {selectedNotification.read_at && (
                  <>
                    <span className="mx-1">•</span>
                    <Check className="w-3 h-3" />
                    Read {new Date(selectedNotification.read_at).toLocaleString()}
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedNotification(null)}>
              Close
            </Button>
            {selectedNotification?.data?.request_id && (
              <Button className="bg-[#1e3a5f] hover:bg-[#2d5a87]">
                View Deal
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preferences Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Notification Preferences
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* In-App Notifications */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-[#1e3a5f]" />
                <div>
                  <p className="font-medium">In-App Notifications</p>
                  <p className="text-sm text-gray-500">Show notifications in the portal</p>
                </div>
              </div>
              <Switch
                checked={preferences.in_app_enabled}
                onCheckedChange={(v) =>
                  setPreferences({ ...preferences, in_app_enabled: v })
                }
              />
            </div>

            <Separator />

            {/* SMS Notifications Section */}
            <div>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">SMS Text Notifications</p>
                    <p className="text-sm text-green-700">Get instant text alerts for urgent updates</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.sms_enabled}
                  onCheckedChange={(v) => {
                    setPreferences({ ...preferences, sms_enabled: v });
                    if (!v) setPhoneError('');
                  }}
                />
              </div>

              {preferences.sms_enabled && (
                <div className="space-y-4 pl-4 border-l-2 border-green-200">
                  {/* Phone Number Input */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Mobile Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={preferences.sms_phone_number}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className={phoneError ? 'border-red-500' : ''}
                    />
                    {phoneError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {phoneError}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      US phone numbers only. Standard message rates may apply.
                    </p>
                  </div>

                  {/* SMS Notification Types */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">Send SMS for:</p>
                    
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium text-sm">First Right of Refusal</p>
                        <p className="text-xs text-gray-500">24-hour deal approval alerts</p>
                      </div>
                      <Switch
                        checked={preferences.sms_first_refusal}
                        onCheckedChange={(v) =>
                          setPreferences({ ...preferences, sms_first_refusal: v })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium text-sm">Document Signatures</p>
                        <p className="text-xs text-gray-500">Documents needing your signature</p>
                      </div>
                      <Switch
                        checked={preferences.sms_documents}
                        onCheckedChange={(v) =>
                          setPreferences({ ...preferences, sms_documents: v })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium text-sm">Payment Confirmations</p>
                        <p className="text-xs text-gray-500">Successful payment notifications</p>
                      </div>
                      <Switch
                        checked={preferences.sms_payments}
                        onCheckedChange={(v) =>
                          setPreferences({ ...preferences, sms_payments: v })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium text-sm">New Deal Alerts</p>
                        <p className="text-xs text-gray-500">Deals matching your preferences</p>
                      </div>
                      <Switch
                        checked={preferences.sms_deal_alerts}
                        onCheckedChange={(v) =>
                          setPreferences({ ...preferences, sms_deal_alerts: v })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium text-sm">Account Updates</p>
                        <p className="text-xs text-gray-500">Manager assigned, approvals, etc.</p>
                      </div>
                      <Switch
                        checked={preferences.sms_account_updates}
                        onCheckedChange={(v) =>
                          setPreferences({ ...preferences, sms_account_updates: v })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Email Preferences */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-[#1e3a5f]" />
                <h3 className="font-medium">Email Notifications</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">First Right of Refusal Alerts</p>
                    <p className="text-xs text-gray-500">24-hour deal approval notifications</p>
                  </div>
                  <Switch
                    checked={preferences.email_first_refusal}
                    onCheckedChange={(v) =>
                      setPreferences({ ...preferences, email_first_refusal: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Deal Available Notifications</p>
                    <p className="text-xs text-gray-500">When new deals become available</p>
                  </div>
                  <Switch
                    checked={preferences.email_deal_available}
                    onCheckedChange={(v) =>
                      setPreferences({ ...preferences, email_deal_available: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Payment Confirmations</p>
                    <p className="text-xs text-gray-500">Receipt and address reveal emails</p>
                  </div>
                  <Switch
                    checked={preferences.email_payment_success}
                    onCheckedChange={(v) =>
                      setPreferences({ ...preferences, email_payment_success: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Manager Assignment</p>
                    <p className="text-xs text-gray-500">When an acquisition manager is assigned</p>
                  </div>
                  <Switch
                    checked={preferences.email_manager_assigned}
                    onCheckedChange={(v) =>
                      setPreferences({ ...preferences, email_manager_assigned: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">New Deal Alerts</p>
                    <p className="text-xs text-gray-500">Weekly digest of new deals</p>
                  </div>
                  <Switch
                    checked={preferences.email_new_deals}
                    onCheckedChange={(v) =>
                      setPreferences({ ...preferences, email_new_deals: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Market Reports</p>
                    <p className="text-xs text-gray-500">Monthly market analysis reports</p>
                  </div>
                  <Switch
                    checked={preferences.email_market_reports}
                    onCheckedChange={(v) =>
                      setPreferences({ ...preferences, email_market_reports: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Platform Updates</p>
                    <p className="text-xs text-gray-500">New features and announcements</p>
                  </div>
                  <Switch
                    checked={preferences.email_platform_updates}
                    onCheckedChange={(v) =>
                      setPreferences({ ...preferences, email_platform_updates: v })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={savePreferences}
              disabled={savingPrefs}
              className="bg-[#1e3a5f] hover:bg-[#2d5a87]"
            >
              {savingPrefs ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
