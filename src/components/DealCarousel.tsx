import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Bed, 
  Bath, 
  TrendingUp, 
  CheckCircle, 
  DollarSign,
  ArrowRight,
  Loader2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

interface CarouselProperty {
  id: string;
  listing_title: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  acquisition_fee: number;
  is_furnished: boolean;
  is_verified: boolean;
  operation_type: string;
}

interface PropertyAnalytics {
  property_id: string;
  str_viability_score: number;
  coliving_viability_score: number;
}

export default function DealCarousel() {
  const [properties, setProperties] = useState<CarouselProperty[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, PropertyAnalytics>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      const { data: propertiesData, error } = await supabase
        .from('properties')
        // select('*') now fails for anon: address, landlord contact and staff
        // internals were revoked at the column level rather than nulled in the
        // browser after they were already on the wire. Ask for what this screen
        // actually shows.
        .select('id, listing_title, title, city, state, zip_code, bedrooms, bathrooms, sqft, monthly_rent, acquisition_fee, is_furnished, is_verified, staff_verified, operation_type, property_type, photos, description, listing_description, projected_monthly_revenue_peak, projected_monthly_revenue_slow, projected_yearly_revenue, adr_peak_season, adr_slow_season, avg_occupancy_rate, monthly_room_rate, peak_season_description, deposits_concessions_notes, penny_score, penny_recommendation, is_featured, featured, is_published, status, deal_status, workflow_stage, created_at, updated_at, community_name, is_third_party_seller, assigned_investor_id, cap_rate')
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      if (propertiesData && propertiesData.length > 0) {
        setProperties(propertiesData);

        const propertyIds = propertiesData.map(p => p.id);
        
        const { data: analyticsData } = await supabase
          .from('deal_analytics')
          .select('property_id, str_viability_score, coliving_viability_score')
          .in('property_id', propertyIds);


        if (analyticsData) {
          const analyticsMap: Record<string, PropertyAnalytics> = {};
          analyticsData.forEach(a => {
            analyticsMap[a.property_id] = a;
          });
          setAnalytics(analyticsMap);
        }

        const { data: photosData } = await supabase
          .from('property_photos')
          .select('property_id, original_url, processed_url, is_primary')
          .in('property_id', propertyIds)
          .eq('is_primary', true);

        if (photosData) {
          const photosMap: Record<string, string> = {};
          photosData.forEach(photo => {
            const url = photo.processed_url || photo.original_url;
            if (url) photosMap[photo.property_id] = url;
          });
          setPhotos(photosMap);
        }

        // Fallback: use photos from properties.photos JSON column
        propertiesData.forEach((property: any) => {
          if (!photos[property.id] && property.photos && Array.isArray(property.photos) && property.photos.length > 0) {
            setPhotos(prev => ({ ...prev, [property.id]: property.photos[0] }));
          }
        });

      } else {
        setProperties([]);
      }
    } catch (err) {
      console.error('Error fetching deals:', err);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const getViabilityScore = (propertyId: string) => {
    const a = analytics[propertyId];
    if (!a) return 0;
    return Math.max(a.str_viability_score || 0, a.coliving_viability_score || 0);
  };

  const nextSlide = () => {
    setCurrentIndex(prev => (prev + 1) % Math.max(1, properties.length - 2));
  };

  const prevSlide = () => {
    setCurrentIndex(prev => (prev - 1 + Math.max(1, properties.length - 2)) % Math.max(1, properties.length - 2));
  };

  if (loading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-2">Live Deals</h2>
            <p className="text-gray-600">Vetted properties ready for acquisition</p>
          </div>
          <div className="flex justify-center py-12">
            <Loader2 className="w-10 h-10 text-[#d4a574] animate-spin" />
          </div>
        </div>
      </section>
    );
  }

  // Empty state
  if (properties.length === 0) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-2">Live Deals</h2>
            <p className="text-gray-600">Vetted properties ready for acquisition</p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-br from-[#1a365d]/5 via-[#d4a574]/5 to-transparent p-10 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] rounded-2xl flex items-center justify-center shadow-lg">
                  <Building2 className="w-8 h-8 text-[#d4a574]" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  No Properties Currently Available
                </h3>
                
                <p className="text-gray-600 max-w-md mx-auto mb-6">
                  We're actively sourcing new pre-negotiated rental arbitrage opportunities. 
                  Check back soon or sign up for deal alerts.
                </p>

                <div className="flex flex-wrap justify-center gap-4">
                  <Button 
                    asChild
                    className="bg-[#d4a574] hover:bg-[#c49464] text-white"
                  >
                    <Link to="/investor/login">

                      <Sparkles className="w-4 h-4 mr-2" />
                      Get Deal Alerts
                    </Link>
                  </Button>
                  <Button 
                    asChild
                    variant="outline"
                  >
                    <Link to="/deals">
                      View Deal Flow
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Show carousel with deals
  const visibleProperties = properties.slice(currentIndex, currentIndex + 3);

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#d4a574]/10 px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-[#d4a574]" />
            <span className="text-sm font-medium text-[#d4a574]">{properties.length} Active Deals</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a2332] mb-2">Live Deals</h2>
          <p className="text-gray-600">Vetted properties ready for acquisition</p>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Navigation Buttons */}
          {properties.length > 3 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
                aria-label="Previous deals"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
                aria-label="Next deals"
              >
                <ChevronRightIcon className="w-6 h-6 text-gray-600" />
              </button>
            </>
          )}

          {/* Property Cards */}
          <div className="grid md:grid-cols-3 gap-6 px-8">
            {visibleProperties.map(property => {
              const viability = getViabilityScore(property.id);
              const displayTitle = property.listing_title || `${property.bedrooms}BR ${property.operation_type === 'coliving' ? 'Co-Living' : 'STR'} in ${property.city}`;
              
              return (
                <div 
                  key={property.id}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-[#1a365d] to-[#2d4a7c]">
                    {photos[property.id] ? (
                      <img 
                        src={photos[property.id]} 
                        alt={displayTitle} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="w-12 h-12 text-white/40" />
                      </div>
                    )}
                    
                    <div className="absolute top-3 left-3 flex gap-2">
                      {property.is_verified && (
                        <Badge className="bg-green-500 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      <Badge className="bg-[#d4a574] text-xs">
                        {property.operation_type === 'coliving' ? 'Co-Living' : property.operation_type === 'both' ? 'Both' : 'STR'}
                      </Badge>
                    </div>
                    
                    {viability > 0 && (
                      <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>{viability}%</span>
                      </div>
                    )}
                    
                    <div className="absolute bottom-3 right-3 bg-[#1a365d] text-white px-2 py-1 rounded-lg text-sm font-semibold flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {property.acquisition_fee?.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                      {displayTitle}
                    </h3>
                    
                    <p className="text-gray-500 text-sm flex items-center gap-1 mb-2">
                      <MapPin className="w-3 h-3" />
                      {property.city}, {property.state}
                    </p>
                    
                    <div className="flex gap-3 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Bed className="w-4 h-4" />
                        {property.bedrooms}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="w-4 h-4" />
                        {property.bathrooms}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span>${property.monthly_rent?.toLocaleString()}/mo</span>
                    </div>
                    
                    <Button 
                      asChild
                      size="sm"
                      className="w-full bg-[#d4a574] hover:bg-[#c49464]"
                    >
                      <Link to="/deals">
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dots Indicator */}
          {properties.length > 3 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: Math.max(1, properties.length - 2) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? 'bg-[#d4a574]' : 'bg-gray-300'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* View All CTA */}
        <div className="text-center mt-8">
          <Button 
            asChild
            size="lg"
            className="bg-[#1a365d] hover:bg-[#2d4a7c] text-white"
          >
            <Link to="/deals">
              View All {properties.length} Deals
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
