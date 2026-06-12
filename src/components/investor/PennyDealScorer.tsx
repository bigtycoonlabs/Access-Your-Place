import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Target, Loader2, CheckCircle2, AlertTriangle, TrendingUp, 
  Building2, Shield, Calendar, Users, MapPin, DollarSign,
  ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';

interface PennyDealScorerProps {
  propertyId?: string;
  propertyData?: {
    city: string;
    state: string;
    bedrooms: number;
    bathrooms: number;
    monthly_rent: number;
    property_type?: string;
    is_furnished?: boolean;
    title?: string;
  };
  onScoreComplete?: (score: any) => void;
}

interface ScoreResult {
  penny_score: number;
  confidence: number;
  recommendation: string;
  component_scores: {
    market: number;
    regulation: number;
    financial: number;
    competition: number;
    seasonality: number;
    location: number;
  };
  sop_verification: {
    hotelOccupancyChecked: boolean;
    hotelAdrChecked: boolean;
    strPerformanceChecked: boolean;
    travelTrendsChecked: boolean;
    colivingDataChecked: boolean;
    regulationChecked: boolean;
    seasonalityChecked: boolean;
    competitionChecked: boolean;
  };
  projections: {
    str: { monthly_profit: number; annual_profit: number };
    coliving: { monthly_profit: number; annual_profit: number };
    mtr: { monthly_profit: number; annual_profit: number };
    best_strategy: string;
    setup_cost_estimate: number;
    break_even_months: number;
  };
  market_comparison: {
    hotel_vs_str: {
      hotel_adr: string;
      str_adr: string;
      str_premium: string;
    };
    coliving_market: {
      avg_room_rate: string;
      occupancy: string;
      competitors: string[];
    };
  };
  risks: string[];
  opportunities: string[];
  summary: string;
}

export function PennyDealScorer({ propertyId, propertyData, onScoreComplete }: PennyDealScorerProps) {
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const scoreDeal = async () => {
    if (!propertyId && !propertyData) {
      toast({ title: 'Error', description: 'Property data required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-property-analysis', {
        body: {
          property_id: propertyId,
          property_data: propertyData
        }
      });

      if (error) throw error;

      if (data?.success) {
        setScore(data.analysis);
        onScoreComplete?.(data.analysis);
      } else {
        throw new Error(data?.error || 'Failed to score deal');
      }
    } catch (err: any) {
      console.error('Error scoring deal:', err);
      toast({ 
        title: 'Scoring failed', 
        description: err.message || 'Please try again',
        variant: 'destructive' 
      });
    }
    setLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 65) return 'text-blue-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 65) return 'bg-blue-100';
    if (score >= 50) return 'bg-amber-100';
    return 'bg-red-100';
  };

  const getRecommendationBadge = (rec: string) => {
    const styles: Record<string, string> = {
      strong_buy: 'bg-green-100 text-green-800 border-green-300',
      buy: 'bg-blue-100 text-blue-800 border-blue-300',
      hold: 'bg-amber-100 text-amber-800 border-amber-300',
      avoid: 'bg-red-100 text-red-800 border-red-300',
      needs_review: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    const labels: Record<string, string> = {
      strong_buy: 'STRONG BUY',
      buy: 'BUY',
      hold: 'HOLD',
      avoid: 'AVOID',
      needs_review: 'NEEDS REVIEW'
    };
    return (
      <Badge variant="outline" className={styles[rec] || styles.hold}>
        {labels[rec] || rec.toUpperCase()}
      </Badge>
    );
  };

  const ComponentScore = ({ label, score, icon: Icon }: { label: string; score: number; icon: any }) => (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={score} className="w-20 h-2" />
        <span className={`text-sm font-medium w-8 ${getScoreColor(score)}`}>{score}</span>
      </div>
    </div>
  );

  const SOPCheckItem = ({ label, checked }: { label: string; checked: boolean }) => (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-500" />
      )}
      <span className={checked ? 'text-green-700' : 'text-amber-700'}>{label}</span>
    </div>
  );

  if (!score) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-[#d4a574]" />
            Penny Deal Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Get an AI-powered analysis with SOP-verified market data including hotel comparison, 
            co-living rates, seasonality, and regulatory assessment.
          </p>
          <Button 
            onClick={scoreDeal} 
            disabled={loading}
            className="w-full bg-[#d4a574] hover:bg-[#c49464]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing with SOP Verification...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Score This Deal
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-[#d4a574]" />
            Penny Deal Score
          </CardTitle>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            SOP Verified
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Score Display */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[#1a365d] to-[#2d4a7c]">
          <div>
            <p className="text-white/70 text-sm">Penny Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">{score.penny_score}</span>
              <span className="text-white/70">/100</span>
            </div>
            <p className="text-white/70 text-xs mt-1">{score.confidence}% confidence</p>
          </div>
          <div className="text-right">
            {getRecommendationBadge(score.recommendation)}
            <p className="text-white text-sm mt-2 font-medium">
              Best: {score.projections.best_strategy.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">{score.summary}</p>
        </div>

        {/* Profit Projections */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`p-3 rounded-lg text-center ${score.projections.best_strategy === 'str' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500">STR</p>
            <p className="font-bold text-gray-900">${score.projections.str.monthly_profit.toLocaleString()}</p>
            <p className="text-xs text-gray-500">/month</p>
          </div>
          <div className={`p-3 rounded-lg text-center ${score.projections.best_strategy === 'coliving' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500">Co-living</p>
            <p className="font-bold text-gray-900">${score.projections.coliving.monthly_profit.toLocaleString()}</p>
            <p className="text-xs text-gray-500">/month</p>
          </div>
          <div className={`p-3 rounded-lg text-center ${score.projections.best_strategy === 'mtr' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500">MTR</p>
            <p className="font-bold text-gray-900">${score.projections.mtr.monthly_profit.toLocaleString()}</p>
            <p className="text-xs text-gray-500">/month</p>
          </div>
        </div>

        {/* Break-even */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">Setup Cost: ${score.projections.setup_cost_estimate.toLocaleString()}</span>
          </div>
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
            Break-even: {score.projections.break_even_months} months
          </Badge>
        </div>

        {/* Toggle Details */}
        <Button 
          variant="ghost" 
          className="w-full justify-between"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span className="text-sm">View Detailed Analysis</span>
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        {showDetails && (
          <div className="space-y-4 pt-2 border-t">
            {/* Component Scores */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Component Scores</h4>
              <div className="space-y-1">
                <ComponentScore label="Market Trend" score={score.component_scores.market} icon={TrendingUp} />
                <ComponentScore label="Regulations" score={score.component_scores.regulation} icon={Shield} />
                <ComponentScore label="Financials" score={score.component_scores.financial} icon={DollarSign} />
                <ComponentScore label="Competition" score={score.component_scores.competition} icon={Users} />
                <ComponentScore label="Seasonality" score={score.component_scores.seasonality} icon={Calendar} />
                <ComponentScore label="Location" score={score.component_scores.location} icon={MapPin} />
              </div>
            </div>

            {/* Market Comparison */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Hotel vs STR Comparison</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Hotel ADR</p>
                  <p className="font-medium">{score.market_comparison.hotel_vs_str.hotel_adr}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">STR ADR</p>
                  <p className="font-medium">{score.market_comparison.hotel_vs_str.str_adr}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                STR Premium: {score.market_comparison.hotel_vs_str.str_premium}
              </p>
            </div>

            {/* Co-living Market */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Co-living Market</h4>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Avg Room Rate</span>
                  <span className="font-medium">{score.market_comparison.coliving_market.avg_room_rate}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Occupancy</span>
                  <span className="font-medium">{score.market_comparison.coliving_market.occupancy}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {score.market_comparison.coliving_market.competitors.map((comp, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{comp}</Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* SOP Verification */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">SOP Verification Checklist</h4>
              <div className="grid grid-cols-2 gap-2 p-3 bg-green-50 rounded-lg">
                <SOPCheckItem label="Hotel Occupancy" checked={score.sop_verification.hotelOccupancyChecked} />
                <SOPCheckItem label="Hotel ADR" checked={score.sop_verification.hotelAdrChecked} />
                <SOPCheckItem label="STR Performance" checked={score.sop_verification.strPerformanceChecked} />
                <SOPCheckItem label="Travel Trends" checked={score.sop_verification.travelTrendsChecked} />
                <SOPCheckItem label="Co-living Data" checked={score.sop_verification.colivingDataChecked} />
                <SOPCheckItem label="Regulations" checked={score.sop_verification.regulationChecked} />
                <SOPCheckItem label="Seasonality" checked={score.sop_verification.seasonalityChecked} />
                <SOPCheckItem label="Competition" checked={score.sop_verification.competitionChecked} />
              </div>
            </div>

            {/* Risks & Opportunities */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Risks
                </h4>
                <ul className="space-y-1">
                  {score.risks.map((risk, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Opportunities
                </h4>
                <ul className="space-y-1">
                  {score.opportunities.map((opp, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-green-500 mt-0.5">•</span>
                      {opp}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Rescore Button */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={scoreDeal}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
          Rescore Deal
        </Button>
      </CardContent>
    </Card>
  );
}

export default PennyDealScorer;
