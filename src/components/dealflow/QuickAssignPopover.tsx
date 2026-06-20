import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Search, UserPlus, CheckCircle, X, User,
  Building, ExternalLink, ChevronRight, DollarSign, MapPin
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

interface QuickAssignProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  listing_title?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthly_rent?: number;
  acquisition_fee?: number;
  listing_url?: string;
  operation_type?: string;
  property_type?: string;
  square_feet?: number;
  sqft?: number;
  is_published?: boolean;
}

interface QuickAssignPopoverProps {
  property: QuickAssignProperty;
  onOpenFullModal: () => void;
  onAssigned: () => void;
  onClose: () => void;
  staffId?: string;
  staffName?: string;
}

export function QuickAssignPopover({
  property,
  onOpenFullModal,
  onAssigned,
  onClose,
  staffId,
  staffName
}: QuickAssignPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent immediate close from the triggering click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Escape key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmStep) {
          setConfirmStep(false);
          setSelectedInvestor(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose, confirmStep]);

  // Auto-focus search input
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, []);

  // Load investors on mount
  useEffect(() => {
    fetchInvestors();
  }, []);

  const fetchInvestors = async () => {
    setLoading(true);
    let fetched = false;

    // Strategy 1: Use manage-investor-admin (most reliable - uses service role key)
    try {
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
        console.log(`[QuickAssign] Loaded ${data.investors.length} investors via manage-investor-admin`);
      }
    } catch (err) {
      console.warn('[QuickAssign] manage-investor-admin failed:', err);
    }

    // Strategy 2: Direct DB fallback
    if (!fetched) {
      try {
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
          console.log(`[QuickAssign] Loaded ${data.length} investors via direct DB`);
        }
      } catch (err) {
        console.warn('[QuickAssign] Direct DB query failed:', err);
      }
    }

    // Strategy 3: investor-auth fallback
    if (!fetched) {
      try {
        const { data } = await supabase.functions.invoke('investor-auth', {
          body: { action: 'list' }
        });
        if (data?.investors?.length) {
          setInvestors(data.investors.map((inv: any) => ({
            ...inv,
            first_name: inv.first_name || inv.full_name?.split(' ')[0] || '',
            last_name: inv.last_name || inv.full_name?.split(' ').slice(1).join(' ') || ''
          })));
          console.log(`[QuickAssign] Loaded ${data.investors.length} investors via investor-auth`);
        }
      } catch (err) {
        console.warn('[QuickAssign] investor-auth fallback failed:', err);
      }
    }

    setLoading(false);
  };


  const getInvestorName = (inv: Investor) => {
    const name = [inv.first_name, inv.last_name].filter(Boolean).join(' ');
    return name || inv.full_name || inv.email;
  };

  // Filter investors based on search
  const filtered = searchQuery.trim()
    ? investors.filter(inv => {
        const q = searchQuery.toLowerCase();
        return (
          inv.email?.toLowerCase().includes(q) ||
          inv.first_name?.toLowerCase().includes(q) ||
          inv.last_name?.toLowerCase().includes(q) ||
          inv.full_name?.toLowerCase().includes(q) ||
          inv.company_name?.toLowerCase().includes(q) ||
          inv.phone?.includes(searchQuery)
        );
      })
    : investors.slice(0, 10); // Show first 10 by default

  const handleQuickAssign = async () => {
    if (!selectedInvestor) return;
    setAssigning(true);

    try {
      // Try edge function first
      const { data, error } = await supabase.functions.invoke('manage-property-assignments', {
        body: {
          action: 'create',
          property_id: property.id,
          investor_id: selectedInvestor.id,
          assigned_by: staffName || 'Staff',
          payment_amount: property.acquisition_fee || 0,
          notes: `Quick-assigned from deal flow by ${staffName || 'Staff'}`,
          community_name: property.listing_title || '',
          community_website: property.listing_url || ''
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Property assigned!',
        description: `${property.listing_title || property.address} assigned to ${getInvestorName(selectedInvestor)}`
      });

      onAssigned();
      onClose();
    } catch (err: any) {
      // DB fallback - insert directly into investor_portfolio
      try {
        const portfolioData: Record<string, any> = {
          investor_id: selectedInvestor.id,
          address: property.address || '',
          city: property.city || '',
          state: property.state || '',
          zip_code: property.zip_code || '',
          bedrooms: property.bedrooms || 0,
          bathrooms: property.bathrooms || 0,
           square_footage: property.sqft || property.square_feet || null,

          monthly_rent: property.monthly_rent || 0,
          acquisition_fee: property.acquisition_fee || 0,
          initial_investment: property.acquisition_fee || 0,
          property_type: property.property_type || 'single_family',
          property_status: 'pending',
          status: 'active',
          acquired_through_ayp: true,
          acquisition_source: 'ayp',
          deal_flow_property_id: property.id,
          added_by_staff: true,
          assigned_by: staffName || 'Staff',
          operation_type: property.operation_type || 'str',
          community_name: property.listing_title || '',
          community_website: property.listing_url || '',
          notes: `Quick-assigned from deal flow by ${staffName || 'Staff'}`,
          staff_notes: [{
            author: staffName || 'Staff',
            text: `Quick-assigned from deal flow card.`,
            date: new Date().toISOString()
          }],
          created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('investor_portfolio')
          .insert(portfolioData);

        if (insertError) throw insertError;

        // Try to send notification
        try {
          await supabase.from('investor_notifications').insert({
            investor_id: selectedInvestor.id,
            notification_type: 'property_added_to_portfolio',
            type: 'property_added_to_portfolio',
            title: 'New Property Added to Your Portfolio',
            message: `A new property${property.listing_title ? ` at ${property.listing_title}` : ''} (${property.address}, ${property.city}, ${property.state}) has been added to your portfolio.`,
            data: {

              address: property.address,
              city: property.city,
              state: property.state,
              community_name: property.listing_title
            },
            read: false,
            created_at: new Date().toISOString()
          });
        } catch {}

        toast({
          title: 'Property assigned!',
          description: `${property.listing_title || property.address} added to ${getInvestorName(selectedInvestor)}'s portfolio.`
        });

        onAssigned();
        onClose();
      } catch (fallbackErr: any) {
        toast({
          title: 'Assignment failed',
          description: fallbackErr.message || err.message,
          variant: 'destructive'
        });
      }
    }
    setAssigning(false);
  };

  const handleSelectInvestor = (inv: Investor) => {
    setSelectedInvestor(inv);
    setConfirmStep(true);
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-1 z-[60] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7a] px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white min-w-0">
          <UserPlus className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-semibold truncate">Quick Assign</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors p-0.5"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Property info mini-bar */}
      <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2 min-w-0">
        <Building className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
        <span className="text-xs text-blue-800 font-medium truncate">
          {property.listing_title || property.address}
        </span>
        <span className="text-xs text-blue-500 flex-shrink-0">
          {property.city}, {property.state}
        </span>
      </div>

      {confirmStep && selectedInvestor ? (
        /* Confirmation step */
        <div className="p-3 space-y-3">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-[#d4a574]/10 flex items-center justify-center mx-auto mb-2">
              <User className="w-5 h-5 text-[#d4a574]" />
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {getInvestorName(selectedInvestor)}
            </p>
            <p className="text-xs text-gray-500">{selectedInvestor.email}</p>
            {selectedInvestor.company_name && (
              <p className="text-xs text-gray-400">{selectedInvestor.company_name}</p>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Property</span>
              <span className="font-medium text-gray-800 truncate ml-2 max-w-[180px]">
                {property.listing_title || property.address}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Location</span>
              <span className="text-gray-700">{property.city}, {property.state} {property.zip_code}</span>
            </div>
            {property.acquisition_fee && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Acq. Fee</span>
                <span className="font-semibold text-green-700">${property.acquisition_fee.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={() => {
                setConfirmStep(false);
                setSelectedInvestor(null);
              }}
            >
              Back
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs h-8 bg-[#d4a574] hover:bg-[#c49464]"
              onClick={handleQuickAssign}
              disabled={assigning}
            >
              {assigning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Confirm Assign
                </>
              )}
            </Button>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenFullModal();
            }}
            className="w-full text-xs text-gray-400 hover:text-[#d4a574] transition-colors flex items-center justify-center gap-1 pt-1"
          >
            Open full assignment modal
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      ) : (
        /* Search & select step */
        <div>
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search investors by name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-8 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4a574]/40 focus:border-[#d4a574] bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Loading investors...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center">
                <User className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-400">
                  {searchQuery ? `No investors matching "${searchQuery}"` : 'No investors found'}
                </p>
              </div>
            ) : (
              <div>
                {!searchQuery.trim() && (
                  <div className="px-3 py-1.5 bg-gray-50 border-b">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                      Recent Investors ({investors.length} total)
                    </span>
                  </div>
                )}
                {searchQuery.trim() && (
                  <div className="px-3 py-1.5 bg-gray-50 border-b">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                      {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {filtered.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => handleSelectInvestor(inv)}
                    className="w-full text-left px-3 py-2 hover:bg-[#d4a574]/5 transition-colors border-b border-gray-50 last:border-b-0 group/item"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover/item:bg-[#d4a574]/10 transition-colors">
                        <User className="w-3.5 h-3.5 text-gray-500 group-hover/item:text-[#d4a574]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                          {getInvestorName(inv)}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate leading-tight">
                          {inv.email}
                          {inv.company_name && ` · ${inv.company_name}`}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover/item:text-[#d4a574] flex-shrink-0 transition-colors" />
                    </div>
                  </button>
                ))}
                {!searchQuery.trim() && investors.length > 10 && (
                  <div className="px-3 py-2 text-center border-t bg-gray-50">
                    <span className="text-[11px] text-gray-400">
                      Type to search all {investors.length} investors
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with full modal link */}
          <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {property.acquisition_fee ? `Fee: $${property.acquisition_fee.toLocaleString()}` : ''}
            </span>
            <button
              onClick={() => {
                onClose();
                onOpenFullModal();
              }}
              className="text-xs text-[#d4a574] hover:text-[#b8895e] font-medium flex items-center gap-1 transition-colors"
            >
              Full Modal
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
