import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Loader2, CheckCircle, XCircle, Clock, Search, User, Mail, 
  DollarSign, Calendar, Image, ExternalLink, Banknote, AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface PendingPayment {
  id: string;
  investor_id: string;
  property_id: string;
  payment_method: 'zelle' | 'wire';
  amount: number;
  status: string;
  proof_url: string;
  created_at: string;
  investor?: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

interface Props {
  staffId: string;
  staffName: string;
}

export function ManualPaymentApprovalTab({ staffId, staffName }: Props) {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Proof viewer
  const [proofViewerOpen, setProofViewerOpen] = useState(false);
  const [viewingProofUrl, setViewingProofUrl] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-acquisition-payment', {
        body: { action: 'get_pending_payments' }
      });

      if (error) throw error;
      setPayments(data?.payments || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
      toast({ title: 'Error', description: 'Failed to load pending payments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payment: PendingPayment) => {
    setProcessing(payment.id);
    try {
      const { data, error } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'approve_manual_payment',
          payment_id: payment.id,
          staff_id: staffId,
          staff_name: staffName
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to approve payment');
      }

      toast({ 
        title: 'Payment Approved!', 
        description: `Payment from ${payment.investor?.full_name || 'Investor'} has been approved. Property details released.`
      });
      loadPayments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment) return;

    setProcessing(selectedPayment.id);
    try {
      const { data, error } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'reject_manual_payment',
          payment_id: selectedPayment.id,
          rejection_reason: rejectionReason || 'Payment could not be verified',
          staff_id: staffId
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to reject payment');
      }

      toast({ 
        title: 'Payment Rejected', 
        description: 'Investor has been notified to resubmit.'
      });
      setRejectModalOpen(false);
      setSelectedPayment(null);
      setRejectionReason('');
      loadPayments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const viewProof = (proofUrl: string) => {
    // Get signed URL from storage
    const fullUrl = `${supabase.storage.from('investor-documents').getPublicUrl(proofUrl).data.publicUrl}`;
    setViewingProofUrl(fullUrl);
    setProofViewerOpen(true);
  };

  const filteredPayments = payments.filter(p =>
    p.investor?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.investor?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1a365d]" />
          <p className="mt-2 text-gray-500">Loading pending payments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{payments.length}</p>
                <p className="text-sm text-amber-600">Pending Verification</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                <Banknote className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">
                  {payments.filter(p => p.payment_method === 'zelle').length}
                </p>
                <p className="text-sm text-purple-600">Zelle Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Banknote className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">
                  {payments.filter(p => p.payment_method === 'wire').length}
                </p>
                <p className="text-sm text-blue-600">Wire Transfers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Refresh */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by investor name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={loadPayments}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#d4a574]" />
            Pending Payment Verifications
          </CardTitle>
          <CardDescription>
            Review and approve Zelle/Wire transfer proof submissions from investors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">All caught up!</p>
              <p className="text-sm text-gray-500">No pending payment verifications</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Investor Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">{payment.investor?.full_name || 'Unknown Investor'}</span>
                        <Badge className={payment.payment_method === 'zelle' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                          {payment.payment_method.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {payment.investor?.email || 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(payment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Amount</p>
                      <p className="text-2xl font-bold text-green-600">${payment.amount.toFixed(2)}</p>
                    </div>

                    {/* Proof & Actions */}
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => viewProof(payment.proof_url)}
                      >
                        <Image className="w-4 h-4 mr-2" />
                        View Proof
                      </Button>
                      <Button
                        onClick={() => handleApprove(payment)}
                        disabled={processing === payment.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {processing === payment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          setSelectedPayment(payment);
                          setRejectModalOpen(true);
                        }}
                        disabled={processing === payment.id}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proof Viewer Modal */}
      <Dialog open={proofViewerOpen} onOpenChange={setProofViewerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {viewingProofUrl && (
              <img 
                src={viewingProofUrl} 
                alt="Payment proof" 
                className="w-full max-h-[70vh] object-contain rounded-lg border"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setProofViewerOpen(false)}>
              Close
            </Button>
            <Button onClick={() => window.open(viewingProofUrl, '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Full Size
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Reject Payment
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this payment. The investor will be notified.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Payment amount doesn't match, unable to verify transaction, etc."
                rows={3}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRejectModalOpen(false);
              setSelectedPayment(null);
              setRejectionReason('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={processing === selectedPayment?.id}
              className="bg-red-600 hover:bg-red-700"
            >
              {processing === selectedPayment?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Reject Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
