import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Search, Building2, MapPin, Bed, Bath, DollarSign,
  CheckCircle, XCircle, Clock, AlertTriangle, FileText, Image,
  Link as LinkIcon, Eye, Edit2, RefreshCw, Filter, User, Calendar
} from 'lucide-react';

interface PortfolioProperty {
  id: string;
  investor_id: string;
  investor_name?: string;
  investor_email?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  initial_investment: number;
  monthly_earnings: number;
  acquisition_fee: number;
  acquired_through_ayp: boolean;
  acquisition_manager: string;
  acquisition_date: string;
  property_type: string;
  property_status: string;
  has_lease_documents: boolean;
  has_corporate_sublease: boolean;
  lease_type: string;
  documents_complete: boolean;
  photos: any[];
  photo_urls: string[];
  linked_deal_id: string;
  admin_notes: string;
  reviewed_by: string;
  reviewed_at: string;
  published_to_dealflow: boolean;
  units_available: number;
  notes: string;
  created_at: string;
}

interface Stats {
  pending_approval: number;
  approved: number;
  rejected: number;
  documents_pending: number;
  published_to_dealflow: number;
}

interface ExistingDeal {
  id: string;
  address: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
}

export function PortfolioApprovalsTab() {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_approval');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PortfolioProperty | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Review form
  const [reviewForm, setReviewForm] = useState({
    admin_notes: '',
    link_to_deal_id: '',
    publish_to_dealflow: false,
    units_available: 0,
    rejection_reason: ''
  });
  
  // Document form
  const [documentForm, setDocumentForm] = useState({
    has_lease_documents: false,
    has_corporate_sublease: false,
    lease_type: ''
  });
  
  // Search for existing deals
  const [existingDeals, setExistingDeals] = useState<ExistingDeal[]>([]);
  const [searchingDeals, setSearchingDeals] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const { data: statsData } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: { action: 'get_stats' }
      });
      if (statsData?.stats) setStats(statsData.stats);

      // Fetch properties
      const { data: propsData } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: { action: 'get_all_portfolio_properties', status_filter: statusFilter }
      });
      if (propsData?.properties) setProperties(propsData.properties);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  const handleReviewProperty = (property: PortfolioProperty) => {
    setSelectedProperty(property);
    setReviewForm({
      admin_notes: property.admin_notes || '',
      link_to_deal_id: property.linked_deal_id || '',
      publish_to_dealflow: property.published_to_dealflow || false,
      units_available: property.units_available || 0,
      rejection_reason: ''
    });
    setShowReviewModal(true);
    
    // Search for matching deals
    searchExistingDeals(property.address, property.city, property.state);
  };

  const searchExistingDeals = async (address: string, city: string, state: string) => {
    setSearchingDeals(true);
    try {
      const { data } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: { action: 'search_existing_deals', address, city, state }
      });
      if (data?.deals) setExistingDeals(data.deals);
    } catch (err) {
      console.error('Error searching deals:', err);
    }
    setSearchingDeals(false);
  };

  const handleApproveProperty = async () => {
    if (!selectedProperty) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: {
          action: 'approve_property',
          property_id: selectedProperty.id,
          staff_name: 'Staff Admin',
          admin_notes: reviewForm.admin_notes,
          link_to_deal_id: reviewForm.link_to_deal_id || null,
          publish_to_dealflow: reviewForm.publish_to_dealflow,
          units_available: reviewForm.units_available
        }
      });

      if (data?.success) {
        toast({ title: 'Property Approved', description: 'The property has been approved and the investor has been notified.' });
        setShowReviewModal(false);
        setSelectedProperty(null);
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to approve property');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleRejectProperty = async () => {
    if (!selectedProperty || !reviewForm.rejection_reason) {
      toast({ title: 'Missing Information', description: 'Please provide a reason for rejection.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: {
          action: 'reject_property',
          property_id: selectedProperty.id,
          staff_name: 'Staff Admin',
          admin_notes: reviewForm.admin_notes,
          rejection_reason: reviewForm.rejection_reason
        }
      });

      if (data?.success) {
        toast({ title: 'Property Rejected', description: 'The investor has been notified.' });
        setShowReviewModal(false);
        setSelectedProperty(null);
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to reject property');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleOpenDocuments = (property: PortfolioProperty) => {
    setSelectedProperty(property);
    setDocumentForm({
      has_lease_documents: property.has_lease_documents || false,
      has_corporate_sublease: property.has_corporate_sublease || false,
      lease_type: property.lease_type || ''
    });
    setShowDocumentsModal(true);
  };

  const handleUpdateDocuments = async () => {
    if (!selectedProperty) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: {
          action: 'update_document_status',
          property_id: selectedProperty.id,
          has_lease_documents: documentForm.has_lease_documents,
          has_corporate_sublease: documentForm.has_corporate_sublease,
          lease_type: documentForm.lease_type,
          staff_name: 'Staff Admin'
        }
      });

      if (data?.success) {
        toast({ title: 'Documents Updated', description: 'Document status has been updated.' });
        setShowDocumentsModal(false);
        setSelectedProperty(null);
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to update documents');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleMarkComplete = async (property: PortfolioProperty) => {
    if (!property.has_lease_documents && !property.has_corporate_sublease) {
      toast({ 
        title: 'Cannot Complete Acquisition', 
        description: 'Client must have either community lease documents or corporate sublease document before marking as complete.',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: {
          action: 'mark_acquisition_complete',
          property_id: property.id,
          staff_name: 'Staff Admin'
        }
      });

      if (data?.success) {
        toast({ title: 'Acquisition Complete', description: 'The acquisition has been marked as complete.' });
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to mark as complete');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const filteredProperties = properties.filter(prop => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      prop.investor_name?.toLowerCase().includes(query) ||
      prop.investor_email?.toLowerCase().includes(query) ||
      prop.address?.toLowerCase().includes(query) ||
      prop.city?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return <Badge className="bg-orange-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={stats?.pending_approval ? 'border-orange-300' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.pending_approval || 0}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.approved || 0}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.rejected || 0}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats?.documents_pending ? 'border-yellow-300' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.documents_pending || 0}</p>
                <p className="text-xs text-muted-foreground">Docs Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.published_to_dealflow || 0}</p>
                <p className="text-xs text-muted-foreground">On Deal Flow</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input aria-label="Search by investor or address"
              placeholder="Search by investor or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2 items-center">
          <Filter className="w-4 h-4 text-gray-500" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="active">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Properties List */}
      {filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No portfolio properties found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredProperties.map((property) => (
            <Card key={property.id} className={property.property_status === 'pending_approval' ? 'border-orange-200' : ''}>
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Property Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-semibold">{property.investor_name}</span>
                      <span className="text-sm text-gray-500">{property.investor_email}</span>
                    </div>
                    
                    <div className="flex items-start gap-3 mt-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Building2 className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{property.address}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {property.city}, {property.state} {property.zip_code}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            <Bed className="w-3 h-3 mr-1" />{property.bedrooms} bed
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Bath className="w-3 h-3 mr-1" />{property.bathrooms} bath
                          </Badge>
                          {getStatusBadge(property.property_status)}
                        </div>
                      </div>
                    </div>

                    {/* Photos indicator */}
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center gap-1 text-sm">
                        <Image className="w-4 h-4 text-gray-400" />
                        <span className={property.photo_urls?.length > 0 ? 'text-green-600' : 'text-red-600'}>
                          {property.photo_urls?.length || 0} photos
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className={property.documents_complete ? 'text-green-600' : 'text-yellow-600'}>
                          {property.documents_complete ? 'Docs Complete' : 'Docs Pending'}
                        </span>
                      </div>
                      {property.linked_deal_id && (
                        <div className="flex items-center gap-1 text-sm text-blue-600">
                          <LinkIcon className="w-4 h-4" />
                          Linked to Deal
                        </div>
                      )}
                    </div>

                    {/* Document Status Details */}
                    {property.property_status === 'active' && !property.documents_complete && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-yellow-800">Documents Incomplete</p>
                            <p className="text-yellow-700">
                              {!property.has_lease_documents && !property.has_corporate_sublease 
                                ? 'Missing: Community lease OR corporate sublease documents'
                                : property.lease_type === 'master_vip_lease' && !property.has_corporate_sublease
                                  ? 'Missing: Corporate sublease document (VIP Lease)'
                                  : 'Missing: Community lease documents'
                              }
                            </p>
                            {property.acquisition_fee > 0 && (
                              <p className="text-yellow-700 mt-1">
                                <DollarSign className="w-3 h-3 inline" />
                                ${property.acquisition_fee.toLocaleString()} credit active until documents received
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {property.admin_notes && (
                      <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-2 rounded">
                        <strong>Notes:</strong> {property.admin_notes}
                      </p>
                    )}
                  </div>

                  {/* Financial Info & Actions */}
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-xs text-gray-500">Rent</p>
                        <p className="font-bold">${property.monthly_rent?.toLocaleString() || 0}</p>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <p className="text-xs text-gray-500">Earnings</p>
                        <p className="font-bold text-green-700">${property.monthly_earnings?.toLocaleString() || 0}</p>
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-xs text-gray-500">Invested</p>
                        <p className="font-bold text-blue-700">${property.initial_investment?.toLocaleString() || 0}</p>
                      </div>
                      <div className="bg-[#d4a574]/10 p-2 rounded">
                        <p className="text-xs text-gray-500">Acq. Fee</p>
                        <p className="font-bold text-[#d4a574]">${property.acquisition_fee?.toLocaleString() || 0}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {property.property_status === 'pending_approval' && (
                        <Button 
                          onClick={() => handleReviewProperty(property)}
                          className="bg-[#d4a574] hover:bg-[#c49464]"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Review
                        </Button>
                      )}
                      {property.property_status === 'active' && (
                        <>
                          <Button 
                            variant="outline"
                            onClick={() => handleOpenDocuments(property)}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Documents
                          </Button>
                          {!property.documents_complete && (
                            <Button 
                              variant="outline"
                              className="text-green-600 border-green-300 hover:bg-green-50"
                              onClick={() => handleMarkComplete(property)}
                              disabled={!property.has_lease_documents && !property.has_corporate_sublease}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark Complete
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Property Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Portfolio Property</DialogTitle>
            <DialogDescription>
              Review this property submission and approve or reject it.
            </DialogDescription>
          </DialogHeader>

          {selectedProperty && (
            <div className="space-y-6">
              {/* Property Summary */}
              <Card className="bg-gray-50">
                <CardContent className="pt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="font-medium">{selectedProperty.address}</p>
                      <p className="text-sm text-gray-600">{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Investor</p>
                      <p className="font-medium">{selectedProperty.investor_name}</p>
                      <p className="text-sm text-gray-600">{selectedProperty.investor_email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Property Details</p>
                      <p className="font-medium">{selectedProperty.bedrooms} bed / {selectedProperty.bathrooms} bath</p>
                      <p className="text-sm text-gray-600">{selectedProperty.property_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Acquisition</p>
                      <p className="font-medium">{selectedProperty.acquisition_manager || 'Not specified'}</p>
                      <p className="text-sm text-gray-600">{formatDate(selectedProperty.acquisition_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Acquisition Fee</p>
                      <p className="font-medium text-[#d4a574]">${selectedProperty.acquisition_fee?.toLocaleString() || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Photos</p>
                      <p className={`font-medium ${selectedProperty.photo_urls?.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedProperty.photo_urls?.length || 0} uploaded
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Photo Requirement Warning */}
              {(!selectedProperty.photo_urls || selectedProperty.photo_urls.length === 0) && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">Photos Required</p>
                        <p className="text-sm text-red-700">
                          This property has no photos uploaded. Photos are required before approval.
                          The investor should upload photos (furnished or unfurnished) from the property or from the Acquisition Manager.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Link to Existing Deal */}
              <div>
                <Label>Link to Existing Deal (Optional)</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Search for matching properties in the deal database
                </p>
                {searchingDeals ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </div>
                ) : existingDeals.length > 0 ? (
                  <div className="space-y-2">
                    {existingDeals.map((deal) => (
                      <div 
                        key={deal.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          reviewForm.link_to_deal_id === deal.id ? 'border-[#d4a574] bg-[#d4a574]/10' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setReviewForm({ ...reviewForm, link_to_deal_id: deal.id })}
                      >
                        <p className="font-medium">{deal.address}</p>
                        <p className="text-sm text-gray-500">{deal.city}, {deal.state}</p>
                      </div>
                    ))}
                    {reviewForm.link_to_deal_id && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setReviewForm({ ...reviewForm, link_to_deal_id: '' })}
                      >
                        Clear Selection
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No matching deals found in database</p>
                )}
              </div>

              {/* Publish to Deal Flow */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Publish to Deal Flow</Label>
                  <p className="text-sm text-gray-500">
                    Make this property available for other investors if units are still available
                  </p>
                </div>
                <Switch
                  checked={reviewForm.publish_to_dealflow}
                  onCheckedChange={(checked) => setReviewForm({ ...reviewForm, publish_to_dealflow: checked })}
                />
              </div>

              {reviewForm.publish_to_dealflow && (
                <div>
                  <Label htmlFor="units-available">Units Available</Label>
                  <Input id="units-available"
                    type="number"
                    min="0"
                    value={reviewForm.units_available}
                    onChange={(e) => setReviewForm({ ...reviewForm, units_available: parseInt(e.target.value) || 0 })}
                  />
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <Label htmlFor="admin-notes">Admin Notes</Label>
                <Textarea id="admin-notes"
                  value={reviewForm.admin_notes}
                  onChange={(e) => setReviewForm({ ...reviewForm, admin_notes: e.target.value })}
                  placeholder="Internal notes about this property..."
                  rows={3}
                />
              </div>

              {/* Rejection Reason */}
              <div>
                <Label htmlFor="rejection-reason-if-rejecting">Rejection Reason (if rejecting)</Label>
                <Textarea id="rejection-reason-if-rejecting"
                  value={reviewForm.rejection_reason}
                  onChange={(e) => setReviewForm({ ...reviewForm, rejection_reason: e.target.value })}
                  placeholder="Reason for rejection (will be sent to investor)..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRejectProperty}
              disabled={processing}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button 
              onClick={handleApproveProperty}
              disabled={processing || (!selectedProperty?.photo_urls || selectedProperty.photo_urls.length === 0)}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documents Modal */}
      <Dialog open={showDocumentsModal} onOpenChange={setShowDocumentsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Document Status</DialogTitle>
            <DialogDescription>
              Track which documents have been received for this acquisition.
            </DialogDescription>
          </DialogHeader>

          {selectedProperty && (
            <div className="space-y-6">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-blue-800">
                    <strong>Important:</strong> An acquisition cannot be marked as complete until the client has received either:
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
                    <li>Community lease documents, OR</li>
                    <li>Corporate sublease document (for Master VIP Lease clients)</li>
                  </ul>
                </CardContent>
              </Card>

              <div>
                <Label>Lease Type</Label>
                <Select
                  value={documentForm.lease_type}
                  onValueChange={(value) => setDocumentForm({ ...documentForm, lease_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lease type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="community_lease">Community Lease</SelectItem>
                    <SelectItem value="master_vip_lease">Master VIP Lease</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Community Lease Documents</Label>
                    <p className="text-sm text-gray-500">Lease agreements from the property/community</p>
                  </div>
                  <Switch
                    checked={documentForm.has_lease_documents}
                    onCheckedChange={(checked) => setDocumentForm({ ...documentForm, has_lease_documents: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Corporate Sublease Document</Label>
                    <p className="text-sm text-gray-500">For Master VIP Lease clients</p>
                  </div>
                  <Switch
                    checked={documentForm.has_corporate_sublease}
                    onCheckedChange={(checked) => setDocumentForm({ ...documentForm, has_corporate_sublease: checked })}
                  />
                </div>
              </div>

              {(documentForm.has_lease_documents || documentForm.has_corporate_sublease) && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Documents received - acquisition can be marked complete</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocumentsModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateDocuments}
              disabled={processing}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Documents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
