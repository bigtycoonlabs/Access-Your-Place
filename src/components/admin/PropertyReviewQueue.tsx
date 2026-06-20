import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Building, MapPin, Image, Clock, CheckCircle, XCircle, Search,
  RefreshCw, ChevronDown, ChevronUp, AlertCircle, ArrowUpDown,
  Home, Eye, ExternalLink, Hash, FileText, Calendar, User, Loader2
} from 'lucide-react';

interface LandlordProperty {
  id: string;
  landlord_id: string;
  landlord_name?: string;
  landlord_email?: string;
  community_name?: string;
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  unit_count?: number;
  property_type?: string;
  website?: string;
  notes?: string;
  photo_urls?: string[];
  submission_status: string;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

interface Props {
  staffId?: string;
  staffName?: string;
}

export function PropertyReviewQueue({ staffId, staffName }: Props) {
  const [properties, setProperties] = useState<LandlordProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending_analysis');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);
  const [creatingDeal, setCreatingDeal] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchProperties(); }, [statusFilter]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'get_landlord_properties_for_review',
          status_filter: statusFilter
        }
      });
      if (data?.properties) {
        setProperties(data.properties);
      } else if (error) {
        console.error('Error fetching properties:', error);
      }
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  };

  const handleApprove = async (property: LandlordProperty) => {
    setReviewingId(property.id);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'review_property',
          property_id: property.id,
          submission_status: 'approved',
          reviewed_by: staffName || 'Staff'
        }
      });
      if (data?.success) {
        toast({ title: 'Property Approved', description: `${property.community_name || property.address} approved for marketplace.` });
        // Optionally create a deal flow entry
        setCreatingDeal(property.id);
        try {
          await supabase.functions.invoke('manage-landlord-portal', {
            body: {
              action: 'create_deal_from_property',
              property_id: property.id,
              landlord_id: property.landlord_id,
              address: property.address,
              city: property.city,
              state: property.state,
              zip_code: property.zip_code,
              community_name: property.community_name,
              unit_count: property.unit_count,
              created_by: staffName || 'Staff',
              created_by_id: staffId
            }
          });
        } catch (dealErr) {
          // Non-critical - property still approved
          console.log('Deal creation optional:', dealErr);
        }
        setCreatingDeal(null);
        fetchProperties();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to approve property', variant: 'destructive' });
    }
    setReviewingId(null);
  };

  const handleReject = async (propertyId: string) => {
    if (!rejectReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a rejection reason', variant: 'destructive' });
      return;
    }
    setReviewingId(propertyId);
    try {
      const { data } = await supabase.functions.invoke('manage-landlord-portal', {
        body: {
          action: 'review_property',
          property_id: propertyId,
          submission_status: 'rejected',
          rejection_reason: rejectReason,
          reviewed_by: staffName || 'Staff'
        }
      });
      if (data?.success) {
        toast({ title: 'Property Rejected', description: 'Landlord will be notified.' });
        setShowRejectForm(null);
        setRejectReason('');
        fetchProperties();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to reject property', variant: 'destructive' });
    }
    setReviewingId(null);
  };

  const sorted = [...properties].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const filtered = sorted.filter(p =>
    p.address?.toLowerCase().includes(search.toLowerCase()) ||
    p.community_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.landlord_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.city?.toLowerCase().includes(search.toLowerCase()) ||
    p.state?.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = {
    pending_analysis: properties.filter(p => p.submission_status === 'pending_analysis').length,
    under_review: properties.filter(p => p.submission_status === 'under_review').length,
    approved: properties.filter(p => p.submission_status === 'approved').length,
    rejected: properties.filter(p => p.submission_status === 'rejected').length,
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
      pending_analysis: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Analysis', icon: <Clock className="w-3.5 h-3.5" /> },
      under_review: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Under Review', icon: <Eye className="w-3.5 h-3.5" /> },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: <XCircle className="w-3.5 h-3.5" /> },
    };
    const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status, icon: <Clock className="w-3.5 h-3.5" /> };
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        {c.icon} {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#1a365d]">Property Review Queue</h3>
          <p className="text-sm text-gray-500">Review landlord-submitted properties for marketplace eligibility</p>
        </div>
        <button
          onClick={fetchProperties}
          className="text-sm text-gray-500 hover:text-[#d4a574] flex items-center gap-1 self-start"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Status Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'pending_analysis', label: 'Pending Analysis', count: statusCounts.pending_analysis, icon: <Clock className="w-4 h-4 text-yellow-500" />, border: 'border-yellow-200', bg: 'bg-yellow-50' },
          { key: 'under_review', label: 'Under Review', count: statusCounts.under_review, icon: <Eye className="w-4 h-4 text-blue-500" />, border: 'border-blue-200', bg: 'bg-blue-50' },
          { key: 'approved', label: 'Approved', count: statusCounts.approved, icon: <CheckCircle className="w-4 h-4 text-green-500" />, border: 'border-green-200', bg: 'bg-green-50' },
          { key: 'rejected', label: 'Rejected', count: statusCounts.rejected, icon: <XCircle className="w-4 h-4 text-red-500" />, border: 'border-red-200', bg: 'bg-red-50' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`p-4 rounded-xl border text-left transition-all ${
              statusFilter === s.key ? `${s.bg} ${s.border} ring-2 ring-[#d4a574]/50` : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {s.icon}
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-[#1a365d]">{s.count}</div>
          </button>
        ))}
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by address, community, landlord, city..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#d4a574] focus:border-transparent text-sm"
          />
        </div>
        <button
          onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 whitespace-nowrap"
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
        </button>
      </div>

      {/* Property List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Properties Found</h3>
          <p className="text-gray-400">
            {statusFilter === 'pending_analysis'
              ? 'No properties are pending analysis at this time.'
              : `No properties with status "${statusFilter.replace('_', ' ')}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(property => (
            <div key={property.id} className="bg-white rounded-xl border border-gray-200 hover:border-[#d4a574]/30 transition-all overflow-hidden">
              {/* Property Row */}
              <div
                className="p-5 cursor-pointer flex items-start md:items-center justify-between gap-4"
                onClick={() => setExpandedId(expandedId === property.id ? null : property.id)}
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {property.photo_urls && property.photo_urls.length > 0 ? (
                      <img src={property.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Home className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {property.community_name && (
                      <p className="text-xs font-semibold text-[#d4a574] uppercase tracking-wide mb-0.5">{property.community_name}</p>
                    )}
                    <h3 className="font-semibold text-[#1a365d] truncate">{property.address}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
                      {property.city && property.state && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{property.city}, {property.state}</span>
                      )}
                      {property.unit_count && (
                        <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{property.unit_count} units</span>
                      )}
                      {property.landlord_name && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{property.landlord_name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {getStatusBadge(property.submission_status)}
                  <span className="text-xs text-gray-400 hidden sm:inline">
                    {new Date(property.created_at).toLocaleDateString()}
                  </span>
                  {expandedId === property.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === property.id && (
                <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Property Details */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Property Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Address:</span>
                          <span className="font-medium text-right">{property.address}</span>
                        </div>
                        {property.community_name && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Community:</span>
                            <span className="font-medium">{property.community_name}</span>
                          </div>
                        )}
                        {property.city && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">City:</span>
                            <span className="font-medium">{property.city}, {property.state} {property.zip_code}</span>
                          </div>
                        )}
                        {property.unit_count && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Unit Count:</span>
                            <span className="font-medium">{property.unit_count}</span>
                          </div>
                        )}
                        {property.property_type && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Type:</span>
                            <span className="font-medium capitalize">{property.property_type.replace('_', ' ')}</span>
                          </div>
                        )}
                        {property.website && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Website:</span>
                            <a href={property.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline flex items-center gap-1">
                              Visit <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-500">Submitted:</span>
                          <span className="font-medium">{new Date(property.created_at).toLocaleString()}</span>
                        </div>
                        {property.landlord_name && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Landlord:</span>
                            <span className="font-medium">{property.landlord_name}</span>
                          </div>
                        )}
                        {property.landlord_email && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Email:</span>
                            <span className="font-medium">{property.landlord_email}</span>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {property.notes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800"><strong>Landlord Notes:</strong> {property.notes}</p>
                        </div>
                      )}

                      {/* Rejection Reason */}
                      {property.rejection_reason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-800"><strong>Rejection Reason:</strong> {property.rejection_reason}</p>
                          {property.reviewed_by && (
                            <p className="text-xs text-red-600 mt-1">Reviewed by {property.reviewed_by} on {property.reviewed_at ? new Date(property.reviewed_at).toLocaleDateString() : 'N/A'}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Photos & Actions */}
                    <div className="space-y-4">
                      {/* Photos */}
                      {property.photo_urls && property.photo_urls.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Photos ({property.photo_urls.length})</h4>
                          <div className="grid grid-cols-3 gap-2">
                            {property.photo_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity">
                                <img src={url} alt={`Property photo ${i + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Review Actions */}
                      {(property.submission_status === 'pending_analysis' || property.submission_status === 'under_review') && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Review Actions</h4>
                          <div className="space-y-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprove(property); }}
                              disabled={reviewingId === property.id}
                              className="w-full bg-green-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {reviewingId === property.id && creatingDeal === property.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Creating Deal Entry...</>
                              ) : reviewingId === property.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Approving...</>
                              ) : (
                                <><CheckCircle className="w-4 h-4" /> Approve for Marketplace</>
                              )}
                            </button>

                            {showRejectForm === property.id ? (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                                <label className="block text-xs font-medium text-red-700">Rejection Reason *</label>
                                <textarea
                                  value={rejectReason}
                                  onChange={e => setRejectReason(e.target.value)}
                                  placeholder="Property does not meet current acquisition criteria because..."
                                  className="w-full px-3 py-2 rounded-lg border border-red-300 text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleReject(property.id); }}
                                    disabled={reviewingId === property.id}
                                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                    {reviewingId === property.id ? (
                                      <><Loader2 className="w-4 h-4 animate-spin" /> Rejecting...</>
                                    ) : (
                                      <><XCircle className="w-4 h-4" /> Confirm Rejection</>
                                    )}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setShowRejectForm(null); setRejectReason(''); }}
                                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowRejectForm(property.id); }}
                                className="w-full border border-red-300 text-red-600 px-4 py-3 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                              >
                                <XCircle className="w-4 h-4" /> Reject (Does Not Fit Standard)
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Already reviewed */}
                      {property.submission_status === 'approved' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-semibold text-green-800">Approved for Marketplace</span>
                          </div>
                          {property.reviewed_by && (
                            <p className="text-sm text-green-600">
                              Reviewed by {property.reviewed_by} on {property.reviewed_at ? new Date(property.reviewed_at).toLocaleDateString() : 'N/A'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
