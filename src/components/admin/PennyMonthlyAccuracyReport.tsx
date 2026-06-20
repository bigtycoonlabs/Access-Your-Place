import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target,
  BarChart3,
  Download,
  Share2,
  Calendar,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Building2,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface MarketAccuracy {
  market: string;
  adr_accuracy: number;
  occupancy_accuracy: number;
  revenue_accuracy: number;
  overall_accuracy: number;
  sample_size: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface PropertyComparison {
  property_id: string;
  address: string;
  city: string;
  predicted_adr: number;
  actual_adr: number;
  predicted_occupancy: number;
  actual_occupancy: number;
  predicted_revenue: number;
  actual_revenue: number;
  variance_pct: number;
}

interface MonthlyReport {
  id: string;
  report_month: string;
  total_predictions: number;
  total_actuals: number;
  overall_adr_accuracy: number;
  overall_occupancy_accuracy: number;
  overall_revenue_accuracy: number;
  overall_accuracy_score: number;
  best_market: string;
  best_market_accuracy: number;
  worst_market: string;
  worst_market_accuracy: number;
  improvement_from_previous: number;
  market_breakdown: MarketAccuracy[];
  property_comparisons: PropertyComparison[];
  generated_at: string;
  is_published: boolean;
  shared_with_investors: boolean;
}

export function PennyMonthlyAccuracyReport() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [currentReport, setCurrentReport] = useState<MonthlyReport | null>(null);
  const [marketAccuracies, setMarketAccuracies] = useState<MarketAccuracy[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
    fetchMarketAccuracies();
  }, []);

  useEffect(() => {
    if (selectedMonth && reports.length > 0) {
      const report = reports.find(r => r.report_month === selectedMonth);
      setCurrentReport(report || null);
    }
  }, [selectedMonth, reports]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('penny_monthly_accuracy_reports')
        .select('*')
        .order('report_month', { ascending: false })
        .limit(12);

      if (error) throw error;
      setReports(data || []);
      if (data && data.length > 0) {
        setSelectedMonth(data[0].report_month);
        setCurrentReport(data[0]);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketAccuracies = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('penny-deal-scoring', {
        body: { action: 'get_accuracy_scores' }
      });

      if (!error && data?.scores) {
        setMarketAccuracies(data.scores.map((s: any) => ({
          market: s.market,
          adr_accuracy: s.adr_accuracy_score || 0,
          occupancy_accuracy: s.occupancy_accuracy_score || 0,
          revenue_accuracy: s.revenue_accuracy_score || 0,
          overall_accuracy: s.overall_accuracy_score || 0,
          sample_size: s.sample_size || 0,
          trend: s.accuracy_trend || 'stable'
        })));
      }
    } catch (err) {
      console.error('Error fetching market accuracies:', err);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      
      // Fetch performance data
      const { data: performanceData } = await supabase
        .from('property_performance_actuals')
        .select('*')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Fetch predictions
      const { data: predictions } = await supabase
        .from('penny_deal_scores')
        .select('*')
        .gte('scored_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Calculate accuracies by market
      const marketStats: Record<string, { adrVariances: number[], occVariances: number[], revVariances: number[] }> = {};
      const propertyComparisons: PropertyComparison[] = [];

      for (const perf of performanceData || []) {
        const prediction = predictions?.find(p => p.property_id === perf.property_id);
        if (!prediction) continue;

        const market = perf.market || 'unknown';
        if (!marketStats[market]) {
          marketStats[market] = { adrVariances: [], occVariances: [], revVariances: [] };
        }

        if (perf.actual_adr && prediction.str_analysis?.estimatedAdr) {
          const variance = Math.abs((perf.actual_adr - prediction.str_analysis.estimatedAdr) / prediction.str_analysis.estimatedAdr * 100);
          marketStats[market].adrVariances.push(variance);
        }

        if (perf.actual_occupancy_rate && prediction.str_analysis?.estimatedOccupancy) {
          const variance = Math.abs(perf.actual_occupancy_rate - prediction.str_analysis.estimatedOccupancy);
          marketStats[market].occVariances.push(variance);
        }

        if (perf.actual_gross_revenue && prediction.projected_str_monthly) {
          const variance = Math.abs((perf.actual_gross_revenue - prediction.projected_str_monthly) / prediction.projected_str_monthly * 100);
          marketStats[market].revVariances.push(variance);

          propertyComparisons.push({
            property_id: perf.property_id,
            address: perf.address || 'N/A',
            city: market,
            predicted_adr: prediction.str_analysis?.estimatedAdr || 0,
            actual_adr: perf.actual_adr || 0,
            predicted_occupancy: prediction.str_analysis?.estimatedOccupancy || 0,
            actual_occupancy: perf.actual_occupancy_rate || 0,
            predicted_revenue: prediction.projected_str_monthly || 0,
            actual_revenue: perf.actual_gross_revenue || 0,
            variance_pct: variance
          });
        }
      }

      // Calculate market breakdown
      const marketBreakdown: MarketAccuracy[] = Object.entries(marketStats).map(([market, stats]) => {
        const avgAdrVariance = stats.adrVariances.length > 0 
          ? stats.adrVariances.reduce((a, b) => a + b, 0) / stats.adrVariances.length 
          : 0;
        const avgOccVariance = stats.occVariances.length > 0 
          ? stats.occVariances.reduce((a, b) => a + b, 0) / stats.occVariances.length 
          : 0;
        const avgRevVariance = stats.revVariances.length > 0 
          ? stats.revVariances.reduce((a, b) => a + b, 0) / stats.revVariances.length 
          : 0;

        return {
          market,
          adr_accuracy: Math.max(0, 100 - avgAdrVariance),
          occupancy_accuracy: Math.max(0, 100 - avgOccVariance),
          revenue_accuracy: Math.max(0, 100 - avgRevVariance),
          overall_accuracy: Math.max(0, 100 - (avgAdrVariance + avgOccVariance + avgRevVariance) / 3),
          sample_size: stats.revVariances.length,
          trend: 'stable' as const
        };
      });

      // Calculate overall stats
      const overallAdrAccuracy = marketBreakdown.length > 0
        ? marketBreakdown.reduce((a, b) => a + b.adr_accuracy, 0) / marketBreakdown.length
        : 0;
      const overallOccAccuracy = marketBreakdown.length > 0
        ? marketBreakdown.reduce((a, b) => a + b.occupancy_accuracy, 0) / marketBreakdown.length
        : 0;
      const overallRevAccuracy = marketBreakdown.length > 0
        ? marketBreakdown.reduce((a, b) => a + b.revenue_accuracy, 0) / marketBreakdown.length
        : 0;
      const overallAccuracy = (overallAdrAccuracy + overallOccAccuracy + overallRevAccuracy) / 3;

      const sortedMarkets = [...marketBreakdown].sort((a, b) => b.overall_accuracy - a.overall_accuracy);
      const bestMarket = sortedMarkets[0];
      const worstMarket = sortedMarkets[sortedMarkets.length - 1];

      // Get previous report for improvement calculation
      const previousReport = reports[0];
      const improvement = previousReport 
        ? overallAccuracy - previousReport.overall_accuracy_score 
        : 0;

      // Insert new report
      const { data: newReport, error } = await supabase
        .from('penny_monthly_accuracy_reports')
        .insert({
          report_month: currentMonth,
          total_predictions: predictions?.length || 0,
          total_actuals: performanceData?.length || 0,
          overall_adr_accuracy: overallAdrAccuracy,
          overall_occupancy_accuracy: overallOccAccuracy,
          overall_revenue_accuracy: overallRevAccuracy,
          overall_accuracy_score: overallAccuracy,
          best_market: bestMarket?.market || 'N/A',
          best_market_accuracy: bestMarket?.overall_accuracy || 0,
          worst_market: worstMarket?.market || 'N/A',
          worst_market_accuracy: worstMarket?.overall_accuracy || 0,
          improvement_from_previous: improvement,
          market_breakdown: marketBreakdown,
          property_comparisons: propertyComparisons.slice(0, 50),
          generated_at: new Date().toISOString(),
          is_published: false,
          shared_with_investors: false
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Report Generated', description: 'Monthly accuracy report has been created successfully.' });
      fetchReports();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const shareWithInvestors = async () => {
    if (!currentReport) return;
    
    try {
      const { error } = await supabase
        .from('penny_monthly_accuracy_reports')
        .update({ shared_with_investors: true, is_published: true })
        .eq('id', currentReport.id);

      if (error) throw error;

      toast({ title: 'Report Shared', description: 'Report is now visible to investors.' });
      fetchReports();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const exportToCSV = () => {
    if (!currentReport) return;

    const headers = ['Market', 'ADR Accuracy', 'Occupancy Accuracy', 'Revenue Accuracy', 'Overall Accuracy', 'Sample Size'];
    const rows = (currentReport.market_breakdown || []).map(m => [
      m.market,
      m.adr_accuracy.toFixed(1),
      m.occupancy_accuracy.toFixed(1),
      m.revenue_accuracy.toFixed(1),
      m.overall_accuracy.toFixed(1),
      m.sample_size
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `penny-accuracy-report-${currentReport.report_month}.csv`;
    a.click();
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-emerald-600';
    if (accuracy >= 80) return 'text-green-600';
    if (accuracy >= 70) return 'text-yellow-600';
    if (accuracy >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 90) return 'bg-emerald-500';
    if (accuracy >= 80) return 'bg-green-500';
    if (accuracy >= 70) return 'bg-yellow-500';
    if (accuracy >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <ArrowUp className="w-4 h-4 text-emerald-500" />;
    if (trend === 'declining') return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-3 text-gray-600">Loading accuracy reports...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            Penny AI Monthly Accuracy Report
          </h2>
          <p className="text-gray-600 mt-1">
            Compare Penny's predictions to actual performance across all markets
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {reports.map(r => (
                <SelectItem key={r.report_month} value={r.report_month}>
                  {new Date(r.report_month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={generateReport} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Generate Report
          </Button>
        </div>
      </div>

      {currentReport ? (
        <>
          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80">Overall Accuracy</p>
                    <p className="text-4xl font-bold">{currentReport.overall_accuracy_score.toFixed(1)}%</p>
                    {currentReport.improvement_from_previous !== 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {currentReport.improvement_from_previous > 0 ? (
                          <ArrowUp className="w-4 h-4 text-emerald-300" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-red-300" />
                        )}
                        <span className="text-sm">
                          {Math.abs(currentReport.improvement_from_previous).toFixed(1)}% from last month
                        </span>
                      </div>
                    )}
                  </div>
                  <Target className="w-12 h-12 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">ADR Accuracy</p>
                    <p className={`text-3xl font-bold ${getAccuracyColor(currentReport.overall_adr_accuracy)}`}>
                      {currentReport.overall_adr_accuracy.toFixed(1)}%
                    </p>
                  </div>
                  <BarChart3 className="w-10 h-10 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Occupancy Accuracy</p>
                    <p className={`text-3xl font-bold ${getAccuracyColor(currentReport.overall_occupancy_accuracy)}`}>
                      {currentReport.overall_occupancy_accuracy.toFixed(1)}%
                    </p>
                  </div>
                  <Calendar className="w-10 h-10 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Revenue Accuracy</p>
                    <p className={`text-3xl font-bold ${getAccuracyColor(currentReport.overall_revenue_accuracy)}`}>
                      {currentReport.overall_revenue_accuracy.toFixed(1)}%
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Best/Worst Markets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-emerald-700">Best Performing Market</p>
                    <p className="text-xl font-bold text-emerald-800">{currentReport.best_market}</p>
                    <p className="text-sm text-emerald-600">{currentReport.best_market_accuracy.toFixed(1)}% accuracy</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-orange-700">Needs Improvement</p>
                    <p className="text-xl font-bold text-orange-800">{currentReport.worst_market}</p>
                    <p className="text-sm text-orange-600">{currentReport.worst_market_accuracy.toFixed(1)}% accuracy</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="markets" className="w-full">
            <TabsList>
              <TabsTrigger value="markets">Market Breakdown</TabsTrigger>
              <TabsTrigger value="properties">Property Comparisons</TabsTrigger>
              <TabsTrigger value="trends">Accuracy Trends</TabsTrigger>
            </TabsList>

            <TabsContent value="markets" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Market-by-Market Accuracy</CardTitle>
                  <CardDescription>
                    Showing {currentReport.market_breakdown?.length || 0} markets with performance data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(currentReport.market_breakdown || []).sort((a, b) => b.overall_accuracy - a.overall_accuracy).map((market) => (
                      <div key={market.market} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold">{market.market}</span>
                            <Badge variant="outline" className="text-xs">
                              {market.sample_size} properties
                            </Badge>
                            {getTrendIcon(market.trend)}
                          </div>
                          <span className={`text-xl font-bold ${getAccuracyColor(market.overall_accuracy)}`}>
                            {market.overall_accuracy.toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-500">ADR</span>
                              <span className={getAccuracyColor(market.adr_accuracy)}>{market.adr_accuracy.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className={`h-2 rounded-full ${getAccuracyBg(market.adr_accuracy)}`} style={{ width: `${market.adr_accuracy}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-500">Occupancy</span>
                              <span className={getAccuracyColor(market.occupancy_accuracy)}>{market.occupancy_accuracy.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className={`h-2 rounded-full ${getAccuracyBg(market.occupancy_accuracy)}`} style={{ width: `${market.occupancy_accuracy}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-500">Revenue</span>
                              <span className={getAccuracyColor(market.revenue_accuracy)}>{market.revenue_accuracy.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className={`h-2 rounded-full ${getAccuracyBg(market.revenue_accuracy)}`} style={{ width: `${market.revenue_accuracy}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="properties" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Predicted vs Actual Performance</CardTitle>
                  <CardDescription>
                    Individual property comparisons
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Property</th>
                          <th className="text-right py-3 px-2">Pred. ADR</th>
                          <th className="text-right py-3 px-2">Actual ADR</th>
                          <th className="text-right py-3 px-2">Pred. Occ</th>
                          <th className="text-right py-3 px-2">Actual Occ</th>
                          <th className="text-right py-3 px-2">Pred. Rev</th>
                          <th className="text-right py-3 px-2">Actual Rev</th>
                          <th className="text-right py-3 px-2">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(currentReport.property_comparisons || []).slice(0, 20).map((prop, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{prop.city}</span>
                              </div>
                            </td>
                            <td className="text-right py-3 px-2">${prop.predicted_adr}</td>
                            <td className="text-right py-3 px-2">${prop.actual_adr}</td>
                            <td className="text-right py-3 px-2">{prop.predicted_occupancy}%</td>
                            <td className="text-right py-3 px-2">{prop.actual_occupancy}%</td>
                            <td className="text-right py-3 px-2">${prop.predicted_revenue.toLocaleString()}</td>
                            <td className="text-right py-3 px-2">${prop.actual_revenue.toLocaleString()}</td>
                            <td className={`text-right py-3 px-2 font-medium ${
                              prop.variance_pct <= 10 ? 'text-emerald-600' :
                              prop.variance_pct <= 20 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {prop.variance_pct.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Accuracy Trends Over Time</CardTitle>
                  <CardDescription>
                    Historical accuracy scores by month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reports.slice(0, 6).map((report) => (
                      <div key={report.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="w-32">
                          <p className="font-medium">
                            {new Date(report.report_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-gray-500">{report.total_actuals} properties</p>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-gray-500">Overall:</span>
                            <span className={`font-bold ${getAccuracyColor(report.overall_accuracy_score)}`}>
                              {report.overall_accuracy_score.toFixed(1)}%
                            </span>
                            {report.improvement_from_previous !== 0 && (
                              <span className={`text-xs ${report.improvement_from_previous > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                ({report.improvement_from_previous > 0 ? '+' : ''}{report.improvement_from_previous.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full ${getAccuracyBg(report.overall_accuracy_score)}`} 
                              style={{ width: `${report.overall_accuracy_score}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              onClick={shareWithInvestors}
              disabled={currentReport.shared_with_investors}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {currentReport.shared_with_investors ? 'Shared with Investors' : 'Share with Investors'}
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Reports Available</h3>
            <p className="text-gray-500 mb-4">
              Generate your first monthly accuracy report to see how Penny's predictions compare to actual performance.
            </p>
            <Button onClick={generateReport} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Generate First Report
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
