import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Sparkles, MapPin, TrendingUp, DollarSign, 
  Building2, Shield, Users, BarChart3, CheckCircle2, 
  AlertTriangle, Star, ArrowRight, FileText
} from 'lucide-react';

interface Props {
  investorId: string;
  onReportGenerated?: () => void;
}

const popularMarkets = [
  { city: 'Austin', state: 'TX', hot: true },
  { city: 'Dallas', state: 'TX', hot: true },
  { city: 'Houston', state: 'TX' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'Phoenix', state: 'AZ', hot: true },
  { city: 'Scottsdale', state: 'AZ' },
  { city: 'Denver', state: 'CO', hot: true },
  { city: 'Nashville', state: 'TN', hot: true },
  { city: 'Atlanta', state: 'GA', hot: true },
  { city: 'Tampa', state: 'FL', hot: true },
  { city: 'Orlando', state: 'FL' },
  { city: 'Miami', state: 'FL' },
  { city: 'Charlotte', state: 'NC' },
  { city: 'Raleigh', state: 'NC' },
  { city: 'Charleston', state: 'SC' },
  { city: 'Savannah', state: 'GA' },
  { city: 'Las Vegas', state: 'NV' },
  { city: 'San Diego', state: 'CA' },
  { city: 'Portland', state: 'OR' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Columbus', state: 'OH' },
  { city: 'Indianapolis', state: 'IN' },
  { city: 'Kansas City', state: 'MO' },
  { city: 'St. Louis', state: 'MO' }
];

export function MarketReportGenerator({ investorId, onReportGenerated }: Props) {
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const { toast } = useToast();

  const toggleMarket = (market: string) => {
    setSelectedMarkets(prev => 
      prev.includes(market) 
        ? prev.filter(m => m !== market)
        : prev.length < 5 ? [...prev, market] : prev
    );
  };

  const generateReport = async () => {
    if (selectedMarkets.length === 0) {
      toast({ 
        title: 'Select Markets', 
        description: 'Please select at least one market to analyze.', 
        variant: 'destructive' 
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-market-report', {
        body: { 
          investor_id: investorId, 
          markets: selectedMarkets, 
          report_type: 'custom' 
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to generate report');

      setGeneratedReport(data.report_data);
      setShowReport(true);
      toast({ 
        title: 'Report Generated!', 
        description: 'Your comprehensive market report is ready.' 
      });
      onReportGenerated?.();
    } catch (err: any) {
      console.error('Report generation error:', err);
      toast({ 
        title: 'Generation Failed', 
        description: err.message || 'Failed to generate report. Please try again.', 
        variant: 'destructive' 
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Card className="border-2 border-[#d4a574]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#d4a574]" />
            AI Market Report Generator
          </CardTitle>
          <CardDescription>
            Select up to 5 markets to receive a comprehensive AI-powered analysis including 
            STR regulations, revenue potential, and investment recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Select Markets to Analyze</h4>
              <span className="text-sm text-muted-foreground">
                {selectedMarkets.length}/5 selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {popularMarkets.map(market => {
                const marketKey = `${market.city}, ${market.state}`;
                const isSelected = selectedMarkets.includes(marketKey);
                return (
                  <Badge
                    key={marketKey}
                    variant={isSelected ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-[#d4a574] hover:bg-[#c49464]' 
                        : 'hover:bg-[#d4a574]/10'
                    } ${market.hot ? 'border-orange-400' : ''}`}
                    onClick={() => toggleMarket(marketKey)}
                  >
                    <MapPin className="w-3 h-3 mr-1" />
                    {market.city}, {market.state}
                    {market.hot && <TrendingUp className="w-3 h-3 ml-1 text-orange-500" />}
                  </Badge>
                );
              })}
            </div>
          </div>

          {selectedMarkets.length > 0 && (
            <div className="bg-[#1a365d]/5 rounded-lg p-4">
              <h4 className="font-medium mb-2">Selected Markets:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedMarkets.map(market => (
                  <Badge key={market} className="bg-[#1a365d]">
                    {market}
                    <button 
                      className="ml-2 hover:text-red-300"
                      onClick={() => toggleMarket(market)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-r from-[#1a365d]/10 to-[#d4a574]/10 rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Your Report Will Include:
            </h4>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                STR Regulations & Permits
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Average Daily Rates
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Occupancy Trends
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Competition Analysis
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Revenue Projections
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Investment Recommendations
              </div>
            </div>
          </div>

          <Button 
            onClick={generateReport} 
            disabled={generating || selectedMarkets.length === 0}
            className="w-full bg-[#d4a574] hover:bg-[#c49464] text-white"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating Report... (30-60 seconds)
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate AI Market Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#d4a574]" />
              Market Analysis Report
            </DialogTitle>
            <DialogDescription>
              Generated on {new Date().toLocaleDateString()} for {selectedMarkets.join(', ')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {generatedReport && <ReportViewer data={generatedReport} />}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReportViewer({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      {data.executive_summary && (
        <div className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-[#d4a574]" />
            Executive Summary
          </h3>
          <p className="text-white/90 leading-relaxed whitespace-pre-line">
            {typeof data.executive_summary === 'string' 
              ? data.executive_summary 
              : JSON.stringify(data.executive_summary, null, 2)}
          </p>
        </div>
      )}

      {/* Market Comparison */}
      {data.market_comparison && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#d4a574]" />
              Quick Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {data.market_comparison.best_for_beginners && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Best for Beginners</p>
                    <p className="font-medium">{data.market_comparison.best_for_beginners}</p>
                  </div>
                </div>
              )}
              {data.market_comparison.highest_revenue_potential && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Highest Revenue</p>
                    <p className="font-medium">{data.market_comparison.highest_revenue_potential}</p>
                  </div>
                </div>
              )}
              {data.market_comparison.best_regulations && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Best Regulations</p>
                    <p className="font-medium">{data.market_comparison.best_regulations}</p>
                  </div>
                </div>
              )}
              {data.market_comparison.most_stable && (
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Most Stable</p>
                    <p className="font-medium">{data.market_comparison.most_stable}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Market Analysis */}
      {data.markets_analyzed?.map((market: any, index: number) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className="bg-[#1a365d]/5 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#d4a574]" />
                {market.market_name}
              </CardTitle>
              {market.investment_score && (
                <Badge className={`${
                  market.investment_score >= 8 ? 'bg-green-600' :
                  market.investment_score >= 6 ? 'bg-yellow-600' : 'bg-red-600'
                }`}>
                  Score: {market.investment_score}/10
                </Badge>
              )}
            </div>
            {market.recommendation && (
              <Badge variant="outline" className="w-fit mt-2">
                Recommendation: {market.recommendation}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Market Overview */}
            {market.market_overview && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Market Overview
                </h4>
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  {market.market_overview.population && (
                    <p><span className="text-muted-foreground">Population:</span> {market.market_overview.population}</p>
                  )}
                  {market.market_overview.population_growth && (
                    <p><span className="text-muted-foreground">Growth:</span> {market.market_overview.population_growth}</p>
                  )}
                  {market.market_overview.economic_outlook && (
                    <p className="md:col-span-2"><span className="text-muted-foreground">Outlook:</span> {market.market_overview.economic_outlook}</p>
                  )}
                </div>
              </div>
            )}

            {/* STR Regulations */}
            {market.str_regulations && (
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  STR Regulations
                </h4>
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge variant="outline" className={`${
                      market.str_regulations.status === 'Friendly' ? 'border-green-500 text-green-700' :
                      market.str_regulations.status === 'Moderate' ? 'border-yellow-500 text-yellow-700' :
                      'border-red-500 text-red-700'
                    }`}>
                      {market.str_regulations.status}
                    </Badge>
                  </p>
                  {market.str_regulations.permit_required !== undefined && (
                    <p><span className="text-muted-foreground">Permit Required:</span> {market.str_regulations.permit_required ? 'Yes' : 'No'}</p>
                  )}
                  {market.str_regulations.permit_cost && (
                    <p><span className="text-muted-foreground">Permit Cost:</span> {market.str_regulations.permit_cost}</p>
                  )}
                  {market.str_regulations.notes && (
                    <p className="md:col-span-2 text-muted-foreground">{market.str_regulations.notes}</p>
                  )}
                </div>
              </div>
            )}

            {/* STR Performance */}
            {market.str_performance && (
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  STR Performance
                </h4>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  {market.str_performance.avg_daily_rate && (
                    <div className="text-center p-2 bg-white rounded">
                      <p className="text-lg font-bold text-green-600">{market.str_performance.avg_daily_rate}</p>
                      <p className="text-xs text-muted-foreground">Avg Daily Rate</p>
                    </div>
                  )}
                  {market.str_performance.avg_occupancy && (
                    <div className="text-center p-2 bg-white rounded">
                      <p className="text-lg font-bold text-blue-600">{market.str_performance.avg_occupancy}</p>
                      <p className="text-xs text-muted-foreground">Avg Occupancy</p>
                    </div>
                  )}
                  {market.str_performance.avg_monthly_revenue && (
                    <div className="text-center p-2 bg-white rounded">
                      <p className="text-lg font-bold text-purple-600">{market.str_performance.avg_monthly_revenue}</p>
                      <p className="text-xs text-muted-foreground">Monthly Revenue</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Competition Analysis */}
            {market.competition_analysis && (
              <div className="bg-orange-50 rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-600" />
                  Competition Analysis
                </h4>
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  {market.competition_analysis.total_listings && (
                    <p><span className="text-muted-foreground">Total Listings:</span> {market.competition_analysis.total_listings}</p>
                  )}
                  {market.competition_analysis.market_saturation && (
                    <p><span className="text-muted-foreground">Saturation:</span> {market.competition_analysis.market_saturation}</p>
                  )}
                  {market.competition_analysis.entry_difficulty && (
                    <p><span className="text-muted-foreground">Entry Difficulty:</span> {market.competition_analysis.entry_difficulty}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Top Recommendations */}
      {data.top_recommendations?.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              Top Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.top_recommendations.map((rec: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Risk Factors */}
      {data.risk_factors?.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-5 h-5" />
              Risk Factors to Consider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.risk_factors.map((risk: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{risk}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Available Deals */}
      {data.available_deals?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#d4a574]" />
              Available Deals in These Markets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {data.available_deals.map((deal: any) => (
                <div key={deal.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div>
                    <p className="font-medium">{deal.city}, {deal.state}</p>
                    <p className="text-sm text-muted-foreground">
                      {deal.bedrooms}bd/{deal.bathrooms}ba • {deal.property_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${deal.price?.toLocaleString()}</p>
                    {deal.projected_revenue && (
                      <p className="text-sm text-green-600">${deal.projected_revenue?.toLocaleString()}/mo potential</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw content fallback */}
      {data.raw_content && !data.markets_analyzed && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm">{data.raw_content}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
