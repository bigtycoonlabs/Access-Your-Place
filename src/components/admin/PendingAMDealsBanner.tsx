import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { 
  AlertTriangle, Building2, Clock, ChevronRight, 
  CheckCircle, XCircle, Eye, Loader2, MapPin, DollarSign, RefreshCw
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface PendingDeal {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zip_code?: string;
  price?: number;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  property_type?: string;
  operation_type?: string;
  photos?: string[];
  landlord_name?: string;
  landlord_email?: string;
  landlord_phone?: string;
  listing_url?: string;
  internal_notes?: string;
  deal_status: string;
  added_by_staff_id?: string;
  added_by_staff_name?: string;
  found_by_am_name?: string;
  created_at: string;
}

interface Props {
  staffName: string;
  onNavigateToReview?: () => void;
}

export function PendingAMDealsBanner({ staffName, onNavigateToReview }: Props) {
  const [pendingDeals, setPendingDeals] = useState<PendingDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [reviewDeal, setReviewDeal] = useState<PendingDeal | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingDeals();
    // Refresh every 60 seconds
    const interval = setInterval(fetchPendingDeals, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingDeals = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: { action: 'get_pending_submissions' }
      });
      if (!error && data?.deals) {
        const pending = data.deals.filter((d: any) => d.deal_status === 'am_submitted');
        setPendingDeals(pending);
      }
    } catch (err) {
      console.error('Failed to fetch pending deals:', err);
    }
    setLoading(false);
  };

  const handleApprove = async () => {
    if (!reviewDeal) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: {
          action: 'approve_deal',
          property_id: reviewDeal.id,
          approved_by_name: staffName,
          approval_notes: reviewNotes.trim()
        }
      });
      if (error) throw error;
      toast({ title: 'Deal Approved!', description: data?.message || 'Deal moved to pipeline. AM notified.' });
      setReviewDeal(null);
      setReviewNotes('');
      fetchPendingDeals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleDeny = async () => {
    if (!reviewDeal) return;
    if (!reviewNotes.trim()) {
      toast({ title: 'Please provide a reason for denial', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('am-submit-deal', {
        body: {
          action: 'deny_deal',
          property_id: reviewDeal.id,
          denied_by_name: staffName,
          denial_notes: reviewNotes.trim()
        }
      });
      if (error) throw error;
      toast({ title: 'Deal Denied', description: data?.message || 'AM has been notified.' });
      setReviewDeal(null);
      setReviewNotes('');
      fetchPendingDeals();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const formatCurrency = (val?: number) => val ? `$${val.toLocaleString()}` : 'N/A';

  if (loading || dismissed || pendingDeals.length === 0) return null;

  return (
    <>
      {/* Notification Banner */}
      <div className="mb-6 animate-in slide-in-from-top-2 duration-300">
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 shadow-lg shadow-amber-100/50">
          <CardContent className="py-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left: Alert info */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-amber-900 text-base">
                      {pendingDeals.length} Pending Deal{pendingDeals.length !== 1 ? 's' : ''} Awaiting Review
                    </h3>
                    <Badge className="bg-amber-500 text-white text-xs animate-pulse">
                      Action Required
                    </Badge>
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    Acquisition Manager{pendingDeals.length !== 1 ? 's have' : ' has'} submitted {pendingDeals.length} deal{pendingDeals.length !== 1 ? 's' : ''} for your review and approval.
                  </p>
                  
                  {/* Quick preview of pending deals */}
                  <div className="mt-3 space-y-2">
                    {pendingDeals.slice(0, 3).map((deal) => (
                      <div 
                        key={deal.id} 
                        className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2 border border-amber-200 hover:bg-white transition-colors cursor-pointer"
                        onClick={() => { setReviewDeal(deal); setReviewNotes(''); }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Building2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {deal.title || deal.address}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {deal.city}, {deal.state}
                              {deal.price ? (
                                <span className="ml-2 flex items-center gap-0.5 text-green-700">
                                  <DollarSign className="w-3 h-3" />
                                  {formatCurrency(deal.price)}
                                </span>
                              ) : null}
                              <span className="ml-2 text-gray-400">
                                by {deal.added_by_staff_name || deal.found_by_am_name || 'AM'}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(deal.created_at).toLocaleDateString()}
                          </Badge>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            onClick={(e) => { e.stopPropagation(); setReviewDeal(deal); setReviewNotes(''); }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                    {pendingDeals.length > 3 && (
                      <p className="text-xs text-amber-600 pl-7">
                        + {pendingDeals.length - 3} more pending deal{pendingDeals.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 lg:flex-col">
                {onNavigateToReview && (
                  <Button 
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={onNavigateToReview}
                  >
                    View All Submissions
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-amber-600 hover:text-amber-700"
                  onClick={() => setDismissed(true)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Review Modal */}
      <Dialog open={!!reviewDeal} onOpenChange={() => { setReviewDeal(null); setReviewNotes(''); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              Quick Deal Review
            </DialogTitle>
            <DialogDescription>
              Review and approve or deny this AM-submitted deal. The AM will be notified of your decision via email.
            </DialogDescription>
          </DialogHeader>

          {reviewDeal && (
            <div className="space-y-4">
              {/* Submitter info */}
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-amber-500 text-white">
                  <Clock className="w-3 h-3 mr-1" />
                  Pending Review
                </Badge>
                <span className="text-gray-500">
                  Submitted by <strong>{reviewDeal.added_by_staff_name || reviewDeal.found_by_am_name || 'AM'}</strong>
                  {' on '}
                  {new Date(reviewDeal.created_at).toLocaleDateString()} at {new Date(reviewDeal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Property details card */}
              <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200">
                <CardContent className="pt-4 space-y-3">
                  <h4 className="font-bold text-lg text-[#1a365d]">{reviewDeal.title || reviewDeal.address}</h4>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {reviewDeal.address}, {reviewDeal.city}, {reviewDeal.state} {reviewDeal.zip_code || ''}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-white rounded-lg p-3 border">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Asking Price</p>
                      <p className="text-lg font-bold text-green-700">{formatCurrency(reviewDeal.price)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly Revenue</p>
                      <p className="text-lg font-bold text-blue-700">
                        {reviewDeal.monthly_rent ? `${formatCurrency(reviewDeal.monthly_rent)}/mo` : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Bedrooms / Bath</p>
                      <p className="text-base font-semibold">{reviewDeal.bedrooms || 'N/A'} BR / {reviewDeal.bathrooms || 'N/A'} BA</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Operation Type</p>
                      <p className="text-base font-semibold">{(reviewDeal.operation_type || 'str').toUpperCase()}</p>
                    </div>
                  </div>

                  {reviewDeal.sqft && (
                    <p className="text-sm text-gray-600">
                      <strong>Square Footage:</strong> {reviewDeal.sqft.toLocaleString()} sqft
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Landlord Info */}
              {(reviewDeal.landlord_name || reviewDeal.landlord_email || reviewDeal.landlord_phone) && (
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Landlord Contact</h4>
                    <div className="space-y-1 text-sm">
                      {reviewDeal.landlord_name && <p><strong>Name:</strong> {reviewDeal.landlord_name}</p>}
                      {reviewDeal.landlord_email && <p><strong>Email:</strong> {reviewDeal.landlord_email}</p>}
                      {reviewDeal.landlord_phone && <p><strong>Phone:</strong> {reviewDeal.landlord_phone}</p>}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AM Notes */}
              {reviewDeal.internal_notes && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">AM Notes:</p>
                  <p className="text-sm text-blue-700">{reviewDeal.internal_notes}</p>
                </div>
              )}

              {/* Photos */}
              {reviewDeal.photos && reviewDeal.photos.filter(Boolean).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Photos ({reviewDeal.photos.filter(Boolean).length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {reviewDeal.photos.filter(Boolean).map((photo, i) => (
                      <img
                        key={i}
                        src={photo}
                        alt={`Property photo ${i + 1}`}
                        className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(photo, '_blank')}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Listing URL */}
              {reviewDeal.listing_url && (
                <Button variant="outline" className="w-full" onClick={() => window.open(reviewDeal.listing_url, '_blank')}>
                  View Original Listing
                </Button>
              )}

              {/* Review Section */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <Label htmlFor="quick-review-notes" className="font-semibold">
                  Review Notes <span className="font-normal text-gray-500">(required for denial)</span>
                </Label>
                <Textarea
                  id="quick-review-notes"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your decision... (e.g., 'Good numbers, approved for pipeline' or 'Revenue projections seem too high, need documentation')"
                  rows={3}
                  className="resize-none"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={handleDeny}
                    disabled={processing}
                  >
                    {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                    Deny Deal
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleApprove}
                    disabled={processing}
                  >
                    {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Approve Deal
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
