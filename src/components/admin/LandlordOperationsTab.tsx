import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TabErrorBoundary } from '@/components/admin/TabErrorBoundary';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Landmark, Users, Building, ClipboardCheck, BarChart3,
  AlertCircle, CheckCircle, Clock, TrendingUp, RefreshCw,
  Loader2, UserCheck, Home, Eye, MessageSquare, Bell,
  ArrowUpRight, ArrowDownRight, Minus, PieChart
} from 'lucide-react';

// Direct imports for sub-tab components
import { UnassignedLandlordsTab } from './UnassignedLandlordsTab';
import { PropertyReviewQueue } from './PropertyReviewQueue';
import { LandlordCRMTab } from './LandlordCRMTab';

interface LandlordOperationsTabProps {
  staffId: string;
  staffName: string;
  isAdmin: boolean;
  userRole?: string;
}

// Standalone Landlord Analytics Dashboard component
function LandlordAnalyticsDashboard({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [portalStats, setPortalStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllAnalytics();
  }, []);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsRes, followUpsRes, portalRes] = await Promise.allSettled([
        supabase.functions.invoke('manage-landlords', { body: { action: 'get_analytics' } }),
        supabase.functions.invoke('manage-landlords', { body: { action: 'get_follow_ups' } }),
        supabase.functions.invoke('manage-landlord-portal', { body: { action: 'get_all_portal_landlords' } }),
      ]);

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data?.analytics) {
        setAnalytics(analyticsRes.value.data.analytics);
      }
      if (followUpsRes.status === 'fulfilled' && followUpsRes.value.data?.followUps) {
        setFollowUps(followUpsRes.value.data.followUps);
      }
      if (portalRes.status === 'fulfilled' && portalRes.value.data?.landlords) {
        const landlords = portalRes.value.data.landlords;
        setPortalStats({
          total: landlords.length,
          verified: landlords.filter((l: any) => l.status === 'verified' || l.status === 'active').length,
          pending: landlords.filter((l: any) => l.status === 'pending_verification').length,
          mgmtCompanies: landlords.filter((l: any) => l.account_type === 'management_company').length,
          thisMonth: landlords.filter((l: any) => {
            const created = new Date(l.created_at);
            const now = new Date();
            return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
          }).length,
          lastMonth: landlords.filter((l: any) => {
            const created = new Date(l.created_at);
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return created.getMonth() === lastMonth.getMonth() && created.getFullYear() === lastMonth.getFullYear();
          }).length,
        });
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                  <div className="h-8 bg-gray-200 rounded w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#d4a574]" />
            <p className="text-gray-500">Loading analytics...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const growthPercent = portalStats && portalStats.lastMonth > 0
    ? Math.round(((portalStats.thisMonth - portalStats.lastMonth) / portalStats.lastMonth) * 100)
    : portalStats?.thisMonth > 0 ? 100 : 0;

  const GrowthIcon = growthPercent > 0 ? ArrowUpRight : growthPercent < 0 ? ArrowDownRight : Minus;
  const growthColor = growthPercent > 0 ? 'text-green-600' : growthPercent < 0 ? 'text-red-600' : 'text-gray-500';

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Landlords</p>
                <p className="text-3xl font-bold text-[#1a365d]">{analytics?.totalLandlords || portalStats?.total || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm">
              <GrowthIcon className={`w-4 h-4 ${growthColor}`} />
              <span className={growthColor}>{Math.abs(growthPercent)}%</span>
              <span className="text-gray-400">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Verified</p>
                <p className="text-3xl font-bold text-green-700">{portalStats?.verified || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-400">
              {portalStats?.total ? Math.round((portalStats.verified / portalStats.total) * 100) : 0}% verification rate
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Communications</p>
                <p className="text-3xl font-bold text-purple-700">{analytics?.totalCommunications || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-400">
              {(analytics?.avgResponseRate || 0).toFixed(0)}% avg response rate
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Follow-ups Due</p>
                <p className="text-3xl font-bold text-orange-700">{followUps?.length || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-400">
              Pending outreach tasks
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-500 font-medium">Pending Verification</span>
            </div>
            <p className="text-2xl font-bold text-[#1a365d]">{portalStats?.pending || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-gray-500 font-medium">Mgmt Companies</span>
            </div>
            <p className="text-2xl font-bold text-[#1a365d]">{portalStats?.mgmtCompanies || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-gray-500 font-medium">New This Month</span>
            </div>
            <p className="text-2xl font-bold text-[#1a365d]">{portalStats?.thisMonth || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500 font-medium">Last Month</span>
            </div>
            <p className="text-2xl font-bold text-[#1a365d]">{portalStats?.lastMonth || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Follow-ups Section */}
      {followUps && followUps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              Due Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {followUps.slice(0, 10).map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm bg-orange-50 border border-orange-100 p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{f.landlord_contacts?.name || 'Unknown'}</span>
                      <p className="text-xs text-gray-500">{f.subject || 'Follow-up required'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-orange-600 font-medium">
                      {new Date(f.follow_up_date).toLocaleDateString()}
                    </span>
                    <p className="text-xs text-gray-400 capitalize">{f.communication_type || 'call'}</p>
                  </div>
                </div>
              ))}
            </div>
            {followUps.length > 10 && (
              <p className="text-sm text-gray-400 text-center mt-3">
                + {followUps.length - 10} more follow-ups
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conversion Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#1a365d]" />
            Landlord Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: 'Total Sign-ups', value: portalStats?.total || 0, color: 'bg-blue-500', width: '100%' },
              { label: 'Verified & Active', value: portalStats?.verified || 0, color: 'bg-green-500', width: portalStats?.total ? `${Math.round((portalStats.verified / portalStats.total) * 100)}%` : '0%' },
              { label: 'Pending Verification', value: portalStats?.pending || 0, color: 'bg-yellow-500', width: portalStats?.total ? `${Math.round((portalStats.pending / portalStats.total) * 100)}%` : '0%' },
              { label: 'Management Companies', value: portalStats?.mgmtCompanies || 0, color: 'bg-purple-500', width: portalStats?.total ? `${Math.round((portalStats.mgmtCompanies / portalStats.total) * 100)}%` : '0%' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-semibold text-[#1a365d]">{item.value}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: item.width }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={fetchAllAnalytics}
          className="text-sm text-gray-500 hover:text-[#d4a574] flex items-center gap-1 mx-auto"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Analytics
        </button>
      </div>
    </div>
  );
}

export function LandlordOperationsTab({ staffId, staffName, isAdmin, userRole }: LandlordOperationsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState('unassigned');

  const SUB_TABS = [
    { id: 'unassigned', label: 'Unassigned Landlords', icon: AlertCircle, description: 'New sign-ups awaiting assignment' },
    { id: 'review', label: 'Property Review', icon: ClipboardCheck, description: 'Review submitted properties' },
    { id: 'crm', label: 'Landlord CRM', icon: Users, description: 'Manage relationships & outreach' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Pipeline & performance metrics' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-amber-200/50 bg-gradient-to-r from-amber-50/50 to-orange-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-[#1a365d]">Landlord Operations</CardTitle>
              <CardDescription>
                Manage landlord sign-ups, property submissions, CRM outreach, and analytics
              </CardDescription>
            </div>
            {isAdmin && (
              <Badge className="ml-auto bg-amber-100 text-amber-800 border-amber-200">
                Admin Access
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
              aria-pressed={isActive}
              aria-label={`${tab.label}: ${tab.description}`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-gray-400'}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeSubTab === 'unassigned' && (
          <TabErrorBoundary tabName="Unassigned Landlords">
            <UnassignedLandlordsTab staffId={staffId} staffName={staffName} />
          </TabErrorBoundary>
        )}

        {activeSubTab === 'review' && (
          <TabErrorBoundary tabName="Property Review Queue">
            <PropertyReviewQueue staffId={staffId} staffName={staffName} />
          </TabErrorBoundary>
        )}

        {activeSubTab === 'crm' && (
          <TabErrorBoundary tabName="Landlord CRM">
            <LandlordCRMTab userRole={userRole || (isAdmin ? 'Success_Manager' : 'Acquisition_Manager')} />
          </TabErrorBoundary>
        )}

        {activeSubTab === 'analytics' && (
          <TabErrorBoundary tabName="Landlord Analytics">
            <LandlordAnalyticsDashboard staffId={staffId} staffName={staffName} />
          </TabErrorBoundary>
        )}
      </div>
    </div>
  );
}
