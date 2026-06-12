import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, RefreshCw, Search, CheckCircle, XCircle, Clock,
  Building, Users, FileText, HeadphonesIcon, AlertCircle,
  Mail, ChevronDown, ChevronUp, Inbox, Filter,
  Briefcase, MapPin, DollarSign, Calendar, User, Edit, Save,
  ArrowRight, Circle
} from 'lucide-react';

interface SuccessTeamRequestCenterProps {
  staffId: string;
  staffName: string;
}

interface RequestItem {
  id: string;
  request_type: string;
  investor_name: string;
  investor_email: string;
  investor_id?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  status?: string;
  created_at: string;
  notes?: string;
  monthly_rent?: number;
  acquisition_fee?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_type?: string;
  submission_timeline?: string;
  [key: string]: any;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  portfolio_approval: { label: 'Portfolio Approval', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Building },
  acquisition_request: { label: 'Acquisition Request', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Briefcase },
  deal_inquiry: { label: 'Deal Inquiry', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Mail },
  support_request: { label: 'Support Request', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: HeadphonesIcon },
};

const URGENCY = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  low: 'bg-green-100 text-green-700 border-green-300',
};

function getUrgency(dateStr: string): 'critical' | 'high' | 'medium' | 'low' {
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (hours > 72) return 'critical';
  if (hours > 48) return 'high';
  if (hours > 24) return 'medium';
  return 'low';
}

function formatDate(d: string) {
  if (!d) return 'N/A';
  const hours = (Date.now() - new Date(d).getTime()) / 3600000;
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

// Status Timeline Component
function StatusTimeline({ timeline, status }: { timeline: any[]; status?: string }) {
  const stages = [
    { key: 'submitted', label: 'Submitted', color: 'bg-blue-500' },
    { key: 'review', label: 'Under Review', color: 'bg-yellow-500' },
    { key: 'edited', label: 'Details Edited', color: 'bg-purple-500' },
    { key: 'approved', label: 'Approved', color: 'bg-green-500' },
    { key: 'rejected', label: 'Rejected', color: 'bg-red-500' },
  ];

  const timelineStages = new Set(timeline.map(t => t.stage));
  const currentStatus = status === 'active' ? 'approved' : status === 'rejected' ? 'rejected' : 'submitted';

  return (
    <div className="flex items-center gap-1 py-2 overflow-x-auto">
      {stages.filter(s => s.key !== 'rejected' || timelineStages.has('rejected') || currentStatus === 'rejected')
        .filter(s => s.key !== 'edited' || timelineStages.has('edited'))
        .map((stage, idx, arr) => {
          const entry = timeline.find(t => t.stage === stage.key);
          const isActive = timelineStages.has(stage.key);
          const isCurrent = stage.key === currentStatus;

          return (
            <div key={stage.key} className="flex items-center gap-1 shrink-0">
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isActive ? stage.color + ' text-white' : 'bg-gray-200 text-gray-400'
                } ${isCurrent ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                  {isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                </div>
                <span className={`text-[10px] mt-0.5 whitespace-nowrap ${isActive ? 'font-medium text-gray-700' : 'text-gray-400'}`}>
                  {stage.label}
                </span>
                {entry && (
                  <span className="text-[9px] text-gray-400">{new Date(entry.date).toLocaleDateString()}</span>
                )}
              </div>
              {idx < arr.length - 1 && (
                <div className={`w-6 h-0.5 mt-[-14px] ${isActive ? 'bg-gray-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
    </div>
  );
}

export function SuccessTeamRequestCenter({ staffId, staffName }: SuccessTeamRequestCenterProps) {
  const [loading, setLoading] = useState(true);
  const [allRequests, setAllRequests] = useState<RequestItem[]>([]);
  const [stats, setStats] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Inline editing state
  const [editingRequest, setEditingRequest] = useState<RequestItem | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);

  // Approve/Reject with notes
  const [actionModal, setActionModal] = useState<{ request: RequestItem; action: 'approve' | 'reject' } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { toast } = useToast();

  const fetchAllRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: { action: 'get_all_pending_requests' }
      });
      if (error) throw error;

      const combined: RequestItem[] = [];
      (data?.portfolio_approvals || []).forEach((p: any) => combined.push({ ...p, request_type: 'portfolio_approval' }));
      (data?.acquisition_requests || []).forEach((a: any) => combined.push({ ...a, request_type: 'acquisition_request', address: a.property_address || a.address || 'N/A' }));
      (data?.deal_inquiries || []).forEach((i: any) => combined.push({ ...i, request_type: 'deal_inquiry', investor_name: i.name || i.investor_name || 'Unknown', investor_email: i.email || i.investor_email || '', address: i.property_address || 'N/A' }));
      (data?.support_requests || []).forEach((s: any) => combined.push({ ...s, request_type: 'support_request', investor_name: s.user_name || s.name || 'Unknown', investor_email: s.user_email || s.email || '', address: s.subject || 'Support Request' }));

      setAllRequests(combined);
      setStats(data?.stats || {});
    } catch (err: any) {
      console.error('Error fetching requests:', err);
      toast({ title: 'Error', description: 'Failed to load requests.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAllRequests(); }, [fetchAllRequests]);

  const filtered = useMemo(() => {
    let result = [...allRequests];
    if (filterType !== 'all') result = result.filter(r => r.request_type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.investor_name?.toLowerCase().includes(q) || r.investor_email?.toLowerCase().includes(q) ||
        r.address?.toLowerCase().includes(q) || r.city?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'investor') return (a.investor_name || '').localeCompare(b.investor_name || '');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return result;
  }, [allRequests, filterType, searchQuery, sortBy]);

  // Open inline editor
  const openEditor = (request: RequestItem) => {
    setEditingRequest(request);
    setEditForm({
      address: request.address || '',
      city: request.city || '',
      state: request.state || '',
      zip_code: request.zip_code || '',
      bedrooms: request.bedrooms || 0,
      bathrooms: request.bathrooms || 0,
      monthly_rent: request.monthly_rent || 0,
      acquisition_fee: request.acquisition_fee || 0,
      property_type: request.property_type || 'single_family',
      notes: request.notes || '',
    });
  };

  // Save inline edits
  const saveEdits = async () => {
    if (!editingRequest) return;
    setEditSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: {
          action: 'update_property_details',
          property_id: editingRequest.id,
          updates: editForm,
          staff_name: staffName
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Property Updated', description: 'Details have been saved.' });
      setEditingRequest(null);
      fetchAllRequests();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setEditSaving(false);
  };

  // Approve/Reject with notes and email
  const handleAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    const { request, action } = actionModal;
    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio-approvals', {
        body: {
          action: action === 'approve' ? 'approve_property' : 'reject_property',
          property_id: request.id,
          staff_name: staffName,
          admin_notes: actionNotes || (action === 'approve' ? 'Approved via Request Center' : 'Rejected - needs more information'),
          rejection_reason: action === 'reject' ? (actionNotes || 'Needs more information') : undefined,
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: action === 'approve' ? 'Property Approved' : 'Property Rejected',
        description: `${request.address} has been ${action === 'approve' ? 'approved' : 'rejected'}. ${data?.email_sent ? 'Confirmation email sent to investor.' : ''}`
      });
      setActionModal(null);
      setActionNotes('');
      fetchAllRequests();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setActionLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <Inbox className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl text-amber-900">Success Team Request Center</CardTitle>
              <CardDescription className="text-amber-700">
                All pending requests — portfolio approvals, acquisitions, inquiries, and support
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAllRequests} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Portfolio', count: stats.portfolio_pending || 0, color: 'amber', icon: Building },
          { label: 'Acquisitions', count: stats.acquisitions_pending || 0, color: 'blue', icon: Briefcase },
          { label: 'Inquiries', count: stats.inquiries_pending || 0, color: 'purple', icon: Mail },
          { label: 'Support', count: stats.support_open || 0, color: 'red', icon: HeadphonesIcon },
          { label: 'Total', count: stats.total_pending || 0, color: 'gray', icon: AlertCircle },
        ].map(s => (
          <Card key={s.label} className={`border-${s.color}-200`}>
            <CardContent className="pt-3 pb-2 px-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 bg-${s.color}-100 rounded-lg flex items-center justify-center`}>
                  <s.icon className={`w-4 h-4 text-${s.color}-600`} />
                </div>
                <div>
                  <div className={`text-xl font-bold text-${s.color}-700`}>{s.count}</div>
                  <div className="text-[10px] text-gray-500">{s.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search investor, address, city..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]"><Filter className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="portfolio_approval">Portfolio</SelectItem>
                <SelectItem value="acquisition_request">Acquisitions</SelectItem>
                <SelectItem value="deal_inquiry">Inquiries</SelectItem>
                <SelectItem value="support_request">Support</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="investor">Investor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Request List */}
      {loading ? (
        <div className="flex flex-col items-center py-16">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
          <p className="text-gray-500">Loading requests...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
            <p className="text-gray-500">No pending requests. Great work!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 px-1">{filtered.length} pending request{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.map((request) => {
            const config = TYPE_CONFIG[request.request_type] || TYPE_CONFIG.support_request;
            const Icon = config.icon;
            const isExpanded = expandedId === request.id;
            const urgency = getUrgency(request.created_at);
            const isProcessing = processingId === request.id;
            let timeline: any[] = [];
            try { timeline = JSON.parse(request.submission_timeline || '[]'); } catch {}

            return (
              <Card key={`${request.request_type}-${request.id}`} className={`border ${config.bg} transition-all hover:shadow-md`}>
                <CardContent className="p-3">
                  {/* Main Row */}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${config.color} border-current`}>{config.label}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${URGENCY[urgency]}`}>
                          {urgency === 'critical' ? 'URGENT' : urgency === 'high' ? 'High' : urgency === 'medium' ? 'Medium' : 'New'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-sm text-gray-900 truncate">{request.investor_name}</span>
                        {request.investor_email && <span className="text-[10px] text-gray-400 truncate hidden sm:inline">({request.investor_email})</span>}
                      </div>
                      {request.address && request.address !== 'N/A' && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{request.address}{request.city ? `, ${request.city}` : ''}{request.state ? `, ${request.state}` : ''}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{formatDate(request.created_at)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {request.request_type === 'portfolio_approval' && (
                        <>
                          <Button size="sm" onClick={() => { setActionModal({ request, action: 'approve' }); setActionNotes(''); }}
                            disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setActionModal({ request, action: 'reject' }); setActionNotes(''); }}
                            disabled={isProcessing} className="border-red-300 text-red-600 hover:bg-red-50 h-8 text-xs">
                            <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditor(request)}
                            className="border-indigo-300 text-indigo-600 hover:bg-indigo-50 h-8 text-xs">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {request.request_type === 'deal_inquiry' && (
                        <Button size="sm" variant="outline" onClick={() => window.open(`mailto:${request.investor_email}`, '_blank')} className="h-8 text-xs">
                          <Mail className="w-3.5 h-3.5 mr-1" />Reply
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : request.id)} className="h-8 w-8 p-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                      {/* Timeline */}
                      {timeline.length > 0 && (
                        <div className="bg-white rounded-lg border p-2">
                          <p className="text-[10px] font-medium text-gray-500 mb-1">STATUS TIMELINE</p>
                          <StatusTimeline timeline={timeline} status={request.property_status || request.status} />
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {request.monthly_rent != null && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Rent:</span>
                            <span className="font-medium">${Number(request.monthly_rent).toLocaleString()}</span>
                          </div>
                        )}
                        {request.acquisition_fee != null && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Fee:</span>
                            <span className="font-medium">${Number(request.acquisition_fee).toLocaleString()}</span>
                          </div>
                        )}
                        {request.bedrooms != null && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Beds/Baths:</span>
                            <span className="font-medium">{request.bedrooms}/{request.bathrooms || 0}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-500">Submitted:</span>
                          <span className="font-medium">{new Date(request.created_at).toLocaleString()}</span>
                        </div>
                        {request.investor_email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <a href={`mailto:${request.investor_email}`} className="text-blue-600 hover:underline text-sm">{request.investor_email}</a>
                          </div>
                        )}
                      </div>

                      {(request.notes || request.message || request.description) && (
                        <div className="p-2 bg-white rounded-lg border text-sm text-gray-700">
                          {request.notes || request.message || request.description}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {request.investor_email && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => window.open(`mailto:${request.investor_email}`, '_blank')}>
                            <Mail className="w-3 h-3 mr-1" />Email Investor
                          </Button>
                        )}
                        {request.request_type === 'portfolio_approval' && (
                          <Button size="sm" variant="outline" className="text-xs text-indigo-600 border-indigo-200" onClick={() => openEditor(request)}>
                            <Edit className="w-3 h-3 mr-1" />Edit Details Before Approving
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inline Edit Modal */}
      <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5 text-indigo-600" />Edit Property Details</DialogTitle>
            <DialogDescription>Modify details before approving. Changes are saved immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Address</Label>
              <Input value={editForm.address || ''} onChange={(e) => setEditForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">City</Label><Input value={editForm.city || ''} onChange={(e) => setEditForm(p => ({ ...p, city: e.target.value }))} /></div>
              <div><Label className="text-xs">State</Label><Input value={editForm.state || ''} onChange={(e) => setEditForm(p => ({ ...p, state: e.target.value }))} /></div>
              <div><Label className="text-xs">ZIP</Label><Input value={editForm.zip_code || ''} onChange={(e) => setEditForm(p => ({ ...p, zip_code: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Bedrooms</Label><Input type="number" value={editForm.bedrooms || 0} onChange={(e) => setEditForm(p => ({ ...p, bedrooms: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Bathrooms</Label><Input type="number" step="0.5" value={editForm.bathrooms || 0} onChange={(e) => setEditForm(p => ({ ...p, bathrooms: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Monthly Rent ($)</Label><Input type="number" value={editForm.monthly_rent || 0} onChange={(e) => setEditForm(p => ({ ...p, monthly_rent: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Acquisition Fee ($)</Label><Input type="number" value={editForm.acquisition_fee || 0} onChange={(e) => setEditForm(p => ({ ...p, acquisition_fee: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={editForm.notes || ''} onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRequest(null)}>Cancel</Button>
            <Button onClick={saveEdits} disabled={editSaving} className="bg-indigo-600 hover:bg-indigo-700">
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Modal */}
      <Dialog open={!!actionModal} onOpenChange={(open) => !open && setActionModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionModal?.action === 'approve' ? (
                <><CheckCircle className="w-5 h-5 text-emerald-600" />Approve Property</>
              ) : (
                <><XCircle className="w-5 h-5 text-red-600" />Reject Property</>
              )}
            </DialogTitle>
            <DialogDescription>
              {actionModal?.action === 'approve'
                ? 'Approve this property and send a confirmation email to the investor.'
                : 'Reject this property and notify the investor with your feedback.'}
            </DialogDescription>
          </DialogHeader>
          {actionModal && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg border text-sm">
                <p className="font-medium">{actionModal.request.address}</p>
                <p className="text-gray-500">{actionModal.request.investor_name} - {actionModal.request.investor_email}</p>
              </div>
              <div>
                <Label className="text-sm">{actionModal.action === 'approve' ? 'Notes (optional)' : 'Reason for rejection'}</Label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={actionModal.action === 'approve' ? 'Any notes for the investor...' : 'Please explain what needs to be changed...'}
                  rows={3}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <Mail className="w-4 h-4 inline mr-1" />
                A confirmation email will be sent to <strong>{actionModal.request.investor_email}</strong>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading || (actionModal?.action === 'reject' && !actionNotes.trim())}
              className={actionModal?.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> :
                actionModal?.action === 'approve' ? <CheckCircle className="w-4 h-4 mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
              {actionModal?.action === 'approve' ? 'Approve & Notify' : 'Reject & Notify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
