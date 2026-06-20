import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, Bed, Bath, Home, TrendingUp, Building2, Lock, DollarSign, ShieldCheck, AlertTriangle, Crown, Users, Rocket } from 'lucide-react';
import { PennyScoreBadge } from '@/components/investor/PennyScoreBadge';
import { resolvePublicPhotoUrl } from '@/utils/photoUtils';

interface DealCardProps {
  deal: any;
  analytics: any;
  photos: string[];
  onInquire: () => void;
  onStartAcquisition?: () => void;
  isSelected?: boolean;
  onToggleCompare?: (id: string) => void;
  compareDisabled?: boolean;
  showFullAddress?: boolean;
  showStartAcquisition?: boolean;
}

function DealCardImage({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError || !src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a365d] to-[#2d4a7c]">
        <Building2 className="w-16 h-16 text-white/40" aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse flex items-center justify-center z-0">
          <Building2 className="w-12 h-12 text-gray-400" />
        </div>
      )}
      <img 
        src={src} 
        alt={alt} 
        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onError={() => setHasError(true)}
        onLoad={() => setIsLoading(false)}
      />
    </>
  );
}

export function DealCard({ 
  deal, 
  analytics, 
  photos, 
  onInquire, 
  onStartAcquisition,
  isSelected, 
  onToggleCompare, 
  compareDisabled,
  showFullAddress = false,
  showStartAcquisition = false
}: DealCardProps) {
  const viability = Math.max(analytics?.str_viability_score || 0, analytics?.coliving_viability_score || 0);
  const mainPhoto = resolvePublicPhotoUrl(photos[0] || '');

  
  const displayTitle = deal.listing_title || `${deal.bedrooms}BR ${deal.property_type?.replace('_', ' ') || 'Property'} in ${deal.city}`;
  const locationDisplay = `${deal.city}, ${deal.state} ${deal.zip_code || ''}`.trim();

  const isYPApproved = deal.is_verified || deal.staff_verified || deal.yp_approved;
  const isThirdPartySeller = deal.is_third_party || deal.seller_type === 'third_party';
  
  const maxFee = isYPApproved ? 12000 : 15000;
  const creditsEligible = isYPApproved && !isThirdPartySeller;

  const pennyScore = deal.penny_score ?? deal.pennyScore ?? analytics?.penny_score ?? null;
  const isFlagged = pennyScore !== null && pennyScore < 40;
  
  return (
    <div 
      className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group ${isSelected ? 'ring-2 ring-[#d4a574]' : ''} ${isFlagged ? 'ring-2 ring-red-400 bg-red-50/30' : ''}`}
      role="article"
      aria-label={`Property listing: ${displayTitle}`}
    >
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#1a365d] to-[#2d4a7c]">
        <DealCardImage src={mainPhoto} alt={displayTitle} />

        
        {/* Deal Classification Badges - Top Left */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {isYPApproved ? (
            <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg border-0">
              <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
              YP Approved
            </Badge>
          ) : isThirdPartySeller ? (
            <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg border-0">
              <Users className="w-3 h-3 mr-1" aria-hidden="true" />
              Third-Party Seller
            </Badge>
          ) : (
            <Badge className="bg-yellow-500 text-white shadow-lg">
              <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
              Pending Verification
            </Badge>
          )}
          
          <Badge className="bg-[#d4a574] shadow-lg">
            {deal.operation_type === 'coliving' ? 'Co-Living' : deal.operation_type === 'both' ? 'STR + Co-Living' : 'STR'}
          </Badge>

          {creditsEligible && (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg border-0">
              <Crown className="w-3 h-3 mr-1" aria-hidden="true" />
              Credits Eligible
            </Badge>
          )}
        </div>
        
        {/* Penny Score Badge - Top Right */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
          <PennyScoreBadge 
            score={pennyScore} 
            propertyId={deal.id}
            size="md"
            showLabel={false}
          />
          
          {isYPApproved && (
            <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg" title="YP Compliance Verified">
              <div className="w-8 h-8 rounded-full border-2 border-green-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-green-600" />
              </div>
            </div>
          )}
        </div>

        {/* Flagged Warning Banner */}
        {isFlagged && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-xs py-1 px-3 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Flagged for Review - Not Recommended for Listing
          </div>
        )}
        
        {/* Acquisition Fee */}
        {!isFlagged && (
          <div className="absolute bottom-3 right-3 bg-[#1a365d] text-white px-3 py-1 rounded-lg font-semibold flex items-center gap-1">
            <DollarSign className="w-4 h-4" aria-hidden="true" />
            {deal.acquisition_fee?.toLocaleString() || 'TBD'} Fee
          </div>
        )}
        
        {onToggleCompare && (
          <div className="absolute bottom-3 left-3">
            <label className={`flex items-center gap-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg cursor-pointer ${compareDisabled && !isSelected ? 'opacity-50' : ''}`}>
              <Checkbox 
                checked={isSelected} 
                onCheckedChange={() => onToggleCompare(deal.id)} 
                disabled={compareDisabled && !isSelected}
                aria-label={`Compare ${displayTitle}`}
              />
              <span className="text-xs font-medium">Compare</span>
            </label>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 mb-1 line-clamp-1">
          {displayTitle}
        </h3>
        
        <p className="text-gray-500 text-sm flex items-center gap-1 mb-3">
          <MapPin className="w-3 h-3" aria-hidden="true" />
          {locationDisplay}
        </p>
        
        <div className="flex gap-4 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <Bed className="w-4 h-4" aria-hidden="true" />
            {deal.bedrooms} bed
          </span>
          <span className="flex items-center gap-1">
            <Bath className="w-4 h-4" aria-hidden="true" />
            {deal.bathrooms} bath
          </span>
          {(deal.sqft || deal.square_feet) && (
            <span className="flex items-center gap-1">
              <Home className="w-4 h-4" aria-hidden="true" />
              {(deal.sqft || deal.square_feet)?.toLocaleString()} sqft
            </span>
          )}

        </div>
        
        <div className="flex justify-between items-center text-sm mb-4">
          <span className="text-gray-600">
            Rent: <span className="font-semibold text-gray-900">${deal.monthly_rent?.toLocaleString()}/mo</span>
          </span>
          <Badge variant={deal.is_furnished ? 'default' : 'outline'}>
            {deal.is_furnished ? 'Furnished' : 'Unfurnished'}
          </Badge>
        </div>
        
        {analytics && (
          <div className="space-y-2 text-xs bg-gray-50 rounded-lg p-2 mb-4" role="region" aria-label="Financial projections">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">STR Rev:</span>{' '}
                <span className="font-medium">${(analytics.str_yearly_revenue/1000).toFixed(0)}k/yr</span>
              </div>
              <div>
                <span className="text-gray-500">Co-Living:</span>{' '}
                <span className="font-medium">${(analytics.coliving_yearly_revenue/1000).toFixed(0)}k/yr</span>
              </div>
            </div>
            {/* Enhanced financial details */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200">
              {analytics.str_adr > 0 && (
                <div>
                  <span className="text-gray-500">Avg Daily Rate:</span>{' '}
                  <span className="font-semibold text-blue-700">${analytics.str_adr}</span>
                </div>
              )}
              {analytics.coliving_per_room > 0 && (
                <div>
                  <span className="text-gray-500">Room Rate/mo:</span>{' '}
                  <span className="font-semibold text-purple-700">${analytics.coliving_per_room}</span>
                </div>
              )}
            </div>
            {/* Projected Monthly Revenue */}
            {analytics.str_yearly_revenue > 0 && (
              <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                <span className="text-gray-500">Proj. Monthly Rev:</span>
                <span className="font-bold text-emerald-700">${Math.round(analytics.str_yearly_revenue / 12).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}


        {/* Deal Classification Info */}
        <div className={`text-xs rounded-lg p-2 mb-4 ${isFlagged ? 'bg-red-50 border border-red-200' : isYPApproved ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200'}`}>
          {isFlagged ? (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 text-red-600 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-medium text-red-800">Flagged Deal</span>
                <p className="text-red-600">Penny Score below 40 - requires AM review before listing</p>
              </div>
            </div>
          ) : isYPApproved ? (
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-3 h-3 text-green-600 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-medium text-green-800">YP Approved Deal</span>
                <p className="text-green-600">Eligible for YP Credits • Max fee: ${maxFee.toLocaleString()}</p>
              </div>
            </div>
          ) : isThirdPartySeller ? (
            <div className="flex items-start gap-2">
              <Users className="w-3 h-3 text-purple-600 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-medium text-purple-800">Third-Party Seller</span>
                <p className="text-purple-600">Custom fees up to ${maxFee.toLocaleString()} • YP Credits not applicable</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-medium text-amber-800">Pending Verification</span>
                <p className="text-amber-600">Awaiting YP team review</p>
              </div>
            </div>
          )}
        </div>
        
        {!showFullAddress && (
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4">
            <Lock className="w-3 h-3 text-amber-600" aria-hidden="true" />
            <span>Full address released after account funding</span>
          </div>
        )}
        
        {deal.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-4">
            {deal.description}
          </p>
        )}
        
        <div className="space-y-2">
          {showStartAcquisition && onStartAcquisition && !isFlagged && (
            <Button 
              onClick={onStartAcquisition} 
              className="w-full bg-gradient-to-r from-[#1a365d] to-[#2d5a87] hover:from-[#2d5a87] hover:to-[#1a365d]"
              aria-label={`Start acquisition for ${displayTitle}`}
            >
              <Rocket className="w-4 h-4 mr-2" />
              Start My Acquisition
            </Button>
          )}
          
          <Button 
            onClick={onInquire} 
            variant={showStartAcquisition ? 'outline' : 'default'}
            className={showStartAcquisition ? 'w-full' : 'w-full bg-[#d4a574] hover:bg-[#c49464]'}
            aria-label={`Request details for ${displayTitle}`}
          >
            Request Details
          </Button>
        </div>
      </div>
    </div>
  );
}
