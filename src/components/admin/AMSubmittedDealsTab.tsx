import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2, CheckCircle, XCircle, Clock, Building2, MapPin,
  DollarSign, Eye, RefreshCw, AlertTriangle, FileText,
  User, ExternalLink, Home, Send, Edit2, Save, Flag,
  Download, Maximize2, Image as ImageIcon, Shield, ShieldCheck,
  EyeOff, Lock, Unlock, Store, UserCheck, Users, Bug, ChevronDown, ChevronUp, UserPlus,
  History, ArrowRight, Zap, UserCog
} from 'lucide-react';

import { PhotoLightbox } from '@/components/investor/PhotoLightbox';



interface SubmittedDeal {
  id: string;
  title: string;
  address: string;
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
  photos?: string[];
  landlord_name?: string;
  landlord_email?: string;
  landlord_phone?: string;
  listing_url?: string;
  listing_description?: string;
  internal_notes?: string;
  community_name?: string;
  deal_status: string;
  source?: string;
  submitted_by_type?: string;
  submitted_by_client_name?: string;
  submitted_by_client_email?: string;
  added_by_staff_id?: string;
  added_by_staff_name?: string;
  found_by_am_id?: string;
  found_by_am_name?: string;
  approved_by_staff_name?: string;
  approved_at?: string;
  denial_reason?: string;
  is_third_party_seller?: boolean;
  visibility_settings?: {
    show_address: boolean;
    show_community_name: boolean;
    show_landlord_contact: boolean;
    show_full_photos: boolean;
    show_financials: boolean;
  };
  created_at: string;
  updated_at?: string;
}


interface SellerDeal {
  id: string;
  acquisition_fee: number;
  monthly_revenue: number;
  description: string;
  status: string;
  created_at: string;
  operation_type?: string;
  seller?: { full_name: string; email: string; phone?: string };
  property?: { address: string; city: string; state: string; bedrooms: number; bathrooms: number };
}

interface Props {
  staffId: string;
  staffName: string;
  isSuccessManager: boolean;
}

const DEFAULT_VISIBILITY = {
  show_address: false,
  show_community_name: false,
  show_landlord_contact: false,
  show_full_photos: true,
  show_financials: true
};

export function AMSubmittedDealsTab({ staffId, staffName, isSuccessManager }: Props) {
  const [deals, setDeals] = useState<SubmittedDeal[]>([]);
  const [sellerDeals, setSellerDeals] = useState<SellerDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'am_submitted' | 'am_approved' | 'am_denied'>('all');
  const [pipelineTab, setPipelineTab] = useState<'am' | 'seller'>('am');
  const [reviewDeal, setReviewDeal] = useState<SubmittedDeal | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, denied: 0, seller_pending: 0 });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    price: 0, monthly_rent: 0, bedrooms: 0, bathrooms: 0,
    sqft: 0, operation_type: '', property_type: '', internal_notes: '',
  });

  // Visibility settings modal
  const [visibilityDeal, setVisibilityDeal] = useState<SubmittedDeal | null>(null);
  const [visSettings, setVisSettings] = useState(DEFAULT_VISIBILITY);
  const [savingVisibility, setSavingVisibility] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [flaggedPhotos, setFlaggedPhotos] = useState<Set<string>>(new Set());
  
  // Debug panel state
  const [showDebug, setShowDebug] = useState(false);
  
  // AM assignment state (Success Team only)
  const [amList, setAmList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [assigningAm, setAssigningAm] = useState(false);
  const [selectedAmId, setSelectedAmId] = useState('');

  // Activity log state (Success Team only)
  interface ActivityLogEntry {
    id: string;
    property_id: string;
    activity_type: string;
    activity_description: string;
    performer_name?: string;
    performed_by?: string;
    new_value?: string;
    previous_value?: string;
    created_at: string;
  }
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);


  const { toast } = useToast();

  // Read staff session for debug info
  const staffSession = (() => {
    try { return JSON.parse(localStorage.getItem('staffSession') || '{}'); } catch { return {}; }
  })();

  useEffect(() => { fetchDeals(); }, [filter]);

  // Load AM list for assignment dropdown (Success Team only)
  useEffect(() => {
    if (isSuccessManager) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('am-submit-deal', {
            body: { action: 'get_acquisition_managers' }
          });
          if (error) throw error;
          if (data?.managers) setAmList(data.managers);
        } catch (err: any) {
          console.error('Failed to load AM list:', err.message);
        }
      })();
    }
  }, [isSuccessManager]);


  // Handle AM assignment to a deal (Success Team only)
  const handleAssignAm = async (dealId: string) => {
    if (!isSuccessManager) return;
    if (!selectedAmId) { toast({ title: 'Select an AM first', variant: 'destructive' }); return; }
    setAssigningAm(true);
    try {
      const am = amList.find(a => a.id === selectedAmId);
      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: { action: 'assign_am_to_deal', property_id: dealId, am_staff_id: selectedAmId, am_staff_name: am?.name || 'Unknown', assigned_by_name: staffName }
      });
      if (error) throw error;
      toast({ title: 'AM Assigned', description: data?.message || `${am?.name} assigned to deal.` });
      setSelectedAmId('');
      fetchDeals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAssigningAm(false);
  };


  // Fetch activity log for a deal (Success Team only)
  const fetchActivityLog = async (propertyId: string) => {
    if (!isSuccessManager) return;
    setActivityLogLoading(true);
    setShowActivityLog(true);
    try {
      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: { action: 'get_deal_activity_log', property_id: propertyId }
      });
      if (error) throw error;
      setActivityLog(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err: any) {
      console.error('Failed to load activity log:', err.message);
      setActivityLog([]);
    }
    setActivityLogLoading(false);
  };

  // Activity log icon/color helper
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'am_deal_submitted': return { icon: Send, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' };
      case 'am_deal_approved': return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 border-green-200' };
      case 'am_deal_denied': return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' };
      case 'am_assigned': return { icon: UserPlus, color: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-200' };
      case 'deal_edited': return { icon: Edit2, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' };
      case 'visibility_changed': return { icon: EyeOff, color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' };
      case 'third_party_toggled': return { icon: Store, color: 'text-purple-500', bg: 'bg-purple-50 border-purple-200' };
      case 'penny_scored': return { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-200' };
      case 'deal_published': return { icon: ExternalLink, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' };
      case 'address_corrected': return { icon: MapPin, color: 'text-teal-500', bg: 'bg-teal-50 border-teal-200' };
      default: return { icon: History, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' };
    }
  };



  const fetchDeals = async () => {
    setLoading(true);
    try {
      if (isSuccessManager) {
        // Fetch full pipeline: AM deals + seller deals
        const { data, error } = await supabase.functions.invoke('am-submit-deal', {
          body: { action: 'get_pipeline_deals' }
        });
        if (error) throw error;
        const amList = Array.isArray(data?.am_deals) ? data.am_deals : [];
        const sellerList = Array.isArray(data?.seller_deals) ? data.seller_deals : [];
        
        const filtered = filter === 'all' ? amList : amList.filter((d: any) => d.deal_status === filter);
        setDeals(filtered);
        setSellerDeals(sellerList);
        setCounts({
          total: amList.length,
          pending: data?.counts?.am_pending || 0,
          approved: data?.counts?.am_approved || 0,
          denied: data?.counts?.am_denied || 0,
          seller_pending: data?.counts?.seller_pending || 0,
        });
      } else {
        const { data, error } = await supabase.functions.invoke('am-submit-deal', {
          body: { action: 'get_submitted_deals', staff_id: staffId, status_filter: filter !== 'all' ? filter : undefined }
        });
        if (error) throw error;
        const dealsList = Array.isArray(data?.deals) ? data.deals : [];
        const filtered = filter === 'all' ? dealsList : dealsList.filter((d: any) => d.deal_status === filter);
        setDeals(filtered);
        setCounts(data?.counts || { total: dealsList.length, pending: 0, approved: 0, denied: 0, seller_pending: 0 });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const openReviewModal = (deal: SubmittedDeal) => {
    setReviewDeal(deal);
    setReviewNotes('');
    setIsEditing(false);
    setFlaggedPhotos(new Set());
    setSelectedAmId(deal.found_by_am_id || '');
    setShowActivityLog(false);
    setActivityLog([]);
    setEditForm({
      price: deal.price || 0, monthly_rent: deal.monthly_rent || 0,
      bedrooms: deal.bedrooms || 0, bathrooms: deal.bathrooms || 0,
      sqft: deal.sqft || 0, operation_type: deal.operation_type || 'str',
      property_type: deal.property_type || 'single_family', internal_notes: deal.internal_notes || '',
    });
  };


  const openVisibilityModal = (deal: SubmittedDeal) => {
    if (!isSuccessManager) return;
    setVisibilityDeal(deal);
    setVisSettings(deal.visibility_settings || DEFAULT_VISIBILITY);
  };

  const handleSaveVisibility = async () => {
    if (!visibilityDeal || !isSuccessManager) return;
    setSavingVisibility(true);
    try {
      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: {
          action: 'update_visibility',
          property_id: visibilityDeal.id,
          visibility_settings: visSettings,
          staff_id: staffId,
          staff_name: staffName
        }
      });
      if (error) throw error;
      toast({ title: 'Visibility Updated', description: 'Information visibility settings have been saved.' });
      setVisibilityDeal(null);
      fetchDeals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSavingVisibility(false);
  };

  const handleApprove = async () => {
    if (!reviewDeal || !isSuccessManager) return;
    setProcessing(true);
    try {
      const flagNotes = flaggedPhotos.size > 0 ? `\n[Flagged ${flaggedPhotos.size} photo(s)]` : '';
      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: {
          action: 'approve_deal', property_id: reviewDeal.id,
          approved_by_name: staffName, approved_by_staff_id: staffId,
          approval_notes: (reviewNotes.trim() + flagNotes).trim()
        }
      });
      if (error) throw error;
      toast({ title: 'Deal Approved!', description: data?.message || 'Deal moved to pipeline. AM notified via email.' });
      setReviewDeal(null);
      fetchDeals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleEditAndApprove = async () => {
    if (!reviewDeal || !isSuccessManager) return;
    setProcessing(true);
    try {
      // First update the deal fields
      await supabase.functions.invoke('am-submit-deal', {
        body: {
          action: 'edit_deal', property_id: reviewDeal.id,
          updates: {
            price: editForm.price, monthly_rent: editForm.monthly_rent,
            bedrooms: editForm.bedrooms, bathrooms: editForm.bathrooms,
            sqft: editForm.sqft, operation_type: editForm.operation_type,
            property_type: editForm.property_type,
            title: `${editForm.bedrooms || 3}BR in ${reviewDeal.city}, ${reviewDeal.state}`,
            listing_title: `${editForm.bedrooms || 3}BR in ${reviewDeal.city}, ${reviewDeal.state}`,
          },
          staff_name: staffName
        }
      });

      // Then approve
      const editSummary: string[] = [];
      if (editForm.price !== (reviewDeal.price || 0)) editSummary.push(`Price: $${editForm.price.toLocaleString()}`);
      if (editForm.monthly_rent !== (reviewDeal.monthly_rent || 0)) editSummary.push(`Revenue: $${editForm.monthly_rent.toLocaleString()}/mo`);
      
      const approvalNotes = [
        reviewNotes.trim(),
        editSummary.length > 0 ? `[Edited: ${editSummary.join(', ')}]` : '',
      ].filter(Boolean).join(' ');

      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: {
          action: 'approve_deal', property_id: reviewDeal.id,
          approved_by_name: staffName, approved_by_staff_id: staffId,
          approval_notes: approvalNotes
        }
      });
      if (error) throw error;
      toast({ title: 'Deal Edited & Approved!', description: 'Deal moved to pipeline.' });
      setReviewDeal(null);
      setIsEditing(false);
      fetchDeals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleDeny = async () => {
    if (!reviewDeal || !isSuccessManager) return;
    if (!reviewNotes.trim()) {
      toast({ title: 'Please provide a reason for denial', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: {
          action: 'deny_deal', property_id: reviewDeal.id,
          denied_by_name: staffName, denied_by_staff_id: staffId,
          denial_notes: reviewNotes.trim()
        }
      });
      if (error) throw error;
      toast({ title: 'Deal Denied', description: 'AM has been notified via email.' });
      setReviewDeal(null);
      fetchDeals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'am_submitted': return <Badge className="bg-amber-500 text-white"><Clock className="w-3 h-3 mr-1" aria-hidden="true" />Pending Review</Badge>;
      case 'am_approved': return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />Approved</Badge>;
      case 'am_denied': return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" aria-hidden="true" />Denied</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceBadge = (deal: SubmittedDeal) => {
    const type = deal.submitted_by_type || deal.source;
    if (type === 'seller' || type === 'seller_submission') {
      return <Badge variant="outline" className="text-xs text-purple-600 border-purple-300 bg-purple-50"><Store className="w-3 h-3 mr-1" aria-hidden="true" />Seller</Badge>;
    }
    return <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-300 bg-indigo-50"><UserCheck className="w-3 h-3 mr-1" aria-hidden="true" />AM</Badge>;
  };

  const getSubmitterName = (deal: SubmittedDeal) => {
    if (deal.submitted_by_client_name) return deal.submitted_by_client_name;
    if (deal.added_by_staff_name) return deal.added_by_staff_name;
    if (deal.found_by_am_name) return deal.found_by_am_name;
    return 'Unknown';
  };

  const fmt = (val?: number) => val ? `$${val.toLocaleString()}` : 'N/A';
  const validPhotos = reviewDeal?.photos?.filter(Boolean) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1a365d] flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" aria-hidden="true" />
            {isSuccessManager ? 'Deal Pipeline - Success Team Review' : 'My Submitted Deals'}
          </h2>
          <p className="text-sm text-gray-600">
            {isSuccessManager
              ? 'Review, approve, deny, and control visibility for all deal submissions (AM + Seller)'
              : 'Track the status of properties you have submitted for review'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className="text-gray-400 hover:text-gray-600" title="Toggle debug info">
            <Bug className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Toggle debug info</span>
          </Button>
          <Button variant="outline" onClick={fetchDeals} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh
          </Button>
        </div>
      </div>

      {/* Debug Role Detection Panel */}
      {showDebug && (
        <Card className="border-gray-300 bg-gray-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Bug className="w-4 h-4 text-gray-500" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-700">Role Detection Debug</h3>
              <Badge className={isSuccessManager ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                {isSuccessManager ? 'SUCCESS TEAM VIEW' : 'AM VIEW (filtered)'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-2 bg-white rounded border">
                <span className="text-gray-500">staffId:</span>
                <span className="ml-1 text-gray-800 break-all">{staffId?.substring(0, 12)}...</span>
              </div>
              <div className="p-2 bg-white rounded border">
                <span className="text-gray-500">staffName:</span>
                <span className="ml-1 text-gray-800">{staffName}</span>
              </div>
              <div className="p-2 bg-white rounded border">
                <span className="text-gray-500">isSuccessManager (prop):</span>
                <span className={`ml-1 font-bold ${isSuccessManager ? 'text-green-600' : 'text-red-600'}`}>{String(isSuccessManager)}</span>
              </div>
              <div className="p-2 bg-white rounded border">
                <span className="text-gray-500">session.role:</span>
                <span className="ml-1 text-gray-800">{staffSession?.role || '(empty)'}</span>
              </div>
              <div className="p-2 bg-white rounded border">
                <span className="text-gray-500">session.department:</span>
                <span className="ml-1 text-gray-800">{staffSession?.department || '(empty)'}</span>
              </div>
              <div className="p-2 bg-white rounded border">
                <span className="text-gray-500">session.roles[]:</span>
                <span className="ml-1 text-gray-800">{JSON.stringify(staffSession?.roles || [])}</span>
              </div>
              <div className="p-2 bg-white rounded border col-span-2 md:col-span-3">
                <span className="text-gray-500">session.permissions[]:</span>
                <span className="ml-1 text-gray-800">{JSON.stringify(staffSession?.permissions || [])}</span>
              </div>
              <div className="p-2 bg-white rounded border col-span-2 md:col-span-3">
                <span className="text-gray-500">API action used:</span>
                <span className="ml-1 text-blue-700 font-bold">{isSuccessManager ? 'get_pipeline_deals (ALL deals, no staff_id filter)' : `get_submitted_deals (filtered by staff_id=${staffId?.substring(0, 8)}...)`}</span>
              </div>
            </div>
            {!isSuccessManager && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <AlertTriangle className="w-3 h-3 inline mr-1" aria-hidden="true" />
                <strong>Not detected as Success Team.</strong> You are seeing only YOUR submitted deals. 
                If this is wrong, check that your staff_users record has: department=success_managers, OR roles includes success_managers, OR role=admin/success_manager, OR permissions includes &apos;all&apos;.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pipeline Tabs (Success Team only) */}
      {isSuccessManager && (
        <div className="flex gap-2 border-b pb-2" role="tablist">
          <Button
            variant={pipelineTab === 'am' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setPipelineTab('am')}
            className={pipelineTab === 'am' ? 'bg-indigo-600' : ''}
            role="tab"
            aria-selected={pipelineTab === 'am'}
            aria-controls="am-submissions-panel"
          >
            <UserCheck className="w-4 h-4 mr-1" aria-hidden="true" />
            AM Submissions ({counts.pending} pending)
          </Button>
          <Button
            variant={pipelineTab === 'seller' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setPipelineTab('seller')}
            className={pipelineTab === 'seller' ? 'bg-purple-600' : ''}
            role="tab"
            aria-selected={pipelineTab === 'seller'}
            aria-controls="seller-submissions-panel"
          >
            <Store className="w-4 h-4 mr-1" aria-hidden="true" />
            Seller Submissions ({counts.seller_pending} pending)
          </Button>
        </div>
      )}



      {/* AM Submissions Pipeline */}
      {pipelineTab === 'am' && (
        <div id="am-submissions-panel" role="tabpanel">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { key: 'all' as const, label: 'Total', count: counts.total, color: 'indigo', icon: null },
              { key: 'am_submitted' as const, label: 'Pending', count: counts.pending, color: 'amber', icon: Clock },
              { key: 'am_approved' as const, label: 'Approved', count: counts.approved, color: 'green', icon: CheckCircle },
              { key: 'am_denied' as const, label: 'Denied', count: counts.denied, color: 'red', icon: XCircle },
            ].map(item => (
              <Card
                key={item.key}
                className={`cursor-pointer transition-all ${filter === item.key ? `ring-2 ring-${item.color}-500` : `hover:border-${item.color}-300`}`}
                onClick={() => setFilter(item.key)}
                role="button"
                aria-pressed={filter === item.key}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(item.key); } }}
              >
                <CardContent className="pt-4 text-center">
                  {item.icon && <item.icon className={`w-5 h-5 mx-auto text-${item.color}-500 mb-1`} aria-hidden="true" />}
                  <p className={`text-2xl font-bold text-${item.color}-700`}>{item.count}</p>
                  <p className="text-xs text-gray-500">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Deals List */}
          {loading ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" aria-hidden="true" /><p className="text-sm text-gray-500 mt-2" aria-live="polite">Loading deals...</p></CardContent></Card>
          ) : deals.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" /><p className="text-gray-500 font-medium">No deals found</p></CardContent></Card>
          ) : (
            <div className="space-y-4">
              {deals.map(deal => (
                <Card key={deal.id} className={`hover:shadow-md transition-all ${
                  deal.deal_status === 'am_submitted' ? 'border-l-4 border-l-amber-500' :
                  deal.deal_status === 'am_approved' ? 'border-l-4 border-l-green-500' :
                  deal.deal_status === 'am_denied' ? 'border-l-4 border-l-red-500' : ''
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {getStatusBadge(deal.deal_status)}
                          {getSourceBadge(deal)}
                          
                          {/* Third-Party Seller Badge */}
                          {(deal.is_third_party_seller || deal.source === 'third_party') && (
                            <Badge className="bg-purple-500 text-white text-xs">
                              <Store className="w-3 h-3 mr-1" aria-hidden="true" />3rd Party Seller
                            </Badge>
                          )}
                          
                          {/* AM Attribution Badge */}
                          <Badge variant="outline" className="text-xs font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">
                            <User className="w-3 h-3 mr-1" aria-hidden="true" />
                            Listed by: {getSubmitterName(deal)}
                          </Badge>
                          
                          {deal.photos && deal.photos.filter(Boolean).length > 0 && (
                            <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-200">
                              <ImageIcon className="w-3 h-3 mr-1" aria-hidden="true" />{deal.photos.filter(Boolean).length} photos
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(deal.created_at).toLocaleDateString()} at {new Date(deal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>


                        <h3 className="font-semibold text-lg">{deal.title || deal.address}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" aria-hidden="true" />
                          {deal.address}, {deal.city}, {deal.state} {deal.zip_code || ''}
                          <Lock className="w-3 h-3 ml-2 text-orange-500" aria-hidden="true" title="Address hidden from public" />
                        </p>

                        {deal.community_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            Community: {deal.community_name}
                            <Lock className="w-3 h-3 ml-1 inline text-orange-500" aria-hidden="true" title="Hidden from public" />
                          </p>
                        )}

                        <div className="flex flex-wrap gap-4 mt-3 text-sm">
                          <span className="flex items-center gap-1 text-green-700">
                            <DollarSign className="w-4 h-4" aria-hidden="true" />Price: {fmt(deal.price)}
                          </span>
                          <span className="flex items-center gap-1 text-blue-700">
                            <DollarSign className="w-4 h-4" aria-hidden="true" />Revenue: {deal.monthly_rent ? `${fmt(deal.monthly_rent)}/mo` : 'N/A'}
                          </span>
                          {deal.bedrooms && <span className="flex items-center gap-1 text-gray-600"><Home className="w-4 h-4" aria-hidden="true" />{deal.bedrooms}BR / {deal.bathrooms}BA</span>}
                        </div>

                        {/* Visibility indicator (Success Team only) */}
                        {isSuccessManager && deal.visibility_settings && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Visibility:</span>
                            {deal.visibility_settings.show_address ? (
                              <Badge className="bg-green-100 text-green-700 text-[10px]"><Unlock className="w-2.5 h-2.5 mr-0.5" aria-hidden="true" />Address</Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-700 text-[10px]"><Lock className="w-2.5 h-2.5 mr-0.5" aria-hidden="true" />Address</Badge>
                            )}
                            {deal.visibility_settings.show_landlord_contact ? (
                              <Badge className="bg-green-100 text-green-700 text-[10px]"><Unlock className="w-2.5 h-2.5 mr-0.5" aria-hidden="true" />Landlord</Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-700 text-[10px]"><Lock className="w-2.5 h-2.5 mr-0.5" aria-hidden="true" />Landlord</Badge>
                            )}
                          </div>
                        )}

                        {deal.approved_by_staff_name && deal.deal_status === 'am_approved' && (
                          <p className="text-xs text-green-600 mt-2">
                            Approved by {deal.approved_by_staff_name} {deal.approved_at ? `on ${new Date(deal.approved_at).toLocaleDateString()}` : ''}
                          </p>
                        )}
                        {deal.denial_reason && deal.deal_status === 'am_denied' && (
                          <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded">Denial reason: {deal.denial_reason}</p>
                        )}
                      </div>

                      <div className="flex gap-2 flex-shrink-0 flex-wrap">
                        {/* Visibility Controls (Success Team only) */}
                        {isSuccessManager && (
                          <Button size="sm" variant="outline" onClick={() => openVisibilityModal(deal)} title="Control information visibility">
                            <EyeOff className="w-4 h-4 mr-1" aria-hidden="true" />Visibility
                          </Button>
                        )}
                        {deal.listing_url && (
                          <Button size="sm" variant="outline" onClick={() => window.open(deal.listing_url, '_blank')}>
                            <ExternalLink className="w-4 h-4 mr-1" aria-hidden="true" />Listing
                          </Button>
                        )}
                        {isSuccessManager && deal.deal_status === 'am_submitted' && (
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => openReviewModal(deal)}>
                            <Eye className="w-4 h-4 mr-1" aria-hidden="true" />Review
                          </Button>
                        )}
                        {(!isSuccessManager || deal.deal_status !== 'am_submitted') && (
                          <Button size="sm" variant="outline" onClick={() => openReviewModal(deal)}>
                            <Eye className="w-4 h-4 mr-1" aria-hidden="true" />Details
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Seller Submissions Pipeline (Success Team only) */}
      {pipelineTab === 'seller' && isSuccessManager && (
        <div className="space-y-4">
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Store className="w-6 h-6 text-purple-600" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-purple-900">Third-Party Seller Submissions</h3>
                  <p className="text-sm text-purple-700">
                    These are deals submitted by investors/sellers through the marketplace. They require verification before going live.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {sellerDeals.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Store className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" /><p className="text-gray-500">No pending seller submissions</p></CardContent></Card>
          ) : (
            sellerDeals.map(deal => (
              <Card key={deal.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-all">
                <CardContent className="pt-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className="bg-purple-500 text-white"><Store className="w-3 h-3 mr-1" aria-hidden="true" />Seller Submission</Badge>
                        <Badge variant="outline" className={deal.status === 'needs_changes' ? 'text-yellow-700 border-yellow-300' : 'text-amber-700 border-amber-300'}>
                          {deal.status === 'needs_changes' ? 'Needs Changes' : 'Pending Approval'}
                        </Badge>
                        <span className="text-xs text-gray-400">{new Date(deal.created_at).toLocaleDateString()}</span>
                      </div>

                      <h3 className="font-semibold text-lg">{deal.property?.address || 'Property'}</h3>
                      <p className="text-sm text-gray-600">{deal.property?.city}, {deal.property?.state}</p>

                      <div className="flex flex-wrap gap-4 mt-3 text-sm">
                        <span className="text-green-700 font-medium">Fee: ${deal.acquisition_fee?.toLocaleString()}</span>
                        <span className="text-blue-700">Revenue: ${deal.monthly_revenue?.toLocaleString()}/mo</span>
                        {deal.property?.bedrooms && <span className="text-gray-600">{deal.property.bedrooms}BR / {deal.property.bathrooms}BA</span>}
                      </div>

                      {deal.seller && (
                        <div className="mt-2 p-2 bg-purple-50 rounded-lg text-sm">
                          <span className="font-medium text-purple-800">Seller:</span> {deal.seller.full_name} ({deal.seller.email})
                        </div>
                      )}
                    </div>

                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => {
                      toast({ title: 'Navigate to Marketplace Verifications', description: 'Use the Deal Flow > Marketplace Verifications tab to review this seller submission.' });
                    }}>
                      <Eye className="w-4 h-4 mr-1" aria-hidden="true" />Review in Marketplace
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Review / Detail Modal */}
      <Dialog open={!!reviewDeal} onOpenChange={() => { setReviewDeal(null); setReviewNotes(''); setIsEditing(false); setFlaggedPhotos(new Set()); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" aria-hidden="true" />
              {isSuccessManager && reviewDeal?.deal_status === 'am_submitted' ? 'Review Submitted Deal' : 'Deal Details'}
            </DialogTitle>
            <DialogDescription>
              {isSuccessManager && reviewDeal?.deal_status === 'am_submitted'
                ? 'Review, edit, approve or deny. The submitter will be notified via email.'
                : 'View details of this submitted deal.'}
            </DialogDescription>
          </DialogHeader>

          {reviewDeal && (
            <div className="space-y-4">
              {/* Status + Submitter */}
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(reviewDeal.deal_status)}
                {getSourceBadge(reviewDeal)}
                <span className="text-sm text-gray-500">
                  Submitted by <strong>{getSubmitterName(reviewDeal)}</strong>
                </span>
              </div>

              {/* Property Info */}
              <Card className={isEditing ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}>
                <CardContent className="pt-4 space-y-3">
                  {isEditing && (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-blue-100 rounded-lg">
                      <Edit2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      <span className="text-sm font-medium text-blue-800">Editing Mode</span>
                    </div>
                  )}

                  <h4 className="font-semibold">{reviewDeal.title || reviewDeal.address}</h4>
                  <p className="text-sm text-gray-600">
                    <MapPin className="w-3 h-3 inline mr-1" aria-hidden="true" />
                    {reviewDeal.address}, {reviewDeal.city}, {reviewDeal.state} {reviewDeal.zip_code || ''}
                    <span className="ml-2 text-orange-500 text-xs">(Staff only - hidden from public)</span>
                  </p>
                  
                  {isEditing ? (
                    <div className="space-y-4 mt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="edit-price" className="text-xs">Acquisition Fee ($)</Label>
                          <Input id="edit-price" type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <Label htmlFor="edit-revenue" className="text-xs">Monthly Revenue ($)</Label>
                          <Input id="edit-revenue" type="number" value={editForm.monthly_rent} onChange={(e) => setEditForm({ ...editForm, monthly_rent: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="edit-bedrooms" className="text-xs">Bedrooms</Label>
                          <Input id="edit-bedrooms" type="number" value={editForm.bedrooms} onChange={(e) => setEditForm({ ...editForm, bedrooms: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <Label htmlFor="edit-bathrooms" className="text-xs">Bathrooms</Label>
                          <Input id="edit-bathrooms" type="number" step="0.5" value={editForm.bathrooms} onChange={(e) => setEditForm({ ...editForm, bathrooms: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                          <Label htmlFor="edit-sqft" className="text-xs">Sq Ft</Label>
                          <Input id="edit-sqft" type="number" value={editForm.sqft} onChange={(e) => setEditForm({ ...editForm, sqft: parseInt(e.target.value) || 0 })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="edit-operation" className="text-xs">Operation Type</Label>
                          <Select value={editForm.operation_type} onValueChange={(v) => setEditForm({ ...editForm, operation_type: v })}>
                            <SelectTrigger id="edit-operation"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="str">STR</SelectItem><SelectItem value="mtr">MTR</SelectItem>
                              <SelectItem value="coliving">Co-Living</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="edit-proptype" className="text-xs">Property Type</Label>
                          <Select value={editForm.property_type} onValueChange={(v) => setEditForm({ ...editForm, property_type: v })}>
                            <SelectTrigger id="edit-proptype"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single_family">Single Family</SelectItem><SelectItem value="apartment">Apartment</SelectItem>
                              <SelectItem value="condo">Condo</SelectItem><SelectItem value="townhouse">Townhouse</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                      <div><span className="text-gray-500">Acquisition Fee:</span> <strong>{fmt(reviewDeal.price)}</strong></div>
                      <div><span className="text-gray-500">Monthly Revenue:</span> <strong>{reviewDeal.monthly_rent ? `${fmt(reviewDeal.monthly_rent)}/mo` : 'N/A'}</strong></div>
                      <div><span className="text-gray-500">Bedrooms:</span> <strong>{reviewDeal.bedrooms || 'N/A'}</strong></div>
                      <div><span className="text-gray-500">Bathrooms:</span> <strong>{reviewDeal.bathrooms || 'N/A'}</strong></div>
                      <div><span className="text-gray-500">Sq Ft:</span> <strong>{reviewDeal.sqft?.toLocaleString() || 'N/A'}</strong></div>
                      <div><span className="text-gray-500">Operation:</span> <strong>{(reviewDeal.operation_type || 'N/A').toUpperCase()}</strong></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Landlord Info (Success Team only - AMs should not see landlord contact in review modal) */}
              {isSuccessManager && (reviewDeal.landlord_name || reviewDeal.landlord_email || reviewDeal.landlord_phone) && (
                <Card className="border-orange-200">
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                      <Lock className="w-3 h-3 text-orange-500" aria-hidden="true" />
                      Landlord Contact <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">STAFF ONLY</span>
                    </h4>
                    <div className="space-y-1 text-sm">
                      {reviewDeal.landlord_name && <p><strong>Name:</strong> {reviewDeal.landlord_name}</p>}
                      {reviewDeal.landlord_email && <p><strong>Email:</strong> {reviewDeal.landlord_email}</p>}
                      {reviewDeal.landlord_phone && <p><strong>Phone:</strong> {reviewDeal.landlord_phone}</p>}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {reviewDeal.internal_notes && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">Submitter Notes:</p>
                  <p className="text-sm text-blue-700">{reviewDeal.internal_notes}</p>
                </div>
              )}

              {/* Photos */}
              {validPhotos.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-500" aria-hidden="true" />Photos ({validPhotos.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {validPhotos.map((photo, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border-2 border-gray-200 hover:border-indigo-300">
                        <img src={photo} alt={`Property photo ${i + 1} of ${validPhotos.length}`} className="w-full h-28 object-cover cursor-pointer" onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded" aria-hidden="true">{i + 1}/{validPhotos.length}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reviewDeal.listing_url && (
                <Button variant="outline" className="w-full" onClick={() => window.open(reviewDeal.listing_url, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />View Original Listing
                </Button>
              )}

              {/* ===== AM Assignment Section (Success Team only) ===== */}
              {isSuccessManager && (
                <Card className="border-indigo-200 bg-indigo-50/50">
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-sm text-indigo-800 mb-3 flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                      Assign Acquisition Manager
                    </h4>
                    
                    {/* Current AM display */}
                    {reviewDeal.found_by_am_name && (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded-lg border border-indigo-100">
                        <UserCheck className="w-4 h-4 text-green-500" aria-hidden="true" />
                        <span className="text-sm">
                          Currently assigned: <strong className="text-indigo-700">{reviewDeal.found_by_am_name}</strong>
                        </span>
                      </div>
                    )}
                    {!reviewDeal.found_by_am_name && (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
                        <span className="text-sm text-amber-700">No AM assigned to this deal</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select value={selectedAmId} onValueChange={setSelectedAmId}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select an Acquisition Manager..." />
                          </SelectTrigger>
                          <SelectContent>
                            {amList.map(am => (
                              <SelectItem key={am.id} value={am.id}>
                                {am.name} ({am.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => handleAssignAm(reviewDeal.id)}
                        disabled={assigningAm || !selectedAmId}
                      >
                        {assigningAm ? <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" /> : <UserPlus className="w-4 h-4 mr-1" aria-hidden="true" />}
                        Assign
                      </Button>
                    </div>
                    {amList.length === 0 && (
                      <p className="text-xs text-gray-500 mt-2">No acquisition managers found. Check staff_users table for department=acquisition_managers.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ===== Deal Activity Log (Success Team only) ===== */}
              {isSuccessManager && (
                <div className="border-t pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full flex items-center justify-between text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                    onClick={() => {
                      if (!showActivityLog) {
                        fetchActivityLog(reviewDeal.id);
                      } else {
                        setShowActivityLog(false);
                      }
                    }}
                    aria-expanded={showActivityLog}
                  >
                    <span className="flex items-center gap-2">
                      <History className="w-4 h-4" aria-hidden="true" />
                      <span className="font-medium text-sm">Deal Activity Log</span>
                      {activityLog.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5">{activityLog.length}</Badge>
                      )}
                    </span>
                    {showActivityLog ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                  </Button>

                  {showActivityLog && (
                    <div className="mt-3 space-y-1">
                      {activityLogLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mr-2" aria-hidden="true" />
                          <span className="text-sm text-gray-500" aria-live="polite">Loading activity log...</span>
                        </div>
                      ) : activityLog.length === 0 ? (
                        <div className="text-center py-6 text-sm text-gray-400">
                          <History className="w-8 h-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                          <p>No activity recorded yet for this deal.</p>
                          <p className="text-xs mt-1">Activity will appear here after actions are taken (submit, approve, deny, edit, etc.)</p>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Timeline line */}
                          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-200" aria-hidden="true" />
                          
                          <div className="space-y-3">
                            {activityLog.map((entry, idx) => {
                              const { icon: Icon, color, bg } = getActivityIcon(entry.activity_type);
                              return (
                                <div key={entry.id || idx} className="relative flex gap-3 pl-0">
                                  {/* Timeline dot */}
                                  <div className={`relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full border ${bg} flex items-center justify-center`} aria-hidden="true">
                                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                                  </div>
                                  
                                  {/* Content */}
                                  <div className="flex-1 min-w-0 pb-1">
                                    <p className="text-sm text-gray-800 leading-snug">{entry.activity_description}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      {entry.performer_name && (
                                        <span className="text-[11px] text-indigo-600 font-medium flex items-center gap-0.5">
                                          <User className="w-2.5 h-2.5" aria-hidden="true" />{entry.performer_name}
                                        </span>
                                      )}
                                      <span className="text-[11px] text-gray-400">
                                        {new Date(entry.created_at).toLocaleDateString()} at {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 text-gray-400 border-gray-200">
                                        {entry.activity_type.replace(/_/g, ' ')}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}


              {/* Approval/Denial Section (Success Team only) */}
              {isSuccessManager && reviewDeal.deal_status === 'am_submitted' && (
                <div className="space-y-3 pt-4 border-t">
                  <Label htmlFor="review-notes">Review Notes {!isEditing ? '(required for denial)' : '(optional)'}</Label>
                  <Textarea id="review-notes" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add notes about your decision..." rows={3} />
                  
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="flex-1 min-w-[120px] text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={handleDeny} disabled={processing}>
                      {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <XCircle className="w-4 h-4 mr-2" aria-hidden="true" />}Deny Deal
                    </Button>
                    {!isEditing ? (
                      <Button variant="outline" className="flex-1 min-w-[120px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200" onClick={() => setIsEditing(true)} disabled={processing}>
                        <Edit2 className="w-4 h-4 mr-2" aria-hidden="true" />Edit & Approve
                      </Button>
                    ) : (
                      <Button className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700" onClick={handleEditAndApprove} disabled={processing}>
                        {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4 mr-2" aria-hidden="true" />}Save & Approve
                      </Button>
                    )}
                    {!isEditing && (
                      <Button className="flex-1 min-w-[120px] bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={processing}>
                        {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />}Approve Deal
                      </Button>
                    )}
                    {isEditing && (
                      <Button variant="outline" className="min-w-[80px]" onClick={() => setIsEditing(false)}>Cancel Edit</Button>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                    <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                    Only Success Team can approve deals. AMs cannot publish without approval.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Visibility Settings Modal (Success Team only) */}
      {isSuccessManager && (
        <Dialog open={!!visibilityDeal} onOpenChange={() => setVisibilityDeal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <EyeOff className="w-5 h-5 text-orange-500" aria-hidden="true" />
                Information Visibility Controls
              </DialogTitle>
              <DialogDescription>
                Control what information is visible to investors and the public marketplace.
                Only ZIP codes are shown on the public marketplace by default.
              </DialogDescription>
            </DialogHeader>

            {visibilityDeal && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <p className="font-medium text-blue-800">{visibilityDeal.title || visibilityDeal.address}</p>
                  <p className="text-blue-600">{visibilityDeal.city}, {visibilityDeal.state} {visibilityDeal.zip_code}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Show Full Address</p>
                      <p className="text-xs text-gray-500">Allow funded investors to see the full street address</p>
                    </div>
                    <Switch checked={visSettings.show_address} onCheckedChange={(c) => setVisSettings({ ...visSettings, show_address: c })} />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Show Community Name</p>
                      <p className="text-xs text-gray-500">Display the community/neighborhood name</p>
                    </div>
                    <Switch checked={visSettings.show_community_name} onCheckedChange={(c) => setVisSettings({ ...visSettings, show_community_name: c })} />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Show Landlord Contact</p>
                      <p className="text-xs text-gray-500">Share landlord name/email/phone with assigned investors</p>
                    </div>
                    <Switch checked={visSettings.show_landlord_contact} onCheckedChange={(c) => setVisSettings({ ...visSettings, show_landlord_contact: c })} />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Show Full Photos</p>
                      <p className="text-xs text-gray-500">Display all property photos to investors</p>
                    </div>
                    <Switch checked={visSettings.show_full_photos} onCheckedChange={(c) => setVisSettings({ ...visSettings, show_full_photos: c })} />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Show Financials</p>
                      <p className="text-xs text-gray-500">Display pricing and revenue details</p>
                    </div>
                    <Switch checked={visSettings.show_financials} onCheckedChange={(c) => setVisSettings({ ...visSettings, show_financials: c })} />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <strong>Public Marketplace:</strong> Only ZIP code is shown. No addresses, community names, or landlord info.
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    <strong>Funded Investors (Portal):</strong> Can see addresses if "Show Full Address" is enabled.
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    <strong>Staff:</strong> Always see all information regardless of these settings.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setVisibilityDeal(null)}>Cancel</Button>
              <Button onClick={handleSaveVisibility} disabled={savingVisibility} className="bg-[#d4a574] hover:bg-[#c49464]">
                {savingVisibility && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Save Visibility Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Photo Lightbox */}
      {lightboxOpen && validPhotos.length > 0 && (
        <PhotoLightbox
          photos={validPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          propertyAddress={reviewDeal ? `${reviewDeal.address}, ${reviewDeal.city}, ${reviewDeal.state}` : undefined}
        />
      )}
    </div>
  );
}
