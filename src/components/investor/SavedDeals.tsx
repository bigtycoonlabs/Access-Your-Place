import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Heart, 
  MapPin, 
  Bed, 
  Bath, 
  DollarSign, 
  Trash2, 
  ArrowRight, 
  Building2, 
  Search, 
  Sparkles,
  CheckCircle,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logFavoriteRemoved, logDealView } from '@/hooks/useActivityLog';
import { PennyScoreBadge } from '@/components/investor/PennyScoreBadge';

interface SavedDealsProps {
  investorId: string;
  onInquire: (deal: any) => void;
}

export function SavedDeals({ investorId, onInquire }: SavedDealsProps) {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableDeals, setAvailableDeals] = useState<any[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const { toast } = useToast();

  useEffect(() => { 
    fetchFavorites(); 
    fetchAvailableDeals();
  }, [investorId]);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-favorites', { body: { action: 'list', investor_id: investorId } });
      if (error || data?.error) throw error || new Error(data.error);
      setFavorites(data?.favorites || []);
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableDeals = async () => {
    try {
      const { data, count } = await supabase
        .from('properties')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(4);
      
      if (data) {
        setAvailableDeals(data);
        setTotalDeals(count || 0);
      }
    } catch (err) {
      console.error('Error fetching available deals:', err);
      setAvailableDeals([]);
      setTotalDeals(0);
    }
  };


  const removeFavorite = async (property: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('investor-favorites', { body: { action: 'remove', investor_id: investorId, property_id: property.id } });
      if (error || data?.error) throw error || new Error(data.error);
      setFavorites(prev => prev.filter(f => f.properties?.id !== property.id));

      // Log activity
      logFavoriteRemoved(investorId, { id: property.id, address: property.address });
      toast({ title: 'Removed from favorites' });
    } catch (err) {
      console.error('Error removing favorite:', err);
      toast({ title: 'Error', description: 'Failed to remove favorite', variant: 'destructive' });
    }
  };

  const handleViewDeal = (property: any) => {
    // Log deal view activity
    logDealView(investorId, { 
      id: property.id, 
      address: property.address, 
      city: property.city, 
      state: property.state 
    });
    
    onInquire(property);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>;

  if (favorites.length === 0) {
    return (
      <div className="space-y-6">
        {/* Empty State */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-[#1a365d]/5 via-[#d4a574]/5 to-transparent p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] rounded-2xl flex items-center justify-center shadow-lg">
              <Heart className="w-8 h-8 text-[#d4a574]" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              No Saved Properties Yet
            </h3>
            
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              Browse our deal flow and save properties you're interested in. 
              Your favorites will appear here for easy access.
            </p>

            <Button asChild className="bg-[#d4a574] hover:bg-[#c49464]">
              <Link to="/deals">
                <Search className="w-4 h-4 mr-2" />
                Browse Properties
              </Link>
            </Button>
          </div>
        </div>

        {/* Available Deals Preview */}
        {availableDeals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#d4a574]" />
                Available Properties ({totalDeals})
              </h3>
              <Button asChild variant="outline" size="sm">
                <Link to="/deals">
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {availableDeals.map(deal => {
                const pennyScore = deal.penny_score ?? null;
                const isFlagged = pennyScore !== null && pennyScore < 40;
                
                return (
                  <Card key={deal.id} className={`overflow-hidden hover:shadow-lg transition ${isFlagged ? 'border-red-300 bg-red-50/30' : ''}`}>
                    <div className="h-32 bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] relative">
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="w-10 h-10 text-white/40" />
                      </div>
                      <Badge className="absolute top-2 left-2 bg-[#d4a574]">
                        {deal.operation_type === 'coliving' ? 'Co-Living' : deal.operation_type === 'both' ? 'Both' : 'STR'}
                      </Badge>
                      <div className="absolute top-2 right-2 flex items-center gap-2">
                        <PennyScoreBadge 
                          score={pennyScore} 
                          propertyId={deal.id}
                          size="sm"
                          showLabel={false}
                        />
                        {deal.is_verified && (
                          <Badge className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />Verified
                          </Badge>
                        )}
                      </div>
                      {isFlagged && (
                        <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-xs py-1 px-2 flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Flagged for Review
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                        {deal.listing_title || `${deal.bedrooms}BR in ${deal.city}`}
                      </h4>
                      <div className="flex items-center gap-1 text-gray-500 text-sm mb-2">
                        <MapPin className="w-3 h-3" />
                        {deal.city}, {deal.state}
                      </div>
                      <div className="flex gap-3 text-sm text-gray-500 mb-3">
                        <span className="flex items-center gap-1"><Bed className="w-4 h-4" />{deal.bedrooms}</span>
                        <span className="flex items-center gap-1"><Bath className="w-4 h-4" />{deal.bathrooms}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">${deal.monthly_rent?.toLocaleString()}/mo</span>
                        <span className="font-semibold text-[#1a365d]">${deal.acquisition_fee?.toLocaleString()} fee</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* No Deals Available */}
        {availableDeals.length === 0 && (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h4 className="font-semibold text-gray-900 mb-2">No Properties Currently Available</h4>
            <p className="text-gray-600 text-sm">We're actively sourcing new opportunities. Check back soon!</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          Your Saved Properties ({favorites.length})
        </h3>
        <Button asChild variant="outline" size="sm">
          <Link to="/deals">
            Browse More
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {favorites.map(fav => {
          const p = fav.properties;
          if (!p) return null;
          
          const pennyScore = p.penny_score ?? null;
          const isFlagged = pennyScore !== null && pennyScore < 40;
          
          return (
            <Card key={fav.id} className={`overflow-hidden hover:shadow-lg transition ${isFlagged ? 'border-red-300 bg-red-50/30' : ''}`}>
              <div className="h-32 bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] relative">
                {p.photos?.[0] ? (
                  <img src={p.photos[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-white/40" />
                  </div>
                )}
                <Badge className="absolute top-2 left-2 bg-[#d4a574]">
                  {p.operation_type === 'str' ? 'STR' : p.operation_type === 'coliving' ? 'Co-Living' : 'Both'}
                </Badge>
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <PennyScoreBadge 
                    score={pennyScore} 
                    propertyId={p.id}
                    size="sm"
                    showLabel={false}
                  />
                  <div className="bg-red-500 text-white p-1.5 rounded-full">
                    <Heart className="w-3 h-3 fill-current" />
                  </div>
                </div>
                {isFlagged && (
                  <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-xs py-1 px-2 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Flagged - Review Required
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                  {p.listing_title || `${p.bedrooms}BR in ${p.city}`}
                </h4>
                <div className="flex items-center gap-1 text-gray-600 mb-2">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{p.city}, {p.state} {p.zip_code}</span>
                </div>
                <div className="flex gap-4 text-sm text-gray-500 mb-3">
                  <span className="flex items-center gap-1"><Bed className="w-4 h-4" />{p.bedrooms}</span>
                  <span className="flex items-center gap-1"><Bath className="w-4 h-4" />{p.bathrooms}</span>
                  <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />${p.monthly_rent?.toLocaleString()}/mo</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-[#d4a574] hover:bg-[#c49464]" onClick={() => handleViewDeal(p)}>
                    Inquire
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removeFavorite(p)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
