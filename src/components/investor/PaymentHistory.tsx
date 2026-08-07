import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, CreditCard, DollarSign, CheckCircle, Clock, 
  AlertCircle, Download, FileText, Receipt, Calendar,
  TrendingUp, Coins, Gift, History, Send, HelpCircle,
  AlertTriangle, Building2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  investorId: string;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  payment_status: string;
  payment_method?: string;
  description?: string;
  invoice_number?: string;
  credits_applied: number;
  property_id?: string;
  paid_at?: string;
  created_at: string;
}

interface PaymentSchedule {
  id: string;
  transaction_type: string;
  amount: number;
  due_date: string;
  payment_status: string;
  description?: string;
}

interface Credit {
  id: string;
  amount: number;
  credit_type: string;
  source_description: string;
  credit_status: string;
  expires_at: string;
  created_at: string;
}

interface CreditRequest {
  id: string;
  amount_requested: number;
  description: string;
  request_status: string;
  admin_notes?: string;
  created_at: string;
}

export function PaymentHistory({ investorId }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [receiptHtml, setReceiptHtml] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestForm, setRequestForm] = useState({ amount: '', reason: '', details: '', property_address: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [investorId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, schedulesRes, creditsRes, requestsRes] = await Promise.all([
        supabase.functions.invoke('manage-payments', {
          body: { action: 'get_payment_history', investor_id: investorId }
        }),
        supabase.functions.invoke('manage-payments', {
          body: { action: 'get_payment_schedules', investor_id: investorId }
        }),
        supabase.functions.invoke('manage-investor-credits', {
          body: { action: 'get_investor_credit_summary', investor_id: investorId }
        }),
        supabase.functions.invoke('investor-auth', {
          body: { action: 'get_credit_requests', investor_id: investorId }
        })
      ]);

      setTransactions(paymentsRes.data?.transactions || []);
      setSummary({
        ...paymentsRes.data?.summary,
        ...creditsRes.data?.summary
      });
      setSchedules(schedulesRes.data?.schedules || []);
      setCredits(creditsRes.data?.summary?.active_credits || []);
      setCreditRequests(requestsRes.data?.requests || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  const viewReceipt = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    try {
      const { data } = await supabase.functions.invoke('manage-payments', {
        body: { action: 'generate_receipt', transaction_id: transaction.id, investor_id: investorId }
      });
      setReceiptHtml(data?.html || '');
      setShowReceiptModal(true);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to generate receipt', variant: 'destructive' });
    }
  };

  const downloadReceipt = () => {
    if (!receiptHtml) return;
    const blob = new Blob([receiptHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${selectedTransaction?.invoice_number || 'download'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.print();
    }
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
        toast({ title: 'Request Submitted', description: 'Your credit request has been submitted for review.' });
        setShowRequestModal(false);
        setRequestForm({ amount: '', reason: '', details: '', property_address: '' });
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to submit request');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: typeof Clock }> = {
      completed: { bg: 'bg-green-500', icon: CheckCircle },
      pending: { bg: 'bg-yellow-500', icon: Clock },
      processing: { bg: 'bg-blue-500', icon: Loader2 },
      failed: { bg: 'bg-red-500', icon: AlertCircle },
      refunded: { bg: 'bg-purple-500', icon: Receipt },
      upcoming: { bg: 'bg-gray-500', icon: Calendar },
      due: { bg: 'bg-orange-500', icon: AlertCircle },
      overdue: { bg: 'bg-red-500', icon: AlertTriangle }
    };
    const s = styles[status] || styles.pending;
    const Icon = s.icon;
    return (
      <Badge className={s.bg}>
        <Icon className="w-3 h-3 mr-1" />
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      acquisition_fee: 'Acquisition Fee',
      setup_fee: 'Setup Fee',
      logistics_fee: 'Logistics Fee',
      subscription: 'Subscription',
      refund: 'Refund',
      credit_purchase: 'Credit Purchase',
      other: 'Other'
    };
    return labels[type] || type;
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Total Paid</p>
                <p className="text-2xl font-bold">${(summary?.total_paid || 0).toLocaleString()}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-white/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#d4a574] to-[#c49464] text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Available Credits</p>
                <p className="text-2xl font-bold">${(summary?.total_active_amount || 0).toLocaleString()}</p>
              </div>
              <Coins className="w-8 h-8 text-white/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Credits Used</p>
                <p className="text-2xl font-bold">${(summary?.total_credits_used || summary?.total_used_amount || 0).toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-white/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Pending</p>
                <p className="text-2xl font-bold">${(summary?.pending_payments || summary?.pending_amount || 0).toLocaleString()}</p>
              </div>
              <Clock className="w-8 h-8 text-white/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Payments Alert */}
      {schedules.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
              <Calendar className="w-5 h-5" />
              Upcoming Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {schedules.slice(0, 3).map(schedule => (
                <div 
                  key={schedule.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
                >
                  <div>
                    <p className="font-medium">{schedule.description || getTransactionTypeLabel(schedule.transaction_type)}</p>
                    <p className="text-sm text-gray-500">Due: {new Date(schedule.due_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">${schedule.amount.toLocaleString()}</p>
                    {getStatusBadge(schedule.payment_status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white shadow flex-wrap h-auto p-1">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Credits
            {credits.length > 0 && (
              <Badge className="ml-1 bg-green-500">{credits.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Requests
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Credit Info Card */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Gift className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-2">How to Use Your Credits</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Credits are automatically shown on the checkout page when you purchase a new acquisition</li>
                    <li>Select which credits to apply and they'll reduce your acquisition fee</li>
                    <li>Credits can only be applied to acquisition fees, not setup or logistics</li>
                    <li>Credits expire after 1 year - use them before they expire!</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#d4a574]" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium">No transactions yet</p>
                  <p className="text-sm">Your payment history will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 5).map(tx => (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => viewReceipt(tx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tx.payment_status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                          <CreditCard className={`w-5 h-5 ${tx.payment_status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`} />
                        </div>
                        <div>
                          <p className="font-medium">{tx.description || getTransactionTypeLabel(tx.transaction_type)}</p>
                          <p className="text-xs text-gray-500">
                            {tx.invoice_number} • {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${tx.amount.toLocaleString()}</p>
                        {tx.credits_applied > 0 && (
                          <p className="text-xs text-green-600">-${tx.credits_applied} credits</p>
                        )}
                        {getStatusBadge(tx.payment_status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#d4a574]" />
                All Transactions
              </CardTitle>
              <CardDescription>Complete payment history with receipts</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Receipt className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-lg">No transactions yet</p>
                  <p className="text-sm">Your payment history will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map(tx => (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tx.payment_status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                          <CreditCard className={`w-5 h-5 ${tx.payment_status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`} />
                        </div>
                        <div>
                          <p className="font-medium">{tx.description || getTransactionTypeLabel(tx.transaction_type)}</p>
                          <p className="text-sm text-gray-500">{tx.invoice_number}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(tx.created_at).toLocaleDateString()} 
                            {tx.paid_at && ` • Paid ${new Date(tx.paid_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg">${tx.amount.toLocaleString()}</p>
                          {tx.credits_applied > 0 && (
                            <p className="text-xs text-green-600">-${tx.credits_applied} credits applied</p>
                          )}
                          {getStatusBadge(tx.payment_status)}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => viewReceipt(tx)}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Receipt
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowRequestModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
              <Send className="w-4 h-4 mr-2" />
              Report Missing Credit
            </Button>
          </div>

          {credits.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Coins className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="font-medium text-lg">No active credits</p>
                <p className="text-sm mt-2">
                  Credits are issued when acquisitions are incomplete or as promotional bonuses.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {credits.map(credit => {
                const daysLeft = getDaysUntilExpiry(credit.expires_at);
                const isExpiringSoon = daysLeft <= 30;

                return (
                  <Card key={credit.id} className={isExpiringSoon ? 'border-yellow-300' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-100 rounded-lg">
                            <Coins className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-bold text-xl text-amber-700">
                              ${parseFloat(String(credit.amount)).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">{credit.source_description}</p>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {credit.credit_type.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-green-500">Active</Badge>
                          <p className="text-xs text-gray-400 mt-2">
                            Added {new Date(credit.created_at).toLocaleDateString()}
                          </p>
                          {credit.expires_at && (
                            <p className={`text-xs mt-1 ${isExpiringSoon ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                              {isExpiringSoon ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  Expires in {daysLeft} days
                                </>
                              ) : (
                                `Expires ${new Date(credit.expires_at).toLocaleDateString()}`
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

          {/* Credit Eligibility Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-2">Credit Eligibility Rules</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Credits are issued when a deal falls through or acquisition is incomplete</li>
                    <li>Credits can only be applied to acquisition fees</li>
                    <li>Credits cannot be applied to logistics fees, furniture costs, or setup services</li>
                    <li>Credits expire 1 year from the date they were issued</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#d4a574]" />
                Credit Requests
              </CardTitle>
              <CardDescription>Track your credit requests and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {creditRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium text-lg">No credit requests</p>
                  <p className="text-sm mt-2">Submit a request if you believe you have a missing credit</p>
                  <Button 
                    className="mt-4 bg-[#d4a574] hover:bg-[#c49464]"
                    onClick={() => setShowRequestModal(true)}
                  >
                    Report Missing Credit
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {creditRequests.map(request => (
                    <div 
                      key={request.id}
                      className={`p-4 border rounded-lg ${request.request_status === 'pending' ? 'border-orange-200 bg-orange-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            request.request_status === 'approved' ? 'bg-green-100' :
                            request.request_status === 'rejected' ? 'bg-red-100' : 'bg-yellow-100'
                          }`}>
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
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={
                            request.request_status === 'approved' ? 'bg-green-500' :
                            request.request_status === 'rejected' ? 'bg-red-500' : 'bg-orange-500'
                          }>
                            {request.request_status}
                          </Badge>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {request.admin_notes && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-gray-600">
                            <strong>Admin Response:</strong> {request.admin_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Receipt Modal */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#d4a574]" />
              {selectedTransaction?.payment_status === 'completed' ? 'Receipt' : 'Invoice'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <Button onClick={downloadReceipt} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button onClick={printReceipt} variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
          <div 
            className="border rounded-lg p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: receiptHtml }}
          />
        </DialogContent>
      </Dialog>

      {/* Credit Request Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#d4a574]" />
              Report Missing Credit
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitCreditRequest(); }} className="space-y-4">
            <div>
              <Label htmlFor="estimated-credit-amount">Estimated Credit Amount ($)</Label>
              <Input id="estimated-credit-amount"
                type="number"
                min="0"
                value={requestForm.amount}
                onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                placeholder="499"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank if unsure</p>
            </div>
            <div>
              <Label htmlFor="related-property-address">Related Property Address</Label>
              <Input id="related-property-address"
                value={requestForm.property_address}
                onChange={(e) => setRequestForm({ ...requestForm, property_address: e.target.value })}
                placeholder="123 Main St, City, State"
              />
            </div>
            <div>
              <Label htmlFor="reason-for-credit">Reason for Credit *</Label>
              <Textarea id="reason-for-credit"
                value={requestForm.reason}
                onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                placeholder="Explain why you believe you have a credit..."
                rows={3}
                required
              />
            </div>
            <div>
              <Label htmlFor="additional-details">Additional Details</Label>
              <Textarea id="additional-details"
                value={requestForm.details}
                onChange={(e) => setRequestForm({ ...requestForm, details: e.target.value })}
                placeholder="Reference numbers, dates, etc..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowRequestModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#d4a574] hover:bg-[#c49464]">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
