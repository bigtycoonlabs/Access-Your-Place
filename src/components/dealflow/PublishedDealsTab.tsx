import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { handleDealError, ClassifiedError } from '@/utils/dealErrorHandler';
import { InlineFinancialEditor } from './InlineFinancialEditor';
import { PhotoManagementPanel } from './PhotoManagementPanel';
import {
  Loader2, Globe, MapPin, Bed, Bath, DollarSign, Trash2, EyeOff,
  Search, RefreshCw, Image, CheckCircle, AlertTriangle, Building,
  Copy, XCircle, ShieldAlert, WifiOff, Server, Clock, Info,
  Star, Filter, ArrowUpDown, Archive, CheckSquare, Square, MinusSquare,
  Edit, Camera, ThumbsUp, ThumbsDown, Sparkles
} from 'lucide-react';

interface PublishedProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthly_rent?: number;
  listing_title?: string;
  listing_description?: string;
  property_type?: string;
  source?: string;
  acquisition_fee?: number;
  is_published: boolean;
  is_featured?: boolean;
  is_verified?: boolean;
  deal_status?: string;
  workflow_stage?: string;
  status?: string;
  photos?: string[];
  penny_score?: number;
  units_available?: number;
  created_at: string;
  updated_at?: string;
  submitted_by_am_id?: string;
  submitted_by_am_name?: string;
  adr_peak_season?: number;
  adr_slow_season?: number;
  monthly_room_rate?: number;
  avg_occupancy_rate?: number;
  projected_yearly_revenue?: number;
  projected_monthly_revenue_peak?: number;
  projected_monthly_revenue_slow?: number;
}

interface PublishedDealsTabProps {
  staffId?: string;
  staffName?: string;
  userRole?: string;
}

function ErrorIcon({ category }: { category: string }) {
  switch (category) {
    case 'rls_permission': return <ShieldAlert className="w-5 h-5 text-orange-500" />;
    case 'network': return <WifiOff className="w-5 h-5 text-red-500" />;
    case 'edge_function_502': return <Server className="w-5 h-5 text-red-500" />;
    case 'edge_function_timeout': return <Clock className="w-5 h-5 text-yellow-500" />;
    default: return <AlertTriangle className="w-5 h-5 text-red-500" />;
  }
}

function getErrorBannerColors(category: string) {
  switch (category) {
    case 'rls_permission': return 'bg-orange-50 border-orange-300 text-orange-900';
    case 'network': return 'bg-red-50 border-red-300 text-red-900';
    case 'edge_function_502': return 'bg-red-50 border-red-300 text-red-900';
    case 'edge_function_timeout': return 'bg-yellow-50 border-yellow-300 text-yellow-900';
    default: return 'bg-red-50 border-red-300 text-red-900';
  }
}

async function archiveProperty(property: PublishedProperty, reason: 'deleted' | 'unpublished', staffId?: string, staffName?: string) {
  try {
    await supabase.from('archived_properties').insert({
      original_property_id: property.id, address: property.address, city: property.city, state: property.state,
      zip_code: property.zip_code, bedrooms: property.bedrooms, bathrooms: property.bathrooms,
      monthly_rent: property.monthly_rent, listing_title: property.listing_title,
      listing_description: property.listing_description, property_type: property.property_type,
      source: property.source, acquisition_fee: property.acquisition_fee, is_published: property.is_published,
      is_featured: property.is_featured, is_verified: property.is_verified, deal_status: property.deal_status,
      workflow_stage: property.workflow_stage, status: property.status, photos: property.photos,
      penny_score: property.penny_score, units_available: property.units_available,
      original_created_at: property.created_at, original_updated_at: property.updated_at,
      archived_by_staff_id: staffId, archived_by_staff_name: staffName, archive_reason: reason,
      original_data: property as any
    });
  } catch (e) { console.error('Archive exception:', e); }
}

async function deletePropertyComprehensive(propertyId: string, staffId?: string, staffName?: string): Promise<{ success: boolean; error?: string; soft_delete?: boolean }> {
  // Attempt 1: Edge function (most reliable - uses service_role_key with comprehensive FK cascade)
  try {
    const { data, error } = await supabase.functions.invoke('delete-property', {
      body: { property_id: propertyId, archive: false, staff_id: staffId, staff_name: staffName }
    });
    if (!error && data?.success) return { success: true, soft_delete: data.soft_delete };
  } catch (e) { /* fallback */ }

  // Attempt 2: Direct database cascade delete with ALL FK-constrained tables
  try {
    // Clean deal_listings and their children
    let listingIds: string[] = [];
    try { const { data: listings } = await supabase.from('deal_listings').select('id').eq('property_id', propertyId); listingIds = (listings || []).map((l: any) => l.id); } catch (e) { }
    if (listingIds.length > 0) {
      for (const table of ['marketplace_verification_alerts','deal_verifications','deal_transactions','marketplace_payments','marketplace_offers','marketplace_interests','marketplace_closed_deals','deal_offers','deal_negotiations']) {
        for (const lid of listingIds) { try { await supabase.from(table).delete().eq('listing_id', lid); } catch (e) { } }
      }
      try { await supabase.from('deal_listings').delete().eq('property_id', propertyId); } catch (e) { }
    }

    // Nullify acquisition_requests
    try { await supabase.from('acquisition_requests').update({ converted_property_id: null }).eq('converted_property_id', propertyId); } catch(e){}

    // ALL FK-constrained child tables (matching edge function v7.1)
    const fkTables = [
      'acquisition_payments','acquisition_workflow','acquisitions','deal_performance_tracking',
      'landlord_applications','landlord_communications','landlord_properties',
      'penny_deal_scores','penny_score_alerts','penny_score_history','property_assignments'
    ];
    for (const table of fkTables) {
      try { await supabase.from(table).delete().eq('property_id', propertyId); } catch(e){}
    }

    // Other non-FK child tables
    for (const table of ['property_photos','deal_analytics','property_analytics','outreach_tracking','outreach_notes','deal_workflow_stages','deal_inquiries','deal_activity_log','saved_deals','deal_reservations','investor_favorites','property_expenses','deal_alerts','deal_alert_notifications','deal_scores','property_referrals','deal_matches','portfolio_property_links','setup_tasks','setup_quotes','property_setup_progress']) {
      try { await supabase.from(table).delete().eq('property_id', propertyId); } catch (e) { }
    }

    const { error: deleteError } = await supabase.from('properties').delete().eq('id', propertyId);
    if (deleteError) {
      // Soft-delete fallback
      const { error: softErr } = await supabase.from('properties').update({
        status: 'deleted', is_published: false, deal_status: 'deleted',
        workflow_stage: 'deleted', updated_at: new Date().toISOString()
      }).eq('id', propertyId);
      if (softErr) return { success: false, error: `Hard: ${deleteError.message}. Soft: ${softErr.message}` };
      return { success: true, soft_delete: true };
    }
    return { success: true };
  } catch (e: any) {
    // Final fallback: try soft-delete
    try {
      const { error: softErr } = await supabase.from('properties').update({
        status: 'deleted', is_published: false, deal_status: 'deleted',
        workflow_stage: 'deleted', updated_at: new Date().toISOString()
      }).eq('id', propertyId);
      if (!softErr) return { success: true, soft_delete: true };
    } catch(se) {}
    return { success: false, error: e?.message || 'Unknown error' };
  }
}


export function PublishedDealsTab({ staffId, staffName, userRole }: PublishedDealsTabProps) {
  const [properties, setProperties] = useState<PublishedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price_high' | 'price_low'>('newest');
  const [typeFilter, setTypeFilter] = useState('all');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PublishedProperty | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Financial editor
  const [financialEditorOpen, setFinancialEditorOpen] = useState(false);
  const [financialProperty, setFinancialProperty] = useState<PublishedProperty | null>(null);

  // Photo management
  const [photoManagerOpen, setPhotoManagerOpen] = useState(false);
  const [photoProperty, setPhotoProperty] = useState<PublishedProperty | null>(null);

  // Approve/Reject
  const [approveRejectDialogOpen, setApproveRejectDialogOpen] = useState(false);
  const [approveRejectAction, setApproveRejectAction] = useState<'approve' | 'reject' | null>(null);
  const [approveRejectProperty, setApproveRejectProperty] = useState<PublishedProperty | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'unpublish' | 'delete' | 'feature' | 'unfeature' | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const [lastError, setLastError] = useState<ClassifiedError | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchPublishedDeals(); }, []);

  const showError = (err: unknown, operation: Parameters<typeof handleDealError>[1], context?: Record<string, any>) => {
    const { toast: toastData, classified } = handleDealError(err, operation, context);
    setLastError(classified);
    toast(toastData);
    return classified;
  };

  const copyErrorRef = () => {
    if (!lastError) return;
    const text = `Error Reference: ${lastError.errorCode}\nCategory: ${lastError.category}\nTime: ${lastError.timestamp}\nDetails: ${lastError.rawMessage.slice(0, 300)}`;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied to clipboard', description: 'Error details copied.' });
    });
  };

  const fetchPublishedDeals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .or('is_published.eq.true,deal_status.eq.published,workflow_stage.eq.published,status.eq.published')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProperties(data || []);
      setSelectedIds(new Set());
      setLastError(null);
    } catch (err) { showError(err, 'fetch', { phase: 'fetch_published_deals' }); }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return properties
      .filter(p => {
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return (p.listing_title || '').toLowerCase().includes(term) || (p.address || '').toLowerCase().includes(term) || (p.city || '').toLowerCase().includes(term) || (p.state || '').toLowerCase().includes(term) || (p.zip_code || '').toLowerCase().includes(term);
        }
        return true;
      })
      .filter(p => typeFilter === 'all' || p.property_type === typeFilter)
      .sort((a, b) => {
        switch (sortBy) {
          case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case 'price_high': return (b.monthly_rent || 0) - (a.monthly_rent || 0);
          case 'price_low': return (a.monthly_rent || 0) - (b.monthly_rent || 0);
          default: return 0;
        }
      });
  }, [properties, searchTerm, typeFilter, sortBy]);

  const filteredIds = useMemo(() => new Set(filtered.map(p => p.id)), [filtered]);
  const selectedInView = useMemo(() => new Set([...selectedIds].filter(id => filteredIds.has(id))), [selectedIds, filteredIds]);
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
  const someFilteredSelected = filtered.some(p => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const newSet = new Set(selectedIds);
      filtered.forEach(p => newSet.delete(p.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      filtered.forEach(p => newSet.add(p.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleUnpublish = async () => {
    if (!selectedProperty) return;
    setActionLoading(selectedProperty.id);
    try {
      await archiveProperty(selectedProperty, 'unpublished', staffId, staffName);
      const { error } = await supabase.from('properties').update({
        is_published: false, deal_status: 'approved', workflow_stage: 'approved', status: 'approved', updated_at: new Date().toISOString()
      }).eq('id', selectedProperty.id);
      if (error) {
        await supabase.functions.invoke('update-property', {
          body: { id: selectedProperty.id, is_published: false, deal_status: 'approved', workflow_stage: 'approved', status: 'approved', updated_by_staff_id: staffId, updated_by_staff_name: staffName }
        });
      }
      toast({ title: 'Deal unpublished & archived', description: `"${selectedProperty.listing_title || selectedProperty.address}" moved back to approved stage.` });
      setLastError(null);
      fetchPublishedDeals();
    } catch (err) { showError(err, 'update', { propertyId: selectedProperty.id, action: 'unpublish' }); }
    setActionLoading(null);
    setUnpublishDialogOpen(false);
    setSelectedProperty(null);
  };

  const handleDelete = async () => {
    if (!selectedProperty) return;
    setActionLoading(selectedProperty.id);
    try {
      await archiveProperty(selectedProperty, 'deleted', staffId, staffName);
      const result = await deletePropertyComprehensive(selectedProperty.id, staffId, staffName);
      if (!result.success) throw new Error(result.error || 'Delete failed');
      toast({ title: 'Deal archived & deleted', description: `"${selectedProperty.listing_title || selectedProperty.address}" has been archived and removed.` });
      setLastError(null);
      fetchPublishedDeals();
    } catch (err) { showError(err, 'delete', { propertyId: selectedProperty.id }); }
    setActionLoading(null);
    setDeleteDialogOpen(false);
    setSelectedProperty(null);
  };

  // Toggle featured status
  const handleToggleFeatured = async (property: PublishedProperty) => {
    setActionLoading(property.id);
    try {
      const newFeatured = !property.is_featured;
      const { error } = await supabase.from('properties').update({
        is_featured: newFeatured, updated_at: new Date().toISOString()
      }).eq('id', property.id);
      if (error) {
        await supabase.functions.invoke('update-property', {
          body: { id: property.id, is_featured: newFeatured, updated_by_staff_id: staffId, updated_by_staff_name: staffName }
        });
      }
      toast({ title: newFeatured ? 'Deal Featured' : 'Feature Removed', description: `"${property.listing_title || property.address}" ${newFeatured ? 'is now featured on the homepage.' : 'has been unfeatured.'}` });
      fetchPublishedDeals();
    } catch (err) { showError(err, 'update', { propertyId: property.id }); }
    setActionLoading(null);
  };

  // Approve/Reject AM-submitted deal
  const handleApproveReject = async () => {
    if (!approveRejectProperty || !approveRejectAction) return;
    setActionLoading(approveRejectProperty.id);
    try {
      const newStatus = approveRejectAction === 'approve' ? 'published' : 'rejected';
      const updates: any = {
        deal_status: newStatus,
        workflow_stage: newStatus,
        status: newStatus,
        is_published: approveRejectAction === 'approve',
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('properties').update(updates).eq('id', approveRejectProperty.id);
      if (error) {
        await supabase.functions.invoke('update-property', {
          body: { id: approveRejectProperty.id, ...updates, updated_by_staff_id: staffId, updated_by_staff_name: staffName }
        });
      }
      // Notify AM
      if (approveRejectProperty.submitted_by_am_id) {
        try {
          await supabase.functions.invoke('am-submit-deal', {
            body: {
              action: approveRejectAction === 'approve' ? 'notify_marketplace_posted' : 'notify_deal_rejected',
              property_id: approveRejectProperty.id,
              posted_by_name: staffName || 'Success Team'
            }
          });
        } catch (e) { console.warn('Failed to notify AM:', e); }
      }
      toast({
        title: approveRejectAction === 'approve' ? 'Deal Approved' : 'Deal Rejected',
        description: `"${approveRejectProperty.listing_title || approveRejectProperty.address}" has been ${approveRejectAction === 'approve' ? 'approved and published' : 'rejected'}.`
      });
      setLastError(null);
      fetchPublishedDeals();
    } catch (err) { showError(err, 'update', { propertyId: approveRejectProperty.id }); }
    setActionLoading(null);
    setApproveRejectDialogOpen(false);
    setApproveRejectProperty(null);
    setApproveRejectAction(null);
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedInView.size === 0) return;
    setBulkActionLoading(true);
    const total = selectedInView.size;
    setBulkProgress({ current: 0, total });
    const selectedProperties = properties.filter(p => selectedInView.has(p.id));
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedProperties.length; i++) {
      const property = selectedProperties[i];
      setBulkProgress({ current: i + 1, total });
      try {
        if (bulkAction === 'feature' || bulkAction === 'unfeature') {
          const newFeatured = bulkAction === 'feature';
          await supabase.from('properties').update({ is_featured: newFeatured, updated_at: new Date().toISOString() }).eq('id', property.id);
          successCount++;
        } else if (bulkAction === 'unpublish') {
          await archiveProperty(property, 'unpublished', staffId, staffName);
          await supabase.from('properties').update({
            is_published: false, deal_status: 'approved', workflow_stage: 'approved', status: 'approved', updated_at: new Date().toISOString()
          }).eq('id', property.id);
          successCount++;
        } else if (bulkAction === 'delete') {
          await archiveProperty(property, 'deleted', staffId, staffName);
          const result = await deletePropertyComprehensive(property.id, staffId, staffName);
          if (!result.success) throw new Error(result.error);
          successCount++;
        }
      } catch (err) { failCount++; }
    }

    const actionLabels: Record<string, string> = { feature: 'featured', unfeature: 'unfeatured', unpublish: 'unpublished', delete: 'deleted' };
    toast({
      title: `Bulk ${actionLabels[bulkAction]} complete`,
      description: `${successCount} deal${successCount !== 1 ? 's' : ''} ${actionLabels[bulkAction]}${failCount > 0 ? `, ${failCount} failed` : ''}.`,
      variant: failCount > 0 ? 'destructive' : 'default'
    });

    setBulkActionLoading(false);
    setBulkActionDialogOpen(false);
    setBulkAction(null);
    setBulkProgress({ current: 0, total: 0 });
    setSelectedIds(new Set());
    fetchPublishedDeals();
  };

  const typeLabels: Record<string, string> = {
    apartment: 'Apartment', private_landlord: 'Private', townhome: 'Townhome',
    single_family: 'SFH', condo: 'Condo', multi_family: 'Multi-Family'
  };

  const canManage = ['Admin', 'Success_Manager', 'Acquisition_Manager'].includes(userRole || '');

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              Published Deals
            </CardTitle>
            <CardDescription>
              All deals currently live on the marketplace. {properties.length} deal{properties.length !== 1 ? 's' : ''} published.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedInView.size > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection} className="text-gray-500">
                <XCircle className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchPublishedDeals} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Error Banner */}
        {lastError && (
          <div className={`mb-4 p-4 rounded-lg border ${getErrorBannerColors(lastError.category)}`}>
            <div className="flex items-start gap-3">
              <ErrorIcon category={lastError.category} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm">{lastError.title}</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono bg-white/60 px-2 py-0.5 rounded">{lastError.errorCode}</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copyErrorRef}><Copy className="w-3 h-3 mr-1" /> Copy</Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setLastError(null)}><XCircle className="w-4 h-4" /></Button>
                  </div>
                </div>
                <p className="text-sm mt-1 opacity-90">{lastError.description}</p>
                <div className="mt-2 p-2 bg-white/40 rounded text-xs">
                  <p className="font-medium flex items-center gap-1"><Info className="w-3 h-3" /> What to do:</p>
                  <p className="mt-0.5">{lastError.supportAction}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search by title, address, city, state, or ZIP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Property Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="apartment">Apartment</SelectItem>
              <SelectItem value="private_landlord">Private</SelectItem>
              <SelectItem value="townhome">Townhome</SelectItem>
              <SelectItem value="single_family">SFH</SelectItem>
              <SelectItem value="condo">Condo</SelectItem>
              <SelectItem value="multi_family">Multi-Family</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[160px]"><ArrowUpDown className="w-4 h-4 mr-2" /><SelectValue placeholder="Sort By" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="price_high">Price: High to Low</SelectItem>
              <SelectItem value="price_low">Price: Low to High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
            <p className="text-2xl font-bold text-emerald-700">{properties.length}</p>
            <p className="text-xs text-emerald-600">Total Published</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
            <p className="text-2xl font-bold text-amber-700">{properties.filter(p => p.is_featured).length}</p>
            <p className="text-xs text-amber-600">Featured</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
            <p className="text-2xl font-bold text-blue-700">{properties.filter(p => p.is_verified).length}</p>
            <p className="text-xs text-blue-600">Verified</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
            <p className="text-2xl font-bold text-purple-700">{properties.filter(p => (p.photos?.length || 0) > 0).length}</p>
            <p className="text-xs text-purple-600">With Photos</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-center">
            <p className="text-2xl font-bold text-indigo-700">{selectedInView.size}</p>
            <p className="text-xs text-indigo-600">Selected</p>
          </div>
        </div>

        {/* Select All Row */}
        {canManage && filtered.length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              {allFilteredSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : someFilteredSelected ? <MinusSquare className="w-5 h-5 text-indigo-400" /> : <Square className="w-5 h-5 text-gray-400" />}
              {allFilteredSelected ? 'Deselect All' : `Select All ${filtered.length} Deals`}
            </button>
            {someFilteredSelected && <span className="text-xs text-gray-500">({selectedInView.size} of {filtered.length} selected)</span>}
          </div>
        )}

        {/* Loading / Empty / Grid */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">{searchTerm || typeFilter !== 'all' ? 'No published deals match your filters.' : 'No deals are currently published.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
            {filtered.map((property) => {
              const isSelected = selectedIds.has(property.id);
              const isAMSubmitted = !!property.submitted_by_am_name;
              return (
                <Card key={property.id} className={`hover:shadow-lg transition-all relative group ${actionLoading === property.id ? 'opacity-50 pointer-events-none' : ''} ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-300 bg-indigo-50/30' : 'border-l-4 border-l-emerald-500'}`}>
                  {actionLoading === property.id && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20 rounded-lg"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
                  )}

                  {/* Checkbox */}
                  {canManage && (
                    <button onClick={(e) => { e.stopPropagation(); toggleSelect(property.id); }}
                      className={`absolute top-3 left-3 z-10 w-6 h-6 rounded flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/90 text-gray-400 border border-gray-300 opacity-0 group-hover:opacity-100'}`}>
                      {isSelected && <CheckCircle className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Photo */}
                  {property.photos && property.photos.length > 0 ? (
                    <div className="relative h-40 overflow-hidden rounded-t-lg">
                      <img src={property.photos[0]} alt={property.listing_title || property.address} className="w-full h-full object-cover" />
                      {property.photos.length > 1 && (
                        <Badge className="absolute bottom-2 right-2 bg-black/60 text-white"><Image className="w-3 h-3 mr-1" />{property.photos.length}</Badge>
                      )}
                      {property.is_featured && (
                        <Badge className="absolute top-2 right-2 bg-amber-500 text-white"><Star className="w-3 h-3 mr-1 fill-white" />Featured</Badge>
                      )}
                      {isAMSubmitted && (
                        <Badge className="absolute top-2 left-10 bg-indigo-600 text-white text-[10px]">AM: {property.submitted_by_am_name}</Badge>
                      )}
                    </div>
                  ) : (
                    <div className="h-32 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-t-lg flex items-center justify-center relative">
                      <Building className="w-10 h-10 text-emerald-300" />
                      {isAMSubmitted && (
                        <Badge className="absolute top-2 left-10 bg-indigo-600 text-white text-[10px]">AM: {property.submitted_by_am_name}</Badge>
                      )}
                    </div>
                  )}

                  <CardContent className="p-4">
                    {/* Badges */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge className="bg-emerald-100 text-emerald-700"><Globe className="w-3 h-3 mr-1" /> Published</Badge>
                      {property.property_type && <Badge variant="outline">{typeLabels[property.property_type] || property.property_type}</Badge>}
                      {property.is_verified && <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>}
                    </div>

                    <h3 className="font-semibold text-lg mb-1 truncate">{property.listing_title || `${property.bedrooms}BR in ${property.city}`}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-2"><MapPin className="w-3 h-3" />{property.city}, {property.state} {property.zip_code}</div>
                    <p className="text-xs text-gray-400 mb-2 truncate" title={property.address}>{property.address}</p>

                    <div className="flex gap-3 text-sm text-gray-700 mb-3">
                      {property.bedrooms && <span className="flex items-center gap-1"><Bed className="w-4 h-4" /> {property.bedrooms}</span>}
                      {property.bathrooms && <span className="flex items-center gap-1"><Bath className="w-4 h-4" /> {property.bathrooms}</span>}
                      {property.monthly_rent && <span className="flex items-center gap-1 font-semibold text-green-600"><DollarSign className="w-4 h-4" /> {property.monthly_rent.toLocaleString()}/mo</span>}
                    </div>

                    {/* Financial summary */}
                    {(property.adr_peak_season || property.avg_occupancy_rate) && (
                      <div className="flex gap-2 text-xs text-gray-500 mb-2 flex-wrap">
                        {property.adr_peak_season && <span className="bg-green-50 px-2 py-0.5 rounded">ADR: ${property.adr_peak_season}</span>}
                        {property.avg_occupancy_rate && <span className="bg-blue-50 px-2 py-0.5 rounded">Occ: {property.avg_occupancy_rate}%</span>}
                        {property.monthly_room_rate && <span className="bg-purple-50 px-2 py-0.5 rounded">Room: ${property.monthly_room_rate}/mo</span>}
                      </div>
                    )}

                    {/* Penny Score */}
                    {property.penny_score != null && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">Penny Score</span>
                          <span className={`font-bold ${property.penny_score >= 70 ? 'text-green-600' : property.penny_score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>{property.penny_score}/100</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${property.penny_score >= 70 ? 'bg-green-500' : property.penny_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${property.penny_score}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <span>Fee: ${property.acquisition_fee?.toLocaleString() || '2,500'}</span>
                      <span>Published {new Date(property.updated_at || property.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Actions */}
                    {canManage && (
                      <div className="space-y-2">
                        {/* Primary action row */}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 text-indigo-600 border-indigo-300 hover:bg-indigo-50" onClick={() => { setFinancialProperty(property); setFinancialEditorOpen(true); }}>
                            <Edit className="w-3 h-3 mr-1" /> Financials
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 text-purple-600 border-purple-300 hover:bg-purple-50" onClick={() => { setPhotoProperty(property); setPhotoManagerOpen(true); }}>
                            <Camera className="w-3 h-3 mr-1" /> Photos
                          </Button>
                          <Button size="sm" variant={property.is_featured ? 'default' : 'outline'}
                            className={property.is_featured ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'text-amber-600 border-amber-300 hover:bg-amber-50'}
                            onClick={() => handleToggleFeatured(property)}>
                            <Star className={`w-3 h-3 ${property.is_featured ? 'fill-white' : ''}`} />
                          </Button>
                        </div>
                        {/* Secondary action row */}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => { setSelectedProperty(property); setUnpublishDialogOpen(true); }}>
                            <EyeOff className="w-3 h-3 mr-1" /> Unpublish
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => { setSelectedProperty(property); setDeleteDialogOpen(true); }}>
                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Floating Bulk Action Bar */}
      {canManage && selectedInView.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-[#1a365d] text-white rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><CheckSquare className="w-4 h-4" /></div>
              <div>
                <p className="font-semibold text-sm">{selectedInView.size} deal{selectedInView.size !== 1 ? 's' : ''} selected</p>
                <p className="text-xs text-white/60">of {filtered.length} visible</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <Button size="sm" variant="secondary" className="bg-amber-500 hover:bg-amber-600 text-white border-0"
              onClick={() => { setBulkAction('feature'); setBulkActionDialogOpen(true); }}>
              <Star className="w-4 h-4 mr-1" /> Feature
            </Button>
            <Button size="sm" variant="secondary" className="bg-gray-500 hover:bg-gray-600 text-white border-0"
              onClick={() => { setBulkAction('unfeature'); setBulkActionDialogOpen(true); }}>
              <Star className="w-4 h-4 mr-1" /> Unfeature
            </Button>
            <Button size="sm" variant="secondary" className="bg-orange-500 hover:bg-orange-600 text-white border-0"
              onClick={() => { setBulkAction('unpublish'); setBulkActionDialogOpen(true); }}>
              <EyeOff className="w-4 h-4 mr-1" /> Unpublish
            </Button>
            <Button size="sm" variant="secondary" className="bg-red-500 hover:bg-red-600 text-white border-0"
              onClick={() => { setBulkAction('delete'); setBulkActionDialogOpen(true); }}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
            <div className="w-px h-8 bg-white/20" />
            <Button size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={clearSelection}><XCircle className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* Inline Financial Editor */}
      <InlineFinancialEditor property={financialProperty} open={financialEditorOpen} onOpenChange={setFinancialEditorOpen} staffId={staffId} staffName={staffName} onSaved={fetchPublishedDeals} />

      {/* Photo Management Panel */}
      <PhotoManagementPanel property={photoProperty} open={photoManagerOpen} onOpenChange={setPhotoManagerOpen} staffId={staffId} staffName={staffName} onSaved={fetchPublishedDeals} />

      {/* Unpublish Dialog */}
      <AlertDialog open={unpublishDialogOpen} onOpenChange={setUnpublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><EyeOff className="w-5 h-5 text-orange-500" />Unpublish Deal</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to unpublish <strong>"{selectedProperty?.listing_title || selectedProperty?.address}"</strong>?</p>
              <p className="text-orange-600">This will remove the deal from the public marketplace but keep it in the deal pipeline with an "Approved" status.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProperty(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpublish} className="bg-orange-600 hover:bg-orange-700">
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}<EyeOff className="w-4 h-4 mr-2" />Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600"><Archive className="w-5 h-5" />Archive & Delete Published Deal</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete <strong>"{selectedProperty?.listing_title || selectedProperty?.address}"</strong>?</p>
              <p className="text-amber-600 font-medium">The deal will be archived first, so you can restore it later from the Archived Deals tab.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProperty(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}<Trash2 className="w-4 h-4 mr-2" />Archive & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve/Reject Dialog */}
      <AlertDialog open={approveRejectDialogOpen} onOpenChange={setApproveRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {approveRejectAction === 'approve' ? <ThumbsUp className="w-5 h-5 text-green-600" /> : <ThumbsDown className="w-5 h-5 text-red-600" />}
              {approveRejectAction === 'approve' ? 'Approve Deal' : 'Reject Deal'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{approveRejectAction === 'approve' ? 'Approve and publish' : 'Reject'} <strong>"{approveRejectProperty?.listing_title || approveRejectProperty?.address}"</strong>?</p>
              {approveRejectProperty?.submitted_by_am_name && <p className="text-indigo-600">Submitted by AM: {approveRejectProperty.submitted_by_am_name}</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveReject} className={approveRejectAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {approveRejectAction === 'approve' ? 'Approve & Publish' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Dialog */}
      <AlertDialog open={bulkActionDialogOpen} onOpenChange={(open) => { if (!bulkActionLoading) { setBulkActionDialogOpen(open); if (!open) setBulkAction(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={`flex items-center gap-2 ${bulkAction === 'delete' ? 'text-red-600' : bulkAction === 'feature' ? 'text-amber-600' : 'text-orange-600'}`}>
              {bulkAction === 'delete' ? <><Archive className="w-5 h-5" /> Bulk Delete</> :
               bulkAction === 'feature' ? <><Star className="w-5 h-5" /> Bulk Feature</> :
               bulkAction === 'unfeature' ? <><Star className="w-5 h-5" /> Bulk Unfeature</> :
               <><EyeOff className="w-5 h-5" /> Bulk Unpublish</>}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {bulkActionLoading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /><p className="font-medium">Processing {bulkProgress.current} of {bulkProgress.total} deals...</p></div>
                  <div className="w-full bg-gray-200 rounded-full h-2"><div className="h-2 rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }} /></div>
                </div>
              ) : (
                <p>You are about to <strong>{bulkAction === 'delete' ? 'archive & delete' : bulkAction === 'feature' ? 'feature' : bulkAction === 'unfeature' ? 'unfeature' : 'unpublish'}</strong> <strong>{selectedInView.size} deal{selectedInView.size !== 1 ? 's' : ''}</strong>.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!bulkActionLoading && (
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkAction}
                className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : bulkAction === 'feature' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-orange-600 hover:bg-orange-700'}>
                Confirm ({selectedInView.size} deals)
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
