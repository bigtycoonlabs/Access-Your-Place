import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { NegotiationTimeline, OfferRecord } from '@/components/marketplace/NegotiationTimeline';
import {
  Loader2, Search, DollarSign, Handshake, Clock, TrendingUp,
  ChevronDown, ChevronUp, MapPin, User, Store, MessageSquare,
  StickyNote, RefreshCw, Filter, ArrowUpRight, CheckCircle,
  XCircle, RotateCcw, AlertCircle, Mail, Hash, Calendar,
  BarChart3, Target, Gavel, ShieldCheck, Trophy, BadgeDollarSign,
  FileCheck, ArrowRight, Banknote, PartyPopper, CircleDollarSign
} from 'lucide-react';

interface NegotiationThread {
  thread_id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  buyer_email: string;
  seller_name: string;
  seller_email: string;
  property_address: string;
  listing_asking_price: number;
  offers: OfferRecord[];
  latest_status: string;
  latest_amount: number;
  latest_date: string;
  total_offers: number;
  has_staff_notes: boolean;
  first_offer_date: string;
  has_pending: boolean;
  has_accepted: boolean;
}

interface NegotiationStats {
  total_negotiations: number;
  pending_offers: number;
  accepted_this_month: number;
  total_accepted_value: number;
  avg_offer_amount: number;
  countered_offers: number;
  rejected_offers: number;
  total_offers: number;
}

interface ClosedDeal {
  id: string;
  listing_id: string;
  offer_id: string;
  property_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  buyer_email: string;
  seller_name: string;
  seller_email: string;
  property_address: string;
  final_sale_price: number;
  asking_price: number;
  ayp_fee: number;
  seller_net: number;
  operation_type: string;
  monthly_revenue: number;
  closed_by_staff_name: string;
  staff_notes: string;
  transaction_date: string;
  acquisition_workflow_created: boolean;
  created_at: string;
}

interface ClosedDealStats {
  total_closed: number;
  this_month: number;
  total_revenue: number;
  total_ayp_fees: number;
  this_month_revenue: number;
  avg_deal_size: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'countered', label: 'Countered' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'expired', label: 'Expired' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'highest', label: 'Highest Amount' },
  { value: 'most_active', label: 'Most Active' },
];

export function ActiveNegotiationsTab() {
  const [negotiations, setNegotiations] = useState<NegotiationThread[]>([]);
  const [stats, setStats] = useState<NegotiationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Staff notes state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<OfferRecord | null>(null);
  const [staffNoteText, setStaffNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Mark as Sold state
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldThread, setSoldThread] = useState<NegotiationThread | null>(null);
  const [soldStaffNotes, setSoldStaffNotes] = useState('');
  const [markingSold, setMarkingSold] = useState(false);

  // Closed deals state
  const [closedDeals, setClosedDeals] = useState<ClosedDeal[]>([]);
  const [closedStats, setClosedStats] = useState<ClosedDealStats | null>(null);
  const [loadingClosed, setLoadingClosed] = useState(false);
  const [showClosedSection, setShowClosedSection] = useState(false);
  const [closedSearchInput, setClosedSearchInput] = useState('');

  const { toast } = useToast();

  const fetchNegotiations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'get_all_negotiations',
          status_filter: statusFilter,
          search_query: searchQuery.trim() || undefined,
          limit: 200
        }
      });

      if (error) throw error;

      if (data?.success) {
        setNegotiations(data.negotiations || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Error fetching negotiations:', err);
      toast({ title: 'Error', description: 'Failed to load negotiations', variant: 'destructive' });
    }
    setLoading(false);
  }, [statusFilter, searchQuery, toast]);

  const fetchClosedDeals = useCallback(async () => {
    setLoadingClosed(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'get_closed_deals',
          limit: 50,
          search_query: closedSearchInput.trim() || undefined
        }
      });

      if (error) throw error;

      if (data?.success) {
        setClosedDeals(data.deals || []);
        setClosedStats(data.stats || null);
      }
    } catch (err) {
      console.error('Error fetching closed deals:', err);
    }
    setLoadingClosed(false);
  }, [closedSearchInput]);

  useEffect(() => {
    fetchNegotiations();
  }, [fetchNegotiations]);

  useEffect(() => {
    if (showClosedSection) {
      fetchClosedDeals();
    }
  }, [showClosedSection, fetchClosedDeals]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedThreads(new Set(sortedNegotiations.map(n => n.thread_id)));
  };

  const collapseAll = () => {
    setExpandedThreads(new Set());
  };

  const handleOpenNotes = (offer: OfferRecord) => {
    setSelectedOffer(offer);
    setStaffNoteText(offer.staff_notes || '');
    setShowNotesModal(true);
  };

  const handleSaveNote = async () => {
    if (!selectedOffer) return;
    setSavingNote(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'add_staff_note_to_offer',
          offer_id: selectedOffer.id,
          staff_notes: staffNoteText.trim() || null,
          staff_name: 'Staff'
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Note Saved', description: 'Staff note has been added to this offer.' });
        setShowNotesModal(false);
        setNegotiations(prev => prev.map(n => ({
          ...n,
          offers: n.offers.map(o =>
            o.id === selectedOffer.id ? { ...o, staff_notes: staffNoteText.trim() || undefined } : o
          ),
          has_staff_notes: n.offers.some(o =>
            o.id === selectedOffer.id ? !!staffNoteText.trim() : !!o.staff_notes
          )
        })));
      } else {
        throw new Error(data?.error || 'Failed to save note');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save note', variant: 'destructive' });
    }
    setSavingNote(false);
  };

  // Mark as Sold handlers
  const handleOpenSoldModal = (thread: NegotiationThread) => {
    setSoldThread(thread);
    setSoldStaffNotes('');
    setShowSoldModal(true);
  };

  const getAcceptedOffer = (thread: NegotiationThread): OfferRecord | null => {
    return thread.offers.find(o => o.status === 'accepted') || null;
  };

  const handleMarkAsSold = async () => {
    if (!soldThread) return;
    setMarkingSold(true);

    const acceptedOffer = getAcceptedOffer(soldThread);

    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'mark_as_sold',
          listing_id: soldThread.listing_id,
          offer_id: acceptedOffer?.id || null,
          staff_name: 'Staff',
          staff_notes: soldStaffNotes.trim() || null
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Deal Marked as Sold!',
          description: data.message || 'Congratulations emails sent to buyer and seller.',
        });
        setShowSoldModal(false);
        setSoldThread(null);
        // Refresh both negotiations and closed deals
        fetchNegotiations();
        if (showClosedSection) fetchClosedDeals();
      } else {
        throw new Error(data?.error || 'Failed to mark as sold');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to mark deal as sold', variant: 'destructive' });
    }
    setMarkingSold(false);
  };

  // Sort negotiations
  const sortedNegotiations = [...negotiations].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return new Date(a.first_offer_date).getTime() - new Date(b.first_offer_date).getTime();
      case 'highest':
        return b.latest_amount - a.latest_amount;
      case 'most_active':
        return b.total_offers - a.total_offers;
      default:
        return new Date(b.latest_date).getTime() - new Date(a.latest_date).getTime();
    }
  });

  const getThreadStatusBadge = (thread: NegotiationThread) => {
    if (thread.has_accepted) return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Deal Accepted</Badge>;
    if (thread.has_pending) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 animate-pulse"><Clock className="w-3 h-3 mr-1" />Awaiting Response</Badge>;
    
    switch (thread.latest_status) {
      case 'rejected': return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'countered': return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><RotateCcw className="w-3 h-3 mr-1" />Countered</Badge>;
      case 'withdrawn': return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Withdrawn</Badge>;
      case 'expired': return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Expired</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-600 border-gray-200">{thread.latest_status}</Badge>;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
        <p className="text-sm text-gray-500">Loading negotiations...</p>
      </div>
    );
  }

  const acceptedThreads = sortedNegotiations.filter(n => n.has_accepted);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-[#1a365d] bg-gradient-to-br from-white to-blue-50/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1a365d]/10 flex items-center justify-center">
                  <Handshake className="w-5 h-5 text-[#1a365d]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1a365d]">{stats.total_negotiations}</p>
                  <p className="text-xs text-gray-500 font-medium">Total Negotiations</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-br from-white to-yellow-50/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending_offers}</p>
                  <p className="text-xs text-gray-500 font-medium">Pending Offers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-white to-green-50/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.accepted_this_month}</p>
                  <p className="text-xs text-gray-500 font-medium">Accepted This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#d4a574] bg-gradient-to-br from-white to-amber-50/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#d4a574]/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[#d4a574]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#d4a574]">${stats.total_accepted_value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 font-medium">Accepted Deal Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Secondary Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-gray-700">{stats.total_offers}</p>
            <p className="text-xs text-gray-500">Total Offers</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-700">{stats.countered_offers}</p>
            <p className="text-xs text-gray-500">Countered</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-red-700">{stats.rejected_offers}</p>
            <p className="text-xs text-gray-500">Rejected</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-green-700">${stats.avg_offer_amount.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Avg Offer</p>
          </div>
        </div>
      )}

      {/* Ready to Close Banner */}
      {acceptedThreads.length > 0 && (
        <Card className="border-green-400 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">
                  {acceptedThreads.length} Deal{acceptedThreads.length !== 1 ? 's' : ''} Ready to Close
                </h3>
                <p className="text-sm text-green-600">
                  These negotiations have accepted offers. Click "Mark as Sold" to finalize the transaction, send congratulations emails, and create acquisition workflows.
                </p>
              </div>
              <Badge className="bg-green-600 text-white text-sm px-3 py-1">
                {acceptedThreads.length} Ready
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label className="text-xs text-gray-500 mb-1 block" htmlFor="search-negotiations">Search Negotiations</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input id="search-negotiations"
                  placeholder="Search by buyer name, seller name, property address, or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-44">
              <Label className="text-xs text-gray-500 mb-1 block">Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Label className="text-xs text-gray-500 mb-1 block">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} className="text-xs">
                <ChevronDown className="w-3.5 h-3.5 mr-1" /> Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs">
                <ChevronUp className="w-3.5 h-3.5 mr-1" /> Collapse
              </Button>
              <Button variant="outline" size="sm" onClick={fetchNegotiations}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing <strong>{sortedNegotiations.length}</strong> negotiation thread{sortedNegotiations.length !== 1 ? 's' : ''}
          {searchQuery && <> matching "<strong>{searchQuery}</strong>"</>}
          {statusFilter !== 'all' && <> with status <Badge variant="outline" className="ml-1 text-xs">{statusFilter}</Badge></>}
        </span>
      </div>

      {/* Negotiation Threads */}
      {sortedNegotiations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Gavel className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-1">No Negotiations Found</h3>
            <p className="text-gray-500 text-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'No marketplace offers have been submitted yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedNegotiations.map((thread) => {
            const isExpanded = expandedThreads.has(thread.thread_id);
            const pctOfAsking = thread.listing_asking_price
              ? Math.round((thread.latest_amount / thread.listing_asking_price) * 100)
              : null;
            const offersWithNotes = thread.offers.filter(o => o.staff_notes);
            const acceptedOffer = getAcceptedOffer(thread);

            return (
              <Card
                key={thread.thread_id}
                className={`transition-all duration-200 ${
                  thread.has_accepted ? 'border-l-4 border-l-green-500 bg-green-50/30' :
                  thread.has_pending ? 'border-l-4 border-l-yellow-500' :
                  thread.latest_status === 'rejected' ? 'border-l-4 border-l-red-400' :
                  thread.latest_status === 'countered' ? 'border-l-4 border-l-blue-400' :
                  'border-l-4 border-l-gray-300'
                }`}
              >
                {/* Thread Header - Always Visible */}
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleThread(thread.thread_id)}
                    className="w-full text-left p-5 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Property & Status Row */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {getThreadStatusBadge(thread)}
                          <Badge variant="outline" className="text-xs gap-1">
                            <Hash className="w-3 h-3" />
                            {thread.total_offers} offer{thread.total_offers !== 1 ? 's' : ''}
                          </Badge>
                          {thread.has_staff_notes && (
                            <Badge className="bg-purple-100 text-purple-700 text-xs gap-1">
                              <StickyNote className="w-3 h-3" />
                              Has Notes
                            </Badge>
                          )}
                          {thread.has_accepted && (
                            <Badge className="bg-emerald-600 text-white text-xs gap-1 animate-pulse">
                              <Trophy className="w-3 h-3" />
                              Ready to Close
                            </Badge>
                          )}
                        </div>

                        {/* Property Address */}
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <h3 className="font-semibold text-[#1a365d] truncate">
                            {thread.property_address || 'Unknown Property'}
                          </h3>
                        </div>

                        {/* Buyer & Seller */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 truncate">{thread.buyer_name || 'Unknown Buyer'}</p>
                              <p className="text-xs text-gray-400 truncate">{thread.buyer_email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#d4a574]/20 flex items-center justify-center flex-shrink-0">
                              <Store className="w-3.5 h-3.5 text-[#d4a574]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 truncate">{thread.seller_name || 'Unknown Seller'}</p>
                              <p className="text-xs text-gray-400 truncate">{thread.seller_email}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side - Amount & Expand */}
                      <div className="text-right flex-shrink-0">
                        <div className="mb-1">
                          <p className="text-xs text-gray-400 mb-0.5">Latest Offer</p>
                          <p className="text-xl font-bold text-[#1a365d]">
                            ${thread.latest_amount.toLocaleString()}
                          </p>
                        </div>
                        {thread.listing_asking_price > 0 && (
                          <div className="text-xs text-gray-500 mb-1">
                            Asking: ${thread.listing_asking_price.toLocaleString()}
                            {pctOfAsking !== null && (
                              <span className={`ml-1 px-1.5 py-0.5 rounded ${
                                pctOfAsking >= 100 ? 'bg-green-100 text-green-700' :
                                pctOfAsking >= 90 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {pctOfAsking}%
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 flex items-center justify-end gap-1">
                          <Calendar className="w-3 h-3" />
                          {getTimeAgo(thread.latest_date)}
                        </p>
                        <div className="mt-2">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400 ml-auto" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400 ml-auto" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50/50">
                      <div className="p-5 space-y-4">
                        {/* Quick Info Bar */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 bg-white rounded-lg p-3 border">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Started: {new Date(thread.first_offer_date).toLocaleDateString()}
                          </span>
                          <Separator orientation="vertical" className="h-4" />
                          <span className="flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5" />
                            {thread.total_offers} total offer{thread.total_offers !== 1 ? 's' : ''}
                          </span>
                          <Separator orientation="vertical" className="h-4" />
                          <span className="flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" />
                            Asking: ${thread.listing_asking_price?.toLocaleString() || 'N/A'}
                          </span>
                          {thread.has_accepted && (
                            <>
                              <Separator orientation="vertical" className="h-4" />
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Offer Accepted
                              </span>
                            </>
                          )}
                        </div>

                        {/* Mark as Sold CTA for accepted offers */}
                        {thread.has_accepted && acceptedOffer && (
                          <Card className="border-2 border-green-400 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                                  <BadgeDollarSign className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-bold text-green-800 text-lg">Ready to Finalize Sale</h4>
                                  <p className="text-sm text-green-600 mt-0.5">
                                    <strong>{acceptedOffer.buyer_name}</strong>'s offer of <strong>${acceptedOffer.offer_amount.toLocaleString()}</strong> has been accepted.
                                    Mark as sold to update the listing, send congratulations emails, and create the acquisition workflow.
                                  </p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-green-700">
                                    <span className="flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> AYP Fee: ${Math.round(acceptedOffer.offer_amount * 0.2).toLocaleString()}</span>
                                    <span className="flex items-center gap-1"><CircleDollarSign className="w-3.5 h-3.5" /> Seller Net: ${Math.round(acceptedOffer.offer_amount * 0.8).toLocaleString()}</span>
                                  </div>
                                </div>
                                <Button
                                  onClick={(e) => { e.stopPropagation(); handleOpenSoldModal(thread); }}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg px-6 py-5 text-base font-semibold gap-2"
                                >
                                  <ShieldCheck className="w-5 h-5" />
                                  Mark as Sold
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Offer Timeline */}
                        <div className="bg-white rounded-lg border p-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-[#d4a574]" />
                            Offer Timeline
                          </h4>
                          <NegotiationTimeline
                            offers={thread.offers}
                            viewerRole="staff"
                            askingPrice={thread.listing_asking_price}
                          />
                        </div>

                        {/* Staff Notes Section */}
                        <div className="bg-white rounded-lg border p-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <StickyNote className="w-4 h-4 text-purple-500" />
                            Staff Notes
                          </h4>

                          {offersWithNotes.length > 0 ? (
                            <div className="space-y-2 mb-3">
                              {offersWithNotes.map(offer => (
                                <div key={offer.id} className="flex items-start gap-3 bg-purple-50 rounded-lg p-3 border border-purple-100">
                                  <StickyNote className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-medium text-purple-700">
                                        On ${offer.offer_amount.toLocaleString()} {offer.offer_type} offer
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        {new Date(offer.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-700">{offer.staff_notes}</p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-purple-600 hover:text-purple-700"
                                    onClick={() => handleOpenNotes(offer)}
                                  >
                                    Edit
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 mb-3">No staff notes on this negotiation yet.</p>
                          )}

                          {/* Add Note Buttons for each offer */}
                          <div className="flex flex-wrap gap-2">
                            {thread.offers
                              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                              .map(offer => (
                                <Button
                                  key={offer.id}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs gap-1.5 h-8"
                                  onClick={() => handleOpenNotes(offer)}
                                >
                                  <StickyNote className="w-3 h-3" />
                                  {offer.staff_notes ? 'Edit' : 'Add'} Note: ${offer.offer_amount.toLocaleString()}
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                                    {offer.offer_type === 'initial' ? 'Initial' :
                                     offer.offer_type === 'counter_seller' ? 'Seller Counter' : 'Buyer Counter'}
                                  </Badge>
                                </Button>
                              ))}
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          <Button variant="outline" size="sm" className="text-xs gap-1.5"
                            onClick={() => {
                              if (thread.buyer_email) window.open(`mailto:${thread.buyer_email}`, '_blank');
                            }}>
                            <Mail className="w-3.5 h-3.5" /> Email Buyer
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs gap-1.5"
                            onClick={() => {
                              if (thread.seller_email) window.open(`mailto:${thread.seller_email}`, '_blank');
                            }}>
                            <Mail className="w-3.5 h-3.5" /> Email Seller
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs gap-1.5"
                            onClick={() => {
                              const emails = [thread.buyer_email, thread.seller_email].filter(Boolean).join(',');
                              if (emails) window.open(`mailto:${emails}?subject=Re: ${thread.property_address} - Marketplace Negotiation`, '_blank');
                            }}>
                            <Mail className="w-3.5 h-3.5" /> Email Both
                          </Button>
                          {thread.has_accepted && (
                            <Button
                              size="sm"
                              className="text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white ml-auto"
                              onClick={() => handleOpenSoldModal(thread)}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Mark as Sold
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ==================== CLOSED DEALS SECTION ==================== */}
      <Separator className="my-8" />

      <div className="space-y-4">
        <button
          onClick={() => setShowClosedSection(!showClosedSection)}
          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#1a365d] to-[#2d5a9e] rounded-xl text-white hover:from-[#1a365d]/90 hover:to-[#2d5a9e]/90 transition-all shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg">Closed Deals</h3>
              <p className="text-sm text-white/70">View all completed marketplace transactions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {closedStats && (
              <Badge className="bg-white/20 text-white border-white/30 text-sm">
                {closedStats.total_closed} deals
              </Badge>
            )}
            {showClosedSection ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </button>

        {showClosedSection && (
          <div className="space-y-4 pl-1">
            {loadingClosed ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" />
                <p className="text-sm text-gray-500">Loading closed deals...</p>
              </div>
            ) : (
              <>
                {/* Closed Deal Stats */}
                {closedStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-[#1a365d] to-[#2d5a9e] text-white">
                      <CardContent className="p-4 text-center">
                        <Trophy className="w-6 h-6 mx-auto mb-1 opacity-80" />
                        <p className="text-2xl font-bold">{closedStats.total_closed}</p>
                        <p className="text-xs text-white/70">Total Closed</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-600 to-emerald-600 text-white">
                      <CardContent className="p-4 text-center">
                        <DollarSign className="w-6 h-6 mx-auto mb-1 opacity-80" />
                        <p className="text-2xl font-bold">${closedStats.total_revenue.toLocaleString()}</p>
                        <p className="text-xs text-white/70">Total Revenue</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-[#d4a574] to-[#c49464] text-white">
                      <CardContent className="p-4 text-center">
                        <Banknote className="w-6 h-6 mx-auto mb-1 opacity-80" />
                        <p className="text-2xl font-bold">${closedStats.total_ayp_fees.toLocaleString()}</p>
                        <p className="text-xs text-white/70">AYP Fees Earned</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
                      <CardContent className="p-4 text-center">
                        <TrendingUp className="w-6 h-6 mx-auto mb-1 opacity-80" />
                        <p className="text-2xl font-bold">${closedStats.avg_deal_size.toLocaleString()}</p>
                        <p className="text-xs text-white/70">Avg Deal Size</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Closed Deals Search */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input aria-label="Search closed deals by buyer, seller, or property"
                      placeholder="Search closed deals by buyer, seller, or property..."
                      value={closedSearchInput}
                      onChange={(e) => setClosedSearchInput(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchClosedDeals}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Closed Deals List */}
                {closedDeals.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileCheck className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-medium text-gray-600 mb-1">No Closed Deals Yet</h3>
                      <p className="text-gray-500 text-sm">
                        Deals will appear here once they are marked as sold.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {closedDeals.map((deal) => {
                      const pctOfAsking = deal.asking_price > 0
                        ? Math.round((deal.final_sale_price / deal.asking_price) * 100)
                        : null;

                      return (
                        <Card key={deal.id} className="border-l-4 border-l-[#1a365d] hover:shadow-md transition-shadow">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                {/* Header */}
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className="bg-[#1a365d] text-white gap-1">
                                    <CheckCircle className="w-3 h-3" /> SOLD
                                  </Badge>
                                  {deal.operation_type && (
                                    <Badge variant="outline" className="text-xs uppercase">{deal.operation_type}</Badge>
                                  )}
                                  {deal.acquisition_workflow_created && (
                                    <Badge className="bg-blue-100 text-blue-700 text-xs gap-1">
                                      <ArrowRight className="w-3 h-3" /> Workflow Created
                                    </Badge>
                                  )}
                                </div>

                                {/* Property */}
                                <div className="flex items-center gap-2 mb-3">
                                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <h3 className="font-semibold text-[#1a365d] truncate">
                                    {deal.property_address || 'Unknown Property'}
                                  </h3>
                                </div>

                                {/* Buyer & Seller */}
                                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                      <User className="w-3.5 h-3.5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs text-gray-400">Buyer</p>
                                      <p className="font-medium text-gray-800 truncate">{deal.buyer_name || 'Unknown'}</p>
                                      <p className="text-xs text-gray-400 truncate">{deal.buyer_email}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-[#d4a574]/20 flex items-center justify-center flex-shrink-0">
                                      <Store className="w-3.5 h-3.5 text-[#d4a574]" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs text-gray-400">Seller</p>
                                      <p className="font-medium text-gray-800 truncate">{deal.seller_name || 'Unknown'}</p>
                                      <p className="text-xs text-gray-400 truncate">{deal.seller_email}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Staff Notes */}
                                {deal.staff_notes && (
                                  <div className="bg-purple-50 rounded-lg p-2.5 border border-purple-100 text-sm">
                                    <span className="text-xs font-medium text-purple-700">Staff Note: </span>
                                    <span className="text-gray-700">{deal.staff_notes}</span>
                                  </div>
                                )}
                              </div>

                              {/* Right Side - Financials */}
                              <div className="text-right flex-shrink-0 space-y-2">
                                <div>
                                  <p className="text-xs text-gray-400">Final Sale Price</p>
                                  <p className="text-2xl font-bold text-[#1a365d]">
                                    ${deal.final_sale_price.toLocaleString()}
                                  </p>
                                  {pctOfAsking !== null && deal.asking_price > 0 && (
                                    <p className="text-xs text-gray-500">
                                      {pctOfAsking}% of ${deal.asking_price.toLocaleString()} asking
                                    </p>
                                  )}
                                </div>
                                <Separator />
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-500">AYP Fee (20%)</span>
                                    <span className="font-semibold text-[#d4a574]">${deal.ayp_fee.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-500">Seller Net (80%)</span>
                                    <span className="font-semibold text-green-600">${deal.seller_net.toLocaleString()}</span>
                                  </div>
                                  {deal.monthly_revenue > 0 && (
                                    <div className="flex justify-between gap-4">
                                      <span className="text-gray-500">Monthly Rev</span>
                                      <span className="font-semibold">${deal.monthly_revenue.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                                <Separator />
                                <div className="text-xs text-gray-400">
                                  <p className="flex items-center justify-end gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(deal.transaction_date).toLocaleDateString('en-US', {
                                      year: 'numeric', month: 'short', day: 'numeric'
                                    })}
                                  </p>
                                  {deal.closed_by_staff_name && (
                                    <p className="mt-0.5">Closed by: {deal.closed_by_staff_name}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ==================== MARK AS SOLD MODAL ==================== */}
      <Dialog open={showSoldModal} onOpenChange={(open) => { setShowSoldModal(open); if (!open) setSoldThread(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              Confirm Sale
            </DialogTitle>
            <DialogDescription>
              Review the transaction details and confirm this deal as sold. This will update the listing, send congratulations emails to both parties, and create an acquisition workflow.
            </DialogDescription>
          </DialogHeader>

          {soldThread && (() => {
            const accepted = getAcceptedOffer(soldThread);
            const finalPrice = accepted?.offer_amount || soldThread.latest_amount;
            const aypFee = Math.round(finalPrice * 0.2);
            const sellerNet = Math.round(finalPrice * 0.8);
            const pctOfAsking = soldThread.listing_asking_price > 0
              ? Math.round((finalPrice / soldThread.listing_asking_price) * 100)
              : null;

            return (
              <div className="space-y-4">
                {/* Property Card */}
                <Card className="bg-gray-50 border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-[#1a365d]" />
                      <h3 className="font-bold text-[#1a365d]">{soldThread.property_address}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Buyer</p>
                        <p className="font-medium">{soldThread.buyer_name}</p>
                        <p className="text-xs text-gray-500">{soldThread.buyer_email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Seller</p>
                        <p className="font-medium">{soldThread.seller_name}</p>
                        <p className="text-xs text-gray-500">{soldThread.seller_email}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Transaction Summary
                    </h4>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Final Sale Price</span>
                        <span className="text-xl font-bold text-green-700">${finalPrice.toLocaleString()}</span>
                      </div>
                      {pctOfAsking !== null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">vs. Asking Price (${soldThread.listing_asking_price.toLocaleString()})</span>
                          <Badge className={`${pctOfAsking >= 100 ? 'bg-green-100 text-green-700' : pctOfAsking >= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {pctOfAsking}%
                          </Badge>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">AYP Platform Fee (20%)</span>
                        <span className="font-semibold text-[#d4a574]">${aypFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Seller Net Payout (80%)</span>
                        <span className="font-semibold text-green-600">${sellerNet.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* What Happens */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-blue-800 mb-2 text-sm">What happens when you confirm:</h4>
                    <ul className="space-y-1.5 text-sm text-blue-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        Listing status updated to "Sold"
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        Buyer info auto-populated from accepted offer
                      </li>
                      <li className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        Congratulations email sent to buyer ({soldThread.buyer_email})
                      </li>
                      <li className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        Congratulations email sent to seller ({soldThread.seller_email})
                      </li>
                      <li className="flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        Acquisition workflow created for the buyer
                      </li>
                      <li className="flex items-center gap-2">
                        <XCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        Any remaining pending offers auto-rejected
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Staff Notes */}
                <div>
                  <Label className="text-sm font-medium" htmlFor="staff-notes-optional">Staff Notes (optional)</Label>
                  <Textarea id="staff-notes-optional"
                    value={soldStaffNotes}
                    onChange={(e) => setSoldStaffNotes(e.target.value)}
                    placeholder="Add any internal notes about this transaction (e.g., payment method, special terms, follow-up needed)..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSoldModal(false)} disabled={markingSold}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsSold}
              disabled={markingSold}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white gap-2 px-6"
            >
              {markingSold ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Confirm Sale
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== STAFF NOTES MODAL ==================== */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-purple-500" />
              Staff Note
            </DialogTitle>
            <DialogDescription>
              Add an internal note to this offer. Only visible to staff members.
            </DialogDescription>
          </DialogHeader>

          {selectedOffer && (
            <div className="space-y-4">
              {/* Offer Context */}
              <div className="bg-gray-50 rounded-lg p-3 border text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Offer Amount</p>
                    <p className="font-bold text-[#1a365d]">${selectedOffer.offer_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Type</p>
                    <p className="font-medium capitalize">
                      {selectedOffer.offer_type === 'initial' ? 'Initial Offer' :
                       selectedOffer.offer_type === 'counter_seller' ? 'Seller Counter' : 'Buyer Counter'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Status</p>
                    <Badge variant="outline" className="text-xs capitalize">{selectedOffer.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Date</p>
                    <p className="text-gray-600">{new Date(selectedOffer.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Buyer: {selectedOffer.buyer_name}</span>
                  <span>Seller: {selectedOffer.seller_name}</span>
                </div>
              </div>

              {/* Note Input */}
              <div>
                <Label className="text-sm font-medium" htmlFor="staff-note">Staff Note</Label>
                <Textarea id="staff-note"
                  value={staffNoteText}
                  onChange={(e) => setStaffNoteText(e.target.value)}
                  placeholder="Add internal notes about this offer (e.g., follow-up needed, buyer seems motivated, seller may accept lower...)..."
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {staffNoteText.length > 0 ? `${staffNoteText.length} characters` : 'Leave empty to remove the note'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotesModal(false)}>Cancel</Button>
            <Button
              onClick={handleSaveNote}
              disabled={savingNote}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {savingNote && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {staffNoteText.trim() ? 'Save Note' : 'Remove Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
