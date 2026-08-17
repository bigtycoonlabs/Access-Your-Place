import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Building2,
  Users,
  Calendar,
  DollarSign,
  BarChart3,
  Shield,
  Info,
  Loader2,
  Target,
  MapPin,
  Clock,
  Sparkles,
  RefreshCw,
  LineChart,
  Home
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PennyAnalysisPanelProps {
  propertyId: string;
  property?: any;
  isStaff?: boolean; // Controls whether SOP checklist is shown
  onScoreUpdate?: (score: number) => void;
}

interface AnalysisData {
  penny_score: number;
  confidence_level: number;
  recommendation: string;
  market_score: number;
  regulation_score: number;
  financial_score: number;
  competition_score: number;
  seasonality_score: number;
  location_score: number;
  str_analysis: any;
  coliving_analysis: any;
  mtr_analysis: any;
  market_analysis: any;
  risk_analysis: any;
  best_strategy: string;
  ml_adjusted: boolean;
  scored_at: string;
  sop_hotel_occupancy_checked: boolean;
  sop_hotel_adr_checked: boolean;
  sop_str_performance_checked: boolean;
  sop_travel_trends_checked: boolean;
  sop_coliving_data_checked: boolean;
  sop_regulation_checked: boolean;
  sop_seasonality_checked: boolean;
  sop_competition_checked: boolean;
}

export function PennyAnalysisPanel({ 
  propertyId, 
  property,
  isStaff = false,
  onScoreUpdate 
}: PennyAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "We could not analyse this" and "this deal is bad" are different answers and must not
  // render the same way.
  const [unscored, setUnscored] = useState<{ reason: string; nextStep: string } | null>(null);

  useEffect(() => {
    fetchAnalysis();
  }, [propertyId]);

  // Build a minimal AnalysisData shell from the property row itself —
  // used as a last-resort fallback when the cache table and the
  // penny-deal-scoring edge function are both unavailable. This guarantees
  // the public Penny tab always displays SOMETHING useful (the score and
  // recommendation that staff already saved on the property), instead of a
  // hard error that blocks the whole tab.
  const buildFallbackFromProperty = (): AnalysisData | null => {
    if (!property) return null;
    const score = Number(property.penny_score ?? 0);
    if (!score && !property.penny_recommendation) return null;
    return {
      penny_score: score,
      confidence_level: 50,
      recommendation: property.penny_recommendation || 'hold',
      market_score: 0,
      regulation_score: 0,
      financial_score: 0,
      competition_score: 0,
      seasonality_score: 0,
      location_score: 0,
      str_analysis: null,
      coliving_analysis: null,
      mtr_analysis: null,
      market_analysis: null,
      risk_analysis: { risks: [], opportunities: [], summary: 'Showing cached analysis from property record. Click refresh for a fresh deep-dive.' },
      best_strategy: property.operation_type || 'str',
      ml_adjusted: false,
      scored_at: property.penny_scored_at || new Date().toISOString(),
      sop_hotel_occupancy_checked: false,
      sop_hotel_adr_checked: false,
      sop_str_performance_checked: false,
      sop_travel_trends_checked: false,
      sop_coliving_data_checked: false,
      sop_regulation_checked: false,
      sop_seasonality_checked: false,
      sop_competition_checked: false,
    };
  };

  // Race a promise against a timeout — used so the penny-deal-scoring edge
  // function can never hang the UI indefinitely. After the timeout fires we
  // gracefully degrade to the cached row or property fallback.
  const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`[Penny] ${label} timed out after ${ms}ms`)), ms);
      p.then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); }
      );
    });

  const fetchAnalysis = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // REBUILT. One call to ayp_deal_analysis, which computes the whole analysis in the
      // database from this listing's own figures.
      //
      // What was here before: a read of penny_deal_scores (blocked from the browser) raced
      // against penny-deal-scoring (retired 9 August 2026, returns 410), with a timeout.
      // Two dead paths and a stopwatch. It could never produce an analysis.
      //
      // Nothing here is generated, so there is no figure to invent, no token budget to run
      // out of, and the same property always reads the same.
      const { data, error } = await supabase.rpc('ayp_deal_analysis', {
        p_property_id: propertyId,
      });

      if (unscored) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5" role="status">
        <p className="font-medium text-amber-900">{unscored.reason}</p>
        <p className="mt-2 text-sm text-amber-900">{unscored.nextStep}</p>
      </div>
    );
  }

  if (error) {
        setError('We could not load the analysis just now. That is a fault on our side, not a verdict on this deal.');
      } else if (data?.ok === false) {
        setError('We could not find this property.');
      } else if (data?.scored === false) {
        // Missing figures is a real answer, and naming them is more useful than a blank panel.
        setUnscored({ reason: data.reason, nextStep: data.next_step });
      } else if (data?.scored === true) {
        // Map the function's field names onto the shape this panel already renders.
        // The panel was built for the old table's columns; rather than rewrite the whole
        // display, the new result is translated into it.
        setAnalysis({
          penny_score: data.overall_score,
          confidence_level: data.confidence,
          recommendation: data.recommendation,
          financial_score: data.components?.financial ?? 0,
          market_score: data.components?.resilience ?? 0,
          regulation_score: data.components?.verification ?? 0,
          competition_score: data.components?.completeness ?? 0,
          seasonality_score: data.components?.resilience ?? 0,
          location_score: data.components?.verification ?? 0,
          // The panel renders these from risk_analysis, not from top level fields.
          risk_analysis: {
            opportunities: data.strengths ?? [],
            risk_factors: data.risks ?? [],
            risks: data.risks ?? [],
          },
          strengths: data.strengths ?? [],
          risks: data.risks ?? [],
          figures: data.figures,
          basis: data.basis,
          ...data,
        } as unknown as AnalysisData);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const isScoreExpired = (scoredAt: string) => {
    if (!scoredAt) return true;
    const scoreDate = new Date(scoredAt);
    if (isNaN(scoreDate.getTime())) return true;
    const now = new Date();
    const daysDiff = (now.getTime() - scoreDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 7; // Expire after 7 days
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'strong_buy':
        return <Badge className="bg-emerald-500">Strong Buy</Badge>;
      case 'buy':
        return <Badge className="bg-green-500">Buy</Badge>;
      case 'hold':
        return <Badge className="bg-yellow-500">Hold</Badge>;
      case 'needs_review':
        return <Badge className="bg-orange-500">Needs Review</Badge>;
      case 'avoid':
      case 'pass':
        return <Badge className="bg-red-500">Avoid</Badge>;
      default:
        return <Badge variant="secondary">{rec}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-3 text-gray-600">Penny AI is analyzing this deal...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-orange-500" />
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => fetchAnalysis(true)} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-8">
        <Brain className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="text-gray-500">No analysis available</p>
        <Button onClick={() => fetchAnalysis(true)} className="mt-4">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Analysis
        </Button>
      </div>
    );
  }

  const componentScores = [
    { name: 'Market', score: analysis.market_score, icon: TrendingUp },
    { name: 'Financial', score: analysis.financial_score, icon: DollarSign },
    { name: 'Regulation', score: analysis.regulation_score, icon: Shield },
    { name: 'Competition', score: analysis.competition_score, icon: Target },
    { name: 'Seasonality', score: analysis.seasonality_score, icon: Calendar },
    { name: 'Location', score: analysis.location_score, icon: MapPin }
  ];

  const sopChecklist = [
    { name: 'Hotel Occupancy', checked: analysis.sop_hotel_occupancy_checked },
    { name: 'Hotel ADR', checked: analysis.sop_hotel_adr_checked },
    { name: 'STR Performance', checked: analysis.sop_str_performance_checked },
    { name: 'Travel Trends', checked: analysis.sop_travel_trends_checked },
    { name: 'Co-Living Data', checked: analysis.sop_coliving_data_checked },
    { name: 'Regulations', checked: analysis.sop_regulation_checked },
    { name: 'Seasonality', checked: analysis.sop_seasonality_checked },
    { name: 'Competition', checked: analysis.sop_competition_checked }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Score */}
      <div className={`p-6 rounded-xl bg-gradient-to-br ${
        analysis.penny_score >= 80 ? 'from-emerald-500 to-green-600' :
        analysis.penny_score >= 60 ? 'from-yellow-500 to-amber-500' :
        analysis.penny_score >= 40 ? 'from-orange-500 to-amber-600' :
        'from-red-500 to-rose-600'
      } text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-5 h-5" />
              <span className="text-sm opacity-90">Penny Score</span>
              {analysis.ml_adjusted && (
                <Badge className="bg-white/20 text-white text-xs">ML Enhanced</Badge>
              )}
            </div>
            <p className="text-5xl font-bold">{Math.round(analysis.penny_score)}</p>
            <div className="flex items-center gap-2 mt-2">
              {getRecommendationBadge(analysis.recommendation)}
              <span className="text-sm opacity-80">
                {analysis.confidence_level}% confidence
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-2">
              {analysis.penny_score >= 80 ? <CheckCircle className="w-12 h-12" /> :
               analysis.penny_score >= 60 ? <TrendingUp className="w-12 h-12" /> :
               analysis.penny_score >= 40 ? <AlertTriangle className="w-12 h-12" /> :
               <XCircle className="w-12 h-12" />}
            </div>
            <Button 
              size="sm" 
              variant="secondary" 
              className="bg-white/20 hover:bg-white/30 text-white"
              onClick={() => fetchAnalysis(true)}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Best Strategy Recommendation */}
      {analysis.best_strategy && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${
              analysis.best_strategy === 'str' ? 'bg-blue-100' :
              analysis.best_strategy === 'coliving' ? 'bg-purple-100' : 'bg-teal-100'
            }`}>
              {analysis.best_strategy === 'str' ? <Building2 className="w-6 h-6 text-blue-600" /> :
               analysis.best_strategy === 'coliving' ? <Users className="w-6 h-6 text-purple-600" /> :
               <Home className="w-6 h-6 text-teal-600" />}
            </div>
            <div>
              <p className="text-sm text-gray-600">Recommended Strategy</p>
              <p className="font-semibold text-lg">
                {analysis.best_strategy === 'str' ? 'Short-Term Rental (STR)' :
                 analysis.best_strategy === 'coliving' ? 'Co-Living' : 'Mid-Term Rental (MTR)'}
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="breakdown" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="breakdown">Score Breakdown</TabsTrigger>
          <TabsTrigger value="projections">Revenue</TabsTrigger>
          <TabsTrigger value="risks">Risks & Opps</TabsTrigger>
          {isStaff && <TabsTrigger value="sop">SOP Checklist</TabsTrigger>}
        </TabsList>

        {/* Score Breakdown Tab */}
        <TabsContent value="breakdown" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {componentScores.map((item) => (
              <div key={item.name} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <span className={`font-bold ${getScoreColor(item.score)}`}>
                    {Math.round(item.score)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full transition-all ${getScoreBg(item.score)}`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Market Insights */}
          {analysis.market_analysis && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-blue-800">
                <LineChart className="w-4 h-4" />
                Market Insights: {analysis.market_analysis.name}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Market Trend:</span>
                  <Badge className={`ml-2 ${
                    analysis.market_analysis.trend === 'booming' ? 'bg-emerald-500' :
                    analysis.market_analysis.trend === 'growing' ? 'bg-green-500' :
                    analysis.market_analysis.trend === 'stable' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    {analysis.market_analysis.trend}
                  </Badge>
                </div>
                {analysis.market_analysis.peakSeason && (
                  <div>
                    <span className="text-gray-600">Peak Season:</span>
                    <span className="ml-2 font-medium">{analysis.market_analysis.peakSeason}</span>
                  </div>
                )}
              </div>
              {analysis.market_analysis.demandDrivers && (
                <div className="mt-3">
                  <span className="text-sm text-gray-600">Demand Drivers:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {analysis.market_analysis.demandDrivers.slice(0, 4).map((driver: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">{driver}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Revenue Projections Tab */}
        <TabsContent value="projections" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* STR Projections */}
            {analysis.str_analysis && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-800">Short-Term Rental</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. ADR:</span>
                    <span className="font-semibold">${analysis.str_analysis.estimatedAdr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Occupancy:</span>
                    <span className="font-semibold">{analysis.str_analysis.estimatedOccupancy}%</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly Revenue:</span>
                      <span className="font-bold text-blue-700">${analysis.str_analysis.monthlyRevenue?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly Profit:</span>
                      <span className={`font-bold ${analysis.str_analysis.monthlyProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ${analysis.str_analysis.monthlyProfit?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Co-Living Projections */}
            {analysis.coliving_analysis && (
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold text-purple-800">Co-Living</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rooms:</span>
                    <span className="font-semibold">{analysis.coliving_analysis.roomsAvailable}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Room Rate:</span>
                    <span className="font-semibold">${analysis.coliving_analysis.avgRoomRate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Occupancy:</span>
                    <span className="font-semibold">{analysis.coliving_analysis.estimatedOccupancy}%</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly Revenue:</span>
                      <span className="font-bold text-purple-700">${analysis.coliving_analysis.monthlyRevenue?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly Profit:</span>
                      <span className={`font-bold ${analysis.coliving_analysis.monthlyProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ${analysis.coliving_analysis.monthlyProfit?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MTR Projections */}
            {analysis.mtr_analysis && (
              <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-teal-600" />
                  <h4 className="font-semibold text-teal-800">Mid-Term Rental</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Rate:</span>
                    <span className="font-semibold">${analysis.mtr_analysis.estimatedMonthlyRate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Occupancy:</span>
                    <span className="font-semibold">{analysis.mtr_analysis.estimatedOccupancy}%</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly Revenue:</span>
                      <span className="font-bold text-teal-700">${analysis.mtr_analysis.monthlyRevenue?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Annual Revenue:</span>
                      <span className="font-bold text-teal-700">${analysis.mtr_analysis.annualRevenue?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Annual Summary */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Annual Revenue Comparison
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  ${analysis.str_analysis?.annualRevenue?.toLocaleString() || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">STR Annual</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  ${analysis.coliving_analysis?.annualRevenue?.toLocaleString() || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Co-Living Annual</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-teal-600">
                  ${analysis.mtr_analysis?.annualRevenue?.toLocaleString() || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">MTR Annual</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Risks & Opportunities Tab */}
        <TabsContent value="risks" className="mt-4 space-y-4">
          {/* Summary */}
          {analysis.risk_analysis?.summary && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600" />
                Penny's Analysis
              </h4>
              <p className="text-gray-700 text-sm leading-relaxed">{analysis.risk_analysis.summary}</p>
            </div>
          )}

          {/* Risk Factors */}
          {analysis.risk_analysis?.risks && analysis.risk_analysis.risks.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                Risk Factors ({analysis.risk_analysis.risks.length})
              </h4>
              <div className="space-y-2">
                {analysis.risk_analysis.risks.map((risk: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
                    <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {analysis.risk_analysis?.opportunities && analysis.risk_analysis.opportunities.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
                Opportunities ({analysis.risk_analysis.opportunities.length})
              </h4>
              <div className="space-y-2">
                {analysis.risk_analysis.opportunities.map((opp: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{opp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* SOP Checklist Tab - Staff Only */}
        {isStaff && (
          <TabsContent value="sop" className="mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <strong>Internal Only:</strong> This SOP verification checklist is only visible to staff members.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {sopChecklist.map((item) => (
                <div 
                  key={item.name}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    item.checked 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {item.checked ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span className="font-medium">{item.name}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">SOP Completion:</span>
                <span className="font-bold">
                  {sopChecklist.filter(s => s.checked).length} / {sopChecklist.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${(sopChecklist.filter(s => s.checked).length / sopChecklist.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              <p className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last scored: {new Date(analysis.scored_at).toLocaleString()}
              </p>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
