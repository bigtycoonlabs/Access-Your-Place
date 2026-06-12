import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Mail,
  Bell,
  BellOff,
  Building2,
  MessageSquare,
  Briefcase,
  FileText,
  Gift,
  TrendingUp,
  Calendar,
  Clock,
  Check,
  Loader2,
  Settings,
  History,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Shield
} from 'lucide-react';

interface EmailPreference {
  // Deal Notifications
  email_new_deals: boolean;
  email_deal_available: boolean;
  email_first_refusal: boolean;
  
  // Inquiry & Acquisition
  email_inquiry_updates: boolean;
  email_acquisition_milestones: boolean;
  
  // Documents & Payments
  email_document_ready: boolean;
  email_payment_success: boolean;
  email_manager_assigned: boolean;
  
  // Reports & Updates
  email_market_reports: boolean;
  email_weekly_summary: boolean;
  email_platform_updates: boolean;
  email_referral_updates: boolean;
  
  // Summary Settings
  weekly_summary_enabled: boolean;
  weekly_summary_day: string;
  email_frequency: string;
  digest_time: string;
  
  // Global
  unsubscribed_all: boolean;
}

interface EmailLog {
  id: string;
  email_type: string;
  subject: string;
  status: string;
  created_at: string;
}

const defaultPreferences: EmailPreference = {
  email_new_deals: true,
  email_deal_available: true,
  email_first_refusal: true,
  email_inquiry_updates: true,
  email_acquisition_milestones: true,
  email_document_ready: true,
  email_payment_success: true,
  email_manager_assigned: true,
  email_market_reports: true,
  email_weekly_summary: true,
  email_platform_updates: false,
  email_referral_updates: true,
  weekly_summary_enabled: true,
  weekly_summary_day: 'monday',
  email_frequency: 'immediate',
  digest_time: '09:00',
  unsubscribed_all: false
};

const emailTypeLabels: Record<string, string> = {
  'deal_alert': 'Deal Alert',
  'inquiry_update': 'Inquiry Update',
  'acquisition_milestone': 'Acquisition Milestone',
  'weekly_summary': 'Weekly Summary',
  'document_ready': 'Document Ready',
  'payment_success': 'Payment Confirmation',
  'welcome': 'Welcome Email',
  'verification': 'Email Verification',
  'general': 'General Notification'
};

export function EmailPreferences({ investorId }: { investorId: string }) {
  const [preferences, setPreferences] = useState<EmailPreference>(defaultPreferences);
  const [emailHistory, setEmailHistory] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('preferences');
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
  }, [investorId]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchEmailHistory();
    }
  }, [activeTab, investorId]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('investor-email-notifications', {
        body: { action: 'get_preferences', investor_id: investorId }
      });

      if (data?.preferences) {
        setPreferences({ ...defaultPreferences, ...data.preferences });
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
    setLoading(false);
  };

  const fetchEmailHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-email-notifications', {
        body: { action: 'get_email_history', investor_id: investorId, limit: 50 }
      });

      if (data?.logs) {
        setEmailHistory(data.logs);
      }
    } catch (err) {
      console.error('Error fetching email history:', err);
    }
    setHistoryLoading(false);
  };

  const updatePreference = (key: keyof EmailPreference, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('investor-email-notifications', {
        body: { 
          action: 'update_preferences', 
          investor_id: investorId,
          preferences 
        }
      });

      if (error) throw error;

      toast({ 
        title: 'Preferences Saved!',
        description: 'Your email notification settings have been updated.'
      });
      setHasChanges(false);
    } catch (err) {
      console.error('Error saving preferences:', err);
      toast({ 
        title: 'Error', 
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive' 
      });
    }
    setSaving(false);
  };

  const toggleAllNotifications = (enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      unsubscribed_all: !enabled,
      email_new_deals: enabled,
      email_deal_available: enabled,
      email_first_refusal: enabled,
      email_inquiry_updates: enabled,
      email_acquisition_milestones: enabled,
      email_document_ready: enabled,
      email_payment_success: enabled,
      email_manager_assigned: enabled,
      email_market_reports: enabled,
      email_weekly_summary: enabled,
      email_platform_updates: enabled,
      email_referral_updates: enabled
    }));
    setHasChanges(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
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
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Email Preferences</CardTitle>
                <CardDescription>
                  Control which emails you receive from Access Your Place
                </CardDescription>
              </div>
            </div>
            {hasChanges && (
              <Button 
                onClick={savePreferences} 
                disabled={saving}
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Unsubscribed Warning */}
      {preferences.unsubscribed_all && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You have unsubscribed from all email notifications. You may miss important updates about your investments.
            <Button 
              variant="link" 
              className="text-red-700 p-0 h-auto ml-2"
              onClick={() => toggleAllNotifications(true)}
            >
              Re-enable notifications
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Email History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="space-y-6 mt-6">
          {/* Master Toggle */}
          <Card className={preferences.unsubscribed_all ? 'border-red-200' : 'border-green-200'}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {preferences.unsubscribed_all ? (
                    <BellOff className="w-6 h-6 text-red-500" />
                  ) : (
                    <Bell className="w-6 h-6 text-green-500" />
                  )}
                  <div>
                    <p className="font-semibold">Email Notifications</p>
                    <p className="text-sm text-gray-500">
                      {preferences.unsubscribed_all 
                        ? 'All email notifications are disabled' 
                        : 'Receiving email notifications'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={!preferences.unsubscribed_all}
                  onCheckedChange={(checked) => toggleAllNotifications(checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Deal Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#d4a574]" />
                <CardTitle className="text-lg">Deal Notifications</CardTitle>
              </div>
              <CardDescription>
                Get notified about new investment opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">New Deal Alerts</Label>
                  <p className="text-sm text-gray-500">Deals matching your saved criteria</p>
                </div>
                <Switch
                  checked={preferences.email_new_deals}
                  onCheckedChange={(v) => updatePreference('email_new_deals', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Deal Available Notifications</Label>
                  <p className="text-sm text-gray-500">When deals become available in your markets</p>
                </div>
                <Switch
                  checked={preferences.email_deal_available}
                  onCheckedChange={(v) => updatePreference('email_deal_available', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div>
                    <Label className="font-medium">First Right of Refusal</Label>
                    <p className="text-sm text-gray-500">24-hour exclusive deal opportunities</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700">Important</Badge>
                </div>
                <Switch
                  checked={preferences.email_first_refusal}
                  onCheckedChange={(v) => updatePreference('email_first_refusal', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
            </CardContent>
          </Card>

          {/* Inquiry & Acquisition Updates */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#1e3a5f]" />
                <CardTitle className="text-lg">Inquiry & Acquisition Updates</CardTitle>
              </div>
              <CardDescription>
                Stay informed about your investment progress
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Inquiry Status Updates</Label>
                  <p className="text-sm text-gray-500">When your inquiry status changes</p>
                </div>
                <Switch
                  checked={preferences.email_inquiry_updates}
                  onCheckedChange={(v) => updatePreference('email_inquiry_updates', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div>
                    <Label className="font-medium">Acquisition Milestones</Label>
                    <p className="text-sm text-gray-500">Progress updates on your acquisitions</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700">Recommended</Badge>
                </div>
                <Switch
                  checked={preferences.email_acquisition_milestones}
                  onCheckedChange={(v) => updatePreference('email_acquisition_milestones', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Manager Assignment</Label>
                  <p className="text-sm text-gray-500">When an acquisition manager is assigned</p>
                </div>
                <Switch
                  checked={preferences.email_manager_assigned}
                  onCheckedChange={(v) => updatePreference('email_manager_assigned', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
            </CardContent>
          </Card>

          {/* Documents & Payments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-500" />
                <CardTitle className="text-lg">Documents & Payments</CardTitle>
              </div>
              <CardDescription>
                Important transaction notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div>
                    <Label className="font-medium">Document Ready</Label>
                    <p className="text-sm text-gray-500">When documents need your attention</p>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700">Important</Badge>
                </div>
                <Switch
                  checked={preferences.email_document_ready}
                  onCheckedChange={(v) => updatePreference('email_document_ready', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Payment Confirmations</Label>
                  <p className="text-sm text-gray-500">Receipts and payment success emails</p>
                </div>
                <Switch
                  checked={preferences.email_payment_success}
                  onCheckedChange={(v) => updatePreference('email_payment_success', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
            </CardContent>
          </Card>

          {/* Reports & Summaries */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-lg">Reports & Summaries</CardTitle>
              </div>
              <CardDescription>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Penny AI Weekly Digest - Enhanced Section */}
              <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <Label className="font-semibold text-[#1e3a5f]">Penny AI Weekly Digest</Label>
                      <p className="text-sm text-gray-500">Personalized portfolio insights every week</p>
                    </div>
                    <Badge className="bg-purple-100 text-purple-700 ml-1">AI-Powered</Badge>
                  </div>
                  <Switch
                    checked={preferences.email_weekly_summary}
                    onCheckedChange={(v) => updatePreference('email_weekly_summary', v)}
                    disabled={preferences.unsubscribed_all}
                  />
                </div>

                {preferences.email_weekly_summary && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { icon: TrendingUp, label: 'Portfolio Performance', color: 'text-green-600' },
                        { icon: Building2, label: 'New Matching Deals', color: 'text-blue-600' },
                        { icon: Sparkles, label: 'Penny Score Changes', color: 'text-purple-600' },
                        { icon: Calendar, label: 'Season Alerts', color: 'text-amber-600' },
                        { icon: TrendingUp, label: 'Market Trends', color: 'text-indigo-600' },
                        { icon: MessageSquare, label: 'AI Tips & Advice', color: 'text-pink-600' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-white/70 rounded-lg px-3 py-2">
                          <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                          <span className="text-gray-700">{item.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-purple-200">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <Label className="text-sm text-gray-600">Delivery Day</Label>
                      </div>
                      <Select 
                        value={preferences.weekly_summary_day}
                        onValueChange={(v) => updatePreference('weekly_summary_day', v)}
                        disabled={preferences.unsubscribed_all}
                      >
                        <SelectTrigger className="w-36 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monday">Monday</SelectItem>
                          <SelectItem value="tuesday">Tuesday</SelectItem>
                          <SelectItem value="wednesday">Wednesday</SelectItem>
                          <SelectItem value="thursday">Thursday</SelectItem>
                          <SelectItem value="friday">Friday</SelectItem>
                          <SelectItem value="saturday">Saturday</SelectItem>
                          <SelectItem value="sunday">Sunday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>



              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Market Reports</Label>
                  <p className="text-sm text-gray-500">Monthly market analysis and insights</p>
                </div>
                <Switch
                  checked={preferences.email_market_reports}
                  onCheckedChange={(v) => updatePreference('email_market_reports', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
            </CardContent>
          </Card>

          {/* Other Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <CardTitle className="text-lg">Other Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Referral Updates</Label>
                  <p className="text-sm text-gray-500">When your referrals take action</p>
                </div>
                <Switch
                  checked={preferences.email_referral_updates}
                  onCheckedChange={(v) => updatePreference('email_referral_updates', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Platform Updates</Label>
                  <p className="text-sm text-gray-500">New features and announcements</p>
                </div>
                <Switch
                  checked={preferences.email_platform_updates}
                  onCheckedChange={(v) => updatePreference('email_platform_updates', v)}
                  disabled={preferences.unsubscribed_all}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button (Mobile) */}
          {hasChanges && (
            <div className="sticky bottom-4 md:hidden">
              <Button 
                onClick={savePreferences} 
                disabled={saving}
                className="w-full bg-[#d4a574] hover:bg-[#c49464] shadow-lg"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email History</CardTitle>
              <CardDescription>
                Recent emails sent to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1e3a5f]" />
                </div>
              ) : emailHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No email history yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {emailHistory.map((log) => (
                      <div 
                        key={log.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            log.status === 'sent' 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {log.status === 'sent' ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <AlertCircle className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {log.subject || emailTypeLabels[log.email_type] || 'Email'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {emailTypeLabels[log.email_type] || log.email_type}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {formatDate(log.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge 
                          className={log.status === 'sent' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                          }
                        >
                          {log.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Privacy Note */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600">
                We respect your privacy. You can update your preferences at any time. 
                Even with notifications disabled, you may still receive essential 
                transactional emails related to your account security and legal obligations.
              </p>
              <a 
                href="/privacy-policy" 
                className="text-sm text-[#1e3a5f] hover:underline mt-2 inline-block"
              >
                View Privacy Policy
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
