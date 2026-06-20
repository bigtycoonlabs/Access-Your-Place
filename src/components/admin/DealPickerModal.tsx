import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Search, MapPin, Building2, Bed, Bath, DollarSign, Home,
  CheckCircle, User, ArrowRight
} from 'lucide-react';

export interface DealRecord {
  id: string;
  address: string;
  listing_title?: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  acquisition_fee: number;
  property_type: string;
  is_furnished: boolean;
  landlord_name?: string;
  landlord_email?: string;
  landlord_phone?: string;
  operation_type?: string;
  status: string;
  workflow_stage?: string;
  sqft?: number;
  units_available?: number;
  deposits_concessions_notes?: string;
  assigned_investor_id?: string;
}

// Correct column list for properties table (sqft NOT square_feet)
const PROPERTY_SELECT = 'id, address, listing_title, city, state, zip_code, bedrooms, bathrooms, monthly_rent, acquisition_fee, property_type, is_furnished, landlord_name, landlord_email, landlord_phone, operation_type, status, workflow_stage, sqft, units_available, deposits_concessions_notes, assigned_investor_id';

interface DealPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectDeal: (deal: DealRecord) => void;
}

export function DealPickerModal({ open, onClose, onSelectDeal }: DealPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (open) {
      loadRecentDeals();
    }
  }, [open]);

  const loadRecentDeals = async () => {
    setLoading(true);
    let loaded = false;

    // Strategy 1: Direct DB with correct columns
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(PROPERTY_SELECT)
        .in('status', ['active', 'approved', 'negotiating', 'published', 'new', 'researching', 'outreach'])
        .order('updated_at', { ascending: false })
        .limit(50);
      if (!error && data?.length) {
        setDeals(data);
        loaded = true;
      }
    } catch {}

    // Strategy 2: Edge function fallback
    if (!loaded) {
      try {
        const { data, error } = await supabase.functions.invoke('get-properties', {
          body: { include_all: true, limit: 50 }
        });
        if (!error && data?.properties?.length) {
          setDeals(data.properties);
          loaded = true;
        }
      } catch {}
    }

    if (!loaded) setDeals([]);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && statusFilter === 'all') {
      loadRecentDeals();
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      let query = supabase
        .from('properties')
        .select(PROPERTY_SELECT)
        .order('updated_at', { ascending: false })
        .limit(30);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      } else {
        query = query.in('status', ['active', 'approved', 'negotiating', 'published', 'new', 'researching', 'outreach']);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        query = query.or(`address.ilike.%${q}%,listing_title.ilike.%${q}%,city.ilike.%${q}%,landlord_name.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDeals(data || []);
    } catch (err) {
      console.error('Error searching deals:', err);
      // Fallback to edge function
      try {
        const { data } = await supabase.functions.invoke('get-properties', {
          body: { include_all: true, limit: 50 }
        });
        if (data?.properties) {
          let results = data.properties;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            results = results.filter((p: any) =>
              p.address?.toLowerCase().includes(q) ||
              p.listing_title?.toLowerCase().includes(q) ||
              p.city?.toLowerCase().includes(q)
            );
          }
          setDeals(results);
        }
      } catch {
        setDeals([]);
      }
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 border-green-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      negotiating: 'bg-blue-100 text-blue-800 border-blue-200',
      new: 'bg-purple-100 text-purple-800 border-purple-200',
      researching: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      outreach: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getOperationLabel = (type?: string) => {
    const labels: Record<string, string> = {
      str: 'STR', coliving: 'Co-Living', mtr: 'Mid-Term',
      ltr: 'Long-Term', both: 'STR + Co-Living', peerspace: 'Peerspace',
    };
    return type ? labels[type] || type : '';
  };

  const formatAddress = (deal: DealRecord) => {
    if (deal.address && deal.city) {
      return `${deal.address}, ${deal.city}, ${deal.state} ${deal.zip_code}`;
    }
    return [deal.address, deal.city, deal.state, deal.zip_code].filter(Boolean).join(', ');
  };

  const getUnitConfig = (deal: DealRecord) => {
    const beds = deal.bedrooms || 0;
    const baths = deal.bathrooms || 0;
    let config = `${beds} Bedroom${beds !== 1 ? 's' : ''} / ${baths} Bathroom${baths !== 1 ? 's' : ''}`;
    if (deal.sqft) config += ` / ${deal.sqft.toLocaleString()} sq ft`;
    return config;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#d4a574]" />
            Load Deal from Pipeline
          </DialogTitle>
          <DialogDescription>
            Search and select a deal to auto-fill property details into the agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by address, city, or landlord name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10"
              autoFocus
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Active</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="negotiating">Negotiating</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="researching">Researching</SelectItem>
              <SelectItem value="outreach">Outreach</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#d4a574] mb-3" />
              <p className="text-sm text-gray-500">Searching deals...</p>
            </div>
          ) : deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Home className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                {hasSearched ? 'No deals match your search' : 'No active deals found'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {hasSearched ? 'Try a different search term or status filter' : 'Deals will appear here once added to the pipeline'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium px-1">
                {deals.length} deal{deals.length !== 1 ? 's' : ''} found
              </p>
              {deals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => { onSelectDeal(deal); onClose(); }}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-[#d4a574] hover:bg-amber-50/50 transition-all group focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <h4 className="font-semibold text-gray-900 truncate text-sm">
                          {deal.listing_title || formatAddress(deal)}
                        </h4>
                      </div>
                      {deal.listing_title && deal.address && (
                        <p className="text-xs text-gray-500 ml-6 mb-1.5 truncate">{formatAddress(deal)}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-6 text-xs text-gray-600">
                        <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5 text-gray-400" />{deal.bedrooms} bed</span>
                        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-gray-400" />{deal.bathrooms} bath</span>
                        {deal.monthly_rent > 0 && (
                          <span className="flex items-center gap-1 font-medium text-green-700">
                            <DollarSign className="w-3.5 h-3.5" />{deal.monthly_rent.toLocaleString()}/mo
                          </span>
                        )}
                        {deal.landlord_name && (
                          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-400" />{deal.landlord_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Badge variant="outline" className={`text-xs ${getStatusColor(deal.status)}`}>{deal.status}</Badge>
                      {deal.operation_type && <Badge variant="outline" className="text-xs">{getOperationLabel(deal.operation_type)}</Badge>}
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#d4a574] transition-colors mt-1" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
