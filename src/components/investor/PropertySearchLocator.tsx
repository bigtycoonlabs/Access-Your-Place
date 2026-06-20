import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Loader2, Building2, MapPin, Bed, Bath, DollarSign,
  Heart, Sparkles, SlidersHorizontal, Grid3X3, LayoutList,
  ArrowUpDown, RefreshCw, Send, Phone, X, Home, Building,
  Users, TrendingUp, Eye, Star, Filter, ChevronDown, ChevronUp
} from 'lucide-react';

interface Property {
  id: string;
  title?: string;
  listing_title?: string;
  address?: string;
  city: string;
  state: string;
  zip_code?: string;
  price?: number;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  property_type?: string;
  operation_type?: string;
  description?: string;
  photos?: string[];
  penny_score?: number;
  penny_recommendation?: string;
  is_featured?: boolean;
  is_verified?: boolean;
  is_furnished?: boolean;
  cap_rate?: number;
  cash_on_cash?: number;
  acquisition_fee?: number;
  projected_yearly_revenue?: number;
  adr_peak_season?: number;
  adr_slow_season?: number;
  avg_occupancy_rate?: number;
  market?: string;
  created_at: string;
}

interface Props {
  investorId: string;
  investorName: string;
  investorEmail: string;
  onBookCall?: (data: any) => void;
}

const PROPERTY_TYPES = [
  { value: 'all', label: 'All Property Types' },
  { value: 'Single Family', label: 'Single Family' },
  { value: 'Multi-Family', label: 'Multi-Family' },
  { value: 'Condo', label: 'Condo / Townhouse' },
  { value: 'Apartment', label: 'Apartment' },
];

const OPERATION_TYPES = [
  { value: 'all', label: 'All Operations' },
  { value: 'str', label: 'Short-Term Rental (STR)' },
  { value: 'coliving', label: 'Co-Living' },
  { value: 'both', label: 'STR + Co-Living' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'penny_score', label: 'Penny Score: Highest' },
  { value: 'bedrooms', label: 'Bedrooms: Most' },
];

const BEDROOM_OPTIONS = [
  { value: 'all', label: 'Any Bedrooms' },
  { value: '1', label: '1+ Bedrooms' },
  { value: '2', label: '2+ Bedrooms' },
  { value: '3', label: '3+ Bedrooms' },
  { value: '4', label: '4+ Bedrooms' },
  { value: '5', label: '5+ Bedrooms' },
];

export function PropertySearchLocator({ investorId, investorName, investorEmail, onBookCall }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [favLoading, setFavLoading] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const { toast } = useToast();

  // Filters
  const [searchText, setSearchText] = useState('');
  const [propertyType, setPropertyType] = useState('all');
  const [operationType, setOperationType] = useState('all');
  const [minBedrooms, setMinBedrooms] = useState('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState('newest');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  // Fetch published properties
  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('get-properties', {
        body: { is_published: true, limit: 200 }
      });
      if (data?.properties) {
        setProperties(data.properties);
      }
    } catch (err) {
      console.error('Error fetching properties:', err);
      toast({ title: 'Error', description: 'Failed to load properties', variant: 'destructive' });
    }
    setLoading(false);
  }, []);

  // Fetch favorites
  const fetchFavorites = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('investor-favorites', {
        body: { action: 'list', investor_id: investorId }
      });
      if (data?.favorites) {
        const favIds = new Set<string>(data.favorites.map((f: any) => f.property_id));
        setFavorites(favIds);
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  }, [investorId]);

  useEffect(() => {
    fetchProperties();
    fetchFavorites();
  }, [fetchProperties, fetchFavorites]);

  // Toggle favorite
  const toggleFavorite = async (propertyId: string) => {
    setFavLoading(propertyId);
    const isFav = favorites.has(propertyId);
    
    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });

    try {
      await supabase.functions.invoke('investor-favorites', {
        body: { 
          action: isFav ? 'remove' : 'add', 
          investor_id: investorId, 
          property_id: propertyId 
        }
      });
      toast({ 
        title: isFav ? 'Removed from Saved' : 'Saved to Favorites',
        description: isFav ? 'Property removed from your saved deals.' : 'Property added to your saved deals.'
      });
    } catch (err) {
      // Revert optimistic update
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(propertyId);
        else next.delete(propertyId);
        return next;
      });
      toast({ title: 'Error', description: 'Failed to update favorites', variant: 'destructive' });
    }
    setFavLoading(null);
  };

  // Submit inquiry
  const submitInquiry = async () => {
    if (!selectedProperty || !inquiryMessage.trim()) {
      toast({ title: 'Message Required', description: 'Please enter a message for your inquiry.', variant: 'destructive' });
      return;
    }

    setSubmittingInquiry(true);
    try {
      await supabase.functions.invoke('submit-deal-inquiry', {
        body: {
          investor_email: investorEmail,
          investor_name: investorName,
          investor_id: investorId,
          property_id: selectedProperty.id,
          property_address: selectedProperty.address || `${selectedProperty.city}, ${selectedProperty.state}`,
          message: inquiryMessage,
          inquiry_type: 'property_interest'
        }
      });
      toast({ title: 'Inquiry Submitted!', description: 'Our acquisition team will review your inquiry and contact you soon.' });
      setShowInquiryModal(false);
      setInquiryMessage('');
      setSelectedProperty(null);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to submit inquiry. Please try again.', variant: 'destructive' });
    }
    setSubmittingInquiry(false);
  };

  // Real-time client-side filtering
  const filteredProperties = useMemo(() => {
    let result = [...properties];

    // Text search
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(p => 
        p.city?.toLowerCase().includes(q) ||
        p.state?.toLowerCase().includes(q) ||
        p.zip_code?.includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.market?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.listing_title?.toLowerCase().includes(q)
      );
    }

    // Property type
    if (propertyType !== 'all') {
      result = result.filter(p => p.property_type?.toLowerCase().includes(propertyType.toLowerCase()));
    }

    // Operation type
    if (operationType !== 'all') {
      result = result.filter(p => p.operation_type === operationType);
    }

    // Bedrooms
    if (minBedrooms !== 'all') {
      const min = parseInt(minBedrooms);
      result = result.filter(p => (p.bedrooms || 0) >= min);
    }

    // Price range (monthly rent)
    result = result.filter(p => {
      const rent = p.monthly_rent || p.price || 0;
      return rent >= priceRange[0] && (priceRange[1] >= 10000 || rent <= priceRange[1]);
    });

    // Featured only
    if (showFeaturedOnly) {
      result = result.filter(p => p.is_featured);
    }

    // Verified only
    if (showVerifiedOnly) {
      result = result.filter(p => p.is_verified);
    }

    // Sort
    switch (sortBy) {
      case 'price_low':
        result.sort((a, b) => (a.monthly_rent || a.price || 0) - (b.monthly_rent || b.price || 0));
        break;
      case 'price_high':
        result.sort((a, b) => (b.monthly_rent || b.price || 0) - (a.monthly_rent || a.price || 0));
        break;
      case 'penny_score':
        result.sort((a, b) => (b.penny_score || 0) - (a.penny_score || 0));
        break;
      case 'bedrooms':
        result.sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0));
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [properties, searchText, propertyType, operationType, minBedrooms, priceRange, sortBy, showFeaturedOnly, showVerifiedOnly]);

  const clearFilters = () => {
    setSearchText('');
    setPropertyType('all');
    setOperationType('all');
    setMinBedrooms('all');
    setPriceRange([0, 10000]);
    setSortBy('newest');
    setShowFeaturedOnly(false);
    setShowVerifiedOnly(false);
  };

  const activeFilterCount = [
    searchText !== '',
    propertyType !== 'all',
    operationType !== 'all',
    minBedrooms !== 'all',
    priceRange[0] > 0 || priceRange[1] < 10000,
    showFeaturedOnly,
    showVerifiedOnly,
  ].filter(Boolean).length;

  const getPennyScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500 text-white';
    if (score >= 60) return 'bg-blue-500 text-white';
    if (score >= 40) return 'bg-amber-500 text-white';
    return 'bg-gray-400 text-white';
  };

  const getPennyScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Low';
  };

  const getOperationLabel = (type?: string) => {
    switch (type) {
      case 'str': return 'STR';
      case 'coliving': return 'Co-Living';
      case 'both': return 'STR + Co-Living';
      default: return type || 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] rounded-xl">
            <Search className="w-6 h-6 text-[#d4a574]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Property Search</h2>
            <p className="text-sm text-gray-500">
              Browse {properties.length} published deals with real-time filtering
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchProperties} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-[#1a365d] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-[#1a365d] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by city, state, ZIP code, or address..."
            className="pl-10 h-11"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 h-11"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="bg-[#d4a574] text-white text-xs ml-1">{activeFilterCount}</Badge>
          )}
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border-[#d4a574]/20">
          <CardContent className="pt-5 pb-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-medium text-gray-500 mb-1.5 block">Property Type</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-500 mb-1.5 block">Operation Type</Label>
                <Select value={operationType} onValueChange={setOperationType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-500 mb-1.5 block">Bedrooms</Label>
                <Select value={minBedrooms} onValueChange={setMinBedrooms}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BEDROOM_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-500 mb-1.5 block">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <Label className="text-xs font-medium text-gray-500 mb-2 block">
                Monthly Rent Range: ${priceRange[0].toLocaleString()} - {priceRange[1] >= 10000 ? '$10,000+' : `$${priceRange[1].toLocaleString()}`}
              </Label>
              <Slider
                value={priceRange}
                onValueChange={(v) => setPriceRange(v as [number, number])}
                min={0}
                max={10000}
                step={250}
                className="mt-2"
              />
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFeaturedOnly}
                    onChange={(e) => setShowFeaturedOnly(e.target.checked)}
                    className="rounded border-gray-300 text-[#d4a574] focus:ring-[#d4a574]"
                  />
                  <Star className="w-4 h-4 text-amber-500" />
                  Featured Only
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showVerifiedOnly}
                    onChange={(e) => setShowVerifiedOnly(e.target.checked)}
                    className="rounded border-gray-300 text-[#d4a574] focus:ring-[#d4a574]"
                  />
                  <Sparkles className="w-4 h-4 text-green-500" />
                  Verified Only
                </label>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500">
                  <X className="w-4 h-4 mr-1" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-900">{filteredProperties.length}</span> of {properties.length} properties
          {activeFilterCount > 0 && (
            <span className="ml-1 text-[#d4a574]">({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)</span>
          )}
        </p>
        <p className="text-xs text-gray-400">
          {favorites.size} saved deal{favorites.size !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Loading State */}
      {loading && properties.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-[#d4a574] mb-4" />
          <p className="text-gray-500">Loading available properties...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredProperties.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Building2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Properties Found</h3>
            <p className="text-gray-500 mb-4 max-w-md mx-auto">
              {properties.length === 0 
                ? 'No published properties are available right now. Check back soon!'
                : 'No properties match your current filters. Try adjusting your search criteria.'}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Clear All Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Property Grid */}
      {viewMode === 'grid' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProperties.map(property => (
            <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-all group">
              {/* Photo / Header */}
              <div className="relative h-40 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] overflow-hidden">
                {property.photos?.[0] ? (
                  <img 
                    src={property.photos[0]} 
                    alt={property.title || property.listing_title || `Property in ${property.city}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Building2 className="w-12 h-12 text-white/30" />
                  </div>
                )}
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {property.operation_type && (
                    <Badge className="bg-[#d4a574] text-white text-xs">
                      {getOperationLabel(property.operation_type)}
                    </Badge>
                  )}
                  {property.is_featured && (
                    <Badge className="bg-amber-500 text-white text-xs">
                      <Star className="w-3 h-3 mr-0.5" />
                      Featured
                    </Badge>
                  )}
                  {property.is_verified && (
                    <Badge className="bg-green-500 text-white text-xs">Verified</Badge>
                  )}
                </div>

                {/* Penny Score */}
                {property.penny_score && property.penny_score > 0 && (
                  <div className={`absolute top-2 right-2 ${getPennyScoreColor(property.penny_score)} px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1`}>
                    <Sparkles className="w-3 h-3" />
                    {property.penny_score}
                  </div>
                )}

                {/* Favorite Button */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id); }}
                  disabled={favLoading === property.id}
                  className="absolute bottom-2 right-2 p-2 bg-white/90 rounded-full hover:bg-white transition-colors shadow-sm"
                >
                  <Heart className={`w-4 h-4 ${favorites.has(property.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                </button>
              </div>

              <CardContent className="p-4 space-y-3">
                {/* Title */}
                <h3 className="font-semibold text-gray-900 line-clamp-1">
                  {property.title || property.listing_title || `${property.bedrooms || '?'}BR in ${property.city}`}
                </h3>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{property.city}, {property.state} {property.zip_code || ''}</span>
                </div>

                {/* Property Details */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {property.bedrooms != null && (
                    <span className="flex items-center gap-1">
                      <Bed className="w-3.5 h-3.5" />
                      {property.bedrooms} bed
                    </span>
                  )}
                  {property.bathrooms != null && (
                    <span className="flex items-center gap-1">
                      <Bath className="w-3.5 h-3.5" />
                      {property.bathrooms} bath
                    </span>
                  )}
                  {property.sqft && (
                    <span className="text-xs">{property.sqft.toLocaleString()} sqft</span>
                  )}
                </div>

                {/* Penny Score Bar */}
                {property.penny_score && property.penny_score > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${property.penny_score >= 80 ? 'bg-green-500' : property.penny_score >= 60 ? 'bg-blue-500' : property.penny_score >= 40 ? 'bg-amber-500' : 'bg-gray-400'}`}
                        style={{ width: `${property.penny_score}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-500">
                      {getPennyScoreLabel(property.penny_score)}
                    </span>
                  </div>
                )}

                {/* Financials */}
                <div className="grid grid-cols-2 gap-2">
                  {property.monthly_rent && (
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Monthly Rent</p>
                      <p className="font-bold text-blue-700 text-sm">${property.monthly_rent.toLocaleString()}</p>
                    </div>
                  )}
                  {property.acquisition_fee ? (
                    <div className="bg-green-50 p-2 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Acquisition Fee</p>
                      <p className="font-bold text-green-700 text-sm">${property.acquisition_fee.toLocaleString()}</p>
                    </div>
                  ) : property.price ? (
                    <div className="bg-green-50 p-2 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Price</p>
                      <p className="font-bold text-green-700 text-sm">${property.price.toLocaleString()}</p>
                    </div>
                  ) : null}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 bg-[#1a365d] hover:bg-[#2d4a7c] text-xs h-8"
                    onClick={() => {
                      setSelectedProperty(property);
                      setShowInquiryModal(true);
                    }}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Inquire
                  </Button>
                  {onBookCall && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => onBookCall({ property, type: 'verified_deal' })}
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      Call
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredProperties.map(property => (
            <Card key={property.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="relative w-28 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex-shrink-0">
                    {property.photos?.[0] ? (
                      <img src={property.photos[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Building2 className="w-8 h-8 text-white/30" />
                      </div>
                    )}
                    {property.penny_score && property.penny_score > 0 && (
                      <div className={`absolute top-1 right-1 ${getPennyScoreColor(property.penny_score)} px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5`}>
                        <Sparkles className="w-2.5 h-2.5" />
                        {property.penny_score}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate">
                          {property.title || property.listing_title || `${property.bedrooms || '?'}BR in ${property.city}`}
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {property.city}, {property.state} {property.zip_code || ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {property.operation_type && (
                          <Badge variant="outline" className="text-xs">{getOperationLabel(property.operation_type)}</Badge>
                        )}
                        {property.is_featured && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs">Featured</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mt-2 text-sm">
                      {property.bedrooms != null && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Bed className="w-3.5 h-3.5" /> {property.bedrooms} bed
                        </span>
                      )}
                      {property.bathrooms != null && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Bath className="w-3.5 h-3.5" /> {property.bathrooms} bath
                        </span>
                      )}
                      {property.monthly_rent && (
                        <span className="font-semibold text-blue-700">
                          ${property.monthly_rent.toLocaleString()}/mo
                        </span>
                      )}
                      {property.acquisition_fee && (
                        <span className="font-semibold text-green-700">
                          Fee: ${property.acquisition_fee.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleFavorite(property.id)}
                      disabled={favLoading === property.id}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Heart className={`w-5 h-5 ${favorites.has(property.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    </button>
                    <Button
                      size="sm"
                      className="bg-[#1a365d] hover:bg-[#2d4a7c]"
                      onClick={() => {
                        setSelectedProperty(property);
                        setShowInquiryModal(true);
                      }}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Inquire
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Inquiry Modal */}
      <Dialog open={showInquiryModal} onOpenChange={setShowInquiryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-[#d4a574]" />
              Property Inquiry
            </DialogTitle>
            <DialogDescription>
              Send an inquiry to our acquisition team about this property.
            </DialogDescription>
          </DialogHeader>

          {selectedProperty && (
            <div className="space-y-4">
              {/* Property Summary */}
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-[#1a365d] flex-shrink-0">
                  {selectedProperty.photos?.[0] ? (
                    <img src={selectedProperty.photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Building2 className="w-6 h-6 text-white/30" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {selectedProperty.title || selectedProperty.listing_title || `${selectedProperty.bedrooms}BR in ${selectedProperty.city}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedProperty.city}, {selectedProperty.state}
                    {selectedProperty.monthly_rent && ` — $${selectedProperty.monthly_rent.toLocaleString()}/mo`}
                  </p>
                </div>
                {selectedProperty.penny_score && selectedProperty.penny_score > 0 && (
                  <Badge className={`ml-auto flex-shrink-0 ${getPennyScoreColor(selectedProperty.penny_score)}`}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    {selectedProperty.penny_score}
                  </Badge>
                )}
              </div>

              {/* Message */}
              <div>
                <Label htmlFor="inquiry-message">Your Message</Label>
                <Textarea
                  id="inquiry-message"
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  placeholder="I'm interested in this property. Could you provide more details about the rental terms, neighborhood, and projected returns?"
                  rows={4}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInquiryModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitInquiry}
                  disabled={submittingInquiry || !inquiryMessage.trim()}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {submittingInquiry ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Inquiry
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PropertySearchLocator;
