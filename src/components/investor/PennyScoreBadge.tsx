import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  ExternalLink,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PennyScoreBadgeProps {
  score?: number | null;
  propertyId?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTooltip?: boolean;
  onAnalysisClick?: () => void;
  className?: string;
}

interface ScoreAnalysis {
  overall_score: number;
  component_scores: {
    hotel_occupancy: number;
    hotel_adr: number;
    str_performance: number;
    travel_trends: number;
    coliving_data: number;
    regulations: number;
    seasonality: number;
    competition: number;
  };
  sop_verification: {
    hotel_occupancy_checked: boolean;
    hotel_adr_cross_referenced: boolean;
    str_performance_verified: boolean;
    travel_trends_analyzed: boolean;
    coliving_data_reviewed: boolean;
    regulations_checked: boolean;
    seasonality_factored: boolean;
    competition_analyzed: boolean;
  };
  revenue_projections: {
    str_monthly: number;
    coliving_monthly: number;
    mtr_monthly: number;
  };
  risk_factors: string[];
  opportunities: string[];
  recommendation: string;
}

export function PennyScoreBadge({ 
  score, 
  propertyId,
  size = 'md', 
  showLabel = true,
  showTooltip = true,
  onAnalysisClick,
  className = ''
}: PennyScoreBadgeProps) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<ScoreAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  // Determine score category and styling
  const getScoreConfig = (pennyScore: number | null | undefined) => {
    if (pennyScore === null || pennyScore === undefined) {
      return {
        color: 'bg-gray-100 text-gray-600 border-gray-300',
        bgGradient: 'from-gray-100 to-gray-200',
        icon: Info,
        label: 'Not Scored',
        description: 'This property has not been analyzed by Penny AI yet.',
        status: 'pending'
      };
    }
    
    if (pennyScore >= 80) {
      return {
        color: 'bg-emerald-100 text-emerald-700 border-emerald-400',
        bgGradient: 'from-emerald-500 to-green-600',
        icon: CheckCircle,
        label: 'Excellent',
        description: 'High confidence deal. Strong market fundamentals, verified data, and excellent profit potential.',
        status: 'excellent'
      };
    }
    
    if (pennyScore >= 60) {
      return {
        color: 'bg-yellow-100 text-yellow-700 border-yellow-400',
        bgGradient: 'from-yellow-500 to-amber-500',
        icon: TrendingUp,
        label: 'Good',
        description: 'Solid opportunity with good fundamentals. Some factors may need additional consideration.',
        status: 'good'
      };
    }
    
    if (pennyScore >= 40) {
      return {
        color: 'bg-orange-100 text-orange-700 border-orange-400',
        bgGradient: 'from-orange-500 to-amber-600',
        icon: AlertTriangle,
        label: 'Caution',
        description: 'Moderate risk deal. Requires careful analysis of market conditions and competition.',
        status: 'caution'
      };
    }
    
    return {
      color: 'bg-red-100 text-red-700 border-red-400',
      bgGradient: 'from-red-500 to-rose-600',
      icon: XCircle,
      label: 'Flagged',
      description: 'High risk deal. Not recommended for listing. Review by acquisition team required.',
      status: 'flagged'
    };
  };

  const config = getScoreConfig(score);
  const ScoreIcon = config.icon;

  // Size configurations
  const sizeConfig = {
    sm: {
      badge: 'text-xs px-1.5 py-0.5',
      icon: 'w-3 h-3',
      score: 'text-xs font-semibold'
    },
    md: {
      badge: 'text-sm px-2 py-1',
      icon: 'w-4 h-4',
      score: 'text-sm font-bold'
    },
    lg: {
      badge: 'text-base px-3 py-1.5',
      icon: 'w-5 h-5',
      score: 'text-base font-bold'
    }
  };

  const fetchAnalysis = async () => {
    if (!propertyId) return;
    
    setLoading(true);
    try {
      // First check if we have cached score
      const { data: cachedScore } = await supabase
        .from('penny_deal_scores')
        .select('*')
        .eq('property_id', propertyId)
        .single();

      if (cachedScore) {
        setAnalysis({
          overall_score: cachedScore.overall_score,
          component_scores: cachedScore.component_scores || {},
          sop_verification: cachedScore.sop_verification || {},
          revenue_projections: cachedScore.revenue_projections || {},
          risk_factors: cachedScore.risk_factors || [],
          opportunities: cachedScore.opportunities || [],
          recommendation: cachedScore.recommendation || ''
        });
      } else {
        // Fetch fresh analysis
        const { data, error } = await supabase.functions.invoke('penny-deal-scoring', {
          body: { action: 'score_deal', property_id: propertyId }
        });

        if (!error && data) {
          setAnalysis(data);
        }
      }
    } catch (err) {
      console.error('Error fetching analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (onAnalysisClick) {
      onAnalysisClick();
    } else if (propertyId) {
      fetchAnalysis();
      setShowAnalysis(true);
    }
  };

  const BadgeContent = (
    <div 
      className={`inline-flex items-center gap-1 rounded-full border cursor-pointer transition-all hover:scale-105 ${config.color} ${sizeConfig[size].badge} ${className}`}
      onClick={handleClick}
    >
      <Brain className={sizeConfig[size].icon} />
      {score !== null && score !== undefined ? (
        <>
          <span className={sizeConfig[size].score}>{Math.round(score)}</span>
          {showLabel && size !== 'sm' && (
            <span className="opacity-80 text-xs">/ 100</span>
          )}
        </>
      ) : (
        <span className="text-xs">N/A</span>
      )}
    </div>
  );

  if (!showTooltip) {
    return (
      <>
        {BadgeContent}
        <AnalysisDialog 
          open={showAnalysis} 
          onOpenChange={setShowAnalysis}
          analysis={analysis}
          loading={loading}
          score={score}
          config={config}
        />
      </>
    );
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {BadgeContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.bgGradient} flex items-center justify-center`}>
                  <ScoreIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold">Penny Score: {score ?? 'N/A'}</p>
                  <p className="text-xs text-gray-500">{config.label}</p>
                </div>
              </div>
              <p className="text-xs text-gray-600">{config.description}</p>
              {propertyId && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Click for full analysis
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AnalysisDialog 
        open={showAnalysis} 
        onOpenChange={setShowAnalysis}
        analysis={analysis}
        loading={loading}
        score={score}
        config={config}
      />
    </>
  );
}

// Analysis Dialog Component
function AnalysisDialog({ 
  open, 
  onOpenChange, 
  analysis, 
  loading, 
  score,
  config 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  analysis: ScoreAnalysis | null;
  loading: boolean;
  score?: number | null;
  config: ReturnType<typeof getScoreConfigStatic>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Penny AI Deal Analysis
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <span className="ml-2 text-gray-600">Analyzing deal...</span>
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className={`p-4 rounded-xl bg-gradient-to-br ${config.bgGradient} text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Penny Score</p>
                  <p className="text-4xl font-bold">{Math.round(analysis.overall_score)}</p>
                  <p className="text-sm opacity-90">{config.label}</p>
                </div>
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                  <config.icon className="w-10 h-10" />
                </div>
              </div>
            </div>

            {/* Component Scores */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Score Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(analysis.component_scores || {}).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className={`font-semibold ${
                        (value as number) >= 80 ? 'text-emerald-600' :
                        (value as number) >= 60 ? 'text-yellow-600' :
                        (value as number) >= 40 ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        {Math.round(value as number)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          (value as number) >= 80 ? 'bg-emerald-500' :
                          (value as number) >= 60 ? 'bg-yellow-500' :
                          (value as number) >= 40 ? 'bg-orange-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SOP Verification */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                SOP Verification Checklist
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(analysis.sop_verification || {}).map(([key, checked]) => (
                  <div 
                    key={key} 
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      checked ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {checked ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    <span className="text-sm capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Projections */}
            {analysis.revenue_projections && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Revenue Projections
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <Building2 className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                    <p className="text-lg font-bold text-blue-700">
                      ${analysis.revenue_projections.str_monthly?.toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-600">STR Monthly</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <Users className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                    <p className="text-lg font-bold text-purple-700">
                      ${analysis.revenue_projections.coliving_monthly?.toLocaleString()}
                    </p>
                    <p className="text-xs text-purple-600">Co-Living Monthly</p>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-3 text-center">
                    <Calendar className="w-5 h-5 mx-auto mb-1 text-teal-600" />
                    <p className="text-lg font-bold text-teal-700">
                      ${analysis.revenue_projections.mtr_monthly?.toLocaleString()}
                    </p>
                    <p className="text-xs text-teal-600">MTR Monthly</p>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Factors */}
            {analysis.risk_factors && analysis.risk_factors.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  Risk Factors
                </h4>
                <ul className="space-y-2">
                  {analysis.risk_factors.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-2 rounded-lg">
                      <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Opportunities */}
            {analysis.opportunities && analysis.opportunities.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                  Opportunities
                </h4>
                <ul className="space-y-2">
                  {analysis.opportunities.map((opp, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 p-2 rounded-lg">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {opp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendation */}
            {analysis.recommendation && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" />
                  Penny's Recommendation
                </h4>
                <p className="text-gray-700">{analysis.recommendation}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No analysis data available</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Static version for use outside component
function getScoreConfigStatic(pennyScore: number | null | undefined) {
  if (pennyScore === null || pennyScore === undefined) {
    return {
      color: 'bg-gray-100 text-gray-600 border-gray-300',
      bgGradient: 'from-gray-100 to-gray-200',
      icon: Info,
      label: 'Not Scored',
      description: 'This property has not been analyzed by Penny AI yet.',
      status: 'pending'
    };
  }
  
  if (pennyScore >= 80) {
    return {
      color: 'bg-emerald-100 text-emerald-700 border-emerald-400',
      bgGradient: 'from-emerald-500 to-green-600',
      icon: CheckCircle,
      label: 'Excellent',
      description: 'High confidence deal.',
      status: 'excellent'
    };
  }
  
  if (pennyScore >= 60) {
    return {
      color: 'bg-yellow-100 text-yellow-700 border-yellow-400',
      bgGradient: 'from-yellow-500 to-amber-500',
      icon: TrendingUp,
      label: 'Good',
      description: 'Solid opportunity.',
      status: 'good'
    };
  }
  
  if (pennyScore >= 40) {
    return {
      color: 'bg-orange-100 text-orange-700 border-orange-400',
      bgGradient: 'from-orange-500 to-amber-600',
      icon: AlertTriangle,
      label: 'Caution',
      description: 'Moderate risk.',
      status: 'caution'
    };
  }
  
  return {
    color: 'bg-red-100 text-red-700 border-red-400',
    bgGradient: 'from-red-500 to-rose-600',
    icon: XCircle,
    label: 'Flagged',
    description: 'High risk - not recommended.',
    status: 'flagged'
  };
}

// Export for use in other components
export { getScoreConfigStatic as getPennyScoreConfig };
