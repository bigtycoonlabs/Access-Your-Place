import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { NegotiationTimeline, OfferRecord } from '@/components/marketplace/NegotiationTimeline';
import {
  Loader2, DollarSign, CheckCircle, XCircle, RotateCcw, Clock,
  User, MessageSquare, ArrowRight, RefreshCw, Bell, Percent,
  ArrowUpRight, ArrowDownRight, Handshake, AlertCircle, Send
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
}

interface GroupedNegotiation {
  listing_id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  property_address: string;
  listing_asking_price: number;
  offers: OfferRecord[];
  latest_offer: OfferRecord;
  has_pending: boolean;
}

export function SellerOffersPanel({ investorId, investorName }: Props) {
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedNegotiation, setSelectedNegotiation] = useState<GroupedNegotiation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const { toast } = useToast();

  // Track previous offer count for new offer detection
  const prevOfferCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef<boolean>(true);
  // Track per-listing pending offer counts
  const [listingPendingCounts, setListingPendingCounts] = useState<Record<string, number>>({});

  const loadOffers = useCallback(async () => {
    setLoading(true);
    let loadedOffers: OfferRecord[] = [];
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'get_seller_offers', seller_id: investorId }
      });
      if (!error && data?.offers) {
        loadedOffers = data.offers;
      } else {
        throw new Error('Edge function failed');
      }
    } catch {
      // DB fallback: query marketplace_offers directly
      try {
        const { data: dbOffers } = await supabase
          .from('marketplace_offers')
          .select('*')
          .eq('seller_id', investorId)
          .order('created_at', { ascending: false });
        
        if (dbOffers) {
          loadedOffers = dbOffers.map((o: any) => ({
            id: o.id,
            listing_id: o.listing_id,
            buyer_id: o.buyer_id,
            seller_id: o.seller_id,
            offer_amount: o.offer_amount,
            message: o.message,
            offer_type: o.offer_type || 'initial',
            status: o.status,
            buyer_name: o.buyer_name || 'Unknown',
            buyer_email: o.buyer_email || '',
            property_address: o.property_address || 'Property',
            listing_asking_price: o.listing_asking_price || 0,
            parent_offer_id: o.parent_offer_id,
            responded_at: o.responded_at,
            response_message: o.response_message,
            created_at: o.created_at,
          }));
        }
      } catch (dbErr) {
        console.error('DB fallback for offers failed:', dbErr);
      }
    }

    // Detect new offers (only after first load)
    if (!isFirstLoadRef.current && loadedOffers.length > prevOfferCountRef.current) {
      const newCount = loadedOffers.length - prevOfferCountRef.current;
      const newestOffer = loadedOffers[0]; // sorted by created_at desc
      toast({
        title: `${newCount} New Offer${newCount > 1 ? 's' : ''} Received!`,
        description: newestOffer ? `$${newestOffer.offer_amount?.toLocaleString()} from ${newestOffer.buyer_name || 'a buyer'} for ${newestOffer.property_address || 'your listing'}` : 'Check your offers panel.',
      });
    }
    isFirstLoadRef.current = false;
    prevOfferCountRef.current = loadedOffers.length;

    setOffers(loadedOffers);

    // Calculate per-listing pending counts
    const pendingCounts: Record<string, number> = {};
    for (const offer of loadedOffers) {
      if (offer.status === 'pending') {
        pendingCounts[offer.listing_id] = (pendingCounts[offer.listing_id] || 0) + 1;
      }
    }
    setListingPendingCounts(pendingCounts);

    setLoading(false);
  }, [investorId, toast]);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  // Group offers by listing + buyer into negotiation threads
  const groupMap: Record<string, GroupedNegotiation> = {};
  for (const offer of offers) {
    const key = `${offer.listing_id}-${offer.buyer_id}`;
    if (!groupMap[key]) {
      groupMap[key] = {
        listing_id: offer.listing_id,
        buyer_id: offer.buyer_id,
        buyer_name: offer.buyer_name || 'Unknown Buyer',
        buyer_email: offer.buyer_email || '',
        property_address: offer.property_address || 'Property',
        listing_asking_price: offer.listing_asking_price || 0,
        offers: [],
        latest_offer: offer,
        has_pending: false,
      };
    }
    groupMap[key].offers.push(offer);
    if (offer.status === 'pending') {
      groupMap[key].has_pending = true;
      groupMap[key].latest_offer = offer;
    }
  }

  const sortedNegotiations = Object.values(groupMap).sort((a, b) => {
    if (a.has_pending && !b.has_pending) return -1;
    if (!a.has_pending && b.has_pending) return 1;
    return new Date(b.latest_offer.created_at).getTime() - new Date(a.latest_offer.created_at).getTime();
  });

  const pendingCount = sortedNegotiations.filter(n => n.has_pending).length;
  const totalPendingOffers = Object.values(listingPendingCounts).reduce((s, c) => s + c, 0);

  // Group negotiations by listing for per-listing badge display
  const listingGroups: Record<string, { address: string; negotiations: GroupedNegotiation[]; pendingCount: number }> = {};
  for (const neg of sortedNegotiations) {
    if (!listingGroups[neg.listing_id]) {
      listingGroups[neg.listing_id] = {
        address: neg.property_address,
        negotiations: [],
        pendingCount: listingPendingCounts[neg.listing_id] || 0,
      };
    }
    listingGroups[neg.listing_id].negotiations.push(neg);
  }

  const handleAccept = async (offerId: string) => {
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'accept_offer', offer_id: offerId, seller_id: investorId, response_message: responseMessage || null }
      });
      if (data?.success) {
        toast({ title: 'Offer Accepted!', description: 'The buyer has been notified. An AYP Success Manager will coordinate the transaction.' });
        setShowDetailModal(false); setResponseMessage(''); loadOffers();
      } else { throw new Error(data?.error || 'Failed'); }
    } catch (err: any) {
      // DB fallback
      try {
        await supabase.from('marketplace_offers').update({ status: 'accepted', responded_at: new Date().toISOString(), response_message: responseMessage || null }).eq('id', offerId).eq('seller_id', investorId);
        toast({ title: 'Offer Accepted!' }); setShowDetailModal(false); setResponseMessage(''); loadOffers();
      } catch { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    }
    setProcessing(false);
  };

  const handleReject = async (offerId: string) => {
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'reject_offer', offer_id: offerId, seller_id: investorId, response_message: responseMessage || null }
      });
      if (data?.success) {
        toast({ title: 'Offer Rejected' }); setShowDetailModal(false); setResponseMessage(''); loadOffers();
      } else { throw new Error(data?.error || 'Failed'); }
    } catch (err: any) {
      try {
        await supabase.from('marketplace_offers').update({ status: 'rejected', responded_at: new Date().toISOString(), response_message: responseMessage || null }).eq('id', offerId).eq('seller_id', investorId);
        toast({ title: 'Offer Rejected' }); setShowDetailModal(false); setResponseMessage(''); loadOffers();
      } catch { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    }
    setProcessing(false);
  };

  const handleCounter = async () => {
    const amount = parseFloat(counterAmount);
    if (!amount || amount <= 0) { toast({ title: 'Invalid Amount', variant: 'destructive' }); return; }
    if (!respondingOfferId) return;
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'counter_offer', offer_id: respondingOfferId, responder_id: investorId, counter_amount: amount, message: counterMessage.trim() || null }
      });
      if (data?.success) {
        toast({ title: 'Counter Offer Sent!', description: `Your counter of $${amount.toLocaleString()} has been sent.` });
        setShowCounterModal(false); setShowDetailModal(false); setCounterAmount(''); setCounterMessage(''); setRespondingOfferId(null); loadOffers();
      } else { throw new Error(data?.error || 'Failed'); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setProcessing(false);
  };

  const openNegotiation = (neg: GroupedNegotiation) => {
    setSelectedNegotiation(neg); setShowDetailModal(true); setResponseMessage('');
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" /></div>;
  if (sortedNegotiations.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#d4a574]/10 rounded-full flex items-center justify-center">
                <Handshake className="w-5 h-5 text-[#d4a574]" />
              </div>
              <div>
                <CardTitle className="text-lg">Incoming Offers</CardTitle>
                <CardDescription>
                  {pendingCount > 0 ? `${pendingCount} negotiation${pendingCount > 1 ? 's' : ''} with pending offers (${totalPendingOffers} total)` : 'All offers have been responded to'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {totalPendingOffers > 0 && (
                <Badge className="bg-red-500 text-white animate-pulse">{totalPendingOffers} pending</Badge>
              )}
              <Button variant="outline" size="sm" onClick={loadOffers}>
                <RefreshCw className="w-4 h-4 mr-1" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(listingGroups).map(([listingId, group]) => (
              <div key={listingId}>
                {/* Per-listing header with badge count */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-700 truncate max-w-[400px]">{group.address}</p>
                    {group.pendingCount > 0 && (
                      <Badge className="bg-[#d4a574] text-white text-xs flex items-center gap-1">
                        <Bell className="w-3 h-3" /> {group.pendingCount} pending offer{group.pendingCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{group.negotiations.length} thread{group.negotiations.length > 1 ? 's' : ''}</span>
                </div>

                <div className="space-y-2">
                  {group.negotiations.map((neg) => {
                    const latest = neg.latest_offer;
                    const pctOfAsking = neg.listing_asking_price > 0 ? Math.round((latest.offer_amount / neg.listing_asking_price) * 100) : 0;

                    return (
                      <div key={`${neg.listing_id}-${neg.buyer_id}`}
                        className={`border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md ${
                          neg.has_pending ? 'border-[#d4a574] bg-[#d4a574]/5 hover:border-[#c49464]'
                          : latest.status === 'accepted' ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => openNegotiation(neg)}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              neg.has_pending ? 'bg-[#d4a574]/20' : latest.status === 'accepted' ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              <User className={`w-5 h-5 ${neg.has_pending ? 'text-[#d4a574]' : latest.status === 'accepted' ? 'text-green-600' : 'text-gray-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{neg.buyer_name}</span>
                                {neg.has_pending && <Badge className="bg-yellow-100 text-yellow-700 text-xs"><Clock className="w-3 h-3 mr-1" /> Awaiting Response</Badge>}
                                {latest.status === 'accepted' && <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle className="w-3 h-3 mr-1" /> Accepted</Badge>}
                                {latest.status === 'rejected' && <Badge className="bg-red-100 text-red-700 text-xs"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-gray-400">{neg.offers.length} offer{neg.offers.length > 1 ? 's' : ''}</span>
                                {latest.message && <span className="text-xs text-gray-400 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Has message</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-[#1a365d]">${latest.offer_amount.toLocaleString()}</p>
                            <Badge className={`text-xs ${pctOfAsking >= 100 ? 'bg-green-100 text-green-700' : pctOfAsking >= 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {pctOfAsking}% of asking
                            </Badge>
                            {neg.has_pending && <p className="text-xs text-[#d4a574] mt-1 font-medium">Action needed</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Negotiation Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={(o) => { if (!o) { setShowDetailModal(false); setResponseMessage(''); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Handshake className="w-5 h-5 text-[#d4a574]" /> Negotiation with {selectedNegotiation?.buyer_name}</DialogTitle>
            <DialogDescription>{selectedNegotiation?.property_address}</DialogDescription>
          </DialogHeader>
          {selectedNegotiation && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-gray-50"><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-gray-500">Asking Price</p><p className="text-lg font-bold">${selectedNegotiation.listing_asking_price.toLocaleString()}</p></CardContent></Card>
                <Card className={selectedNegotiation.has_pending ? 'bg-[#d4a574]/10 border-[#d4a574]' : 'bg-gray-50'}><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-gray-500">Latest Offer</p><p className="text-lg font-bold text-[#d4a574]">${selectedNegotiation.latest_offer.offer_amount.toLocaleString()}</p></CardContent></Card>
                <Card className="bg-green-50"><CardContent className="pt-4 pb-4 text-center"><p className="text-xs text-green-600">Your Net (80%)</p><p className="text-lg font-bold text-green-700">${Math.round(selectedNegotiation.latest_offer.offer_amount * 0.8).toLocaleString()}</p></CardContent></Card>
              </div>
              <div className="border rounded-lg p-4 max-h-[350px] overflow-y-auto">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Offer Timeline</h4>
                <NegotiationTimeline offers={selectedNegotiation.offers} viewerRole="seller" askingPrice={selectedNegotiation.listing_asking_price} />
              </div>
              {selectedNegotiation.has_pending && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold text-sm">Respond to this offer</h4>
                  <div><Label className="text-xs text-gray-500">Optional message with your response</Label>
                    <Textarea value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} placeholder="Add a message to the buyer (optional)..." rows={2} className="mt-1" /></div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleAccept(selectedNegotiation.latest_offer.id)} disabled={processing} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                      {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}<CheckCircle className="w-4 h-4 mr-2" /> Accept ${selectedNegotiation.latest_offer.offer_amount.toLocaleString()}
                    </Button>
                    <Button variant="outline" onClick={() => { setRespondingOfferId(selectedNegotiation.latest_offer.id); setCounterAmount(''); setCounterMessage(''); setShowCounterModal(true); }} disabled={processing} className="flex-1">
                      <RotateCcw className="w-4 h-4 mr-2" /> Counter
                    </Button>
                    <Button variant="destructive" onClick={() => handleReject(selectedNegotiation.latest_offer.id)} disabled={processing} className="flex-1">
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 text-center">Accepting this offer will automatically reject all other pending offers on this listing.</p>
                </div>
              )}
            </>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Counter Offer Modal */}
      <Dialog open={showCounterModal} onOpenChange={(o) => { if (!o) setShowCounterModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-[#d4a574]" /> Counter Offer</DialogTitle>
            <DialogDescription>Propose a different amount to {selectedNegotiation?.buyer_name}</DialogDescription>
          </DialogHeader>
          {selectedNegotiation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Their Offer</p><p className="font-bold text-lg">${selectedNegotiation.latest_offer.offer_amount.toLocaleString()}</p></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">Your Asking</p><p className="font-bold text-lg">${selectedNegotiation.listing_asking_price.toLocaleString()}</p></div>
              </div>
              <div>
                <Label htmlFor="counter-amount">Your Counter Amount *</Label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input id="counter-amount" type="number" min="0" value={counterAmount} onChange={(e) => setCounterAmount(e.target.value)} placeholder="Enter your counter amount" className="pl-10 text-lg h-12" />
                </div>
                {parseFloat(counterAmount) > 0 && <p className="text-xs text-gray-500 mt-1">Your net (80%): <span className="font-semibold text-green-600">${Math.round(parseFloat(counterAmount) * 0.8).toLocaleString()}</span></p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Midpoint', amount: Math.round((selectedNegotiation.latest_offer.offer_amount + selectedNegotiation.listing_asking_price) / 2) },
                  { label: 'Asking -5%', amount: Math.round(selectedNegotiation.listing_asking_price * 0.95) },
                  { label: 'Full Asking', amount: selectedNegotiation.listing_asking_price },
                ].map((s) => (
                  <Button key={s.label} variant="outline" size="sm" onClick={() => setCounterAmount(String(s.amount))}
                    className={parseFloat(counterAmount) === s.amount ? 'border-[#d4a574] bg-[#d4a574]/10' : ''}>
                    {s.label}: ${s.amount.toLocaleString()}
                  </Button>
                ))}
              </div>
              <div><Label htmlFor="counter-message">Message (Optional)</Label>
                <Textarea id="counter-message" value={counterMessage} onChange={(e) => setCounterMessage(e.target.value)} placeholder="Explain your counter offer..." rows={2} className="mt-1" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCounterModal(false)}>Cancel</Button>
            <Button onClick={handleCounter} disabled={processing || !counterAmount || parseFloat(counterAmount) <= 0} className="bg-[#d4a574] hover:bg-[#c49464]">
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" /> Send Counter {counterAmount && parseFloat(counterAmount) > 0 ? `— $${parseFloat(counterAmount).toLocaleString()}` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
