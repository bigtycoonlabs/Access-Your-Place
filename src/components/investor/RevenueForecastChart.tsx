
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, TrendingUp, TrendingDown, AlertTriangle, 
  RefreshCw, Calendar, DollarSign, Percent, Sparkles
} from 'lucide-react';

interface Forecast {
  id: string;
  property_id: string;
  forecast_date: string;
  predicted_revenue: number;
  predicted_occupancy: number;
  predicted_adr: number;
  confidence_score: number;
  actual_revenue?: number;
  actual_occupancy?: number;
  variance_pct?: number;
  factors: {
    seasonal_adjustment?: number;
    market_trend?: number;
    local_events?: string[];
    ai_adjustment?: number;
  };
  investor_portfolio?: {
    city: string;
    state: string;
    address?: string;
  };
}

interface Alert {
  type: 'underperforming' | 'low_confidence';
  severity: 'high' | 'medium' | 'low';
  property: { city: string; state: string };
  message: string;
  forecast_date: string;
  variance_pct?: number;
}

interface ChartDataPoint {
  month: string;
  predicted_revenue: number;
  actual_revenue: number | null;
  predicted_occupancy: number;
  actual_occupancy: number | null;
}

interface RevenueForecastChartProps {
  investorId: string;
}

export function RevenueForecastChart({ investorId }: RevenueForecastChartProps) {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [properties, setProperties] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [investorId, selectedProperty]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load properties
      const { data: props } = await supabase
        .from('investor_portfolio')
        .select('id, city, state, address')
        .eq('investor_id', investorId)
        .eq('property_status', 'active');
      
      setProperties(props || []);

      // Load forecasts
      const { data: forecastData } = await supabase.functions.invoke('revenue-forecasting', {
        body: { 
          action: 'get_forecasts', 
          investor_id: investorId,
          property_id: selectedProperty !== 'all' ? selectedProperty : undefined
        }
      });
      
      setForecasts(forecastData?.forecasts || []);

      // Load alerts
      const { data: alertData } = await supabase.functions.invoke('revenue-forecasting', {
        body: { action: 'get_alerts', investor_id: investorId }
      });
      
      setAlerts(alertData?.alerts || []);

      // Load chart data
      const { data: chartResult } = await supabase.functions.invoke('revenue-forecasting', {
        body: { 
          action: 'get_forecast_chart_data', 
          investor_id: investorId,
          property_id: selectedProperty !== 'all' ? selectedProperty : undefined,
          months: 12
        }
      });
      
      setChartData(chartResult?.chart_data || []);
    } catch (err) {
      console.error('Error loading forecast data:', err);
    }
    setLoading(false);
  };

  const generateForecasts = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('revenue-forecasting', {
        body: { 
          action: 'generate_forecast', 
          investor_id: investorId,
          property_id: selectedProperty !== 'all' ? selectedProperty : undefined,
          months_ahead: 6
        }
      });

      if (error) throw error;

      toast({
        title: 'Forecasts Generated',
        description: data?.message || 'AI-powered revenue forecasts have been generated.'
      });

      loadData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to generate forecasts',
        variant: 'destructive'
      });
    }
    setGenerating(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  // Calculate summary stats
  const totalPredicted = forecasts
    .filter(f => new Date(f.forecast_date) > new Date())
    .reduce((sum, f) => sum + f.predicted_revenue, 0);
  
  const avgConfidence = forecasts.length > 0
    ? forecasts.reduce((sum, f) => sum + f.confidence_score, 0) / forecasts.length
    : 0;

  const upcomingForecasts = forecasts
    .filter(f => new Date(f.forecast_date) > new Date())
    .slice(0, 6);

  // Find max value for chart scaling
  const maxRevenue = Math.max(
    ...chartData.map(d => Math.max(d.predicted_revenue, d.actual_revenue || 0))
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#d4a574]" />
            AI Revenue Forecasting
          </h2>
          <p className="text-gray-600">
            Predictive analytics based on historical data, seasonal trends, and market conditions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.city}, {p.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={generateForecasts} 
            disabled={generating}
            className="bg-[#d4a574] hover:bg-[#c49464]"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Generate Forecasts
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">6-Month Forecast</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPredicted)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Confidence</p>
                <p className="text-2xl font-bold">{avgConfidence.toFixed(0)}%</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Percent className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Properties Tracked</p>
                <p className="text-2xl font-bold">{properties.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Alerts</p>
                <p className="text-2xl font-bold">{alerts.length}</p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                alerts.length > 0 ? 'bg-amber-100' : 'bg-gray-100'
              }`}>
                <AlertTriangle className={`w-6 h-6 ${
                  alerts.length > 0 ? 'text-amber-600' : 'text-gray-400'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              Performance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    alert.severity === 'high' ? 'bg-red-50 border-red-200' :
                    alert.severity === 'medium' ? 'bg-amber-50 border-amber-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {alert.property?.city}, {alert.property?.state} • {new Date(alert.forecast_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={
                      alert.severity === 'high' ? 'destructive' :
                      alert.severity === 'medium' ? 'default' : 'secondary'
                    }>
                      {alert.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Projected vs Actual Revenue</CardTitle>
          <CardDescription>
            Monthly revenue comparison with AI predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No forecast data available yet.</p>
              <p className="text-sm">Click "Generate Forecasts" to create AI predictions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Simple bar chart */}
              <div className="flex items-end gap-2 h-64 border-b border-l pl-8 pb-8 relative">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-gray-500">
                  <span>{formatCurrency(maxRevenue)}</span>
                  <span>{formatCurrency(maxRevenue / 2)}</span>
                  <span>$0</span>
                </div>
                
                {chartData.map((point, idx) => {
                  const predictedHeight = maxRevenue > 0 ? (point.predicted_revenue / maxRevenue) * 100 : 0;
                  const actualHeight = point.actual_revenue && maxRevenue > 0 
                    ? (point.actual_revenue / maxRevenue) * 100 
                    : 0;
                  
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex items-end gap-1 h-48 w-full justify-center">
                        {/* Predicted bar */}
                        <div 
                          className="w-4 bg-blue-400 rounded-t transition-all hover:bg-blue-500"
                          style={{ height: `${predictedHeight}%` }}
                          title={`Predicted: ${formatCurrency(point.predicted_revenue)}`}
                        />
                        {/* Actual bar */}
                        {point.actual_revenue !== null && (
                          <div 
                            className="w-4 bg-green-500 rounded-t transition-all hover:bg-green-600"
                            style={{ height: `${actualHeight}%` }}
                            title={`Actual: ${formatCurrency(point.actual_revenue)}`}
                          />
                        )}
                      </div>
                      <span className="text-xs text-gray-500 mt-2">
                        {formatMonth(point.month)}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-400 rounded" />
                  <span>Predicted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span>Actual</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Forecasts */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Forecasts</CardTitle>
          <CardDescription>
            AI-predicted revenue for the next 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingForecasts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No upcoming forecasts. Generate forecasts to see predictions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingForecasts.map((forecast) => (
                <div 
                  key={forecast.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#d4a574]/10 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-[#d4a574]" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {forecast.investor_portfolio?.city || 'Property'}, {forecast.investor_portfolio?.state}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(forecast.forecast_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(forecast.predicted_revenue)}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{forecast.predicted_occupancy.toFixed(0)}% occ</span>
                      <span>•</span>
                      <Badge variant={
                        forecast.confidence_score >= 80 ? 'default' :
                        forecast.confidence_score >= 60 ? 'secondary' : 'outline'
                      }>
                        {forecast.confidence_score}% confidence
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Factors Affecting Forecasts */}
      {upcomingForecasts.length > 0 && upcomingForecasts[0].factors && (
        <Card>
          <CardHeader>
            <CardTitle>Factors Affecting Forecasts</CardTitle>
            <CardDescription>
              Key variables considered in AI predictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Seasonal Trends</h4>
                <p className="text-sm text-blue-600">
                  Adjustments based on historical booking patterns for each month
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Market Conditions</h4>
                <p className="text-sm text-green-600">
                  Local market benchmarks and year-over-year growth trends
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">Local Events</h4>
                <p className="text-sm text-purple-600">
                  Major events, festivals, and seasonal tourism patterns
                </p>
              </div>
            </div>
            
            {upcomingForecasts[0].factors.local_events && upcomingForecasts[0].factors.local_events.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                <h4 className="font-medium text-amber-800 mb-2">Upcoming Events</h4>
                <div className="flex flex-wrap gap-2">
                  {upcomingForecasts[0].factors.local_events.map((event, idx) => (
                    <Badge key={idx} variant="outline" className="bg-white">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
