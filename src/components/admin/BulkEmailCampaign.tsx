import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Send, Users, Filter, Eye, Mail, CheckCircle, XCircle,
  AlertCircle, Search, RefreshCw, BarChart3, Clock, Calendar,
  Target, UserCheck, Building, MapPin, Phone, Sparkles, CalendarClock,
  Play, Pause, Trash2, Edit, Timer, Settings, Activity, Zap
} from 'lucide-react';

interface Investor {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  market_preferences?: string[];
  discovery_call_completed?: boolean;
  is_verified?: boolean;
  status?: string;
  created_at: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: string;
  blocks: any[];
  is_active: boolean;
}

interface Campaign {
  id: string;
  name: string;
  template_id: string;
  template_name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled';
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  bounced_count: number;
  scheduled_for?: string;
  created_at: string;
  completed_at?: string;
  recipient_ids?: string[];
}

interface CronJobLog {
  id: string;
  job_name: string;
  status: string;
  result: any;
  error_message?: string;
  executed_at: string;
  duration_ms?: number;
}

interface FilterCriteria {
  marketPreferences: string[];
  discoveryCallStatus: 'all' | 'completed' | 'not_completed';
  verificationStatus: 'all' | 'verified' | 'not_verified';
  accountStatus: 'all' | 'active' | 'inactive';
  registeredAfter?: string;
  registeredBefore?: string;
  searchQuery: string;
}

const availableMarkets = [
  'Austin, TX', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX',
  'Phoenix, AZ', 'Denver, CO', 'Nashville, TN', 'Atlanta, GA',
  'Charlotte, NC', 'Tampa, FL', 'Orlando, FL', 'Miami, FL',
  'Jacksonville, FL', 'Columbus, OH', 'Cleveland, OH', 'Louisville, KY'
];

export function BulkEmailCampaign() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [filteredInvestors, setFilteredInvestors] = useState<Investor[]>([]);
  const [selectedInvestors, setSelectedInvestors] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [scheduledCampaigns, setScheduledCampaigns] = useState<Campaign[]>([]);
  const [cronLogs, setCronLogs] = useState<CronJobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewInvestor, setPreviewInvestor] = useState<Investor | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [triggeringCron, setTriggeringCron] = useState(false);
  
  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [campaignToCancel, setCampaignToCancel] = useState<Campaign | null>(null);
  
  const [filters, setFilters] = useState<FilterCriteria>({
    marketPreferences: [],
    discoveryCallStatus: 'all',
    verificationStatus: 'all',
    accountStatus: 'all',
    searchQuery: ''
  });
  const { toast } = useToast();


  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [investors, filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch investors
      const { data: investorData } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'list' }
      });
      if (investorData?.investors) {
        setInvestors(investorData.investors);
      }

      // Fetch custom templates
      const { data: templateData } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'list_custom_templates' }
      });
      if (templateData?.templates) {
        setTemplates(templateData.templates);
      }

      // Fetch all campaigns
      const { data: campaignData } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'list_campaigns' }
      });
      if (campaignData?.campaigns) {
        const allCampaigns = campaignData.campaigns;
        setCampaigns(allCampaigns.filter((c: Campaign) => c.status !== 'scheduled'));
        setScheduledCampaigns(allCampaigns.filter((c: Campaign) => c.status === 'scheduled'));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  const applyFilters = () => {
    let result = [...investors];

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(inv =>
        inv.email.toLowerCase().includes(query) ||
        inv.first_name?.toLowerCase().includes(query) ||
        inv.last_name?.toLowerCase().includes(query)
      );
    }

    // Market preferences
    if (filters.marketPreferences.length > 0) {
      result = result.filter(inv =>
        inv.market_preferences?.some(m => filters.marketPreferences.includes(m))
      );
    }

    // Discovery call status
    if (filters.discoveryCallStatus !== 'all') {
      result = result.filter(inv =>
        filters.discoveryCallStatus === 'completed'
          ? inv.discovery_call_completed
          : !inv.discovery_call_completed
      );
    }

    // Verification status
    if (filters.verificationStatus !== 'all') {
      result = result.filter(inv =>
        filters.verificationStatus === 'verified'
          ? inv.is_verified
          : !inv.is_verified
      );
    }

    // Account status
    if (filters.accountStatus !== 'all') {
      result = result.filter(inv =>
        filters.accountStatus === 'active'
          ? inv.status === 'active'
          : inv.status !== 'active'
      );
    }

    // Date filters
    if (filters.registeredAfter) {
      result = result.filter(inv =>
        new Date(inv.created_at) >= new Date(filters.registeredAfter!)
      );
    }
    if (filters.registeredBefore) {
      result = result.filter(inv =>
        new Date(inv.created_at) <= new Date(filters.registeredBefore!)
      );
    }

    setFilteredInvestors(result);
  };

  const toggleSelectAll = () => {
    if (selectedInvestors.size === filteredInvestors.length) {
      setSelectedInvestors(new Set());
    } else {
      setSelectedInvestors(new Set(filteredInvestors.map(i => i.id)));
    }
  };

  const toggleInvestor = (id: string) => {
    const newSelected = new Set(selectedInvestors);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedInvestors(newSelected);
  };

  const generatePreview = async (investor: Investor) => {
    if (!selectedTemplate) return;

    setPreviewInvestor(investor);

    // Generate HTML from template blocks with investor data
    const sampleData: Record<string, string> = {
      investor_name: `${investor.first_name || ''} ${investor.last_name || ''}`.trim() || 'Investor',
      investor_email: investor.email,
      investor_phone: investor.phone || 'N/A',
      property_address: '123 Main St, Austin, TX',
      property_price: '$350,000',
      projected_profit: '$2,500/mo',
      bedrooms: '3',
      bathrooms: '2',
      manager_name: 'Sarah Johnson',
      manager_email: 'sarah@accessyourplace.com',
      portal_link: 'https://accessyourplace.com/portal',
      deal_link: 'https://accessyourplace.com/deals/123',
      current_date: new Date().toLocaleDateString(),
    };

    let html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 20px; text-align: center;">
          <span style="color: white; font-size: 24px; font-weight: bold;">Access Your Place</span>
        </div>
        <div style="padding: 30px;">
    `;

    selectedTemplate.blocks?.forEach(block => {
      let content = block.content || '';
      Object.entries(sampleData).forEach(([key, value]) => {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      switch (block.type) {
        case 'header':
          html += `<h1 style="text-align: ${block.settings?.alignment || 'center'}; font-size: ${block.settings?.fontSize || '24px'}; color: ${block.settings?.color || '#1a365d'}; margin: 20px 0;">${content}</h1>`;
          break;
        case 'text':
          html += `<p style="text-align: ${block.settings?.alignment || 'left'}; font-size: ${block.settings?.fontSize || '16px'}; color: ${block.settings?.color || '#374151'}; line-height: 1.6; margin: 15px 0;">${content}</p>`;
          break;
        case 'button':
          let buttonUrl = block.settings?.buttonUrl || '#';
          Object.entries(sampleData).forEach(([key, value]) => {
            buttonUrl = buttonUrl.replace(new RegExp(`{{${key}}}`, 'g'), value);
          });
          html += `<div style="text-align: ${block.settings?.alignment || 'center'}; margin: 25px 0;"><a href="${buttonUrl}" style="display: inline-block; background-color: ${block.settings?.backgroundColor || '#d4a574'}; color: ${block.settings?.color || '#ffffff'}; padding: ${block.settings?.padding || '12px 24px'}; text-decoration: none; border-radius: 6px; font-weight: 600;">${content}</a></div>`;
          break;
        case 'divider':
          html += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;"/>`;
          break;
        case 'spacer':
          html += `<div style="height: ${block.settings?.height || '20px'};"></div>`;
          break;
      }
    });

    html += `
        </div>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280;">
          <p>Access Your Place | Rental Arbitrage Deals</p>
        </div>
      </div>
    `;

    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  const getScheduledDateTime = (): string | null => {
    if (!isScheduled || !scheduledDate || !scheduledTime) return null;
    return `${scheduledDate}T${scheduledTime}:00`;
  };

  const validateScheduledTime = (): boolean => {
    if (!isScheduled) return true;
    if (!scheduledDate || !scheduledTime) {
      toast({ title: 'Please select a date and time for scheduling', variant: 'destructive' });
      return false;
    }
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = new Date();
    if (scheduledDateTime <= now) {
      toast({ title: 'Scheduled time must be in the future', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const sendCampaign = async () => {
    if (!selectedTemplate || selectedInvestors.size === 0 || !campaignName.trim()) {
      toast({ title: 'Please select a template, recipients, and enter a campaign name', variant: 'destructive' });
      return;
    }

    if (!validateScheduledTime()) return;

    setSending(true);
    setSendProgress(0);

    try {
      const recipientIds = Array.from(selectedInvestors);
      const totalRecipients = recipientIds.length;
      const scheduledFor = getScheduledDateTime();

      // Create campaign record
      const { data: campaignData, error: campaignError } = await supabase.functions.invoke('manage-email-templates', {
        body: {
          action: 'create_campaign',
          campaign: {
            name: campaignName,
            template_id: selectedTemplate.id,
            template_name: selectedTemplate.name,
            subject: selectedTemplate.subject,
            recipient_ids: recipientIds,
            total_recipients: totalRecipients,
            scheduled_for: scheduledFor,
            status: scheduledFor ? 'scheduled' : 'sending'
          }
        }
      });

      if (campaignError) throw campaignError;

      const campaignId = campaignData?.campaign_id;

      // If scheduled, don't send now - just show success
      if (scheduledFor) {
        toast({ 
          title: 'Campaign Scheduled!', 
          description: `Campaign will be sent on ${new Date(scheduledFor).toLocaleString()}` 
        });
        setCampaignName('');
        setSelectedInvestors(new Set());
        setSelectedTemplate(null);
        setIsScheduled(false);
        setScheduledDate('');
        setScheduledTime('');
        fetchData();
        setActiveTab('scheduled');
        setSending(false);
        return;
      }

      // Send emails immediately in batches
      const batchSize = 10;
      let sentCount = 0;

      for (let i = 0; i < recipientIds.length; i += batchSize) {
        const batch = recipientIds.slice(i, i + batchSize);
        const batchInvestors = investors.filter(inv => batch.includes(inv.id));

        const { data, error } = await supabase.functions.invoke('manage-email-templates', {
          body: {
            action: 'send_campaign_batch',
            campaign_id: campaignId,
            template: selectedTemplate,
            recipients: batchInvestors
          }
        });

        if (error) {
          console.error('Batch send error:', error);
        }

        sentCount += batch.length;
        setSendProgress((sentCount / totalRecipients) * 100);
      }

      // Update campaign status
      await supabase.functions.invoke('manage-email-templates', {
        body: {
          action: 'complete_campaign',
          campaign_id: campaignId,
          sent_count: sentCount
        }
      });

      toast({ title: `Campaign sent to ${sentCount} recipients!` });
      setCampaignName('');
      setSelectedInvestors(new Set());
      setSelectedTemplate(null);
      setIsScheduled(false);
      setScheduledDate('');
      setScheduledTime('');
      fetchData();
      setActiveTab('history');
    } catch (err: any) {
      toast({ title: 'Failed to send campaign', description: err.message, variant: 'destructive' });
    }

    setSending(false);
    setSendProgress(0);
  };

  const cancelScheduledCampaign = async () => {
    if (!campaignToCancel) return;

    try {
      await supabase.functions.invoke('manage-email-templates', {
        body: {
          action: 'cancel_campaign',
          campaign_id: campaignToCancel.id
        }
      });

      toast({ title: 'Campaign cancelled successfully' });
      setCancelDialogOpen(false);
      setCampaignToCancel(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Failed to cancel campaign', description: err.message, variant: 'destructive' });
    }
  };

  const sendScheduledCampaignNow = async (campaign: Campaign) => {
    try {
      await supabase.functions.invoke('manage-email-templates', {
        body: {
          action: 'send_scheduled_now',
          campaign_id: campaign.id
        }
      });

      toast({ title: 'Campaign is being sent now!' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Failed to send campaign', description: err.message, variant: 'destructive' });
    }
  };

  const rescheduleCanpaign = async (campaign: Campaign, newDateTime: string) => {
    try {
      await supabase.functions.invoke('manage-email-templates', {
        body: {
          action: 'reschedule_campaign',
          campaign_id: campaign.id,
          scheduled_for: newDateTime
        }
      });

      toast({ title: 'Campaign rescheduled successfully' });
      setEditingCampaign(null);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Failed to reschedule campaign', description: err.message, variant: 'destructive' });
    }
  };

  const resetFilters = () => {
    setFilters({
      marketPreferences: [],
      discoveryCallStatus: 'all',
      verificationStatus: 'all',
      accountStatus: 'all',
      searchQuery: ''
    });
  };

  const getTimeUntilSend = (scheduledFor: string): string => {
    const now = new Date();
    const scheduled = new Date(scheduledFor);
    const diff = scheduled.getTime() - now.getTime();
    
    if (diff < 0) return 'Processing...';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get minimum time if today is selected
  const getMinTime = () => {
    if (scheduledDate === getMinDate()) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5);
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    return '00:00';
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
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
            Bulk Email Campaigns
          </CardTitle>
          <CardDescription>
            Send targeted email campaigns to investors based on their preferences and status
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Send className="w-4 h-4" aria-hidden="true" />
            Create Campaign
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" aria-hidden="true" />
            Scheduled ({scheduledCampaigns.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Create Campaign Tab */}
        <TabsContent value="create" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Filters Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="w-4 h-4" aria-hidden="true" />
                  Filter Recipients
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div>
                  <Label htmlFor="search-investors">Search</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                    <Input
                      id="search-investors"
                      value={filters.searchQuery}
                      onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                      placeholder="Name or email..."
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Market Preferences */}
                <div>
                  <Label>Market Preferences</Label>
                  <ScrollArea className="h-[150px] border rounded-lg p-2 mt-1">
                    <div className="space-y-2">
                      {availableMarkets.map(market => (
                        <div key={market} className="flex items-center gap-2">
                          <Checkbox
                            id={`market-${market}`}
                            checked={filters.marketPreferences.includes(market)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilters({ ...filters, marketPreferences: [...filters.marketPreferences, market] });
                              } else {
                                setFilters({ ...filters, marketPreferences: filters.marketPreferences.filter(m => m !== market) });
                              }
                            }}
                          />
                          <Label htmlFor={`market-${market}`} className="text-sm font-normal cursor-pointer">
                            {market}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Discovery Call Status */}
                <div>
                  <Label htmlFor="discovery-status">Discovery Call</Label>
                  <Select
                    value={filters.discoveryCallStatus}
                    onValueChange={(v: any) => setFilters({ ...filters, discoveryCallStatus: v })}
                  >
                    <SelectTrigger id="discovery-status" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="not_completed">Not Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Verification Status */}
                <div>
                  <Label htmlFor="verification-status">Verification</Label>
                  <Select
                    value={filters.verificationStatus}
                    onValueChange={(v: any) => setFilters({ ...filters, verificationStatus: v })}
                  >
                    <SelectTrigger id="verification-status" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="not_verified">Not Verified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Account Status */}
                <div>
                  <Label htmlFor="account-status">Account Status</Label>
                  <Select
                    value={filters.accountStatus}
                    onValueChange={(v: any) => setFilters({ ...filters, accountStatus: v })}
                  >
                    <SelectTrigger id="account-status" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="date-after">Registered After</Label>
                    <Input
                      id="date-after"
                      type="date"
                      value={filters.registeredAfter || ''}
                      onChange={(e) => setFilters({ ...filters, registeredAfter: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date-before">Before</Label>
                    <Input
                      id="date-before"
                      type="date"
                      value={filters.registeredBefore || ''}
                      onChange={(e) => setFilters({ ...filters, registeredBefore: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button variant="outline" onClick={resetFilters} className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Reset Filters
                </Button>

                {/* Filter Summary */}
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">
                    {filteredInvestors.length} investors match filters
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {selectedInvestors.size} selected for campaign
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recipients List */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-4 h-4" aria-hidden="true" />
                    Recipients ({filteredInvestors.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                    {selectedInvestors.size === filteredInvestors.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2" role="list" aria-label="Investor recipients">
                    {filteredInvestors.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No investors match the current filters</p>
                    ) : (
                      filteredInvestors.map(investor => (
                        <div
                          key={investor.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                            selectedInvestors.has(investor.id) ? 'border-[#1e3a5f] bg-blue-50' : 'hover:border-gray-300'
                          }`}
                          role="listitem"
                        >
                          <Checkbox
                            id={`investor-${investor.id}`}
                            checked={selectedInvestors.has(investor.id)}
                            onCheckedChange={() => toggleInvestor(investor.id)}
                            aria-label={`Select ${investor.first_name} ${investor.last_name}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">
                              {investor.first_name} {investor.last_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{investor.email}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {investor.discovery_call_completed && (
                                <Badge variant="outline" className="text-xs bg-green-50">
                                  <Phone className="w-3 h-3 mr-1" aria-hidden="true" />
                                  Call Done
                                </Badge>
                              )}
                              {investor.is_verified && (
                                <Badge variant="outline" className="text-xs bg-blue-50">
                                  <UserCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                                  Verified
                                </Badge>
                              )}
                              {investor.market_preferences?.slice(0, 2).map(m => (
                                <Badge key={m} variant="secondary" className="text-xs">
                                  <MapPin className="w-3 h-3 mr-1" aria-hidden="true" />
                                  {m.split(',')[0]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generatePreview(investor)}
                            disabled={!selectedTemplate}
                            aria-label={`Preview email for ${investor.first_name}`}
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Campaign Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Campaign Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="campaign-name">Campaign Name</Label>
                  <Input
                    id="campaign-name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., January Deal Alert"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="template-select">Email Template</Label>
                  <Select
                    value={selectedTemplate?.id || ''}
                    onValueChange={(v) => setSelectedTemplate(templates.find(t => t.id === v) || null)}
                  >
                    <SelectTrigger id="template-select" className="mt-1">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} - {t.subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedTemplate && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium">Selected Template: {selectedTemplate.name}</p>
                  <p className="text-sm text-gray-600 mt-1">Subject: {selectedTemplate.subject}</p>
                  <p className="text-xs text-gray-500 mt-1">{selectedTemplate.blocks?.length || 0} content blocks</p>
                </div>
              )}

              {/* Scheduling Options */}
              <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-[#1e3a5f]" aria-hidden="true" />
                    <Label htmlFor="schedule-toggle" className="font-medium">Schedule for Later</Label>
                  </div>
                  <Switch
                    id="schedule-toggle"
                    checked={isScheduled}
                    onCheckedChange={setIsScheduled}
                    aria-label="Toggle scheduling"
                  />
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-blue-200">
                    <div>
                      <Label htmlFor="schedule-date">Date</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={getMinDate()}
                        className="mt-1"
                        aria-describedby="schedule-date-help"
                      />
                      <p id="schedule-date-help" className="text-xs text-gray-500 mt-1">
                        Select the date to send the campaign
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="schedule-time">Time</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        min={getMinTime()}
                        className="mt-1"
                        aria-describedby="schedule-time-help"
                      />
                      <p id="schedule-time-help" className="text-xs text-gray-500 mt-1">
                        Time in your local timezone
                      </p>
                    </div>
                    {scheduledDate && scheduledTime && (
                      <div className="md:col-span-2 p-3 bg-white rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 text-[#1e3a5f]">
                          <Timer className="w-4 h-4" aria-hidden="true" />
                          <span className="text-sm font-medium">
                            Campaign will be sent on {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {sending && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Sending emails...</span>
                    <span>{Math.round(sendProgress)}%</span>
                  </div>
                  <Progress value={sendProgress} className="h-2" />
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-gray-600">
                  <Target className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {selectedInvestors.size} recipients selected
                </div>
                <div className="flex gap-2">
                  {selectedTemplate && selectedInvestors.size > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const firstInvestor = investors.find(i => selectedInvestors.has(i.id));
                        if (firstInvestor) generatePreview(firstInvestor);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
                      Preview
                    </Button>
                  )}
                  <Button
                    onClick={sendCampaign}
                    disabled={sending || !selectedTemplate || selectedInvestors.size === 0 || !campaignName.trim()}
                    className="bg-[#d4a574] hover:bg-[#c49464]"
                  >
                    {sending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />Sending...</>
                    ) : isScheduled ? (
                      <><CalendarClock className="w-4 h-4 mr-2" aria-hidden="true" />Schedule Campaign</>
                    ) : (
                      <><Send className="w-4 h-4 mr-2" aria-hidden="true" />Send Now</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Campaigns Tab */}
        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-[#1e3a5f]" aria-hidden="true" />
                    Scheduled Campaigns
                  </CardTitle>
                  <CardDescription>
                    Campaigns queued for future delivery
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={fetchData}>
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {scheduledCampaigns.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CalendarClock className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
                  <p className="font-medium">No scheduled campaigns</p>
                  <p className="text-sm mt-1">Create a campaign and schedule it for later delivery</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setActiveTab('create')}
                  >
                    <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                    Create Campaign
                  </Button>
                </div>
              ) : (
                <div className="space-y-4" role="list" aria-label="Scheduled campaigns">
                  {scheduledCampaigns.map(campaign => (
                    <div
                      key={campaign.id}
                      className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50"
                      role="listitem"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-lg">{campaign.name}</h4>
                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                              <Clock className="w-3 h-3 mr-1" aria-hidden="true" />
                              Scheduled
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{campaign.template_name}</p>
                          <p className="text-sm text-gray-500">Subject: {campaign.subject}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-[#1e3a5f] font-medium">
                            <Timer className="w-4 h-4" aria-hidden="true" />
                            {campaign.scheduled_for && getTimeUntilSend(campaign.scheduled_for)}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">until send</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-blue-200">
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-xl font-bold text-[#1e3a5f]">{campaign.total_recipients}</p>
                          <p className="text-xs text-gray-500">Recipients</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-sm font-medium text-gray-700">
                            {campaign.scheduled_for && new Date(campaign.scheduled_for).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">Send Date</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-sm font-medium text-gray-700">
                            {campaign.scheduled_for && new Date(campaign.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-gray-500">Send Time</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg">
                          <p className="text-sm font-medium text-gray-700">
                            {new Date(campaign.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">Created</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-blue-200">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCampaign(campaign)}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4 mr-1" aria-hidden="true" />
                          Reschedule
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendScheduledCampaignNow(campaign)}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <Play className="w-4 h-4 mr-1" aria-hidden="true" />
                          Send Now
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCampaignToCancel(campaign);
                            setCancelDialogOpen(true);
                          }}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" aria-hidden="true" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaign History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" aria-hidden="true" />
                Campaign History
              </CardTitle>
              <CardDescription>
                Track performance of your email campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
                  <p>No campaigns sent yet</p>
                </div>
              ) : (
                <div className="space-y-4" role="list" aria-label="Campaign history">
                  {campaigns.map(campaign => (
                    <div
                      key={campaign.id}
                      className="border rounded-lg p-4"
                      role="listitem"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{campaign.name}</h4>
                          <p className="text-sm text-gray-500">{campaign.template_name}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" aria-hidden="true" />
                            {new Date(campaign.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            campaign.status === 'completed' ? 'default' :
                            campaign.status === 'sending' ? 'secondary' :
                            campaign.status === 'failed' ? 'destructive' :
                            campaign.status === 'cancelled' ? 'outline' : 'outline'
                          }
                        >
                          {campaign.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />}
                          {campaign.status === 'sending' && <Loader2 className="w-3 h-3 mr-1 animate-spin" aria-hidden="true" />}
                          {campaign.status === 'failed' && <XCircle className="w-3 h-3 mr-1" aria-hidden="true" />}
                          {campaign.status === 'cancelled' && <XCircle className="w-3 h-3 mr-1" aria-hidden="true" />}
                          {campaign.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-[#1e3a5f]">{campaign.total_recipients}</p>
                          <p className="text-xs text-gray-500">Recipients</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">{campaign.sent_count || 0}</p>
                          <p className="text-xs text-gray-500">Sent</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{campaign.delivered_count || 0}</p>
                          <p className="text-xs text-gray-500">Delivered</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-[#d4a574]">{campaign.opened_count || 0}</p>
                          <p className="text-xs text-gray-500">Opened</p>
                        </div>
                      </div>

                      {campaign.bounced_count > 0 && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-600">
                          <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                          {campaign.bounced_count} emails bounced
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" aria-hidden="true" />
              Email Preview
            </DialogTitle>
            <DialogDescription>
              Preview for: {previewInvestor?.first_name} {previewInvestor?.last_name} ({previewInvestor?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto border rounded-lg">
            <div
              dangerouslySetInnerHTML={{ __html: previewHtml }}
              className="bg-gray-100 p-4"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Campaign Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
              Cancel Scheduled Campaign
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the campaign "{campaignToCancel?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">
              <strong>{campaignToCancel?.total_recipients}</strong> recipients will not receive this email.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Campaign
            </Button>
            <Button variant="destructive" onClick={cancelScheduledCampaign}>
              <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
              Cancel Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!editingCampaign} onOpenChange={(open) => !open && setEditingCampaign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[#1e3a5f]" aria-hidden="true" />
              Reschedule Campaign
            </DialogTitle>
            <DialogDescription>
              Change the scheduled send time for "{editingCampaign?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reschedule-date">New Date</Label>
              <Input
                id="reschedule-date"
                type="date"
                min={getMinDate()}
                defaultValue={editingCampaign?.scheduled_for?.split('T')[0]}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reschedule-time">New Time</Label>
              <Input
                id="reschedule-time"
                type="time"
                defaultValue={editingCampaign?.scheduled_for?.split('T')[1]?.slice(0, 5)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCampaign(null)}>
              Cancel
            </Button>
            <Button 
              className="bg-[#1e3a5f]"
              onClick={() => {
                const dateInput = document.getElementById('reschedule-date') as HTMLInputElement;
                const timeInput = document.getElementById('reschedule-time') as HTMLInputElement;
                if (dateInput?.value && timeInput?.value && editingCampaign) {
                  rescheduleCanpaign(editingCampaign, `${dateInput.value}T${timeInput.value}:00`);
                }
              }}
            >
              <CalendarClock className="w-4 h-4 mr-2" aria-hidden="true" />
              Update Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
