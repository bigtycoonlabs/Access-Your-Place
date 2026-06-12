import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, 
  MapPin, 
  Bed, 
  Bath, 
  Home, 
  TrendingUp, 
  DollarSign, 
  BarChart3,
  Award,
  Building2,
  Ruler,
  Calendar,
  Percent,
  Star,
  CheckCircle,
  Lock
} from 'lucide-react';

interface CompareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: any[];
  analytics: Record<string, any>;
  photos: Record<string, string[]>;
  onRemove: (id: string) => void;
}

export function CompareDrawer({ open, onOpenChange, properties, analytics, photos, onRemove }: CompareDrawerProps) {
  if (properties.length === 0) return null;

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return `$${Number(val).toLocaleString()}`;
  };

  const formatPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return `${val}%`;
  };

  const getViability = (id: string) => Math.max(analytics[id]?.str_viability_score || 0, analytics[id]?.coliving_viability_score || 0);
  
  const getBestValue = (values: (number | null | undefined)[], higherIsBetter = true) => {
    const validValues = values.filter(v => v !== null && v !== undefined) as number[];
    if (validValues.length === 0) return null;
    return higherIsBetter ? Math.max(...validValues) : Math.min(...validValues);
  };

  const getCapRate = (propertyId: string) => {
    const a = analytics[propertyId];
    const p = properties.find(pr => pr.id === propertyId);
    if (!a || !p || !p.acquisition_fee) return null;
    const yearlyRevenue = Math.max(a.str_yearly_revenue || 0, a.coliving_yearly_revenue || 0);
    const expenses = (p.monthly_rent || 0) * 12;
    const noi = yearlyRevenue - expenses;
    return p.acquisition_fee > 0 ? Math.round((noi / p.acquisition_fee) * 100) : null;
  };

  const getProjectedROI = (propertyId: string) => {
    const a = analytics[propertyId];
    const p = properties.find(pr => pr.id === propertyId);
    if (!a || !p || !p.acquisition_fee) return null;
    const yearlyRevenue = Math.max(a.str_yearly_revenue || 0, a.coliving_yearly_revenue || 0);
    const profit = yearlyRevenue - (p.monthly_rent || 0) * 12;
    return p.acquisition_fee > 0 ? Math.round((profit / p.acquisition_fee) * 100) : null;
  };

  const capRates = properties.map(p => getCapRate(p.id));
  const rois = properties.map(p => getProjectedROI(p.id));
  const viabilities = properties.map(p => getViability(p.id));
  const prices = properties.map(p => p.acquisition_fee);
  
  const bestCapRate = getBestValue(capRates);
  const bestROI = getBestValue(rois);
  const bestViability = getBestValue(viabilities);
  const bestPrice = getBestValue(prices, false);

  const MetricRow = ({ 
    label, 
    icon: Icon,
    values, 
    format = 'text',
    higherIsBetter = true,
    bestValue
  }: { 
    label: string; 
    icon?: any;
    values: (string | number | null | undefined)[]; 
    format?: 'text' | 'currency' | 'percent';
    higherIsBetter?: boolean;
    bestValue?: number | null;
  }) => (
    <div className="grid grid-cols-[180px_repeat(3,1fr)] gap-3 py-3 border-b border-gray-100 items-center">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
        {Icon && <Icon className="w-4 h-4 text-gray-400" aria-hidden="true" />}
        {label}
      </div>
      {values.map((val, i) => {
        const numVal = typeof val === 'number' ? val : null;
        const isBest = bestValue !== undefined && numVal === bestValue;
        return (
          <div key={i} className={`text-sm text-center font-semibold flex items-center justify-center ${isBest ? 'text-green-600' : ''}`}>
            {val !== null && val !== undefined ? (
              <>
                {format === 'currency' ? formatCurrency(Number(val)) :
                format === 'percent' ? formatPercent(Number(val)) : val}
                {isBest && <CheckCircle className="w-4 h-4 text-green-500 ml-1" aria-hidden="true" />}
              </>
            ) : <span className="text-gray-300">-</span>}
          </div>
        );
      })}
      {values.length < 3 && Array(3 - values.length).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
    </div>
  );

  // Calculate overall winner
  const calculateScore = (propertyId: string) => {
    let score = 0;
    const capRate = getCapRate(propertyId);
    const roi = getProjectedROI(propertyId);
    const viability = getViability(propertyId);
    const p = properties.find(pr => pr.id === propertyId);
    
    if (capRate === bestCapRate) score += 25;
    if (roi === bestROI) score += 25;
    if (viability === bestViability) score += 25;
    if (p?.acquisition_fee === bestPrice) score += 25;
    
    return score;
  };

  const scores = properties.map(p => ({ id: p.id, score: calculateScore(p.id) }));
  const winnerId = scores.sort((a, b) => b.score - a.score)[0]?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0" aria-describedby="compare-description">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-[#1a365d] to-[#2d4a7c]">
          <DialogTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
            Side-by-Side Deal Comparison
            <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
              {properties.length} Properties
            </Badge>
          </DialogTitle>
          <p id="compare-description" className="sr-only">Compare selected properties side by side</p>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(95vh-80px)]">
          <div className="p-6 space-y-6">
            {/* Property Cards Header */}
            <div className="grid grid-cols-[180px_repeat(3,1fr)] gap-3">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Property</div>
              {properties.map(p => (
                <Card key={p.id} className={`relative overflow-hidden ${p.id === winnerId ? 'ring-2 ring-green-500' : ''}`}>
                  {p.id === winnerId && (
                    <div className="absolute top-0 left-0 right-0 bg-green-500 text-white text-xs py-1 text-center font-semibold flex items-center justify-center gap-1">
                      <Award className="w-3 h-3" aria-hidden="true" /> Best Overall
                    </div>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-1 right-1 z-10 h-6 w-6 p-0 rounded-full bg-red-100 hover:bg-red-200" 
                    onClick={() => onRemove(p.id)}
                    aria-label={`Remove ${p.listing_title || p.city} from comparison`}
                  >
                    <X className="w-3 h-3 text-red-600" aria-hidden="true" />
                  </Button>
                  <div className={p.id === winnerId ? 'pt-6' : ''}>
                    <img 
                      src={photos[p.id]?.[0] || '/placeholder.svg'} 
                      alt={p.listing_title || `Property in ${p.city}`} 
                      className="w-full h-32 object-cover" 
                    />
                    <div className="p-3">
                      {/* Title - No address shown */}
                      <h4 className="text-sm font-semibold line-clamp-1">
                        {p.listing_title || `${p.bedrooms}BR in ${p.city}`}
                      </h4>
                      {/* Location - City, State, ZIP only */}
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" aria-hidden="true" />
                        {p.city}, {p.state} {p.zip_code || ''}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          <Bed className="w-3 h-3 mr-1" aria-hidden="true" />{p.bedrooms}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Bath className="w-3 h-3 mr-1" aria-hidden="true" />{p.bathrooms}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {properties.length < 3 && Array(3 - properties.length).fill(null).map((_, i) => (
                <Card key={`empty-${i}`} className="border-dashed flex items-center justify-center h-[200px] text-gray-400">
                  <div className="text-center">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
                    <p className="text-sm">Add property to compare</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Key Metrics Summary */}
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <div className="p-4">
                <h5 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4" aria-hidden="true" /> Key Investment Metrics
                </h5>
                <MetricRow 
                  label="Acquisition Fee" 
                  icon={DollarSign}
                  values={properties.map(p => p.acquisition_fee)} 
                  format="currency" 
                  higherIsBetter={false}
                  bestValue={bestPrice}
                />
                <MetricRow 
                  label="Cap Rate" 
                  icon={Percent}
                  values={capRates} 
                  format="percent"
                  bestValue={bestCapRate}
                />
                <MetricRow 
                  label="Projected ROI" 
                  icon={TrendingUp}
                  values={rois} 
                  format="percent"
                  bestValue={bestROI}
                />
                <MetricRow 
                  label="Viability Score" 
                  icon={Award}
                  values={viabilities} 
                  format="percent"
                  bestValue={bestViability}
                />
              </div>
            </Card>

            {/* Property Details */}
            <Card className="bg-gray-50">
              <div className="p-4">
                <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Home className="w-4 h-4" aria-hidden="true" /> Property Details
                </h5>
                <MetricRow label="Monthly Rent" icon={DollarSign} values={properties.map(p => p.monthly_rent)} format="currency" />
                <MetricRow label="Bedrooms" icon={Bed} values={properties.map(p => p.bedrooms)} />
                <MetricRow label="Bathrooms" icon={Bath} values={properties.map(p => p.bathrooms)} />
                <MetricRow label="Square Feet" icon={Ruler} values={properties.map(p => (p.sqft || p.square_feet)?.toLocaleString())} />

                <MetricRow label="Furnished" values={properties.map(p => p.is_furnished ? 'Yes' : 'No')} />
                <MetricRow label="Property Type" values={properties.map(p => {
                  const types: Record<string, string> = {
                    'apartment': 'Apartment',
                    'townhome': 'Townhome',
                    'single_family': 'Single Family',
                    'private_landlord': 'Private Landlord',
                    'condo': 'Condo'
                  };
                  return types[p.property_type] || p.property_type || '-';
                })} />
                <MetricRow label="Operation Type" values={properties.map(p => {
                  const ops: Record<string, string> = {
                    'str': 'Short-Term Rental',
                    'coliving': 'Co-Living',
                    'both': 'Both STR & Co-Living'
                  };
                  return ops[p.operation_type] || p.operation_type || '-';
                })} />
              </div>
            </Card>

            {/* STR Projections */}
            <Card className="bg-blue-50 border-blue-200">
              <div className="p-4">
                <h5 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" aria-hidden="true" /> Short-Term Rental Projections
                </h5>
                <MetricRow 
                  label="Average Daily Rate" 
                  icon={DollarSign}
                  values={properties.map(p => analytics[p.id]?.str_adr)} 
                  format="currency"
                  bestValue={getBestValue(properties.map(p => analytics[p.id]?.str_adr))}
                />
                <MetricRow 
                  label="Occupancy Rate" 
                  icon={Percent}
                  values={properties.map(p => analytics[p.id]?.str_occupancy)} 
                  format="percent"
                  bestValue={getBestValue(properties.map(p => analytics[p.id]?.str_occupancy))}
                />
                <MetricRow 
                  label="Yearly Revenue" 
                  icon={TrendingUp}
                  values={properties.map(p => analytics[p.id]?.str_yearly_revenue)} 
                  format="currency"
                  bestValue={getBestValue(properties.map(p => analytics[p.id]?.str_yearly_revenue))}
                />
                <MetricRow 
                  label="STR Viability" 
                  icon={Award}
                  values={properties.map(p => analytics[p.id]?.str_viability_score)} 
                  format="percent"
                  bestValue={getBestValue(properties.map(p => analytics[p.id]?.str_viability_score))}
                />
              </div>
            </Card>

            {/* Co-Living Projections */}
            <Card className="bg-green-50 border-green-200">
              <div className="p-4">
                <h5 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" aria-hidden="true" /> Co-Living Projections
                </h5>
                <MetricRow 
                  label="Per Room Rate" 
                  icon={DollarSign}
                  values={properties.map(p => analytics[p.id]?.coliving_per_room)} 
                  format="currency"
                  bestValue={getBestValue(properties.map(p => analytics[p.id]?.coliving_per_room))}
                />
                <MetricRow 
                  label="Yearly Revenue" 
                  icon={TrendingUp}
                  values={properties.map(p => analytics[p.id]?.coliving_yearly_revenue)} 
                  format="currency"
                  bestValue={getBestValue(properties.map(p => analytics[p.id]?.coliving_yearly_revenue))}
                />
                <MetricRow 
                  label="Co-Living Viability" 
                  icon={Award}
                  values={properties.map(p => analytics[p.id]?.coliving_viability_score)} 
                  format="percent"
                  bestValue={getBestValue(properties.map(p => analytics[p.id]?.coliving_viability_score))}
                />
              </div>
            </Card>

            {/* Location Details - No street addresses shown */}
            <Card className="bg-purple-50 border-purple-200">
              <div className="p-4">
                <h5 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" aria-hidden="true" /> Location
                </h5>
                <MetricRow label="City" icon={MapPin} values={properties.map(p => p.city)} />
                <MetricRow label="State" values={properties.map(p => p.state)} />
                <MetricRow label="ZIP Code" values={properties.map(p => p.zip_code)} />
                {/* Address row removed - addresses not shown in public comparison */}
                <div className="mt-3 p-3 bg-amber-100 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <Lock className="w-4 h-4" aria-hidden="true" />
                    <span>Full property addresses available after acquisition</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Overall Winner Summary */}
            <Card className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white">
              <div className="p-6">
                <h5 className="font-semibold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#d4a574]" aria-hidden="true" /> Comparison Summary
                </h5>
                <div className="grid grid-cols-3 gap-4">
                  {properties.map(p => {
                    const score = calculateScore(p.id);
                    const isWinner = p.id === winnerId;
                    return (
                      <div 
                        key={p.id} 
                        className={`p-4 rounded-lg ${isWinner ? 'bg-[#d4a574] text-[#1a365d]' : 'bg-white/10'}`}
                      >
                        <div className="text-center">
                          <p className="font-semibold text-lg">{p.city}, {p.state}</p>
                          <p className="text-3xl font-bold mt-2">{score}%</p>
                          <p className="text-sm opacity-80">Match Score</p>
                          {isWinner && (
                            <Badge className="mt-2 bg-[#1a365d] text-white">
                              <Award className="w-3 h-3 mr-1" aria-hidden="true" /> Best Choice
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
