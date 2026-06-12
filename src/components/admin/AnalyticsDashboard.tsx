import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { AnalyticsOverview } from './AnalyticsOverview';
import { AnalyticsCharts } from './AnalyticsCharts';
import { ErrorMonitoringWidget } from './ErrorMonitoringWidget';
import { EdgeFunctionTestSuite } from './EdgeFunctionTestSuite';
import { Download, RefreshCw, Loader2, Calendar, TrendingUp, AlertCircle, WifiOff, FileText, Send, Eye, CheckCircle, Clock } from 'lucide-react';


// Fallback data when API fails
const fallbackAnalytics = {
  overview: {
    totalInquiries: 0,
    conversionRate: 0,
    totalRevenue: 0,
    avgDealSize: 0,
    activeInvestors: 0,
    totalProperties: 0
  },
  topMarkets: [],
  pipelineStats: [
    { stage: 'New Leads', count: 0 },
    { stage: 'Qualified', count: 0 },
    { stage: 'In Progress', count: 0 },
    { stage: 'Closed', count: 0 }
  ]
};

interface AMAgreementSummary {
  total: number;
  signed: number;
  unsigned: number;
  unsignedNames: { name: string; email: string; status: string; id: string }[];
}

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [agreementSummary, setAgreementSummary] = useState<AMAgreementSummary | null>(null);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const { toast } = useToast();

  // Get staff session for error monitoring widget
  const staffSession = (() => {
    try {
      return JSON.parse(localStorage.getItem('staffSession') || '{}');
    } catch { return {}; }
  })();

  const staffId = staffSession.id;
  const staffName = staffSession.name || `${staffSession.first_name || ''} ${staffSession.last_name || ''}`.trim() || 'Staff';

  // Check if current user is a success manager
  const isSuccessManager = (() => {
    return staffSession.department === 'success_managers' || 
           (staffSession.roles || []).includes('success_managers') ||
           (staffSession.permissions || []).includes('all');
  })();


  const fetchAnalytics = useCallback(async (showToast = true) => {
    setLoading(true);
    setError(null);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('get-deal-analytics', {
        body: { dateRange }
      });
      
      clearTimeout(timeoutId);
      
      if (fetchError) {
        console.error('Analytics fetch error:', fetchError);
        setError('Unable to load analytics data. Showing cached data.');
        // Use fallback data but don't show error toast every time
        setAnalytics(fallbackAnalytics);
        if (showToast && retryCount === 0) {
          toast({ 
            title: 'Analytics Loading Issue', 
            description: 'Using cached data. Click refresh to try again.',
            variant: 'destructive' 
          });
        }
      } else if (data) {
        // Validate and sanitize data
        const sanitizedData = {
          overview: {
            totalInquiries: data.overview?.totalInquiries || 0,
            conversionRate: data.overview?.conversionRate || 0,
            totalRevenue: data.overview?.totalRevenue || 0,
            avgDealSize: data.overview?.avgDealSize || 0,
            activeInvestors: data.overview?.activeInvestors || 0,
            totalProperties: data.overview?.totalProperties || 0
          },
          topMarkets: Array.isArray(data.topMarkets) ? data.topMarkets : [],
          pipelineStats: Array.isArray(data.pipelineStats) ? data.pipelineStats : fallbackAnalytics.pipelineStats
        };
        setAnalytics(sanitizedData);
        setError(null);
        setRetryCount(0);
      } else {
        setAnalytics(fallbackAnalytics);
        setError('No data available');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Analytics error:', err);
      
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError('Connection error. Please check your internet connection.');
      }
      
      setAnalytics(fallbackAnalytics);
      setRetryCount(prev => prev + 1);
    }
    
    setLoading(false);
  }, [dateRange, toast, retryCount]);

  const fetchAgreementSummary = useCallback(async () => {
    if (!isSuccessManager) return;
    
    setLoadingAgreements(true);
    try {
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_am_agreements' }
      });
      
      if (data?.agreements && Array.isArray(data.agreements)) {
        const agreements = data.agreements;
        const signed = agreements.filter((a: any) => a.status === 'signed').length;
        const unsigned = agreements.filter((a: any) => a.status !== 'signed' && a.status !== 'voided');
        
        setAgreementSummary({
          total: agreements.length,
          signed,
          unsigned: unsigned.length,
          unsignedNames: unsigned.map((a: any) => ({
            name: a.am_name,
            email: a.am_email,
            status: a.status,
            id: a.id
          }))
        });
      }
    } catch (err) {
      console.error('Failed to fetch agreement summary:', err);
    }
    setLoadingAgreements(false);
  }, [isSuccessManager]);

  const handleSendAllReminders = async () => {
    if (!agreementSummary?.unsignedNames.length) return;
    
    setSendingReminders(true);
    let sentCount = 0;
    
    for (const ag of agreementSummary.unsignedNames) {
      try {
        const { data } = await supabase.functions.invoke('send-investor-invitation', {
          body: { action: 'resend_agreement', agreement_id: ag.id }
        });
        if (data?.success) sentCount++;
      } catch (err) {
        console.error('Failed to resend to', ag.email, err);
      }
    }
    
    toast({
      title: 'Reminders Sent',
      description: `Successfully sent ${sentCount} of ${agreementSummary.unsignedNames.length} reminder(s).`
    });
    
    fetchAgreementSummary();
    setSendingReminders(false);
  };

  useEffect(() => { 
    fetchAnalytics(false); 
  }, [dateRange]);

  useEffect(() => {
    fetchAgreementSummary();
  }, [fetchAgreementSummary]);

  const handleRefresh = () => {
    setRetryCount(0);
    fetchAnalytics(true);
    fetchAgreementSummary();
  };

  const exportReport = () => {
    if (!analytics) return;
    
    try {
      const rows = [
        ['Metric', 'Value'],
        ['Total Inquiries', analytics.overview.totalInquiries],
        ['Conversion Rate', `${analytics.overview.conversionRate}%`],
        ['Total Revenue', `$${analytics.overview.totalRevenue}`],
        ['Avg Deal Size', `$${(analytics.overview.avgDealSize || 0).toFixed(0)}`],
        ['Active Investors', analytics.overview.activeInvestors],
        ['Total Properties', analytics.overview.totalProperties],
        [''],
        ['Top Markets'],
        ['Market', 'Inquiries', 'Conversions', 'Revenue'],
        ...analytics.topMarkets.map((m: any) => [m.market, m.inquiries, m.conversions, `$${m.revenue}`]),
        [''],
        ['Pipeline Stages'],
        ['Stage', 'Count'],
        ...analytics.pipelineStats.map((s: any) => [s.stage, s.count])
      ];
      const csv = rows.map(r => Array.isArray(r) ? r.join(',') : r).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast({ title: 'Report exported successfully' });
    } catch (err) {
      toast({ title: 'Export failed', description: 'Unable to generate report', variant: 'destructive' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Send className="w-3 h-3 text-blue-500" />;
      case 'viewed': return <Eye className="w-3 h-3 text-amber-500" />;
      case 'pending': return <Clock className="w-3 h-3 text-yellow-500" />;
      default: return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'viewed': return 'bg-amber-100 text-amber-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Loading state
  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" aria-hidden="true" />
        <span className="ml-3 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="Deal Flow Analytics Dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#d4a574]" aria-hidden="true" />
            Deal Flow Analytics
          </h2>
          <p className="text-gray-500 text-sm">Track performance metrics and investor engagement</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40" aria-label="Select date range">
              <Calendar className="w-4 h-4 mr-2" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={handleRefresh} 
            disabled={loading}
            aria-label="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
          <Button 
            onClick={exportReport} 
            className="bg-[#d4a574] hover:bg-[#c49464]"
            disabled={!analytics}
            aria-label="Export analytics report as CSV"
          >
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            Export
          </Button>
        </div>
      </div>

      {/* Unsigned AM Agreements Widget - Only for Success Managers */}
      {isSuccessManager && agreementSummary && agreementSummary.unsigned > 0 && (
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base text-amber-900 flex items-center gap-2">
                    Unsigned AM Agreements
                    <Badge className="bg-amber-500 text-white">{agreementSummary.unsigned}</Badge>
                  </CardTitle>
                  <CardDescription className="text-amber-700">
                    {agreementSummary.unsigned} of {agreementSummary.total} AM{agreementSummary.total !== 1 ? 's' : ''} haven't signed their service agreement
                  </CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={sendingReminders}
                onClick={handleSendAllReminders}
              >
                {sendingReminders ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Send className="w-4 h-4 mr-1" />
                )}
                Send All Reminders
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {agreementSummary.unsignedNames.slice(0, 6).map((am, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {am.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{am.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{am.email}</p>
                    </div>
                  </div>
                  <Badge className={`${getStatusBadgeClass(am.status)} flex items-center gap-1 text-[10px] flex-shrink-0 ml-2`}>
                    {getStatusIcon(am.status)}
                    {am.status}
                  </Badge>
                </div>
              ))}
            </div>
            {agreementSummary.unsignedNames.length > 6 && (
              <p className="text-xs text-amber-600 mt-2 text-center">
                + {agreementSummary.unsignedNames.length - 6} more unsigned agreements
              </p>
            )}
            {/* Quick Stats Bar */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-amber-200">
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="text-gray-600"><span className="font-semibold text-green-700">{agreementSummary.signed}</span> signed</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Send className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-gray-600"><span className="font-semibold text-blue-700">{agreementSummary.unsignedNames.filter(a => a.status === 'sent').length}</span> sent</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Eye className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-gray-600"><span className="font-semibold text-amber-700">{agreementSummary.unsignedNames.filter(a => a.status === 'viewed').length}</span> viewed</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-gray-600"><span className="font-semibold text-yellow-700">{agreementSummary.unsignedNames.filter(a => a.status === 'pending').length}</span> pending</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success state - all signed */}
      {isSuccessManager && agreementSummary && agreementSummary.total > 0 && agreementSummary.unsigned === 0 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">All AM Agreements Signed</p>
                <p className="text-xs text-green-600">All {agreementSummary.total} Acquisition Manager{agreementSummary.total !== 1 ? 's have' : ' has'} signed their service agreement.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Infrastructure Health Monitor - Error Monitoring Widget */}
      {isSuccessManager && (
        <ErrorMonitoringWidget staffId={staffId} staffName={staffName} />
      )}

      {/* Edge Function Health & Audit Suite */}
      {isSuccessManager && (
        <EdgeFunctionTestSuite />
      )}


      {/* Error Banner */}

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {error.includes('Connection') || error.includes('timed out') ? (
                <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" aria-hidden="true" />
              )}
              <div className="flex-1">
                <p className="text-amber-800 font-medium">{error}</p>
                <p className="text-amber-600 text-sm">
                  {retryCount > 2 
                    ? 'Multiple attempts failed. The service may be temporarily unavailable.'
                    : 'Displaying available data. Some metrics may be incomplete.'}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={loading}
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Content */}
      {analytics && (
        <>
          <AnalyticsOverview data={analytics.overview} />
          <AnalyticsCharts pipelineStats={analytics.pipelineStats} topMarkets={analytics.topMarkets} />
        </>
      )}

      {/* Empty State */}
      {!analytics && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Unable to Load Analytics</h3>
            <p className="text-gray-500 mb-4">
              We couldn't retrieve the analytics data. Please try again.
            </p>
            <Button onClick={handleRefresh} className="bg-[#d4a574] hover:bg-[#c49464]">
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

