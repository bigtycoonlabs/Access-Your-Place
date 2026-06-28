import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { 
  FileText, Gift, Briefcase, Heart, TrendingUp, 
  Loader2, Building2, DollarSign, Clock, CheckCircle, 
  AlertCircle, Phone, MapPin,
  Sparkles, MessageSquare, BarChart3, Target, Home, BookOpen
} from 'lucide-react';

// Skeleton components for loading states
function DashboardWidgetSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-4 w-20" />
      </CardContent>
    </Card>
  );
}

function WelcomeBannerSkeleton() {
  return (
    <div className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] rounded-xl p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Skeleton className="h-6 w-48 mb-2 bg-white/20" />
          <Skeleton className="h-4 w-64 bg-white/10" />
        </div>
        <div className="flex gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="text-center">
              <Skeleton className="h-8 w-12 mx-auto mb-1 bg-white/20" />
              <Skeleton className="h-3 w-16 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="w-4 h-4 rounded mt-0.5" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface WidgetProps { 
  investorId: string; 
  data: any; 
  onNavigate: (tab: string) => void; 
}

// Assigned Deals Widget
const AssignedDealsWidget = ({ data, onNavigate }: WidgetProps) => {
  const assignedDeals = Array.isArray(data?.assignedDeals) ? data.assignedDeals : [];
  const paidDeals = assignedDeals.filter((d: any) => d.payment_status === 'paid');
  const pendingDeals = assignedDeals.filter((d: any) => d.payment_status === 'pending');

  return (
    <Card className="h-full bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="w-4 h-4 text-green-600" aria-hidden="true" />
          Assigned Deals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="text-3xl font-bold text-green-600" 
          aria-label={`${assignedDeals.length} properties assigned to you`}
        >
          {assignedDeals.length}
        </div>
        <p className="text-sm text-gray-600 mt-1">properties assigned to you</p>
        
        <div className="flex gap-4 mt-3 text-xs" role="list" aria-label="Deal status breakdown">
          <div className="flex items-center gap-1" role="listitem">
            <CheckCircle className="w-3 h-3 text-green-500" aria-hidden="true" />
            <span>{paidDeals.length} active</span>
          </div>
          <div className="flex items-center gap-1" role="listitem">
            <Clock className="w-3 h-3 text-yellow-500" aria-hidden="true" />
            <span>{pendingDeals.length} pending</span>
          </div>
        </div>

        <Button 
          size="sm" 
          variant="link" 
          className="mt-2 p-0 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-2" 
          onClick={() => onNavigate('locator')}
          aria-label="View all assigned deals"
        >
          View Assigned Deals
        </Button>
      </CardContent>
    </Card>
  );
};

// Pending Payments Widget
const PendingPaymentsWidget = ({ data, onNavigate }: WidgetProps) => {
  const pendingPayments = Array.isArray(data?.pendingPayments) ? data.pendingPayments : [];
  const totalPending = pendingPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  return (
    <Card 
      className={`h-full ${pendingPayments.length > 0 ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200' : ''}`}
      role="region"
      aria-label="Pending payments summary"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-yellow-600" aria-hidden="true" />
          Pending Payments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingPayments.length > 0 ? (
          <>
            <div 
              className="text-2xl font-bold text-yellow-600" 
              aria-label={`${pendingPayments.length} pending payments`}
            >
              {pendingPayments.length}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {totalPending > 0 ? `$${totalPending.toLocaleString()} total` : 'awaiting payment'}
            </p>
            <ul className="mt-3 space-y-2" aria-label="Pending payment details">
              {pendingPayments.slice(0, 2).map((p: any, idx: number) => (
                <li key={idx} className="text-xs bg-white p-2 rounded border border-yellow-200">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400" aria-hidden="true" />
                    <span className="font-medium">{p.city}, {p.state}</span>
                  </div>
                  {p.amount && <span className="text-yellow-600">${p.amount.toLocaleString()}</span>}
                </li>
              ))}
            </ul>
            <Button 
              size="sm" 
              className="mt-3 w-full bg-yellow-600 hover:bg-yellow-700 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
              onClick={() => onNavigate('acquisitions')}
              aria-label="Complete pending payments"
            >
              Complete Payments
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-green-600" role="status">
              <CheckCircle className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">All caught up!</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">No pending payments</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Recent Activity Widget
const RecentActivityWidget = ({ data }: WidgetProps) => {
  const activities = Array.isArray(data?.recentActivity) ? data.recentActivity : [];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deal_assigned': return <Building2 className="w-4 h-4 text-green-500" aria-hidden="true" />;
      case 'report_generated': return <FileText className="w-4 h-4 text-blue-500" aria-hidden="true" />;
      case 'inquiry_sent': return <MessageSquare className="w-4 h-4 text-purple-500" aria-hidden="true" />;
      case 'payment_completed': return <DollarSign className="w-4 h-4 text-green-500" aria-hidden="true" />;
      case 'message_received': return <MessageSquare className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />;
      default: return <Clock className="w-4 h-4 text-gray-400" aria-hidden="true" />;
    }
  };

  return (
    <Card className="h-full" role="region" aria-label="Recent activity">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <ul className="space-y-3" aria-label="Activity list">
            {activities.slice(0, 4).map((activity: any, idx: number) => (
              <li key={idx} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5" aria-hidden="true">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 line-clamp-1">{activity.description}</p>
                  <p className="text-xs text-gray-400">
                    {activity.timestamp ? new Date(activity.timestamp).toLocaleDateString() : 'Recently'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4" role="status">
            <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-500">No recent activity</p>
            <p className="text-xs text-gray-400 mt-1">Start exploring deals!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Quick Actions Widget
const QuickActionsWidget = ({ onNavigate, onBookCall }: { onNavigate: (tab: string) => void; onBookCall: () => void }) => (
  <Card className="h-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] text-white" role="region" aria-label="Quick actions">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2 text-white">
        <Target className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
        Quick Actions
      </CardTitle>
    </CardHeader>
    <CardContent>
      <nav className="space-y-2" aria-label="Quick action buttons">
        <Button 
          size="sm" 
          variant="secondary"
          className="w-full justify-start bg-white/10 hover:bg-white/20 text-white border-0"
          onClick={() => onNavigate('locator')}
        >
          <Building2 className="w-4 h-4 mr-2 text-[#d4a574]" aria-hidden="true" />
          View Assigned Deals
        </Button>
        <Button 
          size="sm" 
          variant="secondary"
          className="w-full justify-start bg-white/10 hover:bg-white/20 text-white border-0"
          onClick={() => onNavigate('reports')}
        >
          <BarChart3 className="w-4 h-4 mr-2 text-[#d4a574]" aria-hidden="true" />
          Generate Market Report
        </Button>
        <Button 
          size="sm" 
          variant="secondary"
          className="w-full justify-start bg-white/10 hover:bg-white/20 text-white border-0"
          onClick={() => onNavigate('messages')}
        >
          <MessageSquare className="w-4 h-4 mr-2 text-[#d4a574]" aria-hidden="true" />
          Contact Support
        </Button>
        <Button 
          size="sm" 
          variant="secondary"
          className="w-full justify-start bg-white/10 hover:bg-white/20 text-white border-0"
          onClick={onBookCall}
        >
          <Phone className="w-4 h-4 mr-2 text-[#d4a574]" aria-hidden="true" />
          Book a Call
        </Button>
      </nav>
    </CardContent>
  </Card>
);

// Market Reports Widget
const MarketReportsWidget = ({ data, onNavigate }: WidgetProps) => (
  <Card className="h-full" role="region" aria-label="Recent market reports">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <FileText className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
        Recent Market Reports
      </CardTitle>
    </CardHeader>
    <CardContent>
      {Array.isArray(data?.recentReports) && data.recentReports.length > 0 ? (
        <ul className="space-y-2" aria-label="Report list">
          {data.recentReports.slice(0, 3).map((r: any) => (
            <li key={r.id} className="p-2 bg-gray-50 rounded text-sm">
              <p className="font-medium">{r.market_name || 'Market Report'}</p>
              <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500" role="status">No reports yet</p>
      )}
      <Button 
        size="sm" 
        variant="link" 
        className="mt-2 p-0 text-[#d4a574]" 
        onClick={() => onNavigate('reports')}
      >
        View All Reports
      </Button>
    </CardContent>
  </Card>
);

// Referral Earnings Widget
const ReferralEarningsWidget = ({ data, onNavigate }: WidgetProps) => (
  <Card className="h-full bg-gradient-to-br from-purple-50 to-indigo-50" role="region" aria-label="Referral earnings">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <Gift className="w-4 h-4 text-purple-600" aria-hidden="true" />
        Referral Earnings
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-purple-600">
        ${data?.referralStats?.earnings || 0}
      </div>
      <p className="text-sm text-gray-600 mt-1">{data?.referralStats?.qualified || 0} qualified referrals</p>
      <Button 
        size="sm" 
        variant="link" 
        className="mt-2 p-0 text-purple-600" 
        onClick={() => onNavigate('referrals')}
      >
        Earn More
      </Button>
    </CardContent>
  </Card>
);

// Market Insights Widget
const MarketInsightsWidget = ({ data, onNavigate }: WidgetProps) => (
  <Card className="h-full bg-gradient-to-br from-blue-50 to-indigo-50" role="region" aria-label="Market insights">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-600" aria-hidden="true" />
        Market Insights
      </CardTitle>
    </CardHeader>
    <CardContent>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">Active Markets</dt>
          <dd className="font-semibold">25+</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">Avg. Cap Rate</dt>
          <dd className="font-semibold text-green-600">8.2%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">Avg. Occupancy</dt>
          <dd className="font-semibold text-blue-600">72%</dd>
        </div>
      </dl>
      <Button 
        size="sm" 
        variant="link" 
        className="mt-2 p-0 text-blue-600" 
        onClick={() => onNavigate('reports')}
      >
        Explore Markets
      </Button>
    </CardContent>
  </Card>
);

// Acquisition Progress Widget
const AcquisitionProgressWidget = ({ data, onNavigate }: WidgetProps) => {
  const acquisitions = Array.isArray(data?.acquisitions) ? data.acquisitions : [];
  const activeAcquisitions = acquisitions.filter((a: any) => a.status !== 'completed' && a.status !== 'cancelled');

  return (
    <Card className="h-full" role="region" aria-label="Acquisition progress">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
          Acquisition Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeAcquisitions.length > 0 ? (
          <ul className="space-y-3" aria-label="Active acquisitions">
            {activeAcquisitions.slice(0, 2).map((acq: any, idx: number) => (
              <li key={idx} className="text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{acq.property_address || 'Property'}</span>
                  <Badge variant="outline" className="text-xs">{acq.status}</Badge>
                </div>
                <Progress value={acq.progress || 30} className="h-2" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500" role="status">No active acquisitions</p>
        )}
        <Button 
          size="sm" 
          variant="link" 
          className="mt-2 p-0 text-[#d4a574]" 
          onClick={() => onNavigate('acquisitions')}
        >
          View All
        </Button>
      </CardContent>
    </Card>
  );
};

// Saved Deals Widget
const SavedDealsWidget = ({ data, onNavigate }: WidgetProps) => (
  <Card className="h-full" role="region" aria-label="Saved deals">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <Heart className="w-4 h-4 text-red-500" aria-hidden="true" />
        Saved Deals
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{data?.savedDeals?.length || 0}</div>
      <p className="text-sm text-gray-600">properties saved</p>
      <Button 
        size="sm" 
        variant="link" 
        className="mt-2 p-0 text-[#d4a574]" 
        onClick={() => onNavigate('saved')}
      >
        View Saved
      </Button>
    </CardContent>
  </Card>
);

interface Props { 
  investorId: string; 
  onNavigate: (tab: string) => void;
  onBookCall?: () => void;
}

export function DashboardWidgets({ investorId, onNavigate, onBookCall }: Props) {
  const [data, setData] = useState<any>({ 
    recentReports: [], 
    referralStats: { earnings: 0, qualified: 0 }, 
    acquisitions: [], 
    savedDeals: [],
    assignedDeals: [],
    pendingPayments: [],
    recentActivity: [],
    investmentSummary: {
      totalInvested: 0,
      activeProperties: 0,
      monthlyRevenue: 0,
      roi: 0
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: dashData } = await supabase.functions.invoke('manage-market-reports', { 
          body: { action: 'get_dashboard_data', investor_id: investorId } 
        });
        
        const { data: assignedData } = await supabase.functions.invoke('investor-deal-locator', { 
          body: { action: 'get_assigned_deals', investor_id: investorId } 
        });

        const safeDash = (dashData && typeof dashData === 'object' && !dashData.error) ? dashData : {};
        const safeDeals = Array.isArray(assignedData?.deals) ? assignedData.deals : [];
        const combinedData = {
          ...safeDash,
          recentReports: Array.isArray(safeDash.recentReports) ? safeDash.recentReports : [],
          assignedDeals: safeDeals,
          pendingPayments: safeDeals.filter((d: any) => d.payment_status === 'pending'),
          recentActivity: generateRecentActivity(safeDash, safeDeals)
        };

        setData(combinedData);
      } catch (e) { 
        console.error(e); 
      }
      setLoading(false);
    };
    fetchData();
  }, [investorId]);

  const generateRecentActivity = (dashData: any, assignedDeals: any[]) => {
    const activities: any[] = [];
    assignedDeals.forEach((deal: any) => {
      activities.push({
        type: 'deal_assigned',
        description: `Property assigned in ${deal.city}, ${deal.state}`,
        timestamp: deal.assigned_at || deal.created_at
      });
    });
    (dashData?.recentReports || []).forEach((report: any) => {
      activities.push({
        type: 'report_generated',
        description: `Market report generated for ${report.market_name || 'a market'}`,
        timestamp: report.created_at
      });
    });
    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
  };

  const handleBookCall = () => {
    if (onBookCall) onBookCall();
  };

  // Skeleton loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <WelcomeBannerSkeleton />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <DashboardWidgetSkeleton key={i} />)}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <DashboardWidgetSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] rounded-xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Your Investment Dashboard</h2>
            <p className="text-white/70 text-sm">Track your deals, reports, and investment progress</p>
          </div>
          <dl className="flex gap-6">
            <div className="text-center">
              <dd className="text-2xl font-bold text-[#d4a574]">{Array.isArray(data.assignedDeals) ? data.assignedDeals.length : 0}</dd>
              <dt className="text-xs text-white/60">Assigned Deals</dt>
            </div>
            <div className="text-center">
              <dd className="text-2xl font-bold text-green-400">{Array.isArray(data.pendingPayments) ? data.pendingPayments.length : 0}</dd>
              <dt className="text-xs text-white/60">Pending</dt>
            </div>
            <div className="text-center">
              <dd className="text-2xl font-bold text-blue-400">{Array.isArray(data.recentReports) ? data.recentReports.length : 0}</dd>
              <dt className="text-xs text-white/60">Reports</dt>
            </div>
          </dl>
        </div>
      </section>

      {/* Pending Payments Alert */}
      {data.pendingPayments?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-4" role="alert">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-yellow-800">
              You have {data.pendingPayments.length} pending payment{data.pendingPayments.length > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-yellow-600">Complete your payments to unlock full property details.</p>
          </div>
          <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" onClick={() => onNavigate('acquisitions')}>
            View Details
          </Button>
        </div>
      )}

      {/* Main Widgets */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AssignedDealsWidget investorId={investorId} data={data} onNavigate={onNavigate} />
        <PendingPaymentsWidget investorId={investorId} data={data} onNavigate={onNavigate} />
        <QuickActionsWidget onNavigate={onNavigate} onBookCall={handleBookCall} />
        <RecentActivityWidget investorId={investorId} data={data} onNavigate={onNavigate} />
      </div>

      {/* Secondary Widgets */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MarketReportsWidget investorId={investorId} data={data} onNavigate={onNavigate} />
        <ReferralEarningsWidget investorId={investorId} data={data} onNavigate={onNavigate} />
        <MarketInsightsWidget investorId={investorId} data={data} onNavigate={onNavigate} />
      </div>

      {/* Bottom Row */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AcquisitionProgressWidget investorId={investorId} data={data} onNavigate={onNavigate} />
        <SavedDealsWidget investorId={investorId} data={data} onNavigate={onNavigate} />
        
        {/* Knowledge Library Card */}
        <Card className="h-full bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-600" />
              Knowledge Library
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">Access guides, market research, and educational resources.</p>
            <Link to="/knowledge-library">
              <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700">
                <BookOpen className="w-4 h-4 mr-2" />
                Browse Library
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Penny AI Card */}
        <Card className="h-full bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Penny AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">Get instant answers about markets, regulations, and strategies.</p>
            <div className="bg-purple-100 rounded-lg p-3 text-center">
              <p className="text-sm text-purple-700 font-medium">Click the chat bubble to talk to Penny AI</p>
              <div className="flex items-center justify-center gap-2 mt-2 text-purple-600">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs">Available 24/7</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
