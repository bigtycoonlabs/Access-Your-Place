import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, DollarSign, CheckCircle, Clock, TrendingUp,
  RefreshCw, Loader2, Home, BarChart3, PiggyBank,
  ArrowUpRight, ArrowDownRight, Minus, MapPin, Globe, ExternalLink
} from 'lucide-react';


interface PortfolioDashboardProps {
  investorId: string;
  investorName: string;
  onNavigateToProperties?: () => void;
}

interface PortfolioProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  monthly_earnings: number;
  initial_investment: number;
  acquisition_fee: number;
  property_status: string;
  property_type: string;
  operation_type?: string;
  acquired_through_ayp: boolean;
  acquisition_source?: string;
  created_at?: string;
  community_name?: string;
  community_website?: string;
}


interface DashboardMetrics {
  totalProperties: number;
  activeProperties: number;
  pendingProperties: number;
  inactiveProperties: number;
  totalMonthlyRent: number;
  totalMonthlyEarnings: number;
  totalInitialInvestment: number;
  totalAcquisitionFees: number;
  avgMonthlyRent: number;
  avgROI: number;
  topPerformer: PortfolioProperty | null;
  marketBreakdown: Record<string, { count: number; totalRent: number }>;
  typeBreakdown: Record<string, number>;
}

function computeMetrics(properties: PortfolioProperty[]): DashboardMetrics {
  const active = properties.filter(p => p.property_status === 'active');
  const pending = properties.filter(p => p.property_status === 'pending' || p.property_status === 'pending_approval');
  const inactive = properties.filter(p => p.property_status === 'inactive');

  const totalMonthlyRent = properties.reduce((s, p) => s + (p.monthly_rent || 0), 0);
  const totalMonthlyEarnings = properties.reduce((s, p) => s + (p.monthly_earnings || 0), 0);
  const totalInitialInvestment = properties.reduce((s, p) => s + (p.initial_investment || 0), 0);
  const totalAcquisitionFees = properties.reduce((s, p) => s + (p.acquisition_fee || 0), 0);

  const avgMonthlyRent = properties.length > 0 ? totalMonthlyRent / properties.length : 0;
  const avgROI = totalInitialInvestment > 0
    ? ((totalMonthlyEarnings * 12) / totalInitialInvestment) * 100
    : 0;

  let topPerformer: PortfolioProperty | null = null;
  if (active.length > 0) {
    topPerformer = active.reduce((best, p) =>
      (p.monthly_earnings || 0) > (best.monthly_earnings || 0) ? p : best, active[0]);
  }

  const marketBreakdown: Record<string, { count: number; totalRent: number }> = {};
  properties.forEach(p => {
    const key = `${p.city}, ${p.state}`;
    if (!marketBreakdown[key]) marketBreakdown[key] = { count: 0, totalRent: 0 };
    marketBreakdown[key].count++;
    marketBreakdown[key].totalRent += (p.monthly_rent || 0);
  });

  const typeBreakdown: Record<string, number> = {};
  properties.forEach(p => {
    const type = p.operation_type || p.property_type || 'unknown';
    typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
  });

  return {
    totalProperties: properties.length,
    activeProperties: active.length,
    pendingProperties: pending.length,
    inactiveProperties: inactive.length,
    totalMonthlyRent,
    totalMonthlyEarnings,
    totalInitialInvestment,
    totalAcquisitionFees,
    avgMonthlyRent,
    avgROI,
    topPerformer,
    marketBreakdown,
    typeBreakdown,
  };
}

// Simple bar chart component (no external dependencies)
function RentBarChart({ properties }: { properties: PortfolioProperty[] }) {
  const sorted = [...properties]
    .filter(p => p.monthly_rent > 0)
    .sort((a, b) => (b.monthly_rent || 0) - (a.monthly_rent || 0))
    .slice(0, 10);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No rent data available
      </div>
    );
  }

  const maxRent = Math.max(...sorted.map(p => p.monthly_rent || 0));

  return (
    <div className="space-y-3">
      {sorted.map((property) => {
        const pct = maxRent > 0 ? ((property.monthly_rent || 0) / maxRent) * 100 : 0;
        const isActive = property.property_status === 'active';
        const barColor = isActive
          ? 'bg-gradient-to-r from-[#d4a574] to-[#c49464]'
          : 'bg-gradient-to-r from-amber-300 to-amber-400';

        return (
          <div key={property.id} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]" title={property.community_name || property.address}>
                  {property.community_name || property.address}
                </span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  {property.community_name ? property.address?.split(',')[0] : `${property.city}, ${property.state}`}
                </span>

                {!isActive && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-300 text-amber-600 flex-shrink-0">
                    {property.property_status === 'pending' || property.property_status === 'pending_approval' ? 'In Progress' : property.property_status}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-bold text-gray-900 flex-shrink-0 ml-2">
                ${(property.monthly_rent || 0).toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} flex items-center justify-end pr-2`}
                style={{ width: `${Math.max(pct, 8)}%` }}
              >
                {pct > 30 && (
                  <span className="text-[10px] font-medium text-white/90">
                    ${(property.monthly_rent || 0).toLocaleString()}/mo
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Earnings vs Rent comparison mini chart
function EarningsComparisonChart({ properties }: { properties: PortfolioProperty[] }) {
  const active = properties.filter(p => p.property_status === 'active' && (p.monthly_earnings || 0) > 0);
  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) => (b.monthly_earnings || 0) - (a.monthly_earnings || 0)).slice(0, 6);
  const maxVal = Math.max(...sorted.flatMap(p => [p.monthly_rent || 0, p.monthly_earnings || 0]));

  return (
    <div className="space-y-3">
      {sorted.map(property => {
        const rentPct = maxVal > 0 ? ((property.monthly_rent || 0) / maxVal) * 100 : 0;
        const earnPct = maxVal > 0 ? ((property.monthly_earnings || 0) / maxVal) * 100 : 0;
        const profit = (property.monthly_earnings || 0) - (property.monthly_rent || 0);

        return (
          <div key={property.id}>

            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700 truncate max-w-[180px]" title={property.community_name || property.address}>
                {property.community_name || property.address}
              </span>
              <div className="flex items-center gap-1">
                {profit > 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                ) : profit < 0 ? (
                  <ArrowDownRight className="w-3 h-3 text-red-500" />
                ) : (
                  <Minus className="w-3 h-3 text-gray-400" />
                )}
                <span className={`text-xs font-bold ${profit > 0 ? 'text-green-600' : profit < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {profit >= 0 ? '+' : ''}${profit.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-12">Rent</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.max(rentPct, 5)}%` }} />
                </div>
                <span className="text-[10px] text-gray-500 w-14 text-right">${(property.monthly_rent || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-12">Earn</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className="h-full rounded-full bg-green-400" style={{ width: `${Math.max(earnPct, 5)}%` }} />
                </div>
                <span className="text-[10px] text-gray-500 w-14 text-right">${(property.monthly_earnings || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-4 pt-2 border-t">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-[10px] text-gray-500">Monthly Rent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="text-[10px] text-gray-500">Monthly Earnings</span>
        </div>
      </div>
    </div>
  );
}

export function PortfolioDashboard({ investorId, investorName, onNavigateToProperties }: PortfolioDashboardProps) {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPortfolio = useCallback(async (showRefreshToast = false) => {
    if (showRefreshToast) setRefreshing(true);
    else setLoading(true);
    setError(null);

    let fetched: PortfolioProperty[] = [];

    // Approach 1: manage-investor-admin get_investor action
    try {
      console.log('[PortfolioDashboard] Trying manage-investor-admin get_investor...');
      const { data, error: fnErr } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'get_investor', investor_id: investorId }
      });
      if (!fnErr && data?.success && data.portfolio && Array.isArray(data.portfolio)) {
        fetched = data.portfolio;
        console.log('[PortfolioDashboard] Got', fetched.length, 'properties from manage-investor-admin');
      }
    } catch (e) {
      console.warn('[PortfolioDashboard] manage-investor-admin failed:', e);
    }

    // Approach 2: investor-auth get_portfolio_properties
    if (fetched.length === 0) {
      try {
        console.log('[PortfolioDashboard] Trying investor-auth get_portfolio_properties...');
        const { data, error: fnErr } = await supabase.functions.invoke('investor-auth', {
          body: { action: 'get_portfolio_properties', investor_id: investorId }
        });
        if (!fnErr && data?.properties && Array.isArray(data.properties)) {
          fetched = data.properties;
          console.log('[PortfolioDashboard] Got', fetched.length, 'properties from investor-auth');
        }
      } catch (e) {
        console.warn('[PortfolioDashboard] investor-auth failed:', e);
      }
    }

    // Approach 3: Direct database query
    if (fetched.length === 0) {
      try {
        console.log('[PortfolioDashboard] Trying direct DB query...');
        const { data: dbData, error: dbErr } = await supabase.functions.invoke('get-portfolio', {
        body: { investor_id: investorId },
        // Original ordered by created_at descending. ayp_investor_portfolio already
        // aggregates in that order, so the ordering is preserved by the source rather than
        // reapplied here — verified against the function definition, not assumed.
      }).then(r => ({ data: r.data?.units ?? [] }));

        if (!dbErr && dbData && dbData.length > 0) {
          fetched = dbData;
          console.log('[PortfolioDashboard] Got', fetched.length, 'properties from direct DB');
        }
      } catch (e) {
        console.warn('[PortfolioDashboard] Direct DB query failed:', e);
      }
    }

    setProperties(fetched);
    if (fetched.length === 0 && !error) {
      // Not an error - just no properties yet
    }

    if (showRefreshToast) {
      toast({ title: 'Dashboard Refreshed', description: `${fetched.length} properties loaded.` });
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  }, [investorId, toast]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const metrics = computeMetrics(properties);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <Skeleton className="h-5 w-5 rounded mb-3" />
                <Skeleton className="h-7 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-12 text-center">
          <Home className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Properties in Portfolio</h3>
          <p className="text-gray-500 mb-4 max-w-md mx-auto">
            Your portfolio dashboard will show metrics, charts, and performance data once you add properties.
          </p>
          {onNavigateToProperties && (
            <Button onClick={onNavigateToProperties} className="bg-[#d4a574] hover:bg-[#c49464]">
              <Building2 className="w-4 h-4 mr-2" />
              Go to Properties
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#d4a574]" />
            Portfolio Dashboard
          </h2>
          <p className="text-sm text-gray-500">
            Visual summary of your {metrics.totalProperties} {metrics.totalProperties === 1 ? 'property' : 'properties'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchPortfolio(true)}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="pt-5 pb-4">
            <Building2 className="w-5 h-5 text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-blue-900">{metrics.totalProperties}</p>
            <p className="text-xs text-blue-600 font-medium">Total Properties</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <CardContent className="pt-5 pb-4">
            <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-green-900">{metrics.activeProperties}</p>
            <p className="text-xs text-green-600 font-medium">Active</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
          <CardContent className="pt-5 pb-4">
            <Clock className="w-5 h-5 text-amber-600 mb-2" />
            <p className="text-2xl font-bold text-amber-900">{metrics.pendingProperties}</p>
            <p className="text-xs text-amber-600 font-medium">In Progress</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#d4a574]/10 to-[#d4a574]/20 border-[#d4a574]/30">
          <CardContent className="pt-5 pb-4">
            <DollarSign className="w-5 h-5 text-[#d4a574] mb-2" />
            <p className="text-2xl font-bold text-gray-900">${metrics.totalMonthlyRent.toLocaleString()}</p>
            <p className="text-xs text-[#c49464] font-medium">Total Monthly Rent</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
          <CardContent className="pt-5 pb-4">
            <TrendingUp className="w-5 h-5 text-emerald-600 mb-2" />
            <p className="text-2xl font-bold text-emerald-900">${metrics.totalMonthlyEarnings.toLocaleString()}</p>
            <p className="text-xs text-emerald-600 font-medium">Monthly Earnings</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
          <CardContent className="pt-5 pb-4">
            <PiggyBank className="w-5 h-5 text-purple-600 mb-2" />
            <p className="text-2xl font-bold text-purple-900">${metrics.totalAcquisitionFees.toLocaleString()}</p>
            <p className="text-xs text-purple-600 font-medium">Acquisition Fees Paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Avg Rent / Property</p>
            <p className="text-lg font-bold">${Math.round(metrics.avgMonthlyRent).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Invested</p>
            <p className="text-lg font-bold">${metrics.totalInitialInvestment.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Annualized ROI</p>
            <p className={`text-lg font-bold ${metrics.avgROI > 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {metrics.avgROI > 0 ? `${metrics.avgROI.toFixed(1)}%` : 'N/A'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Net Monthly</p>
            <p className={`text-lg font-bold ${(metrics.totalMonthlyEarnings - metrics.totalMonthlyRent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(metrics.totalMonthlyEarnings - metrics.totalMonthlyRent) >= 0 ? '+' : ''}
              ${(metrics.totalMonthlyEarnings - metrics.totalMonthlyRent).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Rent by Property Bar Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#d4a574]" />
              Monthly Rent by Property
            </CardTitle>
            <CardDescription className="text-xs">
              Showing top {Math.min(properties.filter(p => p.monthly_rent > 0).length, 10)} properties by rent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RentBarChart properties={properties} />
          </CardContent>
        </Card>

        {/* Earnings vs Rent Comparison */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Rent vs Earnings
            </CardTitle>
            <CardDescription className="text-xs">
              Active properties with earnings data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EarningsComparisonChart properties={properties} />
            {properties.filter(p => p.property_status === 'active' && (p.monthly_earnings || 0) > 0).length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                No earnings data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Market Breakdown & Top Performer */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Market Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Market Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(metrics.marketBreakdown).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(metrics.marketBreakdown)
                  .sort(([, a], [, b]) => b.totalRent - a.totalRent)
                  .map(([market, data]) => (
                    <div key={market} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{market}</p>
                        <p className="text-xs text-gray-500">{data.count} {data.count === 1 ? 'property' : 'properties'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">${data.totalRent.toLocaleString()}/mo</p>
                        <p className="text-xs text-gray-500">total rent</p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No market data</p>
            )}
          </CardContent>
        </Card>

        {/* Top Performer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#d4a574]" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.topPerformer ? (
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {metrics.topPerformer.community_name && (
                      <h4 className="font-bold text-[#d4a574] text-sm mb-0.5">{metrics.topPerformer.community_name}</h4>
                    )}
                    <h4 className={metrics.topPerformer.community_name ? 'text-sm text-gray-600' : 'font-semibold text-gray-900'}>{metrics.topPerformer.address}</h4>
                    <p className="text-sm text-gray-500">{metrics.topPerformer.city}, {metrics.topPerformer.state}</p>
                    {metrics.topPerformer.community_website && (
                      <a
                        href={metrics.topPerformer.community_website.startsWith('http') ? metrics.topPerformer.community_website : `https://${metrics.topPerformer.community_website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-0.5"
                      >
                        <Globe className="w-3 h-3" />
                        Website
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <Badge className="bg-[#d4a574] text-white">Top Earner</Badge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/80 p-2 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Rent</p>
                    <p className="font-bold text-sm">${(metrics.topPerformer.monthly_rent || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Earnings</p>
                    <p className="font-bold text-sm text-green-600">${(metrics.topPerformer.monthly_earnings || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Beds/Baths</p>
                    <p className="font-bold text-sm">{metrics.topPerformer.bedrooms}/{metrics.topPerformer.bathrooms}</p>
                  </div>
                </div>
                {metrics.topPerformer.initial_investment > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#d4a574]/20">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Property ROI</span>
                      <span className="font-bold text-green-600">
                        {(((metrics.topPerformer.monthly_earnings || 0) * 12 / metrics.topPerformer.initial_investment) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Building2 className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No active properties with earnings data yet</p>
                <p className="text-xs text-gray-400 mt-1">Top performer will appear once properties are active</p>
              </div>
            )}

            {/* Operation Type Breakdown */}
            {Object.keys(metrics.typeBreakdown).length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-medium text-gray-500 mb-2">Property Types</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(metrics.typeBreakdown).map(([type, count]) => (
                    <Badge key={type} variant="outline" className="text-xs capitalize">
                      {type.replace(/_/g, ' ')}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PortfolioDashboard;
