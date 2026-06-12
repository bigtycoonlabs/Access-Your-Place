import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, MapPin, Bed, Bath, TrendingUp, CheckCircle, DollarSign,
  ArrowRight, Loader2, Shield, Clock, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

interface FeaturedProperty {
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
  photos?: string[];
}

interface PropertyAnalytics {
  property_id: string;
  str_viability_score: number;
  coliving_viability_score: number;
  str_projected_yearly_revenue: number;
  coliving_projected_yearly_revenue: number;
}


function PropertyImageWithFallback({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError || !src) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] ${className || ''}`}>
        <Building2 className="w-16 h-16 text-white/40" />
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse flex items-center justify-center">
          <Building2 className="w-12 h-12 text-gray-400" />
        </div>
      )}
      <img 
        src={src} 
        alt={alt} 
        className={`${className || ''} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={() => setHasError(true)}
        onLoad={() => setIsLoading(false)}
      />
    </>
  );
}

export default function FeaturedDeals() {
  const [properties, setProperties] = useState<FeaturedProperty[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, PropertyAnalytics>>({});
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedDeals();
  }, []);

  const fetchFeaturedDeals = async () => {
    try {
      const { data: propertiesData, error } = await supabase
        .from('properties')
        .select('id, listing_title, city, state, zip_code, bedrooms, bathrooms, monthly_rent, acquisition_fee, is_furnished, is_verified, operation_type, photos')
        .or('is_published.eq.true,status.eq.published')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      if (propertiesData && propertiesData.length > 0) {
        setProperties(propertiesData);

        const propertyIds = propertiesData.map(p => p.id);
        const { data: analyticsData } = await supabase
          .from('deal_analytics')
          .select('property_id, str_viability_score, coliving_viability_score, str_projected_yearly_revenue, coliving_projected_yearly_revenue')
          .in('property_id', propertyIds);



        if (analyticsData) {
          const analyticsMap: Record<string, PropertyAnalytics> = {};
          analyticsData.forEach(a => { analyticsMap[a.property_id] = a; });
          setAnalytics(analyticsMap);
        }

        const { data: photosData } = await supabase
          .from('property_photos')
          .select('property_id, original_url, processed_url, is_primary')
          .in('property_id', propertyIds)
          .eq('is_primary', true);

        const photosMap: Record<string, string> = {};
        
        if (photosData) {
          photosData.forEach(photo => {
            const url = photo.processed_url || photo.original_url;
            if (url) photosMap[photo.property_id] = url;
          });
        }

        
        // Also check photos array on property if not in property_photos
        propertiesData.forEach(property => {
          if (!photosMap[property.id] && property.photos && Array.isArray(property.photos) && property.photos.length > 0) {
            // Resolve storage URLs if needed
            const photoUrl = property.photos[0];
            photosMap[property.id] = photoUrl;
          }
        });
        
        setPhotoMap(photosMap);
      } else {
        setProperties([]);
      }
    } catch (err) {
      console.error('Error fetching featured deals:', err);
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

  if (loading) {
    return (
      <section className="py-16 bg-gray-50" aria-labelledby="featured-deals-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 id="featured-deals-heading" className="text-4xl font-bold text-[#1a2332] mb-4">Featured Live Deals</h2>
            <p className="text-xl text-gray-600">Vetted properties ready for acquisition by our expert team</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-10 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (properties.length === 0) {
    return (
      <section className="py-16 bg-gray-50" aria-labelledby="featured-deals-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 id="featured-deals-heading" className="text-4xl font-bold text-[#1a2332] mb-4">Featured Live Deals</h2>
            <p className="text-xl text-gray-600">Vetted properties ready for acquisition by our expert team</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-br from-[#1a365d]/5 via-[#d4a574]/5 to-transparent p-10 text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] rounded-2xl flex items-center justify-center shadow-lg">
                  <Building2 className="w-10 h-10 text-[#d4a574]" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No Properties Currently Available</h3>
                <p className="text-gray-600 max-w-lg mx-auto mb-8">
                  We're actively sourcing new pre-negotiated rental arbitrage opportunities. 
                  Our team is working to bring you verified deals with landlord approval already secured.
                </p>
                <div className="grid md:grid-cols-3 gap-4 mb-8 text-left">
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Pre-Approved</h4>
                    <p className="text-sm text-gray-600">Landlord has already agreed to STR/co-living</p>
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Profitable</h4>
                    <p className="text-sm text-gray-600">Minimum 20% projected ROI</p>
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                      <Shield className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Compliant</h4>
                    <p className="text-sm text-gray-600">Verified legal in local jurisdiction</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button asChild size="lg" className="bg-[#d4a574] hover:bg-[#c49464] text-white">
                    <Link to="/investor/login"><Sparkles className="w-5 h-5 mr-2" />Get Deal Alerts</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/deals">View Deal Flow<ArrowRight className="w-4 h-4 ml-2" /></Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gray-50" aria-labelledby="featured-deals-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#d4a574]/10 px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-[#d4a574]" />
            <span className="text-sm font-medium text-[#d4a574]">Pre-Negotiated Opportunities</span>
          </div>
          <h2 id="featured-deals-heading" className="text-4xl font-bold text-[#1a2332] mb-4">Featured Live Deals</h2>
          <p className="text-xl text-gray-600">Vetted properties ready for acquisition by our expert team</p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 mb-10">
          {[
            { icon: Shield, label: 'Verified Properties' },
            { icon: CheckCircle, label: 'Landlord Approved' },
            { icon: TrendingUp, label: 'Revenue Projections' },
            { icon: Clock, label: 'Quick Acquisition' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-gray-600">
              <item.icon className="w-5 h-5 text-[#d4a574]" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {properties.map(property => {
            const viability = getViabilityScore(property.id);
            const displayTitle = property.listing_title || `${property.bedrooms}BR ${property.operation_type === 'coliving' ? 'Co-Living' : 'STR'} in ${property.city}`;
            
            return (
              <div key={property.id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group">
                <div className="relative h-48 overflow-hidden">
                  <PropertyImageWithFallback
                    src={photoMap[property.id]}
                    alt={displayTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  <div className="absolute top-3 left-3 flex gap-2">
                    {property.is_verified && (
                      <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>
                    )}
                    <Badge className="bg-[#d4a574]">
                      {property.operation_type === 'coliving' ? 'Co-Living' : property.operation_type === 'both' ? 'STR + Co-Living' : 'STR'}
                    </Badge>
                  </div>
                  
                  {viability > 0 && (
                    <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-lg text-sm flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /><span>{viability}%</span>
                    </div>
                  )}
                  
                  <div className="absolute bottom-3 right-3 bg-[#1a365d] text-white px-3 py-1 rounded-lg font-semibold flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />{property.acquisition_fee?.toLocaleString()} Fee
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-gray-900 mb-1 line-clamp-1">{displayTitle}</h3>
                  <p className="text-gray-500 text-sm flex items-center gap-1 mb-3">
                    <MapPin className="w-3 h-3" />{property.city}, {property.state} {property.zip_code || ''}
                  </p>
                  <div className="flex gap-4 text-sm text-gray-600 mb-3">
                    <span className="flex items-center gap-1"><Bed className="w-4 h-4" />{property.bedrooms} bed</span>
                    <span className="flex items-center gap-1"><Bath className="w-4 h-4" />{property.bathrooms} bath</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mb-4">
                    <span className="text-gray-600">Rent: <span className="font-semibold text-gray-900">${property.monthly_rent?.toLocaleString()}/mo</span></span>
                    <Badge variant={property.is_furnished ? 'default' : 'outline'}>
                      {property.is_furnished ? 'Furnished' : 'Unfurnished'}
                    </Badge>
                  </div>
                  <Button asChild className="w-full bg-[#d4a574] hover:bg-[#c49464]">
                    <Link to="/deals">View Details</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="bg-[#1a365d] hover:bg-[#2d4a7c] text-white px-8">
            <Link to="/deals">View All Deals<ArrowRight className="w-5 h-5 ml-2" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
