import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertTriangle, Bell, TrendingUp, FileText, MapPin, 
  RefreshCw, ExternalLink, ChevronRight, Shield, Plane,
  Building2, Filter, CheckCircle2, Clock, Settings,
  Mail, Smartphone, Loader2, Calendar, DollarSign,
  BarChart3, Target, Hotel
} from 'lucide-react';

interface MarketAlert {
  id: string;
  type: 'regulation' | 'market_update' | 'travel_trend' | 'seasonality';
  severity: 'low' | 'medium' | 'high';
  market: string;
  title: string;
  description: string;
  recommendation: string;
  created_at: string;
  read?: boolean;
}

interface AlertPreferences {
  regulation_alerts: boolean;
  market_updates: boolean;
  travel_trends: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
}


interface MarketAlertsDashboardProps {
  investorId: string;
  investorEmail?: string;
  investorPhone?: string;
}

export function MarketAlertsDashboard({ investorId, investorEmail, investorPhone }: MarketAlertsDashboardProps) {
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [portfolioMarkets, setPortfolioMarkets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'regulation' | 'market_update' | 'travel_trend'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [showSettingsTab, setShowSettingsTab] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [preferences, setPreferences] = useState<AlertPreferences>({
    regulation_alerts: true,
    market_updates: true,
    travel_trends: true,
    email_notifications: true,
    sms_notifications: false,
    frequency: 'daily'
  });
  const { toast } = useToast();

  const fetchAlerts = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-investor-chat', {
        body: {
          action: 'get_market_alerts',
          investor_id: investorId
        }
      });

      if (error) throw error;

      if (data?.success) {
        setAlerts(data.alerts || []);
        setPortfolioMarkets(data.portfolio_markets || []);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      toast({
        title: 'Error',
        description: 'Failed to load market alerts. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [investorId, toast]);

  const loadPreferences = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('investor-email-notifications', {
        body: {
          action: 'get_preferences',
          investor_id: investorId
        }
      });

      if (data?.preferences) {
        setPreferences(prev => ({
          ...prev,
          ...data.preferences
        }));
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  }, [investorId]);

  useEffect(() => {
    fetchAlerts();
    loadPreferences();
  }, [fetchAlerts, loadPreferences]);

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-email-notifications', {
        body: {
          action: 'update_preferences',
          investor_id: investorId,
          preferences: {
            alert_preferences: preferences
          }
        }
      });

      if (error) throw error;

      toast({
        title: 'Preferences Saved',
        description: 'Your alert notification preferences have been updated.'
      });
    } catch (err) {
      console.error('Error saving preferences:', err);
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (activeFilter !== 'all' && alert.type !== activeFilter) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    return true;
  });

  const highPriorityCount = alerts.filter(a => a.severity === 'high').length;
  const mediumPriorityCount = alerts.filter(a => a.severity === 'medium').length;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'medium': return <Clock className="w-4 h-4 text-amber-600" />;
      case 'low': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'regulation': return <Shield className="w-5 h-5 text-purple-600" />;
      case 'market_update': return <TrendingUp className="w-5 h-5 text-blue-600" />;
      case 'travel_trend': return <Plane className="w-5 h-5 text-cyan-600" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'regulation': return 'Regulation Change';
      case 'market_update': return 'Market Update';
      case 'travel_trend': return 'Travel Trend';
      default: return 'Alert';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Market Alerts Dashboard</h2>
          <p className="text-gray-600">
            Stay informed about regulation changes, market updates, and travel trends
            {portfolioMarkets.length > 0 && (
              <span className="ml-1">for {portfolioMarkets.join(', ')}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettingsTab(!showSettingsTab)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Preferences
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAlerts(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={highPriorityCount > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-red-600">{highPriorityCount}</p>
                <p className="text-sm text-gray-600">High Priority</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className={mediumPriorityCount > 0 ? 'border-amber-200 bg-amber-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-amber-600">{mediumPriorityCount}</p>
                <p className="text-sm text-gray-600">Medium Priority</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">{alerts.length}</p>
                <p className="text-sm text-gray-600">Total Alerts</p>
              </div>
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-600">{portfolioMarkets.length}</p>
                <p className="text-sm text-gray-600">Markets Tracked</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notification Preferences Panel */}
      {showSettingsTab && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Alert Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose how you want to receive alerts about your markets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Alert Types */}
            <div>
              <h4 className="font-medium mb-3">Alert Types</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <Label htmlFor="reg-alerts">Regulation Changes</Label>
                  </div>
                  <Switch
                    id="reg-alerts"
                    checked={preferences.regulation_alerts}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, regulation_alerts: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <Label htmlFor="market-alerts">Market Updates</Label>
                  </div>
                  <Switch
                    id="market-alerts"
                    checked={preferences.market_updates}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, market_updates: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-cyan-600" />
                    <Label htmlFor="travel-alerts">Travel Trends</Label>
                  </div>
                  <Switch
                    id="travel-alerts"
                    checked={preferences.travel_trends}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, travel_trends: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Notification Channels */}
            <div>
              <h4 className="font-medium mb-3">Notification Channels</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-600" />
                    <div>
                      <Label htmlFor="email-notif">Email Notifications</Label>
                      {investorEmail && (
                        <p className="text-xs text-gray-500">{investorEmail}</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={preferences.email_notifications}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, email_notifications: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-gray-600" />
                    <div>
                      <Label htmlFor="sms-notif">SMS Notifications</Label>
                      {investorPhone ? (
                        <p className="text-xs text-gray-500">{investorPhone}</p>
                      ) : (
                        <p className="text-xs text-amber-600">Add phone in settings</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    id="sms-notif"
                    checked={preferences.sms_notifications}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, sms_notifications: checked }))
                    }
                    disabled={!investorPhone}
                  />
                </div>
              </div>
            </div>

            {/* Frequency */}
            <div>
              <h4 className="font-medium mb-3">Notification Frequency</h4>
              <div className="flex gap-2">
                {(['immediate', 'daily', 'weekly'] as const).map((freq) => (
                  <Button
                    key={freq}
                    variant={preferences.frequency === freq ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreferences(prev => ({ ...prev, frequency: freq }))}
                    className={preferences.frequency === freq ? 'bg-blue-600' : ''}
                  >
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {preferences.frequency === 'immediate' && 'Get notified as soon as new alerts are available'}
                {preferences.frequency === 'daily' && 'Receive a daily digest of all new alerts'}
                {preferences.frequency === 'weekly' && 'Receive a weekly summary of market updates'}
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={savePreferences} disabled={savingPrefs}>
                {savingPrefs && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Filter by type:</span>
          <div className="flex gap-1">
            {(['all', 'regulation', 'market_update', 'travel_trend'] as const).map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter(filter)}
                className={activeFilter === filter ? 'bg-[#1a365d]' : ''}
              >
                {filter === 'all' ? 'All' : getTypeLabel(filter)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Severity:</span>
          <div className="flex gap-1">
            {(['all', 'high', 'medium', 'low'] as const).map((filter) => (
              <Button
                key={filter}
                variant={severityFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSeverityFilter(filter)}
                className={severityFilter === filter ? 'bg-[#1a365d]' : ''}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Active Alerts ({filteredAlerts.length})</span>
            {portfolioMarkets.length === 0 && (
              <Badge variant="outline" className="font-normal">
                Showing all markets - Add properties to your portfolio for personalized alerts
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Alerts Found</h3>
              <p className="text-gray-500">
                {activeFilter !== 'all' || severityFilter !== 'all'
                  ? 'Try adjusting your filters to see more alerts.'
                  : 'Great news! There are no urgent alerts for your markets right now.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.severity === 'high' ? 'border-l-red-500 bg-red-50' :
                    alert.severity === 'medium' ? 'border-l-amber-500 bg-amber-50' :
                    'border-l-green-500 bg-green-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      alert.type === 'regulation' ? 'bg-purple-100' :
                      alert.type === 'market_update' ? 'bg-blue-100' :
                      'bg-cyan-100'
                    }`}>
                      {getTypeIcon(alert.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {getSeverityIcon(alert.severity)}
                          <span className="ml-1 capitalize">{alert.severity}</span>
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <MapPin className="w-3 h-3" />
                        <span>{alert.market}</span>
                        <span className="mx-1">•</span>
                        <span>{getTypeLabel(alert.type)}</span>
                      </div>
                      
                      <p className="text-gray-700 mb-3">{alert.description}</p>
                      
                      <div className="bg-white/60 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">Recommended Action</p>
                            <p className="text-sm text-gray-600">{alert.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resources Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#d4a574]" />
            Helpful Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <a
              href="/knowledge"
              className="p-4 border rounded-lg hover:border-[#d4a574] hover:bg-amber-50 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <Building2 className="w-6 h-6 text-[#d4a574]" />
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#d4a574]" />
              </div>
              <h4 className="font-medium text-gray-900">Knowledge Library</h4>
              <p className="text-sm text-gray-500">Market guides and regulation overviews</p>
            </a>

            <a
              href="/deals"
              className="p-4 border rounded-lg hover:border-[#d4a574] hover:bg-amber-50 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#d4a574]" />
              </div>
              <h4 className="font-medium text-gray-900">Active Deals</h4>
              <p className="text-sm text-gray-500">Browse pre-verified opportunities</p>
            </a>

            <button
              onClick={() => {
                const pennyButton = document.querySelector('[data-penny-chat]') as HTMLButtonElement;
                if (pennyButton) pennyButton.click();
              }}
              className="p-4 border rounded-lg hover:border-[#d4a574] hover:bg-amber-50 transition-colors group text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#d4a574]" />
              </div>
              <h4 className="font-medium text-gray-900">Ask Penny AI</h4>
              <p className="text-sm text-gray-500">Get personalized market insights</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}