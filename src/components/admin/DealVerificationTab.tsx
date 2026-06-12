import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, ShieldCheck, AlertTriangle, CheckCircle, XCircle, 
  Building2, MapPin, Phone, Mail, User, Calendar, Clock,
  FileText, Eye, Search, RefreshCw, Filter, ChevronRight,
  DollarSign, Home, Bed, Bath, TrendingUp, Globe, Bot, Sparkles
} from 'lucide-react';

interface DealVerificationTabProps {
  staffId?: string;
  staffName?: string;
}

interface Property {
  id: string;
  listing_title: string;
  listing_description?: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  acquisition_fee: number;
  is_furnished: boolean;
  is_verified: boolean;
  is_published: boolean;
  status: string;
  deal_status?: string;
  workflow_stage?: string;
  operation_type: string;
  property_type?: string;
  penny_score?: number;
  created_at: string;
  landlord_name?: string;
  landlord_phone?: string;
  landlord_email?: string;
  found_by_am_name?: string;
  photos?: string[];
  // Verification audit trail columns (now in DB)
  verification_checklist?: VerificationChecklist | null;
  verification_notes?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
}


interface VerificationChecklist {
  property_exists: boolean;
  landlord_contacted: boolean;
  landlord_approved_str: boolean;
  lease_verified: boolean;
  photos_verified: boolean;
  pricing_verified: boolean;
  market_analysis_complete: boolean;
  compliance_checked: boolean;
}

const DEFAULT_CHECKLIST: VerificationChecklist = {
  property_exists: false,
  landlord_contacted: false,
  landlord_approved_str: false,
  lease_verified: false,
  photos_verified: false,
  pricing_verified: false,
  market_analysis_complete: false,
  compliance_checked: false,
};

const CHECKLIST_ITEMS = [
  { key: 'property_exists', label: 'Property Exists & Matches Listing', description: 'Confirmed property address and details are accurate' },
  { key: 'landlord_contacted', label: 'Landlord Contacted', description: 'Successfully reached landlord by phone or email' },
  { key: 'landlord_approved_str', label: 'Landlord Approved STR/Co-Living', description: 'Landlord has given explicit approval for rental arbitrage' },
  { key: 'lease_verified', label: 'Lease Terms Verified', description: 'Reviewed lease agreement and confirmed subletting is allowed' },
  { key: 'photos_verified', label: 'Photos Verified', description: 'Photos match actual property condition' },
  { key: 'pricing_verified', label: 'Pricing Verified', description: 'Rent and acquisition fee are accurate and competitive' },
  { key: 'market_analysis_complete', label: 'Market Analysis Complete', description: 'STR/co-living revenue projections are realistic' },
  { key: 'compliance_checked', label: 'Compliance Checked', description: 'Local regulations allow short-term rentals or co-living' },
];

export function DealVerificationTab({ staffId, staffName }: DealVerificationTabProps) {
  // Resolve the staff display name: use prop, fall back to localStorage, then 'Staff'
  const resolvedStaffName = (() => {
    if (staffName && staffName !== 'Staff') return staffName;
    try {
      const session = JSON.parse(localStorage.getItem('staffSession') || '{}');
      const fromSession = session.first_name 
        ? `${session.first_name} ${session.last_name || ''}`.trim() 
        : session.name;
      if (fromSession && fromSession !== 'Staff') return fromSession;
    } catch {}
    return staffName || 'Staff';
  })();

  const resolvedStaffId = staffId || (() => {
    try {
      return JSON.parse(localStorage.getItem('staffSession') || '{}').id || undefined;
    } catch { return undefined; }
  })();

  const { toast } = useToast();

  const [loading, setLoading] = useState(true);

  const [properties, setProperties] = useState<Property[]>([]);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'all'>('pending');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [checklist, setChecklist] = useState<VerificationChecklist>(DEFAULT_CHECKLIST);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [landlordInfo, setLandlordInfo] = useState({ name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);


  useEffect(() => {
    fetchProperties();
  }, [filter, statusFilter]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      // BUG FIX: Removed .eq('status', 'published') — this was filtering out ALL unverified deals
      // that hadn't been published yet (e.g., 'new', 'researching', 'negotiating', 'approved').
      // The verification tab should show properties in ANY status, filtered only by is_verified.
      let query = supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by verification status
      if (filter === 'pending') {
        query = query.or('is_verified.is.null,is_verified.eq.false');
      } else if (filter === 'verified') {
        query = query.eq('is_verified', true);
      }

      // Optional status filter (new, researching, etc.)
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Exclude deleted/archived
      query = query.not('status', 'in', '("deleted","archived")');

      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase query error:', error);
        // Fallback: try without the .not() filter in case the column doesn't support it
        const fallbackQuery = supabase
          .from('properties')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (filter === 'pending') {
          fallbackQuery.or('is_verified.is.null,is_verified.eq.false');
        } else if (filter === 'verified') {
          fallbackQuery.eq('is_verified', true);
        }
        
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        if (fallbackError) throw fallbackError;
        setProperties(fallbackData || []);
      } else {
        setProperties(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching properties:', err);
      toast({ title: 'Error', description: 'Failed to load properties', variant: 'destructive' });
    }
    setLoading(false);
  };

  const filteredProperties = properties.filter(p => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.listing_title?.toLowerCase().includes(searchLower) ||
      p.address?.toLowerCase().includes(searchLower) ||
      p.city?.toLowerCase().includes(searchLower) ||
      p.state?.toLowerCase().includes(searchLower) ||
      p.zip_code?.includes(search) ||
      p.found_by_am_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleOpenVerify = (property: Property) => {
    setSelectedProperty(property);
    // Pre-populate from existing verification data if available (audit trail from DB)
    if (property.verification_checklist && typeof property.verification_checklist === 'object') {
      setChecklist({ ...DEFAULT_CHECKLIST, ...property.verification_checklist });
    } else {
      setChecklist(DEFAULT_CHECKLIST);
    }
    setVerificationNotes(property.verification_notes || '');
    setLandlordInfo({
      name: property.landlord_name || '',
      phone: property.landlord_phone || '',
      email: property.landlord_email || '',
    });
    setShowVerifyModal(true);
  };


  const handleChecklistChange = (key: keyof VerificationChecklist, checked: boolean) => {
    setChecklist(prev => ({ ...prev, [key]: checked }));
  };

  const allChecksPassed = Object.values(checklist).every(v => v === true);
  const checksCompleted = Object.values(checklist).filter(Boolean).length;

  // Approve/Verify a deal
  // CRITICAL FIX: The direct DB update now only includes columns known to exist in the properties table.
  // Columns like `verification_checklist`, `verification_notes`, `verified_at`, `verified_by` may not exist
  // and were causing the update to fail silently (returning error but not throwing).
  // We now use a progressive approach: try full update, then strip unknown columns on failure.
  const handleVerify = async (approved: boolean) => {
    if (!selectedProperty) return;
    
    setSubmitting(true);
    try {
      // Build the update payload — separate "safe" columns from "optional" columns
      const safeUpdate: Record<string, any> = {
        is_verified: approved,
        status: approved ? 'approved' : selectedProperty.status,
        deal_status: approved ? 'approved' : selectedProperty.deal_status,
        landlord_name: landlordInfo.name,
        landlord_phone: landlordInfo.phone,
        landlord_email: landlordInfo.email,
        updated_at: new Date().toISOString(),
      };

      // Verification audit trail columns — now persisted in DB
      const optionalFields: Record<string, any> = {
        verification_checklist: checklist,
        verification_notes: verificationNotes,
        verified_at: new Date().toISOString(),
        verified_by: resolvedStaffName,
      };

      // Try edge function first for comprehensive update (includes all fields)
      let edgeFunctionSucceeded = false;
      try {
        const { data, error } = await supabase.functions.invoke('update-property', {
          body: {
            id: selectedProperty.id,
            ...safeUpdate,
            ...optionalFields,
            updated_by_staff_id: resolvedStaffId,
            updated_by_staff_name: resolvedStaffName,
          }
        });

        if (!error && data?.success !== false) {
          edgeFunctionSucceeded = true;
          toast({
            title: approved ? 'Deal Approved & Verified' : 'Verification Rejected',
            description: approved 
              ? `"${selectedProperty.listing_title || selectedProperty.address}" is now verified and approved. You can publish it from the Deal Pipeline.`
              : 'Property has been marked as not verified.',
          });
          setShowVerifyModal(false);
          fetchProperties();
          setSubmitting(false);
          return;
        } else {
          console.warn('Edge function returned error:', error?.message || data?.error);
        }
      } catch (efErr) {
        console.warn('Edge function failed, falling back to direct DB:', efErr);
      }

      // Direct database fallback — try with all fields first, then strip optional on failure
      let dbSuccess = false;
      
      // Attempt 1: Full update with optional fields
      try {
        const { error } = await supabase
          .from('properties')
          .update({ ...safeUpdate, ...optionalFields })
          .eq('id', selectedProperty.id);

        if (!error) {
          dbSuccess = true;
        } else {
          console.warn('Full DB update failed (likely missing columns):', error.message);
        }
      } catch (e) {
        console.warn('Full DB update exception:', e);
      }

      // Attempt 2: Safe-only update (strip optional columns that may not exist)
      if (!dbSuccess) {
        try {
          const { error } = await supabase
            .from('properties')
            .update(safeUpdate)
            .eq('id', selectedProperty.id);

          if (error) throw error;
          dbSuccess = true;
          console.log('Safe-only DB update succeeded (optional columns stripped)');
        } catch (safeErr: any) {
          console.error('Even safe-only DB update failed:', safeErr);
          throw safeErr;
        }
      }

      toast({
        title: approved ? 'Deal Approved & Verified' : 'Verification Rejected',
        description: approved 
          ? `"${selectedProperty.listing_title || selectedProperty.address}" is now verified and approved.`
          : 'Property has been marked as not verified.',
      });

      setShowVerifyModal(false);
      fetchProperties();
    } catch (err: any) {
      console.error('Error updating verification:', err);
      toast({ title: 'Error', description: `Failed to update verification status: ${err.message || 'Unknown error'}`, variant: 'destructive' });
    }
    setSubmitting(false);
  };



  // Approve AND Publish in one step
  // Uses same progressive column strategy as handleVerify
  const handleApproveAndPublish = async () => {
    if (!selectedProperty) return;
    
    setPublishing(true);
    try {
      const safePublishUpdate: Record<string, any> = {
        is_verified: true,
        is_published: true,
        status: 'published',
        deal_status: 'published',
        workflow_stage: 'published',
        landlord_name: landlordInfo.name,
        landlord_phone: landlordInfo.phone,
        landlord_email: landlordInfo.email,
        updated_at: new Date().toISOString(),
      };

      const optionalPublishFields: Record<string, any> = {
        verification_checklist: checklist,
        verification_notes: verificationNotes,
        verified_at: new Date().toISOString(),
        verified_by: resolvedStaffName,
      };

      // Try edge function first
      try {
        const { data, error } = await supabase.functions.invoke('update-property', {
          body: {
            id: selectedProperty.id,
            ...safePublishUpdate,
            ...optionalPublishFields,
            updated_by_staff_id: resolvedStaffId,
            updated_by_staff_name: resolvedStaffName,
          }
        });
        if (!error && data?.success !== false) {
          // Notify AM
          try {
            await supabase.functions.invoke('am-submit-deal', {
              body: {
                action: 'notify_marketplace_posted',
                property_id: selectedProperty.id,
                posted_by_name: resolvedStaffName
              }
            });
          } catch (notifyErr) {
            console.warn('Failed to notify AM:', notifyErr);
          }

          toast({
            title: 'Deal Approved & Published!',
            description: `"${selectedProperty.listing_title || selectedProperty.address}" is now live on the marketplace.`,
          });
          setShowVerifyModal(false);
          fetchProperties();
          setPublishing(false);
          return;
        }
      } catch (efErr) {
        console.warn('Edge function failed, falling back to direct DB:', efErr);
      }


      // Direct database fallback — progressive approach
      let dbSuccess = false;

      // Attempt 1: Full update with optional fields
      try {
        const { error } = await supabase
          .from('properties')
          .update({ ...safePublishUpdate, ...optionalPublishFields })
          .eq('id', selectedProperty.id);

        if (!error) {
          dbSuccess = true;
        } else {
          console.warn('Full publish DB update failed:', error.message);
        }
      } catch (e) {
        console.warn('Full publish DB update exception:', e);
      }

      // Attempt 2: Safe-only update
      if (!dbSuccess) {
        const { error } = await supabase
          .from('properties')
          .update(safePublishUpdate)
          .eq('id', selectedProperty.id);

        if (error) throw error;
        console.log('Safe-only publish DB update succeeded');
      }

      toast({
        title: 'Deal Approved & Published!',
        description: `"${selectedProperty.listing_title || selectedProperty.address}" is now live on the marketplace.`,
      });

      setShowVerifyModal(false);
      fetchProperties();
    } catch (err: any) {
      console.error('Error publishing:', err);
      toast({ title: 'Error', description: `Failed to approve and publish: ${err.message || 'Unknown error'}`, variant: 'destructive' });
    }
    setPublishing(false);
  };


  const pendingCount = properties.filter(p => !p.is_verified).length;
  const verifiedCount = properties.filter(p => p.is_verified).length;

  const statusColors: Record<string, string> = {
    new: 'bg-gray-100 text-gray-700',
    researching: 'bg-blue-100 text-blue-700',
    outreach: 'bg-yellow-100 text-yellow-700',
    negotiating: 'bg-orange-100 text-orange-700',
    approved: 'bg-green-100 text-green-700',
    published: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6" role="region" aria-label="Deal Verification Dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Deal Verification</h2>
          <p className="text-gray-600">
            Review, verify, approve, and publish properties — all statuses shown
          </p>
        </div>
        <Button onClick={fetchProperties} variant="outline" aria-label="Refresh property list">
          <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4" role="group" aria-label="Verification statistics">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg" aria-hidden="true">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700" aria-label={`${pendingCount} pending verification`}>{pendingCount}</p>
                <p className="text-sm text-yellow-600">Pending Verification</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg" aria-hidden="true">
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700" aria-label={`${verifiedCount} verified properties`}>{verifiedCount}</p>
                <p className="text-sm text-green-600">Verified Properties</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg" aria-hidden="true">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-700" aria-label={`${properties.length} total properties`}>{properties.length}</p>
                <p className="text-sm text-gray-600">Total Properties</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2" role="group" aria-label="Verification status filter">
              <Button
                variant={filter === 'pending' ? 'default' : 'outline'}
                onClick={() => setFilter('pending')}
                className={filter === 'pending' ? 'bg-[#1a365d]' : ''}
                aria-pressed={filter === 'pending'}
              >
                <AlertTriangle className="w-4 h-4 mr-2" aria-hidden="true" />
                Pending ({pendingCount})
              </Button>
              <Button
                variant={filter === 'verified' ? 'default' : 'outline'}
                onClick={() => setFilter('verified')}
                className={filter === 'verified' ? 'bg-green-600' : ''}
                aria-pressed={filter === 'verified'}
              >
                <ShieldCheck className="w-4 h-4 mr-2" aria-hidden="true" />
                Verified ({verifiedCount})
              </Button>
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                aria-pressed={filter === 'all'}
              >
                All ({properties.length})
              </Button>
            </div>

            {/* Deal status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" aria-label="Filter by deal status">
                <SelectValue placeholder="Deal Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="researching">Researching</SelectItem>
                <SelectItem value="outreach">Outreach</SelectItem>
                <SelectItem value="negotiating">Negotiating</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <Input
                  placeholder="Search by title, address, city, ZIP, or AM name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  aria-label="Search properties"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Properties List */}
      {loading ? (
        <div className="flex justify-center py-12" role="status" aria-label="Loading properties">
          <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
          <span className="sr-only">Loading properties...</span>
        </div>
      ) : filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-600">No Properties Found</h3>
            <p className="text-gray-500 mt-2">
              {filter === 'pending' 
                ? 'No unverified properties match your filters. Try changing the status filter or search terms.' 
                : 'No properties match your search criteria.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" role="list" aria-label={`${filteredProperties.length} properties`}>
          {filteredProperties.map((property) => (
            <Card key={property.id} className="hover:shadow-md transition-shadow" role="listitem">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {property.photos && property.photos.length > 0 ? (
                        <img 
                          src={property.photos[0]} 
                          alt={`Photo of ${property.listing_title || property.address}`}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <Building2 className="w-8 h-8 text-gray-400" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {property.is_verified ? (
                          <Badge className="bg-green-100 text-green-700">
                            <ShieldCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-700">
                            <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
                            Unverified
                          </Badge>
                        )}
                        <Badge className={statusColors[property.status] || 'bg-gray-100 text-gray-700'}>
                          {property.status}
                        </Badge>
                        <Badge variant="outline">
                          {property.operation_type === 'coliving' ? 'Co-Living' : 
                           property.operation_type === 'both' ? 'STR + Co-Living' : 
                           property.operation_type === 'mtr' ? 'MTR' : 'STR'}
                        </Badge>
                        {property.penny_score && (
                          <Badge className={`${property.penny_score >= 70 ? 'bg-green-500' : property.penny_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'} text-white`}>
                            <Bot className="w-3 h-3 mr-1" aria-hidden="true" />
                            Penny: {property.penny_score}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900">
                        {property.listing_title || property.address}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" aria-hidden="true" />
                        {property.address}, {property.city}, {property.state} {property.zip_code}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Bed className="w-4 h-4" aria-hidden="true" />
                          {property.bedrooms} bed
                        </span>
                        <span className="flex items-center gap-1">
                          <Bath className="w-4 h-4" aria-hidden="true" />
                          {property.bathrooms} bath
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" aria-hidden="true" />
                          ${property.monthly_rent?.toLocaleString()}/mo
                        </span>
                        {property.found_by_am_name && (
                          <span className="flex items-center gap-1 text-indigo-600">
                            <User className="w-4 h-4" aria-hidden="true" />
                            AM: {property.found_by_am_name}
                          </span>
                        )}
                      </div>
                      {/* Verification audit trail */}
                      {property.is_verified && (property.verified_by || property.verified_at) && (
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-green-700">
                          <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                          <span>
                            Verified{property.verified_by ? ` by ${property.verified_by}` : ''}
                            {property.verified_at ? ` on ${new Date(property.verified_at).toLocaleDateString()}` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#1a365d]">
                        ${property.acquisition_fee?.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Acquisition Fee</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(property.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleOpenVerify(property)}
                      className={property.is_verified 
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                        : 'bg-[#d4a574] hover:bg-[#c49464]'}
                      aria-label={property.is_verified 
                        ? `Review verified property: ${property.listing_title || property.address}` 
                        : `Verify property: ${property.listing_title || property.address}`}
                    >
                      <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
                      {property.is_verified ? 'Review' : 'Verify'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Verification Modal */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="verify-modal-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
              Property Verification & Approval
            </DialogTitle>
            <p id="verify-modal-desc" className="text-sm text-gray-500">
              Complete the checklist to verify this property. You can approve, reject, or approve and publish directly.
            </p>
          </DialogHeader>

          {selectedProperty && (
            <div className="space-y-6">
              {/* Property Summary */}
              <Card className="bg-gray-50">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">
                        {selectedProperty.listing_title || selectedProperty.address}
                      </h3>
                      <p className="text-gray-600 flex items-center gap-1 mb-3">
                        <MapPin className="w-4 h-4" aria-hidden="true" />
                        {selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={statusColors[selectedProperty.status] || 'bg-gray-100 text-gray-700'}>
                        {selectedProperty.status}
                      </Badge>
                      {selectedProperty.is_verified ? (
                        <Badge className="bg-green-100 text-green-700">Verified</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">Unverified</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Bedrooms:</span>
                      <p className="font-medium">{selectedProperty.bedrooms}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Bathrooms:</span>
                      <p className="font-medium">{selectedProperty.bathrooms}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Monthly Rent:</span>
                      <p className="font-medium">${selectedProperty.monthly_rent?.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Acquisition Fee:</span>
                      <p className="font-medium">${selectedProperty.acquisition_fee?.toLocaleString()}</p>
                    </div>
                  </div>
                  {selectedProperty.found_by_am_name && (
                    <p className="text-sm text-indigo-600 mt-2 flex items-center gap-1">
                      <User className="w-3 h-3" aria-hidden="true" />
                      Found by AM: {selectedProperty.found_by_am_name}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Landlord Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" aria-hidden="true" />
                    Landlord Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="verify-landlord-name">Landlord Name</Label>
                      <Input
                        id="verify-landlord-name"
                        value={landlordInfo.name}
                        onChange={(e) => setLandlordInfo({ ...landlordInfo, name: e.target.value })}
                        placeholder="Enter landlord name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="verify-landlord-phone">Phone Number</Label>
                      <Input
                        id="verify-landlord-phone"
                        value={landlordInfo.phone}
                        onChange={(e) => setLandlordInfo({ ...landlordInfo, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label htmlFor="verify-landlord-email">Email Address</Label>
                      <Input
                        id="verify-landlord-email"
                        type="email"
                        value={landlordInfo.email}
                        onChange={(e) => setLandlordInfo({ ...landlordInfo, email: e.target.value })}
                        placeholder="landlord@example.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Verification Checklist */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" aria-hidden="true" />
                    Verification Checklist
                  </CardTitle>
                  <CardDescription>
                    Complete all items before approving the property
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4" role="group" aria-label="Verification checklist items">
                    {CHECKLIST_ITEMS.map((item) => (
                      <div 
                        key={item.key} 
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                          checklist[item.key as keyof VerificationChecklist] 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <Checkbox
                          id={`verify-${item.key}`}
                          checked={checklist[item.key as keyof VerificationChecklist]}
                          onCheckedChange={(checked) => 
                            handleChecklistChange(item.key as keyof VerificationChecklist, checked as boolean)
                          }
                          className="mt-0.5"
                          aria-describedby={`verify-${item.key}-desc`}
                        />
                        <div className="flex-1">
                          <label 
                            htmlFor={`verify-${item.key}`} 
                            className="font-medium text-gray-900 cursor-pointer"
                          >
                            {item.label}
                          </label>
                          <p id={`verify-${item.key}-desc`} className="text-sm text-gray-500">{item.description}</p>
                        </div>
                        {checklist[item.key as keyof VerificationChecklist] && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" aria-hidden="true" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Verification Progress</span>
                      <span className="text-sm text-gray-500" aria-label={`${checksCompleted} of ${CHECKLIST_ITEMS.length} items completed`}>
                        {checksCompleted} / {CHECKLIST_ITEMS.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={checksCompleted} aria-valuemin={0} aria-valuemax={CHECKLIST_ITEMS.length}>
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          allChecksPassed ? 'bg-green-500' : 'bg-[#d4a574]'
                        }`}
                        style={{ 
                          width: `${(checksCompleted / CHECKLIST_ITEMS.length) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Verification Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    Verification Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    id="verify-notes"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Add any notes about the verification process, landlord communication, concerns, etc."
                    rows={4}
                    aria-label="Verification notes"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => handleVerify(false)}
              disabled={submitting || publishing}
              aria-label="Reject this property"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              <XCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Reject
            </Button>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setShowVerifyModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleVerify(true)}
                disabled={submitting || publishing || !allChecksPassed}
                className="bg-green-600 hover:bg-green-700"
                aria-label={allChecksPassed ? 'Approve and verify this property' : `Complete all ${CHECKLIST_ITEMS.length} checklist items to approve`}
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                <ShieldCheck className="w-4 h-4 mr-2" aria-hidden="true" />
                Approve & Verify
              </Button>
              <Button
                onClick={handleApproveAndPublish}
                disabled={submitting || publishing || !allChecksPassed}
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                aria-label={allChecksPassed ? 'Approve, verify, and publish this property to the marketplace' : `Complete all ${CHECKLIST_ITEMS.length} checklist items to publish`}
              >
                {publishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                <Globe className="w-4 h-4 mr-2" aria-hidden="true" />
                Approve & Publish
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
