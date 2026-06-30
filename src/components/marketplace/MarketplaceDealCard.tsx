import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, Bed, Bath, Home, TrendingUp, Building2, Heart, Eye,
  ShieldCheck, Users, Briefcase, Star, ChevronLeft, ChevronRight,
  Maximize2, Clock, AlertTriangle, ExternalLink
} from 'lucide-react';
import { PennyScoreBadge } from '@/components/investor/PennyScoreBadge';
import { PropertyImage } from './PropertyImage';
import { resolvePublicPhotoUrl } from '@/utils/photoUtils';

interface DealCardProps {
  deal: any;
  analytics?: any;
  photos: string[];
  onViewDetails: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  viewMode?: 'grid' | 'list';
}

export function MarketplaceDealCard({ 
  deal, 
  analytics, 
  photos, 
  onViewDetails,
  onSave,
  isSaved = false,
  viewMode = 'grid'
}: DealCardProps) {
  const navigate = useNavigate();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Resolve all photo URLs - handle storage paths and full URLs
  const resolvedPhotos = useMemo(() => {
    const resolved = photos
      .map(p => resolvePublicPhotoUrl(p))
      .filter(url => url && url.length > 0);
    return resolved;
  }, [photos]);
  
  const viability = Math.max(analytics?.str_viability_score || 0, analytics?.coliving_viability_score || 0);
  const displayTitle = deal.listing_title || `${deal.bedrooms}BR ${deal.property_type?.replace('_', ' ') || 'Property'} in ${deal.city}`;
  // SECURITY: never show full address on public marketplace cards
  const locationDisplay = `${deal.city}, ${deal.state}`;
    ? `${deal.address}, ${deal.city}, ${deal.state}`
    : `${deal.city}, ${deal.state}`;

  const isYPApproved = deal.is_verified || deal.staff_verified;
  const operationType = deal.operation_type || 'str';
  const isThirdParty = deal.source === 'third_party';

  // Get Penny Score
  const pennyScore = deal.penny_score ?? deal.pennyScore ?? analytics?.penny_score ?? null;
  const isFlagged = pennyScore !== null && pennyScore < 40;
  
  const getOperationBadge = () => {
    switch (operationType) {
      case 'coliving':
        return { label: 'Co-Living', icon: Users, color: 'bg-purple-500' };
      case 'both':
        return { label: 'STR + Co-Living', icon: Star, color: 'bg-amber-500' };
      case 'peerspace':
        return { label: 'Peer Space', icon: Briefcase, color: 'bg-emerald-500' };
      default:
        return { label: 'Short-Term Rental', icon: Building2, color: 'bg-blue-500' };
    }
  };

  const opBadge = getOperationBadge();
  const monthlyProfit = analytics 
    ? Math.max(
        (analytics.str_yearly_revenue / 12) - deal.monthly_rent,
        (analytics.coliving_yearly_revenue / 12) - deal.monthly_rent
      )
    : 0;

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (resolvedPhotos.length > 1) {
      setCurrentPhotoIndex(prev => (prev + 1) % resolvedPhotos.length);
    }
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (resolvedPhotos.length > 1) {
      setCurrentPhotoIndex(prev => (prev - 1 + resolvedPhotos.length) % resolvedPhotos.length);
    }
  };

  const handleViewFullPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/deals/${deal.id}`);
  };

  // Build fallback photo sources - try other photos in the array
  const getFallbackSources = (primaryIndex: number): string[] => {
    return resolvedPhotos
      .filter((_, idx) => idx !== primaryIndex)
      .slice(0, 2);
  };

  if (viewMode === 'list') {
    return (
      <div 
        className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 flex cursor-pointer ${isFlagged ? 'border-red-300 bg-red-50/30' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleViewFullPage}
        role="article"
        aria-label={`Property: ${displayTitle}`}
      >
        <div className="relative w-72 h-48 flex-shrink-0 overflow-hidden">
          {resolvedPhotos.length > 0 ? (
            <PropertyImage
              src={resolvedPhotos[currentPhotoIndex] || resolvedPhotos[0]}
              alt={displayTitle}
              fallbackSources={getFallbackSources(currentPhotoIndex)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1a365d]/10 to-[#d4a574]/10 flex items-center justify-center mb-2">
                <Building2 className="w-7 h-7 text-slate-300" />
              </div>
              <span className="text-xs text-slate-400">No Photos</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            <Badge className={`${opBadge.color} text-white border-0 shadow-lg`}>
              <opBadge.icon className="w-3 h-3 mr-1" aria-hidden="true" />
              {opBadge.label}
            </Badge>
            {isYPApproved && (
              <Badge className="bg-emerald-500 text-white border-0 shadow-lg">
                <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                YP Verified
              </Badge>
            )}
          </div>

          {/* Save Button */}
          {onSave && (
            <button
              onClick={(e) => { e.stopPropagation(); onSave(); }}
              className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isSaved ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-600 hover:text-red-500'
              }`}
              aria-label={isSaved ? 'Remove from saved' : 'Save property'}
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />
            </button>
          )}

          {isFlagged && (
            <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-xs py-1 px-2 flex items-center justify-center gap-1">
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              Flagged for Review
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-5 flex flex-col">
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">{displayTitle}</h3>
                <p className="text-gray-500 text-sm flex items-center gap-1">
                  <MapPin className="w-3 h-3" aria-hidden="true" />
                  {locationDisplay}
                </p>
              </div>
              <div className="text-right flex items-center gap-3">
                <PennyScoreBadge 
                  score={pennyScore} 
                  propertyId={deal.id}
                  size="md"
                />
                <div>
                  <div className="text-2xl font-bold text-[#1a365d]">
                    ${deal.acquisition_fee?.toLocaleString() || 'TBD'}
                  </div>
                  <div className="text-xs text-gray-500">Acquisition Fee</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
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

              <span className="text-gray-400" aria-hidden="true">|</span>
              <span>${deal.monthly_rent?.toLocaleString()}/mo rent</span>
            </div>

            {analytics && monthlyProfit > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-emerald-600">
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  <span>${Math.round(monthlyProfit).toLocaleString()}/mo profit</span>
                </div>
                {viability > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {viability}% viability
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Badge variant={deal.is_furnished ? 'default' : 'outline'} className="text-xs">
                {deal.is_furnished ? 'Furnished' : 'Unfurnished'}
              </Badge>
              {deal.created_at && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {new Date(deal.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
              >
                <Eye className="w-4 h-4 mr-1" aria-hidden="true" />
                Quick View
              </Button>
              <Button 
                onClick={handleViewFullPage} 
                className="bg-[#d4a574] hover:bg-[#c49464]"
                size="sm"
              >
                <ExternalLink className="w-4 h-4 mr-1" aria-hidden="true" />
                Full Details
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid View
  return (
    <div 
      className={`bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border group cursor-pointer ${isFlagged ? 'border-red-300 bg-red-50/30' : 'border-gray-100 hover:border-[#d4a574]/30'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleViewFullPage}
      role="article"
      aria-label={`Property: ${displayTitle}`}
    >
      {/* Image Section */}
      <div className="relative h-52 overflow-hidden">
        {resolvedPhotos.length > 0 ? (
          <PropertyImage
            src={resolvedPhotos[currentPhotoIndex] || resolvedPhotos[0]}
            alt={displayTitle}
            fallbackSources={getFallbackSources(currentPhotoIndex)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a365d]/10 to-[#d4a574]/10 flex items-center justify-center mb-2">
              <Building2 className="w-8 h-8 text-slate-300" />
            </div>
            <span className="text-xs text-slate-400 font-medium">No Photos Yet</span>
          </div>
        )}

        {/* Photo Navigation */}
        {resolvedPhotos.length > 1 && isHovered && (
          <>
            <button
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors z-10"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors z-10"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </>
        )}

        {/* Photo Indicators */}
        {resolvedPhotos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10" aria-hidden="true">
            {resolvedPhotos.slice(0, 5).map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === currentPhotoIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
            {resolvedPhotos.length > 5 && (
              <span className="text-white text-xs ml-1">+{resolvedPhotos.length - 5}</span>
            )}
          </div>
        )}

        {/* Top Left Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          <Badge className={`${opBadge.color} text-white border-0 shadow-lg`}>
            <opBadge.icon className="w-3 h-3 mr-1" aria-hidden="true" />
            {opBadge.label}
          </Badge>
          {isYPApproved && (
            <Badge className="bg-emerald-500 text-white border-0 shadow-lg">
              <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
              YP Verified
            </Badge>
          )}
          {isThirdParty && (
            <Badge className="bg-purple-500 text-white border-0 shadow-lg">
              <Users className="w-3 h-3 mr-1" aria-hidden="true" />
              Third-Party
            </Badge>
          )}
        </div>

        {/* Top Right - Penny Score & Save */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <PennyScoreBadge 
            score={pennyScore} 
            propertyId={deal.id}
            size="sm"
            showLabel={false}
          />
          {onSave && (
            <button
              onClick={(e) => { e.stopPropagation(); onSave(); }}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isSaved 
                  ? 'bg-red-500 text-white' 
                  : 'bg-white/90 text-gray-600 hover:text-red-500 hover:scale-110'
              }`}
              aria-label={isSaved ? 'Remove from saved' : 'Save property'}
            >
              <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Price Badge */}
        <div className="absolute bottom-3 right-3 bg-[#1a365d] text-white px-3 py-1.5 rounded-lg font-bold shadow-lg z-10">
          ${deal.acquisition_fee?.toLocaleString() || 'TBD'}
        </div>

        {/* Quick View Button */}
        {isHovered && !isFlagged && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
            className="absolute bottom-3 left-3 bg-white/90 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-white transition-colors shadow-lg z-10"
          >
            <Maximize2 className="w-4 h-4" aria-hidden="true" />
            Quick View
          </button>
        )}

        {/* Flagged Warning */}
        {isFlagged && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-xs py-1 px-2 flex items-center justify-center gap-1 z-10">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            Flagged - Not Recommended
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-[#d4a574] transition-colors flex-1">
            {displayTitle}
          </h3>
        </div>
        
        <p className="text-gray-500 text-sm flex items-center gap-1 mb-3">
          <MapPin className="w-3 h-3" aria-hidden="true" />
          {locationDisplay}
        </p>

        {/* Property Details */}
        <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <Bed className="w-4 h-4" aria-hidden="true" />
            {deal.bedrooms}
          </span>
          <span className="flex items-center gap-1">
            <Bath className="w-4 h-4" aria-hidden="true" />
            {deal.bathrooms}
          </span>
          {(deal.sqft || deal.square_feet) && (
            <span className="flex items-center gap-1">
              <Home className="w-4 h-4" aria-hidden="true" />
              {(deal.sqft || deal.square_feet)?.toLocaleString()}
            </span>
          )}

        </div>

        {/* Rent & Status */}
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-gray-600">
            <span className="font-semibold text-gray-900">${deal.monthly_rent?.toLocaleString()}</span>/mo
          </span>
          <Badge variant={deal.is_furnished ? 'default' : 'outline'} className="text-xs">
            {deal.is_furnished ? 'Furnished' : 'Unfurnished'}
          </Badge>
        </div>

        {/* Analytics */}
        {analytics && monthlyProfit > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-2 mb-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <TrendingUp className="w-4 h-4" aria-hidden="true" />
                Est. Profit
              </span>
              <span className="font-bold text-emerald-700">
                ${Math.round(monthlyProfit).toLocaleString()}/mo
              </span>
            </div>
          </div>
        )}

        {/* CTA Button */}
        <Button 
          onClick={handleViewFullPage}
          className="w-full bg-[#d4a574] hover:bg-[#c49464] group-hover:shadow-md transition-all"
        >
          View Details
        </Button>
      </div>
    </div>
  );
}
