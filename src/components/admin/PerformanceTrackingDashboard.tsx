import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, TrendingUp, TrendingDown, BarChart3, Target, Brain,
  Plus, Calendar, DollarSign, Percent, Home, MapPin, CheckCircle,
  AlertTriangle, ArrowUp, ArrowDown, Minus, RefreshCw, Download
} from 'lucide-react';

interface Props {
  staffId: string;
}

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
  operation_type: string;
  market: string;
  notes: string;
  created_at: string;
}

interface AccuracyScore {
  market: string;
  operation_type: string;
  adr_accuracy_score: number;
  occupancy_accuracy_score: number;
  revenue_accuracy_score: number;
  overall_accuracy_score: number;
  sample_size: number;
  accuracy_trend: string;
  calculation_date: string;
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  bedrooms: number;
}

const TRACKING_PERIODS = [
  { value: '30_day', label: '30 Days' },
  { value: '60_day', label: '60 Days' },
  { value: '90_day', label: '90 Days' },
  { value: '6_month', label: '6 Months' },
  { value: '12_month', label: '12 Months' }
];

const OPERATION_TYPES = ['STR', 'MTR', 'Co-living', 'LTR', 'Hybrid'];

export function PerformanceTrackingDashboard({ staffId }: Props) {
  const [performanceData, setPerformanceData] = useState<PerformanceRecord[]>([]);
  const [accuracyScores, setAccuracyScores] = useState<AccuracyScore[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [activeTab, setActiveTab] = useState('input');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const { toast } = useToast();

  const [newRecord, setNewRecord] = useState({
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
    operation_type: 'STR',
    market: '',
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
      // Fetch performance data
      const { data: perfData } = await supabase.functions.invoke('penny-deal-scoring', {
        body: { action: 'get_all_performance_data', limit: 100 }
      });
      if (perfData?.success) {
        setPerformanceData(perfData.data || []);
      }

      // Fetch accuracy scores
      const { data: accData } = await supabase.functions.invoke('penny-deal-scoring', {
        body: { action: 'get_accuracy_scores' }
      });
      if (accData?.success) {
        setAccuracyScores(accData.scores || []);
      }

      // Fetch properties for dropdown
      const { data: propData } = await supabase.functions.invoke('get-properties', {
        body: { status: 'active', limit: 200 }
      });
      if (propData?.properties) {
        setProperties(propData.properties);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  const handleSubmitPerformance = async () => {
    if (!newRecord.property_id || !newRecord.actual_adr || !newRecord.actual_occupancy_rate) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('penny-deal-scoring', {
        body: {
          action: 'record_performance',
          property_id: newRecord.property_id,
          tracking_period: newRecord.tracking_period,
          period_start_date: newRecord.period_start_date,
          period_end_date: newRecord.period_end_date,
          actual_adr: parseFloat(newRecord.actual_adr),
          actual_occupancy_rate: parseFloat(newRecord.actual_occupancy_rate),
          actual_gross_revenue: parseFloat(newRecord.actual_gross_revenue) || null,
          actual_net_revenue: parseFloat(newRecord.actual_net_revenue) || null,
          actual_expenses: parseFloat(newRecord.actual_expenses) || null,
          actual_booking_count: parseInt(newRecord.actual_booking_count) || null,
          avg_length_of_stay: parseFloat(newRecord.avg_length_of_stay) || null,
          operation_type: newRecord.operation_type,
          market: newRecord.market,
          notes: newRecord.notes,
          challenges_faced: newRecord.challenges_faced ? newRecord.challenges_faced.split(',').map(s => s.trim()) : [],
          success_factors: newRecord.success_factors ? newRecord.success_factors.split(',').map(s => s.trim()) : [],
          staff_id: staffId
        }
      });

      if (data?.success) {
        toast({ 
          title: 'Performance Data Recorded', 
          description: 'The data has been added to Penny\'s ML training set.' 
        });
        setShowAddModal(false);
        setNewRecord({
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
          operation_type: 'STR',
          market: '',
          notes: '',
          challenges_faced: '',
          success_factors: ''
        });
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to record performance');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const recalculateAccuracy = async (market: string) => {
    setRecalculating(true);
    try {
      const { data } = await supabase.functions.invoke('penny-deal-scoring', {
        body: { action: 'calculate_accuracy', market }
      });

      if (data?.success) {
        toast({ 
          title: 'Accuracy Recalculated', 
          description: `${market} accuracy: ${data.accuracy.overall.toFixed(1)}%` 
        });
        fetchData();
      } else {
        toast({ 
          title: 'Insufficient Data', 
          description: data?.error || 'Need more performance records to calculate accuracy',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setRecalculating(false);
  };

  const getVarianceIcon = (variance: number | null) => {
    if (variance === null) return <Minus className="w-4 h-4 text-gray-400" />;
    if (Math.abs(variance) < 5) return <Minus className="w-4 h-4 text-gray-500" />;
    if (variance > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    return <ArrowDown className="w-4 h-4 text-red-500" />;
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return 'text-gray-400';
    if (Math.abs(variance) < 5) return 'text-gray-600';
    if (Math.abs(variance) < 10) return variance > 0 ? 'text-green-600' : 'text-orange-600';
    return variance > 0 ? 'text-green-700' : 'text-red-600';
  };

  const getAccuracyColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 80) return 'bg-green-400';
    if (score >= 70) return 'bg-yellow-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const uniqueMarkets = [...new Set(performanceData.map(p => p.market).filter(Boolean))];

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
            Penny AI Performance Tracking
          </h2>
          <p className="text-sm text-gray-500">
            Input actual performance data to improve Penny's prediction accuracy
          </p>
        </div>
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogTrigger asChild>
            <Button className="bg-[#d4a574] hover:bg-[#c49464]">
              <Plus className="w-4 h-4 mr-2" />
              Add Performance Data
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Actual Performance</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Property *</Label>
                  <Select
                    value={newRecord.property_id}
                    onValueChange={(v) => {
                      const prop = properties.find(p => p.id === v);
                      setNewRecord({ 
                        ...newRecord, 
                        property_id: v,
                        market: prop ? `${prop.city}, ${prop.state}` : ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map(prop => (
                        <SelectItem key={prop.id} value={prop.id}>
                          {prop.address} - {prop.city}, {prop.state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tracking Period *</Label>
                  <Select
                    value={newRecord.tracking_period}
                    onValueChange={(v) => setNewRecord({ ...newRecord, tracking_period: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRACKING_PERIODS.map(period => (
                        <SelectItem key={period.value} value={period.value}>
                          {period.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Operation Type *</Label>
                  <Select
                    value={newRecord.operation_type}
                    onValueChange={(v) => setNewRecord({ ...newRecord, operation_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATION_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="period-start-date">Period Start Date</Label>
                  <Input id="period-start-date"
                    type="date"
                    value={newRecord.period_start_date}
                    onChange={(e) => setNewRecord({ ...newRecord, period_start_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="period-end-date">Period End Date</Label>
                  <Input id="period-end-date"
                    type="date"
                    value={newRecord.period_end_date}
                    onChange={(e) => setNewRecord({ ...newRecord, period_end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Actual Performance Metrics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="actual-adr">Actual ADR ($) *</Label>
                    <Input id="actual-adr"
                      type="number"
                      value={newRecord.actual_adr}
                      onChange={(e) => setNewRecord({ ...newRecord, actual_adr: e.target.value })}
                      placeholder="e.g., 185"
                    />
                  </div>

                  <div>
                    <Label htmlFor="actual-occupancy-rate">Actual Occupancy Rate (%) *</Label>
                    <Input id="actual-occupancy-rate"
                      type="number"
                      value={newRecord.actual_occupancy_rate}
                      onChange={(e) => setNewRecord({ ...newRecord, actual_occupancy_rate: e.target.value })}
                      placeholder="e.g., 72"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gross-revenue">Gross Revenue ($)</Label>
                    <Input id="gross-revenue"
                      type="number"
                      value={newRecord.actual_gross_revenue}
                      onChange={(e) => setNewRecord({ ...newRecord, actual_gross_revenue: e.target.value })}
                      placeholder="Monthly gross"
                    />
                  </div>

                  <div>
                    <Label htmlFor="net-revenue">Net Revenue ($)</Label>
                    <Input id="net-revenue"
                      type="number"
                      value={newRecord.actual_net_revenue}
                      onChange={(e) => setNewRecord({ ...newRecord, actual_net_revenue: e.target.value })}
                      placeholder="After expenses"
                    />
                  </div>

                  <div>
                    <Label htmlFor="total-expenses">Total Expenses ($)</Label>
                    <Input id="total-expenses"
                      type="number"
                      value={newRecord.actual_expenses}
                      onChange={(e) => setNewRecord({ ...newRecord, actual_expenses: e.target.value })}
                      placeholder="Monthly expenses"
                    />
                  </div>

                  <div>
                    <Label htmlFor="booking-count">Booking Count</Label>
                    <Input id="booking-count"
                      type="number"
                      value={newRecord.actual_booking_count}
                      onChange={(e) => setNewRecord({ ...newRecord, actual_booking_count: e.target.value })}
                      placeholder="Number of bookings"
                    />
                  </div>

                  <div>
                    <Label htmlFor="avg-length-of-stay-nights">Avg Length of Stay (nights)</Label>
                    <Input id="avg-length-of-stay-nights"
                      type="number"
                      step="0.1"
                      value={newRecord.avg_length_of_stay}
                      onChange={(e) => setNewRecord({ ...newRecord, avg_length_of_stay: e.target.value })}
                      placeholder="e.g., 3.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="market">Market</Label>
                    <Input id="market"
                      value={newRecord.market}
                      onChange={(e) => setNewRecord({ ...newRecord, market: e.target.value })}
                      placeholder="e.g., Austin, TX"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Additional Context (for ML training)</h4>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes"
                      value={newRecord.notes}
                      onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                      placeholder="Any relevant observations about this property's performance..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="challenges-faced-commaseparated">Challenges Faced (comma-separated)</Label>
                    <Input id="challenges-faced-commaseparated"
                      value={newRecord.challenges_faced}
                      onChange={(e) => setNewRecord({ ...newRecord, challenges_faced: e.target.value })}
                      placeholder="e.g., Slow season, Competition, Maintenance issues"
                    />
                  </div>

                  <div>
                    <Label htmlFor="success-factors-commaseparated">Success Factors (comma-separated)</Label>
                    <Input id="success-factors-commaseparated"
                      value={newRecord.success_factors}
                      onChange={(e) => setNewRecord({ ...newRecord, success_factors: e.target.value })}
                      placeholder="e.g., Great location, Premium amenities, Strong reviews"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitPerformance}
                  disabled={saving}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Performance Data
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{performanceData.length}</p>
                <p className="text-sm text-blue-600">Performance Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">
                  {accuracyScores.length > 0 
                    ? `${Math.round(accuracyScores.reduce((a, b) => a + b.overall_accuracy_score, 0) / accuracyScores.length)}%`
                    : 'N/A'
                  }
                </p>
                <p className="text-sm text-green-600">Avg Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{uniqueMarkets.length}</p>
                <p className="text-sm text-purple-600">Markets Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">
                  {accuracyScores.filter(s => s.accuracy_trend === 'improving').length}
                </p>
                <p className="text-sm text-orange-600">Markets Improving</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="input">Performance Data</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy Scores</TabsTrigger>
          <TabsTrigger value="comparison">Predicted vs Actual</TabsTrigger>
        </TabsList>

        {/* Performance Data Tab */}
        <TabsContent value="input" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Performance Records</CardTitle>
                  <CardDescription>
                    Actual performance data feeding Penny's ML model
                  </CardDescription>
                </div>
                <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by market" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Markets</SelectItem>
                    {uniqueMarkets.map(market => (
                      <SelectItem key={market} value={market}>{market}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {performanceData.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-gray-500">No performance data yet</p>
                  <p className="text-sm text-gray-400">
                    Add actual performance data to train Penny's predictions
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Market</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Period</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Actual ADR</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Actual Occ.</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Revenue</th>
                        <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">Variance</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceData
                        .filter(p => selectedMarket === 'all' || p.market === selectedMarket)
                        .map((record) => (
                          <tr key={record.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{record.market || 'Unknown'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant="outline">
                                {TRACKING_PERIODS.find(p => p.value === record.tracking_period)?.label || record.tracking_period}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-right font-medium">
                              ${record.actual_adr?.toFixed(0)}
                            </td>
                            <td className="py-3 px-2 text-right font-medium">
                              {record.actual_occupancy_rate?.toFixed(1)}%
                            </td>
                            <td className="py-3 px-2 text-right font-medium">
                              ${record.actual_gross_revenue?.toLocaleString() || '-'}
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center justify-center gap-2">
                                {getVarianceIcon(record.revenue_variance_pct)}
                                <span className={getVarianceColor(record.revenue_variance_pct)}>
                                  {record.revenue_variance_pct !== null 
                                    ? `${record.revenue_variance_pct > 0 ? '+' : ''}${record.revenue_variance_pct.toFixed(1)}%`
                                    : '-'
                                  }
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-sm text-gray-500">
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

        {/* Accuracy Scores Tab */}
        <TabsContent value="accuracy" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Market Accuracy Scores</CardTitle>
              <CardDescription>
                How accurate are Penny's predictions for each market?
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accuracyScores.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-gray-500">No accuracy data yet</p>
                  <p className="text-sm text-gray-400">
                    Add more performance records to calculate accuracy
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {accuracyScores.map((score) => (
                    <div 
                      key={`${score.market}-${score.operation_type}`}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-[#d4a574]" />
                          <div>
                            <h4 className="font-medium">{score.market}</h4>
                            <p className="text-sm text-gray-500">
                              {score.sample_size} properties • {score.operation_type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {getTrendIcon(score.accuracy_trend)}
                            <span className="text-sm capitalize">{score.accuracy_trend}</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => recalculateAccuracy(score.market)}
                            disabled={recalculating}
                          >
                            <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${score.overall_accuracy_score >= 80 ? 'text-green-600' : score.overall_accuracy_score >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {score.overall_accuracy_score.toFixed(1)}%
                          </div>
                          <p className="text-xs text-gray-500">Overall</p>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-semibold text-gray-700">
                            {score.adr_accuracy_score.toFixed(1)}%
                          </div>
                          <p className="text-xs text-gray-500">ADR Accuracy</p>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-semibold text-gray-700">
                            {score.occupancy_accuracy_score.toFixed(1)}%
                          </div>
                          <p className="text-xs text-gray-500">Occupancy</p>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-semibold text-gray-700">
                            {score.revenue_accuracy_score.toFixed(1)}%
                          </div>
                          <p className="text-xs text-gray-500">Revenue</p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getAccuracyColor(score.overall_accuracy_score)} transition-all`}
                            style={{ width: `${score.overall_accuracy_score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Predicted vs Actual Comparison</CardTitle>
              <CardDescription>
                See how Penny's predictions compare to actual results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performanceData.filter(p => p.predicted_adr).length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-gray-500">No comparison data available</p>
                  <p className="text-sm text-gray-400">
                    Records need both predicted and actual values
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {performanceData
                    .filter(p => p.predicted_adr)
                    .slice(0, 10)
                    .map((record) => (
                      <div key={record.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-medium">{record.market}</h4>
                            <p className="text-sm text-gray-500">{record.operation_type}</p>
                          </div>
                          <Badge variant="outline">
                            {TRACKING_PERIODS.find(p => p.value === record.tracking_period)?.label}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                          {/* ADR Comparison */}
                          <div>
                            <p className="text-sm text-gray-500 mb-2">ADR</p>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-gray-400">Predicted</p>
                                <p className="font-medium">${record.predicted_adr?.toFixed(0)}</p>
                              </div>
                              <div className="text-center">
                                {getVarianceIcon(record.adr_variance_pct)}
                                <p className={`text-xs ${getVarianceColor(record.adr_variance_pct)}`}>
                                  {record.adr_variance_pct?.toFixed(1)}%
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-400">Actual</p>
                                <p className="font-medium">${record.actual_adr?.toFixed(0)}</p>
                              </div>
                            </div>
                          </div>

                          {/* Occupancy Comparison */}
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Occupancy</p>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-gray-400">Predicted</p>
                                <p className="font-medium">{record.predicted_occupancy_rate?.toFixed(1)}%</p>
                              </div>
                              <div className="text-center">
                                {getVarianceIcon(record.occupancy_variance_pct)}
                                <p className={`text-xs ${getVarianceColor(record.occupancy_variance_pct)}`}>
                                  {record.occupancy_variance_pct?.toFixed(1)}pts
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-400">Actual</p>
                                <p className="font-medium">{record.actual_occupancy_rate?.toFixed(1)}%</p>
                              </div>
                            </div>
                          </div>

                          {/* Revenue Comparison */}
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Revenue</p>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-gray-400">Predicted</p>
                                <p className="font-medium">${record.predicted_gross_revenue?.toLocaleString()}</p>
                              </div>
                              <div className="text-center">
                                {getVarianceIcon(record.revenue_variance_pct)}
                                <p className={`text-xs ${getVarianceColor(record.revenue_variance_pct)}`}>
                                  {record.revenue_variance_pct?.toFixed(1)}%
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-400">Actual</p>
                                <p className="font-medium">${record.actual_gross_revenue?.toLocaleString()}</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
