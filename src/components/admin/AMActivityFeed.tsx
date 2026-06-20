import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, RefreshCw, Bell, Activity, DollarSign, CreditCard, Home, 
  FileSignature, UserCheck, PhoneCall, Search, Clock, User, ChevronRight,
  Wallet, Package, Shield, AlertCircle
} from 'lucide-react';

interface ActivityItem {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  activity_type: string;
  activity_category: string;
  title: string;
  description: string;
  metadata: any;
  created_at: string;
}

interface Props {
  staffId: string;
  staffName: string;
  onNavigateToInvestor?: (investorId: string) => void;
}

const activityIcons: Record<string, any> = {
  'funding_status_updated': Wallet,
  'credits_updated': CreditCard,
  'property_added': Home,
  'property_received': Package,
  'agreement_sent': FileSignature,
  'am_assigned': UserCheck,
  'sm_assigned': UserCheck,
  'discovery_completed': PhoneCall,
  'search_limit_reset': Search,
};

const activityColors: Record<string, string> = {
  'funding_status_updated': 'bg-green-100 text-green-700 border-green-200',
  'credits_updated': 'bg-purple-100 text-purple-700 border-purple-200',
  'property_added': 'bg-blue-100 text-blue-700 border-blue-200',
  'property_received': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'agreement_sent': 'bg-amber-100 text-amber-700 border-amber-200',
  'am_assigned': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'sm_assigned': 'bg-teal-100 text-teal-700 border-teal-200',
  'discovery_completed': 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function AMActivityFeed({ staffId, staffName, onNavigateToInvestor }: Props) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [investorCount, setInvestorCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { toast } = useToast();

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'get_am_activity_feed', staff_id: staffId, limit: 100 }
      });
      
      if (error) {
        // Try to parse error response
        let responseData = null;
        if (typeof error === 'object') {
          if (error.activities) responseData = error;
          else if (error.message) {
            try { responseData = JSON.parse(error.message); } catch {}
          }
        }
        if (responseData?.activities) {
          setActivities(responseData.activities);
          setInvestorCount(responseData.investor_count || 0);
        }
      } else if (data?.activities) {
        setActivities(data.activities);
        setInvestorCount(data.investor_count || 0);
      }
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('Failed to fetch activity feed:', err);
    }
    setLoading(false);
  }, [staffId]);

  useEffect(() => {
    fetchActivities();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchActivities, 60000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  // Group activities by date
  const groupedActivities: Record<string, ActivityItem[]> = {};
  activities.forEach(activity => {
    const date = new Date(activity.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!groupedActivities[date]) groupedActivities[date] = [];
    groupedActivities[date].push(activity);
  });

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const getDateLabel = (dateStr: string) => {
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    return dateStr;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg text-indigo-900">Activity Feed</CardTitle>
                <CardDescription className="text-indigo-700">
                  Real-time updates from Success Team on your {investorCount} assigned investor{investorCount !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
              <Button variant="outline" size="sm" onClick={fetchActivities} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{activities.length}</p>
            <p className="text-xs text-gray-500">Total Updates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {activities.filter(a => {
                const d = new Date(a.created_at);
                const now = new Date();
                return d.toDateString() === now.toDateString();
              }).length}
            </p>
            <p className="text-xs text-gray-500">Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {new Set(activities.map(a => a.investor_id)).size}
            </p>
            <p className="text-xs text-gray-500">Investors Updated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {activities.filter(a => a.activity_type === 'funding_status_updated' || a.activity_type === 'credits_updated').length}
            </p>
            <p className="text-xs text-gray-500">Financial Updates</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#d4a574]" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && activities.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No activity yet</p>
              <p className="text-sm mt-1">Updates from the Success Team on your assigned investors will appear here.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-6">
                {Object.entries(groupedActivities).map(([date, items]) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {getDateLabel(date)}
                      </span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                    <div className="space-y-3">
                      {items.map(activity => {
                        const Icon = activityIcons[activity.activity_type] || AlertCircle;
                        const colorClass = activityColors[activity.activity_type] || 'bg-gray-100 text-gray-700 border-gray-200';
                        
                        return (
                          <div 
                            key={activity.id} 
                            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
                          >
                            {/* Icon */}
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${colorClass}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium text-sm">{activity.title}</p>
                                  <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
                                </div>
                                <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {timeAgo(activity.created_at)}
                                </span>
                              </div>
                              
                              {/* Investor info */}
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-[#1a365d] flex items-center justify-center">
                                    <User className="w-3 h-3 text-white" />
                                  </div>
                                  <span className="text-xs font-medium text-[#1a365d]">
                                    {activity.investor_name}
                                  </span>
                                </div>
                                {activity.investor_email && (
                                  <span className="text-xs text-gray-400">{activity.investor_email}</span>
                                )}
                                {onNavigateToInvestor && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => onNavigateToInvestor(activity.investor_id)}
                                  >
                                    View Profile <ChevronRight className="w-3 h-3 ml-1" />
                                  </Button>
                                )}
                              </div>

                              {/* Metadata badges */}
                              {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {activity.metadata.funded !== undefined && (
                                    <Badge variant="outline" className="text-xs">
                                      {activity.metadata.funded ? 'Funded' : 'Unfunded'}
                                    </Badge>
                                  )}
                                  {activity.metadata.funding_tier && (
                                    <Badge variant="outline" className="text-xs">
                                      Tier: {activity.metadata.funding_tier}
                                    </Badge>
                                  )}
                                  {activity.metadata.new_balance !== undefined && (
                                    <Badge variant="outline" className="text-xs">
                                      Balance: {activity.metadata.new_balance}
                                    </Badge>
                                  )}
                                  {activity.metadata.property_address && (
                                    <Badge variant="outline" className="text-xs">
                                      {activity.metadata.property_address}
                                    </Badge>
                                  )}
                                  {activity.metadata.agreement_type && (
                                    <Badge variant="outline" className="text-xs">
                                      {activity.metadata.agreement_type}
                                    </Badge>
                                  )}
                                  {activity.metadata.updated_by && (
                                    <Badge variant="outline" className="text-xs bg-gray-50">
                                      By: {activity.metadata.updated_by}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
