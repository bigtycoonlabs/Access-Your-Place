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
import { supabase, safeDeleteRows } from '@/lib/supabase';

import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Archive, MapPin, Bed, Bath, DollarSign, Trash2,
  Search, RefreshCw, Image, Building, RotateCcw, Clock,
  Filter, ArrowUpDown, CheckSquare, Square, MinusSquare,
  XCircle, CheckCircle, AlertTriangle, EyeOff, Globe, Star,
  Undo2, Info
} from 'lucide-react';

interface ArchivedProperty {
  id: string;
  original_property_id: string;
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
  original_created_at?: string;
  original_updated_at?: string;
  archived_at: string;
  archived_by_staff_id?: string;
  archived_by_staff_name?: string;
  archive_reason: string;
  original_data?: any;
  created_at: string;
}

interface ArchivedDealsTabProps {
  staffId?: string;
  staffName?: string;
  userRole?: string;
}

export function ArchivedDealsTab({ staffId, staffName, userRole }: ArchivedDealsTabProps) {
  const [archivedDeals, setArchivedDeals] = useState<ArchivedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'reason'>('newest');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Single item dialogs
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<ArchivedProperty | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'restore' | 'permanent_delete' | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const { toast } = useToast();

  useEffect(() => {
    fetchArchivedDeals();
  }, []);

  const fetchArchivedDeals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('archived_properties')
        .select('*')
        .order('archived_at', { ascending: false });

      if (error) throw error;
      setArchivedDeals(data || []);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Failed to fetch archived deals:', err);
      toast({
        title: 'Failed to load archived deals',
        description: err?.message || 'Unknown error',
        variant: 'destructive'
      });
    }
    setLoading(false);
  };

  // Filter and sort
  const filtered = useMemo(() => {
    return archivedDeals
      .filter(p => {
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return (
            (p.listing_title || '').toLowerCase().includes(term) ||
            (p.address || '').toLowerCase().includes(term) ||
            (p.city || '').toLowerCase().includes(term) ||
            (p.state || '').toLowerCase().includes(term) ||
            (p.zip_code || '').toLowerCase().includes(term) ||
            (p.archived_by_staff_name || '').toLowerCase().includes(term)
          );
        }
        return true;
      })
      .filter(p => reasonFilter === 'all' || p.archive_reason === reasonFilter)
      .sort((a, b) => {
        switch (sortBy) {
          case 'newest': return new Date(b.archived_at).getTime() - new Date(a.archived_at).getTime();
          case 'oldest': return new Date(a.archived_at).getTime() - new Date(b.archived_at).getTime();
          case 'reason': return (a.archive_reason || '').localeCompare(b.archive_reason || '');
          default: return 0;
        }
      });
  }, [archivedDeals, searchTerm, reasonFilter, sortBy]);

  // Selection helpers
  const filteredIds = useMemo(() => new Set(filtered.map(p => p.id)), [filtered]);
  const selectedInView = useMemo(() => {
    return new Set([...selectedIds].filter(id => filteredIds.has(id)));
  }, [selectedIds, filteredIds]);

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
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Build a clean restore payload from an archived deal.
  // Handles NOT NULL constraints on properties table:
  //   - address (NOT NULL), city (NOT NULL), state (NOT NULL)
  // Also strips listing_description (GENERATED column).
  // Sets address_needs_update = true when a fallback address is used.
  const buildRestorePayload = (deal: ArchivedProperty) => {
    // Determine if we need a fallback address
    const rawAddress = deal.address || '';
    const hasRealAddress = rawAddress.length > 0
      && rawAddress !== '(Address pending)'
      && !/^[A-Za-z\s]+,\s*[A-Z]{2}(\s+\d{5})?$/.test(rawAddress.trim());

    const fallbackAddress = `${deal.city || 'Unknown'}, ${deal.state || ''} ${deal.zip_code || ''}`.trim() || '(Address pending)';
    const address = hasRealAddress ? rawAddress : fallbackAddress;

    const payload: any = {
      // NOT NULL fields — provide fallbacks for archived rows that have nulls
      address,
      city: deal.city || 'Unknown',
      state: deal.state || 'XX',
      // Flag for staff to know this address needs correction
      address_needs_update: !hasRealAddress,
      // Nullable fields
      zip_code: deal.zip_code || null,
      bedrooms: deal.bedrooms ?? null,
      bathrooms: deal.bathrooms ?? null,
      monthly_rent: deal.monthly_rent ?? null,
      listing_title: deal.listing_title || null,
      // Map listing_description → description (listing_description is a GENERATED column)
      description: deal.listing_description || null,
      property_type: deal.property_type || null,
      source: deal.source || 'acquisition_team',
      acquisition_fee: deal.acquisition_fee ?? null,
      is_published: false, // Always restore as unpublished
      is_featured: deal.is_featured || false,
      is_verified: deal.is_verified || false,
      deal_status: 'approved',
      workflow_stage: 'approved',
      status: 'approved',
      photos: deal.photos || [],
      penny_score: deal.penny_score ?? null,
      units_available: deal.units_available ?? 1,
      created_at: deal.original_created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Strip undefined values to avoid sending them to the DB
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) delete payload[key];
    });

    return payload;
  };


  // Restore a single deal back to properties table
  const handleRestore = async () => {
    if (!selectedDeal) return;
    setActionLoading(selectedDeal.id);

    try {
      const propertyData = buildRestorePayload(selectedDeal);

      // Try to restore with original ID if it was a delete
      if (selectedDeal.archive_reason === 'deleted') {
        // Use the edge function to create a new property
        const { data, error } = await supabase.functions.invoke('create-property', {
          body: propertyData
        });

        if (error || data?.error) {
          console.warn('Edge function restore failed, falling back to direct insert:', error || data?.error);
          // Fallback: direct insert
          const { error: dbError } = await supabase
            .from('properties')
            .insert(propertyData);
          if (dbError) throw dbError;
        }
      } else {
        // For unpublished deals, the original property still exists — just update it
        const { error: updateError } = await supabase
          .from('properties')
          .update({
            is_published: false,
            deal_status: 'approved',
            workflow_stage: 'approved',
            status: 'approved',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedDeal.original_property_id);

        if (updateError) {
          // If original doesn't exist, create new
          const { error: insertError } = await supabase
            .from('properties')
            .insert(propertyData);
          if (insertError) throw insertError;
        }
      }

      // Remove from archive — use safeDeleteRows to avoid Fastify empty-body error
      const { error: deleteError } = await safeDeleteRows('archived_properties', 'id', selectedDeal.id);

      if (deleteError) {
        console.error('Failed to remove from archive:', deleteError);
      }


      toast({
        title: 'Deal restored successfully',
        description: `"${selectedDeal.listing_title || selectedDeal.address || `${selectedDeal.city}, ${selectedDeal.state}`}" has been restored to the deal pipeline with "Approved" status.`
      });
      fetchArchivedDeals();
    } catch (err: any) {
      console.error('Restore failed:', err);
      toast({
        title: 'Restore failed',
        description: err?.message || 'Failed to restore deal',
        variant: 'destructive'
      });
    }

    setActionLoading(null);
    setRestoreDialogOpen(false);
    setSelectedDeal(null);
  };



  // Permanently delete a single deal
  const handlePermanentDelete = async () => {
    if (!selectedDeal) return;
    setActionLoading(selectedDeal.id);

    try {
      // Use safeDeleteRows to avoid Fastify empty-body error
      const { error } = await safeDeleteRows('archived_properties', 'id', selectedDeal.id);

      if (error) throw error;

      toast({
        title: 'Deal permanently deleted',
        description: `"${selectedDeal.listing_title || selectedDeal.address}" has been permanently removed. This cannot be undone.`
      });
      fetchArchivedDeals();
    } catch (err: any) {
      toast({
        title: 'Delete failed',
        description: err?.message || 'Failed to permanently delete deal',
        variant: 'destructive'
      });
    }

    setActionLoading(null);
    setPermanentDeleteDialogOpen(false);
    setSelectedDeal(null);
  };


  // Bulk action handler
  const handleBulkAction = async () => {
    if (!bulkAction || selectedInView.size === 0) return;
    setBulkActionLoading(true);
    const total = selectedInView.size;
    setBulkProgress({ current: 0, total });

    const selectedDeals = archivedDeals.filter(p => selectedInView.has(p.id));
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedDeals.length; i++) {
      const deal = selectedDeals[i];
      setBulkProgress({ current: i + 1, total });

      try {
        if (bulkAction === 'restore') {
          // Use the shared buildRestorePayload helper which handles:
          //   - NOT NULL fallbacks for address/city/state
          //   - listing_description → description mapping (GENERATED column)
          //   - Stripping undefined values
          const propertyData = buildRestorePayload(deal as ArchivedProperty);

          if (deal.archive_reason === 'deleted') {
            const { error } = await supabase.from('properties').insert(propertyData);
            if (error) throw error;
          } else {
            const { error: updateError } = await supabase
              .from('properties')
              .update({
                is_published: false,
                deal_status: 'approved',
                workflow_stage: 'approved',
                status: 'approved',
                updated_at: new Date().toISOString()
              })
              .eq('id', deal.original_property_id);

            if (updateError) {
              const { error: insertError } = await supabase.from('properties').insert(propertyData);
              if (insertError) throw insertError;
            }
          }

          // Remove from archive — use safeDeleteRows to avoid Fastify empty-body error
          const { error: archDelErr } = await safeDeleteRows('archived_properties', 'id', deal.id);
          if (archDelErr) throw archDelErr;
          successCount++;
        } else if (bulkAction === 'permanent_delete') {
          // Use safeDeleteRows to avoid Fastify empty-body error
          const { error } = await safeDeleteRows('archived_properties', 'id', deal.id);
          if (error) throw error;
          successCount++;
        }
      } catch (err) {

        failCount++;
        console.error(`Bulk ${bulkAction} failed for archived deal ${deal.id}:`, err);
      }
    }

    const actionLabel = bulkAction === 'permanent_delete' ? 'permanently deleted' : 'restored';
    toast({
      title: `Bulk ${actionLabel} complete`,
      description: `${successCount} deal${successCount !== 1 ? 's' : ''} ${actionLabel} successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`,
      variant: failCount > 0 ? 'destructive' : 'default'
    });

    setBulkActionLoading(false);
    setBulkActionDialogOpen(false);
    setBulkAction(null);
    setBulkProgress({ current: 0, total: 0 });
    setSelectedIds(new Set());
    fetchArchivedDeals();
  };

  const typeLabels: Record<string, string> = {
    apartment: 'Apartment',
    private_landlord: 'Private',
    townhome: 'Townhome',
    single_family: 'SFH',
    condo: 'Condo',
    multi_family: 'Multi-Family'
  };

  const reasonLabels: Record<string, { label: string; color: string; icon: any }> = {
    deleted: { label: 'Deleted', color: 'bg-red-100 text-red-700 border-red-200', icon: Trash2 },
    unpublished: { label: 'Unpublished', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: EyeOff }
  };

  const canManage = ['Admin', 'Success_Manager', 'Acquisition_Manager'].includes(userRole || '');

  const deletedCount = archivedDeals.filter(d => d.archive_reason === 'deleted').length;
  const unpublishedCount = archivedDeals.filter(d => d.archive_reason === 'unpublished').length;

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-gray-600" />
              Archived Deals
            </CardTitle>
            <CardDescription>
              Deals that have been deleted or unpublished. {archivedDeals.length} deal{archivedDeals.length !== 1 ? 's' : ''} archived.
              Restore deals back to the pipeline or permanently delete them.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedInView.size > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection} className="text-gray-500">
                <XCircle className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchArchivedDeals} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by title, address, city, or archived by..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Archive Reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              <SelectItem value="deleted">Deleted ({deletedCount})</SelectItem>
              <SelectItem value="unpublished">Unpublished ({unpublishedCount})</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="reason">By Reason</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
            <p className="text-2xl font-bold text-gray-700">{archivedDeals.length}</p>
            <p className="text-xs text-gray-500">Total Archived</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
            <p className="text-2xl font-bold text-red-700">{deletedCount}</p>
            <p className="text-xs text-red-600">Deleted</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-center">
            <p className="text-2xl font-bold text-orange-700">{unpublishedCount}</p>
            <p className="text-xs text-orange-600">Unpublished</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-center">
            <p className="text-2xl font-bold text-indigo-700">{selectedInView.size}</p>
            <p className="text-xs text-indigo-600">Selected</p>
          </div>
        </div>

        {/* Select All Row */}
        {canManage && filtered.length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-5 h-5 text-indigo-600" />
              ) : someFilteredSelected ? (
                <MinusSquare className="w-5 h-5 text-indigo-400" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
              {allFilteredSelected ? 'Deselect All' : `Select All ${filtered.length} Archived Deals`}
            </button>
            {someFilteredSelected && (
              <span className="text-xs text-gray-500">
                ({selectedInView.size} of {filtered.length} selected)
              </span>
            )}
          </div>
        )}

        {/* Loading / Empty / Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Archive className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">
              {searchTerm || reasonFilter !== 'all'
                ? 'No archived deals match your filters.'
                : 'No deals have been archived yet.'}
            </p>
            <p className="text-sm text-gray-400">
              {searchTerm || reasonFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'When you delete or unpublish deals, they will appear here for recovery.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-20">
            {filtered.map((deal) => {
              const isSelected = selectedIds.has(deal.id);
              const reasonInfo = reasonLabels[deal.archive_reason] || reasonLabels.deleted;
              const ReasonIcon = reasonInfo.icon;

              return (
                <div
                  key={deal.id}
                  className={`relative group border rounded-lg p-4 transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-indigo-500 border-indigo-300 bg-indigo-50/30' : 'bg-white'
                  } ${actionLoading === deal.id ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {actionLoading === deal.id && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20 rounded-lg">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    {canManage && (
                      <button
                        onClick={() => toggleSelect(deal.id)}
                        className={`mt-1 w-6 h-6 rounded flex items-center justify-center transition-all shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-400 border border-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {isSelected && <CheckCircle className="w-4 h-4" />}
                      </button>
                    )}

                    {/* Photo thumbnail */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                      {deal.photos && deal.photos.length > 0 ? (
                        <img
                          src={deal.photos[0]}
                          alt={deal.listing_title || deal.address}
                          className="w-full h-full object-cover opacity-70"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-800 truncate">
                            {deal.listing_title || `${deal.bedrooms || '?'}BR in ${deal.city || 'Unknown'}`}
                          </h3>
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {deal.address && <span className="truncate max-w-[200px]">{deal.address},</span>}
                            {deal.city}, {deal.state} {deal.zip_code}
                          </div>
                        </div>
                        <Badge className={`shrink-0 ${reasonInfo.color}`}>
                          <ReasonIcon className="w-3 h-3 mr-1" />
                          {reasonInfo.label}
                        </Badge>
                      </div>

                      {/* Details row */}
                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                        {deal.bedrooms && (
                          <span className="flex items-center gap-1">
                            <Bed className="w-3.5 h-3.5" /> {deal.bedrooms} bed
                          </span>
                        )}
                        {deal.bathrooms && (
                          <span className="flex items-center gap-1">
                            <Bath className="w-3.5 h-3.5" /> {deal.bathrooms} bath
                          </span>
                        )}
                        {deal.monthly_rent && (
                          <span className="flex items-center gap-1 font-medium text-green-600">
                            <DollarSign className="w-3.5 h-3.5" /> {deal.monthly_rent.toLocaleString()}/mo
                          </span>
                        )}
                        {deal.property_type && (
                          <Badge variant="outline" className="text-xs">
                            {typeLabels[deal.property_type] || deal.property_type}
                          </Badge>
                        )}
                        {deal.penny_score != null && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            deal.penny_score >= 70 ? 'bg-green-100 text-green-700' :
                            deal.penny_score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            Score: {deal.penny_score}
                          </span>
                        )}
                      </div>

                      {/* Archive meta */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Archived {new Date(deal.archived_at).toLocaleDateString()} at {new Date(deal.archived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {deal.archived_by_staff_name && (
                          <span>by {deal.archived_by_staff_name}</span>
                        )}
                        {deal.original_created_at && (
                          <span>Originally created {new Date(deal.original_created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {canManage && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => {
                            setSelectedDeal(deal);
                            setRestoreDialogOpen(true);
                          }}
                        >
                          <Undo2 className="w-4 h-4 mr-1" /> Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => {
                            setSelectedDeal(deal);
                            setPermanentDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Floating Bulk Action Bar */}
      {canManage && selectedInView.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-gray-800 text-white rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">{selectedInView.size} archived deal{selectedInView.size !== 1 ? 's' : ''} selected</p>
                <p className="text-xs text-white/60">of {filtered.length} visible</p>
              </div>
            </div>

            <div className="w-px h-8 bg-white/20" />

            <Button
              size="sm"
              variant="secondary"
              className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
              onClick={() => {
                setBulkAction('restore');
                setBulkActionDialogOpen(true);
              }}
            >
              <Undo2 className="w-4 h-4 mr-1" />
              Restore All
            </Button>

            <Button
              size="sm"
              variant="secondary"
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                setBulkAction('permanent_delete');
                setBulkActionDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Forever
            </Button>

            <div className="w-px h-8 bg-white/20" />

            <Button
              size="sm"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={clearSelection}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Restore Confirmation */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-600">
              <Undo2 className="w-5 h-5" />
              Restore Deal to Pipeline
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Restore <strong>"{selectedDeal?.listing_title || selectedDeal?.address}"</strong> back to the deal pipeline?
              </p>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                <p className="font-medium flex items-center gap-1">
                  <Info className="w-4 h-4" /> The deal will be restored with "Approved" status
                </p>
                <p className="mt-1">
                  It will not be automatically re-published. You can publish it again from the Deal Pipeline tab.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDeal(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Undo2 className="w-4 h-4 mr-2" />
              Restore Deal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Permanently Delete Deal
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to <strong>permanently delete</strong>{' '}
                <strong>"{selectedDeal?.listing_title || selectedDeal?.address}"</strong>?
              </p>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                <p className="font-medium flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> This action cannot be undone
                </p>
                <p className="mt-1">
                  The archived copy will be permanently removed. There will be no way to recover this deal.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDeal(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation */}
      <AlertDialog open={bulkActionDialogOpen} onOpenChange={(open) => {
        if (!bulkActionLoading) {
          setBulkActionDialogOpen(open);
          if (!open) setBulkAction(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={`flex items-center gap-2 ${bulkAction === 'permanent_delete' ? 'text-red-600' : 'text-emerald-600'}`}>
              {bulkAction === 'permanent_delete' ? (
                <><AlertTriangle className="w-5 h-5" /> Permanently Delete Selected</>
              ) : (
                <><Undo2 className="w-5 h-5" /> Bulk Restore to Pipeline</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {bulkActionLoading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    <p className="font-medium">
                      Processing {bulkProgress.current} of {bulkProgress.total} deals...
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Please don't close this dialog until the operation completes.</p>
                </div>
              ) : (
                <>
                  <p>
                    You are about to <strong>{bulkAction === 'permanent_delete' ? 'permanently delete' : 'restore'}</strong>{' '}
                    <strong>{selectedInView.size} archived deal{selectedInView.size !== 1 ? 's' : ''}</strong>.
                  </p>
                  {bulkAction === 'permanent_delete' ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                      <p className="font-medium flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> This action cannot be undone
                      </p>
                      <p className="mt-1">
                        All selected archived deals will be permanently removed from the system.
                        There will be no way to recover them.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
                      <p className="font-medium flex items-center gap-1">
                        <Undo2 className="w-4 h-4" /> Deals will be restored with "Approved" status
                      </p>
                      <p className="mt-1">
                        Restored deals will appear in the Deal Pipeline tab. They will not be automatically
                        re-published to the marketplace.
                      </p>
                    </div>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!bulkActionLoading && (
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkAction}
                className={bulkAction === 'permanent_delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              >
                {bulkAction === 'permanent_delete' ? (
                  <><Trash2 className="w-4 h-4 mr-2" /> Delete {selectedInView.size} Permanently</>
                ) : (
                  <><Undo2 className="w-4 h-4 mr-2" /> Restore {selectedInView.size} Deals</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
