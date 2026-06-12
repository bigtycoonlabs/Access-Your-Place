import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Bell, AlertTriangle, TrendingUp, TrendingDown, Target, Zap,
  RefreshCw, Loader2, CheckCircle, Clock, BarChart3, PieChart,
  ArrowUp, ArrowDown, Eye, Building2, Calendar, FileText, Download
} from 'lucide-react';

interface ScoreAlert {
  id: string;
  property_id: string;
  alert_type: string;
  severity: string;
  current_score: number;
  previous_score?: number;
  message: string;
  acknowledged: boolean;
  created_at: string;
  property?: {
    listing_title: string;
    city: string;
    state: string;
  };
}

interface WeeklyReport {
  period: { start: string; end: string };
  summary: {
    total_properties_scored: number;
    average_score: number;
    accuracy_rate: number | null;
    total_feedback_received: number;
  };
  score_distribution: {
    excellent: number;
    good: number;
    average: number;
    below_average: number;
    flagged: number;
  };
  recommendation_breakdown: {
    strong_buy: number;
    buy: number;
    hold: number;
    pass: number;
  };
  trends: {
    high_value_deals_found: number;
    flagged_deals: number;
    flagged_percentage: number;
  };
}

interface Props {
  staffId: string;
  staffName: string;
}

export function PennyScoreMonitoringDashboard({ staffId, staffName }: Props) {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<ScoreAlert[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [scoreDistribution, setScoreDistribution] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('alerts');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch alerts
      const { data: alertsData } = await supabase
        .from('penny_score_alerts')
        .select(`
          *,
          property:properties(listing_title, city, state)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      setAlerts(alertsData || []);

      // Fetch monitoring dashboard data
      const { data: dashboardData } = await supabase.functions.invoke('penny-score-monitoring', {
        body: { action: 'get_monitoring_dashboard' }
      });

      if (dashboardData?.dashboard) {
        setScoreDistribution(dashboardData.dashboard.score_distribution);
        setWeeklyReport(dashboardData.dashboard.latest_report);
      }

    } catch (err) {
      console.error('Error fetching monitoring data:', err);
    }
    setLoading(false);
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await supabase
        .from('penny_score_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: staffId,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      toast({ title: 'Alert acknowledged', description: 'The alert has been marked as reviewed.' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to acknowledge alert', variant: 'destructive' });
    }
  };

  const generateWeeklyReport = async () => {
    try {
      const { data } = await supabase.functions.invoke('penny-score-monitoring', {
        body: { action: 'generate_weekly_report' }
      });

      if (data?.report) {
        setWeeklyReport(data.report);
        toast({ title: 'Report generated', description: 'Weekly report has been created.' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to generate report', variant: 'destructive' });
    }
  };

  const checkForNewAlerts = async () => {
    try {
      // Check for low scores
      const { data: lowScores } = await supabase.functions.invoke('penny-score-monitoring', {
        body: { action: 'check_low_scores' }
      });

      // Check for high value deals
      const { data: highValue } = await supabase.functions.invoke('penny-score-monitoring', {
        body: { action: 'check_high_value_deals' }
      });

      const totalAlerts = (lowScores?.alerts?.length || 0) + (highValue?.alerts?.length || 0);
      toast({ 
        title: 'Alert check complete', 
        description: `Found ${totalAlerts} new alerts.` 
      });
      
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to check for alerts', variant: 'destructive' });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'urgent': return 'bg-orange-500 text-white';
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'score_change': return <TrendingDown className="w-5 h-5" />;
      case 'low_score': return <AlertTriangle className="w-5 h-5" />;
      case 'high_value_deal': return <Target className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const totalDistribution = scoreDistribution 
    ? Object.values(scoreDistribution).reduce((sum: number, val) => sum + (val as number), 0)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="Penny Score Monitoring Dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-7 h-7 text-purple-500" aria-hidden="true" />
            Penny Score Monitoring
          </h2>
          <p className="text-gray-600">Monitor score changes, alerts, and weekly performance reports</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={checkForNewAlerts} variant="outline">
            <Bell className="w-4 h-4 mr-2" aria-hidden="true" />
            Check Alerts
          </Button>
          <Button onClick={generateWeeklyReport} className="bg-purple-500 hover:bg-purple-600">
            <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={unacknowledgedAlerts.length > 0 ? 'border-red-300 bg-red-50' : ''}>
          <CardContent className="p-4 text-center">
            <Bell className={`w-8 h-8 mx-auto mb-2 ${unacknowledgedAlerts.length > 0 ? 'text-red-500' : 'text-gray-400'}`} aria-hidden="true" />
            <p className="text-2xl font-bold">{unacknowledgedAlerts.length}</p>
            <p className="text-sm text-gray-500">Pending Alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 mx-auto mb-2 text-green-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{scoreDistribution?.excellent || 0}</p>
            <p className="text-sm text-gray-500">High-Value Deals (85+)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{scoreDistribution?.flagged || 0}</p>
            <p className="text-sm text-gray-500">Flagged (&lt;40)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-blue-500" aria-hidden="true" />
            <p className="text-2xl font-bold">{weeklyReport?.summary?.average_score || 'N/A'}</p>
            <p className="text-sm text-gray-500">Avg Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="w-4 h-4" aria-hidden="true" />
            Alerts
            {unacknowledgedAlerts.length > 0 && (
              <Badge className="bg-red-500 text-white ml-1">{unacknowledgedAlerts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" aria-hidden="true" />
            Score Distribution
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-2">
            <FileText className="w-4 h-4" aria-hidden="true" />
            Weekly Report
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {alerts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-4" aria-hidden="true" />
                <h3 className="text-lg font-medium text-gray-600">No Active Alerts</h3>
                <p className="text-gray-500">All properties are within normal score ranges.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
                <Card 
                  key={alert.id} 
                  className={`${alert.acknowledged ? 'opacity-60' : ''} ${
                    alert.severity === 'critical' ? 'border-l-4 border-l-red-600' :
                    alert.severity === 'urgent' ? 'border-l-4 border-l-orange-500' :
                    alert.severity === 'high' ? 'border-l-4 border-l-red-500' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          alert.alert_type === 'high_value_deal' ? 'bg-green-100 text-green-600' :
                          alert.alert_type === 'low_score' ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {getAlertIcon(alert.alert_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              {alert.alert_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                            {alert.acknowledged && (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                                Acknowledged
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-gray-900">
                            {alert.property?.listing_title || `Property in ${alert.property?.city}, ${alert.property?.state}`}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Zap className="w-4 h-4" aria-hidden="true" />
                              Score: {alert.current_score}
                              {alert.previous_score && (
                                <span className={alert.current_score > alert.previous_score ? 'text-green-600' : 'text-red-600'}>
                                  ({alert.current_score > alert.previous_score ? '+' : ''}{alert.current_score - alert.previous_score})
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" aria-hidden="true" />
                              {new Date(alert.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(`/deals/${alert.property_id}`, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-1" aria-hidden="true" />
                          View
                        </Button>
                        {!alert.acknowledged && (
                          <Button 
                            size="sm"
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="bg-purple-500 hover:bg-purple-600"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" aria-hidden="true" />
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Score Distribution Tab */}
        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Score Distribution</CardTitle>
              <CardDescription>Breakdown of all property Penny Scores</CardDescription>
            </CardHeader>
            <CardContent>
              {scoreDistribution && totalDistribution > 0 ? (
                <div className="space-y-6">
                  {/* Visual Bar Chart */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full" aria-hidden="true" />
                          <span className="font-medium">Excellent (85-100)</span>
                        </span>
                        <span className="text-gray-600">{scoreDistribution.excellent} ({Math.round((scoreDistribution.excellent / totalDistribution) * 100)}%)</span>
                      </div>
                      <Progress value={(scoreDistribution.excellent / totalDistribution) * 100} className="h-4 bg-gray-100" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full" aria-hidden="true" />
                          <span className="font-medium">Good (70-84)</span>
                        </span>
                        <span className="text-gray-600">{scoreDistribution.good} ({Math.round((scoreDistribution.good / totalDistribution) * 100)}%)</span>
                      </div>
                      <Progress value={(scoreDistribution.good / totalDistribution) * 100} className="h-4 bg-gray-100" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-amber-500 rounded-full" aria-hidden="true" />
                          <span className="font-medium">Average (50-69)</span>
                        </span>
                        <span className="text-gray-600">{scoreDistribution.average} ({Math.round((scoreDistribution.average / totalDistribution) * 100)}%)</span>
                      </div>
                      <Progress value={(scoreDistribution.average / totalDistribution) * 100} className="h-4 bg-gray-100" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-orange-500 rounded-full" aria-hidden="true" />
                          <span className="font-medium">Below Average (40-49)</span>
                        </span>
                        <span className="text-gray-600">{scoreDistribution.below_average} ({Math.round((scoreDistribution.below_average / totalDistribution) * 100)}%)</span>
                      </div>
                      <Progress value={(scoreDistribution.below_average / totalDistribution) * 100} className="h-4 bg-gray-100" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full" aria-hidden="true" />
                          <span className="font-medium">Flagged (&lt;40)</span>
                        </span>
                        <span className="text-gray-600">{scoreDistribution.flagged} ({Math.round((scoreDistribution.flagged / totalDistribution) * 100)}%)</span>
                      </div>
                      <Progress value={(scoreDistribution.flagged / totalDistribution) * 100} className="h-4 bg-gray-100" />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-center text-gray-600">
                      <strong>{totalDistribution}</strong> total properties scored
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <PieChart className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p>No score distribution data available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Report Tab */}
        <TabsContent value="report" className="space-y-4">
          {weeklyReport ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Weekly Performance Report</CardTitle>
                      <CardDescription>
                        {new Date(weeklyReport.period.start).toLocaleDateString()} - {new Date(weeklyReport.period.end).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-purple-700">{weeklyReport.summary.total_properties_scored}</p>
                      <p className="text-sm text-purple-600">Properties Scored</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-blue-700">{weeklyReport.summary.average_score}</p>
                      <p className="text-sm text-blue-600">Average Score</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-green-700">
                        {weeklyReport.summary.accuracy_rate !== null ? `${weeklyReport.summary.accuracy_rate}%` : 'N/A'}
                      </p>
                      <p className="text-sm text-green-600">Accuracy Rate</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-amber-700">{weeklyReport.summary.total_feedback_received}</p>
                      <p className="text-sm text-amber-600">Feedback Received</p>
                    </div>
                  </div>

                  {/* Recommendation Breakdown */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-4">Recommendation Breakdown</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <ArrowUp className="w-4 h-4 text-green-600" aria-hidden="true" />
                            Strong Buy
                          </span>
                          <Badge className="bg-green-100 text-green-700">{weeklyReport.recommendation_breakdown.strong_buy}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" aria-hidden="true" />
                            Buy
                          </span>
                          <Badge className="bg-blue-100 text-blue-700">{weeklyReport.recommendation_breakdown.buy}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-600" aria-hidden="true" />
                            Hold
                          </span>
                          <Badge className="bg-amber-100 text-amber-700">{weeklyReport.recommendation_breakdown.hold}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <ArrowDown className="w-4 h-4 text-red-600" aria-hidden="true" />
                            Pass
                          </span>
                          <Badge className="bg-red-100 text-red-700">{weeklyReport.recommendation_breakdown.pass}</Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-4">Key Trends</h4>
                      <div className="space-y-3">
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-green-600" aria-hidden="true" />
                            <span className="font-medium text-green-800">High-Value Deals Found</span>
                          </div>
                          <p className="text-2xl font-bold text-green-700 mt-1">{weeklyReport.trends.high_value_deals_found}</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
                            <span className="font-medium text-red-800">Flagged Deals</span>
                          </div>
                          <p className="text-2xl font-bold text-red-700 mt-1">
                            {weeklyReport.trends.flagged_deals} ({weeklyReport.trends.flagged_percentage}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                <h3 className="text-lg font-medium text-gray-600">No Report Available</h3>
                <p className="text-gray-500 mb-4">Generate a weekly report to see performance metrics.</p>
                <Button onClick={generateWeeklyReport} className="bg-purple-500 hover:bg-purple-600">
                  <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
                  Generate Weekly Report
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
