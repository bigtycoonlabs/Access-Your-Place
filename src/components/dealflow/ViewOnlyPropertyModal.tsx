import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Eye, DollarSign, TrendingUp, BarChart3, Percent, Home, Image,
  MapPin, Bed, Bath, Building2, Star, ShieldCheck, AlertTriangle,
  Lock, Users, FileText, CheckCircle, Info
} from 'lucide-react';
import { Property, DealAnalytics, PropertyPhoto } from '@/types/dealflow';
import { DealPreview } from './DealPreview';
import { PennyScoreBadge } from '@/components/investor/PennyScoreBadge';

interface ViewOnlyPropertyModalProps {
  property: Property | null;
  analytics: DealAnalytics | null;
  photos: PropertyPhoto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewOnlyPropertyModal({ property, analytics, photos, open, onOpenChange }: ViewOnlyPropertyModalProps) {
  if (!property) return null;

  const typeLabels: Record<string, string> = {
    apartment: 'Apartment Community',
    private_landlord: 'Private Landlord',
    townhome: 'Townhome Community',
    single_family: 'Single Family Home',
    condo: 'Condo',
    multi_family: 'Multi-Family'
  };

  const pennyScore = property.penny_score ?? null;
  const isFlagged = pennyScore !== null && pennyScore < 40;

  // Calculate projected revenue from financial inputs
  const calcMonthlyRevenue = () => {
    const adr = property.adr_peak_season || 0;
    const occ = (property.avg_occupancy_rate || 0) / 100;
    return Math.round(adr * occ * 30);
  };

  const calcNetMonthly = () => {
    return calcMonthlyRevenue() - (property.monthly_rent || 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby="view-only-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Eye className="w-5 h-5 text-gray-500" aria-hidden="true" />
            <span className="truncate">{property.listing_title || `${property.bedrooms}BR in ${property.city}`}</span>
            <Badge className="bg-slate-600 text-white ml-1">
              <Lock className="w-3 h-3 mr-1" aria-hidden="true" />
              View Only
            </Badge>
            {property.is_verified ? (
              <Badge className="bg-green-100 text-green-700">
                <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                Verified
              </Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-700">
                <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
                Unverified
              </Badge>
            )}
            <PennyScoreBadge score={pennyScore} propertyId={property.id} size="sm" />
          </DialogTitle>
          <p id="view-only-desc" className="text-sm text-gray-500">
            {property.address}, {property.city}, {property.state} {property.zip_code}
          </p>
          {/* View-only info banner */}
          <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-slate-600">
              You are viewing this deal in read-only mode. To edit this property, it must be assigned to you or you must have Success Team permissions.
              Contact the Success Team if you need to make changes.
            </p>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="flex-wrap" aria-label="View deal sections">
            <TabsTrigger value="details">
              <Building2 className="w-4 h-4 mr-1" aria-hidden="true" /> Details
            </TabsTrigger>
            <TabsTrigger value="financials">
              <DollarSign className="w-4 h-4 mr-1" aria-hidden="true" /> Financials
            </TabsTrigger>
            <TabsTrigger value="photos">
              <Image className="w-4 h-4 mr-1" aria-hidden="true" /> Photos ({(property.photos?.length || 0) + photos.length})
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="w-4 h-4 mr-1" aria-hidden="true" /> Preview
            </TabsTrigger>
          </TabsList>

          {/* ============ DETAILS TAB ============ */}
          <TabsContent value="details" className="space-y-6 mt-4">
            {/* Flagged Warning */}
            {isFlagged && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-red-800">Deal Flagged by Penny AI</p>
                    <p className="text-sm text-red-600 mt-1">
                      This property scored below 40 and is not recommended for listing.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Listing Description */}
            <Card className="border-2 border-slate-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-500" aria-hidden="true" />
                  Listing Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(property.description || property.listing_description) ? (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap min-h-[100px]">
                    {property.description || property.listing_description}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No description available for this property.</p>
                )}
              </CardContent>
            </Card>

            {/* Property Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-500" htmlFor="listing-title">Listing Title</Label>
                  <Input id="listing-title"
                    value={property.listing_title || ''}
                    disabled
                    className="bg-gray-50 cursor-not-allowed"
                  />
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2 text-sm">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Property Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                      <span className="text-gray-500">Type:</span>
                      <span className="font-medium">{typeLabels[property.property_type] || property.property_type}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Bed className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                      <span className="text-gray-500">Beds:</span>
                      <span className="font-medium">{property.bedrooms}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Bath className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                      <span className="text-gray-500">Baths:</span>
                      <span className="font-medium">{property.bathrooms}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                      <span className="text-gray-500">Units:</span>
                      <span className="font-medium">{property.units_available || 1}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  <span className="text-gray-600">{property.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  <span className="text-gray-600">{property.city}, {property.state} {property.zip_code}</span>
                </div>
              </div>
              <div className="space-y-4">
                {/* Status badges */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status & Flags</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={property.is_verified ? 'text-green-600 border-green-300 bg-green-50' : 'text-yellow-600 border-yellow-300 bg-yellow-50'}>
                      {property.is_verified ? (
                        <><CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" /> Verified</>
                      ) : (
                        <><AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" /> Unverified</>
                      )}
                    </Badge>
                    <Badge variant="outline" className={property.is_published ? 'text-emerald-600 border-emerald-300 bg-emerald-50' : 'text-gray-500 border-gray-300 bg-gray-50'}>
                      {property.is_published ? 'Published' : 'Unpublished'}
                    </Badge>
                    {property.is_furnished && (
                      <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">Furnished</Badge>
                    )}
                    {property.is_featured && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                        <Star className="w-3 h-3 mr-1 fill-amber-500" aria-hidden="true" /> Featured
                      </Badge>
                    )}
                    <Badge variant="outline">{property.status}</Badge>
                    {property.deal_status && property.deal_status !== property.status && (
                      <Badge variant="outline">{property.deal_status}</Badge>
                    )}
                  </div>
                </div>

                {/* Staff Attribution */}
                {(property.found_by_am_name || property.submitted_by_staff_name || property.referred_by_partner) && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2 text-sm">
                    <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Staff Attribution</p>
                    {property.found_by_am_name && (
                      <p className="text-indigo-700"><span className="font-medium">Found by:</span> {property.found_by_am_name}</p>
                    )}
                    {property.submitted_by_staff_name && (
                      <p className="text-indigo-700"><span className="font-medium">Submitted by:</span> {property.submitted_by_staff_name}</p>
                    )}
                    {property.referred_by_partner && (
                      <p className="text-indigo-700"><span className="font-medium">Referred by:</span> {property.referred_by_partner}</p>
                    )}
                  </div>
                )}

                {/* Operation type */}
                {property.operation_type && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Operation Type</p>
                    <p className="font-medium text-gray-700 capitalize">{property.operation_type === 'str' ? 'Short-Term Rental' : property.operation_type === 'mtr' ? 'Mid-Term Rental' : property.operation_type === 'ltr' ? 'Long-Term Rental' : property.operation_type}</p>
                  </div>
                )}

                {/* Internal notes (read-only) */}
                {property.staff_internal_notes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <p className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-1">Staff Internal Notes</p>
                    <p className="text-amber-800 whitespace-pre-wrap text-xs">{property.staff_internal_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ============ FINANCIALS TAB ============ */}
          <TabsContent value="financials" className="space-y-6 mt-4">
            {/* Revenue Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="group" aria-label="Financial summary">
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-600" aria-hidden="true" />
                    <span className="text-xs text-green-700 font-medium">Est. Monthly Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-green-800">${calcMonthlyRevenue().toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Home className="w-4 h-4 text-blue-600" aria-hidden="true" />
                    <span className="text-xs text-blue-700 font-medium">Monthly Rent</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800">${(property.monthly_rent || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className={`bg-gradient-to-br ${calcNetMonthly() >= 0 ? 'from-emerald-50 to-green-50 border-emerald-200' : 'from-red-50 to-rose-50 border-red-200'}`}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span className="text-xs font-medium">Net Monthly</span>
                  </div>
                  <p className={`text-2xl font-bold ${calcNetMonthly() >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    ${calcNetMonthly().toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-amber-600" aria-hidden="true" />
                    <span className="text-xs text-amber-700 font-medium">Acquisition Fee</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-800">${(property.acquisition_fee || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            {/* Core Financial Fields (read-only) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                  Core Financial Details
                  <Badge variant="outline" className="text-slate-500 border-slate-300 text-xs ml-2">
                    <Lock className="w-3 h-3 mr-1" aria-hidden="true" /> Read Only
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 flex items-center gap-1" htmlFor="monthly-property-rent">
                      <DollarSign className="w-3 h-3" aria-hidden="true" /> Monthly Property Rent
                    </Label>
                    <Input id="monthly-property-rent" value={property.monthly_rent ? `$${property.monthly_rent.toLocaleString()}` : 'Not set'} disabled className="bg-gray-50 cursor-not-allowed font-medium" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 flex items-center gap-1" htmlFor="acquisition-fee">
                      <DollarSign className="w-3 h-3" aria-hidden="true" /> Acquisition Fee
                    </Label>
                    <Input id="acquisition-fee" value={property.acquisition_fee ? `$${property.acquisition_fee.toLocaleString()}` : 'Not set'} disabled className="bg-gray-50 cursor-not-allowed font-medium" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 flex items-center gap-1" htmlFor="average-occupancy-rate">
                      <Percent className="w-3 h-3" aria-hidden="true" /> Average Occupancy Rate
                    </Label>
                    <Input id="average-occupancy-rate" value={property.avg_occupancy_rate ? `${property.avg_occupancy_rate}%` : 'Not set'} disabled className="bg-gray-50 cursor-not-allowed font-medium" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ADR Details (read-only) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                  Average Daily Rate (ADR) Details
                  <Badge variant="outline" className="text-slate-500 border-slate-300 text-xs ml-2">
                    <Lock className="w-3 h-3 mr-1" aria-hidden="true" /> Read Only
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500" htmlFor="adr-peak-season">ADR - Peak Season</Label>
                    <Input id="adr-peak-season" value={property.adr_peak_season ? `$${property.adr_peak_season}` : 'Not set'} disabled className="bg-gray-50 cursor-not-allowed font-medium" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500" htmlFor="adr-slow-season">ADR - Slow Season</Label>
                    <Input id="adr-slow-season" value={property.adr_slow_season ? `$${property.adr_slow_season}` : 'Not set'} disabled className="bg-gray-50 cursor-not-allowed font-medium" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500" htmlFor="average-room-rate-month">Average Room Rate ($/month)</Label>
                    <Input id="average-room-rate-month" value={property.monthly_room_rate ? `$${property.monthly_room_rate}` : 'Not set'} disabled className="bg-gray-50 cursor-not-allowed font-medium" />
                  </div>
                </div>
                {property.peak_season_description && (
                  <div className="mt-4">
                    <Label className="text-xs text-gray-500" htmlFor="peak-season-description">Peak Season Description</Label>
                    <Input id="peak-season-description" value={property.peak_season_description} disabled className="bg-gray-50 cursor-not-allowed" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue Projections (read-only) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                  Revenue Projections
                  <Badge variant="outline" className="text-slate-500 border-slate-300 text-xs ml-2">
                    <Lock className="w-3 h-3 mr-1" aria-hidden="true" /> Read Only
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500" htmlFor="projected-yearly-revenue">Projected Yearly Revenue</Label>
                    <Input id="projected-yearly-revenue" value={property.projected_yearly_revenue ? `$${Number(property.projected_yearly_revenue).toLocaleString()}` : 'Not set'} disabled className="bg-gray-50 cursor-not-allowed font-medium" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500" htmlFor="monthly-revenue-peak">Monthly Revenue - Peak</Label>
                    <Input id="monthly-revenue-peak" value={property.projected_monthly_revenue_peak ? `$${Number(property.projected_monthly_revenue_peak).toLocaleString()}` : 'Not set'} disabled className="bg-gray-50 cursor-not-allowed font-medium" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500" htmlFor="monthly-revenue-slow">Monthly Revenue - Slow</Label>
                    <Input id="monthly-revenue-slow" value={property.projected_monthly_revenue_slow ? `$${Number(property.projected_monthly_revenue_slow).toLocaleString()}` : 'Not set'} disabled className="bg-gray-50 cursor-not-allowed font-medium" />
                  </div>
                </div>
                {property.deposits_concessions_notes && (
                  <div>
                    <Label className="text-xs text-gray-500" htmlFor="deposits-concessions-notes">Deposits, Concessions & Notes</Label>
                    <Textarea id="deposits-concessions-notes"
                      value={property.deposits_concessions_notes}
                      disabled
                      rows={3}
                      className="bg-gray-50 cursor-not-allowed text-sm"
                    />
                  </div>
                )}

                {/* Auto-calculated summary */}
                {(property.adr_peak_season || property.adr_slow_season) && property.avg_occupancy_rate ? (
                  <div className="p-4 bg-gradient-to-r from-[#1a365d]/5 to-[#d4a574]/10 rounded-lg border border-[#d4a574]/20">
                    <h4 className="font-semibold text-sm text-[#1a365d] mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" aria-hidden="true" />
                      Calculated Estimates
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {property.adr_peak_season ? (
                        <div>
                          <p className="text-gray-500">Peak Monthly (est.)</p>
                          <p className="font-bold text-green-700">
                            ${Math.round(property.adr_peak_season * (property.avg_occupancy_rate / 100) * 30).toLocaleString()}
                          </p>
                        </div>
                      ) : null}
                      {property.adr_slow_season ? (
                        <div>
                          <p className="text-gray-500">Slow Monthly (est.)</p>
                          <p className="font-bold text-amber-700">
                            ${Math.round(property.adr_slow_season * (property.avg_occupancy_rate / 100) * 30).toLocaleString()}
                          </p>
                        </div>
                      ) : null}
                      {property.monthly_rent && property.adr_peak_season ? (
                        <div>
                          <p className="text-gray-500">Net Peak (est.)</p>
                          <p className={`font-bold ${property.adr_peak_season * (property.avg_occupancy_rate / 100) * 30 - property.monthly_rent >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            ${Math.round(property.adr_peak_season * (property.avg_occupancy_rate / 100) * 30 - property.monthly_rent).toLocaleString()}
                          </p>
                        </div>
                      ) : null}
                      {property.monthly_rent && property.adr_slow_season ? (
                        <div>
                          <p className="text-gray-500">Net Slow (est.)</p>
                          <p className={`font-bold ${property.adr_slow_season * (property.avg_occupancy_rate / 100) * 30 - property.monthly_rent >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            ${Math.round(property.adr_slow_season * (property.avg_occupancy_rate / 100) * 30 - property.monthly_rent).toLocaleString()}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Analytics from deal_analytics table */}
            {analytics && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-500" aria-hidden="true" />
                    Deal Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="font-bold text-blue-700 text-lg">${analytics.str_adr || 0}/nt</p>
                      <p className="text-gray-500 text-xs">STR Avg Daily Rate</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="font-bold text-green-700 text-lg">${(analytics.str_yearly_revenue || 0).toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">STR Yearly Revenue</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg text-center">
                      <p className="font-bold text-purple-700 text-lg">${(analytics.coliving_yearly_revenue || 0).toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">Co-Living Yearly Revenue</p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg text-center">
                      <p className="font-bold text-indigo-700 text-lg">{analytics.str_viability_score || 0}%</p>
                      <p className="text-gray-500 text-xs">STR Viability Score</p>
                    </div>
                    <div className="p-3 bg-pink-50 rounded-lg text-center">
                      <p className="font-bold text-pink-700 text-lg">{analytics.coliving_viability_score || 0}%</p>
                      <p className="text-gray-500 text-xs">Co-Living Viability</p>
                    </div>
                    {analytics.coliving_per_room ? (
                      <div className="p-3 bg-amber-50 rounded-lg text-center">
                        <p className="font-bold text-amber-700 text-lg">${analytics.coliving_per_room}/mo</p>
                        <p className="text-gray-500 text-xs">Per Room Rate</p>
                      </div>
                    ) : null}
                  </div>
                  {analytics.ai_recommendation && (
                    <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                      <p className="text-xs font-semibold text-purple-700 mb-1">AI Recommendation</p>
                      <p className="text-sm text-purple-800">{analytics.ai_recommendation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ============ PHOTOS TAB ============ */}
          <TabsContent value="photos" className="space-y-4 mt-4">
            {/* Processed photos from property_photos table */}
            {photos.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 text-sm">Processed Photos ({photos.length})</h4>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.processed_url || photo.original_url}
                        alt="Property photo"
                        className="w-full h-28 object-cover rounded-lg border border-gray-200"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      {photo.is_processed && (
                        <span className="absolute top-1 left-1 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded">Processed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photos from property.photos array */}
            {property.photos && property.photos.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 text-sm">Property Photos ({property.photos.length})</h4>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {property.photos.map((photoUrl, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={photoUrl}
                        alt={`Property photo ${idx + 1}`}
                        className="w-full h-28 object-cover rounded-lg border border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!photos.length && (!property.photos || property.photos.length === 0)) && (
              <div className="text-center py-12">
                <Image className="w-12 h-12 mx-auto text-gray-300 mb-3" aria-hidden="true" />
                <p className="text-gray-500">No photos available for this property.</p>
              </div>
            )}
          </TabsContent>

          {/* ============ PREVIEW TAB ============ */}
          <TabsContent value="preview" className="mt-4">
            <DealPreview property={property} analytics={analytics} photos={photos} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
