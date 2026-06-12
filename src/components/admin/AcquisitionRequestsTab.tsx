import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, Loader2, Building2, MapPin, Bed, Bath, DollarSign, 
  User, Clock, CheckCircle, XCircle, AlertCircle, Phone, Mail,
  TrendingUp, FileText, Sparkles, RefreshCw, Filter
} from 'lucide-react';

interface AcquisitionRequest {
  id: string;
  investor_id: string;
  investor?: {
    full_name: string;
    email: string;
    phone: string;
  };
  property_type: string;
  furnishing_status: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  projected_monthly_revenue: number;
  projected_adr: number;
  projected_occupancy_rate: number;
  listed_price: number;
  photos: string[];
  source_url?: string;
  status: string;
  assigned_manager_name?: string;
  assigned_at?: string;
  manager_notes?: string;
  negotiated_price?: number;
  negotiated_terms?: string;
  is_approved: boolean;
  approved_at?: string;
  decline_reason?: string;
  first_refusal_expires_at?: string;
  first_refusal_accepted?: boolean;
  created_at: string;
}

interface Counts {
  pending: number;
  assigned: number;
  researching: number;
  approved: number;
  declined: number;
  total: number;
}

export function AcquisitionRequestsTab() {
  const [requests, setRequests] = useState<AcquisitionRequest[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, assigned: 0, researching: 0, approved: 0, declined: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<AcquisitionRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [managerNotes, setManagerNotes] = useState('');
  const [negotiatedPrice, setNegotiatedPrice] = useState('');
  const [negotiatedTerms, setNegotiatedTerms] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: { 
          action: 'get_all_requests',
          status: statusFilter !== 'all' ? statusFilter : undefined
        }
      });

      if (error) throw error;

      setRequests(data?.requests || []);
      setCounts(data?.counts || { pending: 0, assigned: 0, researching: 0, approved: 0, declined: 0, total: 0 });
    } catch (err) {
      console.error('Error fetching requests:', err);
      toast({
        title: 'Error',
        description: 'Failed to load acquisition requests',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignManager = async () => {
    if (!selectedRequest || !managerName.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: {
          action: 'assign_manager',
          request_id: selectedRequest.id,
          manager_name: managerName
        }
      });

      if (error) throw error;

      toast({
        title: 'Manager Assigned',
        description: `${managerName} has been assigned to this request.`
      });

      setShowDetailModal(false);
      setManagerName('');
      fetchRequests();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to assign manager',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: {
          action: 'update_status',
          request_id: selectedRequest.id,
          status: newStatus,
          manager_notes: managerNotes
        }
      });

      if (error) throw error;

      toast({
        title: 'Status Updated',
        description: `Request status changed to ${newStatus}`
      });

      setShowDetailModal(false);
      setManagerNotes('');
      fetchRequests();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update status',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: {
          action: 'approve_request',
          request_id: selectedRequest.id,
          negotiated_price: negotiatedPrice ? parseFloat(negotiatedPrice) : undefined,
          negotiated_terms: negotiatedTerms,
          manager_notes: managerNotes,
          approved_by: 'Staff'
        }
      });

      if (error) throw error;

      toast({
        title: 'Request Approved!',
        description: 'Investor has been notified via email and has 24 hours first right of refusal.'
      });

      setShowApproveModal(false);
      setNegotiatedPrice('');
      setNegotiatedTerms('');
      setManagerNotes('');
      fetchRequests();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to approve request',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };


  const handleDecline = async () => {
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: {
          action: 'decline_request',
          request_id: selectedRequest.id,
          decline_reason: declineReason
        }
      });

      if (error) throw error;

      toast({
        title: 'Request Declined',
        description: 'The investor will be notified.'
      });

      setShowDeclineModal(false);
      setDeclineReason('');
      fetchRequests();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to decline request',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (request: AcquisitionRequest) => {
    if (request.is_approved) {
      if (request.first_refusal_accepted === true) {
        return <Badge className="bg-green-600">Accepted by Investor</Badge>;
      }
      if (request.first_refusal_accepted === false) {
        return <Badge className="bg-yellow-500">Declined - Available</Badge>;
      }
      return <Badge className="bg-green-500">Approved - Awaiting Response</Badge>;
    }
    switch (request.status) {
      case 'pending':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'assigned':
        return <Badge className="bg-blue-500">Manager Assigned</Badge>;
      case 'researching':
        return <Badge className="bg-purple-500">Researching</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      case 'converted':
        return <Badge className="bg-emerald-600">Converted to Listing</Badge>;
      default:
        return <Badge variant="outline">{request.status}</Badge>;
    }
  };

  const getPropertyTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      str: 'Short-Term Rental',
      coliving: 'Co-Living',
      townhome: 'Townhome',
      apartment: 'Apartment',
      sfh: 'Single-Family',
      highrise: 'High-Rise'
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#d4a574]" />
            Penny AI Acquisition Requests
          </h2>
          <p className="text-gray-500">Review and process property requests from investors</p>
        </div>
        <Button onClick={fetchRequests} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition" onClick={() => setStatusFilter('all')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition ${statusFilter === 'pending' ? 'ring-2 ring-[#d4a574]' : ''}`} onClick={() => setStatusFilter('pending')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{counts.pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition ${statusFilter === 'assigned' ? 'ring-2 ring-[#d4a574]' : ''}`} onClick={() => setStatusFilter('assigned')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{counts.assigned}</p>
            <p className="text-sm text-gray-500">Assigned</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition ${statusFilter === 'researching' ? 'ring-2 ring-[#d4a574]' : ''}`} onClick={() => setStatusFilter('researching')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{counts.researching}</p>
            <p className="text-sm text-gray-500">Researching</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition ${statusFilter === 'approved' ? 'ring-2 ring-[#d4a574]' : ''}`} onClick={() => setStatusFilter('approved')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{counts.approved}</p>
            <p className="text-sm text-gray-500">Approved</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:shadow-md transition ${statusFilter === 'declined' ? 'ring-2 ring-[#d4a574]' : ''}`} onClick={() => setStatusFilter('declined')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{counts.declined}</p>
            <p className="text-sm text-gray-500">Declined</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No Acquisition Requests</h3>
            <p className="text-gray-500 mt-2">
              {statusFilter !== 'all' 
                ? `No requests with status "${statusFilter}"`
                : 'Investors will submit requests through Penny AI property search'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map(request => (
            <Card key={request.id} className="hover:shadow-md transition">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <MapPin className="w-5 h-5 text-[#d4a574]" />
                      <h3 className="font-semibold text-lg text-gray-900">
                        {request.city}, {request.state} {request.zip_code}
                      </h3>
                      {getStatusBadge(request)}
                    </div>

                    <div className="grid md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Property Type:</span>
                        <span className="font-medium ml-1">{getPropertyTypeLabel(request.property_type)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Beds/Baths:</span>
                        <span className="font-medium ml-1">{request.bedrooms || '-'} / {request.bathrooms || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Listed Price:</span>
                        <span className="font-medium ml-1">${request.listed_price?.toLocaleString()}/mo</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Projected Revenue:</span>
                        <span className="font-medium text-green-600 ml-1">${request.projected_monthly_revenue?.toLocaleString()}/mo</span>
                      </div>
                    </div>

                    {request.investor && (
                      <div className="flex items-center gap-4 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {request.investor.full_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {request.investor.email}
                        </span>
                        {request.investor.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {request.investor.phone}
                          </span>
                        )}
                      </div>
                    )}

                    {request.assigned_manager_name && (
                      <p className="text-sm text-blue-600 mt-2">
                        Assigned to: <strong>{request.assigned_manager_name}</strong>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowDetailModal(true);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                    {!request.is_approved && request.status !== 'declined' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowApproveModal(true);
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowDeclineModal(true);
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Decline
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  Submitted {new Date(request.created_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Acquisition Request Details</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Location & Property Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#d4a574]" />
                  {selectedRequest.city}, {selectedRequest.state} {selectedRequest.zip_code}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Property Type:</span>
                    <span className="font-medium ml-1">{getPropertyTypeLabel(selectedRequest.property_type)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Furnishing:</span>
                    <span className="font-medium ml-1 capitalize">{selectedRequest.furnishing_status}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bedrooms:</span>
                    <span className="font-medium ml-1">{selectedRequest.bedrooms || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bathrooms:</span>
                    <span className="font-medium ml-1">{selectedRequest.bathrooms || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Financial Projections */}
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  AI Projections (Unverified)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Listed Rent:</span>
                    <span className="font-bold text-gray-900 ml-1">${selectedRequest.listed_price?.toLocaleString()}/mo</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Projected Revenue:</span>
                    <span className="font-bold text-green-700 ml-1">${selectedRequest.projected_monthly_revenue?.toLocaleString()}/mo</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Est. ADR:</span>
                    <span className="font-medium ml-1">${selectedRequest.projected_adr?.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Est. Occupancy:</span>
                    <span className="font-medium ml-1">{selectedRequest.projected_occupancy_rate?.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Investor Info */}
              {selectedRequest.investor && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Requesting Investor
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Name:</strong> {selectedRequest.investor.full_name}</p>
                    <p><strong>Email:</strong> {selectedRequest.investor.email}</p>
                    {selectedRequest.investor.phone && (
                      <p><strong>Phone:</strong> {selectedRequest.investor.phone}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Source URL */}
              {selectedRequest.source_url && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Source URL:</label>
                  <a 
                    href={selectedRequest.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm block truncate"
                  >
                    {selectedRequest.source_url}
                  </a>
                </div>
              )}

              {/* Assign Manager */}
              {!selectedRequest.assigned_manager_name && selectedRequest.status === 'pending' && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Assign Acquisition Manager
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Manager name..."
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                    />
                    <Button
                      onClick={handleAssignManager}
                      disabled={!managerName.trim() || submitting}
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Update Status */}
              {selectedRequest.assigned_manager_name && !selectedRequest.is_approved && selectedRequest.status !== 'declined' && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Update Status
                  </label>
                  <div className="flex gap-2 mb-3">
                    <Button
                      size="sm"
                      variant={selectedRequest.status === 'researching' ? 'default' : 'outline'}
                      onClick={() => handleUpdateStatus('researching')}
                      disabled={submitting}
                    >
                      Researching
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Add notes about your research..."
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {/* Manager Notes */}
              {selectedRequest.manager_notes && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">Manager Notes</h4>
                  <p className="text-sm text-yellow-700">{selectedRequest.manager_notes}</p>
                </div>
              )}

              {/* Decline Reason */}
              {selectedRequest.decline_reason && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">Decline Reason</h4>
                  <p className="text-sm text-red-700">{selectedRequest.decline_reason}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Approve Acquisition Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Approving this request will give the investor 24-hour first right of refusal.
            </p>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Negotiated Monthly Rent (optional)
              </label>
              <Input
                type="number"
                placeholder="e.g., 1800"
                value={negotiatedPrice}
                onChange={(e) => setNegotiatedPrice(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Negotiated Terms (optional)
              </label>
              <Textarea
                placeholder="e.g., 12-month lease, pets allowed, subletting permitted..."
                value={negotiatedTerms}
                onChange={(e) => setNegotiatedTerms(e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Notes for Investor
              </label>
              <Textarea
                placeholder="Notes that will be visible to the investor..."
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveModal(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Approve & Notify Investor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Modal */}
      <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              Decline Acquisition Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Please provide a reason for declining this request. This will be shared with the investor.
            </p>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Decline Reason
              </label>
              <Textarea
                placeholder="e.g., Property does not meet our criteria for a viable arbitrage opportunity..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={submitting || !declineReason.trim()}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Decline Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AcquisitionRequestsTab;
