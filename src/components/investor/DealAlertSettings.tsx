import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Bell, BellRing, MapPin, DollarSign, Home, Building2,
  Mail, MessageSquare, Smartphone, Settings, History, Sparkles,
  CheckCircle, X, TrendingUp, Clock, Zap, Calendar, Eye,
  RefreshCw, Shield, ArrowRight
} from 'lucide-react';

interface Props {
  investorId: string;
  investorEmail?: string;
  onNavigate?: (tab: string) => void;
}

interface AlertSettings {
  preferred_locations: string[];
  preferred_states: string[];
  min_price?: number | null;
  max_price?: number | null;
  min_bedrooms?: number | null;
  max_bedrooms?: number | null;
  operation_types: string[];
  property_types: string[];
  alerts_enabled: boolean;
  alert_frequency: 'instant' | 'daily' | 'weekly';
  email_alerts: boolean;
  sms_alerts: boolean;
  push_alerts: boolean;
  last_alert_sent?: string | null;
  last_digest_sent?: string | null;
}

interface AlertLog {
  id: string;
  property_id: string;
  alert_type: string;
  channels_sent: string[];
  match_score: number;
  match_details: any;
  sent_at: string;
  property?: {
    city: string;
    state: string;
    bedrooms: number;
    bathrooms: number;
    price: number;
    monthly_rent: number;
    operation_type: string;
    penny_score: number;
    listing_title: string;
    title: string;
  };
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const OPERATION_TYPES = [
  { value: 'rental_arbitrage', label: 'Rental Arbitrage' },
  { value: 'STR', label: 'Short-Term Rental (STR)' },
  { value: 'MTR', label: 'Mid-Term Rental (MTR)' },
  { value: 'Co-living', label: 'Co-Living' },
  { value: 'LTR', label: 'Long-Term Rental (LTR)' },
  { value: 'Hybrid', label: 'Hybrid Strategy' }
];

const PROPERTY_TYPES = [
  { value: 'Single Family', label: 'Single Family Home' },
  { value: 'Townhouse', label: 'Townhouse' },
  { value: 'Condo', label: 'Condo' },
  { value: 'Multi-Family', label: 'Multi-Family' },
  { value: 'Apartment', label: 'Apartment' }
];

const FREQUENCY_OPTIONS = [
  { 
    value: 'instant', 
    label: 'Instant', 
    description: 'Get notified immediately when a matching deal is published',
    icon: <Zap className="w-5 h-5 text-amber-500" />
  },
  { 
    value: 'daily', 
    label: 'Daily Digest', 
    description: 'Receive a summary of matching deals once per day',
    icon: <Calendar className="w-5 h-5 text-blue-500" />
  },
  { 
    value: 'weekly', 
    label: 'Weekly Summary', 
    description: 'Get a weekly roundup of all matching deals',
    icon: <Clock className="w-5 h-5 text-purple-500" />
  }
];

export function DealAlertSettings({ investorId, investorEmail, onNavigate }: Props) {
  const [settings, setSettings] = useState<AlertSettings>({
    preferred_locations: [],
    preferred_states: [],
    min_price: null,
    max_price: null,
    min_bedrooms: null,
    max_bedrooms: null,
    operation_types: [],
    property_types: [],
    alerts_enabled: true,
    alert_frequency: 'instant',
    email_alerts: true,
    sms_alerts: false,
    push_alerts: true
  });
  const [alertHistory, setAlertHistory] = useState<AlertLog[]>([]);
  const [previewMatches, setPreviewMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [activeTab, setActiveTab] = useState('settings');
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('check-deal-alerts', {
        body: { action: 'get_alert_settings', investor_id: investorId }
      });
      if (data?.success && data.settings) {
        setSettings({
          preferred_locations: data.settings.preferred_locations || [],
          preferred_states: data.settings.preferred_states || [],
          min_price: data.settings.min_price,
          max_price: data.settings.max_price,
          min_bedrooms: data.settings.min_bedrooms,
          max_bedrooms: data.settings.max_bedrooms,
          operation_types: data.settings.operation_types || [],
          property_types: data.settings.property_types || [],
          alerts_enabled: data.settings.alerts_enabled !== false,
          alert_frequency: data.settings.alert_frequency || 'instant',
          email_alerts: data.settings.email_alerts !== false,
          sms_alerts: data.settings.sms_alerts === true,
          push_alerts: data.settings.push_alerts !== false,
          last_alert_sent: data.settings.last_alert_sent,
          last_digest_sent: data.settings.last_digest_sent
        });
      }
    } catch (err) {
      console.error('Error fetching alert settings:', err);
    }
    setLoading(false);
  }, [investorId]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase.functions.invoke('check-deal-alerts', {
        body: { action: 'get_alert_history', investor_id: investorId, limit: 30 }
      });
      if (data?.success) {
        setAlertHistory(data.alerts || []);
      }
    } catch (err) {
      console.error('Error fetching alert history:', err);
    }
    setLoadingHistory(false);
  }, [investorId]);

  useEffect(() => {
    fetchSettings();
    fetchHistory();
  }, [fetchSettings, fetchHistory]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.functions.invoke('check-deal-alerts', {
        body: { 
          action: 'save_alert_settings', 
          investor_id: investorId,
          settings
        }
      });

      if (data?.success) {
        toast({ 
          title: 'Alert Settings Saved', 
          description: `You'll receive ${settings.alert_frequency} alerts when matching deals are published.`
        });
      } else {
        throw new Error(data?.error || 'Failed to save settings');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const previewMatchingDeals = async () => {
    setLoadingPreview(true);
    try {
      const { data } = await supabase.functions.invoke('check-deal-alerts', {
        body: { 
          action: 'preview_matches', 
          investor_id: investorId,
          settings
        }
      });
      setPreviewMatches(data?.matches || []);
      if (data?.matches?.length === 0) {
        toast({ 
          title: 'No Matches Found', 
          description: 'Try broadening your criteria to match more properties.' 
        });
      }
    } catch (err) {
      console.error('Error previewing matches:', err);
      toast({ title: 'Error', description: 'Failed to preview matches', variant: 'destructive' });
    }
    setLoadingPreview(false);
  };

  const addLocation = () => {
    const loc = newLocation.trim();
    if (loc && !settings.preferred_locations.includes(loc)) {
      setSettings({
        ...settings,
        preferred_locations: [...settings.preferred_locations, loc]
      });
      setNewLocation('');
    }
  };

  const removeLocation = (location: string) => {
    setSettings({
      ...settings,
      preferred_locations: settings.preferred_locations.filter(l => l !== location)
    });
  };

  const toggleState = (state: string) => {
    const states = settings.preferred_states.includes(state)
      ? settings.preferred_states.filter(s => s !== state)
      : [...settings.preferred_states, state];
    setSettings({ ...settings, preferred_states: states });
  };

  const toggleOperationType = (type: string) => {
    const types = settings.operation_types.includes(type)
      ? settings.operation_types.filter(t => t !== type)
      : [...settings.operation_types, type];
    setSettings({ ...settings, operation_types: types });
  };

  const togglePropertyType = (type: string) => {
    const types = settings.property_types.includes(type)
      ? settings.property_types.filter(t => t !== type)
      : [...settings.property_types, type];
    setSettings({ ...settings, property_types: types });
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-700 border-green-200';
    if (score >= 60) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BellRing className="w-6 h-6 text-[#d4a574]" />
            Deal Alert Settings
          </h2>
          <p className="text-sm text-gray-500">
            Get notified when properties matching your criteria are published
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Alerts {settings.alerts_enabled ? 'Active' : 'Paused'}</span>
          <Switch
            checked={settings.alerts_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, alerts_enabled: checked })}
          />
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`${settings.alerts_enabled ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${settings.alerts_enabled ? 'bg-green-500' : 'bg-gray-400'}`}>
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className={`text-lg font-bold ${settings.alerts_enabled ? 'text-green-700' : 'text-gray-500'}`}>
                  {settings.alerts_enabled ? 'Active' : 'Paused'}
                </p>
                <p className="text-sm text-gray-500">Alert Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-blue-700 capitalize">{settings.alert_frequency}</p>
                <p className="text-sm text-gray-500">Frequency</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-purple-700">
                  {settings.preferred_locations.length + settings.preferred_states.length}
                </p>
                <p className="text-sm text-gray-500">Locations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-700">{alertHistory.length}</p>
                <p className="text-sm text-gray-500">Alerts Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white shadow">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Alert Settings
          </TabsTrigger>
          <TabsTrigger value="criteria" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Matching Criteria
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Preview Matches
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Alert History
          </TabsTrigger>
        </TabsList>

        {/* ===== SETTINGS TAB ===== */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          {/* Alert Frequency */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5 text-[#d4a574]" />
                Alert Frequency
              </CardTitle>
              <CardDescription>
                Choose how often you want to receive deal alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {FREQUENCY_OPTIONS.map(option => (
                  <div
                    key={option.value}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      settings.alert_frequency === option.value
                        ? 'border-[#d4a574] bg-[#d4a574]/5 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSettings({ ...settings, alert_frequency: option.value as any })}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {option.icon}
                      <span className="font-semibold text-gray-900">{option.label}</span>
                    </div>
                    <p className="text-sm text-gray-500">{option.description}</p>
                    {settings.alert_frequency === option.value && (
                      <div className="mt-3 flex items-center gap-1 text-[#d4a574] text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notification Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5 text-[#d4a574]" />
                Notification Channels
              </CardTitle>
              <CardDescription>
                Choose how you want to be notified about matching deals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Email Notifications</p>
                    <p className="text-sm text-gray-500">
                      Detailed deal alerts sent to {investorEmail || 'your email'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.email_alerts}
                  onCheckedChange={(checked) => setSettings({ ...settings, email_alerts: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">SMS Text Messages</p>
                    <p className="text-sm text-gray-500">Quick text alerts for high-match deals</p>
                  </div>
                </div>
                <Switch
                  checked={settings.sms_alerts}
                  onCheckedChange={(checked) => setSettings({ ...settings, sms_alerts: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Smartphone className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">In-App Notifications</p>
                    <p className="text-sm text-gray-500">See alerts in your portal notification center</p>
                  </div>
                </div>
                <Switch
                  checked={settings.push_alerts}
                  onCheckedChange={(checked) => setSettings({ ...settings, push_alerts: checked })}
                />
              </div>

              {settings.alert_frequency === 'instant' && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Instant Mode Active</p>
                      <p className="text-sm text-amber-700">
                        You'll be notified immediately when a new property matching your criteria is published. 
                        Be among the first to see new opportunities!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {settings.last_alert_sent && (
                <p className="text-xs text-gray-400 text-right">
                  Last alert sent: {new Date(settings.last_alert_sent).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={saveSettings}
              disabled={saving}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Alert Settings
            </Button>
          </div>
        </TabsContent>

        {/* ===== CRITERIA TAB ===== */}
        <TabsContent value="criteria" className="space-y-6 mt-6">
          {/* Location Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-[#d4a574]" />
                Location Preferences
              </CardTitle>
              <CardDescription>Specify cities and states you're interested in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Preferred Cities</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Enter city name (e.g., Austin, Nashville)..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
                  />
                  <Button onClick={addLocation} variant="outline">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {settings.preferred_locations.map(loc => (
                    <Badge key={loc} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                      <MapPin className="w-3 h-3" />
                      {loc}
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-red-500 ml-1" 
                        onClick={() => removeLocation(loc)}
                      />
                    </Badge>
                  ))}
                  {settings.preferred_locations.length === 0 && (
                    <span className="text-sm text-gray-400">No cities added — alerts will match all cities</span>
                  )}
                </div>
              </div>

              <div>
                <Label>Preferred States</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {US_STATES.map(state => (
                    <Badge
                      key={state}
                      variant={settings.preferred_states.includes(state) ? 'default' : 'outline'}
                      className={`cursor-pointer text-xs ${
                        settings.preferred_states.includes(state) 
                          ? 'bg-[#1a365d] hover:bg-[#2a466d]' 
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => toggleState(state)}
                    >
                      {state}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price & Size */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="w-5 h-5 text-[#d4a574]" />
                Price & Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Minimum Price / Rent</Label>
                  <Input
                    type="number"
                    value={settings.min_price || ''}
                    onChange={(e) => setSettings({ ...settings, min_price: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="No minimum"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Maximum Price / Rent</Label>
                  <Input
                    type="number"
                    value={settings.max_price || ''}
                    onChange={(e) => setSettings({ ...settings, max_price: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="No maximum"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Minimum Bedrooms</Label>
                  <Select
                    value={settings.min_bedrooms?.toString() || ''}
                    onValueChange={(v) => setSettings({ ...settings, min_bedrooms: v ? parseInt(v) : null })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}+</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Maximum Bedrooms</Label>
                  <Select
                    value={settings.max_bedrooms?.toString() || ''}
                    onValueChange={(v) => setSettings({ ...settings, max_bedrooms: v ? parseInt(v) : null })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      {[2, 3, 4, 5, 6, 7, 8].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operation Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-[#d4a574]" />
                Operation Types
              </CardTitle>
              <CardDescription>Select the types of operations you're interested in</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {OPERATION_TYPES.map(type => (
                  <Badge
                    key={type.value}
                    variant={settings.operation_types.includes(type.value) ? 'default' : 'outline'}
                    className={`cursor-pointer px-3 py-1.5 ${
                      settings.operation_types.includes(type.value) 
                        ? 'bg-[#1a365d] hover:bg-[#2a466d]' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => toggleOperationType(type.value)}
                  >
                    {type.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Property Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Home className="w-5 h-5 text-[#d4a574]" />
                Property Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map(type => (
                  <Badge
                    key={type.value}
                    variant={settings.property_types.includes(type.value) ? 'default' : 'outline'}
                    className={`cursor-pointer px-3 py-1.5 ${
                      settings.property_types.includes(type.value) 
                        ? 'bg-[#1a365d] hover:bg-[#2a466d]' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => togglePropertyType(type.value)}
                  >
                    {type.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={previewMatchingDeals} disabled={loadingPreview}>
              {loadingPreview && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Eye className="w-4 h-4 mr-2" />
              Preview Matches
            </Button>
            <Button 
              onClick={saveSettings}
              disabled={saving}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save All Settings
            </Button>
          </div>
        </TabsContent>

        {/* ===== PREVIEW TAB ===== */}
        <TabsContent value="preview" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#d4a574]" />
                    Preview Matching Properties
                  </CardTitle>
                  <CardDescription>
                    See which currently published properties match your alert criteria
                  </CardDescription>
                </div>
                <Button 
                  onClick={previewMatchingDeals} 
                  disabled={loadingPreview}
                  variant="outline"
                >
                  {loadingPreview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPreview ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
                </div>
              ) : previewMatches.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-gray-500">No matching properties found</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Click "Refresh" to check current listings, or adjust your criteria
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab('criteria')}>
                    Adjust Criteria
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {previewMatches.map((match: any, idx: number) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Home className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {match.property?.listing_title || match.property?.title || `${match.property?.city}, ${match.property?.state}`}
                          </p>
                          <p className="text-sm text-gray-500">
                            {match.property?.city}, {match.property?.state} {match.property?.zip_code || ''} — {match.property?.bedrooms || '?'} BR / {match.property?.bathrooms || '?'} BA
                          </p>
                          {match.reasons?.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              {match.reasons.slice(0, 2).join(' | ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <Badge className={getMatchScoreColor(match.score)}>
                          {match.score}% Match
                        </Badge>
                        {match.property?.penny_score && (
                          <p className="text-sm text-[#d4a574] font-medium mt-1">
                            Penny: {match.property.penny_score}
                          </p>
                        )}
                        {match.property?.monthly_rent && (
                          <p className="text-xs text-gray-400 mt-1">
                            ${match.property.monthly_rent.toLocaleString()}/mo
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== HISTORY TAB ===== */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[#d4a574]" />
                    Alert History
                  </CardTitle>
                  <CardDescription>Recent deal alerts you've received</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loadingHistory}>
                  {loadingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
                </div>
              ) : alertHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-gray-500">No alerts sent yet</p>
                  <p className="text-sm text-gray-400">
                    You'll see your deal alert history here once matching properties are published
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertHistory.map(alert => (
                    <div 
                      key={alert.id}
                      className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          alert.alert_type === 'instant' ? 'bg-amber-100' : 'bg-blue-100'
                        }`}>
                          {alert.alert_type === 'instant' ? (
                            <Zap className="w-5 h-5 text-amber-600" />
                          ) : (
                            <Calendar className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {alert.property?.listing_title || alert.property?.title || `${alert.property?.city || 'Unknown'}, ${alert.property?.state || ''}`}
                          </p>
                          <p className="text-sm text-gray-500">
                            {alert.property?.city}, {alert.property?.state} — {alert.property?.bedrooms || '?'} BR
                          </p>
                          <div className="flex gap-1 mt-1">
                            {alert.channels_sent?.map((channel: string) => (
                              <Badge key={channel} variant="outline" className="text-xs capitalize">
                                {channel === 'email' && <Mail className="w-3 h-3 mr-1" />}
                                {channel === 'sms' && <MessageSquare className="w-3 h-3 mr-1" />}
                                {channel}
                              </Badge>
                            ))}
                            <Badge variant="outline" className="text-xs capitalize">
                              {alert.alert_type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <Badge className={getMatchScoreColor(alert.match_score || 0)}>
                          {alert.match_score || 0}% Match
                        </Badge>
                        <p className="text-xs text-gray-400 mt-2 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.sent_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
