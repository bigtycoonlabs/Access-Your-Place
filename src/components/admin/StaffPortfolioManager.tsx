import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Building2, MapPin, Bed, Bath, DollarSign, Edit2,
  MessageSquare, CheckCircle, Clock, CreditCard, Send, Plus,
  Save, Ruler, FileText, AlertCircle, Eye, Search, RefreshCw, Home, Mail, Trash2,
  Globe, ChevronDown, ExternalLink, X
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
  staffId: string;
  staffName: string;
  portfolio?: any[];
  onRefresh?: () => void;
}

interface PortfolioProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  square_footage?: number;
  monthly_rent: number;
  acquisition_fee: number;
  property_status: string;
  property_type: string;
  acquired_through_ayp: boolean;
  acquisition_source: string;
  lease_agreements_received: boolean;
  credit_amount: number;
  credit_status: string;
  staff_notes: Array<{ author: string; text: string; date: string }>;
  notes?: string;
  photo_urls?: string[];
  operation_type?: string;
  created_at: string;
  community_name?: string;
  community_website?: string;
}

interface PublishedDeal {
  id: string;
  address: string;
  listing_title?: string;
  city: string;
  state: string;
  zip_code?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  monthly_rent?: number;
  acquisition_fee?: number;
  property_type?: string;
  operation_type?: string;
  listing_url?: string;
  photos?: string[];
  photo_urls?: string[];
  is_published?: boolean;
  status?: string;
}

export function StaffPortfolioManager({ investorId, investorName, staffId, staffName, portfolio: initialPortfolio, onRefresh }: Props) {
  const [properties, setProperties] = useState<PortfolioProperty[]>(initialPortfolio || []);
  const [loading, setLoading] = useState(!initialPortfolio);
  const [editingProp, setEditingProp] = useState<PortfolioProperty | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notePropertyId, setNotePropertyId] = useState<string | null>(null);
  const [addingNote, setAddingNote] = useState(false);

  // Published deals
  const [publishedDeals, setPublishedDeals] = useState<PublishedDeal[]>([]);
  const [loadingPublished, setLoadingPublished] = useState(false);

  // Add from deal flow
  const [showAddFromDealFlow, setShowAddFromDealFlow] = useState(false);
  const [dealSearchQuery, setDealSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<PublishedDeal | null>(null);
  const [addingDeal, setAddingDeal] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [addDealForm, setAddDealForm] = useState({ bedrooms: 0, bathrooms: 0, square_footage: 0, monthly_rent: 0, acquisition_fee: 0, notes: '' });

  // Manual add
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualForm, setManualForm] = useState({
    address: '', city: '', state: '', zip_code: '',
    bedrooms: 0, bathrooms: 0, square_footage: 0,
    monthly_rent: 0, acquisition_fee: 0,
    property_type: 'single_family', property_status: 'pending',
    operation_type: 'str', notes: '',
    community_name: '', community_website: ''
  });
  const [addingManual, setAddingManual] = useState(false);

  // Delete confirmation
  const [deletingPropId, setDeletingPropId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (!initialPortfolio) fetchPortfolio();
  }, [investorId]);

  useEffect(() => {
    if (initialPortfolio) setProperties(initialPortfolio);
  }, [initialPortfolio]);

  useEffect(() => {
    fetchPublishedDeals();
  }, []);

  const fetchPortfolio = async () => {
    setLoading(true);
    let fetched = false;

    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'get_investor', investor_id: investorId }
      });
      if (!error && data?.portfolio && Array.isArray(data.portfolio)) {
        setProperties(data.portfolio);
        fetched = true;
      }
    } catch (err) {
      console.warn('[StaffPortfolio] Edge function fetch failed:', err);
    }

    if (!fetched) {
      try {
        const { data, error } = await supabase.functions.invoke('get-portfolio', {
        // Staff read: verifies an active staff member server-side. The original ordered by
        // created_at descending, which ayp_staff_portfolio already does.
        body: { staff_id: staffId, investor_id: investorId },
      }).then(r => ({ data: r.data?.units ?? [] }));
        if (!error && data) {
          setProperties(data as any);
          fetched = true;
        }
      } catch {}
    }

    if (!fetched) setProperties([]);
    setLoading(false);
  };

  const fetchPublishedDeals = async () => {
    setLoadingPublished(true);
    let deals: PublishedDeal[] = [];

    // PRIMARY: Use get-properties edge function (bypasses RLS) - use include_all to get ALL properties
    try {
      const { data, error } = await supabase.functions.invoke('get-properties', {
        body: { include_all: true, limit: 500 }
      });
      if (!error && data?.properties?.length) {
        deals = data.properties.map((p: any) => ({
          ...p,
          sqft: p.sqft || p.square_feet || null
        }));
      }
    } catch (err) {
      console.warn('[StaffPortfolio] Edge function failed:', err);
    }

    // FALLBACK: Direct DB
    if (deals.length === 0) {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('id, address, listing_title, city, state, zip_code, bedrooms, bathrooms, sqft, monthly_rent, acquisition_fee, property_type, operation_type, listing_url, photos, is_published, status')
          .or('is_published.eq.true,status.eq.published')
          .order('created_at', { ascending: false })
          .limit(500);
        if (!error && data?.length) deals = data;
      } catch {}
    }

    // FALLBACK 2: All properties
    if (deals.length === 0) {
      try {
        const { data } = await supabase
          .from('properties')
          .select('id, address, listing_title, city, state, zip_code, bedrooms, bathrooms, sqft, monthly_rent, acquisition_fee, property_type, operation_type, listing_url, photos, is_published, status')
          .order('created_at', { ascending: false })
          .limit(500);
        if (data?.length) deals = data;
      } catch {}
    }

    setPublishedDeals(deals);
    setLoadingPublished(false);
  };



  const getInvestorEmail = async (): Promise<{ email: string; name: string } | null> => {
    try {
      const { data } = await supabase
        .from('investors')
        .select('email, full_name')
        .eq('id', investorId)
        .single();
      if (data?.email) return { email: data.email, name: data.full_name || investorName };
    } catch {}
    return null;
  };

  const handleUpdateProperty = async () => {
    if (!editingProp) return;
    setSaving(true);
    let success = false;

    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'manage_portfolio_property', property_id: editingProp.id, updates: editForm, staff_name: staffName }
      });
      if (!error && data?.success) success = true;
    } catch {}

    if (!success) {
      try {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (editForm.property_status) updateData.property_status = editForm.property_status;
        if (editForm.bedrooms !== undefined) updateData.bedrooms = editForm.bedrooms;
        if (editForm.bathrooms !== undefined) updateData.bathrooms = editForm.bathrooms;
        if (editForm.square_footage !== undefined) updateData.square_footage = editForm.square_footage;
        if (editForm.monthly_rent !== undefined) updateData.monthly_rent = editForm.monthly_rent;
        if (editForm.acquisition_fee !== undefined) updateData.acquisition_fee = editForm.acquisition_fee;
        if (editForm.lease_agreements_received !== undefined) updateData.lease_agreements_received = editForm.lease_agreements_received;
        if (editForm.notes !== undefined) updateData.notes = editForm.notes;
        if (editForm.operation_type !== undefined) updateData.operation_type = editForm.operation_type;
        if (editForm.community_name !== undefined) updateData.community_name = editForm.community_name;
        if (editForm.community_website !== undefined) updateData.community_website = editForm.community_website;

        // Routed through the edge function. Anon UPDATE on investor_portfolio was revoked
        // (it let anybody with the publishable key edit any client's holdings), which broke
        // this direct write.
        const { data: r } = await supabase.functions.invoke('manage-investor-admin', {
          body: { action: 'staff_update_portfolio_property', property_id: editingProp.id,
                  updates: updateData, staff_id: staffId },
        });
        if (r?.success) success = true;
      } catch {}
    }

    if (success) {
      toast({ title: 'Property Updated' });
      setEditingProp(null);
      fetchPortfolio();
      onRefresh?.();
    } else {
      toast({ title: 'Error', description: 'Failed to update property.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleAddNote = async (propertyId: string) => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    let success = false;

    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'add_portfolio_note', property_id: propertyId, note_text: noteText, staff_name: staffName }
      });
      if (!error && data?.success) success = true;
    } catch {}

    if (!success) {
      try {
        // Read-modify-write moved server-side. Reading the notes here and writing them
        // back meant two staff adding a note at once would erase each other's.
        const { data: r } = await supabase.functions.invoke('manage-investor-admin', {
          body: { action: 'staff_append_portfolio_note', property_id: propertyId,
                  note: noteText, staff_id: staffId, staff_name: staffName },
        });
        if (r?.success) success = true;
      } catch {}
    }

    if (success) {
      toast({ title: 'Note Added' });
      setNoteText('');
      setNotePropertyId(null);
      fetchPortfolio();
    } else {
      toast({ title: 'Error', description: 'Failed to add note.', variant: 'destructive' });
    }
    setAddingNote(false);
  };

  const handleApproveCredit = async (propertyId: string, approved: boolean) => {
    try {
      const { data } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'approve_portfolio_credit', property_id: propertyId, approved, staff_name: staffName }
      });
      if (data?.success) {
        toast({ title: approved ? 'Credit Approved' : 'Credit Denied' });
        fetchPortfolio();
        onRefresh?.();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    try {
      const { data: dr } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'staff_delete_portfolio_property', property_id: propertyId, staff_id: staffId },
      });
      if (dr?.success) {
        toast({ title: 'Property Removed' });
        fetchPortfolio();
        onRefresh?.();
      } else {
        toast({ title: 'Error', description: 'Failed to remove.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove.', variant: 'destructive' });
    }
    setConfirmDelete(false);
    setDeletingPropId(null);
  };

  const selectDeal = (deal: PublishedDeal) => {
    setSelectedDeal(deal);
    setAssignError('');
    setAddDealForm({
      bedrooms: deal.bedrooms || 0,
      bathrooms: deal.bathrooms || 0,
      square_footage: deal.sqft || 0,
      monthly_rent: deal.monthly_rent || 0,
      acquisition_fee: deal.acquisition_fee || 0,
      notes: ''
    });
  };

  const getDealDisplayName = (deal: PublishedDeal) => {
    return deal.listing_title || deal.address || `${deal.bedrooms || '?'}BR in ${deal.city}`;
  };

  /**
   * PRIMARY: Use manage-property-assignments edge function (action: 'create')
   * This function creates: property_assignments record, investor_portfolio entry,
   * investor_notifications, AM email, and investor email — all in one call.
   *
   * FALLBACK 1: manage-investor-admin (add_dealflow_to_portfolio)
   * FALLBACK 2: Direct DB insert
   */
  const handleAddDealToPortfolio = async () => {
    if (!selectedDeal) return;
    setAddingDeal(true);
    setAssignError('');
    let success = false;

    const address = selectedDeal.address || '';
    const communityName = selectedDeal.listing_title || '';

    // ===== PRIMARY: manage-property-assignments (most reliable, does everything) =====
    try {
      console.log('[StaffPortfolio] Assigning via manage-property-assignments...');
      const { data, error } = await supabase.functions.invoke('manage-property-assignments', {
        body: {
          action: 'create',
          staff_id: staffId,
          property_id: selectedDeal.id,
          investor_id: investorId,
          assigned_by: staffName || 'Staff',
          payment_amount: addDealForm.acquisition_fee || selectedDeal.acquisition_fee || 0,
          notes: addDealForm.notes || ''
        }
      });

      if (!error && data && !data.error && data.success) {
        success = true;
        console.log('[StaffPortfolio] Assignment successful via manage-property-assignments');
      } else {
        const errMsg = data?.error || error?.message || 'Unknown error';
        console.warn('[StaffPortfolio] manage-property-assignments failed:', errMsg);
        setAssignError(`Primary assignment failed: ${errMsg}`);
      }
    } catch (err: any) {
      console.warn('[StaffPortfolio] manage-property-assignments exception:', err.message);
      setAssignError(`Primary assignment error: ${err.message}`);
    }

    // ===== FALLBACK 1: manage-investor-admin =====
    if (!success) {
      try {
        console.log('[StaffPortfolio] Trying manage-investor-admin fallback...');
        const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
          body: {
            action: 'add_dealflow_to_portfolio',
            investor_id: investorId,
            deal_id: selectedDeal.id,
            bedrooms: addDealForm.bedrooms || selectedDeal.bedrooms,
            bathrooms: addDealForm.bathrooms || selectedDeal.bathrooms,
            square_footage: addDealForm.square_footage || selectedDeal.sqft,
            monthly_rent: addDealForm.monthly_rent || selectedDeal.monthly_rent,
            acquisition_fee: addDealForm.acquisition_fee,
            community_name: communityName,
            community_website: selectedDeal.listing_url || '',
            staff_name: staffName,
            notes: addDealForm.notes || ''
          }
        });
        if (!error && data?.success) {
          success = true;
          console.log('[StaffPortfolio] Assignment successful via manage-investor-admin');
        }
      } catch {}
    }

    // ===== FALLBACK 2: Direct DB insert =====
    if (!success) {
      try {
        console.log('[StaffPortfolio] Trying direct DB insert fallback...');
        const staffNotesArr = [{
          author: staffName || 'Staff',
          text: `Added from deal flow. Community: ${communityName || 'N/A'}.${addDealForm.notes ? ' ' + addDealForm.notes : ''}`,
          date: new Date().toISOString()
        }];

        const portfolioData: Record<string, any> = {
          investor_id: investorId,
          address,
          city: selectedDeal.city || '',
          state: selectedDeal.state || '',
          zip_code: selectedDeal.zip_code || '',
          bedrooms: addDealForm.bedrooms || selectedDeal.bedrooms || 0,
          bathrooms: addDealForm.bathrooms || selectedDeal.bathrooms || 0,
          square_footage: addDealForm.square_footage || selectedDeal.sqft || null,
          monthly_rent: addDealForm.monthly_rent || selectedDeal.monthly_rent || 0,
          acquisition_fee: addDealForm.acquisition_fee || 0,
          initial_investment: addDealForm.acquisition_fee || 0,
          property_type: selectedDeal.property_type || 'single_family',
          property_status: 'pending',
          status: 'active',
          acquired_through_ayp: true,
          acquisition_source: 'ayp',
          deal_flow_property_id: selectedDeal.id,
          added_by_staff: true,
          assigned_by: staffName || 'Staff',
          operation_type: selectedDeal.operation_type || 'str',
          community_name: communityName,
          community_website: selectedDeal.listing_url || '',
          notes: addDealForm.notes || `Added from deal flow by ${staffName || 'Staff'}`,
          staff_notes: staffNotesArr,
          photo_urls: selectedDeal.photos || selectedDeal.photo_urls || [],
          created_at: new Date().toISOString()
        };

        const { data: ar } = await supabase.functions.invoke('manage-investor-admin', {
          body: { action: 'add_portfolio_property', ...portfolioData, staff_id: staffId },
        });
        const inserted = ar?.property ?? null;

        if (ar?.success && inserted) {
          success = true;
          // Send notification
          try {
            await supabase.from('investor_notifications').insert({
              investor_id: investorId,
              notification_type: 'property_added_to_portfolio',
              type: 'property_added_to_portfolio',
              title: 'New Property Added to Your Portfolio',
              message: `${communityName || address} in ${selectedDeal.city || ''}, ${selectedDeal.state || ''} has been added to your portfolio.`,
              data: { address, city: selectedDeal.city, state: selectedDeal.state, community_name: communityName },

              read: false,
              created_at: new Date().toISOString()
            });
          } catch {}
        }
      } catch {}
    }

    if (success) {
      toast({ title: 'Property Assigned!', description: `${communityName || address} added to ${investorName}'s portfolio.` });
      setShowAddFromDealFlow(false);
      setSelectedDeal(null);
      setDealSearchQuery('');
      setAssignError('');
      fetchPortfolio();
      onRefresh?.();
    } else {
      toast({ title: 'Assignment Failed', description: 'All strategies failed. Check edge function logs.', variant: 'destructive' });
    }
    setAddingDeal(false);
  };

  const handleManualAdd = async () => {
    if (!manualForm.address.trim() || !manualForm.city.trim() || !manualForm.state.trim()) {
      toast({ title: 'Missing Fields', description: 'Address, city, and state are required.', variant: 'destructive' });
      return;
    }
    setAddingManual(true);
    let success = false;

    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: 'add_property_to_portfolio',
          investor_id: investorId,
          property_address: manualForm.address.trim(),
          property_city: manualForm.city.trim(),
          property_state: manualForm.state.trim(),
          property_zip: manualForm.zip_code.trim(),
          bedrooms: manualForm.bedrooms || 0,
          bathrooms: manualForm.bathrooms || 0,
          square_footage: manualForm.square_footage || null,
          monthly_rent: manualForm.monthly_rent || 0,
          acquisition_fee: manualForm.acquisition_fee || 0,
          property_type: manualForm.property_type,
          property_status: manualForm.property_status || 'pending',
          operation_type: manualForm.operation_type,
          community_name: manualForm.community_name || '',
          community_website: manualForm.community_website || '',
          notes: manualForm.notes || '',
          staff_name: staffName,
          send_notification: true
        }
      });
      if (!error && data?.success) success = true;
    } catch {}

    if (!success) {
      try {
        const staffNotesArr = [{
          author: staffName || 'Staff',
          text: `Manually added. Community: ${manualForm.community_name || 'N/A'}.${manualForm.notes ? ' ' + manualForm.notes : ''}`,
          date: new Date().toISOString()
        }];

        const portfolioData: Record<string, any> = {
          investor_id: investorId,
          address: manualForm.address.trim(),
          city: manualForm.city.trim(),
          state: manualForm.state.trim(),
          zip_code: manualForm.zip_code.trim(),
          bedrooms: manualForm.bedrooms || 0,
          bathrooms: manualForm.bathrooms || 0,
          square_footage: manualForm.square_footage || null,
          monthly_rent: manualForm.monthly_rent || 0,
          acquisition_fee: manualForm.acquisition_fee || 0,
          initial_investment: manualForm.acquisition_fee || 0,
          property_type: manualForm.property_type,
          property_status: manualForm.property_status || 'pending',
          operation_type: manualForm.operation_type,
          status: 'active',
          acquired_through_ayp: true,
          acquisition_source: 'ayp',
          added_by_staff: true,
          assigned_by: staffName || 'Staff',
          community_name: manualForm.community_name || '',
          community_website: manualForm.community_website || '',
          notes: manualForm.notes || `Manually added by ${staffName || 'Staff'}`,
          staff_notes: staffNotesArr,
          created_at: new Date().toISOString()
        };

        const { data: ar2 } = await supabase.functions.invoke('manage-investor-admin', {
          body: { action: 'add_portfolio_property', ...portfolioData, staff_id: staffId },
        });
        if (ar2?.success) success = true;
      } catch {}
    }

    if (success) {
      toast({ title: 'Property Added!', description: `${manualForm.community_name || manualForm.address} added to portfolio.` });
      setShowManualAdd(false);
      setManualForm({
        address: '', city: '', state: '', zip_code: '',
        bedrooms: 0, bathrooms: 0, square_footage: 0,
        monthly_rent: 0, acquisition_fee: 0,
        property_type: 'single_family', property_status: 'pending',
        operation_type: 'str', notes: '',
        community_name: '', community_website: ''
      });
      fetchPortfolio();
      onRefresh?.();
    } else {
      toast({ title: 'Error', description: 'Failed to add property.', variant: 'destructive' });
    }
    setAddingManual(false);
  };

  const openEditModal = (prop: PortfolioProperty) => {
    setEditingProp(prop);
    setEditForm({
      property_status: prop.property_status || 'pending',
      bedrooms: prop.bedrooms,
      bathrooms: prop.bathrooms,
      square_footage: prop.square_footage || 0,
      monthly_rent: prop.monthly_rent,
      acquisition_fee: prop.acquisition_fee || 0,
      lease_agreements_received: prop.lease_agreements_received || false,
      operation_type: prop.operation_type || '',
      notes: prop.notes || '',
      community_name: prop.community_name || '',
      community_website: prop.community_website || ''
    });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-500', pending: 'bg-yellow-500', pending_approval: 'bg-yellow-500',
      inactive: 'bg-gray-500', assigned: 'bg-blue-500', received: 'bg-green-500'
    };
    const label = status === 'pending' ? 'Pending' : status?.replace(/_/g, ' ') || 'Unknown';
    return <Badge className={map[status] || 'bg-gray-500'}>{label}</Badge>;
  };

  // Filter deals for the modal list
  const filteredDeals = dealSearchQuery.trim()
    ? publishedDeals.filter(d => {
        const q = dealSearchQuery.toLowerCase();
        return d.address?.toLowerCase().includes(q) ||
               d.listing_title?.toLowerCase().includes(q) ||
               d.city?.toLowerCase().includes(q) ||
               d.zip_code?.includes(dealSearchQuery);
      })
    : publishedDeals;

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#d4a574]" />
          Portfolio ({properties.length})
        </h3>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchPortfolio}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowManualAdd(true)}>
            <Home className="w-4 h-4 mr-1" />Add Manually
          </Button>
          <Button size="sm" onClick={() => { setShowAddFromDealFlow(true); setSelectedDeal(null); setDealSearchQuery(''); setAssignError(''); }} className="bg-[#d4a574] hover:bg-[#c49464]">
            <Plus className="w-4 h-4 mr-1" />Add from Deal Flow
          </Button>
        </div>
      </div>

      {properties.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-gray-500">
          <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p>No properties in portfolio</p>
          <div className="flex gap-2 justify-center mt-3">
            <Button size="sm" variant="outline" onClick={() => setShowManualAdd(true)}>
              <Home className="w-4 h-4 mr-1" />Add Manually
            </Button>
            <Button size="sm" className="bg-[#d4a574] hover:bg-[#c49464]" onClick={() => { setShowAddFromDealFlow(true); setSelectedDeal(null); }}>
              <Plus className="w-4 h-4 mr-1" />Add from Deal Flow
            </Button>
          </div>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {properties.map((prop) => (
            <Card key={prop.id} className={prop.property_status === 'pending' || prop.property_status === 'pending_approval' ? 'border-yellow-300' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {prop.community_name ? (
                        <span className="font-semibold text-[#1a365d] truncate">{prop.community_name}</span>
                      ) : (
                        <span className="font-semibold truncate">{prop.address || 'No address'}</span>
                      )}
                      {getStatusBadge(prop.property_status)}
                      {prop.acquired_through_ayp && <Badge className="bg-[#d4a574] text-xs">AYP</Badge>}
                      {prop.operation_type && (
                        <Badge variant="outline" className="text-xs">
                          {prop.operation_type === 'str' ? 'STR' : prop.operation_type === 'mtr' ? 'MTR' : prop.operation_type.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    {prop.community_name && prop.address && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mb-0.5 truncate">
                        <Building2 className="w-3 h-3 flex-shrink-0" />{prop.address}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />{prop.city}, {prop.state} {prop.zip_code}
                    </p>
                    {prop.community_website && (
                      <a href={prop.community_website.startsWith('http') ? prop.community_website : `https://${prop.community_website}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3" />Website <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                      {prop.bedrooms ? <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{prop.bedrooms}bd</span> : null}
                      {prop.bathrooms ? <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{prop.bathrooms}ba</span> : null}
                      {prop.square_footage ? <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{prop.square_footage} sqft</span> : null}
                      {prop.monthly_rent ? <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${prop.monthly_rent.toLocaleString()}/mo</span> : null}
                      {prop.acquisition_fee ? <span>Fee: ${prop.acquisition_fee.toLocaleString()}</span> : null}
                    </div>

                    {prop.credit_status === 'pending_approval' && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-amber-600" />
                          <span className="text-sm text-amber-800">Credit: ${prop.credit_amount || prop.acquisition_fee}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="text-green-600 border-green-300 h-7 text-xs" onClick={() => handleApproveCredit(prop.id, true)}>
                            <CheckCircle className="w-3 h-3 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-300 h-7 text-xs" onClick={() => handleApproveCredit(prop.id, false)}>Deny</Button>
                        </div>
                      </div>
                    )}

                    {prop.staff_notes && prop.staff_notes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {prop.staff_notes.slice(-2).map((note, i) => (
                          <div key={i} className="text-xs p-2 bg-blue-50 rounded border border-blue-100">
                            <span className="text-blue-700">{note.text}</span>
                            <span className="text-blue-400 ml-2">— {note.author}, {new Date(note.date).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {notePropertyId === prop.id && (
                      <div className="mt-2 flex gap-2">
                        <input aria-label="Add a note" type="text" placeholder="Add a note..." value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddNote(prop.id)}
                          className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        />
                        <Button size="sm" onClick={() => handleAddNote(prop.id)} disabled={addingNote} className="bg-[#d4a574] hover:bg-[#c49464]">
                          {addingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setNotePropertyId(null); setNoteText(''); }}>Cancel</Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEditModal(prop)}>
                      <Edit2 className="w-3 h-3 mr-1" />Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setNotePropertyId(prop.id)}>
                      <MessageSquare className="w-3 h-3 mr-1" />Note
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700 hover:border-red-300"
                      onClick={() => { setDeletingPropId(prop.id); setConfirmDelete(true); }}>
                      <Trash2 className="w-3 h-3 mr-1" />Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!open) { setConfirmDelete(false); setDeletingPropId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Remove Property
            </DialogTitle>
            <DialogDescription>
              Remove this property from {investorName}'s portfolio? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDelete(false); setDeletingPropId(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingPropId && handleDeleteProperty(deletingPropId)}>
              <Trash2 className="w-4 h-4 mr-2" />Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Property Modal */}
      <Dialog open={!!editingProp} onOpenChange={(open) => !open && setEditingProp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
            <DialogDescription>{editingProp?.community_name || editingProp?.address}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editForm.property_status} onValueChange={(v) => setEditForm({ ...editForm, property_status: v })}>
                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-community">Community Name</Label>
                <Input id="edit-community" value={editForm.community_name || ''} onChange={(e) => setEditForm({ ...editForm, community_name: e.target.value })} placeholder="e.g. Sunset Apartments" />
              </div>
              <div>
                <Label htmlFor="edit-website">Community Website</Label>
                <Input id="edit-website" value={editForm.community_website || ''} onChange={(e) => setEditForm({ ...editForm, community_website: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label htmlFor="edit-beds">Beds</Label><Input id="edit-beds" type="number" value={editForm.bedrooms} onChange={(e) => setEditForm({ ...editForm, bedrooms: parseInt(e.target.value) || 0 })} /></div>
              <div><Label htmlFor="edit-baths">Baths</Label><Input id="edit-baths" type="number" step="0.5" value={editForm.bathrooms} onChange={(e) => setEditForm({ ...editForm, bathrooms: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label htmlFor="edit-sqft">Sq Ft</Label><Input id="edit-sqft" type="number" value={editForm.square_footage} onChange={(e) => setEditForm({ ...editForm, square_footage: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="edit-rent">Rent ($/mo)</Label><Input id="edit-rent" type="number" value={editForm.monthly_rent} onChange={(e) => setEditForm({ ...editForm, monthly_rent: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label htmlFor="edit-fee">Fee ($)</Label><Input id="edit-fee" type="number" value={editForm.acquisition_fee} onChange={(e) => setEditForm({ ...editForm, acquisition_fee: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div>
              <Label htmlFor="edit-optype">Operation Type</Label>
              <Select value={editForm.operation_type || ''} onValueChange={(v) => setEditForm({ ...editForm, operation_type: v })}>
                <SelectTrigger id="edit-optype"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="str">Short-Term Rental</SelectItem>
                  <SelectItem value="corporate">Corporate Housing</SelectItem>
                  <SelectItem value="coliving">Co-Living</SelectItem>
                  <SelectItem value="mtr">Mid-Term Rental</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Switch id="edit-lease" checked={editForm.lease_agreements_received} onCheckedChange={(c) => setEditForm({ ...editForm, lease_agreements_received: c })} />
              <Label htmlFor="edit-lease">Lease agreements received</Label>
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <textarea id="edit-notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProp(null)}>Cancel</Button>
            <Button onClick={handleUpdateProperty} disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ADD FROM DEAL FLOW MODAL (Simplified & Accessible) ===== */}
      <Dialog open={showAddFromDealFlow} onOpenChange={(open) => { if (!open) { setShowAddFromDealFlow(false); setSelectedDeal(null); setDealSearchQuery(''); setAssignError(''); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Deal to Portfolio</DialogTitle>
            <DialogDescription>
              {selectedDeal
                ? `Confirm details for ${investorName}'s portfolio`
                : `Select a deal for ${investorName}`
              }
            </DialogDescription>
          </DialogHeader>

          {/* Error banner */}
          {assignError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-700">{assignError}</p>
                <p className="text-xs text-red-500 mt-1">The system will try alternative methods automatically.</p>
              </div>
              <button onClick={() => setAssignError('')} className="text-red-400 hover:text-red-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            {!selectedDeal ? (
              <>
                {/* Search */}
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input aria-label="Search by address, city, or ZIP"
                      placeholder="Search by address, city, or ZIP..."
                      value={dealSearchQuery}
                      onChange={(e) => setDealSearchQuery(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    {dealSearchQuery && (
                      <button
                        onClick={() => setDealSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {loadingPublished ? 'Loading...' : `${filteredDeals.length} deal${filteredDeals.length !== 1 ? 's' : ''} available`}
                  </p>
                </div>

                {/* Deal list */}
                {loadingPublished ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : filteredDeals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm">{dealSearchQuery ? `No deals matching "${dealSearchQuery}"` : 'No published deals found'}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={fetchPublishedDeals}>
                      <RefreshCw className="w-3 h-3 mr-1" />Refresh
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y max-h-[50vh] overflow-y-auto" role="listbox">
                    {filteredDeals.map((deal) => (
                      <button
                        key={deal.id}
                        role="option"
                        aria-selected={false}
                        onClick={() => selectDeal(deal)}
                        className="w-full text-left px-4 py-3 hover:bg-[#d4a574]/10 focus:bg-[#d4a574]/10 focus:outline-none transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{getDealDisplayName(deal)}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {deal.city}, {deal.state}
                              {deal.bedrooms ? ` · ${deal.bedrooms}bd` : ''}
                              {deal.bathrooms ? `/${deal.bathrooms}ba` : ''}
                              {deal.monthly_rent ? ` · $${deal.monthly_rent.toLocaleString()}/mo` : ''}
                              {deal.acquisition_fee ? ` · Fee: $${deal.acquisition_fee.toLocaleString()}` : ''}
                            </p>
                          </div>
                          {deal.is_published && (
                            <Badge className="bg-green-500 text-white text-[10px] py-0 flex-shrink-0">Published</Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Selected deal card */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#1a365d]">{getDealDisplayName(selectedDeal)}</p>
                      {selectedDeal.address && selectedDeal.address !== selectedDeal.listing_title && (
                        <p className="text-sm text-gray-600 mt-0.5">{selectedDeal.address}</p>
                      )}
                      <p className="text-sm text-gray-600">{selectedDeal.city}, {selectedDeal.state} {selectedDeal.zip_code || ''}</p>
                      {selectedDeal.listing_url && (
                        <a href={selectedDeal.listing_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                          <Globe className="w-3 h-3" />View listing <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDeal(null)}>Change</Button>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="deal-beds">Beds</Label>
                    <Input id="deal-beds" type="number" value={addDealForm.bedrooms} onChange={(e) => setAddDealForm({ ...addDealForm, bedrooms: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label htmlFor="deal-baths">Baths</Label>
                    <Input id="deal-baths" type="number" step="0.5" value={addDealForm.bathrooms} onChange={(e) => setAddDealForm({ ...addDealForm, bathrooms: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label htmlFor="deal-sqft">Sq Ft</Label>
                    <Input id="deal-sqft" type="number" value={addDealForm.square_footage} onChange={(e) => setAddDealForm({ ...addDealForm, square_footage: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="deal-rent">Rent ($/mo)</Label>
                    <Input id="deal-rent" type="number" value={addDealForm.monthly_rent} onChange={(e) => setAddDealForm({ ...addDealForm, monthly_rent: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label htmlFor="deal-fee">Acquisition Fee ($)</Label>
                    <Input id="deal-fee" type="number" value={addDealForm.acquisition_fee} onChange={(e) => setAddDealForm({ ...addDealForm, acquisition_fee: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="deal-notes">Notes (optional)</Label>
                  <textarea id="deal-notes" value={addDealForm.notes} onChange={(e) => setAddDealForm({ ...addDealForm, notes: e.target.value })} rows={2} placeholder="Internal notes about this assignment..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    <span className="text-sm text-yellow-800">Status: Pending</span>
                  </div>
                  <div className="flex-1 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <Mail className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-700">Investor notified</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowAddFromDealFlow(false); setSelectedDeal(null); setDealSearchQuery(''); setAssignError(''); }}>
              Cancel
            </Button>
            {selectedDeal && (
              <Button onClick={handleAddDealToPortfolio} disabled={addingDeal} className="bg-[#d4a574] hover:bg-[#c49464]">
                {addingDeal ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" />Assign to Portfolio</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Add Modal */}
      <Dialog open={showManualAdd} onOpenChange={setShowManualAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Property Manually</DialogTitle>
            <DialogDescription>Enter details for {investorName}'s portfolio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="manual-community">Community Name</Label>
                <Input id="manual-community" placeholder="e.g. Sunset Apartments" value={manualForm.community_name}
                  onChange={(e) => setManualForm({ ...manualForm, community_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="manual-website">Community Website</Label>
                <Input id="manual-website" placeholder="https://..." value={manualForm.community_website}
                  onChange={(e) => setManualForm({ ...manualForm, community_website: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="manual-address">Address *</Label>
              <Input id="manual-address" placeholder="123 Main Street" value={manualForm.address}
                onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="manual-city">City *</Label>
                <Input id="manual-city" placeholder="Miami" value={manualForm.city}
                  onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="manual-state">State *</Label>
                <Input id="manual-state" placeholder="FL" value={manualForm.state}
                  onChange={(e) => setManualForm({ ...manualForm, state: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="manual-zip">ZIP</Label>
                <Input id="manual-zip" placeholder="33126" value={manualForm.zip_code}
                  onChange={(e) => setManualForm({ ...manualForm, zip_code: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label htmlFor="manual-beds">Beds</Label><Input id="manual-beds" type="number" value={manualForm.bedrooms} onChange={(e) => setManualForm({ ...manualForm, bedrooms: parseInt(e.target.value) || 0 })} /></div>
              <div><Label htmlFor="manual-baths">Baths</Label><Input id="manual-baths" type="number" step="0.5" value={manualForm.bathrooms} onChange={(e) => setManualForm({ ...manualForm, bathrooms: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label htmlFor="manual-sqft">Sq Ft</Label><Input id="manual-sqft" type="number" value={manualForm.square_footage} onChange={(e) => setManualForm({ ...manualForm, square_footage: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="manual-rent">Rent ($/mo)</Label><Input id="manual-rent" type="number" value={manualForm.monthly_rent} onChange={(e) => setManualForm({ ...manualForm, monthly_rent: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label htmlFor="manual-fee">Fee ($)</Label><Input id="manual-fee" type="number" value={manualForm.acquisition_fee} onChange={(e) => setManualForm({ ...manualForm, acquisition_fee: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="manual-proptype">Property Type</Label>
                <Select value={manualForm.property_type} onValueChange={(v) => setManualForm({ ...manualForm, property_type: v })}>
                  <SelectTrigger id="manual-proptype"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_family">Single Family</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="multi_family">Multi-Family</SelectItem>
                    <SelectItem value="duplex">Duplex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="manual-optype">Operation Type</Label>
                <Select value={manualForm.operation_type} onValueChange={(v) => setManualForm({ ...manualForm, operation_type: v })}>
                  <SelectTrigger id="manual-optype"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="str">Short-Term Rental</SelectItem>
                    <SelectItem value="corporate">Corporate Housing</SelectItem>
                    <SelectItem value="coliving">Co-Living</SelectItem>
                    <SelectItem value="mtr">Mid-Term Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="manual-status">Status</Label>
              <Select value={manualForm.property_status} onValueChange={(v) => setManualForm({ ...manualForm, property_status: v })}>
                <SelectTrigger id="manual-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="manual-notes">Notes</Label>
              <textarea id="manual-notes" value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} rows={2}
                placeholder="Optional notes..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
            </div>
            <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
              <Mail className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-700">Investor will be notified</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualAdd(false)}>Cancel</Button>
            <Button onClick={handleManualAdd} disabled={addingManual || !manualForm.address.trim()} className="bg-[#d4a574] hover:bg-[#c49464]">
              {addingManual && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Plus className="w-4 h-4 mr-2" />Add to Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
