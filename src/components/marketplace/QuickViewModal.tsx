import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, Bed, Bath, Home, Building2, Heart, Share2,
  ShieldCheck, Users, ChevronLeft, ChevronRight,
  CheckCircle, Lock, Calculator, BarChart3,
  X, Brain, DollarSign, TrendingUp
} from 'lucide-react';
import { PennyScoreBadge } from '@/components/investor/PennyScoreBadge';
import { PennyAnalysisPanel } from '@/components/investor/PennyAnalysisPanel';
import { BuyerOfferModal } from './BuyerOfferModal';
import { resolvePublicPhotoUrl } from '@/utils/photoUtils';

interface QuickViewModalProps {
  open: boolean;
  onClose: () => void;
  deal: any;
  analytics?: any;
  photos: string[];
  onInquire: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  buyerId?: string;
  buyerName?: string;
}

export function QuickViewModal({
  open,
  onClose,
  deal,
  analytics,
  photos,
  onInquire,
  onSave,
  isSaved = false,
  buyerId,
  buyerName
}: QuickViewModalProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Resolve all photo URLs to handle storage paths
  const resolvedPhotos = useMemo(() => photos.map(p => resolvePublicPhotoUrl(p)), [photos]);

  if (!deal) return null;

  const displayTitle = deal.listing_title || `${deal.bedrooms}BR ${deal.property_type?.replace("_", " ") || "Property"} in ${deal.city}`;
  // SECURITY: never show full address in quick view
  const locationDisplay = `${deal.city}, ${deal.state} ${deal.zip_code || ""}`.trim();


  // FIXED: Declare isYPApproved which was previously used but never defined
  const isYPApproved = deal.is_verified || deal.staff_verified || deal.yp_approved;

  // Normalize analytics field names â€” schema has both `str_yearly_revenue` and
  // `str_projected_yearly_revenue` depending on edge-function vs DB query.
  const strRevenue = analytics?.str_yearly_revenue ?? analytics?.str_projected_yearly_revenue ?? 0;
  const colivingRevenue = analytics?.coliving_yearly_revenue ?? analytics?.coliving_projected_yearly_revenue ?? 0;
  const strADR = analytics?.str_adr ?? analytics?.str_average_daily_rate ?? 0;
  const strOccupancy = analytics?.str_occupancy ?? analytics?.str_occupancy_rate ?? 0;
  const colivingPerRoom = analytics?.coliving_per_room ?? analytics?.coliving_per_room_rate ?? 0;

  const monthlyRent = deal.monthly_rent || 0;
  const strMonthlyProfit = (strRevenue / 12) - monthlyRent;
  const colivingMonthlyProfit = (colivingRevenue / 12) - monthlyRent;
  const bestMonthlyProfit = Math.max(strMonthlyProfit, colivingMonthlyProfit);

  const isFlagged = deal.penny_score !== undefined && deal.penny_score < 40;

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // STAFF-ENTERED FINANCIALS (from properties table, set in AMSubmitDealModal)
  // These are the authoritative numbers entered by the staff team â€” display
  // them prominently to public clients, NOT just the auto-generated analytics.
  // Fields: adr_peak_season, adr_slow_season, monthly_room_rate,
  // avg_occupancy_rate, projected_yearly_revenue,
  // projected_monthly_revenue_peak, projected_monthly_revenue_slow,
  // peak_season_description, deposits_concessions_notes
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const adrPeak = Number(deal.adr_peak_season) || 0;
  const adrSlow = Number(deal.adr_slow_season) || 0;
  const roomRate = Number(deal.monthly_room_rate) || 0;
  const occupancyRate = Number(deal.avg_occupancy_rate) || 0;
  const projYearly = Number(deal.projected_yearly_revenue) || 0;
  const projMonthlyPeak = Number(deal.projected_monthly_revenue_peak) || 0;
  const projMonthlySlow = Number(deal.projected_monthly_revenue_slow) || 0;
  const peakSeasonDesc = deal.peak_season_description || '';
  const depositsNotes = deal.deposits_concessions_notes || '';

  // Resolve the headline ADR â€” prefer staff-entered peak ADR, then slow ADR,
  // then analytics-derived ADR.
  const headlineADR = adrPeak || adrSlow || strADR;
  // Resolve headline projected monthly revenue: peak entered â†’ slow entered â†’
  // staff-entered yearly/12 â†’ analytics-derived
  const headlineMonthlyRev =
    projMonthlyPeak ||
    projMonthlySlow ||
    (projYearly ? Math.round(projYearly / 12) : 0) ||
    Math.max(strRevenue / 12, colivingRevenue / 12);
  // Headline yearly revenue: staff-entered â†’ analytics
  const headlineYearlyRev = projYearly || Math.max(strRevenue, colivingRevenue);

  // Quick-flag: do we have ANY staff-entered financials? Used to decide if the
  // "Staff Financial Projections" panel should render in Analytics tab.
  const hasStaffFinancials =
    adrPeak > 0 || adrSlow > 0 || roomRate > 0 || occupancyRate > 0 ||
    projYearly > 0 || projMonthlyPeak > 0 || projMonthlySlow > 0;

  const nextPhoto = () => setCurrentPhotoIndex(prev => (prev + 1) % Math.max(resolvedPhotos.length, 1));
  const prevPhoto = () => setCurrentPhotoIndex(prev => (prev - 1 + Math.max(resolvedPhotos.length, 1)) % Math.max(resolvedPhotos.length, 1));



  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0" aria-label={`Property details: ${displayTitle}`}>
        <DialogHeader className="sr-only">
          <DialogTitle>{displayTitle}</DialogTitle>
          <DialogDescription>Property details, Penny AI analysis, and financial analytics for {displayTitle}</DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col lg:flex-row h-full">
          {/* Image Gallery */}
          <div className="lg:w-1/2 relative bg-gray-900" role="region" aria-label="Property photos">
            {/* Penny Score Badge Overlay */}
            <div className="absolute top-4 left-4 z-10">
              <PennyScoreBadge 
                score={deal.penny_score} 
                propertyId={deal.id}
                size="lg"
                showTooltip={true}
              />
            </div>

            <div className="relative h-72 lg:h-full">
              {resolvedPhotos[currentPhotoIndex] ? (
                <img 
                  src={resolvedPhotos[currentPhotoIndex]} 
                  alt={`${displayTitle} - Photo ${currentPhotoIndex + 1} of ${resolvedPhotos.length}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <Building2 className="w-24 h-24 text-gray-600" aria-hidden="true" />
                  <span className="sr-only">No photos available</span>
                </div>
              )}

              {resolvedPhotos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-6 h-6" aria-hidden="true" />
                  </button>
                </>
              )}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm" aria-live="polite">
                {currentPhotoIndex + 1} / {resolvedPhotos.length || 1}
              </div>

              {resolvedPhotos.length > 1 && (
                <div className="absolute bottom-16 left-4 right-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Photo thumbnails">
                  {resolvedPhotos.slice(0, 6).map((photo, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPhotoIndex(idx)}
                      className={`w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#d4a574] ${
                        idx === currentPhotoIndex ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      role="tab"
                      aria-selected={idx === currentPhotoIndex}
                      aria-label={`View photo ${idx + 1}`}
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}


              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 lg:hidden focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Close property details"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Details Panel */}
          <div className="lg:w-1/2 flex flex-col max-h-[60vh] lg:max-h-[90vh] overflow-y-auto" role="region" aria-label="Property information">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {isYPApproved && (
                      <Badge className="bg-emerald-500 text-white border-0">
                        <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                        YP Verified
                      </Badge>
                    )}
                    <Badge className="bg-[#d4a574]">
                      {deal.operation_type === 'coliving' ? 'Co-Living' : 
                       deal.operation_type === 'both' ? 'STR + Co-Living' : 'STR'}
                    </Badge>
                    {isFlagged && (
                      <Badge className="bg-red-500 text-white">
                        <Brain className="w-3 h-3 mr-1" aria-hidden="true" />
                        Flagged
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{displayTitle}</h2>
                  <p className="text-gray-500 flex items-center gap-1">
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    <span>{locationDisplay}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {onSave && (
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Save this deal"
                      onClick={onSave}
                      className={isSaved ? 'text-red-500 border-red-500' : ''}
                      aria-label={isSaved ? 'Remove from saved deals' : 'Save this deal'}
                      aria-pressed={isSaved}
                    >
                      <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />
                    </Button>
                  )}
                  <Button variant="outline" size="icon" aria-label="Share this property">
                    <Share2 className="w-5 h-5" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Financial Summary Cards */}
              <div className="grid grid-cols-3 gap-4" role="region" aria-label="Financial summary">
                <div className="bg-[#1a365d] text-white rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold" aria-label={`Acquisition fee: $${deal.acquisition_fee?.toLocaleString() || 'To be determined'}`}>
                    ${deal.acquisition_fee?.toLocaleString() || 'TBD'}
                  </div>
                  <div className="text-sm opacity-80">Acquisition Fee</div>
                </div>
                <div className="bg-gray-100 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900" aria-label={`Monthly rent: $${monthlyRent.toLocaleString()}`}>
                    ${monthlyRent.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Monthly Rent</div>
                </div>
                {bestMonthlyProfit > 0 && (
                  <div className="bg-emerald-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600" aria-label={`Estimated monthly profit: $${Math.round(bestMonthlyProfit).toLocaleString()}`}>
                      ${Math.round(bestMonthlyProfit).toLocaleString()}
                    </div>
                    <div className="text-sm text-emerald-700">Est. Profit/mo</div>
                  </div>
                )}
              </div>

              {/* Quick Financial Highlights â€” uses staff-entered values
                  (headlineADR, headlineMonthlyRev) so the public deal flow
                  surfaces the team's authoritative ADR / monthly revenue, not
                  just auto-generated analytics. Falls back to analytics. */}
              {(headlineADR > 0 || roomRate > 0 || colivingPerRoom > 0 || headlineMonthlyRev > 0) && (
                <div className="mt-4 grid grid-cols-3 gap-2" role="region" aria-label="Revenue highlights">
                  {headlineADR > 0 && (
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-blue-600 font-medium">Avg Daily Rate</p>
                      <p className="text-lg font-bold text-blue-800">${Math.round(headlineADR).toLocaleString()}</p>
                    </div>
                  )}
                  {(roomRate > 0 || colivingPerRoom > 0) && (
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-purple-600 font-medium">Room Rate/mo</p>
                      <p className="text-lg font-bold text-purple-800">${Math.round(roomRate || colivingPerRoom).toLocaleString()}</p>
                    </div>
                  )}
                  {headlineMonthlyRev > 0 && (
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-emerald-600 font-medium">Proj. Revenue/mo</p>
                      <p className="text-lg font-bold text-emerald-800">${Math.round(headlineMonthlyRev).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>


            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList className="w-full justify-start px-6 pt-4 bg-transparent border-b" aria-label="Property detail sections">
                <TabsTrigger value="overview" aria-label="Property overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics" aria-label="Property analytics and projections">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="p-6 space-y-6" role="tabpanel" aria-label="Overview">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Property Features</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Bed className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                      <div className="font-medium">{deal.bedrooms} Bedrooms</div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Bath className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                      <div className="font-medium">{deal.bathrooms} Bathrooms</div>
                    </div>
                    {(deal.sqft || deal.square_feet) && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Home className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                        <div className="font-medium">{(deal.sqft || deal.square_feet).toLocaleString()} sqft</div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                      <div className="font-medium">{deal.property_type?.replace('_', ' ') || 'Property'}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={deal.is_furnished ? 'default' : 'outline'}>
                    {deal.is_furnished ? 'Furnished' : 'Unfurnished'}
                  </Badge>
                  {isYPApproved && (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                      Landlord Approved
                    </Badge>
                  )}
                </div>

                {deal.description && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{deal.description}</p>
                  </div>
                )}

                {!hasFullAddress ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4" role="note">
                    <div className="flex items-start gap-3">
                      <Lock className="w-5 h-5 text-amber-600 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-amber-800">Full Address Protected</p>
                        <p className="text-sm text-amber-700">
                          The complete property address will be released after you fund your investor account. Only ZIP code ({deal.zip_code}) is shown publicly.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4" role="note">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-emerald-800">Full Address Visible</p>
                        <p className="text-sm text-emerald-700">
                          As a funded investor, you have access to the complete property address for faster decision-making.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </TabsContent>

              {/* The Penny AI Analysis tab is removed here for the same reason as on the
                  full deal page: PennyAnalysisPanel reads penny_deal_scores from the
                  browser (blocked) and calls penny-deal-scoring (retired 9 August 2026,
                  returns 410). It could not produce an analysis for any property. The
                  Financial Analytics tab beside it holds the real, staff-entered numbers. */}

              <TabsContent value="analytics" className="p-6 space-y-6" role="tabpanel" aria-label="Financial Analytics">
                {/* Staff-entered financial projections â€” these are the
                    AUTHORITATIVE numbers entered by the YP team in the staff
                    dashboard (AMSubmitDealModal). Show them at the top so the
                    public client always sees the team's curated numbers. */}
                {hasStaffFinancials && (
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200" role="region" aria-label="Team financial projections">
                    <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" aria-hidden="true" />
                      Team Financial Projections
                      <Badge variant="outline" className="ml-auto text-xs border-amber-300 text-amber-700">
                        Verified by YP Team
                      </Badge>
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {adrPeak > 0 && (
                        <div>
                          <div className="text-sm text-amber-700">ADR (Peak Season)</div>
                          <div className="text-xl font-bold text-amber-900">${adrPeak.toLocaleString()}/nt</div>
                        </div>
                      )}
                      {adrSlow > 0 && (
                        <div>
                          <div className="text-sm text-amber-700">ADR (Slow Season)</div>
                          <div className="text-xl font-bold text-amber-900">${adrSlow.toLocaleString()}/nt</div>
                        </div>
                      )}
                      {roomRate > 0 && (
                        <div>
                          <div className="text-sm text-amber-700">Avg Monthly Room Rate</div>
                          <div className="text-xl font-bold text-amber-900">${roomRate.toLocaleString()}/mo</div>
                        </div>
                      )}
                      {occupancyRate > 0 && (
                        <div>
                          <div className="text-sm text-amber-700">Avg Occupancy Rate</div>
                          <div className="text-xl font-bold text-amber-900">{occupancyRate}%</div>
                        </div>
                      )}
                      {projMonthlyPeak > 0 && (
                        <div>
                          <div className="text-sm text-amber-700">Projected Monthly Revenue (Peak)</div>
                          <div className="text-xl font-bold text-amber-900">${projMonthlyPeak.toLocaleString()}</div>
                        </div>
                      )}
                      {projMonthlySlow > 0 && (
                        <div>
                          <div className="text-sm text-amber-700">Projected Monthly Revenue (Slow)</div>
                          <div className="text-xl font-bold text-amber-900">${projMonthlySlow.toLocaleString()}</div>
                        </div>
                      )}
                      {projYearly > 0 && (
                        <div className="col-span-2 pt-3 border-t border-amber-200">
                          <div className="text-sm text-amber-700">Projected Yearly Revenue</div>
                          <div className="text-2xl font-bold text-amber-900">${projYearly.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                    {peakSeasonDesc && (
                      <div className="mt-3 pt-3 border-t border-amber-200 text-sm">
                        <span className="font-medium text-amber-800">Peak Season:</span>{' '}
                        <span className="text-amber-700">{peakSeasonDesc}</span>
                      </div>
                    )}
                    {depositsNotes && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium text-amber-800">Deposits & Concessions:</span>{' '}
                        <span className="text-amber-700">{depositsNotes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-generated analytics from deal_analytics table */}
                {analytics && (strRevenue > 0 || colivingRevenue > 0 || strADR > 0 || colivingPerRoom > 0) ? (
                  <>
                    <div className="bg-blue-50 rounded-xl p-4" role="region" aria-label="Short-term rental projections">
                      <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <Building2 className="w-5 h-5" aria-hidden="true" />
                        Short-Term Rental Projections
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-blue-700">Average Daily Rate</div>
                          <div className="text-xl font-bold text-blue-900">${strADR ? Math.round(strADR).toLocaleString() : 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-sm text-blue-700">Occupancy</div>
                          <div className="text-xl font-bold text-blue-900">{Math.round((strOccupancy || 0) * (strOccupancy <= 1 ? 100 : 1))}%</div>
                        </div>
                        <div>
                          <div className="text-sm text-blue-700">Projected Monthly Revenue</div>
                          <div className="text-xl font-bold text-blue-900">${Math.round(strRevenue / 12).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-sm text-blue-700">Yearly Revenue</div>
                          <div className="text-xl font-bold text-blue-900">${Math.round(strRevenue).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-sm text-blue-700">Viability Score</div>
                          <div className="text-xl font-bold text-blue-900">{analytics.str_viability_score || 0}%</div>
                        </div>
                        <div>
                          <div className="text-sm text-blue-700">Monthly Profit</div>
                          <div className={`text-xl font-bold ${strMonthlyProfit > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            ${Math.round(strMonthlyProfit).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {colivingRevenue > 0 && (
                      <div className="bg-purple-50 rounded-xl p-4" role="region" aria-label="Co-living projections">
                        <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                          <Users className="w-5 h-5" aria-hidden="true" />
                          Co-Living Projections
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-purple-700">Avg Monthly Room Rate</div>
                            <div className="text-xl font-bold text-purple-900">${colivingPerRoom ? Math.round(colivingPerRoom).toLocaleString() : 'N/A'}/mo</div>
                          </div>
                          <div>
                            <div className="text-sm text-purple-700">Projected Monthly Revenue</div>
                            <div className="text-xl font-bold text-purple-900">${Math.round(colivingRevenue / 12).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-sm text-purple-700">Yearly Revenue</div>
                            <div className="text-xl font-bold text-purple-900">${Math.round(colivingRevenue).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-sm text-purple-700">Viability Score</div>
                            <div className="text-xl font-bold text-purple-900">{analytics.coliving_viability_score || 0}%</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-emerald-50 rounded-xl p-4" role="region" aria-label="ROI summary">
                      <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                        <Calculator className="w-5 h-5" aria-hidden="true" />
                        ROI Summary
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-emerald-700">Best Monthly Profit:</span>
                          <span className="font-bold text-emerald-900">${Math.round(bestMonthlyProfit).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-emerald-700">Annual Profit:</span>
                          <span className="font-bold text-emerald-900">${Math.round(bestMonthlyProfit * 12).toLocaleString()}</span>
                        </div>
                        {deal.acquisition_fee && bestMonthlyProfit > 0 && (
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Payback Period:</span>
                            <span className="font-bold text-emerald-900">
                              {Math.ceil(deal.acquisition_fee / bestMonthlyProfit)} months
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : !hasStaffFinancials ? (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-3" aria-hidden="true" />
                    <p className="text-gray-500">Detailed analytics not available for this property yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Click the "Penny AI" tab to generate a full analysis.</p>
                  </div>
                ) : null}
              </TabsContent>

            </Tabs>

            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <Button 
                onClick={onInquire}
                className="w-full bg-[#d4a574] hover:bg-[#c49464] h-12 text-lg focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2"
                aria-label={`Request full details for ${displayTitle}`}
              >
                Request Full Details
              </Button>
              <p className="text-center text-xs text-gray-500 mt-2">
                Our team will contact you within 24 hours
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

