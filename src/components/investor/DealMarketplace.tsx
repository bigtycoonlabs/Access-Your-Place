import { useState, useEffect, useCallback, useRef } from 'react';

import { notifyAMAboutAction } from '@/utils/notifyAM';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MarketplacePaymentCheckout } from './MarketplacePaymentCheckout';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader2, Plus, Building2, MapPin, DollarSign, Send, Search, 
  Eye, CheckCircle, Clock, AlertCircle, Shield, Users, FileText,
  ArrowRight, Lock, Globe, Phone, Mail, User, TrendingUp, 
  Handshake, Scale, FileCheck, BadgeCheck, X, ChevronRight,
  CreditCard, Key, ShoppingCart, Home, Calendar, Percent, Sofa,
  SlidersHorizontal, ArrowUpDown, ChevronLeft, Image as ImageIcon
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
  investorEmail: string;
}

interface PortfolioProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  monthly_earnings: number;
  initial_investment: number;
  property_type: string;
  photo_urls: string[];
}

interface DealListing {
  id: string;
  property_id: string;
  seller_id: string;
  listing_type: 'public' | 'private';
  asking_price: number;
  description: string;
  monthly_revenue: number;
  monthly_expenses: number;
  lease_months_remaining: number;
  status: 'draft' | 'pending_approval' | 'active' | 'verification_requested' | 'verified' | 'sold' | 'cancelled';
  created_at: string;
  property?: PortfolioProperty;
  seller?: { full_name?: string; email?: string };
  buyer_investor_id?: string;
  buyer_investor_name?: string;
  buyer_investor_email?: string;
  verification_status?: 'pending' | 'in_progress' | 'passed' | 'failed';
  verification_paid?: boolean;
  report_released?: boolean;
  transaction_managed_by_ayp?: boolean;
  operation_type?: string;
  projected_monthly_revenue?: number;
  adr?: number;
  occupancy_rate?: number;
  monthly_rent?: number;
  is_furnished?: boolean;
  inventory_list?: string;
  property_photo_urls?: string[];
}

interface ReceivedDeal {
  id: string;
  listing: DealListing;
  seller_name: string;
  seller_email: string;
  sent_at: string;
  status: 'pending' | 'interested' | 'verification_requested' | 'verified' | 'declined';
}

interface InvestorSearchResult {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  is_verified_operator: boolean;
}

const AYP_BENEFITS = [
  { icon: Shield, title: 'Deal Verification', description: 'Our success team personally verifies every deal, calling sellers and vetting landlords.' },
  { icon: FileCheck, title: 'Pre-Written Agreements', description: 'Access acquisition agreements and corporate sublease templates ready to go.' },
  { icon: Scale, title: 'Compliance Assurance', description: 'Ensure all license requirements are met and lease transfers are properly executed.' },
  { icon: Users, title: 'Landlord Introductions', description: 'Get guidance on broaching lease transfers with landlords professionally.' },
  { icon: Handshake, title: 'Full Transaction Support', description: 'We support both buyer and seller through the entire transfer process.' },
  { icon: BadgeCheck, title: 'Industry Standards', description: 'Keep the rental arbitrage industry fair with standardized, compliant transactions.' }
];

// Helper to generate signed URLs for property photos
async function resolvePhotoUrls(photoPaths: string[]): Promise<string[]> {
  if (!photoPaths || photoPaths.length === 0) return [];
  try {
    const { data } = await supabase.functions.invoke('property-photo-urls', {
      body: { action: 'sign_urls', file_paths: photoPaths }
    });
    if (data?.urls) {
      return data.urls.map((u: any) => u.signed_url).filter(Boolean);
    }
  } catch {}
  // Fallback: try seller-document-upload function
  try {
    const { data } = await supabase.functions.invoke('seller-document-upload', {
      body: { action: 'get_signed_urls', file_paths: photoPaths }
    });
    if (data?.urls) {
      return data.urls.map((u: any) => u.signed_url).filter(Boolean);
    }
  } catch {}
  return photoPaths; // Return raw paths as last resort
}

export function DealMarketplace({ investorId, investorName, investorEmail }: Props) {
  const [activeTab, setActiveTab] = useState('browse');
  const [loading, setLoading] = useState(true);
  const [myListings, setMyListings] = useState<DealListing[]>([]);
  const [receivedDeals, setReceivedDeals] = useState<ReceivedDeal[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioProperty[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<DealListing | null>(null);
  const [selectedReceivedDeal, setSelectedReceivedDeal] = useState<ReceivedDeal | null>(null);
  
  // Browse marketplace state
  const [browseListings, setBrowseListings] = useState<DealListing[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseSort, setBrowseSort] = useState('newest');
  const [browseFilter, setBrowseFilter] = useState('all');
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseError, setBrowseError] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  
  const { toast } = useToast();

  // Track touch for pull-to-refresh
  const touchStartY = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchEndY - touchStartY.current;
    // Pull down > 80px at top of scroll to refresh
    if (diff > 80 && containerRef.current && containerRef.current.scrollTop <= 0) {
      setIsPulling(true);
      Promise.all([fetchData(), fetchBrowseListings()]).finally(() => setIsPulling(false));
    }
  }, []);

  useEffect(() => { fetchData(); }, [investorId]);
  // Fetch browse listings on mount AND when filters change
  useEffect(() => { fetchBrowseListings(); }, [browseSort, browseFilter, browsePage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'get_marketplace_data', investor_id: investorId }
      });
      if (data) {
        setMyListings(data.my_listings || []);
        setReceivedDeals(data.received_deals || []);
        setPortfolio(data.portfolio || []);
      }
    } catch (err) {
      console.error('Error fetching marketplace data:', err);
      try {
        const [listingsRes, receivedRes, portfolioRes] = await Promise.allSettled([
          supabase.from('deal_listings').select('*, property:investor_portfolio(*)').eq('seller_id', investorId).order('created_at', { ascending: false }),
          supabase.from('deal_listings').select('*, property:investor_portfolio(*)').eq('buyer_investor_id', investorId).eq('listing_type', 'private').order('created_at', { ascending: false }),
          supabase.from('investor_portfolio').select('*').eq('investor_id', investorId).eq('status', 'active')
        ]);
        if (listingsRes.status === 'fulfilled') setMyListings(listingsRes.value.data || []);
        if (receivedRes.status === 'fulfilled') {
          setReceivedDeals((receivedRes.value.data || []).map((r: any) => ({
            id: r.id, listing: r, seller_name: r.buyer_investor_name || 'Unknown',
            seller_email: r.buyer_investor_email || '', sent_at: r.created_at,
            status: r.status === 'active' ? 'pending' : r.status
          })));
        }
        if (portfolioRes.status === 'fulfilled') setPortfolio(portfolioRes.value.data || []);
      } catch { setMyListings([]); setReceivedDeals([]); setPortfolio([]); }
    }
    setLoading(false);
  };

  const fetchBrowseListings = async () => {
    setBrowseLoading(true);
    setBrowseError(false);
    try {
      const filters: any = {};
      if (browseFilter !== 'all') filters.operation_type = [browseFilter];
      
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'get_public_listings', filters, page: browsePage, limit: 12, sort: browseSort }
      });
      if (data?.listings) {
        setBrowseListings(data.listings);
        setBrowseTotal(data.total || 0);
      } else {
        throw new Error('Edge function failed');
      }
    } catch (err) {
      console.error('Browse listings edge function failed, using DB fallback:', err);
      try {
        let query = supabase.from('deal_listings')
          .select('*, property:investor_portfolio(*)', { count: 'exact' })
          .eq('listing_type', 'public')
          .in('status', ['active', 'verified']);
        
        if (browseFilter !== 'all') {
          query = query.eq('operation_type', browseFilter);
        }
        
        switch (browseSort) {
          case 'price_low': query = query.order('asking_price', { ascending: true }); break;
          case 'price_high': query = query.order('asking_price', { ascending: false }); break;
          default: query = query.order('created_at', { ascending: false });
        }
        
        const offset = (browsePage - 1) * 12;
        query = query.range(offset, offset + 11);
        
        const { data: listings, count } = await query;
        setBrowseListings(listings || []);
        setBrowseTotal(count || 0);
      } catch (dbErr) {
        console.error('DB fallback also failed:', dbErr);
        setBrowseListings([]);
        setBrowseTotal(0);
        setBrowseError(true);
      }
    }
    setBrowseLoading(false);
  };


  const handleBrowseSearch = async () => {
    if (!browseSearch.trim()) { fetchBrowseListings(); return; }
    setBrowseLoading(true);
    try {
      // Search via DB - query deal_listings with status='active' and join investor_portfolio
      const searchTerm = browseSearch.trim().toLowerCase();
      let query = supabase.from('deal_listings')
        .select('*, property:investor_portfolio(*)', { count: 'exact' })
        .eq('listing_type', 'public')
        .eq('status', 'active');
      
      if (browseFilter !== 'all') {
        query = query.eq('operation_type', browseFilter);
      }
      
      const { data: allListings, count } = await query;
      
      // Client-side filter by search term (city, state, address, description)
      const filtered = (allListings || []).filter((l: any) => {
        const prop = l.property;
        const searchable = [
          prop?.address, prop?.city, prop?.state, prop?.zip_code,
          l.description, l.operation_type
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(searchTerm);
      });
      
      setBrowseListings(filtered);
      setBrowseTotal(filtered.length);
    } catch (err) {
      console.error('Search failed:', err);
      toast({ title: 'Search Error', description: 'Failed to search listings. Please try again.', variant: 'destructive' });
    }
    setBrowseLoading(false);
  };

  const handleViewListing = (listing: DealListing) => {
    setSelectedListing(listing);
    setSelectedReceivedDeal(null);
    setShowDetailModal(true);
  };

  const handleViewReceivedDeal = (deal: ReceivedDeal) => {
    setSelectedReceivedDeal(deal);
    setSelectedListing(null);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="space-y-6" 
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {isPulling && (
        <div className="flex justify-center py-3">
          <div className="flex items-center gap-2 text-sm text-[#d4a574]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Refreshing...
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Deal Marketplace</h2>
          <p className="text-gray-600 text-sm md:text-base">Browse, buy, and sell rental arbitrage operations with verified investors</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-[#d4a574] hover:bg-[#c49464] w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" /> List a Deal for Sale
        </Button>
      </div>

      {/* Why Use AYP Banner - hidden on mobile for space */}
      <Card className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white hidden md:block">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-lg">
              <Shield className="w-8 h-8 text-[#d4a574]" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Why Sell Through Access Your Place?</h3>
              <p className="text-white/80 mb-4">
                Our platform ensures safe, compliant transactions between verified rental arbitrage operators.
                All public listings must be verified by our Success Team before going live.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="font-semibold">$100</p>
                  <p className="text-sm text-white/70">Verification Fee</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="font-semibold">$99</p>
                  <p className="text-sm text-white/70">Report Release</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="font-semibold">20%</p>
                  <p className="text-sm text-white/70">Full Transaction Mgmt</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs - scrollable on mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList className="bg-white shadow w-max min-w-full md:w-auto">
            <TabsTrigger value="browse" className="flex items-center gap-1.5 text-xs md:text-sm whitespace-nowrap">
              <Search className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Browse</span> Marketplace
            </TabsTrigger>
            <TabsTrigger value="my-listings" className="flex items-center gap-1.5 text-xs md:text-sm whitespace-nowrap">
              <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4" /> My Listings ({myListings.length})
            </TabsTrigger>
            <TabsTrigger value="received" className="flex items-center gap-1.5 text-xs md:text-sm whitespace-nowrap">
              <Mail className="w-3.5 h-3.5 md:w-4 md:h-4" /> Received ({receivedDeals.length})
            </TabsTrigger>
            <TabsTrigger value="how-it-works" className="flex items-center gap-1.5 text-xs md:text-sm whitespace-nowrap">
              <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" /> How It Works
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Browse Marketplace Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Search & Filters */}
          <Card>
            <CardContent className="pt-4 pb-4 md:pt-5 md:pb-5">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by city, state, address..."
                    value={browseSearch}
                    onChange={(e) => setBrowseSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBrowseSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleBrowseSearch} variant="outline" size="icon" className="flex-shrink-0">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Select value={browseFilter} onValueChange={(v) => { setBrowseFilter(v); setBrowsePage(1); }}>
                    <SelectTrigger className="flex-1 md:w-[160px]">
                      <SlidersHorizontal className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="str">STR</SelectItem>
                      <SelectItem value="coliving">Co-Living</SelectItem>
                      <SelectItem value="both">STR + Co-Living</SelectItem>
                      <SelectItem value="peerspace">Peerspace</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={browseSort} onValueChange={(v) => { setBrowseSort(v); setBrowsePage(1); }}>
                    <SelectTrigger className="flex-1 md:w-[160px]">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="price_low">Price: Low to High</SelectItem>
                      <SelectItem value="price_high">Price: High to Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {browseLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
            </div>
          ) : browseError ? (
            <Card className="border-red-200">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-red-300 mb-4" />
                <h3 className="text-lg font-medium text-red-600">Failed to Load Listings</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  We couldn't load the marketplace listings. This may be a temporary connection issue.
                </p>
                <Button onClick={fetchBrowseListings} className="mt-4 bg-[#d4a574] hover:bg-[#c49464]">
                  <Loader2 className="w-4 h-4 mr-2" /> Try Again
                </Button>
              </CardContent>
            </Card>
          ) : browseListings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Active Listings</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  There are currently no active listings matching your criteria. Check back soon or list your own operation!
                </p>
                <Button onClick={fetchBrowseListings} variant="outline" className="mt-4">
                  <Loader2 className="w-4 h-4 mr-2" /> Refresh
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-gray-500">{browseTotal} listing{browseTotal !== 1 ? 's' : ''} found</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {browseListings.map((listing) => (
                  <BrowseListingCard
                    key={listing.id}
                    listing={listing}
                    isOwnListing={listing.seller_id === investorId}
                    onView={() => handleViewListing(listing)}
                  />
                ))}
              </div>
              {/* Pagination */}
              {browseTotal > 12 && (
                <div className="flex justify-center gap-2 pt-4">
                  <Button variant="outline" size="sm" disabled={browsePage <= 1} onClick={() => setBrowsePage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <span className="flex items-center text-sm text-gray-500 px-3">
                    Page {browsePage} of {Math.ceil(browseTotal / 12)}
                  </span>
                  <Button variant="outline" size="sm" disabled={browsePage >= Math.ceil(browseTotal / 12)} onClick={() => setBrowsePage(p => p + 1)}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>


        {/* My Listings Tab */}
        <TabsContent value="my-listings" className="space-y-4">
          {myListings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Listings Yet</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  Ready to sell one of your rental arbitrage operations? List it publicly on our marketplace or send it privately to a specific investor.
                </p>
                <Button onClick={() => setShowCreateModal(true)} className="mt-4 bg-[#d4a574] hover:bg-[#c49464]">
                  <Plus className="w-4 h-4 mr-2" /> Create Your First Listing
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {myListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} onView={() => handleViewListing(listing)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Received Deals Tab */}
        <TabsContent value="received" className="space-y-4">
          {receivedDeals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Deals Received</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  When another investor sends you a private deal offer, it will appear here for your review.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {receivedDeals.map((deal) => (
                <ReceivedDealCard key={deal.id} deal={deal} onView={() => handleViewReceivedDeal(deal)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* How It Works Tab */}
        <TabsContent value="how-it-works">
          <HowItWorksSection />
        </TabsContent>
      </Tabs>

      {/* Create Listing Modal */}
      <CreateListingModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        portfolio={portfolio}
        investorId={investorId}
        investorName={investorName}
        onSuccess={() => { fetchData(); setShowCreateModal(false); }}
      />

      {/* Listing Detail Modal (for own listings or browse listings) */}
      {selectedListing && !selectedReceivedDeal && (
        <ListingDetailModal
          open={showDetailModal}
          onClose={() => { setShowDetailModal(false); setSelectedListing(null); }}
          listing={selectedListing}
          isOwner={selectedListing.seller_id === investorId}
          investorId={investorId}
          investorName={investorName}
          investorEmail={investorEmail}
          onUpdate={fetchData}
        />
      )}

      {/* Received Deal Detail Modal */}
      {selectedReceivedDeal && !selectedListing && (
        <ReceivedDealDetailModal
          open={showDetailModal}
          onClose={() => { setShowDetailModal(false); setSelectedReceivedDeal(null); }}
          deal={selectedReceivedDeal}
          investorId={investorId}
          investorEmail={investorEmail}
          investorName={investorName}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}

// Browse Listing Card (for marketplace browsing)
function BrowseListingCard({ listing, isOwnListing, onView }: { listing: DealListing; isOwnListing: boolean; onView: () => void }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const photos = listing.property?.photo_urls || listing.property_photo_urls || [];
    if (photos.length > 0) {
      resolvePhotoUrls([photos[0]]).then(urls => { if (urls[0]) setPhotoUrl(urls[0]); });
    }
  }, [listing]);

  const opType = listing.operation_type || 'str';
  const opLabel = opType === 'str' ? 'STR' : opType === 'coliving' ? 'Co-Living' : opType === 'both' ? 'STR + Co-Living' : opType === 'peerspace' ? 'Peerspace' : 'STR';

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden" onClick={onView}>
      {/* Photo */}
      <div className="relative h-40 bg-gray-100">
        {photoUrl ? (
          <img src={photoUrl} alt="Property" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-12 h-12 text-gray-300" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge className="bg-[#1a365d] text-white text-xs">{opLabel}</Badge>
          {isOwnListing && <Badge className="bg-[#d4a574] text-white text-xs">Your Listing</Badge>}
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {listing.property?.city || 'Unknown'}, {listing.property?.state || ''}
            </h3>
            <p className="text-sm text-gray-500 truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {'📍 Address released after account funding'}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div>
            <p className="text-xl font-bold text-[#1a365d]">${listing.asking_price?.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Asking Price</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-green-600">${(listing.monthly_revenue || listing.projected_monthly_revenue || 0).toLocaleString()}/mo</p>
            <p className="text-xs text-gray-500">Revenue</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 text-xs text-gray-500">
          {listing.property?.bedrooms && <span>{listing.property.bedrooms} bed</span>}
          {listing.property?.bathrooms && <span>{listing.property.bathrooms} bath</span>}
          {listing.lease_months_remaining && <span>{listing.lease_months_remaining}mo lease</span>}
          {listing.occupancy_rate && <span>{listing.occupancy_rate}% occ</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// Listing Card Component (for My Listings tab)
function ListingCard({ listing, onView }: { listing: DealListing; onView: () => void }) {
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending_approval: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    verification_requested: 'bg-blue-100 text-blue-700',
    verified: 'bg-purple-100 text-purple-700',
    sold: 'bg-[#d4a574]/20 text-[#8b6914]',
    cancelled: 'bg-red-100 text-red-700'
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                {listing.listing_type === 'private' ? (
                  <Badge variant="outline" className="text-xs"><Lock className="w-3 h-3 mr-1" />Private</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs"><Globe className="w-3 h-3 mr-1" />Public</Badge>
                )}
                <Badge className={statusColors[listing.status]}>
                  {listing.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
                {listing.status === 'pending_approval' && (
                  <span className="text-xs text-yellow-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Awaiting Success Team review
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900">{'📍 Address released after account funding'}</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {listing.property?.city}, {listing.property?.state}
              </p>
              {listing.listing_type === 'private' && listing.buyer_investor_name && (
                <p className="text-sm text-blue-600 mt-1">Sent to: {listing.buyer_investor_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1a365d]">${listing.asking_price?.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Asking Price</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-green-600">${(listing.monthly_revenue || 0).toLocaleString()}/mo</p>
              <p className="text-xs text-gray-500">Revenue</p>
            </div>
            <Button variant="outline" onClick={onView}>
              <Eye className="w-4 h-4 mr-2" /> View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Received Deal Card Component
function ReceivedDealCard({ deal, onView }: { deal: ReceivedDeal; onView: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-[#d4a574]">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-[#d4a574]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Private deal from</p>
              <h3 className="font-semibold text-gray-900">{deal.seller_name}</h3>
              <p className="text-sm text-gray-500">{deal.seller_email}</p>
              <p className="text-xs text-gray-400 mt-1">Received {new Date(deal.sent_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1a365d]">${deal.listing.asking_price?.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Asking Price</p>
            </div>
            <Badge className={
              deal.status === 'verified' ? 'bg-green-100 text-green-700' :
              deal.status === 'verification_requested' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }>
              {deal.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Badge>
            <Button onClick={onView} className="bg-[#d4a574] hover:bg-[#c49464]">
              Review Deal <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// How It Works Section
function HowItWorksSection() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Selling Your Operation</CardTitle>
          <CardDescription>Follow these steps to list and sell your rental arbitrage operation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#d4a574]" /> Private Sale
              </h4>
              <div className="space-y-4">
                {[
                  { step: 1, title: 'Create Listing', desc: 'Add your property details and set asking price' },
                  { step: 2, title: 'Find Buyer', desc: 'Search for investor by name, email, or phone' },
                  { step: 3, title: 'Send Offer', desc: 'Buyer receives private deal notification' },
                  { step: 4, title: 'Buyer Reviews', desc: 'Buyer can request AYP verification' },
                  { step: 5, title: 'Verification', desc: 'Our team verifies the deal ($100 fee)' },
                  { step: 6, title: 'Complete Sale', desc: 'Off-platform or through AYP (20% fee)' }
                ].map((item) => (
                  <div key={item.step} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#d4a574]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#d4a574]">{item.step}</span>
                    </div>
                    <div><p className="font-medium">{item.title}</p><p className="text-sm text-gray-500">{item.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#1a365d]" /> Public Listing
              </h4>
              <div className="space-y-4">
                {[
                  { step: 1, title: 'Create Listing', desc: 'Add property details and asking price' },
                  { step: 2, title: 'Submit for Approval', desc: 'AYP Success Team reviews your listing' },
                  { step: 3, title: 'Verification Call', desc: 'Success team calls to verify deal' },
                  { step: 4, title: 'Go Live', desc: 'Only the Success Team can publish listings' },
                  { step: 5, title: 'Receive Offers', desc: 'Interested buyers submit offers' },
                  { step: 6, title: 'Complete Sale', desc: 'AYP manages full transaction (20% fee)' }
                ].map((item) => (
                  <div key={item.step} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1a365d]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#1a365d]">{item.step}</span>
                    </div>
                    <div><p className="font-medium">{item.title}</p><p className="text-sm text-gray-500">{item.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Why Use Access Your Place?</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {AYP_BENEFITS.map((benefit, index) => (
              <div key={index} className="flex gap-3">
                <div className="p-2 bg-[#d4a574]/10 rounded-lg h-fit">
                  <benefit.icon className="w-5 h-5 text-[#d4a574]" />
                </div>
                <div><h4 className="font-semibold">{benefit.title}</h4><p className="text-sm text-gray-500">{benefit.description}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-amber-800">Important: Success Team Approval Required</h4>
              <ul className="mt-2 space-y-1 text-sm text-amber-700">
                <li>- Only the AYP Success Team can approve and publish listings to the marketplace</li>
                <li>- Investors cannot self-publish; all deals must pass verification first</li>
                <li>- Both buyer and seller must be verified rental arbitrage operators</li>
                <li>- Landlord must be personally vetted by an AYP acquisition manager</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Create Listing Modal
function CreateListingModal({ open, onClose, portfolio, investorId, investorName, onSuccess }: {
  open: boolean; onClose: () => void; portfolio: PortfolioProperty[];
  investorId: string; investorName: string; onSuccess: () => void;
}) {
  const [step, setStep] = useState(1);
  const [listingType, setListingType] = useState<'public' | 'private'>('private');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [formData, setFormData] = useState({
    asking_price: 0, description: '', lease_months_remaining: 12,
    is_furnished: false, landlord_verification_call_agreed: false,
    has_lease_proof: false, landlord_approval_confirmed: false,
    acquisition_cost: 0, furniture_ownership: 'owned' as 'owned' | 'included_in_rent' | 'partial',
    has_upcoming_bookings: false, upcoming_bookings_details: '',
    projected_monthly_revenue: 0, adr: 0, occupancy_rate: 0, monthly_rent: 0,
    operation_type: 'str' as 'str' | 'coliving' | 'both',
    monthly_revenue: 0, monthly_expenses: 0, include_furniture: true, include_supplies: true
  });
  const [buyerSearch, setBuyerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InvestorSearchResult[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<InvestorSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { toast } = useToast();

  const selectedProperty = portfolio.find(p => p.id === selectedPropertyId);
  const totalSteps = listingType === 'private' ? 6 : 5;

  const validateRequirements = () => {
    const errors: string[] = [];
    if (!formData.is_furnished) errors.push('Property must be furnished to list on the marketplace');
    if (!formData.landlord_verification_call_agreed) errors.push('Landlord must agree to take a verification call');
    if (!formData.has_lease_proof && !formData.landlord_approval_confirmed) errors.push('You must have proof of lease OR landlord approval to list');
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const validateOperationDetails = () => {
    const errors: string[] = [];
    if (formData.acquisition_cost <= 0) errors.push('Acquisition cost is required');
    if (formData.projected_monthly_revenue <= 0) errors.push('Projected monthly revenue is required');
    if (formData.monthly_rent <= 0) errors.push('Monthly rent is required');
    if (formData.adr <= 0 && formData.operation_type !== 'coliving') errors.push('ADR is required for STR operations');
    if (formData.occupancy_rate <= 0 || formData.occupancy_rate > 100) errors.push('Occupancy rate must be between 1-100%');
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSearch = async () => {
    if (!buyerSearch.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'search_investors', search_query: buyerSearch, exclude_investor_id: investorId }
      });
      if (data?.investors) {
        setSearchResults(data.investors);
      } else {
        throw new Error('Edge function returned no data');
      }
    } catch (err) {
      console.error('Investor search edge function failed, using DB fallback:', err);
      // DB fallback: query investors table directly
      try {
        const searchTerm = buyerSearch.trim();
        const { data: dbInvestors } = await supabase
          .from('investors')
          .select('id, full_name, email, phone')
          .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
          .neq('id', investorId)
          .limit(10);
        setSearchResults((dbInvestors || []).map((inv: any) => ({
          id: inv.id, full_name: inv.full_name, email: inv.email,
          phone: inv.phone, is_verified_operator: true
        })));
      } catch (dbErr) {
        console.error('DB fallback for investor search also failed:', dbErr);
        setSearchResults([]);
        toast({ title: 'Search Error', description: 'Could not search investors. Please try again.', variant: 'destructive' });
      }
    }
    setSearching(false);
  };

  const handleSubmit = async () => {
    if (!selectedPropertyId) { toast({ title: 'Select Property', description: 'Please select a property to list.', variant: 'destructive' }); return; }
    if (listingType === 'private' && !selectedBuyer) { toast({ title: 'Select Buyer', description: 'Please select an investor to send this deal to.', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'create_listing', investor_id: investorId, property_id: selectedPropertyId,
          listing_type: listingType, buyer_investor_id: selectedBuyer?.id,
          ...formData, asking_price: formData.acquisition_cost,
        }
      });
      if (data?.success) {
        toast({
          title: listingType === 'public' ? 'Listing Submitted for Review' : 'Deal Sent',
          description: listingType === 'public'
            ? 'Your listing has been submitted. The Success Team will review and approve it before it goes live.'
            : `Private deal sent to ${selectedBuyer?.full_name}.`
        });
        onSuccess();
      } else {
        throw new Error(data?.error || 'Failed to create listing');
      }
    } catch (err: any) {
      // DB fallback for create listing
      try {
        const { data: dbListing, error: dbErr } = await supabase.from('deal_listings').insert({
          seller_id: investorId, property_id: selectedPropertyId, listing_type: listingType,
          buyer_investor_id: listingType === 'private' ? selectedBuyer?.id : null,
          asking_price: formData.acquisition_cost, description: formData.description,
          monthly_revenue: formData.projected_monthly_revenue, monthly_expenses: formData.monthly_rent,
          lease_months_remaining: formData.lease_months_remaining,
          status: listingType === 'public' ? 'pending_approval' : 'active',
          is_furnished: formData.is_furnished, projected_monthly_revenue: formData.projected_monthly_revenue,
          adr: formData.adr, occupancy_rate: formData.occupancy_rate, monthly_rent: formData.monthly_rent,
          operation_type: formData.operation_type, acquisition_cost: formData.acquisition_cost,
        }).select('id').single();
        if (dbErr) throw new Error(dbErr.message);
        toast({
          title: listingType === 'public' ? 'Listing Submitted' : 'Deal Sent',
          description: listingType === 'public' ? 'Submitted for Success Team review.' : `Sent to ${selectedBuyer?.full_name}.`
        });
        onSuccess();
      } catch (dbErr2: any) {
        toast({ title: 'Error', description: dbErr2.message || err.message, variant: 'destructive' });
      }
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setStep(1); setListingType('private'); setSelectedPropertyId('');
    setFormData({ asking_price: 0, description: '', lease_months_remaining: 12, is_furnished: false,
      landlord_verification_call_agreed: false, has_lease_proof: false, landlord_approval_confirmed: false,
      acquisition_cost: 0, furniture_ownership: 'owned', has_upcoming_bookings: false,
      upcoming_bookings_details: '', projected_monthly_revenue: 0, adr: 0, occupancy_rate: 0,
      monthly_rent: 0, operation_type: 'str', monthly_revenue: 0, monthly_expenses: 0,
      include_furniture: true, include_supplies: true });
    setBuyerSearch(''); setSearchResults([]); setSelectedBuyer(null); setValidationErrors([]);
  };

  const handleNextStep = () => {
    if (step === 3 && !validateRequirements()) return;
    if (step === 4 && !validateOperationDetails()) return;
    setValidationErrors([]); setStep(step + 1);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'Choose Listing Type'}
            {step === 2 && 'Select Property'}
            {step === 3 && 'Listing Requirements'}
            {step === 4 && 'Operation Details'}
            {step === 5 && (listingType === 'private' ? 'Find Buyer' : 'Review & Submit')}
            {step === 6 && 'Review & Submit'}
          </DialogTitle>
          <DialogDescription>Step {step} of {totalSteps}</DialogDescription>
        </DialogHeader>

        {validationErrors.length > 0 && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-800">Please fix the following:</p>
                  <ul className="mt-1 text-sm text-red-700 space-y-1">
                    {validationErrors.map((error, i) => (<li key={i}>- {error}</li>))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Choose Type */}
        {step === 1 && (
          <RadioGroup value={listingType} onValueChange={(v) => setListingType(v as 'public' | 'private')}>
            <div className="grid md:grid-cols-2 gap-4">
              <label className={`cursor-pointer border-2 rounded-lg p-4 transition ${listingType === 'private' ? 'border-[#d4a574] bg-[#d4a574]/5' : 'border-gray-200'}`}>
                <RadioGroupItem value="private" className="sr-only" />
                <div className="flex items-center gap-3 mb-3"><Lock className="w-6 h-6 text-[#d4a574]" /><span className="font-semibold">Private Deal</span></div>
                <p className="text-sm text-gray-600">Send directly to a specific investor.</p>
              </label>
              <label className={`cursor-pointer border-2 rounded-lg p-4 transition ${listingType === 'public' ? 'border-[#1a365d] bg-[#1a365d]/5' : 'border-gray-200'}`}>
                <RadioGroupItem value="public" className="sr-only" />
                <div className="flex items-center gap-3 mb-3"><Globe className="w-6 h-6 text-[#1a365d]" /><span className="font-semibold">Public Listing</span></div>
                <p className="text-sm text-gray-600">List on AYP marketplace (requires Success Team approval).</p>
              </label>
            </div>
          </RadioGroup>
        )}

        {/* Step 2: Select Property */}
        {step === 2 && (
          <div className="space-y-3">
            {portfolio.length === 0 ? (
              <Card className="bg-amber-50 border-amber-200"><CardContent className="pt-6 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
                <h3 className="font-semibold">No Properties in Portfolio</h3>
                <p className="text-sm text-gray-600 mt-2">Add a property to your portfolio before listing.</p>
              </CardContent></Card>
            ) : portfolio.map((property) => (
              <label key={property.id} className={`cursor-pointer block border-2 rounded-lg p-4 transition ${selectedPropertyId === property.id ? 'border-[#d4a574] bg-[#d4a574]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="property" value={property.id} checked={selectedPropertyId === property.id}
                  onChange={(e) => { setSelectedPropertyId(e.target.value); setFormData({ ...formData, monthly_rent: property.monthly_rent, monthly_revenue: property.monthly_earnings + property.monthly_rent, monthly_expenses: property.monthly_rent }); }}
                  className="sr-only" />
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center"><Building2 className="w-6 h-6 text-gray-400" /></div>
                  <div className="flex-1">
                    <h4 className="font-semibold">📍 Address Protected</h4>
                    <p className="text-sm text-gray-500">{property.city}, {property.state}</p>
                    <div className="flex gap-4 mt-1 text-sm">
                      <span>{property.bedrooms} bed / {property.bathrooms} bath</span>
                      <span className="text-green-600">${property.monthly_earnings?.toLocaleString()}/mo</span>
                    </div>
                  </div>
                  {selectedPropertyId === property.id && <CheckCircle className="w-6 h-6 text-[#d4a574]" />}
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Step 3: Requirements */}
        {step === 3 && (
          <div className="space-y-4">
            <div className={`flex items-start gap-3 p-4 rounded-lg border-2 ${formData.is_furnished ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <Checkbox id="is_furnished" checked={formData.is_furnished} onCheckedChange={(c) => setFormData({ ...formData, is_furnished: c as boolean })} />
              <div className="flex-1"><label htmlFor="is_furnished" className="font-medium cursor-pointer flex items-center gap-2"><Sofa className="w-4 h-4" />Property is Fully Furnished</label></div>
            </div>
            <div className={`flex items-start gap-3 p-4 rounded-lg border-2 ${formData.landlord_verification_call_agreed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <Checkbox id="landlord_call" checked={formData.landlord_verification_call_agreed} onCheckedChange={(c) => setFormData({ ...formData, landlord_verification_call_agreed: c as boolean })} />
              <div className="flex-1"><label htmlFor="landlord_call" className="font-medium cursor-pointer flex items-center gap-2"><Phone className="w-4 h-4" />Landlord Agrees to Verification Call</label></div>
            </div>
            <Card className="border-2 border-gray-200"><CardContent className="pt-4">
              <p className="font-medium mb-3">Lease Documentation (select at least one)</p>
              <div className="space-y-3">
                <div className={`flex items-start gap-3 p-3 rounded-lg ${formData.has_lease_proof ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <Checkbox id="lease_proof" checked={formData.has_lease_proof} onCheckedChange={(c) => setFormData({ ...formData, has_lease_proof: c as boolean })} />
                  <label htmlFor="lease_proof" className="cursor-pointer text-sm"><span className="font-medium">I have proof of lease</span></label>
                </div>
                <div className={`flex items-start gap-3 p-3 rounded-lg ${formData.landlord_approval_confirmed ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <Checkbox id="landlord_approval" checked={formData.landlord_approval_confirmed} onCheckedChange={(c) => setFormData({ ...formData, landlord_approval_confirmed: c as boolean })} />
                  <label htmlFor="landlord_approval" className="cursor-pointer text-sm"><span className="font-medium">I have landlord approval to list</span></label>
                </div>
              </div>
            </CardContent></Card>
          </div>
        )}

        {/* Step 4: Operation Details */}
        {step === 4 && (
          <div className="space-y-4">
            <Select value={formData.operation_type} onValueChange={(v) => setFormData({ ...formData, operation_type: v as any })}>
              <SelectTrigger><SelectValue placeholder="Operation Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="str">Short-Term Rental (STR)</SelectItem>
                <SelectItem value="coliving">Co-Living</SelectItem>
                <SelectItem value="both">Both STR & Co-Living</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Acquisition Cost (Asking Price) *</Label><Input type="number" min="0" value={formData.acquisition_cost || ''} onChange={(e) => setFormData({ ...formData, acquisition_cost: parseFloat(e.target.value) || 0 })} placeholder="15000" /></div>
              <div><Label>Monthly Rent *</Label><Input type="number" min="0" value={formData.monthly_rent || ''} onChange={(e) => setFormData({ ...formData, monthly_rent: parseFloat(e.target.value) || 0 })} placeholder="2500" /></div>
              <div><Label>Projected Monthly Revenue *</Label><Input type="number" min="0" value={formData.projected_monthly_revenue || ''} onChange={(e) => setFormData({ ...formData, projected_monthly_revenue: parseFloat(e.target.value) || 0 })} placeholder="5000" /></div>
              <div><Label>Lease Months Remaining</Label><Input type="number" min="0" value={formData.lease_months_remaining} onChange={(e) => setFormData({ ...formData, lease_months_remaining: parseInt(e.target.value) || 0 })} /></div>
              {formData.operation_type !== 'coliving' && (
                <>
                  <div><Label>ADR *</Label><Input type="number" min="0" value={formData.adr || ''} onChange={(e) => setFormData({ ...formData, adr: parseFloat(e.target.value) || 0 })} placeholder="150" /></div>
                  <div><Label>Occupancy Rate (%) *</Label><Input type="number" min="0" max="100" value={formData.occupancy_rate || ''} onChange={(e) => setFormData({ ...formData, occupancy_rate: parseFloat(e.target.value) || 0 })} placeholder="75" /></div>
                </>
              )}
            </div>
            <div><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe your operation..." rows={3} /></div>
          </div>
        )}

        {/* Step 5: Find Buyer (Private) */}
        {step === 5 && listingType === 'private' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Search by name, email, or phone..." value={buyerSearch} onChange={(e) => setBuyerSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {selectedBuyer && (
              <Card className="bg-green-50 border-green-200"><CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-green-700" /></div>
                    <div><p className="font-semibold">{selectedBuyer.full_name}</p><p className="text-sm text-gray-600">{selectedBuyer.email}</p></div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBuyer(null)}><X className="w-4 h-4" /></Button>
                </div>
              </CardContent></Card>
            )}
            {searchResults.length > 0 && !selectedBuyer && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">{searchResults.length} investor(s) found</p>
                {searchResults.map((investor) => (
                  <Card key={investor.id} className="cursor-pointer hover:border-[#d4a574] transition" onClick={() => setSelectedBuyer(investor)}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-gray-500" /></div>
                          <div><p className="font-semibold">{investor.full_name}</p><p className="text-sm text-gray-500">{investor.email}</p></div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Review Step */}
        {((step === 5 && listingType === 'public') || step === 6) && (
          <div className="space-y-4">
            <Card><CardContent className="pt-4">
              <h4 className="font-semibold mb-3">Listing Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Type:</span><Badge variant="outline">{listingType === 'private' ? 'Private' : 'Public'}</Badge></div>
                <div className="flex justify-between"><span className="text-gray-500">Property:</span><span>{selectedProperty?.address}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Asking Price:</span><span className="font-semibold">${formData.acquisition_cost.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Revenue:</span><span className="text-green-600">${formData.projected_monthly_revenue.toLocaleString()}/mo</span></div>
                {listingType === 'private' && selectedBuyer && <div className="flex justify-between"><span className="text-gray-500">Sending To:</span><span>{selectedBuyer.full_name}</span></div>}
              </div>
            </CardContent></Card>
            {listingType === 'public' && (
              <Card className="bg-amber-50 border-amber-200"><CardContent className="pt-4">
                <div className="flex gap-3">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800">Success Team Approval Required</p>
                    <p className="text-amber-700 mt-1">Your listing will be reviewed by our Success Team. Only they can approve and publish listings to the marketplace. A team member will call you to verify the deal.</p>
                  </div>
                </div>
              </CardContent></Card>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>{step > 1 && <Button variant="outline" onClick={() => { setValidationErrors([]); setStep(step - 1); }}>Back</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
            {step < totalSteps ? (
              <Button onClick={handleNextStep} disabled={(step === 2 && !selectedPropertyId) || (step === 5 && listingType === 'private' && !selectedBuyer)} className="bg-[#d4a574] hover:bg-[#c49464]">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting} className="bg-[#d4a574] hover:bg-[#c49464]">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {listingType === 'private' ? <><Send className="w-4 h-4 mr-2" />Send Private Deal</> : 'Submit for Approval'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Listing Detail Modal (for both own listings and browsed listings)
function ListingDetailModal({ open, onClose, listing, isOwner, investorId, investorName, investorEmail, onUpdate }: {
  open: boolean; onClose: () => void; listing: DealListing; isOwner: boolean;
  investorId: string; investorName: string; investorEmail: string; onUpdate: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [resolvedPhotos, setResolvedPhotos] = useState<string[]>([]);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const { toast } = useToast();

  // Resolve property photos to signed URLs
  useEffect(() => {
    const photos = listing.property?.photo_urls || listing.property_photo_urls || [];
    if (photos.length > 0) {
      resolvePhotoUrls(photos).then(setResolvedPhotos);
    } else {
      setResolvedPhotos([]);
    }
  }, [listing]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'cancel_listing', listing_id: listing.id, investor_id: investorId }
      });
      if (data?.success) { toast({ title: 'Listing Cancelled' }); onUpdate(); onClose(); }
    } catch {
      // DB fallback
      try {
        await supabase.from('deal_listings').update({ status: 'cancelled' }).eq('id', listing.id).eq('seller_id', investorId);
        toast({ title: 'Listing Cancelled' }); onUpdate(); onClose();
      } catch { toast({ title: 'Error', description: 'Failed to cancel', variant: 'destructive' }); }
    }
    setCancelling(false);
  };

  const handleMakeOffer = async () => {
    const amount = parseFloat(offerAmount);
    if (!amount || amount <= 0) { toast({ title: 'Invalid amount', variant: 'destructive' }); return; }
    setSubmittingOffer(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'submit_offer', listing_id: listing.id, buyer_id: investorId, offer_amount: amount, message: offerMessage.trim() || null }
      });
      if (data?.success) {
        toast({ title: 'Offer Submitted!', description: `Your offer of $${amount.toLocaleString()} has been sent to the seller.` });
        setShowOfferForm(false); setOfferAmount(''); setOfferMessage('');
      } else {
        throw new Error(data?.error || 'Failed to submit offer');
      }
    } catch (err: any) {
      console.error('Submit offer edge function failed, trying DB fallback:', err);
      // DB fallback: insert directly into marketplace_offers
      try {
        const { error: dbErr } = await supabase.from('marketplace_offers').insert({
          listing_id: listing.id, buyer_id: investorId, seller_id: listing.seller_id,
          offer_amount: amount, message: offerMessage.trim() || null,
          offer_type: 'initial', status: 'pending',
          buyer_name: investorName, buyer_email: investorEmail,
          property_address: listing.property ? `${listing.property.city}, ${listing.property.state}` : 'Property',
          listing_asking_price: listing.asking_price,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
        if (dbErr) throw new Error(dbErr.message);
        toast({ title: 'Offer Submitted!', description: `Your offer of $${amount.toLocaleString()} has been recorded.` });
        setShowOfferForm(false); setOfferAmount(''); setOfferMessage('');
      } catch (dbErr2: any) {
        toast({ title: 'Error', description: dbErr2.message || err.message, variant: 'destructive' });
      }
    }
    setSubmittingOffer(false);
  };

  const sellerName = listing.seller?.full_name || listing.buyer_investor_name || 'Verified Seller';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Listing Details</DialogTitle>
          <DialogDescription>
            {`${listing.property?.city || ''}, ${listing.property?.state || ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo Gallery */}
          {resolvedPhotos.length > 0 && (
            <div className="space-y-2">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                <img src={resolvedPhotos[selectedPhotoIdx]} alt="Property" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              {resolvedPhotos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {resolvedPhotos.map((url, idx) => (
                    <button key={idx} onClick={() => setSelectedPhotoIdx(idx)} className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${idx === selectedPhotoIdx ? 'border-[#d4a574]' : 'border-transparent hover:border-gray-300'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Property Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                {resolvedPhotos.length === 0 && (
                  <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{'📍 Address released after account funding'}</h3>
                  <p className="text-gray-500">{listing.property?.city}, {listing.property?.state}</p>
                  <div className="flex gap-4 mt-2 flex-wrap">
                    {listing.property?.bedrooms && <Badge variant="outline">{listing.property.bedrooms} bed</Badge>}
                    {listing.property?.bathrooms && <Badge variant="outline">{listing.property.bathrooms} bath</Badge>}
                    {listing.operation_type && <Badge className="bg-[#1a365d] text-white">{listing.operation_type === 'str' ? 'STR' : listing.operation_type === 'coliving' ? 'Co-Living' : listing.operation_type}</Badge>}
                    <Badge className={listing.listing_type === 'private' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                      {listing.listing_type === 'private' ? 'Private' : 'Public'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seller Info (for non-owners) */}
          {!isOwner && (
            <Card className="bg-gray-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#d4a574]/20 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-[#d4a574]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Listed by</p>
                    <p className="font-semibold">{sellerName}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financials */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-[#1a365d]">${listing.asking_price?.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Asking Price</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-green-600">${(listing.monthly_revenue || listing.projected_monthly_revenue || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Monthly Revenue</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-gray-600">{listing.lease_months_remaining || 'N/A'}</p>
              <p className="text-sm text-gray-500">Months Remaining</p>
            </CardContent></Card>
          </div>

          {/* Additional Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {listing.adr && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">ADR</p><p className="font-semibold">${listing.adr}</p></div>}
            {listing.occupancy_rate && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Occupancy</p><p className="font-semibold">{listing.occupancy_rate}%</p></div>}
            {listing.monthly_rent && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Monthly Rent</p><p className="font-semibold">${listing.monthly_rent.toLocaleString()}</p></div>}
            {listing.is_furnished !== undefined && <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Furnished</p><p className="font-semibold">{listing.is_furnished ? 'Yes' : 'No'}</p></div>}
          </div>

          {listing.description && (
            <Card><CardContent className="pt-4">
              <p className="text-sm text-gray-500 mb-2">Description</p>
              <p className="whitespace-pre-wrap">{listing.description}</p>
            </CardContent></Card>
          )}

          {/* Make Offer (for non-owners on active listings) */}
          {!isOwner && listing.status === 'active' && (
            <Card className="border-2 border-[#d4a574]">
              <CardContent className="pt-4">
                {!showOfferForm ? (
                  <div className="text-center">
                    <h4 className="font-semibold mb-2">Interested in this deal?</h4>
                    <p className="text-sm text-gray-600 mb-4">Submit an offer to the seller. All transactions are facilitated by the AYP Success Team.</p>
                    <Button onClick={() => setShowOfferForm(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
                      <DollarSign className="w-4 h-4 mr-2" /> Make an Offer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Submit Your Offer</h4>
                    <div>
                      <Label>Offer Amount *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input type="number" min="0" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder={listing.asking_price?.toString()} className="pl-10" />
                      </div>
                    </div>
                    <div>
                      <Label>Message (optional)</Label>
                      <Textarea value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} placeholder="Tell the seller about yourself and why you're interested..." rows={2} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleMakeOffer} disabled={submittingOffer} className="flex-1 bg-[#d4a574] hover:bg-[#c49464]">
                        {submittingOffer && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <Send className="w-4 h-4 mr-2" /> Submit Offer
                      </Button>
                      <Button variant="outline" onClick={() => setShowOfferForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          {isOwner && listing.status !== 'sold' && listing.status !== 'cancelled' && (
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Cancel Listing
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Received Deal Detail Modal
function ReceivedDealDetailModal({ open, onClose, deal, investorId, investorEmail, investorName, onUpdate }: {
  open: boolean; onClose: () => void; deal: ReceivedDeal; investorId: string;
  investorEmail: string; investorName: string; onUpdate: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [showPaymentCheckout, setShowPaymentCheckout] = useState(false);
  const [paymentType, setPaymentType] = useState<'verification' | 'report' | 'full_transaction'>('verification');
  const { toast } = useToast();

  const handleRequestVerification = () => { setPaymentType('verification'); setShowPaymentCheckout(true); };
  const handleReleaseReport = () => { setPaymentType('report'); setShowPaymentCheckout(true); };
  const handleFullTransaction = () => { setPaymentType('full_transaction'); setShowPaymentCheckout(true); };

  const handlePaymentSuccess = () => {
    notifyAMAboutAction(investorId, 'Deal Interest',
      `Interested in deal from ${deal.seller_name} - ${deal.listing.property?.address || 'Unknown property'} ($${deal.listing.asking_price?.toLocaleString()}). Payment type: ${paymentType}`
    );
    toast({
      title: 'Payment Successful',
      description: paymentType === 'verification' ? 'Verification requested. Our team will begin within 24-48 hours.'
        : paymentType === 'report' ? 'Report released!'
        : 'Transaction initiated. A Success Manager will be assigned shortly.'
    });
    onUpdate(); setShowPaymentCheckout(false);
  };

  const handleDecline = async () => {
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'decline_deal', listing_id: deal.listing.id, investor_id: investorId }
      });
      if (data?.success) { toast({ title: 'Deal Declined' }); onUpdate(); onClose(); }
    } catch {
      try {
        await supabase.from('deal_listings').update({ status: 'declined' }).eq('id', deal.listing.id).eq('buyer_investor_id', investorId);
        toast({ title: 'Deal Declined' }); onUpdate(); onClose();
      } catch { toast({ title: 'Error', description: 'Failed to decline deal', variant: 'destructive' }); }
    }
    setProcessing(false);
  };

  return (
    <>
      <Dialog open={open && !showPaymentCheckout} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Private Deal from {deal.seller_name}</DialogTitle>
            <DialogDescription>Review this deal and decide if you'd like to proceed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="bg-gray-50"><CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center"><User className="w-6 h-6 text-[#d4a574]" /></div>
                <div><p className="font-semibold">{deal.seller_name}</p><p className="text-sm text-gray-500">{deal.seller_email}</p></div>
              </div>
            </CardContent></Card>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-[#1a365d] text-white"><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">${deal.listing.asking_price?.toLocaleString()}</p><p className="text-sm opacity-80">Asking Price</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-600">${(deal.listing.monthly_revenue || 0).toLocaleString()}</p><p className="text-sm text-gray-500">Monthly Revenue</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-gray-600">${((deal.listing.monthly_revenue || 0) - (deal.listing.monthly_expenses || 0)).toLocaleString()}</p><p className="text-sm text-gray-500">Monthly Profit</p>
              </CardContent></Card>
            </div>

            {deal.listing.description && (
              <Card><CardContent className="pt-4"><p className="text-sm text-gray-500 mb-2">Seller's Description</p><p>{deal.listing.description}</p></CardContent></Card>
            )}

            {deal.status === 'pending' && (
              <Card className="border-2 border-[#d4a574]"><CardContent className="pt-4">
                <h4 className="font-semibold mb-3">Your Options</h4>
                <Button className="w-full bg-[#d4a574] hover:bg-[#c49464]" onClick={handleRequestVerification}>
                  <Shield className="w-4 h-4 mr-2" /> Request Verification ($100)
                </Button>
                <p className="text-xs text-gray-500 text-center mt-2">Our team will verify this deal meets AYP standards.</p>
              </CardContent></Card>
            )}

            {deal.status === 'verified' && (
              <Card className="border-2 border-[#1a365d]"><CardContent className="pt-4">
                <h4 className="font-semibold mb-3">Complete Transaction Through AYP</h4>
                <Button className="w-full bg-[#1a365d] hover:bg-[#2d4a7c]" onClick={handleFullTransaction}>
                  <Handshake className="w-4 h-4 mr-2" /> Proceed with Full Transaction
                </Button>
              </CardContent></Card>
            )}
          </div>
          <DialogFooter>
            {deal.status === 'pending' && <Button variant="destructive" onClick={handleDecline} disabled={processing}>Decline Deal</Button>}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MarketplacePaymentCheckout
        open={showPaymentCheckout}
        onClose={() => setShowPaymentCheckout(false)}
        paymentType={paymentType}
        listingId={deal.listing.id}
        investorId={investorId}
        investorEmail={investorEmail}
        investorName={investorName}
        salePrice={deal.listing.asking_price}
        propertyAddress={deal.listing.property?.address || `${deal.listing.property?.city}, ${deal.listing.property?.state}`}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
}
