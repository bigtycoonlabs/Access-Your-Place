import { useState, useEffect } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, UserPlus, Building, DollarSign, 
  CheckCircle, Search, User, Home, CreditCard, 
  Globe, ExternalLink, ChevronDown, MapPin, Clock, X, AlertTriangle, RefreshCw
} from 'lucide-react';

interface Investor {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company_name?: string;
  phone?: string;
  status?: string;
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  listing_title?: string;
  title?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthly_rent?: number;
  acquisition_fee?: number;
  acquisition_status?: string;
  assigned_investor_id?: string;
  listing_url?: string;
  operation_type?: string;
  is_published?: boolean;
  status?: string;
  property_type?: string;
  sqft?: number;
}

interface PropertyAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'assign_to_property' | 'assign_to_investor';
  property?: Property | null;
  investor?: Investor | null;
  onAssigned: () => void;
}

export function PropertyAssignmentModal({ 
  open, 
  onOpenChange, 
  mode, 
  property, 
  investor,
  onAssigned 
}: PropertyAssignmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [publishedDeals, setPublishedDeals] = useState<Property[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownFilter, setDropdownFilter] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [dealPopoverOpen, setDealPopoverOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchDebug, setFetchDebug] = useState<string[]>([]);
  const { toast } = useToast();

  const addDebug = (msg: string) => {
    console.log(`[PropertyAssignment] ${msg}`);
    setFetchDebug(prev => [...prev.slice(-9), msg]);
  };

  // Load data when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setDropdownFilter('');
      setDealPopoverOpen(false);
      setFetchError(null);
      setFetchDebug([]);

      if (mode === 'assign_to_property' && property) {
        setSelectedProperty(property);
        setSelectedInvestor(null);
        setPaymentAmount(property.acquisition_fee?.toString() || '');
        fetchInvestors();
      } else if (mode === 'assign_to_investor' && investor) {
        setSelectedInvestor(investor);
        setSelectedProperty(null);
        fetchPublishedDeals();
        fetchProperties();
      }
    }
  }, [open, mode, property, investor]);

  const fetchInvestors = async () => {
    setSearching(true);
    let fetched = false;

    // Strategy 1: Use manage-investor-admin (most reliable - uses service role key)
    try {
      addDebug('Fetching investors via manage-investor-admin...');
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'get_all_investors', limit: 500 }
      });
      if (!error && data?.investors?.length) {
        setInvestors(data.investors.map((inv: any) => ({
          ...inv,
          first_name: inv.first_name || inv.full_name?.split(' ')[0] || '',
          last_name: inv.last_name || inv.full_name?.split(' ').slice(1).join(' ') || ''
        })));
        fetched = true;
        addDebug(`Loaded ${data.investors.length} investors via edge function`);
      } else {
        addDebug(`Edge function returned: error=${!!error}, investors=${data?.investors?.length || 0}`);
      }
    } catch (err: any) {
      addDebug(`Edge function failed: ${err.message}`);
    }

    // Strategy 2: Direct DB query fallback
    if (!fetched) {
      try {
        addDebug('Trying direct DB query for investors...');
        const { data, error } = await supabase
          .from('investors')
          .select('id, email, full_name, phone, company_name, is_active, onboarding_completed')
          .order('created_at', { ascending: false })
          .limit(500);
        if (!error && data?.length) {
          setInvestors(data.map((inv: any) => ({
            ...inv,
            first_name: inv.full_name?.split(' ')[0] || '',
            last_name: inv.full_name?.split(' ').slice(1).join(' ') || ''
          })));
          fetched = true;
          addDebug(`Loaded ${data.length} investors via direct DB`);
        } else {
          addDebug(`Direct DB: error=${error?.message}, count=${data?.length || 0}`);
        }
      } catch (err: any) {
        addDebug(`Direct DB failed: ${err.message}`);
      }
    }

    if (!fetched) {
      setFetchError('Unable to load investors. Check edge function logs.');
    }

    setSearching(false);
  };

  const fetchPublishedDeals = async () => {
    setSearching(true);
    setFetchError(null);
    let deals: Property[] = [];
    
    // Strategy 1 (PRIMARY): Use get-properties edge function with service_role_key
    try {
      addDebug('Fetching deals via get-properties edge function...');
      const { data, error } = await supabase.functions.invoke('get-properties', {
        body: { include_all: true, limit: 500 }
      });
      if (!error && data?.properties?.length) {
        deals = data.properties;
        addDebug(`Edge function returned ${deals.length} properties`);
      } else {
        addDebug(`Edge function: error=${error?.message || 'none'}, count=${data?.properties?.length || 0}`);
      }
    } catch (err: any) {
      addDebug(`Edge function failed: ${err.message}`);
    }

    // Strategy 2: Direct DB with correct column names
    if (deals.length === 0) {
      try {
        addDebug('Trying direct DB query (is_published=true)...');
        const { data, error } = await supabase
          .from('properties')
          .select('id, address, listing_title, city, state, zip_code, bedrooms, bathrooms, sqft, monthly_rent, acquisition_fee, property_type, operation_type, listing_url, is_published, status, assigned_investor_id')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(500);
        if (!error && data?.length) {
          deals = data;
          addDebug(`Direct DB (is_published=true) returned ${deals.length} properties`);
        } else {
          addDebug(`Direct DB (is_published): error=${error?.message}, count=${data?.length || 0}`);
        }
      } catch (err: any) {
        addDebug(`Direct DB failed: ${err.message}`);
      }
    }

    // Strategy 3: Direct DB - get ALL properties as fallback
    if (deals.length === 0) {
      try {
        addDebug('Trying direct DB query (all properties)...');
        const { data, error } = await supabase
          .from('properties')
          .select('id, address, listing_title, city, state, zip_code, bedrooms, bathrooms, sqft, monthly_rent, acquisition_fee, property_type, operation_type, listing_url, is_published, status, assigned_investor_id')
          .order('created_at', { ascending: false })
          .limit(500);
        if (!error && data?.length) {
          deals = data;
          addDebug(`Direct DB (all) returned ${deals.length} properties`);
        } else {
          addDebug(`Direct DB (all): error=${error?.message}, count=${data?.length || 0}`);
        }
      } catch (err: any) {
        addDebug(`Direct DB (all) failed: ${err.message}`);
      }
    }

    if (deals.length === 0) {
      setFetchError('No properties found. Check that properties exist in the database.');
    }

    addDebug(`Final deal count for dropdown: ${deals.length}`);
    setPublishedDeals(deals);
    setSearching(false);
  };

  const fetchProperties = async () => {
    let results: Property[] = [];
    
    // Strategy 1: Edge function
    try {
      const { data, error } = await supabase.functions.invoke('get-properties', {
        body: { include_all: true, limit: 500 }
      });
      if (!error && data?.properties?.length) {
        results = data.properties;
      }
    } catch {}

    // Strategy 2: Direct DB with correct columns
    if (results.length === 0) {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('id, address, listing_title, city, state, zip_code, bedrooms, bathrooms, sqft, monthly_rent, acquisition_fee, property_type, operation_type, listing_url, is_published, status, assigned_investor_id')
          .order('is_published', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500);
        if (!error && data?.length) {
          results = data;
        }
      } catch {}
    }

    setProperties(results);
  };

  const handleAssign = async () => {
    if (!selectedProperty || !selectedInvestor) {
      toast({ title: 'Select both a property and investor', variant: 'destructive' });
      return;
    }

    setLoading(true);
    let success = false;

    // Strategy 1: Edge function (most reliable)
    try {
      const { data, error } = await supabase.functions.invoke('manage-property-assignments', {
        body: {
          action: 'create',
          property_id: selectedProperty.id,
          investor_id: selectedInvestor.id,
          assigned_by: 'Staff',
          payment_amount: parseFloat(paymentAmount) || selectedProperty.acquisition_fee || 0,
          notes,
          community_name: selectedProperty.listing_title || '',
          community_website: selectedProperty.listing_url || ''
        }
      });

      if (!error && data && !data.error) {
        success = true;

        if (markAsPaid && data?.assignment?.id) {
          await supabase.functions.invoke('manage-property-assignments', {
            body: {
              action: 'update',
              assignment_id: data.assignment.id,
              status: 'paid',
              payment_date: new Date().toISOString(),
              payment_method: paymentMethod,
              payment_reference: paymentReference
            }
          });
        }
      } else {
        console.warn('[PropertyAssignment] Edge function error:', error || data?.error);
      }
    } catch (err: any) {
      console.warn('[PropertyAssignment] Edge function exception:', err.message);
    }

    // Strategy 2: Direct DB fallback - insert into investor_portfolio
    if (!success) {
      try {
        const portfolioData: Record<string, any> = {
          investor_id: selectedInvestor.id,
          address: selectedProperty.address || '',
          city: selectedProperty.city || '',
          state: selectedProperty.state || '',
          zip_code: selectedProperty.zip_code || '',
          bedrooms: selectedProperty.bedrooms || 0,
          bathrooms: selectedProperty.bathrooms || 0,
          square_footage: selectedProperty.sqft || null,
          monthly_rent: selectedProperty.monthly_rent || 0,
          acquisition_fee: parseFloat(paymentAmount) || selectedProperty.acquisition_fee || 0,
          initial_investment: parseFloat(paymentAmount) || selectedProperty.acquisition_fee || 0,
          property_type: selectedProperty.property_type || 'single_family',
          property_status: 'pending',
          status: 'active',
          acquired_through_ayp: true,
          acquisition_source: 'ayp',
          deal_flow_property_id: selectedProperty.id,
          added_by_staff: true,
          assigned_by: 'Staff',
          operation_type: selectedProperty.operation_type || 'str',
          community_name: selectedProperty.listing_title || '',
          community_website: selectedProperty.listing_url || '',
          notes: notes || 'Assigned from deal flow',
          staff_notes: [{ author: 'Staff', text: `Property assigned from deal flow. Community: ${selectedProperty.listing_title || 'N/A'}. ${notes || ''}`.trim(), date: new Date().toISOString() }],
          created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('investor_portfolio')
          .insert(portfolioData);

        if (!insertError) {
          success = true;

          // Also update the property's assigned_investor_id
          try {
            await supabase
              .from('properties')
              .update({ assigned_investor_id: selectedInvestor.id, acquisition_status: 'assigned' })
              .eq('id', selectedProperty.id);
          } catch {}

          // Send notification to investor
          try {
            await supabase.from('investor_notifications').insert({
              investor_id: selectedInvestor.id,
              notification_type: 'property_added_to_portfolio',
              type: 'property_added_to_portfolio',
              title: 'New Property Added to Your Portfolio',
              message: `A new property${selectedProperty.listing_title ? ` at ${selectedProperty.listing_title}` : ''} (${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state}) has been added to your portfolio.`,
              data: { address: selectedProperty.address, city: selectedProperty.city, state: selectedProperty.state, community_name: selectedProperty.listing_title },
              read: false,
              created_at: new Date().toISOString()
            });
          } catch {}
        } else {
          console.error('[PropertyAssignment] Portfolio insert error:', insertError);
        }
      } catch (err: any) {
        console.error('[PropertyAssignment] DB fallback error:', err);
      }
    }

    if (success) {
      toast({ 
        title: 'Property assigned!', 
        description: `${selectedProperty.listing_title || selectedProperty.address} assigned to ${selectedInvestor.first_name || selectedInvestor.email}${markAsPaid ? ' (paid)' : ''}`
      });
      onAssigned();
      onOpenChange(false);
      resetForm();
    } else {
      toast({ 
        title: 'Assignment failed', 
        description: 'Unable to assign property. Please try again or contact support.',
        variant: 'destructive' 
      });
    }

    setLoading(false);
  };

  const resetForm = () => {
    setSelectedInvestor(null);
    setSelectedProperty(null);
    setSearchQuery('');
    setDropdownFilter('');
    setPaymentAmount('');
    setNotes('');
    setMarkAsPaid(false);
    setPaymentMethod('');
    setPaymentReference('');
    setDealPopoverOpen(false);
    setFetchError(null);
    setFetchDebug([]);
  };

  const getDisplayName = (prop: Property) => {
    return prop.listing_title || prop.title || prop.address || 'Property';
  };

  // Client-side filtering for investors
  const filteredInvestors = searchQuery.trim()
    ? investors.filter(inv => {
        const q = searchQuery.toLowerCase();
        return inv.email?.toLowerCase().includes(q) ||
          inv.first_name?.toLowerCase().includes(q) ||
          inv.last_name?.toLowerCase().includes(q) ||
          inv.full_name?.toLowerCase().includes(q) ||
          inv.company_name?.toLowerCase().includes(q) ||
          inv.phone?.includes(searchQuery);
      })
    : investors;

  // Client-side filtering for all properties (search bar)
  const filteredProperties = searchQuery.trim()
    ? properties.filter(prop => {
        const q = searchQuery.toLowerCase();
        return prop.address?.toLowerCase().includes(q) ||
          prop.city?.toLowerCase().includes(q) ||
          prop.listing_title?.toLowerCase().includes(q) ||
          prop.zip_code?.includes(searchQuery);
      })
    : properties;

  // Separate filter for the published deals dropdown
  const filteredPublished = dropdownFilter.trim()
    ? publishedDeals.filter(d => {
        const q = dropdownFilter.toLowerCase();
        return d.address?.toLowerCase().includes(q) ||
          d.listing_title?.toLowerCase().includes(q) ||
          d.city?.toLowerCase().includes(q) ||
          d.zip_code?.includes(dropdownFilter);
      })
    : publishedDeals;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#d4a574]" />
            Assign Property to Investor
          </DialogTitle>
          <DialogDescription>
            {mode === 'assign_to_property' 
              ? 'Select an investor for this property.'
              : 'Select a deal to add to this investor\'s portfolio.'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="select" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select" className="min-h-[44px] touch-manipulation">
              {mode === 'assign_to_property' ? 'Select Investor' : 'Select Property'}
            </TabsTrigger>
            <TabsTrigger value="payment" className="min-h-[44px] touch-manipulation">Payment</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4 mt-4">
            {/* Show selected property info */}
            {mode === 'assign_to_property' && selectedProperty && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Building className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-blue-800 truncate">{getDisplayName(selectedProperty)}</p>
                      {selectedProperty.address && selectedProperty.address !== selectedProperty.listing_title && (
                        <p className="text-sm text-blue-600 truncate">{selectedProperty.address}</p>
                      )}
                      <p className="text-sm text-blue-600">{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {selectedProperty.bedrooms ? <span className="text-xs text-blue-600">{selectedProperty.bedrooms}bd/{selectedProperty.bathrooms}ba</span> : null}
                        {selectedProperty.monthly_rent ? <span className="text-xs text-blue-600">${selectedProperty.monthly_rent.toLocaleString()}/mo</span> : null}
                      </div>
                      {selectedProperty.listing_url && (
                        <a href={selectedProperty.listing_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1 mt-1">
                          <Globe className="w-3 h-3" />Website <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Show selected investor info */}
            {mode === 'assign_to_investor' && selectedInvestor && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">
                        {selectedInvestor.first_name} {selectedInvestor.last_name}
                        {selectedInvestor.company_name && <span className="text-green-600 font-normal ml-1">({selectedInvestor.company_name})</span>}
                      </p>
                      <p className="text-sm text-green-600">{selectedInvestor.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Banner */}
            {fetchError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">{fetchError}</p>
                  {fetchDebug.length > 0 && (
                    <details className="mt-1">
                      <summary className="text-xs text-red-600 cursor-pointer">Debug log</summary>
                      <div className="mt-1 text-xs text-red-500 space-y-0.5 font-mono">
                        {fetchDebug.map((msg, i) => <p key={i}>{msg}</p>)}
                      </div>
                    </details>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 text-xs border-red-300 text-red-700 min-h-[44px] touch-manipulation"
                    onClick={() => {
                      if (mode === 'assign_to_investor') {
                        fetchPublishedDeals();
                      } else {
                        fetchInvestors();
                      }
                    }}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Published Deals Popover (assign_to_investor mode) */}
            {mode === 'assign_to_investor' && (
              <div>
                <Label className="mb-1.5 block font-medium">
                  Available Deals ({searching ? '...' : publishedDeals.length})
                </Label>
                <Popover open={dealPopoverOpen} onOpenChange={setDealPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-gray-50 active:bg-gray-100 transition touch-manipulation"
                      aria-label={selectedProperty ? `Selected deal: ${getDisplayName(selectedProperty)}` : 'Choose a deal'}
                    >
                      <span className={selectedProperty ? 'text-gray-900 font-medium truncate' : 'text-muted-foreground truncate'}>
                        {searching ? 'Loading deals...' : selectedProperty ? getDisplayName(selectedProperty) : `Choose a deal (${publishedDeals.length} available)...`}
                      </span>
                      {searching ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${dealPopoverOpen ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[var(--radix-popover-trigger-width)] p-0 max-h-80 overflow-hidden flex flex-col"
                    align="start"
                    sideOffset={4}
                    onOpenAutoFocus={(e) => {
                      // Prevent focus stealing on mobile — let the search input get focus naturally
                      e.preventDefault();
                      // Focus the search input after a brief delay for mobile keyboards
                      setTimeout(() => {
                        const searchInput = document.getElementById('deal-popover-search');
                        if (searchInput) searchInput.focus();
                      }, 100);
                    }}
                  >
                    {/* Popover search */}
                    <div className="p-2 border-b bg-gray-50 flex-shrink-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input aria-label="Filter deals"
                          id="deal-popover-search"
                          type="text"
                          placeholder="Filter deals..."
                          value={dropdownFilter}
                          onChange={(e) => setDropdownFilter(e.target.value)}
                          className="w-full min-h-[44px] pl-8 pr-8 rounded border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4a574]/50 focus:border-[#d4a574] touch-manipulation"
                        />
                        {dropdownFilter && (
                          <button
                            type="button"
                            onClick={() => setDropdownFilter('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 touch-manipulation"
                            aria-label="Clear filter"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Popover items */}
                    <div className="overflow-y-auto flex-1 overscroll-contain">
                      {filteredPublished.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          {searching ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading deals...
                            </div>
                          ) : dropdownFilter ? (
                            `No deals matching "${dropdownFilter}"`
                          ) : (
                            <div>
                              <p>No deals found in database</p>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-2 min-h-[44px] touch-manipulation"
                                onClick={() => fetchPublishedDeals()}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" /> Retry
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        filteredPublished.map((deal) => (
                          <button
                            key={deal.id}
                            type="button"
                            onClick={() => {
                              setSelectedProperty(deal);
                              setPaymentAmount(deal.acquisition_fee?.toString() || '');
                              setDealPopoverOpen(false);
                              setDropdownFilter('');
                            }}
                            className={`w-full text-left px-3 min-h-[44px] py-2.5 border-b last:border-b-0 transition-colors touch-manipulation active:bg-gray-100 ${
                              selectedProperty?.id === deal.id ? 'bg-[#d4a574]/10' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{getDisplayName(deal)}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {deal.city}, {deal.state} {deal.zip_code || ''}
                                  {deal.bedrooms ? ` · ${deal.bedrooms}bd` : ''}
                                  {deal.monthly_rent ? ` · $${deal.monthly_rent.toLocaleString()}/mo` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {deal.is_published && <Badge className="bg-green-500 text-white text-[10px] py-0 px-1.5">Published</Badge>}
                                {deal.acquisition_fee ? <Badge variant="outline" className="text-xs py-0 px-1.5">${deal.acquisition_fee.toLocaleString()}</Badge> : null}
                                {selectedProperty?.id === deal.id && <CheckCircle className="w-4 h-4 text-[#d4a574]" />}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Selected property detail */}
                {selectedProperty && (
                  <Card className="mt-3 bg-blue-50 border-blue-200">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#1a365d] truncate">{getDisplayName(selectedProperty)}</p>
                          {selectedProperty.address && selectedProperty.address !== selectedProperty.listing_title && (
                            <p className="text-sm text-gray-600 truncate">{selectedProperty.address}</p>
                          )}
                          <p className="text-sm text-gray-600">{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}</p>
                          {selectedProperty.listing_url && (
                            <a href={selectedProperty.listing_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                              <Globe className="w-3 h-3" />Website <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            {selectedProperty.bedrooms ? <Badge variant="outline" className="text-xs py-0">{selectedProperty.bedrooms}bd/{selectedProperty.bathrooms}ba</Badge> : null}
                            {selectedProperty.monthly_rent ? <Badge variant="outline" className="text-xs py-0">${selectedProperty.monthly_rent.toLocaleString()}/mo</Badge> : null}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="min-h-[44px] touch-manipulation"
                          onClick={() => { 
                            setSelectedProperty(null); 
                            setDealPopoverOpen(true); 
                            setDropdownFilter(''); 
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 border-t" />
                  <span className="text-xs text-gray-400 uppercase">or search all properties</span>
                  <div className="flex-1 border-t" />
                </div>
              </div>
            )}

            {/* Search bar */}
            <div>
              <Label className="mb-1.5 block font-medium" htmlFor="field-0">
                {mode === 'assign_to_property' ? 'Search Investors' : 'Search Properties'}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input id="field-0"
                  placeholder={mode === 'assign_to_property' ? 'Name, email, or company...' : 'Address, city, or ZIP...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 min-h-[44px] touch-manipulation"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 touch-manipulation"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Results list */}
            {searching ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border rounded-lg overscroll-contain">
                {mode === 'assign_to_property' ? (
                  filteredInvestors.length === 0 ? (
                    <p className="text-center text-gray-500 py-6 text-sm">
                      {searchQuery ? `No investors matching "${searchQuery}"` : 'No investors found'}
                    </p>
                  ) : (
                    <div className="divide-y">
                      {filteredInvestors.map(inv => (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => setSelectedInvestor(inv)}
                          className={`w-full text-left px-3 min-h-[44px] py-3 transition-colors touch-manipulation active:bg-gray-100 ${
                            selectedInvestor?.id === inv.id 
                              ? 'bg-[#d4a574]/15 border-l-2 border-l-[#d4a574]' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">
                                {inv.first_name} {inv.last_name}
                                {inv.company_name && <span className="text-gray-500 ml-1">({inv.company_name})</span>}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{inv.email}</p>
                            </div>
                            {selectedInvestor?.id === inv.id && (
                              <CheckCircle className="w-4 h-4 text-[#d4a574] flex-shrink-0 ml-2" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  filteredProperties.length === 0 ? (
                    <p className="text-center text-gray-500 py-6 text-sm">
                      {searchQuery ? `No properties matching "${searchQuery}"` : 'Use the dropdown above or type to search.'}
                    </p>
                  ) : (
                    <div className="divide-y">
                      {filteredProperties.map(prop => (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={() => {
                            setSelectedProperty(prop);
                            setPaymentAmount(prop.acquisition_fee?.toString() || '');
                          }}
                          className={`w-full text-left px-3 min-h-[44px] py-3 transition-colors touch-manipulation active:bg-gray-100 ${
                            selectedProperty?.id === prop.id 
                              ? 'bg-[#d4a574]/15 border-l-2 border-l-[#d4a574]' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{getDisplayName(prop)}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {prop.city}, {prop.state} {prop.zip_code}
                                {prop.bedrooms ? ` · ${prop.bedrooms}bd/${prop.bathrooms}ba` : ''}
                                {prop.monthly_rent ? ` · $${prop.monthly_rent.toLocaleString()}/mo` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                              {prop.is_published && <Badge className="bg-green-500 text-xs py-0">Published</Badge>}
                              {selectedProperty?.id === prop.id && <CheckCircle className="w-4 h-4 text-[#d4a574]" />}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Pending status note */}
            {mode === 'assign_to_investor' && selectedProperty && (
              <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                <span className="text-sm text-yellow-800">Status: Pending - Acquisition in Progress</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payment" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paymentAmount">Acquisition Fee</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="paymentAmount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="2500"
                    className="pl-10 min-h-[44px] touch-manipulation"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="paymentMethod" className="min-h-[44px] touch-manipulation">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card" className="min-h-[44px] touch-manipulation">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer" className="min-h-[44px] touch-manipulation">Bank Transfer</SelectItem>
                    <SelectItem value="wire" className="min-h-[44px] touch-manipulation">Wire Transfer</SelectItem>
                    <SelectItem value="check" className="min-h-[44px] touch-manipulation">Check</SelectItem>
                    <SelectItem value="cash" className="min-h-[44px] touch-manipulation">Cash</SelectItem>
                    <SelectItem value="other" className="min-h-[44px] touch-manipulation">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="paymentReference">Reference / Transaction ID</Label>
              <Input
                id="paymentReference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g., TXN-12345"
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer min-h-[44px] touch-manipulation">
                <input
                  type="checkbox"
                  checked={markAsPaid}
                  onChange={(e) => setMarkAsPaid(e.target.checked)}
                  className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 touch-manipulation"
                />
                <div>
                  <p className="font-medium text-amber-800 flex items-center gap-1.5 text-sm">
                    <CreditCard className="w-4 h-4" />
                    Mark as Paid
                  </p>
                  <p className="text-xs text-amber-600">
                    Investor will see the full address immediately.
                  </p>
                </div>
              </label>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes..."
                rows={2}
                className="min-h-[44px] touch-manipulation"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] touch-manipulation w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={loading || !selectedProperty || !selectedInvestor}
            className="bg-[#d4a574] hover:bg-[#c49464] min-h-[44px] touch-manipulation w-full sm:w-auto"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Assigning...</>
            ) : (
              <><UserPlus className="w-4 h-4 mr-2" />Assign Property</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
