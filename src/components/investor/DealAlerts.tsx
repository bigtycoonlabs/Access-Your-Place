import { useState, useEffect } from 'react';
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
  CheckCircle, X, TrendingUp
} from 'lucide-react';

interface Props {
  investorId: string;
}

interface DealPreferences {
  id?: string;
  preferred_locations: string[];
  preferred_states: string[];
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  max_bedrooms?: number;
  operation_types: string[];
  property_types: string[];
  alerts_enabled: boolean;
  alert_frequency: 'instant' | 'daily' | 'weekly';
  email_alerts: boolean;
  sms_alerts: boolean;
  push_alerts: boolean;
}

interface AlertLog {
  id: string;
  property_id: string;
  alert_type: string;
  channels_sent: string[];
  match_score: number;
  match_details: any;
  sent_at: string;
  properties?: {
    city: string;
    state: string;
    bedrooms: number;
    bathrooms: number;
    price: number;
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
  { value: 'coliving', label: 'Co-Living' },
  { value: 'str', label: 'Short-Term Rental' },
  { value: 'mtr', label: 'Mid-Term Rental' },
  { value: 'ltr', label: 'Long-Term Rental' }
];

const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'condo', label: 'Condo' },
  { value: 'multi_family', label: 'Multi-Family' },
  { value: 'apartment', label: 'Apartment' }
];

export function DealAlerts({ investorId }: Props) {
  const [preferences, setPreferences] = useState<DealPreferences>({
    preferred_locations: [],
    preferred_states: [],
    operation_types: [],
    property_types: [],
    alerts_enabled: true,
    alert_frequency: 'instant',
    email_alerts: true,
    sms_alerts: false,
    push_alerts: true
  });
  const [alertHistory, setAlertHistory] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [activeTab, setActiveTab] = useState('preferences');
  const [previewMatches, setPreviewMatches] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
    fetchAlertHistory();
  }, [investorId]);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-alerts', {
        body: { action: 'get_preferences', investor_id: investorId }
      });
      if (data?.preferences) {
        setPreferences(data.preferences);
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
    setLoading(false);
  };

  const fetchAlertHistory = async () => {
    try {
      const { data } = await supabase.functions.invoke('manage-deal-alerts', {
        body: { action: 'get_alert_history', investor_id: investorId, limit: 20 }
      });
      setAlertHistory(data?.alerts || []);
    } catch (err) {
      console.error('Error fetching alert history:', err);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-alerts', {
        body: { 
          action: 'save_preferences', 
          investor_id: investorId,
          preferences
        }
      });

      if (data?.success) {
        toast({ title: 'Preferences Saved', description: 'Your deal alert preferences have been updated.' });
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const previewMatchingDeals = async () => {
    setLoadingPreview(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-alerts', {
        body: { 
          action: 'preview_matches', 
          investor_id: investorId,
          preferences
        }
      });
      setPreviewMatches(data?.matches || []);
    } catch (err) {
      console.error('Error previewing matches:', err);
    }
    setLoadingPreview(false);
  };

  const addLocation = () => {
    if (newLocation.trim() && !preferences.preferred_locations.includes(newLocation.trim())) {
      setPreferences({
        ...preferences,
        preferred_locations: [...preferences.preferred_locations, newLocation.trim()]
      });
      setNewLocation('');
    }
  };

  const removeLocation = (location: string) => {
    setPreferences({
      ...preferences,
      preferred_locations: preferences.preferred_locations.filter(l => l !== location)
    });
  };

  const toggleState = (state: string) => {
    const states = preferences.preferred_states.includes(state)
      ? preferences.preferred_states.filter(s => s !== state)
      : [...preferences.preferred_states, state];
    setPreferences({ ...preferences, preferred_states: states });
  };

  const toggleOperationType = (type: string) => {
    const types = preferences.operation_types.includes(type)
      ? preferences.operation_types.filter(t => t !== type)
      : [...preferences.operation_types, type];
    setPreferences({ ...preferences, operation_types: types });
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
            Deal Alerts
          </h2>
          <p className="text-sm text-gray-500">Get notified when properties match your criteria</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Alerts</span>
          <Switch
            checked={preferences.alerts_enabled}
            onCheckedChange={(checked) => setPreferences({ ...preferences, alerts_enabled: checked })}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Preferences
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

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
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
              {/* Cities */}
              <div>
                <Label htmlFor="preferred-cities">Preferred Cities</Label>
                <div className="flex gap-2 mt-2">
                  <Input id="preferred-cities"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Enter city name..."
                    onKeyPress={(e) => e.key === 'Enter' && addLocation()}
                  />
                  <Button onClick={addLocation} variant="outline">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {preferences.preferred_locations.map(loc => (
                    <Badge key={loc} variant="secondary" className="flex items-center gap-1">
                      {loc}
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-red-500" 
                        onClick={() => removeLocation(loc)}
                      />
                    </Badge>
                  ))}
                  {preferences.preferred_locations.length === 0 && (
                    <span className="text-sm text-gray-400">No cities added - you'll receive alerts for all cities</span>
                  )}
                </div>
              </div>

              {/* States */}
              <div>
                <Label>Preferred States</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {US_STATES.map(state => (
                    <Badge
                      key={state}
                      variant={preferences.preferred_states.includes(state) ? 'default' : 'outline'}
                      className={`cursor-pointer ${preferences.preferred_states.includes(state) ? 'bg-[#1a365d]' : ''}`}
                      onClick={() => toggleState(state)}
                    >
                      {state}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price & Size Preferences */}
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
                  <Label htmlFor="minimum-price">Minimum Price</Label>
                  <Input id="minimum-price"
                    type="number"
                    value={preferences.min_price || ''}
                    onChange={(e) => setPreferences({ ...preferences, min_price: parseInt(e.target.value) || undefined })}
                    placeholder="No minimum"
                  />
                </div>
                <div>
                  <Label htmlFor="maximum-price">Maximum Price</Label>
                  <Input id="maximum-price"
                    type="number"
                    value={preferences.max_price || ''}
                    onChange={(e) => setPreferences({ ...preferences, max_price: parseInt(e.target.value) || undefined })}
                    placeholder="No maximum"
                  />
                </div>
                <div>
                  <Label>Minimum Bedrooms</Label>
                  <Select
                    value={preferences.min_bedrooms?.toString() || ''}
                    onValueChange={(v) => setPreferences({ ...preferences, min_bedrooms: parseInt(v) || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}+</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Maximum Bedrooms</Label>
                  <Select
                    value={preferences.max_bedrooms?.toString() || ''}
                    onValueChange={(v) => setPreferences({ ...preferences, max_bedrooms: parseInt(v) || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operation Type Preferences */}
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
                    variant={preferences.operation_types.includes(type.value) ? 'default' : 'outline'}
                    className={`cursor-pointer ${preferences.operation_types.includes(type.value) ? 'bg-[#1a365d]' : ''}`}
                    onClick={() => toggleOperationType(type.value)}
                  >
                    {type.label}
                  </Badge>
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
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>Email Notifications</span>
                </div>
                <Switch
                  checked={preferences.email_alerts}
                  onCheckedChange={(checked) => setPreferences({ ...preferences, email_alerts: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <span>SMS Text Messages</span>
                </div>
                <Switch
                  checked={preferences.sms_alerts}
                  onCheckedChange={(checked) => setPreferences({ ...preferences, sms_alerts: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-gray-500" />
                  <span>Push Notifications</span>
                </div>
                <Switch
                  checked={preferences.push_alerts}
                  onCheckedChange={(checked) => setPreferences({ ...preferences, push_alerts: checked })}
                />
              </div>
              <div>
                <Label>Alert Frequency</Label>
                <Select
                  value={preferences.alert_frequency}
                  onValueChange={(v: 'instant' | 'daily' | 'weekly') => setPreferences({ ...preferences, alert_frequency: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant (as properties are added)</SelectItem>
                    <SelectItem value="daily">Daily Digest</SelectItem>
                    <SelectItem value="weekly">Weekly Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={previewMatchingDeals}>
              Preview Matches
            </Button>
            <Button 
              onClick={savePreferences}
              disabled={saving}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Preferences
            </Button>
          </div>
        </TabsContent>

        {/* Preview Matches Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#d4a574]" />
                Matching Properties
              </CardTitle>
              <CardDescription>
                Properties currently available that match your preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={previewMatchingDeals} 
                disabled={loadingPreview}
                className="mb-4"
              >
                {loadingPreview && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Refresh Matches
              </Button>

              {previewMatches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium">No matching properties found</p>
                  <p className="text-sm">Try adjusting your preferences or check back later</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {previewMatches.map((match, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Home className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {match.property.city}, {match.property.state}
                          </p>
                          <p className="text-sm text-gray-500">
                            {match.property.bedrooms} bed / {match.property.bathrooms} bath
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={match.match_score >= 70 ? 'bg-green-500' : 'bg-yellow-500'}>
                          {match.match_score}% Match
                        </Badge>
                        {match.property.price && (
                          <p className="text-sm text-gray-500 mt-1">
                            ${match.property.price.toLocaleString()}
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

        {/* Alert History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#d4a574]" />
                Alert History
              </CardTitle>
              <CardDescription>Recent deal alerts you've received</CardDescription>
            </CardHeader>
            <CardContent>
              {alertHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium">No alerts yet</p>
                  <p className="text-sm">You'll see your deal alerts here once you start receiving them</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertHistory.map(alert => (
                    <div 
                      key={alert.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <BellRing className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {alert.properties?.city}, {alert.properties?.state}
                          </p>
                          <p className="text-sm text-gray-500">
                            {alert.properties?.bedrooms} bed / {alert.properties?.bathrooms} bath
                          </p>
                          <div className="flex gap-1 mt-1">
                            {alert.channels_sent.map(channel => (
                              <Badge key={channel} variant="outline" className="text-xs">
                                {channel}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-[#1a365d]">
                          {alert.match_score}% Match
                        </Badge>
                        <p className="text-xs text-gray-400 mt-2">
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
