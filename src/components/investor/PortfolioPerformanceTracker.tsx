import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, TrendingUp, TrendingDown, DollarSign, Calendar, 
  BarChart3, PieChart, Plus, ChevronRight, Building2, Target,
  Lightbulb, CheckCircle, X, ArrowUpRight, ArrowDownRight,
  Sparkles, RefreshCw, Home, Percent, BedDouble
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
}

interface PortfolioProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  monthly_earnings: number;
  initial_investment: number;
  property_type: string;
  property_status: string;
  monthly_data?: MonthlyData[];
  latest_performance?: MonthlyData;
  market_benchmark?: MarketBenchmark;
  performance_vs_market?: {
    revenue_diff: number;
    occupancy_diff: number;
    adr_diff: number;
  };
}

interface MonthlyData {
  id: string;
  month: string;
  gross_revenue: number;
  occupancy_rate: number;
  total_nights_booked: number;
  average_daily_rate: number;
  cleaning_expenses: number;
  utility_expenses: number;
  maintenance_expenses: number;
  rent_expense: number;
  other_expenses: number;
  net_profit: number;
  notes?: string;
}

interface MarketBenchmark {
  city: string;
  state: string;
  average_adr: number;
  average_occupancy: number;
  average_monthly_revenue: number;
}

interface AISuggestion {
  id: string;
  suggestion_type: string;
  title: string;
  description: string;
  priority: string;
  potential_impact: string;
  status: string;
  property_city?: string;
}

interface PortfolioSummary {
  total_properties: number;
  total_invested: number;
  avg_monthly_revenue: number;
  avg_occupancy: number;
  avg_adr: number;
  total_net_profit_3mo: number;
  annual_roi: number;
  vs_market: {
    revenue_diff: number;
    occupancy_diff: number;
    adr_diff: number;
  };
  market_benchmarks: {
    avg_revenue: number;
    avg_occupancy: number;
    avg_adr: number;
  };
}

const emptyMonthlyData = {
  gross_revenue: 0,
  occupancy_rate: 0,
  total_nights_booked: 0,
  average_daily_rate: 0,
  cleaning_expenses: 0,
  utility_expenses: 0,
  maintenance_expenses: 0,
  rent_expense: 0,
  other_expenses: 0,
  notes: ''
};

export function PortfolioPerformanceTracker({ investorId, investorName }: Props) {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PortfolioProperty | null>(null);
  const [showDataEntry, setShowDataEntry] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [monthlyFormData, setMonthlyFormData] = useState(emptyMonthlyData);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const fetchPortfolioData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio-performance', {
        body: { action: 'get_portfolio_with_performance', investor_id: investorId }
      });

      if (data?.success) {
        setProperties(data.properties || []);
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching portfolio:', err);
    }
    setLoading(false);
  }, [investorId]);

  const fetchSuggestions = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('manage-portfolio-performance', {
        body: { action: 'get_suggestions', investor_id: investorId }
      });
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    }
  }, [investorId]);

  useEffect(() => {
    fetchPortfolioData();
    fetchSuggestions();
  }, [fetchPortfolioData, fetchSuggestions]);

  const generateNewSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data } = await supabase.functions.invoke('manage-portfolio-performance', {
        body: { action: 'generate_ai_suggestions', investor_id: investorId }
      });
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        toast({ title: 'Suggestions Generated', description: `Penny analyzed your portfolio and found ${data.suggestions.length} optimization opportunities.` });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to generate suggestions', variant: 'destructive' });
    }
    setLoadingSuggestions(false);
  };

  const handleSaveMonthlyData = async () => {
    if (!selectedProperty) return;
    
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio-performance', {
        body: {
          action: 'save_monthly_data',
          investor_id: investorId,
          property_id: selectedProperty.id,
          month: selectedMonth,
          data: monthlyFormData
        }
      });

      if (data?.success) {
        toast({ title: 'Data Saved', description: 'Monthly performance data has been recorded.' });
        setShowDataEntry(false);
        setMonthlyFormData(emptyMonthlyData);
        fetchPortfolioData();
      } else {
        throw new Error(data?.error || 'Failed to save data');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDismissSuggestion = async (suggestionId: string) => {
    try {
      await supabase.functions.invoke('manage-portfolio-performance', {
        body: { action: 'update_suggestion', investor_id: investorId, suggestion_id: suggestionId, status: 'dismissed' }
      });
      setSuggestions(suggestions.filter(s => s.id !== suggestionId));
    } catch (err) {
      console.error('Error dismissing suggestion:', err);
    }
  };

  const handleImplementSuggestion = async (suggestionId: string) => {
    try {
      await supabase.functions.invoke('manage-portfolio-performance', {
        body: { action: 'update_suggestion', investor_id: investorId, suggestion_id: suggestionId, status: 'implemented' }
      });
      setSuggestions(suggestions.filter(s => s.id !== suggestionId));
      toast({ title: 'Great!', description: 'Suggestion marked as implemented. Keep optimizing!' });
    } catch (err) {
      console.error('Error updating suggestion:', err);
    }
  };

  const openDataEntry = (property: PortfolioProperty) => {
    setSelectedProperty(property);
    // Pre-fill with existing data if available for selected month
    const existingData = property.monthly_data?.find(d => d.month === selectedMonth);
    if (existingData) {
      setMonthlyFormData({
        gross_revenue: existingData.gross_revenue,
        occupancy_rate: existingData.occupancy_rate,
        total_nights_booked: existingData.total_nights_booked,
        average_daily_rate: existingData.average_daily_rate,
        cleaning_expenses: existingData.cleaning_expenses,
        utility_expenses: existingData.utility_expenses,
        maintenance_expenses: existingData.maintenance_expenses,
        rent_expense: existingData.rent_expense || property.monthly_rent,
        other_expenses: existingData.other_expenses,
        notes: existingData.notes || ''
      });
    } else {
      setMonthlyFormData({
        ...emptyMonthlyData,
        rent_expense: property.monthly_rent
      });
    }
    setShowDataEntry(true);
  };

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'pricing': return <DollarSign className="w-5 h-5" />;
      case 'amenity': return <Home className="w-5 h-5" />;
      case 'market_expansion': return <Target className="w-5 h-5" />;
      case 'operational': return <BarChart3 className="w-5 h-5" />;
      case 'seasonal': return <Calendar className="w-5 h-5" />;
      default: return <Lightbulb className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading portfolio performance">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" aria-hidden="true" />
        <span className="sr-only">Loading portfolio performance data...</span>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-600">No Properties to Track</h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Add properties to your portfolio first, then you can track their monthly performance, 
            compare against market benchmarks, and receive AI-powered optimization suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Portfolio Performance Tracker">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="properties" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" aria-hidden="true" />
            <span>Properties</span>
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>AI Suggestions</span>
            {suggestions.length > 0 && (
              <Badge className="ml-1 bg-[#d4a574]">{suggestions.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {summary && (
            <>
              {/* Portfolio Summary Cards */}
              <section aria-labelledby="portfolio-metrics-heading">
                <h2 id="portfolio-metrics-heading" className="sr-only">Portfolio Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Monthly Revenue</p>
                          <p className="text-2xl font-bold">${summary.avg_monthly_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className={`flex items-center text-sm ${summary.vs_market.revenue_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {summary.vs_market.revenue_diff >= 0 ? (
                            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                          )}
                          <span>{Math.abs(summary.vs_market.revenue_diff).toFixed(1)}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        vs market avg: ${summary.market_benchmarks.avg_revenue.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Occupancy</p>
                          <p className="text-2xl font-bold">{summary.avg_occupancy.toFixed(1)}%</p>
                        </div>
                        <div className={`flex items-center text-sm ${summary.vs_market.occupancy_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {summary.vs_market.occupancy_diff >= 0 ? (
                            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                          )}
                          <span>{Math.abs(summary.vs_market.occupancy_diff).toFixed(1)}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        vs market avg: {summary.market_benchmarks.avg_occupancy.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Avg ADR</p>
                          <p className="text-2xl font-bold">${summary.avg_adr.toFixed(0)}</p>
                        </div>
                        <div className={`flex items-center text-sm ${summary.vs_market.adr_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {summary.vs_market.adr_diff >= 0 ? (
                            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                          )}
                          <span>${Math.abs(summary.vs_market.adr_diff).toFixed(0)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        vs market avg: ${summary.market_benchmarks.avg_adr.toFixed(0)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Annual ROI</p>
                        <p className="text-2xl font-bold text-[#d4a574]">{summary.annual_roi.toFixed(1)}%</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on ${summary.total_invested.toLocaleString()} invested
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* Market Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                    Portfolio vs Market Benchmarks
                  </CardTitle>
                  <CardDescription>
                    How your portfolio compares to average market performance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Revenue Performance</span>
                      <span className={summary.vs_market.revenue_diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {summary.vs_market.revenue_diff >= 0 ? '+' : ''}{summary.vs_market.revenue_diff.toFixed(1)}% vs market
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, Math.max(0, 50 + summary.vs_market.revenue_diff))} 
                      className="h-3"
                      aria-label={`Revenue performance: ${summary.vs_market.revenue_diff.toFixed(1)}% vs market`}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Occupancy Rate</span>
                      <span className={summary.vs_market.occupancy_diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {summary.vs_market.occupancy_diff >= 0 ? '+' : ''}{summary.vs_market.occupancy_diff.toFixed(1)}% vs market
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, Math.max(0, 50 + summary.vs_market.occupancy_diff * 2))} 
                      className="h-3"
                      aria-label={`Occupancy rate: ${summary.vs_market.occupancy_diff.toFixed(1)}% vs market`}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Average Daily Rate</span>
                      <span className={summary.vs_market.adr_diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {summary.vs_market.adr_diff >= 0 ? '+' : ''}${summary.vs_market.adr_diff.toFixed(0)} vs market
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, Math.max(0, 50 + (summary.vs_market.adr_diff / 2)))} 
                      className="h-3"
                      aria-label={`ADR: $${summary.vs_market.adr_diff.toFixed(0)} vs market`}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Suggestions Preview */}
              {suggestions.length > 0 && (
                <Card className="border-[#d4a574]/30 bg-[#d4a574]/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                      Penny's Top Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {suggestions.slice(0, 2).map((suggestion) => (
                        <div key={suggestion.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                          <div className="p-2 bg-[#d4a574]/10 rounded-lg text-[#d4a574]">
                            {getSuggestionIcon(suggestion.suggestion_type)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{suggestion.title}</h4>
                            <p className="text-sm text-gray-600 line-clamp-2">{suggestion.description}</p>
                          </div>
                          <Badge className={getPriorityColor(suggestion.priority)}>
                            {suggestion.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4"
                      onClick={() => setActiveTab('suggestions')}
                    >
                      View All Suggestions
                      <ChevronRight className="w-4 h-4 ml-2" aria-hidden="true" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Properties Tab */}
        <TabsContent value="properties" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Property Performance</h2>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4" role="list" aria-label="Properties list">
            {properties.map((property) => (
              <Card key={property.id} role="listitem">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-400" aria-hidden="true" />
                        <h3 className="font-semibold">{property.address}</h3>
                      </div>
                      <p className="text-sm text-gray-500">{property.city}, {property.state}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">
                          <BedDouble className="w-3 h-3 mr-1" aria-hidden="true" />
                          {property.bedrooms} bed
                        </Badge>
                        <Badge variant="outline">{property.property_type}</Badge>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-500">Revenue</p>
                        <p className="font-bold">
                          ${property.latest_performance?.gross_revenue?.toLocaleString() || property.monthly_earnings?.toLocaleString() || '0'}
                        </p>
                        {property.performance_vs_market && (
                          <p className={`text-xs ${property.performance_vs_market.revenue_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {property.performance_vs_market.revenue_diff >= 0 ? '+' : ''}{property.performance_vs_market.revenue_diff.toFixed(0)}%
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-500">Occupancy</p>
                        <p className="font-bold">
                          {property.latest_performance?.occupancy_rate?.toFixed(0) || '65'}%
                        </p>
                        {property.performance_vs_market && (
                          <p className={`text-xs ${property.performance_vs_market.occupancy_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {property.performance_vs_market.occupancy_diff >= 0 ? '+' : ''}{property.performance_vs_market.occupancy_diff.toFixed(0)}%
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-500">ADR</p>
                        <p className="font-bold">
                          ${property.latest_performance?.average_daily_rate?.toFixed(0) || '165'}
                        </p>
                        {property.performance_vs_market && (
                          <p className={`text-xs ${property.performance_vs_market.adr_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {property.performance_vs_market.adr_diff >= 0 ? '+' : ''}${property.performance_vs_market.adr_diff.toFixed(0)}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button 
                      onClick={() => openDataEntry(property)}
                      className="bg-[#d4a574] hover:bg-[#c49464]"
                    >
                      <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                      Log Data
                    </Button>
                  </div>

                  {/* Market Benchmark Comparison */}
                  {property.market_benchmark && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-500 mb-2">
                        Market Benchmark ({property.market_benchmark.city}, {property.market_benchmark.state})
                      </p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Avg Revenue:</span>
                          <span className="ml-2 font-medium">${property.market_benchmark.average_monthly_revenue?.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Avg Occupancy:</span>
                          <span className="ml-2 font-medium">{property.market_benchmark.average_occupancy}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Avg ADR:</span>
                          <span className="ml-2 font-medium">${property.market_benchmark.average_adr}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* AI Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">AI-Powered Suggestions</h2>
              <p className="text-sm text-gray-500">Penny analyzes your portfolio and market data to find optimization opportunities</p>
            </div>
            <Button 
              onClick={generateNewSuggestions} 
              disabled={loadingSuggestions}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {loadingSuggestions ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              )}
              Generate New Suggestions
            </Button>
          </div>

          {suggestions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                <h3 className="text-lg font-medium text-gray-600">No Active Suggestions</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  Click "Generate New Suggestions" to have Penny analyze your portfolio and provide optimization recommendations.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4" role="list" aria-label="AI suggestions list">
              {suggestions.map((suggestion) => (
                <Card key={suggestion.id} className="overflow-hidden" role="listitem">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${
                        suggestion.suggestion_type === 'pricing' ? 'bg-blue-100 text-blue-600' :
                        suggestion.suggestion_type === 'amenity' ? 'bg-purple-100 text-purple-600' :
                        suggestion.suggestion_type === 'market_expansion' ? 'bg-green-100 text-green-600' :
                        suggestion.suggestion_type === 'operational' ? 'bg-orange-100 text-orange-600' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>
                        {getSuggestionIcon(suggestion.suggestion_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{suggestion.title}</h3>
                          <Badge className={getPriorityColor(suggestion.priority)}>
                            {suggestion.priority}
                          </Badge>
                        </div>
                        <p className="text-gray-600">{suggestion.description}</p>
                        {suggestion.potential_impact && (
                          <p className="text-sm text-[#d4a574] font-medium mt-2">
                            Potential Impact: {suggestion.potential_impact}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDismissSuggestion(suggestion.id)}
                          aria-label={`Dismiss suggestion: ${suggestion.title}`}
                        >
                          <X className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleImplementSuggestion(suggestion.id)}
                          className="bg-green-600 hover:bg-green-700"
                          aria-label={`Mark as implemented: ${suggestion.title}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" aria-hidden="true" />
                          Done
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Monthly Data Entry Modal */}
      <Dialog open={showDataEntry} onOpenChange={setShowDataEntry}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Monthly Performance</DialogTitle>
            <DialogDescription>
              {selectedProperty?.address}, {selectedProperty?.city} - {new Date(selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSaveMonthlyData(); }} className="space-y-6">
            {/* Revenue Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" aria-hidden="true" />
                Revenue
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gross_revenue">Gross Revenue ($)</Label>
                  <Input
                    id="gross_revenue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyFormData.gross_revenue}
                    onChange={(e) => setMonthlyFormData({ ...monthlyFormData, gross_revenue: parseFloat(e.target.value) || 0 })}
                    placeholder="3500"
                  />
                </div>
                <div>
                  <Label htmlFor="total_nights">Total Nights Booked</Label>
                  <Input
                    id="total_nights"
                    type="number"
                    min="0"
                    max="31"
                    value={monthlyFormData.total_nights_booked}
                    onChange={(e) => setMonthlyFormData({ ...monthlyFormData, total_nights_booked: parseInt(e.target.value) || 0 })}
                    placeholder="20"
                  />
                </div>
                <div>
                  <Label htmlFor="occupancy">Occupancy Rate (%)</Label>
                  <Input
                    id="occupancy"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={monthlyFormData.occupancy_rate}
                    onChange={(e) => setMonthlyFormData({ ...monthlyFormData, occupancy_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="65"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank to auto-calculate from nights booked</p>
                </div>
                <div>
                  <Label htmlFor="adr">Average Daily Rate ($)</Label>
                  <Input
                    id="adr"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyFormData.average_daily_rate}
                    onChange={(e) => setMonthlyFormData({ ...monthlyFormData, average_daily_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="175"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank to auto-calculate from revenue/nights</p>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-red-600" aria-hidden="true" />
                Expenses
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rent">Rent Expense ($)</Label>
                  <Input
                    id="rent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyFormData.rent_expense}
                    onChange={(e) => setMonthlyFormData({ ...monthlyFormData, rent_expense: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="cleaning">Cleaning Expenses ($)</Label>
                  <Input
                    id="cleaning"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyFormData.cleaning_expenses}
                    onChange={(e) => setMonthlyFormData({ ...monthlyFormData, cleaning_expenses: parseFloat(e.target.value) || 0 })}
                    placeholder="400"
                  />
                </div>
                <div>
                  <Label htmlFor="utilities">Utility Expenses ($)</Label>
                  <Input
                    id="utilities"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyFormData.utility_expenses}
                    onChange={(e) => setMonthlyFormData({ ...monthlyFormData, utility_expenses: parseFloat(e.target.value) || 0 })}
                    placeholder="200"
                  />
                </div>
                <div>
                  <Label htmlFor="maintenance">Maintenance Expenses ($)</Label>
                  <Input
                    id="maintenance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyFormData.maintenance_expenses}
                    onChange={(e) => setMonthlyFormData({ ...monthlyFormData, maintenance_expenses: parseFloat(e.target.value) || 0 })}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label htmlFor="other">Other Expenses ($)</Label>
                  <Input
                    id="other"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyFormData.other_expenses}
                    onChange={(e) => setMonthlyFormData({ ...monthlyFormData, other_expenses: parseFloat(e.target.value) || 0 })}
                    placeholder="50"
                  />
                </div>
              </div>
            </div>

            {/* Net Profit Preview */}
            <Card className="bg-gray-50">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Estimated Net Profit</span>
                  <span className={`text-xl font-bold ${
                    (monthlyFormData.gross_revenue - monthlyFormData.rent_expense - monthlyFormData.cleaning_expenses - 
                     monthlyFormData.utility_expenses - monthlyFormData.maintenance_expenses - monthlyFormData.other_expenses) >= 0 
                      ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${(monthlyFormData.gross_revenue - monthlyFormData.rent_expense - monthlyFormData.cleaning_expenses - 
                       monthlyFormData.utility_expenses - monthlyFormData.maintenance_expenses - monthlyFormData.other_expenses).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={monthlyFormData.notes}
                onChange={(e) => setMonthlyFormData({ ...monthlyFormData, notes: e.target.value })}
                placeholder="Any notes about this month's performance..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDataEntry(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Save Data
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
