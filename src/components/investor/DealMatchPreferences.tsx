import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Bell, BellRing, MapPin, DollarSign, Home, Building2,
  Mail, MessageSquare, Smartphone, Settings, History, Sparkles,
  CheckCircle, X, TrendingUp, Target, Zap, Brain, AlertTriangle,
  Star, Filter, Eye, Clock
} from 'lucide-react';

interface Props {
  investorId: string;
}

interface DealPreference {
  id?: string;
  preference_name: string;
  target_markets: string[];
  min_budget: number | null;
  max_budget: number | null;
  operation_types: string[];
  property_types: string[];
  min_bedrooms: number | null;
  max_bedrooms: number | null;
  min_penny_score: number;
  min_cap_rate: number | null;
  must_have_features: string[];
  deal_breakers: string[];
  notification_email: boolean;
  notification_sms: boolean;
  notification_push: boolean;
  is_active: boolean;
}

interface MatchHistory {
  id: string;
  property_id: string;
  match_score: number;
  match_reasons: string[];
  penny_score: number;
  notification_sent_email: boolean;
  notification_sent_sms: boolean;
  investor_action: string | null;
  created_at: string;
  properties?: {
    address: string;
    city: string;
    state: string;
    price: number;
    bedrooms: number;
  };
}

const MARKETS = [
  'Austin, TX', 'Nashville, TN', 'Tampa, FL', 'Orlando, FL', 
  'Phoenix, AZ', 'Dallas, TX', 'Miami, FL', 'Denver, CO',
  'Atlanta, GA', 'Charlotte, NC', 'San Antonio, TX', 'Jacksonville, FL',
  'Houston, TX', 'San Diego, CA', 'Los Angeles, CA', 'Seattle, WA'
];

const OPERATION_TYPES = [
  { value: 'STR', label: 'Short-Term Rental (STR)' },
  { value: 'MTR', label: 'Mid-Term Rental (MTR)' },
  { value: 'Co-living', label: 'Co-Living / Roommate' },
  { value: 'LTR', label: 'Long-Term Rental (LTR)' },
  { value: 'Hybrid', label: 'Hybrid Strategy' }
];

const PROPERTY_TYPES = [
  { value: 'Single Family', label: 'Single Family Home' },
  { value: 'Townhouse', label: 'Townhouse' },
  { value: 'Condo', label: 'Condo' },
  { value: 'Multi-Family', label: 'Multi-Family (2-4 units)' },
  { value: 'Apartment', label: 'Apartment' }
];

const FEATURES = [
  'Pool', 'Hot Tub', 'Garage', 'Fenced Yard', 'Pet Friendly',
  'Near Downtown', 'Near Airport', 'Near Beach', 'Mountain Views',
  'Recently Renovated', 'Smart Home', 'EV Charging'
];

const DEAL_BREAKERS = [
  'HOA Restrictions', 'Flood Zone', 'High Crime Area', 
  'Major Repairs Needed', 'STR Banned', 'Shared Walls'
];

export function DealMatchPreferences({ investorId }: Props) {
  const [preferences, setPreferences] = useState<DealPreference[]>([]);
  const [currentPreference, setCurrentPreference] = useState<DealPreference>({
    preference_name: 'My Deal Criteria',
    target_markets: [],
    min_budget: null,
    max_budget: null,
    operation_types: [],
    property_types: [],
    min_bedrooms: null,
    max_bedrooms: null,
    min_penny_score: 70,
    min_cap_rate: null,
    must_have_features: [],
    deal_breakers: [],
    notification_email: true,
    notification_sms: false,
    notification_push: true,
    is_active: true
  });
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('criteria');
  const [newMarket, setNewMarket] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
    fetchMatchHistory();
  }, [investorId]);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('intelligent-deal-matching', {
        body: { action: 'get_preferences', investor_id: investorId }
      });
      if (data?.success && data.data?.length > 0) {
        setPreferences(data.data);
        setCurrentPreference(data.data[0]);
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
    setLoading(false);
  };

  const fetchMatchHistory = async () => {
    try {
      const { data } = await supabase.functions.invoke('intelligent-deal-matching', {
        body: { action: 'get_match_history', investor_id: investorId }
      });
      if (data?.success) {
        setMatchHistory(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching match history:', err);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('intelligent-deal-matching', {
        body: { 
          action: 'save_preferences', 
          investor_id: investorId,
          preferences: currentPreference
        }
      });

      if (data?.success) {
        toast({ 
          title: 'Preferences Saved', 
          description: 'Your deal matching criteria has been updated. You\'ll be notified when matching deals are found.' 
        });
        fetchPreferences();
      } else {
        throw new Error(data?.error || 'Failed to save preferences');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const toggleMarket = (market: string) => {
    const markets = currentPreference.target_markets.includes(market)
      ? currentPreference.target_markets.filter(m => m !== market)
      : [...currentPreference.target_markets, market];
    setCurrentPreference({ ...currentPreference, target_markets: markets });
  };

  const toggleOperationType = (type: string) => {
    const types = currentPreference.operation_types.includes(type)
      ? currentPreference.operation_types.filter(t => t !== type)
      : [...currentPreference.operation_types, type];
    setCurrentPreference({ ...currentPreference, operation_types: types });
  };

  const togglePropertyType = (type: string) => {
    const types = currentPreference.property_types.includes(type)
      ? currentPreference.property_types.filter(t => t !== type)
      : [...currentPreference.property_types, type];
    setCurrentPreference({ ...currentPreference, property_types: types });
  };

  const toggleFeature = (feature: string) => {
    const features = currentPreference.must_have_features.includes(feature)
      ? currentPreference.must_have_features.filter(f => f !== feature)
      : [...currentPreference.must_have_features, feature];
    setCurrentPreference({ ...currentPreference, must_have_features: features });
  };

  const toggleDealBreaker = (breaker: string) => {
    const breakers = currentPreference.deal_breakers.includes(breaker)
      ? currentPreference.deal_breakers.filter(b => b !== breaker)
      : [...currentPreference.deal_breakers, breaker];
    setCurrentPreference({ ...currentPreference, deal_breakers: breakers });
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
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
            <Brain className="w-6 h-6 text-[#d4a574]" />
            Intelligent Deal Matching
          </h2>
          <p className="text-sm text-gray-500">
            Penny AI will automatically find and notify you of matching deals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Active</span>
          <Switch
            checked={currentPreference.is_active}
            onCheckedChange={(checked) => setCurrentPreference({ ...currentPreference, is_active: checked })}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{currentPreference.target_markets.length}</p>
                <p className="text-sm text-blue-600">Target Markets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{matchHistory.length}</p>
                <p className="text-sm text-green-600">Deals Matched</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{currentPreference.min_penny_score}+</p>
                <p className="text-sm text-purple-600">Min Penny Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">
                  {[currentPreference.notification_email, currentPreference.notification_sms, currentPreference.notification_push].filter(Boolean).length}
                </p>
                <p className="text-sm text-orange-600">Alert Channels</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="criteria" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Criteria
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Criteria Tab */}
        <TabsContent value="criteria" className="space-y-6 mt-6">
          {/* Target Markets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-[#d4a574]" />
                Target Markets
              </CardTitle>
              <CardDescription>Select the markets you want to invest in</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {MARKETS.map(market => (
                  <Badge
                    key={market}
                    variant={currentPreference.target_markets.includes(market) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all ${
                      currentPreference.target_markets.includes(market) 
                        ? 'bg-[#1a365d] hover:bg-[#2a466d]' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => toggleMarket(market)}
                  >
                    {market}
                  </Badge>
                ))}
              </div>
              {currentPreference.target_markets.length === 0 && (
                <p className="text-sm text-gray-400 mt-3">
                  No markets selected - you'll receive alerts for all markets
                </p>
              )}
            </CardContent>
          </Card>

          {/* Budget Range */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="w-5 h-5 text-[#d4a574]" />
                Budget Range
              </CardTitle>
              <CardDescription>Set your investment budget range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minimum-budget">Minimum Budget</Label>
                  <Input id="minimum-budget"
                    type="number"
                    value={currentPreference.min_budget || ''}
                    onChange={(e) => setCurrentPreference({ 
                      ...currentPreference, 
                      min_budget: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    placeholder="No minimum"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="maximum-budget">Maximum Budget</Label>
                  <Input id="maximum-budget"
                    type="number"
                    value={currentPreference.max_budget || ''}
                    onChange={(e) => setCurrentPreference({ 
                      ...currentPreference, 
                      max_budget: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    placeholder="No maximum"
                    className="mt-1"
                  />
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
              <CardDescription>What type of rental operation are you interested in?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {OPERATION_TYPES.map(type => (
                  <div
                    key={type.value}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      currentPreference.operation_types.includes(type.value)
                        ? 'border-[#d4a574] bg-[#d4a574]/10'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => toggleOperationType(type.value)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={currentPreference.operation_types.includes(type.value)}
                        className="pointer-events-none"
                      />
                      <span className="text-sm font-medium">{type.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Property Types & Bedrooms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Home className="w-5 h-5 text-[#d4a574]" />
                Property Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Property Types</Label>
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_TYPES.map(type => (
                    <Badge
                      key={type.value}
                      variant={currentPreference.property_types.includes(type.value) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        currentPreference.property_types.includes(type.value) ? 'bg-[#1a365d]' : ''
                      }`}
                      onClick={() => togglePropertyType(type.value)}
                    >
                      {type.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Minimum Bedrooms</Label>
                  <Select
                    value={currentPreference.min_bedrooms?.toString() || ''}
                    onValueChange={(v) => setCurrentPreference({ 
                      ...currentPreference, 
                      min_bedrooms: v ? parseInt(v) : null 
                    })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}+ bedrooms</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Maximum Bedrooms</Label>
                  <Select
                    value={currentPreference.max_bedrooms?.toString() || ''}
                    onValueChange={(v) => setCurrentPreference({ 
                      ...currentPreference, 
                      max_bedrooms: v ? parseInt(v) : null 
                    })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {[2, 3, 4, 5, 6, 7, 8].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n} bedrooms</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Penny Score Threshold */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-[#d4a574]" />
                Minimum Penny Score
              </CardTitle>
              <CardDescription>
                Only get notified about deals that meet your quality threshold
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Minimum Score</span>
                  <span className="text-2xl font-bold text-[#d4a574]">
                    {currentPreference.min_penny_score}
                  </span>
                </div>
                <Slider
                  value={[currentPreference.min_penny_score]}
                  onValueChange={(value) => setCurrentPreference({ 
                    ...currentPreference, 
                    min_penny_score: value[0] 
                  })}
                  min={50}
                  max={95}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>50 (More deals)</span>
                  <span>95 (Only top deals)</span>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> A score of 70+ typically indicates a solid investment opportunity. 
                    80+ is excellent, and 90+ is exceptional.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features & Deal Breakers */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Must-Have Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {FEATURES.map(feature => (
                    <Badge
                      key={feature}
                      variant={currentPreference.must_have_features.includes(feature) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        currentPreference.must_have_features.includes(feature) ? 'bg-green-500' : ''
                      }`}
                      onClick={() => toggleFeature(feature)}
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Deal Breakers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {DEAL_BREAKERS.map(breaker => (
                    <Badge
                      key={breaker}
                      variant={currentPreference.deal_breakers.includes(breaker) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        currentPreference.deal_breakers.includes(breaker) ? 'bg-red-500' : ''
                      }`}
                      onClick={() => toggleDealBreaker(breaker)}
                    >
                      {breaker}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={savePreferences}
              disabled={saving}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Matching Criteria
            </Button>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#d4a574]" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose how you want to be notified when matching deals are found
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-gray-500">Get detailed deal alerts via email</p>
                    </div>
                  </div>
                  <Switch
                    checked={currentPreference.notification_email}
                    onCheckedChange={(checked) => setCurrentPreference({ 
                      ...currentPreference, 
                      notification_email: checked 
                    })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">SMS Text Messages</p>
                      <p className="text-sm text-gray-500">Receive instant text alerts for hot deals</p>
                    </div>
                  </div>
                  <Switch
                    checked={currentPreference.notification_sms}
                    onCheckedChange={(checked) => setCurrentPreference({ 
                      ...currentPreference, 
                      notification_sms: checked 
                    })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Smartphone className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">In-App Notifications</p>
                      <p className="text-sm text-gray-500">See alerts in your investor portal</p>
                    </div>
                  </div>
                  <Switch
                    checked={currentPreference.notification_push}
                    onCheckedChange={(checked) => setCurrentPreference({ 
                      ...currentPreference, 
                      notification_push: checked 
                    })}
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Instant Notifications</p>
                    <p className="text-sm text-amber-700">
                      You'll be notified immediately when a new property matching your criteria is published. 
                      Be among the first to see new opportunities!
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={savePreferences}
                  disabled={saving}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Notification Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#d4a574]" />
                Match History
              </CardTitle>
              <CardDescription>
                Properties that matched your criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              {matchHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-gray-500">No matches yet</p>
                  <p className="text-sm text-gray-400">
                    When properties match your criteria, they'll appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchHistory.map((match) => (
                    <div 
                      key={match.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${getMatchScoreColor(match.match_score)} bg-opacity-20`}>
                          <Home className="w-5 h-5 text-gray-700" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {match.properties?.address || 'Property'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {match.properties?.city}, {match.properties?.state} • {match.properties?.bedrooms} bed
                          </p>
                          <div className="flex gap-1 mt-1">
                            {match.notification_sent_email && (
                              <Badge variant="outline" className="text-xs">
                                <Mail className="w-3 h-3 mr-1" />
                                Email
                              </Badge>
                            )}
                            {match.notification_sent_sms && (
                              <Badge variant="outline" className="text-xs">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                SMS
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getMatchScoreColor(match.match_score)}>
                          {match.match_score}% Match
                        </Badge>
                        {match.penny_score && (
                          <p className="text-sm text-[#d4a574] font-medium mt-1">
                            Penny Score: {match.penny_score}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(match.created_at).toLocaleDateString()}
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
