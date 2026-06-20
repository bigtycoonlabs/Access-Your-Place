import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, MapPin, ExternalLink, Plus, Globe, BarChart3, Building2, DollarSign, Bed, Bath, CheckCircle, Home, AlertCircle, Camera, FileText, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PennyPhotoGallery } from './PennyPhotoGallery';

interface Photo {
  id: string;
  url: string;
  description: string;
  room_type?: string;
  is_interior?: boolean;
  is_community_amenity?: boolean;
  quality_score?: number;
  key_features?: string[];
  order: number;
  is_primary: boolean;
  selected: boolean;
}

interface PropertyData {
  city?: string;
  state?: string;
  zipCode?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: number;
  rent?: number;
  propertyType?: string;
}

export function StaffDealSearch() {
  const [loading, setLoading] = useState(false);
  const [addingToDealflow, setAddingToDealflow] = useState<string | null>(null);
  const [search, setSearch] = useState({ zip_code: '', city: '', state: '', search_type: 'rental' });
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Photo gallery state
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [photoPropertyData, setPhotoPropertyData] = useState<PropertyData | null>(null);
  
  // Listing creation state
  const [listingData, setListingData] = useState({
    title: '',
    description: '',
    city: '',
    state: '',
    zip_code: '',
    bedrooms: 3,
    bathrooms: 2,
    monthly_rent: 0,
    projected_revenue: 0,
    operation_type: 'str'
  });
  const [creatingListing, setCreatingListing] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  
  const { toast } = useToast();

  // Get staff session
  const getStaffId = () => {
    const session = localStorage.getItem('staffSession');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.id;
    }
    return null;
  };

  const handleSearch = async () => {
    if (!search.zip_code && !search.city && !search.state) { 
      toast({ title: 'Enter ZIP, city, or state', variant: 'destructive' }); 
      return; 
    }
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const { data, error: funcError } = await supabase.functions.invoke('staff-deal-search', { 
        body: search 
      });
      
      if (funcError) {
        console.log('Edge function error, falling back to database search:', funcError);
        const { data: dbData, error: dbError } = await supabase
          .from('properties')
          .select('*')
          .or(`zip_code.eq.${search.zip_code},city.ilike.%${search.city}%,state.ilike.%${search.state}%`)
          .limit(20);
        
        if (dbError) throw dbError;
        
        setResults({
          existing_deals: dbData || [],
          existing_deals_count: dbData?.length || 0,
          listings: [],
          listings_count: 0,
          market_data: null,
          zip_code: search.zip_code || search.city
        });
        toast({ 
          title: 'Database Search Complete', 
          description: `Found ${dbData?.length || 0} properties in database` 
        });
      } else {
        setResults(data);
        toast({ 
          title: 'Search Complete', 
          description: `Found ${data?.existing_deals_count || 0} database deals, ${data?.listings_count || 0} web listings` 
        });
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed. Please try again.');
      toast({ title: 'Search Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const addToDealflow = async (listing: any) => {
    setAddingToDealflow(listing.id || listing.title);
    try {
      const { error } = await supabase.functions.invoke('add-property', {
        body: { 
          listing_title: listing.title,
          title: listing.title, 
          city: search.city || 'Unknown', 
          state: search.state || 'TX', 
          zip_code: search.zip_code, 
          listing_url: listing.link, 
          source: 'penny_ai', 
          status: 'new', 
          monthly_rent: 0, 
          bedrooms: 3, 
          bathrooms: 2,
          address: listing.title || 'To be determined'
        }
      });
      if (error) throw error;
      toast({ title: 'Added to Deal Flow!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAddingToDealflow(null);
  };

  // Handle photos selected from gallery
  const handlePhotosSelected = (photos: Photo[], propertyData: PropertyData | null) => {
    setSelectedPhotos(photos);
    setPhotoPropertyData(propertyData);
    
    // Auto-fill listing data from property data
    if (propertyData) {
      setListingData(prev => ({
        ...prev,
        city: propertyData.city || prev.city,
        state: propertyData.state || prev.state,
        zip_code: propertyData.zipCode || prev.zip_code,
        bedrooms: propertyData.bedrooms || prev.bedrooms,
        bathrooms: propertyData.bathrooms || prev.bathrooms,
        monthly_rent: propertyData.rent || prev.monthly_rent
      }));
    }
  };

  // Generate AI description for listing
  const generateDescription = async () => {
    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke('penny-property-photos', {
        body: {
          action: 'generate_listing',
          staff_id: getStaffId(),
          property_data: {
            city: listingData.city,
            state: listingData.state,
            bedrooms: listingData.bedrooms,
            bathrooms: listingData.bathrooms,
            rent: listingData.monthly_rent,
            propertyType: 'Single Family',
            projectedRevenue: listingData.projected_revenue
          }
        }
      });

      if (error) throw error;

      if (data?.success && data.listing) {
        setListingData(prev => ({
          ...prev,
          description: data.listing.description,
          projected_revenue: data.listing.metrics?.projected_monthly_revenue || prev.projected_revenue
        }));
        toast({ title: 'Description generated!' });
      }
    } catch (err: any) {
      toast({ title: 'Failed to generate description', variant: 'destructive' });
    }
    setGeneratingDescription(false);
  };

  // Create and publish listing
  const createListing = async () => {
    if (!listingData.city || !listingData.state) {
      toast({ title: 'Please fill in city and state', variant: 'destructive' });
      return;
    }

    setCreatingListing(true);
    try {
      const photoUrls = selectedPhotos.map(p => p.url);
      const primaryPhotoUrl = selectedPhotos.find(p => p.is_primary)?.url || photoUrls[0];

      const { error } = await supabase.functions.invoke('add-property', {
        body: {
          title: listingData.title || `${listingData.bedrooms}BR in ${listingData.city}`,
          listing_title: listingData.title || `${listingData.bedrooms}BR in ${listingData.city}`,
          description: listingData.description,
          city: listingData.city,
          state: listingData.state,
          zip_code: listingData.zip_code,
          bedrooms: listingData.bedrooms,
          bathrooms: listingData.bathrooms,
          monthly_rent: listingData.monthly_rent,
          projected_revenue: listingData.projected_revenue,
          operation_type: listingData.operation_type,
          photos: photoUrls,
          primary_photo: primaryPhotoUrl,
          source: 'penny_ai',
          status: 'pending_review'
        }
      });

      if (error) throw error;

      toast({ title: 'Listing created!', description: 'The deal has been added to the deal flow for review.' });
      
      // Reset form
      setListingData({
        title: '',
        description: '',
        city: '',
        state: '',
        zip_code: '',
        bedrooms: 3,
        bathrooms: 2,
        monthly_rent: 0,
        projected_revenue: 0,
        operation_type: 'str'
      });
      setSelectedPhotos([]);
    } catch (err: any) {
      toast({ title: 'Failed to create listing', description: err.message, variant: 'destructive' });
    }
    setCreatingListing(false);
  };

  const staffId = getStaffId();

  return (
    <div className="space-y-6" role="region" aria-label="Penny AI Property Discovery">
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Globe className="w-4 h-4" aria-hidden="true" />
            Property Search
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex items-center gap-2">
            <Camera className="w-4 h-4" aria-hidden="true" />
            Photo Gallery
          </TabsTrigger>
          <TabsTrigger value="listing" className="flex items-center gap-2">
            <FileText className="w-4 h-4" aria-hidden="true" />
            Create Listing
          </TabsTrigger>
        </TabsList>

        {/* Property Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <Card className="border-2 border-purple-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-300" aria-hidden="true" />
                Penny AI - Property Discovery
              </CardTitle>
              <CardDescription className="text-purple-100">
                Search database + internet for rental properties with AI market analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-5 gap-4 mb-4">
                <div>
                  <Label htmlFor="search-zip" className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    ZIP Code
                  </Label>
                  <Input 
                    id="search-zip"
                    placeholder="78701" 
                    value={search.zip_code} 
                    onChange={e => setSearch({...search, zip_code: e.target.value})} 
                  />
                </div>
                <div>
                  <Label htmlFor="search-city">City</Label>
                  <Input 
                    id="search-city"
                    placeholder="Austin" 
                    value={search.city} 
                    onChange={e => setSearch({...search, city: e.target.value})} 
                  />
                </div>
                <div>
                  <Label htmlFor="search-state">State</Label>
                  <Input 
                    id="search-state"
                    placeholder="TX" 
                    maxLength={2} 
                    value={search.state} 
                    onChange={e => setSearch({...search, state: e.target.value.toUpperCase()})} 
                  />
                </div>
                <div>
                  <Label htmlFor="search-type">Search Type</Label>
                  <Select value={search.search_type} onValueChange={v => setSearch({...search, search_type: v})}>
                    <SelectTrigger id="search-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rental">Long-Term Rental</SelectItem>
                      <SelectItem value="str">Short-Term Rental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleSearch} 
                    disabled={loading} 
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 h-10"
                    aria-label="Search for properties"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
                        Search
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-red-800">Search Error</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {results && (
            <div className="space-y-6">
              {/* Market Data */}
              {results.market_data && (
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="p-5">
                    <h4 className="font-bold text-lg flex items-center gap-2 mb-4 text-green-800">
                      <BarChart3 className="w-5 h-5" aria-hidden="true" />
                      Market Analysis - {results.zip_code}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                        <span className="text-gray-500 block text-xs">ADR</span>
                        <span className="font-bold text-xl text-green-600">${results.market_data.estimated_adr}</span>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                        <span className="text-gray-500 block text-xs">Occupancy</span>
                        <span className="font-bold text-xl text-blue-600">{results.market_data.occupancy_rate}%</span>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                        <span className="text-gray-500 block text-xs">Co-Living</span>
                        <span className="font-bold text-xl text-purple-600">${results.market_data.coliving_rate}/mo</span>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                        <span className="text-gray-500 block text-xs">Competition</span>
                        <Badge className={
                          results.market_data.competition_level === 'low' ? 'bg-green-500' : 
                          results.market_data.competition_level === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                        }>
                          {results.market_data.competition_level}
                        </Badge>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                        <span className="text-gray-500 block text-xs">Score</span>
                        <span className="font-bold text-xl text-indigo-600">{results.market_data.market_score}/10</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Database Properties */}
              {results.existing_deals?.length > 0 && (
                <Card className="border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
                      Database Properties ({results.existing_deals.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
                      {results.existing_deals.map((d: any) => (
                        <article key={d.id} className="p-4 bg-green-50 rounded-lg border border-green-200" role="listitem">
                          <h5 className="font-semibold text-[#1a365d] mb-1 flex items-center gap-2">
                            <Home className="w-4 h-4" aria-hidden="true" />
                            {d.listing_title || d.title || `${d.bedrooms}BR in ${d.city}`}
                          </h5>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3" aria-hidden="true" />
                            {d.city}, {d.state} {d.zip_code}
                          </p>
                          <div className="flex gap-3 mt-2 text-sm">
                            <span className="flex items-center gap-1">
                              <Bed className="w-4 h-4 text-blue-600" aria-hidden="true" />
                              {d.bedrooms} bed
                            </span>
                            <span className="flex items-center gap-1">
                              <Bath className="w-4 h-4 text-blue-600" aria-hidden="true" />
                              {d.bathrooms} bath
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="flex items-center gap-1 font-semibold text-green-700">
                              <DollarSign className="w-4 h-4" aria-hidden="true" />
                              {d.monthly_rent?.toLocaleString()}/mo
                            </span>
                            <Badge className={
                              d.status === 'approved' ? 'bg-green-600' : 
                              d.status === 'new' ? 'bg-blue-600' : 
                              d.status === 'published' ? 'bg-emerald-600' : 'bg-gray-600'
                            }>
                              {d.status}
                            </Badge>
                          </div>
                        </article>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Web Listings */}
              {results.listings?.length > 0 && (
                <Card className="border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="w-5 h-5 text-purple-600" aria-hidden="true" />
                      Web Listings ({results.listings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3" role="list">
                      {results.listings.map((l: any, idx: number) => (
                        <div key={l.id || idx} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg" role="listitem">
                          <div className="flex-1">
                            <a 
                              href={l.link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {l.title?.substring(0, 80)}
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                            <p className="text-sm text-gray-600 mt-1">{l.snippet?.substring(0, 150)}...</p>
                            <Badge variant="outline" className="mt-2">{l.source}</Badge>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => addToDealflow(l)} 
                            disabled={addingToDealflow === (l.id || l.title)} 
                            className="ml-4 bg-green-600 hover:bg-green-700"
                          >
                            {addingToDealflow === (l.id || l.title) ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!results.existing_deals?.length && !results.listings?.length) && (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
                    <p>No results found. Try different search criteria.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Photo Gallery Tab */}
        <TabsContent value="photos">
          {staffId ? (
            <PennyPhotoGallery 
              staffId={staffId} 
              onPhotosSelected={handlePhotosSelected}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
                <p>Please log in to use the photo gallery.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Create Listing Tab */}
        <TabsContent value="listing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                Create Deal Listing
              </CardTitle>
              <CardDescription>
                Fill in the details and use selected photos to create a new deal listing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selected Photos Preview */}
              {selectedPhotos.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-3">{selectedPhotos.length} Photos Selected</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedPhotos.slice(0, 6).map((photo) => (
                      <div key={photo.id} className="relative flex-shrink-0">
                        <img 
                          src={photo.url} 
                          alt={photo.description}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        {photo.is_primary && (
                          <Badge className="absolute -top-1 -right-1 text-xs bg-yellow-400 text-yellow-900">
                            Primary
                          </Badge>
                        )}
                      </div>
                    ))}
                    {selectedPhotos.length > 6 && (
                      <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-sm">
                        +{selectedPhotos.length - 6} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Listing Form */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="listing-title">Listing Title</Label>
                  <Input
                    id="listing-title"
                    placeholder="e.g., Charming 3BR Near Downtown"
                    value={listingData.title}
                    onChange={(e) => setListingData({ ...listingData, title: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="listing-city">City</Label>
                  <Input
                    id="listing-city"
                    placeholder="Austin"
                    value={listingData.city}
                    onChange={(e) => setListingData({ ...listingData, city: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="listing-state">State</Label>
                  <Input
                    id="listing-state"
                    placeholder="TX"
                    maxLength={2}
                    value={listingData.state}
                    onChange={(e) => setListingData({ ...listingData, state: e.target.value.toUpperCase() })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="listing-zip">ZIP Code</Label>
                  <Input
                    id="listing-zip"
                    placeholder="78701"
                    value={listingData.zip_code}
                    onChange={(e) => setListingData({ ...listingData, zip_code: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="listing-type">Operation Type</Label>
                  <Select 
                    value={listingData.operation_type} 
                    onValueChange={(v) => setListingData({ ...listingData, operation_type: v })}
                  >
                    <SelectTrigger id="listing-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="str">Short-Term Rental (STR)</SelectItem>
                      <SelectItem value="coliving">Co-Living</SelectItem>
                      <SelectItem value="mtr">Mid-Term Rental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="listing-beds">Bedrooms</Label>
                  <Input
                    id="listing-beds"
                    type="number"
                    min={1}
                    value={listingData.bedrooms}
                    onChange={(e) => setListingData({ ...listingData, bedrooms: parseInt(e.target.value) || 1 })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="listing-baths">Bathrooms</Label>
                  <Input
                    id="listing-baths"
                    type="number"
                    min={1}
                    step={0.5}
                    value={listingData.bathrooms}
                    onChange={(e) => setListingData({ ...listingData, bathrooms: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="listing-rent">Monthly Rent ($)</Label>
                  <Input
                    id="listing-rent"
                    type="number"
                    min={0}
                    value={listingData.monthly_rent}
                    onChange={(e) => setListingData({ ...listingData, monthly_rent: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="listing-revenue">Projected Revenue ($/mo)</Label>
                  <Input
                    id="listing-revenue"
                    type="number"
                    min={0}
                    value={listingData.projected_revenue}
                    onChange={(e) => setListingData({ ...listingData, projected_revenue: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="listing-description">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateDescription}
                      disabled={generatingDescription}
                    >
                      {generatingDescription ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
                      )}
                      Generate with AI
                    </Button>
                  </div>
                  <Textarea
                    id="listing-description"
                    placeholder="Describe the property and investment opportunity..."
                    rows={6}
                    value={listingData.description}
                    onChange={(e) => setListingData({ ...listingData, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setListingData({
                    title: '',
                    description: '',
                    city: '',
                    state: '',
                    zip_code: '',
                    bedrooms: 3,
                    bathrooms: 2,
                    monthly_rent: 0,
                    projected_revenue: 0,
                    operation_type: 'str'
                  })}
                >
                  Clear Form
                </Button>
                <Button
                  onClick={createListing}
                  disabled={creatingListing || !listingData.city || !listingData.state}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {creatingListing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                  )}
                  Create Listing
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
