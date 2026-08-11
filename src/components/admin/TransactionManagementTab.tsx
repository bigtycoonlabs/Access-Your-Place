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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Building2, MapPin, DollarSign, Phone, Mail, User, 
  CheckCircle, XCircle, Clock, AlertCircle, Shield, FileText,
  Eye, ChevronRight, Calendar, Users, Handshake, Key, Lock,
  CreditCard, RefreshCw, Send, FileCheck
} from 'lucide-react';

interface Transaction {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  sale_price: number;
  ayp_fee: number;
  managed_by_ayp: boolean;
  success_manager_id?: string;
  success_manager_assigned_at?: string;
  status: string;
  payment_intent_id?: string;
  payment_received_at?: string;
  documents_pending_at?: string;
  documents_signed_at?: string;
  access_transferred_at?: string;
  funds_released_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  refunded_at?: string;
  refund_reason?: string;
  inventory_list?: any;
  access_details?: any;
  created_at: string;
  listing?: {
    acquisition_fee: number;
    monthly_revenue: number;
    property?: {
      address: string;
      city: string;
      state: string;
      bedrooms: number;
      bathrooms: number;
    };
  };
  buyer?: {
    full_name: string;
    email: string;
    phone?: string;
  };
  seller?: {
    full_name: string;
    email: string;
    phone?: string;
  };
  success_manager?: {
    name: string;
    email: string;
    phone?: string;
  };
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

export function TransactionManagementTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [assignManagerOpen, setAssignManagerOpen] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    loadTransactions();
    loadStaffMembers();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: { action: 'get_transactions' }
      });
      if (data?.transactions) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
    setLoading(false);
  };

  const loadStaffMembers = async () => {
    try {
      // For now, use mock staff members - in production, fetch from staff_members table
      setStaffMembers([
        { id: '1', name: 'Sarah Johnson', email: 'sarah@accessyourplace.com', phone: '(555) 123-4567', role: 'success_manager' },
        { id: '2', name: 'Michael Chen', email: 'michael@accessyourplace.com', phone: '(555) 234-5678', role: 'success_manager' },
        { id: '3', name: 'Emily Rodriguez', email: 'emily@accessyourplace.com', phone: '(555) 345-6789', role: 'success_manager' }
      ]);
    } catch (err) {
      console.error('Failed to load staff:', err);
    }
  };

  const handleAssignManager = async () => {
    if (!selectedTransaction || !selectedManagerId) return;
    
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'assign_success_manager',
          transaction_id: selectedTransaction.id,
          success_manager_id: selectedManagerId
        }
      });

      if (data?.success) {
        toast({
          title: 'Success Manager Assigned',
          description: 'Both buyer and seller have been notified.'
        });
        loadTransactions();
        setAssignManagerOpen(false);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to assign manager',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  const handleUpdateStatus = async (transactionId: string, newStatus: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'update_transaction_status',
          transaction_id: transactionId,
          status: newStatus
        }
      });

      if (data?.success) {
        toast({
          title: 'Status Updated',
          description: 'Transaction status has been updated and parties notified.'
        });
        loadTransactions();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  const handleReleaseFunds = async (transactionId: string) => {
    if (!confirm('Are you sure you want to release funds to the seller? This action cannot be undone.')) return;
    
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'release_funds',
          transaction_id: transactionId
        }
      });

      if (data?.success) {
        toast({
          title: 'Funds Released',
          description: `$${data.amount_released?.toLocaleString()} has been released to the seller.`
        });
        loadTransactions();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to release funds',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  const handleRefund = async (transactionId: string, reason: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-payments', {
        body: {
          action: 'refund_escrow',
          transaction_id: transactionId,
          reason
        }
      });

      if (data?.success) {
        await handleUpdateStatus(transactionId, 'refunded');
        toast({
          title: 'Refund Processed',
          description: 'Funds have been returned to the buyer.'
        });
        loadTransactions();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to process refund',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending_payment: 'bg-yellow-100 text-yellow-800',
      payment_received: 'bg-blue-100 text-blue-800',
      documents_pending: 'bg-purple-100 text-purple-800',
      documents_signed: 'bg-indigo-100 text-indigo-800',
      access_transferred: 'bg-cyan-100 text-cyan-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      refunded: 'bg-orange-100 text-orange-800'
    };

    const labels: Record<string, string> = {
      pending_payment: 'Pending Payment',
      payment_received: 'Payment Received',
      documents_pending: 'Documents Pending',
      documents_signed: 'Documents Signed',
      access_transferred: 'Access Transferred',
      completed: 'Completed',
      cancelled: 'Cancelled',
      refunded: 'Refunded'
    };

    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const filteredTransactions = transactions.filter(t => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return !['completed', 'cancelled', 'refunded'].includes(t.status);
    if (activeFilter === 'needs_manager') return !t.success_manager_id && t.status !== 'pending_payment';
    return t.status === activeFilter;
  });

  const stats = {
    total: transactions.length,
    active: transactions.filter(t => !['completed', 'cancelled', 'refunded'].includes(t.status)).length,
    needsManager: transactions.filter(t => !t.success_manager_id && t.status !== 'pending_payment').length,
    completed: transactions.filter(t => t.status === 'completed').length,
    totalVolume: transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.sale_price, 0),
    totalFees: transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.ayp_fee, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-[#1a365d]">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.active}</p>
            <p className="text-sm text-gray-500">Active</p>
          </CardContent>
        </Card>
        <Card className={stats.needsManager > 0 ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{stats.needsManager}</p>
            <p className="text-sm text-gray-500">Needs Manager</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-green-600">${(stats.totalVolume / 1000).toFixed(0)}K</p>
            <p className="text-sm text-gray-500">Total Volume</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-[#d4a574]">${(stats.totalFees / 1000).toFixed(0)}K</p>
            <p className="text-sm text-gray-500">Total Fees</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'needs_manager', label: 'Needs Manager' },
          { key: 'payment_received', label: 'Payment Received' },
          { key: 'documents_pending', label: 'Documents Pending' },
          { key: 'completed', label: 'Completed' }
        ].map(filter => (
          <Button
            key={filter.key}
            variant={activeFilter === filter.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(filter.key)}
            className={activeFilter === filter.key ? 'bg-[#1a365d]' : ''}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="space-y-4">
        {filteredTransactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Handshake className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No transactions found</p>
            </CardContent>
          </Card>
        ) : (
          filteredTransactions.map(transaction => (
            <Card key={transaction.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusBadge(transaction.status)}
                      {!transaction.success_manager_id && transaction.status !== 'pending_payment' && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Needs Manager
                        </Badge>
                      )}
                    </div>
                    
                    <h4 className="font-semibold text-lg">
                      {transaction.listing?.property?.address || 
                       `${transaction.listing?.property?.city}, ${transaction.listing?.property?.state}`}
                    </h4>
                    
                    <div className="grid md:grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-gray-500">Buyer</p>
                        <p className="font-medium">{transaction.buyer?.full_name}</p>
                        <p className="text-gray-500 text-xs">{transaction.buyer?.email}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Seller</p>
                        <p className="font-medium">{transaction.seller?.full_name}</p>
                        <p className="text-gray-500 text-xs">{transaction.seller?.email}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Sale Price</p>
                        <p className="font-semibold text-[#1a365d]">${transaction.sale_price.toLocaleString()}</p>
                        <p className="text-xs text-[#d4a574]">Fee: ${transaction.ayp_fee.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Success Manager</p>
                        {transaction.success_manager ? (
                          <p className="font-medium">{transaction.success_manager.name}</p>
                        ) : (
                          <p className="text-amber-600">Not assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {!transaction.success_manager_id && transaction.status !== 'pending_payment' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setAssignManagerOpen(true);
                        }}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Assign
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTransaction(transaction);
                        setDetailModalOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Manage
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Assign Manager Modal */}
      <Dialog open={assignManagerOpen} onOpenChange={setAssignManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Success Manager</DialogTitle>
            <DialogDescription>
              Select a success manager to oversee this transaction.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Select Manager</Label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a success manager" />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.filter(s => s.role === 'success_manager').map(staff => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name} - {staff.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedManagerId && (
              <Card className="bg-blue-50">
                <CardContent className="pt-4">
                  <p className="text-sm text-blue-800">
                    Both the buyer and seller will be notified via email and SMS that 
                    {' '}{staffMembers.find(s => s.id === selectedManagerId)?.name}{' '}
                    has been assigned to their transaction.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignManagerOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignManager}
              disabled={!selectedManagerId || processing}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign Manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transaction Management</DialogTitle>
              <DialogDescription>
                {selectedTransaction.listing?.property?.address || 
                 `${selectedTransaction.listing?.property?.city}, ${selectedTransaction.listing?.property?.state}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Status Progress */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-semibold mb-4">Transaction Progress</h4>
                  <div className="flex justify-between">
                    {[
                      { key: 'pending_payment', label: 'Payment', icon: CreditCard },
                      { key: 'payment_received', label: 'Escrow', icon: Lock },
                      { key: 'documents_pending', label: 'Documents', icon: FileText },
                      { key: 'documents_signed', label: 'Signed', icon: FileCheck },
                      { key: 'access_transferred', label: 'Access', icon: Key },
                      { key: 'completed', label: 'Complete', icon: CheckCircle }
                    ].map((stage, index) => {
                      const stages = ['pending_payment', 'payment_received', 'documents_pending', 'documents_signed', 'access_transferred', 'completed'];
                      const currentIndex = stages.indexOf(selectedTransaction.status);
                      const isComplete = index < currentIndex;
                      const isCurrent = index === currentIndex;
                      const StageIcon = stage.icon;

                      return (
                        <div key={stage.key} className="flex flex-col items-center">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center
                            ${isComplete ? 'bg-green-500 text-white' : 
                              isCurrent ? 'bg-[#d4a574] text-white' : 
                              'bg-gray-200 text-gray-400'}
                          `}>
                            <StageIcon className="w-5 h-5" />
                          </div>
                          <span className={`text-xs mt-1 ${isCurrent ? 'font-semibold' : ''}`}>
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Parties */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Buyer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-semibold">{selectedTransaction.buyer?.full_name}</p>
                    <p className="text-sm text-gray-500">{selectedTransaction.buyer?.email}</p>
                    {selectedTransaction.buyer?.phone && (
                      <p className="text-sm text-gray-500">{selectedTransaction.buyer?.phone}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Seller</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-semibold">{selectedTransaction.seller?.full_name}</p>
                    <p className="text-sm text-gray-500">{selectedTransaction.seller?.email}</p>
                    {selectedTransaction.seller?.phone && (
                      <p className="text-sm text-gray-500">{selectedTransaction.seller?.phone}</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Financial Summary */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-semibold mb-3">Financial Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Sale Price:</span>
                      <span className="font-semibold">${selectedTransaction.sale_price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>AYP Fee (20%):</span>
                      <span>${selectedTransaction.ayp_fee.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Seller Receives:</span>
                      <span className="text-green-600">
                        ${(selectedTransaction.sale_price - selectedTransaction.ayp_fee).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Success Manager */}
              {selectedTransaction.success_manager && (
                <Card className="bg-blue-50">
                  <CardContent className="pt-4">
                    <h4 className="font-semibold mb-2">Success Manager</h4>
                    <p className="font-medium">{selectedTransaction.success_manager.name}</p>
                    <p className="text-sm text-gray-600">{selectedTransaction.success_manager.email}</p>
                    {selectedTransaction.success_manager.phone && (
                      <p className="text-sm text-gray-600">{selectedTransaction.success_manager.phone}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-semibold mb-3">Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTransaction.status === 'payment_received' && (
                      <Button
                        onClick={() => handleUpdateStatus(selectedTransaction.id, 'documents_pending')}
                        disabled={processing}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Send Documents
                      </Button>
                    )}
                    
                    {selectedTransaction.status === 'documents_pending' && (
                      <Button
                        onClick={() => handleUpdateStatus(selectedTransaction.id, 'documents_signed')}
                        disabled={processing}
                      >
                        <FileCheck className="w-4 h-4 mr-2" />
                        Mark Documents Signed
                      </Button>
                    )}
                    
                    {selectedTransaction.status === 'documents_signed' && (
                      <Button
                        onClick={() => handleUpdateStatus(selectedTransaction.id, 'access_transferred')}
                        disabled={processing}
                      >
                        <Key className="w-4 h-4 mr-2" />
                        Confirm Access Transfer
                      </Button>
                    )}
                    
                    {selectedTransaction.status === 'access_transferred' && (
                      <Button
                        onClick={() => handleReleaseFunds(selectedTransaction.id)}
                        disabled={processing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Release Funds to Seller
                      </Button>
                    )}
                    
                    {!['completed', 'cancelled', 'refunded'].includes(selectedTransaction.status) && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          const reason = prompt('Enter reason for refund:');
                          if (reason) handleRefund(selectedTransaction.id, reason);
                        }}
                        disabled={processing}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refund to Buyer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Checklist */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-semibold mb-3">Transaction Checklist</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Payment received', done: ['payment_received', 'documents_pending', 'documents_signed', 'access_transferred', 'completed'].includes(selectedTransaction.status) },
                      { label: 'Success Manager assigned', done: !!selectedTransaction.success_manager_id },
                      { label: 'Acquisition agreement sent', done: ['documents_pending', 'documents_signed', 'access_transferred', 'completed'].includes(selectedTransaction.status) },
                      { label: 'Lease transfer documents sent', done: ['documents_pending', 'documents_signed', 'access_transferred', 'completed'].includes(selectedTransaction.status) },
                      { label: 'All documents signed', done: ['documents_signed', 'access_transferred', 'completed'].includes(selectedTransaction.status) },
                      { label: 'Smart lock access transferred', done: ['access_transferred', 'completed'].includes(selectedTransaction.status) },
                      { label: 'Inventory list verified', done: selectedTransaction.status === 'completed' },
                      { label: 'Funds released to seller', done: selectedTransaction.status === 'completed' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {item.done ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                        )}
                        <span className={item.done ? 'text-gray-600' : 'text-gray-400'}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
