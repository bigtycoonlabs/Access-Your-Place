import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, ChevronRight, MapPin, Bed, Bath, TrendingUp,
  ShieldCheck, Star, Sparkles, ArrowRight
} from 'lucide-react';
import { resolvePublicPhotoUrl } from '@/utils/photoUtils';

interface FeaturedDeal {
  id: string;
  listing_title: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  acquisition_fee: number;
  operation_type: string;
  is_verified: boolean;
  photos?: string[];
  analytics?: {
    str_yearly_revenue?: number;
    coliving_yearly_revenue?: number;
  };
}

interface FeaturedDealsCarouselProps {
  deals: FeaturedDeal[];
  onViewDeal: (deal: FeaturedDeal) => void;
}

export function FeaturedDealsCarousel({ deals, onViewDeal }: FeaturedDealsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying || deals.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % deals.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, deals.length]);

  if (deals.length === 0) return null;

  const currentDeal = deals[currentIndex];
  const rawPhoto = currentDeal.photos?.[0];
  const mainPhoto = rawPhoto ? resolvePublicPhotoUrl(rawPhoto) : undefined;

  const monthlyProfit = currentDeal.analytics 
    ? Math.max(
        ((currentDeal.analytics.str_yearly_revenue || 0) / 12) - currentDeal.monthly_rent,
        ((currentDeal.analytics.coliving_yearly_revenue || 0) / 12) - currentDeal.monthly_rent
      )
    : 0;

  const goToPrev = () => {
    setIsAutoPlaying(false);
    setCurrentIndex(prev => (prev - 1 + deals.length) % deals.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex(prev => (prev + 1) % deals.length);
  };

  return (
    <div className="bg-gradient-to-r from-[#1a365d] via-[#2d4a7c] to-[#1a365d] rounded-2xl overflow-hidden">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Featured Deals</h2>
              <p className="text-sm text-white/60">Hand-picked opportunities</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrev}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="flex transition-transform duration-500 ease-out">
          <div className="w-full flex-shrink-0 px-6 pb-6">
            <div className="bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
              {/* Image */}
              <div className="md:w-2/5 h-64 md:h-auto relative">
                {mainPhoto ? (
                  <img 
                    src={mainPhoto} 
                    alt={currentDeal.listing_title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center min-h-[200px]">
                    <Star className="w-16 h-16 text-gray-400" />
                  </div>
                )}

                
                {/* Featured Badge */}
                <div className="absolute top-4 left-4">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    Featured
                  </Badge>
                </div>

                {currentDeal.is_verified && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-emerald-500 text-white border-0 shadow-lg">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="md:w-3/5 p-6 flex flex-col">
                <div className="flex-1">
                  <Badge className="mb-3 bg-[#d4a574]">
                    {currentDeal.operation_type === 'coliving' ? 'Co-Living' : 
                     currentDeal.operation_type === 'both' ? 'STR + Co-Living' : 'STR'}
                  </Badge>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {currentDeal.listing_title || `${currentDeal.bedrooms}BR in ${currentDeal.city}`}
                  </h3>
                  
                  <p className="text-gray-500 flex items-center gap-1 mb-4">
                    <MapPin className="w-4 h-4" />
                    {currentDeal.city}, {currentDeal.state}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-[#1a365d]">
                        ${currentDeal.acquisition_fee?.toLocaleString() || 'TBD'}
                      </div>
                      <div className="text-xs text-gray-500">Acquisition Fee</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">
                        ${currentDeal.monthly_rent?.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">Monthly Rent</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-center gap-2 text-lg font-bold text-gray-900">
                        <Bed className="w-5 h-5" />
                        {currentDeal.bedrooms}
                      </div>
                      <div className="text-xs text-gray-500">Bedrooms</div>
                    </div>
                    {monthlyProfit > 0 && (
                      <div className="text-center p-3 bg-emerald-50 rounded-lg">
                        <div className="text-2xl font-bold text-emerald-600">
                          ${Math.round(monthlyProfit).toLocaleString()}
                        </div>
                        <div className="text-xs text-emerald-700">Est. Profit/mo</div>
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={() => onViewDeal(currentDeal)}
                  className="bg-[#d4a574] hover:bg-[#c49464] w-full md:w-auto"
                >
                  View Deal Details
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Indicators */}
        {deals.length > 1 && (
          <div className="flex justify-center gap-2 pb-6">
            {deals.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsAutoPlaying(false);
                  setCurrentIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex 
                    ? 'bg-white w-6' 
                    : 'bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
