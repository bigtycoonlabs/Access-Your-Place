import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { NegotiationTimeline, OfferRecord } from './NegotiationTimeline';
import {
  Loader2, DollarSign, Send, MapPin, Building2, AlertCircle,
  TrendingUp, Percent, ArrowRight, MessageSquare, Clock, History
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  listingId: string;
  buyerId: string;
  buyerName: string;
  askingPrice: number;
  propertyAddress: string;
  monthlyRevenue?: number;
  monthlyRent?: number;
  sellerName?: string;
  onSuccess?: () => void;
}

export function BuyerOfferModal({
  open, onClose, listingId, buyerId, buyerName,
  askingPrice, propertyAddress, monthlyRevenue, monthlyRent,
  sellerName, onSuccess
}: Props) {
  const [offerAmount, setOfferAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingOffers, setExistingOffers] = useState<OfferRecord[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && listingId && buyerId) {
      loadExistingOffers();
    }
  }, [open, listingId, buyerId]);

  const loadExistingOffers = async () => {
    setLoadingOffers(true);
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'get_listing_offers', listing_id: listingId, investor_id: buyerId }
      });
      setExistingOffers(data?.offers || []);
    } catch (err) {
      console.error('Error loading offers:', err);
    }
    setLoadingOffers(false);
  };

  const amount = parseFloat(offerAmount) || 0;
  const pctOfAsking = askingPrice > 0 ? Math.round((amount / askingPrice) * 100) : 0;
  const aypCommission = Math.round(amount * 0.2);
  const sellerNet = Math.round(amount * 0.8);
  const monthlyProfit = (monthlyRevenue || 0) - (monthlyRent || 0);
  const paybackMonths = amount > 0 && monthlyProfit > 0 ? Math.ceil(amount / monthlyProfit) : null;

  const hasPendingOffer = existingOffers.some(o => o.status === 'pending');
  const hasAcceptedOffer = existingOffers.some(o => o.status === 'accepted');

  const quickOfferAmounts = [
    { label: '90%', amount: Math.round(askingPrice * 0.9) },
    { label: '95%', amount: Math.round(askingPrice * 0.95) },
    { label: 'Full', amount: askingPrice },
    { label: '105%', amount: Math.round(askingPrice * 1.05) },
  ];

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid offer amount.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'submit_offer',
          listing_id: listingId,
          buyer_id: buyerId,
          offer_amount: amount,
          message: message.trim() || null
        }
      });

      if (data?.success) {
        toast({
          title: 'Offer Submitted!',
          description: `Your offer of $${amount.toLocaleString()} has been sent to the seller. You'll be notified when they respond.`,
        });
        setOfferAmount('');
        setMessage('');
        onSuccess?.();
        onClose();
      } else {
        throw new Error(data?.error || error?.message || 'Failed to submit offer');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#d4a574]" />
            {hasPendingOffer ? 'Offer Status' : hasAcceptedOffer ? 'Offer Accepted' : 'Make an Offer'}
          </DialogTitle>
          <DialogDescription>
            {propertyAddress}
          </DialogDescription>
        </DialogHeader>

        {/* Listing Summary */}
        <Card className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white border-0">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {propertyAddress}
                </p>
                {sellerName && <p className="text-white/60 text-xs mt-0.5">Listed by {sellerName}</p>}
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs">Asking Price</p>
                <p className="text-2xl font-bold">${askingPrice.toLocaleString()}</p>
              </div>
            </div>
            {(monthlyRevenue || monthlyRent) && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-white/20">
                {monthlyRevenue && monthlyRevenue > 0 && (
                  <div>
                    <p className="text-white/60 text-xs">Monthly Revenue</p>
                    <p className="font-semibold">${monthlyRevenue.toLocaleString()}</p>
                  </div>
                )}
                {monthlyRent && monthlyRent > 0 && (
                  <div>
                    <p className="text-white/60 text-xs">Monthly Rent</p>
                    <p className="font-semibold">${monthlyRent.toLocaleString()}</p>
                  </div>
                )}
                {monthlyProfit > 0 && (
                  <div>
                    <p className="text-white/60 text-xs">Est. Profit</p>
                    <p className="font-semibold text-green-300">${monthlyProfit.toLocaleString()}/mo</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Existing Offers History */}
        {existingOffers.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm font-medium text-[#d4a574] hover:text-[#c49464] transition-colors w-full"
            >
              <History className="w-4 h-4" />
              {showHistory ? 'Hide' : 'Show'} Offer History ({existingOffers.length})
              <ArrowRight className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
            </button>
            {showHistory && (
              <div className="mt-3 max-h-[300px] overflow-y-auto border rounded-lg p-3">
                <NegotiationTimeline
                  offers={existingOffers}
                  viewerRole="buyer"
                  askingPrice={askingPrice}
                  compact
                />
              </div>
            )}
          </div>
        )}

        {/* Accepted Offer Banner */}
        {hasAcceptedOffer && (
          <Card className="bg-green-50 border-green-300">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-800">Offer Accepted!</p>
                  <p className="text-sm text-green-600">
                    Your offer has been accepted. An AYP Success Manager will coordinate the next steps.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Offer Banner */}
        {hasPendingOffer && !hasAcceptedOffer && (
          <Card className="bg-yellow-50 border-yellow-300">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-semibold text-yellow-800">Offer Pending</p>
                  <p className="text-sm text-yellow-600">
                    You have a pending offer on this listing. The seller has 7 days to respond.
                    You'll be notified by email when they accept, reject, or counter.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Offer Form (only if no pending/accepted offer) */}
        {!hasPendingOffer && !hasAcceptedOffer && (
          <>
            {/* Quick Offer Buttons */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Quick Offer</Label>
              <div className="flex gap-2">
                {quickOfferAmounts.map((q) => (
                  <Button
                    key={q.label}
                    variant={amount === q.amount ? 'default' : 'outline'}
                    size="sm"
                    className={amount === q.amount ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}
                    onClick={() => setOfferAmount(String(q.amount))}
                  >
                    {q.label} (${q.amount.toLocaleString()})
                  </Button>
                ))}
              </div>
            </div>

            {/* Offer Amount */}
            <div>
              <Label htmlFor="offer-amount">Your Offer Amount *</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="offer-amount"
                  type="number"
                  min="0"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder="Enter your proposed acquisition fee"
                  className="pl-10 text-lg h-12"
                />
              </div>
              {amount > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={`${
                    pctOfAsking >= 100 ? 'bg-green-100 text-green-700' :
                    pctOfAsking >= 90 ? 'bg-yellow-100 text-yellow-700' :
                    pctOfAsking >= 80 ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    <Percent className="w-3 h-3 mr-1" />
                    {pctOfAsking}% of asking price
                  </Badge>
                  {pctOfAsking < 80 && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Very low offer — seller may reject
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Pricing Breakdown */}
            {amount > 0 && (
              <Card className="bg-gray-50">
                <CardContent className="pt-4 pb-4">
                  <h4 className="font-medium text-sm mb-3">Pricing Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Your Offer</span>
                      <span className="font-semibold">${amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>AYP Facilitation Fee (20%)</span>
                      <span>${aypCommission.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Seller Receives (80%)</span>
                      <span className="text-green-600">${sellerNet.toLocaleString()}</span>
                    </div>
                    {paybackMonths && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-gray-600">
                          <span>Est. Payback Period</span>
                          <span className="font-medium">{paybackMonths} months</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Message */}
            <div>
              <Label htmlFor="offer-message">Message to Seller (Optional)</Label>
              <Textarea
                id="offer-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Introduce yourself, explain your experience, or share why you're interested in this operation..."
                rows={3}
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">A personal message can help your offer stand out.</p>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium flex items-center gap-1 mb-1"><AlertCircle className="w-4 h-4" /> How offers work</p>
              <ul className="space-y-1 text-xs list-disc list-inside">
                <li>The seller has 7 days to accept, reject, or counter your offer.</li>
                <li>If accepted, an AYP Success Manager will coordinate the transaction.</li>
                <li>The seller can counter with a different amount — you can then accept, reject, or counter back.</li>
                <li>AYP retains 20% of the final agreed amount as a facilitation fee.</li>
              </ul>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {hasPendingOffer || hasAcceptedOffer ? 'Close' : 'Cancel'}
          </Button>
          {!hasPendingOffer && !hasAcceptedOffer && (
            <Button
              onClick={handleSubmit}
              disabled={submitting || amount <= 0}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Submit Offer {amount > 0 && `— $${amount.toLocaleString()}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
