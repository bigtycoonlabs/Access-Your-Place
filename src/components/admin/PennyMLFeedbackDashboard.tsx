import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  BarChart3, 
  Plus, 
  Loader2,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  DollarSign,
  Percent,
  Building2,
  MapPin,
  RefreshCw,
  Download,
  LineChart,
  Database,
  Lightbulb
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface PerformanceRecord {
  id: string;
  property_id: string;
  tracking_period: string;
  period_start_date: string;
  period_end_date: string;
  actual_adr: number;
  actual_occupancy_rate: number;
  actual_gross_revenue: number;
  actual_net_revenue: number;
  predicted_adr: number;
  predicted_occupancy_rate: number;
  predicted_gross_revenue: number;
  adr_variance_pct: number;
  occupancy_variance_pct: number;
  revenue_variance_pct: number;
  market: string;
  operation_type: string;
  notes: string;
  created_at: string;
  properties?: {
    listing_title: string;
    address: string;
    city: string;
    state: string;
  };
}

interface AccuracyScore {
  id: string;
  market: string;
  calculation_date: string;
  sample_size: number;
  adr_accuracy_score: number;
  occupancy_accuracy_score: number;
  revenue_accuracy_score: number;
  overall_accuracy_score: number;
  accuracy_trend: string;
}

interface Property {
  id: string;
  listing_title: string;
  address: string;
  city: string;
  state: string;
  bedrooms: number;
  monthly_rent: number;
  penny_score: number;
  operation_type: string;
}

interface PennyMLFeedbackDashboardProps {
  staffId?: string;
  staffName?: string;
}

export function PennyMLFeedbackDashboard({ staffId, staffName }: PennyMLFeedbackDashboardProps) {
  const [performanceRecords, setPerformanceRecords] = useState<PerformanceRecord[]>([]);
  const [accuracyScores, setAccuracyScores] = useState<AccuracyScore[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const { toast } = useToast();

  // Form state for adding performance data
  const [form, setForm] = useState({
    property_id: '',
    tracking_period: '30_day',
    period_start_date: '',
    period_end_date: '',
    actual_adr: '',
    actual_occupancy_rate: '',
    actual_gross_revenue: '',
    actual_net_revenue: '',
    actual_expenses: '',
    actual_booking_count: '',
    avg_length_of_stay: '',
    operation_type: 'str',
    notes: '',
    challenges_faced: '',
    success_factors: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch performance records
      const { data: perfData } = await supabase
        .from('property_performance_actuals')
        .select(`
          *,
          properties:property_id (
            listing_title,
            address,
            city,
            state
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // Fetch accuracy scores
      const { data: accData } = await supabase
        .from('penny_accuracy_scores')
        .select('*')
        .order('calculation_date', { ascending: false });

      // Fetch properties for dropdown
      const { data: propData } = await supabase
        .from('properties')
        .select('id, listing_title, address, city, state, bedrooms, monthly_rent, penny_score, operation_type')
        .order('created_at', { ascending: false })
        .limit(200);

      setPerformanceRecords(perfData || []);
      setAccuracyScores(accData || []);
      setProperties(propData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast({ title: 'Error loading data', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleSubmitPerformance = async () => {
    if (!form.property_id || !form.actual_adr || !form.actual_occupancy_rate || !form.actual_gross_revenue) {
      toast({ title: 'Missing required fields', description: 'Please fill in property, ADR, occupancy, and gross revenue', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const selectedProperty = properties.find(p => p.id === form.property_id);
      
      const { data, error } = await supabase.functions.invoke('penny-deal-scoring', {
        body: {
          action: 'record_performance',
          property_id: form.property_id,
          tracking_period: form.tracking_period,
          period_start_date: form.period_start_date || null,
          period_end_date: form.period_end_date || null,
          actual_adr: parseFloat(form.actual_adr),
          actual_occupancy_rate: parseFloat(form.actual_occupancy_rate),
          actual_gross_revenue: parseFloat(form.actual_gross_revenue),
          actual_net_revenue: form.actual_net_revenue ? parseFloat(form.actual_net_revenue) : null,
          actual_expenses: form.actual_expenses ? parseFloat(form.actual_expenses) : null,
          actual_booking_count: form.actual_booking_count ? parseInt(form.actual_booking_count) : null,
          avg_length_of_stay: form.avg_length_of_stay ? parseFloat(form.avg_length_of_stay) : null,
          operation_type: form.operation_type,
          market: selectedProperty?.city?.toLowerCase().replace(/[^a-z]/g, '') || '',
          property_type: selectedProperty?.bedrooms ? `${selectedProperty.bedrooms}br` : 'unknown',
          bedroom_count: selectedProperty?.bedrooms,
          staff_id: staffId,
          notes: form.notes,
          challenges_faced: form.challenges_faced ? form.challenges_faced.split(',').map(s => s.trim()) : [],
          success_factors: form.success_factors ? form.success_factors.split(',').map(s => s.trim()) : []
        }
      });

      if (error) throw error;

      toast({ 
        title: 'Performance data recorded!', 
        description: `Variances: ADR ${data.variances?.adr?.toFixed(1)}%, Occupancy ${data.variances?.occupancy?.toFixed(1)}%, Revenue ${data.variances?.revenue?.toFixed(1)}%`
      });
      
      setAddModalOpen(false);
      setForm({
        property_id: '',
        tracking_period: '30_day',
        period_start_date: '',
        period_end_date: '',
        actual_adr: '',
        actual_occupancy_rate: '',
        actual_gross_revenue: '',
        actual_net_revenue: '',
        actual_expenses: '',
        actual_booking_count: '',
        avg_length_of_stay: '',
        operation_type: 'str',
        notes: '',
        challenges_faced: '',
        success_factors: ''
      });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error recording performance', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const recalculateAccuracy = async (market: string) => {
    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('penny-deal-scoring', {
        body: { action: 'calculate_accuracy', market }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ 
          title: 'Accuracy recalculated!', 
          description: `${market}: ${data.accuracy.overall.toFixed(1)}% overall accuracy (${data.sampleSize} samples)`
        });
        fetchData();
      } else {
        toast({ title: 'Insufficient data', description: data?.error || 'Need more performance records', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error recalculating', description: err.message, variant: 'destructive' });
    }
    setRecalculating(false);
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return 'text-gray-500';
    const absVar = Math.abs(variance);
    if (absVar <= 10) return 'text-emerald-600';
    if (absVar <= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getVarianceIcon = (variance: number | null) => {
    if (variance === null) return <Minus className="w-4 h-4" />;
    if (variance > 5) return <ArrowUp className="w-4 h-4 text-emerald-600" />;
    if (variance < -5) return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <Badge className="bg-emerald-500"><TrendingUp className="w-3 h-3 mr-1" />Improving</Badge>;
      case 'declining':
        return <Badge className="bg-red-500"><TrendingDown className="w-3 h-3 mr-1" />Declining</Badge>;
      default:
        return <Badge variant="secondary"><Minus className="w-3 h-3 mr-1" />Stable</Badge>;
    }
  };

  const filteredRecords = performanceRecords.filter(r => {
    if (selectedMarket !== 'all' && r.market !== selectedMarket) return false;
    if (selectedPeriod !== 'all' && r.tracking_period !== selectedPeriod) return false;
    return true;
  });

  // Get unique markets from records
  const markets = [...new Set(performanceRecords.map(r => r.market).filter(Boolean))];

  // Calculate aggregate stats
  const avgAdrVariance = filteredRecords.length > 0 
    ? filteredRecords.reduce((sum, r) => sum + (r.adr_variance_pct || 0), 0) / filteredRecords.length 
    : 0;
  const avgOccVariance = filteredRecords.length > 0 
    ? filteredRecords.reduce((sum, r) => sum + (r.occupancy_variance_pct || 0), 0) / filteredRecords.length 
    : 0;
  const avgRevVariance = filteredRecords.length > 0 
    ? filteredRecords.reduce((sum, r) => sum + (r.revenue_variance_pct || 0), 0) / filteredRecords.length 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-3">Loading ML feedback data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            Penny AI ML Feedback System
          </h2>
          <p className="text-gray-600 mt-1">
            Record actual performance data to improve Penny's predictions
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" />
          Record Performance
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-3xl font-bold">{performanceRecords.length}</p>
              </div>
              <Database className="w-10 h-10 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg ADR Variance</p>
                <p className={`text-3xl font-bold ${getVarianceColor(avgAdrVariance)}`}>
                  {avgAdrVariance > 0 ? '+' : ''}{avgAdrVariance.toFixed(1)}%
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Occupancy Variance</p>
                <p className={`text-3xl font-bold ${getVarianceColor(avgOccVariance)}`}>
                  {avgOccVariance > 0 ? '+' : ''}{avgOccVariance.toFixed(1)}%
                </p>
              </div>
              <Percent className="w-10 h-10 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Revenue Variance</p>
                <p className={`text-3xl font-bold ${getVarianceColor(avgRevVariance)}`}>
                  {avgRevVariance > 0 ? '+' : ''}{avgRevVariance.toFixed(1)}%
                </p>
              </div>
              <BarChart3 className="w-10 h-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="records" className="w-full">
        <TabsList>
          <TabsTrigger value="records">Performance Records</TabsTrigger>
          <TabsTrigger value="accuracy">Market Accuracy</TabsTrigger>
          <TabsTrigger value="insights">Training Insights</TabsTrigger>
        </TabsList>

        {/* Performance Records Tab */}
        <TabsContent value="records" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Performance Records</CardTitle>
                  <CardDescription>Actual vs predicted performance data for ML training</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Markets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Markets</SelectItem>
                      {markets.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Periods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Periods</SelectItem>
                      <SelectItem value="30_day">30 Day</SelectItem>
                      <SelectItem value="60_day">60 Day</SelectItem>
                      <SelectItem value="90_day">90 Day</SelectItem>
                      <SelectItem value="6_month">6 Month</SelectItem>
                      <SelectItem value="12_month">12 Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-2">No performance records yet</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Start recording actual property performance to train Penny AI
                  </p>
                  <Button onClick={() => setAddModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Record
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Property</th>
                        <th className="text-left py-3 px-2">Period</th>
                        <th className="text-right py-3 px-2">Actual ADR</th>
                        <th className="text-right py-3 px-2">Predicted</th>
                        <th className="text-right py-3 px-2">Variance</th>
                        <th className="text-right py-3 px-2">Actual Occ</th>
                        <th className="text-right py-3 px-2">Predicted</th>
                        <th className="text-right py-3 px-2">Variance</th>
                        <th className="text-right py-3 px-2">Revenue Var</th>
                        <th className="text-left py-3 px-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr key={record.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium truncate max-w-[200px]">
                                {record.properties?.listing_title || record.properties?.address || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {record.properties?.city}, {record.properties?.state}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant="outline">{record.tracking_period?.replace('_', ' ')}</Badge>
                          </td>
                          <td className="text-right py-3 px-2 font-medium">${record.actual_adr?.toFixed(0)}</td>
                          <td className="text-right py-3 px-2 text-gray-500">${record.predicted_adr?.toFixed(0) || '-'}</td>
                          <td className="text-right py-3 px-2">
                            <span className={`flex items-center justify-end gap-1 ${getVarianceColor(record.adr_variance_pct)}`}>
                              {getVarianceIcon(record.adr_variance_pct)}
                              {record.adr_variance_pct?.toFixed(1) || '-'}%
                            </span>
                          </td>
                          <td className="text-right py-3 px-2 font-medium">{record.actual_occupancy_rate?.toFixed(0)}%</td>
                          <td className="text-right py-3 px-2 text-gray-500">{record.predicted_occupancy_rate?.toFixed(0) || '-'}%</td>
                          <td className="text-right py-3 px-2">
                            <span className={`flex items-center justify-end gap-1 ${getVarianceColor(record.occupancy_variance_pct)}`}>
                              {getVarianceIcon(record.occupancy_variance_pct)}
                              {record.occupancy_variance_pct?.toFixed(1) || '-'}%
                            </span>
                          </td>
                          <td className="text-right py-3 px-2">
                            <span className={`flex items-center justify-end gap-1 ${getVarianceColor(record.revenue_variance_pct)}`}>
                              {getVarianceIcon(record.revenue_variance_pct)}
                              {record.revenue_variance_pct?.toFixed(1) || '-'}%
                            </span>
                          </td>
                          <td className="py-3 px-2 text-gray-500 text-xs">
                            {new Date(record.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Market Accuracy Tab */}
        <TabsContent value="accuracy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Market Accuracy Scores
              </CardTitle>
              <CardDescription>
                Penny's prediction accuracy by market based on actual performance data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accuracyScores.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-2">No accuracy scores calculated yet</p>
                  <p className="text-sm text-gray-400">
                    Record at least 3 performance records per market to calculate accuracy
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accuracyScores.map((score) => (
                    <Card key={score.id} className="border-2">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold capitalize">{score.market}</span>
                          </div>
                          {getTrendBadge(score.accuracy_trend)}
                        </div>
                        
                        <div className="text-center mb-4">
                          <p className="text-4xl font-bold text-purple-600">
                            {score.overall_accuracy_score?.toFixed(0)}%
                          </p>
                          <p className="text-sm text-gray-500">Overall Accuracy</p>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">ADR Accuracy:</span>
                            <span className={`font-medium ${score.adr_accuracy_score >= 80 ? 'text-emerald-600' : score.adr_accuracy_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {score.adr_accuracy_score?.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Occupancy Accuracy:</span>
                            <span className={`font-medium ${score.occupancy_accuracy_score >= 80 ? 'text-emerald-600' : score.occupancy_accuracy_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {score.occupancy_accuracy_score?.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Revenue Accuracy:</span>
                            <span className={`font-medium ${score.revenue_accuracy_score >= 80 ? 'text-emerald-600' : score.revenue_accuracy_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {score.revenue_accuracy_score?.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="text-gray-600">Sample Size:</span>
                            <span className="font-medium">{score.sample_size} properties</span>
                          </div>
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-4"
                          onClick={() => recalculateAccuracy(score.market)}
                          disabled={recalculating}
                        >
                          {recalculating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                          Recalculate
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Insights Tab */}
        <TabsContent value="insights" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Training Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Systematic Bias Detection */}
                {avgAdrVariance > 10 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-800">ADR Overestimation Detected</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          Penny is consistently overestimating ADR by {avgAdrVariance.toFixed(1)}%. 
                          Consider adjusting ADR multipliers down by ~{(avgAdrVariance * 0.8).toFixed(0)}%.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {avgAdrVariance < -10 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-800">ADR Underestimation Detected</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Penny is consistently underestimating ADR by {Math.abs(avgAdrVariance).toFixed(1)}%. 
                          Consider adjusting ADR multipliers up by ~{(Math.abs(avgAdrVariance) * 0.8).toFixed(0)}%.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {avgOccVariance > 10 && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-orange-800">Occupancy Overestimation</p>
                        <p className="text-sm text-orange-700 mt-1">
                          Occupancy predictions are {avgOccVariance.toFixed(1)}% higher than actual. 
                          Review seasonality factors and competition levels.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Data Collection Needs */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-purple-800">Data Collection Priority</p>
                      <p className="text-sm text-purple-700 mt-1">
                        {performanceRecords.length < 10 
                          ? `Need ${10 - performanceRecords.length} more records for reliable ML training.`
                          : performanceRecords.length < 50
                          ? `Good progress! ${50 - performanceRecords.length} more records recommended for robust model.`
                          : 'Excellent data volume for ML training!'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Success Pattern */}
                {performanceRecords.length >= 5 && avgRevVariance > -5 && avgRevVariance < 15 && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-emerald-800">Predictions Performing Well</p>
                        <p className="text-sm text-emerald-700 mt-1">
                          Revenue predictions are within acceptable variance ({Math.abs(avgRevVariance).toFixed(1)}%). 
                          Continue collecting data to maintain accuracy.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Variance Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* ADR Variance Distribution */}
                  <div>
                    <p className="text-sm font-medium mb-2">ADR Variance Distribution</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>-30%</span>
                      <span>0%</span>
                      <span>+30%</span>
                    </div>
                    <p className="text-center text-sm font-medium mt-2">
                      Average: <span className={getVarianceColor(avgAdrVariance)}>{avgAdrVariance > 0 ? '+' : ''}{avgAdrVariance.toFixed(1)}%</span>
                    </p>
                  </div>

                  {/* Occupancy Variance Distribution */}
                  <div>
                    <p className="text-sm font-medium mb-2">Occupancy Variance Distribution</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>-20%</span>
                      <span>0%</span>
                      <span>+20%</span>
                    </div>
                    <p className="text-center text-sm font-medium mt-2">
                      Average: <span className={getVarianceColor(avgOccVariance)}>{avgOccVariance > 0 ? '+' : ''}{avgOccVariance.toFixed(1)}%</span>
                    </p>
                  </div>

                  {/* Revenue Variance Distribution */}
                  <div>
                    <p className="text-sm font-medium mb-2">Revenue Variance Distribution</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>-40%</span>
                      <span>0%</span>
                      <span>+40%</span>
                    </div>
                    <p className="text-center text-sm font-medium mt-2">
                      Average: <span className={getVarianceColor(avgRevVariance)}>{avgRevVariance > 0 ? '+' : ''}{avgRevVariance.toFixed(1)}%</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Performance Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Record Actual Performance
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Property Selection */}
            <div>
              <Label>Property *</Label>
              <Select value={form.property_id} onValueChange={v => setForm({...form, property_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.listing_title || p.address}</span>
                        <Badge variant="outline" className="text-xs">{p.city}, {p.state}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tracking Period */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Tracking Period *</Label>
                <Select value={form.tracking_period} onValueChange={v => setForm({...form, tracking_period: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30_day">30 Day</SelectItem>
                    <SelectItem value="60_day">60 Day</SelectItem>
                    <SelectItem value="90_day">90 Day</SelectItem>
                    <SelectItem value="6_month">6 Month</SelectItem>
                    <SelectItem value="12_month">12 Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period Start</Label>
                <Input 
                  type="date" 
                  value={form.period_start_date}
                  onChange={e => setForm({...form, period_start_date: e.target.value})}
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input 
                  type="date" 
                  value={form.period_end_date}
                  onChange={e => setForm({...form, period_end_date: e.target.value})}
                />
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Actual Performance Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Actual ADR ($) *</Label>
                  <Input 
                    type="number" 
                    placeholder="150"
                    value={form.actual_adr}
                    onChange={e => setForm({...form, actual_adr: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Actual Occupancy (%) *</Label>
                  <Input 
                    type="number" 
                    placeholder="65"
                    value={form.actual_occupancy_rate}
                    onChange={e => setForm({...form, actual_occupancy_rate: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Gross Revenue ($) *</Label>
                  <Input 
                    type="number" 
                    placeholder="4500"
                    value={form.actual_gross_revenue}
                    onChange={e => setForm({...form, actual_gross_revenue: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Net Revenue ($)</Label>
                  <Input 
                    type="number" 
                    placeholder="3200"
                    value={form.actual_net_revenue}
                    onChange={e => setForm({...form, actual_net_revenue: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Total Expenses ($)</Label>
                  <Input 
                    type="number" 
                    placeholder="1300"
                    value={form.actual_expenses}
                    onChange={e => setForm({...form, actual_expenses: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Booking Count</Label>
                  <Input 
                    type="number" 
                    placeholder="8"
                    value={form.actual_booking_count}
                    onChange={e => setForm({...form, actual_booking_count: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Avg Length of Stay (nights)</Label>
                  <Input 
                    type="number" 
                    step="0.5"
                    placeholder="3.5"
                    value={form.avg_length_of_stay}
                    onChange={e => setForm({...form, avg_length_of_stay: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Operation Type</Label>
                  <Select value={form.operation_type} onValueChange={v => setForm({...form, operation_type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="str">STR</SelectItem>
                      <SelectItem value="coliving">Co-Living</SelectItem>
                      <SelectItem value="mtr">MTR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <Textarea 
                placeholder="Any observations about this period's performance..."
                value={form.notes}
                onChange={e => setForm({...form, notes: e.target.value})}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Challenges Faced (comma-separated)</Label>
                <Input 
                  placeholder="Low season, maintenance issues"
                  value={form.challenges_faced}
                  onChange={e => setForm({...form, challenges_faced: e.target.value})}
                />
              </div>
              <div>
                <Label>Success Factors (comma-separated)</Label>
                <Input 
                  placeholder="Great reviews, local events"
                  value={form.success_factors}
                  onChange={e => setForm({...form, success_factors: e.target.value})}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmitPerformance} 
              disabled={submitting || !form.property_id || !form.actual_adr || !form.actual_occupancy_rate || !form.actual_gross_revenue}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Recording...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" />Record Performance</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
