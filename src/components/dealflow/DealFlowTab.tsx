import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building, Sparkles, Trash2, AlertTriangle, LayoutGrid, Kanban, Copy, XCircle, ShieldAlert, WifiOff, Server, Clock, Info } from 'lucide-react';
import { errorTracker } from '@/services/ErrorTrackingService';

import { Property, DealAnalytics, OutreachRecord, PropertyNote, PropertyPhoto, EmailTemplate } from '@/types/dealflow';
import { DealFlowFilters } from './DealFlowFilters';
import { PropertyCard } from './PropertyCard';
import { PropertyDetailModal } from './PropertyDetailModal';
import { EditPublishModal } from './EditPublishModal';
import { ViewOnlyPropertyModal } from './ViewOnlyPropertyModal';
import { AddDealModal } from './AddDealModal';
import { CSVPropertyImport } from './CSVPropertyImport';
import { PhotoUploadModal } from '@/components/admin/PhotoUploadManager';
import { DealKanbanBoard } from './DealKanbanBoard';
import { PropertyAssignmentModal } from '@/components/admin/PropertyAssignmentModal';
import { Button } from '@/components/ui/button';
import { SOPHelpButton } from '@/components/admin/SOPHelpButton';
import { handleDealError, ClassifiedError } from '@/utils/dealErrorHandler';



interface DealFlowTabProps {
  userRole?: string;
  staffId?: string;
  staffName?: string;
}

// Error category icon mapping
function ErrorIcon({ category }: { category: string }) {
  switch (category) {
    case 'rls_permission': return <ShieldAlert className="w-5 h-5 text-orange-500" />;
    case 'network': return <WifiOff className="w-5 h-5 text-red-500" />;
    case 'edge_function_502': return <Server className="w-5 h-5 text-red-500" />;
    case 'edge_function_timeout': return <Clock className="w-5 h-5 text-yellow-500" />;
    case 'auth_expired': return <ShieldAlert className="w-5 h-5 text-red-500" />;
    default: return <AlertTriangle className="w-5 h-5 text-red-500" />;
  }
}

// Error category color mapping
function getErrorBannerColors(category: string) {
  switch (category) {
    case 'rls_permission': return 'bg-orange-50 border-orange-300 text-orange-900';
    case 'network': return 'bg-red-50 border-red-300 text-red-900';
    case 'edge_function_502': return 'bg-red-50 border-red-300 text-red-900';
    case 'edge_function_timeout': return 'bg-yellow-50 border-yellow-300 text-yellow-900';
    case 'auth_expired': return 'bg-red-50 border-red-300 text-red-900';
    case 'validation': return 'bg-blue-50 border-blue-300 text-blue-900';
    default: return 'bg-red-50 border-red-300 text-red-900';
  }
}

export function DealFlowTab({ userRole = 'Acquisition_Manager', staffId, staffName }: DealFlowTabProps) {
  const isAM = userRole === 'Acquisition_Manager';
  /** Check if a property was submitted/found/added by the current staff member */
  const isOwnDeal = (p: Property): boolean => {
    if (!staffId) return false;
    return (
      p.submitted_by_staff_id === staffId ||
      p.found_by_am_id === staffId ||
      p.added_by_staff_id === staffId
    );
  };

  const [properties, setProperties] = useState<Property[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, DealAnalytics>>({});
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [addressSearch, setAddressSearch] = useState('');
  const [cityState, setCityState] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [csvImportOpen, setCSVImportOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [softDeleteFallbackOpen, setSoftDeleteFallbackOpen] = useState(false);
  const [softDeleteTarget, setSoftDeleteTarget] = useState<Property | null>(null);
  const [softDeleteError, setSoftDeleteError] = useState('');
  const [outreach, setOutreach] = useState<OutreachRecord[]>([]);
  const [notes, setNotes] = useState<PropertyNote[]>([]);
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [marketData, setMarketData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');
  const [lastError, setLastError] = useState<ClassifiedError | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [propertyToAssign, setPropertyToAssign] = useState<Property | null>(null);
  // View-only modal state for AMs viewing deals they don't own
  const [viewOnlyModalOpen, setViewOnlyModalOpen] = useState(false);
  const [viewOnlyProperty, setViewOnlyProperty] = useState<Property | null>(null);
  const [viewOnlyPhotos, setViewOnlyPhotos] = useState<PropertyPhoto[]>([]);
  const { toast } = useToast();


  useEffect(() => { fetchProperties(); fetchTemplates(); }, []);



  /** Show a classified error toast and persist the error in the banner */
  const showError = (err: unknown, operation: Parameters<typeof handleDealError>[1], context?: Record<string, any>) => {
    const { toast: toastData, classified } = handleDealError(err, operation, context);
    setLastError(classified);
    toast(toastData);
    return classified;
  };

  /** Copy error reference to clipboard */
  const copyErrorRef = () => {
    if (!lastError) return;
    const text = `Error Reference: ${lastError.errorCode}\nCategory: ${lastError.category}\nTime: ${lastError.timestamp}\nDetails: ${lastError.rawMessage.slice(0, 300)}`;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied to clipboard', description: 'Error details copied — paste into your support message.' });
    });
  };

  // Direct database fetch as fallback when edge functions fail
  const fetchPropertiesDirect = async () => {
    let query = supabase.from('properties').select('*');
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
    if (typeFilter !== 'all') query = query.eq('property_type', typeFilter);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      // Try edge function first — suppress expected fallback error
      errorTracker.suppressNextEdgeFunctionError = true;
      const { data, error } = await supabase.functions.invoke('get-properties', {
        body: { status: statusFilter !== 'all' ? statusFilter : undefined, source: sourceFilter !== 'all' ? sourceFilter : undefined, property_type: typeFilter !== 'all' ? typeFilter : undefined }
      });

      
      if (error || data?.error) {
        // Fallback to direct database query
        console.log('Edge function failed, using direct database query:', error?.message || data?.error);
        const directData = await fetchPropertiesDirect();
        setProperties(directData);
        // Clear any previous error if fallback succeeded
        if (lastError?.category === 'edge_function_502') setLastError(null);
        toast({ title: 'Loaded from database', description: 'Edge function unavailable — loaded deals directly from database.' });
      } else if (data?.properties) {
        setProperties(data.properties);
        const analyticsMap: Record<string, DealAnalytics> = {};
        data.properties.forEach((p: any) => { if (p.deal_analytics?.[0]) analyticsMap[p.id] = p.deal_analytics[0]; });
        setAnalytics(analyticsMap);
        // Clear errors on success
        setLastError(null);
      }
    } catch (err: any) { 
      // Final fallback
      try {
        const directData = await fetchPropertiesDirect();
        setProperties(directData);
      } catch (dbErr: any) {
        showError(dbErr, 'fetch', { phase: 'direct_database_fallback', originalEdgeFunctionError: err?.message });
      }
    }
    setLoading(false);
  };

  const fetchTemplates = async () => { try { const { data } = await supabase.from('email_templates').select('*'); if (data) setTemplates(data); } catch (err) { console.error('Error fetching templates:', err); } };

  const searchProperties = async () => {
    setSearching(true);
    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke('get-properties', { body: { zip_code: zipCode || undefined, address: addressSearch || undefined } });
      
      if (error || data?.error) {
        // Fallback to direct database query
        let query = supabase.from('properties').select('*');
        if (zipCode) query = query.ilike('zip_code', `%${zipCode}%`);
        if (addressSearch) query = query.ilike('address', `%${addressSearch}%`);
        const { data: directData, error: dbError } = await query.order('created_at', { ascending: false });
        if (dbError) throw dbError;
        setProperties(directData || []);
      } else if (data?.properties) { 
        setProperties(data.properties); 
      }
    } catch (err: any) {
      showError(err, 'search', { zipCode, addressSearch });
    }
    setSearching(false);
  };

  const discoverProperties = async () => {
    if (!zipCode) { toast({ title: 'ZIP Code Required', description: 'Please enter a ZIP code', variant: 'destructive' }); return; }
    setDiscovering(true);
    const [city, state] = cityState.split(',').map(s => s.trim());
    toast({ title: 'AI Property Discovery', description: `Researching properties in ${zipCode}...` });
    try {
      const { data, error } = await supabase.functions.invoke('research-zip-properties', { body: { zip_code: zipCode, city: city || undefined, state: state || undefined } });
      if (error) {
        showError(error, 'discover', { zipCode, city, state });
      } else if (data) {
        setMarketData(data.market_data);
        toast({ title: 'Properties Discovered!', description: `Found ${data.properties_found || 0} potential deals` });
        fetchProperties();
      }
    } catch (err: any) {
      showError(err, 'discover', { zipCode, city, state });
    }
    setDiscovering(false);
  };

  const handleAddDeal = async () => { toast({ title: 'Deal Added', description: 'New deal has been added to the deal flow' }); setLastError(null); fetchProperties(); };

  // Delete property - edge function first (comprehensive FK cascade), then direct DB fallback, then soft-delete offer
  const handleDeleteDeal = async () => {
    if (!propertyToDelete) return;
    const propertyId = propertyToDelete.id;
    const propertyLabel = propertyToDelete.listing_title || propertyToDelete.address || propertyId;
    setDeleting(true);
    
    try {
      console.log('[DealFlow] Deleting property:', propertyId, propertyLabel);

      // Strategy: Edge function first (it has service_role_key and comprehensive FK cascade)
      // Then direct DB fallback, then offer soft-delete
      let deleted = false;
      let lastDeleteError = '';

      // Attempt 1: Edge function (most reliable - uses service_role_key)
      try {
        const { data, error } = await supabase.functions.invoke('delete-property', {
          body: { property_id: propertyId, staff_id: staffId, staff_name: staffName }
        });
        
        if (!error && data?.success) {
          deleted = true;
          const method = data.soft_delete ? 'soft-deleted' : 'permanently deleted';
          toast({ 
            title: 'Deal Deleted', 
            description: `"${propertyLabel}" has been archived and ${method}.${data.tables_cleaned?.length ? ` Cleaned: ${data.tables_cleaned.length} related tables.` : ''}` 
          });
        } else {
          lastDeleteError = error?.message || data?.error || 'Edge function returned error';
          console.warn('[DealFlow] Edge function delete failed:', lastDeleteError);
        }
      } catch (efErr: any) {
        lastDeleteError = efErr?.message || 'Edge function unreachable';
        console.warn('[DealFlow] Edge function exception:', lastDeleteError);
      }

      // Attempt 2: Direct database cascade delete
      if (!deleted) {
        try {
          console.log('[DealFlow] Trying direct DB cascade delete...');
          
          // Archive first
          try {
            await supabase.from('archived_properties').insert({
              original_property_id: propertyToDelete.id,
              address: propertyToDelete.address, city: propertyToDelete.city, state: propertyToDelete.state,
              zip_code: propertyToDelete.zip_code, bedrooms: propertyToDelete.bedrooms, bathrooms: propertyToDelete.bathrooms,
              monthly_rent: propertyToDelete.monthly_rent, listing_title: propertyToDelete.listing_title,
              listing_description: propertyToDelete.description || propertyToDelete.listing_description, property_type: propertyToDelete.property_type,
              source: propertyToDelete.source, acquisition_fee: propertyToDelete.acquisition_fee,

              is_published: propertyToDelete.is_published,
              is_featured: (propertyToDelete as any).is_featured || false,
              is_verified: (propertyToDelete as any).is_verified || false,
              deal_status: propertyToDelete.deal_status || propertyToDelete.status,
              workflow_stage: (propertyToDelete as any).workflow_stage, status: propertyToDelete.status,
              photos: propertyToDelete.photos, penny_score: (propertyToDelete as any).penny_score,
              units_available: (propertyToDelete as any).units_available,
              original_created_at: propertyToDelete.created_at,
              original_updated_at: (propertyToDelete as any).updated_at,
              archived_by_staff_id: staffId, archived_by_staff_name: staffName,
              archive_reason: 'deleted', original_data: propertyToDelete as any
            });
          } catch (archiveErr) { console.warn('Archive failed:', archiveErr); }

          // Clean deal_listings children
          let listingIds: string[] = [];
          try {
            const { data: listings } = await supabase.from('deal_listings').select('id').eq('property_id', propertyId);
            listingIds = (listings || []).map(l => l.id);
          } catch (e) {}
          if (listingIds.length > 0) {
            for (const table of ['marketplace_verification_alerts','deal_verifications','deal_transactions','marketplace_payments','marketplace_offers','marketplace_interests','marketplace_closed_deals','deal_offers','deal_negotiations']) {
              for (const lid of listingIds) { try { await supabase.from(table).delete().eq('listing_id', lid); } catch(e){} }
            }
            try { await supabase.from('deal_listings').delete().eq('property_id', propertyId); } catch(e){}
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
          const otherTables = [
            'property_photos','deal_analytics','property_analytics','outreach_tracking','outreach_notes',
            'deal_activity_log','deal_workflow_stages','deal_inquiries','saved_deals','deal_reservations',
            'investor_favorites','property_expenses','deal_alerts','deal_alert_notifications',
            'deal_scores','property_referrals','deal_matches','portfolio_property_links',
            'setup_tasks','setup_quotes','property_setup_progress'
          ];
          for (const table of otherTables) {
            try { await supabase.from(table).delete().eq('property_id', propertyId); } catch(e){}
          }

          // Final delete
          const { error: deleteError } = await supabase.from('properties').delete().eq('id', propertyId);
          if (deleteError) throw deleteError;

          deleted = true;
          toast({ title: 'Deal Deleted', description: `"${propertyLabel}" has been archived and removed via direct database.` });
        } catch (dbErr: any) {
          lastDeleteError = `Direct DB: ${dbErr?.message || 'Unknown'}. Edge Function: ${lastDeleteError}`;
          console.warn('[DealFlow] Direct DB delete also failed:', dbErr?.message);
        }
      }

      if (deleted) {
        setLastError(null);
        setDeleteDialogOpen(false);
        setPropertyToDelete(null);
        fetchProperties();
      } else {
        // Both methods failed — offer soft-delete fallback
        console.log('[DealFlow] Both delete methods failed. Offering soft-delete fallback.');
        setDeleteDialogOpen(false);
        setSoftDeleteError(lastDeleteError);
        setSoftDeleteTarget(propertyToDelete);
        setSoftDeleteFallbackOpen(true);
      }
    } catch (err: any) {
      showError(err, 'delete', { propertyId, propertyLabel });
      setDeleteDialogOpen(false);
      setPropertyToDelete(null);
    }
    setDeleting(false);
  };

  // Soft-delete fallback: mark as deleted + unpublished without removing from DB
  const handleSoftDeleteFallback = async () => {
    if (!softDeleteTarget) return;
    setDeleting(true);
    try {
      // Try edge function soft-delete mode first
      try {
        const { data, error } = await supabase.functions.invoke('delete-property', {
          body: { property_id: softDeleteTarget.id, soft_delete: true, staff_id: staffId, staff_name: staffName }
        });
        if (!error && data?.success) {
          toast({ title: 'Deal Soft-Deleted', description: `"${softDeleteTarget.listing_title || softDeleteTarget.address}" marked as deleted and unpublished. It will no longer appear in the marketplace.` });
          setSoftDeleteFallbackOpen(false);
          setSoftDeleteTarget(null);
          setLastError(null);
          fetchProperties();
          setDeleting(false);
          return;
        }
      } catch(e) {}

      // Direct DB soft-delete
      const { error } = await supabase.from('properties').update({
        status: 'deleted', is_published: false, deal_status: 'deleted',
        workflow_stage: 'deleted', updated_at: new Date().toISOString()
      }).eq('id', softDeleteTarget.id);
      
      if (error) throw error;
      
      toast({ title: 'Deal Soft-Deleted', description: `"${softDeleteTarget.listing_title || softDeleteTarget.address}" marked as deleted and unpublished. It will no longer appear in the marketplace.` });
      setSoftDeleteFallbackOpen(false);
      setSoftDeleteTarget(null);
      setLastError(null);
      fetchProperties();
    } catch (err: any) {
      showError(err, 'delete', { propertyId: softDeleteTarget.id, method: 'soft_delete_fallback' });
    }
    setDeleting(false);
  };






  // Clear all deals with fallback to direct database
  const handleClearAllDeals = async () => {
    setClearing(true);
    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke('clear-all-properties', { body: { confirm: 'DELETE_ALL_PROPERTIES' } });
      
      if (error || data?.error) {
        console.log('Edge function failed, using direct database clear:', error?.message || data?.error);
        
        // Fallback: Comprehensive cascade delete of all related records, then properties
        // 1. Find all deal_listings first
        let allListingIds: string[] = [];
        try {
          const { data: listings } = await supabase.from('deal_listings').select('id');
          allListingIds = (listings || []).map(l => l.id);
        } catch (e) {
          console.log('No deal_listings table');
        }

        // 2. Delete listing-child tables
        if (allListingIds.length > 0) {
          for (const table of ['marketplace_verification_alerts', 'deal_verifications', 'deal_transactions', 'marketplace_payments']) {
            try {
              await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            } catch (e) {
              console.log(`Note: Could not clear ${table}`);
            }
          }
          try {
            await supabase.from('deal_listings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          } catch (e) {
            console.log('Note: Could not clear deal_listings');
          }
        }

        // 3. Delete all property-child tables
        const relatedTables = [
          'property_photos', 'deal_analytics', 'outreach_tracking', 'outreach_notes',
          'deal_workflow_stages', 'deal_inquiries', 'deal_activity_log',
          'property_assignments', 'saved_deals', 'deal_reservations'
        ];
        for (const table of relatedTables) {
          try {
            await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          } catch (e) {
            console.log(`Note: Could not clear ${table}`);
          }
        }
        
        // 4. Delete all properties
        const { error: deleteError } = await supabase.from('properties').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) throw deleteError;
        
        toast({ title: 'All deals cleared!', description: 'Successfully removed all properties from the database.' });
        setProperties([]);
        setAnalytics({});
        setLastError(null);
      } else { 
        toast({ title: 'All deals cleared!', description: `Successfully removed ${data?.deleted_count || 0} properties from the database.` }); 
        setProperties([]); 
        setAnalytics({});
        setLastError(null);
      }
    } catch (err: any) {
      showError(err, 'clear', { propertyCount: properties.length });
    }
    setClearing(false);
    setClearAllDialogOpen(false);
  };


  const openDetailModal = async (property: Property) => {
    setSelectedProperty(property);
    try {
      const [{ data: o }, { data: n }, { data: p }] = await Promise.all([
        supabase.from('outreach_tracking').select('*').eq('property_id', property.id).order('created_at', { ascending: false }),
        supabase.from('outreach_notes').select('*').eq('property_id', property.id).order('created_at', { ascending: false }),
        supabase.from('property_photos').select('*').eq('property_id', property.id)
      ]);
      setOutreach(o || []); setNotes(n || []); setPhotos(p || []);
    } catch (err) {
      console.error('Error loading property details:', err);
      showError(err, 'fetch', { propertyId: property.id, phase: 'load_detail_modal' });
    }
    setDetailModalOpen(true);
  };

  const openPhotoModal = (property: Property) => { setSelectedProperty(property); setPhotoModalOpen(true); };

  // Update property with fallback to direct database
  const handleSavePhotos = async (photoUrls: string[]) => {
    if (!selectedProperty) return;
    try { 
      const { data, error } = await supabase.functions.invoke('update-property', { body: { id: selectedProperty.id, photos: photoUrls, updated_by_staff_id: staffId, updated_by_staff_name: staffName } }); 
      
      if (error || data?.error) {
        // Fallback to direct database update
        const { error: dbError } = await supabase.from('properties').update({ photos: photoUrls, updated_at: new Date().toISOString() }).eq('id', selectedProperty.id);
        if (dbError) throw dbError;
      }
      
      toast({ title: 'Photos updated successfully!' }); 
      fetchProperties(); 
    }
    catch (err: any) {
      showError(err, 'photos', { propertyId: selectedProperty.id, photoCount: photoUrls.length });
    }
  };

  // Update status with fallback to direct database
  const handleUpdateStatus = async (status: string) => {
    if (!selectedProperty) return;
    try { 
      const { data, error } = await supabase.functions.invoke('update-property', { body: { id: selectedProperty.id, deal_status: status, updated_by_staff_id: staffId, updated_by_staff_name: staffName } }); 
      
      if (error || data?.error) {
        // Fallback to direct database update
        const { error: dbError } = await supabase.from('properties').update({ deal_status: status, updated_at: new Date().toISOString() }).eq('id', selectedProperty.id);
        if (dbError) throw dbError;
      }
      
      toast({ title: `Status updated to ${status}` }); 
      fetchProperties(); 
    }
    catch (err: any) {
      showError(err, 'update', { propertyId: selectedProperty.id, targetStatus: status });
    }
  };

  // Publish with fallback to direct database
  const handlePublish = async () => {
    if (!selectedProperty) return;
    try { 
      errorTracker.suppressNextEdgeFunctionError = true;
      const { data, error } = await supabase.functions.invoke('update-property', { body: { id: selectedProperty.id, is_published: true, deal_status: 'published', workflow_stage: 'published', status: 'published', updated_by_staff_id: staffId, updated_by_staff_name: staffName } }); 

      
      if (error || data?.error) {
        // Fallback to direct database update
        const { error: dbError } = await supabase.from('properties').update({ 
          is_published: true, 
          deal_status: 'published', 
          workflow_stage: 'published',
          status: 'published',
          updated_at: new Date().toISOString() 
        }).eq('id', selectedProperty.id);
        if (dbError) throw dbError;
      }
      
      // Notify the submitting AM that their deal is now live on the marketplace
      try {
        await supabase.functions.invoke('am-submit-deal', {
          body: {
            action: 'notify_marketplace_posted',
            property_id: selectedProperty.id,
            posted_by_name: staffName || 'Success Team'
          }
        });
      } catch (notifyErr) {
        console.warn('[DealFlow] Failed to send marketplace posted notification to AM:', notifyErr);
      }

      toast({ title: 'Deal published!', description: 'Deal is now live on the marketplace. Submitting AM has been notified.' }); 
      setEditModalOpen(false); 
      fetchProperties(); 
    }
    catch (err: any) {
      showError(err, 'publish', { propertyId: selectedProperty.id });
    }
  };


  const filtered = properties.filter(p => (statusFilter === 'all' || p.status === statusFilter) && (sourceFilter === 'all' || p.source === sourceFilter) && (typeFilter === 'all' || p.property_type === typeFilter));
  // Normalise userRole so case / underscore variations ('success_manager',
  // 'acquisition-manager', 'ACQUISITION_MANAGER', etc.) don't accidentally
  // lock the Acquisition team out of their deal-upload buttons.
  const normalisedRole = (userRole || '').toLowerCase().replace(/[-\s]/g, '_');
  const canAddDeals =
    normalisedRole === 'admin' ||
    normalisedRole === 'success_manager' ||
    normalisedRole === 'success_team' ||
    normalisedRole === 'acquisition_manager';
  const canClearDeals =
    normalisedRole === 'admin' ||
    normalisedRole === 'success_manager' ||
    normalisedRole === 'success_team';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Building className="w-5 h-5" /> Deal Flow Management</CardTitle>
            <CardDescription>{canAddDeals ? 'Search, discover, add/delete deals, or import from CSV' : 'View and manage property deals'}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <SOPHelpButton searchKeyword="property research" buttonText="Research SOP" variant="outline" size="sm" />
            <SOPHelpButton searchKeyword="deal negotiation" buttonText="Negotiation SOP" variant="outline" size="sm" />
            <div className="flex border rounded-lg overflow-hidden">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}><LayoutGrid className="w-4 h-4" /></Button>
              <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className={viewMode === 'kanban' ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}><Kanban className="w-4 h-4" /></Button>
            </div>
            {canClearDeals && properties.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setClearAllDialogOpen(true)}><Trash2 className="w-4 h-4 mr-2" />Clear All ({properties.length})</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Persistent Error Banner */}
        {lastError && (
          <div className={`mb-4 p-4 rounded-lg border ${getErrorBannerColors(lastError.category)}`}>
            <div className="flex items-start gap-3">
              <ErrorIcon category={lastError.category} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm">{lastError.title}</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono bg-white/60 px-2 py-0.5 rounded">{lastError.errorCode}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={copyErrorRef}
                      title="Copy error details for support"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy for Support
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setLastError(null)}
                      title="Dismiss"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm mt-1 opacity-90">{lastError.description}</p>
                <div className="mt-2 p-2 bg-white/40 rounded text-xs">
                  <p className="font-medium flex items-center gap-1"><Info className="w-3 h-3" /> What to do:</p>
                  <p className="mt-0.5">{lastError.supportAction}</p>
                </div>
                <p className="text-xs mt-2 opacity-60">
                  {new Date(lastError.timestamp).toLocaleTimeString()} — Category: {lastError.category}
                </p>
              </div>
            </div>
          </div>
        )}

        <DealFlowFilters zipCode={zipCode} onZipCodeChange={setZipCode} addressSearch={addressSearch} onAddressSearchChange={setAddressSearch} cityState={cityState} onCityStateChange={setCityState} onSearch={searchProperties} onDiscover={discoverProperties} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} sourceFilter={sourceFilter} onSourceFilterChange={setSourceFilter} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} onRefresh={fetchProperties} searching={searching} discovering={discovering} onAddDeal={canAddDeals ? () => setAddModalOpen(true) : undefined} onImportCSV={canAddDeals ? () => setCSVImportOpen(true) : undefined} />
        {marketData && (
          <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
            <h4 className="font-semibold text-purple-800 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Market: {marketData.zip_code}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
              <div><span className="text-gray-600">Avg Rent:</span> ${marketData.avg_rent_2br}/mo</div>
              <div><span className="text-gray-600">STR ADR:</span> ${marketData.str_avg_adr}/night</div>
              <div><span className="text-gray-600">Occupancy:</span> {Math.round((marketData.str_avg_occupancy || 0) * 100)}%</div>
              <div><span className="text-gray-600">Regs:</span> <span className={marketData.str_regulations === 'friendly' ? 'text-green-600' : 'text-red-600'}>{marketData.str_regulations}</span></div>
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : viewMode === 'kanban' ? (
          <div className="mt-6"><DealKanbanBoard properties={filtered} onRefresh={fetchProperties} onViewDetails={openDetailModal} staffId={staffId} staffName={staffName} canAssign={canAddDeals} onOpenFullAssignModal={(property: any) => { setPropertyToAssign(property); setAssignModalOpen(true); }} /></div>

        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {filtered.map(p => {
              const own = isOwnDeal(p);
              return (
                <PropertyCard
                  key={p.id}
                  property={p}
                  analytics={analytics[p.id]}
                  userRole={userRole}
                  isOwnDeal={own}
                  onViewDetails={() => openDetailModal(p)}
                  onEditPublish={() => {
                    if (isAM && !own) return;
                    setSelectedProperty(p);
                    setPhotos([]);
                    supabase.from('property_photos').select('*').eq('property_id', p.id).then(r => setPhotos(r.data || []));
                    setEditModalOpen(true);
                  }}
                  onDelete={(!isAM && canAddDeals) ? () => { setPropertyToDelete(p); setDeleteDialogOpen(true); } : undefined}
                  onManagePhotos={(isAM && own) || !isAM ? () => openPhotoModal(p) : undefined}
                  showQuickAssign={canAddDeals}
                  onQuickAssign={() => { setPropertyToAssign(p); setAssignModalOpen(true); }}
                  onAssigned={fetchProperties}
                  staffId={staffId}
                  staffName={staffName}
                  onViewOnly={isAM && !own ? () => {
                    setViewOnlyProperty(p);
                    setViewOnlyPhotos([]);
                    supabase.from('property_photos').select('*').eq('property_id', p.id).then(r => setViewOnlyPhotos(r.data || []));
                    setViewOnlyModalOpen(true);
                  } : undefined}
                />
              );
            })}
          </div>
        )}



        {filtered.length === 0 && !loading && (
          <div className="text-center py-12">
            <Building className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No properties found in deal flow.</p>
            <p className="text-sm text-gray-400">{canAddDeals ? 'Use "Add Deal" to manually add properties, "Import CSV" for bulk uploads, or use AI Discover.' : 'Properties will appear here once added.'}</p>
          </div>
        )}
      </CardContent>
      <PropertyDetailModal property={selectedProperty} analytics={selectedProperty ? analytics[selectedProperty.id] : null} outreach={outreach} notes={notes} templates={templates} open={detailModalOpen} onOpenChange={setDetailModalOpen} staffId={staffId} staffName={staffName} onSendEmail={async (tid) => { await supabase.functions.invoke('send-outreach-email', { body: { property_id: selectedProperty?.id, template_id: tid } }); toast({ title: 'Email sent!' }); }} onLogCall={async (outcome) => { await supabase.from('outreach_tracking').insert({ property_id: selectedProperty?.id, contact_method: 'phone', status: outcome }); toast({ title: 'Call logged' }); const { data } = await supabase.from('outreach_tracking').select('*').eq('property_id', selectedProperty?.id); setOutreach(data || []); }} onUpdateStatus={handleUpdateStatus} onAddNote={async (content, noteType) => { await supabase.from('outreach_notes').insert({ property_id: selectedProperty?.id, content, note_type: noteType, author_name: staffName || 'Staff' }); const { data } = await supabase.from('outreach_notes').select('*').eq('property_id', selectedProperty?.id); setNotes(data || []); toast({ title: 'Note added' }); }} onTogglePin={async (noteId, isPinned) => { await supabase.from('outreach_notes').update({ is_pinned: isPinned }).eq('id', noteId); const { data } = await supabase.from('outreach_notes').select('*').eq('property_id', selectedProperty?.id); setNotes(data || []); }} />

      <EditPublishModal property={selectedProperty} analytics={selectedProperty ? analytics[selectedProperty.id] : null} photos={photos} open={editModalOpen} onOpenChange={setEditModalOpen} userRole={userRole} onSave={async (updates) => { 
        try {
          errorTracker.suppressNextEdgeFunctionError = true;
          const { data, error } = await supabase.functions.invoke('update-property', { body: { id: selectedProperty?.id, ...updates, updated_by_staff_id: staffId, updated_by_staff_name: staffName } }); 

          if (error || data?.error) {
            const { listing_description: _ld, ...cleanUpdates } = updates as any;
            const dbPayload: Record<string, any> = {
              ...cleanUpdates,
              updated_at: new Date().toISOString(),
              description: updates.description || _ld || undefined,
              monthly_rent: updates.monthly_rent,
              acquisition_fee: updates.acquisition_fee,
              adr_peak_season: updates.adr_peak_season,
              adr_slow_season: updates.adr_slow_season,
              monthly_room_rate: updates.monthly_room_rate,
              avg_occupancy_rate: updates.avg_occupancy_rate,
              projected_yearly_revenue: updates.projected_yearly_revenue,
              projected_monthly_revenue_peak: updates.projected_monthly_revenue_peak,
              projected_monthly_revenue_slow: updates.projected_monthly_revenue_slow,
              peak_season_description: updates.peak_season_description,
              deposits_concessions_notes: updates.deposits_concessions_notes,
            };
            delete dbPayload.listing_description;
            const { error: dbError } = await supabase.from('properties').update(dbPayload).eq('id', selectedProperty?.id);
            if (dbError) throw dbError;
          }

          const financialFieldsSaved: string[] = [];
          if (updates.monthly_rent != null) financialFieldsSaved.push(`Rent: $${Number(updates.monthly_rent).toLocaleString()}`);
          if (updates.acquisition_fee != null) financialFieldsSaved.push(`Acq Fee: $${Number(updates.acquisition_fee).toLocaleString()}`);
          if (updates.projected_yearly_revenue != null) financialFieldsSaved.push(`Yearly Rev: $${Number(updates.projected_yearly_revenue).toLocaleString()}`);
          if (updates.adr_peak_season != null) financialFieldsSaved.push(`ADR Peak: $${Number(updates.adr_peak_season)}`);

          toast({ 
            title: 'Property saved successfully', 
            description: financialFieldsSaved.length > 0
              ? `Financials updated: ${financialFieldsSaved.join(' | ')}`
              : 'All changes have been saved.'
          }); 
          fetchProperties(); 
        } catch (err: any) {
          showError(err, 'update', { propertyId: selectedProperty?.id, updates: Object.keys(updates) });
        }
      }} onPublish={handlePublish} onProcessPhotos={async (listingUrl, photoUrls) => { toast({ title: 'Processing photos...' }); await supabase.functions.invoke('process-property-photos', { body: { property_id: selectedProperty?.id, listing_url: listingUrl, photo_urls: photoUrls } }); const { data } = await supabase.from('property_photos').select('*').eq('property_id', selectedProperty?.id); setPhotos(data || []); toast({ title: 'Photos processed!' }); }} />

      {/* View-Only Modal for AMs on deals they don't own */}
      <ViewOnlyPropertyModal
        property={viewOnlyProperty}
        analytics={viewOnlyProperty ? analytics[viewOnlyProperty.id] : null}
        photos={viewOnlyPhotos}
        open={viewOnlyModalOpen}
        onOpenChange={(open) => {
          setViewOnlyModalOpen(open);
          if (!open) { setViewOnlyProperty(null); setViewOnlyPhotos([]); }
        }}
      />

      {canAddDeals && (
        <>
          <AddDealModal open={addModalOpen} onOpenChange={setAddModalOpen} onAdd={handleAddDeal} staffId={staffId} staffName={staffName} />
          <CSVPropertyImport open={csvImportOpen} onClose={() => setCSVImportOpen(false)} onImported={fetchProperties} />
        </>
      )}
      <PhotoUploadModal open={photoModalOpen} onOpenChange={setPhotoModalOpen} propertyId={selectedProperty?.id || ''} propertyAddress={selectedProperty ? `${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state}` : ''} existingPhotos={selectedProperty?.photos || []} onSave={handleSavePhotos} />
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { if (!deleting) setDeleteDialogOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-500" />Archive & Delete Deal</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {deleting ? (
                <div className="flex flex-col items-center py-4 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                  <p className="font-medium text-gray-700">Deleting "{propertyToDelete?.listing_title || propertyToDelete?.address}"...</p>
                  <p className="text-sm text-gray-500">Archiving property, cleaning related records, and removing from database.</p>
                </div>
              ) : (
                <>
                  <p>Are you sure you want to delete <strong>"{propertyToDelete?.listing_title || propertyToDelete?.address}"</strong>?</p>
                  <p className="text-amber-600 font-medium">The deal will be archived first so you can restore it later from the Archived Deals tab.</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                    <p className="font-medium">This will remove:</p>
                    <p>- All marketplace listings and offers</p>
                    <p>- Deal analytics, photos, and notes</p>
                    <p>- Outreach records and assignments</p>
                    <p>- Penny scores and alerts</p>
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!deleting && (
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPropertyToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteDeal} className="bg-red-600 hover:bg-red-700"><Trash2 className="w-4 h-4 mr-2" />Archive & Delete</AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Soft-Delete Fallback Dialog */}
      <AlertDialog open={softDeleteFallbackOpen} onOpenChange={(open) => { if (!deleting) setSoftDeleteFallbackOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-5 h-5" />Delete Failed — Soft-Delete Available</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {deleting ? (
                <div className="flex flex-col items-center py-4 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <p className="font-medium text-gray-700">Soft-deleting "{softDeleteTarget?.listing_title || softDeleteTarget?.address}"...</p>
                </div>
              ) : (
                <>
                  <p>The permanent delete failed for <strong>"{softDeleteTarget?.listing_title || softDeleteTarget?.address}"</strong> due to database constraints.</p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                    <p className="font-medium">Error details:</p>
                    <p className="mt-1 break-words">{softDeleteError.length > 200 ? softDeleteError.substring(0, 200) + '...' : softDeleteError}</p>
                  </div>
                  <p className="text-amber-700 font-medium">Would you like to soft-delete instead?</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!deleting && (
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setSoftDeleteTarget(null); setSoftDeleteError(''); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSoftDeleteFallback} className="bg-amber-600 hover:bg-amber-700"><Trash2 className="w-4 h-4 mr-2" />Soft-Delete (Mark as Deleted)</AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" />Clear All Deals</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete <strong>ALL {properties.length} properties</strong> from the deal flow?</p>
              <p className="text-red-600 font-medium">This will permanently remove all deals, analytics, photos, notes, and outreach records.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllDeals} className="bg-red-600 hover:bg-red-700" disabled={clearing}>{clearing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}Yes, Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Assign Full Modal */}
      <PropertyAssignmentModal
        open={assignModalOpen}
        onOpenChange={(open) => { setAssignModalOpen(open); if (!open) setPropertyToAssign(null); }}
        mode="assign_to_property"
        property={propertyToAssign ? {
          id: propertyToAssign.id, address: propertyToAssign.address, city: propertyToAssign.city,
          state: propertyToAssign.state, zip_code: propertyToAssign.zip_code, listing_title: propertyToAssign.listing_title,
          bedrooms: propertyToAssign.bedrooms, bathrooms: propertyToAssign.bathrooms, monthly_rent: propertyToAssign.monthly_rent,
          acquisition_fee: propertyToAssign.acquisition_fee, listing_url: propertyToAssign.listing_url,
          operation_type: propertyToAssign.operation_type, property_type: propertyToAssign.property_type,
          sqft: (propertyToAssign as any).sqft || (propertyToAssign as any).square_feet,
          is_published: propertyToAssign.is_published, status: propertyToAssign.status,
          assigned_investor_id: propertyToAssign.assigned_investor_id
        } : null}
        onAssigned={() => { fetchProperties(); setAssignModalOpen(false); setPropertyToAssign(null); }}
      />
    </Card>
  );
}

