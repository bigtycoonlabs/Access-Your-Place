import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, CreditCard, DollarSign, CheckCircle, Clock, 
  AlertCircle, Send, History, Info, HelpCircle, Coins,
  Building2, Receipt, Gift, AlertTriangle
} from 'lucide-react';

interface Props {
  investorId: string;
}

interface Credit {
  id: string;
  amount: number;
  credit_type: string;
  source_description: string;
  credit_status: string;
  expires_at: string;
  used_at?: string;
  used_for?: string;
  used_for_assignment_id?: string;
  created_at: string;
}

interface CreditRequest {
  id: string;
  amount_requested: number;
  description: string;
  request_type: string;
  request_status: string;
  admin_notes?: string;
  reviewed_at?: string;
  created_at: string;
}

interface UsageRecord {
  id: string;
  assignment_id?: string;
  property_id?: string;
  total_credit_amount: number;
  original_fee: number;
  final_amount_paid: number;
  transaction_type: string;
  credit_details: any[];
  created_at: string;
}

interface CreditSummary {
  total_active_credits: number;
  total_active_amount: number;
  total_used_credits: number;
  total_used_amount: number;
  total_saved: number;
  recent_usage: UsageRecord[];
  active_credits: Credit[];
}

export function InvestmentCredits({ investorId }: Props) {
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestForm, setRequestForm] = useState({ 
    amount: '', 
    reason: '', 
    details: '',
    property_address: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCredits();
  }, [investorId]);

  const fetchCredits = async () => {
    setLoading(true);
    try {
      // Fetch credit summary
      let gotSummary = false;
      try {
        const { data: summaryData } = await supabase.functions.invoke('manage-investor-credits', {
          body: { action: 'get_investor_credit_summary', investor_id: investorId }
        });
        if (summaryData?.summary) {
          setSummary(summaryData.summary);
          gotSummary = true;
        }
      } catch {}

      // Fallback: direct DB query
      if (!gotSummary) {
        try {
          const { data: directCredits } = await supabase
            .from('investor_credits')
            .select('*')
            .eq('investor_id', investorId)
            .order('created_at', { ascending: false });
          if (directCredits) {
            const active = directCredits.filter(c => c.credit_status === 'active');
            const used = directCredits.filter(c => c.credit_status === 'used');
            const totalActive = active.reduce((s: number, c: any) => s + (parseFloat(String(c.amount)) || 0), 0);
            const totalUsed = used.reduce((s: number, c: any) => s + (parseFloat(String(c.amount)) || 0), 0);
            setSummary({
              total_active_credits: active.length,
              total_active_amount: totalActive,
              total_used_credits: used.length,
              total_used_amount: totalUsed,
              total_saved: totalUsed,
              recent_usage: [],
              active_credits: active as any
            });
          }
        } catch {}
      }

      // Fetch credit requests
      try {
        const { data: requestsData } = await supabase.functions.invoke('investor-auth', {
          body: { action: 'get_credit_requests', investor_id: investorId }
        });
        if (requestsData?.requests) {
          setRequests(requestsData.requests);
        }
      } catch {}
    } catch (err) {
      console.error('Error fetching credits:', err);
    }
    setLoading(false);
  };


  const submitCreditRequest = async () => {
    if (!requestForm.reason) {
      toast({ title: 'Missing Information', description: 'Please explain why you believe you have a credit.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'submit_credit_request',
          investor_id: investorId,
          amount_requested: parseFloat(requestForm.amount) || 0,
          description: requestForm.reason,
          request_type: 'missing_credit',
          related_property_address: requestForm.property_address,
          details: requestForm.details
        }
      });

      if (data?.success) {
        toast({ 
          title: 'Request Submitted', 
          description: 'Your credit request has been submitted for review. Our team will respond within 2-3 business days.' 
        });
        setShowRequestModal(false);
        setRequestForm({ amount: '', reason: '', details: '', property_address: '' });
        fetchCredits();
      } else {
        throw new Error(data?.error || 'Failed to submit request');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getCreditTypeLabel = (type: string) => {
    switch (type) {
      case 'incomplete_acquisition': return 'Incomplete Acquisition';
      case 'approved_request': return 'Approved Request';
      case 'manual': return 'Manual Credit';
      case 'referral': return 'Referral Bonus';
      case 'promotional': return 'Promotional';
      case 'compensation': return 'Compensation';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading credits">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" aria-hidden="true" />
        <span className="sr-only">Loading your investment credits...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="YP Investment Credits">
      {/* Credit Summary */}
      <Card className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Coins className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
            YP Investment Credits
          </CardTitle>
          <CardDescription className="text-white/70">
            Use credits to reduce acquisition fees on new properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-white/60">Available Credit</p>
              <p className="text-3xl font-bold text-[#d4a574]">${(summary?.total_active_amount || 0).toLocaleString()}</p>
              <p className="text-xs text-white/50">{summary?.total_active_credits || 0} active credit(s)</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Total Saved</p>
              <p className="text-2xl font-bold text-green-400">${(summary?.total_saved || 0).toLocaleString()}</p>
              <p className="text-xs text-white/50">Lifetime savings</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Credits Used</p>
              <p className="text-2xl font-bold">${(summary?.total_used_amount || 0).toLocaleString()}</p>
              <p className="text-xs text-white/50">{summary?.total_used_credits || 0} credit(s)</p>
            </div>
            <div className="flex items-end">
              <Button onClick={() => setShowRequestModal(true)} className="bg-[#d4a574] hover:bg-[#c49464] text-white">
                <Send className="w-4 h-4 mr-2" />Report Missing Credit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Credit Information - Updated: Credits don't expire */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Gift className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-semibold mb-2">How to Use Your Credits</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Credits are automatically shown on the checkout page when you purchase a new acquisition</li>
                <li>Select which credits to apply and they'll reduce your acquisition fee</li>
                <li>If your credits fully cover the fee, no payment is required</li>
                <li className="font-semibold">Credits at Access Your Place do NOT expire — they remain on your account indefinitely</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            Active Credits
            {summary?.total_active_credits ? (
              <Badge className="ml-2 bg-green-500">{summary.total_active_credits}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="usage">Usage History</TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {requests.filter(r => r.request_status === 'pending').length > 0 && (
              <Badge className="ml-2 bg-orange-500">
                {requests.filter(r => r.request_status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Active Credits Tab */}
        <TabsContent value="overview" className="space-y-4">
          {!summary?.active_credits || summary.active_credits.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Coins className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                <p className="font-medium">No active credits at this time</p>
                <p className="text-sm mt-2">
                  Credits are issued when acquisitions are incomplete or as promotional bonuses.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowRequestModal(true)}
                >
                  Report Missing Credit
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" role="list" aria-label="Active credits">
              {summary.active_credits.map((credit) => {
                const daysLeft = getDaysUntilExpiry(credit.expires_at);
                const isExpiringSoon = daysLeft <= 30;

                return (
                  <Card key={credit.id} className={isExpiringSoon ? 'border-yellow-300' : ''} role="listitem">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-100 rounded-lg" aria-hidden="true">
                            <Coins className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-bold text-xl text-amber-700" aria-label={`Credit of $${parseFloat(String(credit.amount)).toLocaleString()}`}>
                              ${parseFloat(String(credit.amount)).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">
                              {credit.source_description || getCreditTypeLabel(credit.credit_type)}
                            </p>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {getCreditTypeLabel(credit.credit_type)}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-green-500">Active</Badge>
                          <p className="text-xs text-gray-400 mt-2">
                            Added {formatDate(credit.created_at)}
                          </p>
                          {credit.expires_at && (
                            <p className={`text-xs mt-1 ${isExpiringSoon ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                              {isExpiringSoon ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  Expires in {daysLeft} days
                                </>
                              ) : (
                                `Expires ${formatDate(credit.expires_at)}`
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Usage History Tab */}
        <TabsContent value="usage" className="space-y-4">
          {!summary?.recent_usage || summary.recent_usage.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                <p className="font-medium">No credit usage history yet</p>
                <p className="text-sm mt-2">
                  When you use credits on an acquisition, the transaction will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" role="list" aria-label="Credit usage history">
              {summary.recent_usage.map((usage) => (
                <Card key={usage.id} role="listitem">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg" aria-hidden="true">
                          <Receipt className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-semibold">Credits Applied to Acquisition</p>
                          <p className="text-sm text-gray-500">
                            {usage.credit_details?.length || 0} credit(s) used
                          </p>
                          <Badge 
                            variant="outline" 
                            className={usage.transaction_type === 'credits_only' ? 'text-green-600' : 'text-blue-600'}
                          >
                            {usage.transaction_type === 'credits_only' ? 'Fully Covered' : 'Partial Credit'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-amber-600">
                          -${usage.total_credit_amount?.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(usage.created_at)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Paid: ${usage.final_amount_paid?.toFixed(2)} of ${usage.original_fee?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <History className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                <p className="font-medium">No credit requests submitted</p>
                <p className="text-sm mt-2">
                  If you believe you have a missing credit, submit a request for review.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowRequestModal(true)}
                >
                  Report Missing Credit
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" role="list" aria-label="Credit requests">
              {requests.map((request) => (
                <Card key={request.id} role="listitem" className={request.request_status === 'pending' ? 'border-orange-200' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          request.request_status === 'approved' ? 'bg-green-100' :
                          request.request_status === 'rejected' ? 'bg-red-100' : 'bg-yellow-100'
                        }`} aria-hidden="true">
                          {request.request_status === 'approved' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : request.request_status === 'rejected' ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <Clock className="w-5 h-5 text-yellow-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">
                            {request.amount_requested > 0 ? `$${request.amount_requested.toLocaleString()} Credit Request` : 'Credit Request'}
                          </p>
                          <p className="text-sm text-gray-500">{request.description}</p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {request.request_type || 'missing_credit'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={
                          request.request_status === 'approved' ? 'bg-green-500' :
                          request.request_status === 'rejected' ? 'bg-red-500' : 'bg-orange-500'
                        }>
                          {request.request_status.charAt(0).toUpperCase() + request.request_status.slice(1)}
                        </Badge>
                        <p className="text-xs text-gray-400 mt-2">
                          Submitted {formatDate(request.created_at)}
                        </p>
                        {request.reviewed_at && (
                          <p className="text-xs text-gray-400">
                            Reviewed {formatDate(request.reviewed_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    {request.admin_notes && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-gray-600">
                          <strong>Admin Response:</strong> {request.admin_notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Credit Eligibility Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-2">Credit Eligibility Rules</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Credits are issued when a deal falls through or acquisition is incomplete</li>
                <li>Credits can <strong>only</strong> be applied to acquisition fees</li>
                <li>Credits <strong>cannot</strong> be applied to logistics fees, furniture costs, or setup services</li>
                <li>If you already have an active property with AYP and received all documents, you do not have a credit</li>
                <li className="font-semibold">Credits at Access Your Place do NOT expire</li>
              </ul>

            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request Credit Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
              Report Missing Credit
            </DialogTitle>
            <DialogDescription>
              If you believe you have a credit that's not showing in your account, submit a request for our team to review.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); submitCreditRequest(); }} className="space-y-4">
            <div>
              <Label htmlFor="credit-amount">Estimated Credit Amount ($)</Label>
              <Input
                id="credit-amount"
                type="number"
                min="0"
                value={requestForm.amount}
                onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                placeholder="499"
                aria-label="Estimated credit amount in dollars"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank if unsure</p>
            </div>

            <div>
              <Label htmlFor="credit-property">Related Property Address (if applicable)</Label>
              <Input
                id="credit-property"
                value={requestForm.property_address}
                onChange={(e) => setRequestForm({ ...requestForm, property_address: e.target.value })}
                placeholder="123 Main St, City, State"
              />
            </div>

            <div>
              <Label htmlFor="credit-reason">Reason for Credit *</Label>
              <Textarea
                id="credit-reason"
                value={requestForm.reason}
                onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                placeholder="e.g., I paid for a deal in October 2025 but the property fell through and I never received lease documents..."
                rows={3}
                required
                aria-required="true"
              />
            </div>

            <div>
              <Label htmlFor="credit-details">Additional Details</Label>
              <Textarea
                id="credit-details"
                value={requestForm.details}
                onChange={(e) => setRequestForm({ ...requestForm, details: e.target.value })}
                placeholder="Any reference numbers, dates, or other information that might help..."
                rows={2}
              />
            </div>

            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="pt-4">
                <div className="flex gap-2 text-sm text-yellow-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p>
                    Credits are only available for investors who have paid for a deal but have not yet received 
                    all required documents (lease agreements, corporate sublease, etc.). If you already have an 
                    active property with all documents, you are not eligible for a credit.
                  </p>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowRequestModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#d4a574] hover:bg-[#c49464]">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
