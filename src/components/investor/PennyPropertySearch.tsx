import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, Loader2, Building2, MapPin, Bed, Bath, DollarSign, 
  TrendingUp, BarChart3, Sparkles, AlertCircle, Clock, Phone,
  CheckCircle, XCircle, Lock, Calendar, Home, Building, Users,
  ArrowRight, Info, Send
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface PennyPropertySearchProps {
  investorId: string;
  investorName: string;
  hasAcquisitionManager?: boolean;
  discoveryCallCompleted?: boolean;
}

interface MarketplaceDeal {
  id: string;
  listing_title: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  acquisition_fee: number;
  operation_type: string;
  property_type: string;
  is_furnished: boolean;
  is_verified: boolean;
  photos: string[];
  penny_score?: number;
}

interface AcquisitionRequest {
  id: string;
  city: string;
  state: string;
  zip_code: string;
  status: string;
  is_approved: boolean;
  first_refusal_expires_at?: string;
  manager_notes?: string;
  negotiated_price?: number;
  created_at: string;
}

const PROPERTY_TYPES = [
  { value: 'str', label: 'Short-Term Rental (STR)' },
  { value: 'coliving', label: 'Co-Living' },
  { value: 'both', label: 'STR + Co-Living' },
];

export function PennyPropertySearch({ investorId, investorName, hasAcquisitionManager, discoveryCallCompleted }: PennyPropertySearchProps) {
  const [searchParams, setSearchParams] = useState({
    city: '',
    state: '',
    zip_code: '',
    operation_type: 'all',
    min_bedrooms: '',
    max_price: ''
  });
  const [marketplaceDeals, setMarketplaceDeals] = useState<MarketplaceDeal[]>([]);
  const [myRequests, setMyRequests] = useState<AcquisitionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMyRequests();
    fetchMarketplaceDeals();
  }, [investorId]);

  const fetchMyRequests = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: { action: 'get_my_requests', investor_id: investorId }
      });

      if (data?.requests) {
        setMyRequests(data.requests);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const fetchMarketplaceDeals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-deal-locator', {
        body: {
          action: 'search',
          investor_id: investorId,
          city: searchParams.city || undefined,
          state: searchParams.state || undefined,
          zip_code: searchParams.zip_code || undefined,
          operation_type: searchParams.operation_type !== 'all' ? searchParams.operation_type : undefined,
          min_bedrooms: searchParams.min_bedrooms ? parseInt(searchParams.min_bedrooms) : undefined,
          max_price: searchParams.max_price ? parseInt(searchParams.max_price) : undefined
        }
      });

      if (error) throw error;

      setMarketplaceDeals(data?.deals || []);
    } catch (err: any) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchMarketplaceDeals();
  };

  const handleSubmitAreaRequest = async () => {
    if (!searchParams.city && !searchParams.state && !searchParams.zip_code) {
      toast({
        title: 'Location Required',
        description: 'Please enter a city, state, or ZIP code for your request.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: {
          action: 'submit_request',
          investor_id: investorId,
          property_type: searchParams.operation_type,
          city: searchParams.city,
          state: searchParams.state,
          zip_code: searchParams.zip_code,
          bedrooms: searchParams.min_bedrooms ? parseInt(searchParams.min_bedrooms) : null,
          max_rent: searchParams.max_price ? parseInt(searchParams.max_price) : null,
          notes: `Investor requested property search in ${searchParams.city || ''} ${searchParams.state || ''} ${searchParams.zip_code || ''}. Operation type: ${searchParams.operation_type}`
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Request Submitted!',
        description: 'Our acquisition team will research properties in this area and contact you within 24-48 hours.',
      });

      setShowRequestModal(false);
      fetchMyRequests();
    } catch (err: any) {
      console.error('Request error:', err);
      toast({
        title: 'Request Failed',
        description: err.message || 'Unable to submit request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptFirstRefusal = async (requestId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: {
          action: 'accept_first_refusal',
          investor_id: investorId,
          request_id: requestId
        }
      });

      if (error) throw error;

      toast({
        title: 'Deal Accepted!',
        description: data?.message || 'Our team will contact you to proceed with the acquisition.',
      });

      fetchMyRequests();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Unable to accept deal.',
        variant: 'destructive'
      });
    }
  };

  const handleDeclineFirstRefusal = async (requestId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: {
          action: 'decline_first_refusal',
          investor_id: investorId,
          request_id: requestId
        }
      });

      if (error) throw error;

      toast({
        title: 'Deal Declined',
        description: 'The deal will now be available to other investors.',
      });

      fetchMyRequests();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Unable to decline deal.',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string, isApproved: boolean) => {
    if (isApproved) {
      return <Badge className="bg-green-500">Approved - Action Required</Badge>;
    }
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'assigned':
        return <Badge className="bg-blue-500">Manager Assigned</Badge>;
      case 'researching':
        return <Badge className="bg-purple-500">Researching</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      case 'accepted':
        return <Badge className="bg-green-600">Accepted</Badge>;
      case 'available':
        return <Badge className="bg-yellow-500">Available to Others</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Approved requests with first right of refusal
  const approvedRequests = myRequests.filter(r => r.is_approved && r.status === 'approved');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] rounded-xl">
            <Sparkles className="w-6 h-6 text-[#d4a574]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Find Properties</h2>
            <p className="text-sm text-gray-500">Browse marketplace deals or request custom searches</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800 font-medium">How Property Discovery Works</p>
          <p className="text-sm text-blue-700 mt-1">
            Browse our <strong>pre-negotiated marketplace deals</strong> below, or request our acquisition team to 
            find properties in a specific area. Our team handles all property discovery and landlord negotiations.
          </p>
        </div>
      </div>

      {/* Approved Requests Alert */}
      {approvedRequests.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">
                  {approvedRequests.length} Deal{approvedRequests.length > 1 ? 's' : ''} Ready for Your Review!
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Our acquisition team has found properties matching your requests. You have 24-hour first right of refusal.
                </p>
                <div className="mt-3 space-y-2">
                  {approvedRequests.map(req => (
                    <div key={req.id} className="bg-white rounded-lg p-3 border border-green-200">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {req.city}, {req.state} {req.zip_code}
                          </p>
                          {req.negotiated_price && (
                            <p className="text-sm text-green-600">
                              Negotiated: ${req.negotiated_price.toLocaleString()}/mo
                            </p>
                          )}
                          {req.first_refusal_expires_at && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Expires: {new Date(req.first_refusal_expires_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeclineFirstRefusal(req.id)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleAcceptFirstRefusal(req.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Accept Deal
                          </Button>
                        </div>
                      </div>
                      {req.manager_notes && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                          <strong>Manager Notes:</strong> {req.manager_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search/Filter Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5 text-[#d4a574]" />
            Search Marketplace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">City</label>
              <Input aria-label="e.g., Austin"
                placeholder="e.g., Austin"
                value={searchParams.city}
                onChange={(e) => setSearchParams(prev => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">State</label>
              <Input aria-label="e.g., TX"
                placeholder="e.g., TX"
                value={searchParams.state}
                onChange={(e) => setSearchParams(prev => ({ ...prev, state: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">ZIP Code</label>
              <Input aria-label="e.g., 78701"
                placeholder="e.g., 78701"
                value={searchParams.zip_code}
                onChange={(e) => setSearchParams(prev => ({ ...prev, zip_code: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Operation Type</label>
              <Select
                value={searchParams.operation_type}
                onValueChange={(value) => setSearchParams(prev => ({ ...prev, operation_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PROPERTY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Min Bedrooms</label>
              <Input aria-label="Any"
                type="number"
                placeholder="Any"
                value={searchParams.min_bedrooms}
                onChange={(e) => setSearchParams(prev => ({ ...prev, min_bedrooms: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Max Rent</label>
              <Input aria-label="Any"
                type="number"
                placeholder="Any"
                value={searchParams.max_price}
                onChange={(e) => setSearchParams(prev => ({ ...prev, max_price: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 flex-wrap gap-4">
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search Marketplace
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowRequestModal(true)}
              className="border-[#1a365d] text-[#1a365d]"
            >
              <Send className="w-4 h-4 mr-2" />
              Request Custom Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Marketplace Results */}
      {marketplaceDeals.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#1a365d]" />
              Marketplace Deals ({marketplaceDeals.length})
            </h3>
            <Button asChild variant="outline" size="sm">
              <Link to="/deals">
                View All Deals
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketplaceDeals.slice(0, 9).map((deal) => (
              <Card key={deal.id} className="overflow-hidden hover:shadow-lg transition">
                <div className="h-32 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] relative flex items-center justify-center">
                  {deal.photos?.[0] ? (
                    <img src={deal.photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-10 h-10 text-white/40" />
                  )}
                  <Badge className="absolute top-2 left-2 bg-[#d4a574]">
                    {deal.operation_type === 'coliving' ? 'Co-Living' : deal.operation_type === 'both' ? 'STR + Co-Living' : 'STR'}
                  </Badge>
                  {deal.penny_score && (
                    <Badge className="absolute top-2 right-2 bg-green-500">
                      Score: {deal.penny_score}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-gray-900 line-clamp-1">
                    {deal.listing_title || `${deal.bedrooms}BR in ${deal.city}`}
                  </h4>
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{deal.city}, {deal.state}</span>
                  </div>

                  <div className="flex gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Bed className="w-4 h-4" />
                      {deal.bedrooms} bed
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      {deal.bathrooms} bath
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50 p-2 rounded">
                      <span className="text-gray-500 block">Monthly Rent</span>
                      <span className="font-bold text-blue-700">
                        ${deal.monthly_rent?.toLocaleString()}/mo
                      </span>
                    </div>
                    <div className="bg-green-50 p-2 rounded">
                      <span className="text-gray-500 block">Acquisition Fee</span>
                      <span className="font-bold text-green-700">
                        ${deal.acquisition_fee?.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Button asChild className="w-full bg-[#1a365d] hover:bg-[#2d4a7c]" size="sm">
                    <Link to={`/deals?property=${deal.id}`}>
                      View Details
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {marketplaceDeals.length > 9 && (
            <div className="text-center">
              <Button asChild variant="outline">
                <Link to="/deals">
                  View All {marketplaceDeals.length} Deals
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : !loading && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Matching Deals Found</h3>
            <p className="text-gray-500 mb-4">
              No properties match your current filters. Try adjusting your search or request our team to find properties in your desired area.
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/deals">Browse All Deals</Link>
              </Button>
              <Button onClick={() => setShowRequestModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
                <Send className="w-4 h-4 mr-2" />
                Request Custom Search
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Requests */}
      {myRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#d4a574]" />
              My Search Requests ({myRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myRequests.map(request => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {request.city}, {request.state} {request.zip_code}
                    </p>
                    <p className="text-sm text-gray-500">
                      Submitted {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {getStatusBadge(request.status, request.is_approved)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Custom Search Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-[#d4a574]" />
              Request Custom Property Search
            </DialogTitle>
            <DialogDescription>
              Our acquisition team will search for properties in your desired area and negotiate with landlords on your behalf.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">City *</label>
                <Input aria-label="e.g., Austin"
                  placeholder="e.g., Austin"
                  value={searchParams.city}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">State *</label>
                  <Input aria-label="e.g., TX"
                    placeholder="e.g., TX"
                    value={searchParams.state}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, state: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">ZIP Code</label>
                  <Input aria-label="Optional"
                    placeholder="Optional"
                    value={searchParams.zip_code}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, zip_code: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">What Happens Next?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  Our acquisition team researches properties in your area
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  We verify opportunities and analyze profitability
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  If viable, we negotiate terms with landlords
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  You get 24-hour first right of refusal on any deals
                </li>
              </ul>
            </div>

            {!hasAcquisitionManager && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> You'll need an acquisition manager to proceed with any deals. 
                  You can request one from your dashboard.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAreaRequest}
              disabled={submitting || (!searchParams.city && !searchParams.state)}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PennyPropertySearch;
