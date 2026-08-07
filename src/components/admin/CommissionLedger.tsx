
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DollarSign, Clock, CheckCircle, AlertTriangle, Search, Plus,
  ArrowUpRight, ArrowDownRight, Loader2, Filter, FileText
} from 'lucide-react';

interface Commission {
  id: string;
  staff_id: string;
  staff_name: string;
  client_name: string;
  property_address: string;
  deal_type: string;
  claimed_amount: number;
  approved_amount: number | null;
  status: string;
  payout_date: string | null;
  notes: string | null;
  admin_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface CommissionStats {
  total_pending: number;
  total_approved: number;
  total_paid: number;
  total_disputed: number;
  this_week_earned: number;
  this_month_earned: number;
  pending_count: number;
  approved_count: number;
  paid_count: number;
}

interface CommissionLedgerProps {
  staffId: string;
  staffName: string;
  isAdmin: boolean;
}

const DEAL_TYPES = [
  { value: 'finder', label: 'Finder Fee' },
  { value: 'closer', label: 'Closer Fee' },
  { value: 'full_cycle', label: 'Full Cycle' },
  { value: 'setup', label: 'Setup Commission' },
  { value: 'referral', label: 'Referral Bonus' },
  { value: 'bonus', label: 'Performance Bonus' },
];

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending', icon: Clock },
  approved: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Approved', icon: CheckCircle },
  paid: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Paid', icon: DollarSign },
  disputed: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Disputed', icon: AlertTriangle },
  rejected: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Rejected', icon: AlertTriangle },
};

export function CommissionLedger({ staffId, staffName, isAdmin }: CommissionLedgerProps) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    client_name: '', property_address: '', deal_type: 'finder', claimed_amount: '', notes: ''
  });
  const [reviewData, setReviewData] = useState({ status: '', admin_comment: '', approved_amount: '' });
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [commRes, statsRes] = await Promise.all([
      supabase.functions.invoke('manage-hr-commissions', {
        body: { action: 'get_commissions', staff_id: staffId, status: filterStatus, is_admin: isAdmin }
      }),
      supabase.functions.invoke('manage-hr-commissions', {
        body: { action: 'get_commission_stats', staff_id: staffId, is_admin: isAdmin }
      })
    ]);
    if (commRes.data?.commissions) setCommissions(commRes.data.commissions);
    if (statsRes.data?.stats) setStats(statsRes.data.stats);
    setLoading(false);
  }, [staffId, isAdmin, filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitRequest = async () => {
    if (!formData.client_name || !formData.property_address || !formData.claimed_amount) {
      toast({ title: 'Missing Fields', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'submit_commission', staff_id: staffId, staff_name: staffName, ...formData }
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Commission Request Submitted', description: 'Your request is pending review.' });
      setShowRequestForm(false);
      setFormData({ client_name: '', property_address: '', deal_type: 'finder', claimed_amount: '', notes: '' });
      loadData();
    }
    setSubmitting(false);
  };

  const handleReview = async () => {
    if (!selectedCommission || !reviewData.status) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: {
        action: 'update_commission_status',
        staff_id: staffId,
        is_admin: isAdmin,
        commission_id: selectedCommission.id,
        status: reviewData.status,
        admin_comment: reviewData.admin_comment,
        reviewed_by: staffName,
        approved_amount: reviewData.approved_amount || undefined
      }
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Commission Updated' });
      setShowReviewModal(false);
      setSelectedCommission(null);
      loadData();
    }
    setSubmitting(false);
  };

  // Client-side safety filter: when not admin (e.g. AM), only show own commissions
  // even if the edge function returns records for other staff (defense-in-depth)
  const ownRecords = !isAdmin 
    ? commissions.filter(c => c.staff_id === staffId) 
    : commissions;

  const filtered = ownRecords.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.client_name.toLowerCase().includes(q) || c.property_address.toLowerCase().includes(q) || c.staff_name.toLowerCase().includes(q);
    }
    return true;
  });


  const upcomingPayouts = filtered.filter(c => c.status === 'approved');

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-yellow-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
                  <p className="text-2xl font-bold text-yellow-700">${stats.total_pending.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{stats.pending_count} requests</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Approved</p>
                  <p className="text-2xl font-bold text-blue-700">${stats.total_approved.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{stats.approved_count} ready</p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Paid</p>
                  <p className="text-2xl font-bold text-emerald-700">${stats.total_paid.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{stats.paid_count} payouts</p>
                </div>
                <DollarSign className="w-8 h-8 text-emerald-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">This Month</p>
                  <p className="text-2xl font-bold text-purple-700">${stats.this_month_earned.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">${stats.this_week_earned.toLocaleString()} this week</p>
                </div>
                <ArrowUpRight className="w-8 h-8 text-purple-300" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upcoming Payouts */}
      {upcomingPayouts.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-blue-600" />
              Upcoming Payouts (Next Friday)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingPayouts.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{c.client_name}</p>
                    <p className="text-xs text-gray-500">{c.property_address}</p>
                  </div>
                  <p className="font-bold text-blue-700">${(c.approved_amount || c.claimed_amount).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input aria-label="Search commissions"
              placeholder="Search commissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <Filter className="w-4 h-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowRequestForm(true)} className="bg-[#1a365d]">
          <Plus className="w-4 h-4 mr-2" /> New Commission Request
        </Button>
      </div>

      {/* Commission Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No commissions found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-600">Staff</th>}
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Property</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    {isAdmin && <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(c => {
                    const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        {isAdmin && <td className="px-4 py-3 font-medium">{c.staff_name}</td>}
                        <td className="px-4 py-3 font-medium">{c.client_name}</td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-[200px] truncate">{c.property_address}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs capitalize">{c.deal_type.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          ${(c.approved_amount || c.claimed_amount).toLocaleString()}
                          {c.approved_amount && c.approved_amount !== c.claimed_amount && (
                            <span className="block text-xs text-gray-400 line-through">${c.claimed_amount.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`${statusCfg.color} border text-xs`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-center">
                            {(c.status === 'pending' || c.status === 'disputed') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCommission(c);
                                  setReviewData({ status: '', admin_comment: '', approved_amount: c.claimed_amount.toString() });
                                  setShowReviewModal(true);
                                }}
                              >
                                Review
                              </Button>
                            )}
                            {c.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 border-emerald-200"
                                onClick={async () => {
                                  await supabase.functions.invoke('manage-hr-commissions', {
                                    body: { action: 'update_commission_status', staff_id: staffId, is_admin: isAdmin, commission_id: c.id, status: 'paid', reviewed_by: staffName }
                                  });
                                  toast({ title: 'Marked as Paid' });
                                  loadData();
                                }}
                              >
                                Mark Paid
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Commission Request Dialog */}
      <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
        <DialogContent className="max-w-lg" aria-describedby="commission-request-desc">
          <DialogHeader>
            <DialogTitle>New Commission Request</DialogTitle>
            <DialogDescription id="commission-request-desc">Submit a commission for review by the Success Team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="client-name">Client Name *</Label>
              <Input id="client-name" value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} placeholder="Client full name" />
            </div>
            <div>
              <Label htmlFor="property-address">Property Address *</Label>
              <Input id="property-address" value={formData.property_address} onChange={(e) => setFormData({ ...formData, property_address: e.target.value })} placeholder="Full property address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Deal Type</Label>
                <Select value={formData.deal_type} onValueChange={(v) => setFormData({ ...formData, deal_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEAL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="claimed-amount">Claimed Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input id="claimed-amount"
                    type="number"
                    step="0.01"
                    className="pl-8"
                    value={formData.claimed_amount}
                    onChange={(e) => setFormData({ ...formData, claimed_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional details about this commission..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestForm(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} disabled={submitting} className="bg-[#1a365d]">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Review Dialog */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-lg" aria-describedby="review-commission-desc">
          <DialogHeader>
            <DialogTitle>Review Commission</DialogTitle>
            <DialogDescription id="review-commission-desc">
              {selectedCommission?.staff_name} - {selectedCommission?.client_name}
            </DialogDescription>
          </DialogHeader>
          {selectedCommission && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <p><span className="font-medium">Property:</span> {selectedCommission.property_address}</p>
                <p><span className="font-medium">Deal Type:</span> {selectedCommission.deal_type.replace('_', ' ')}</p>
                <p><span className="font-medium">Claimed:</span> ${selectedCommission.claimed_amount.toLocaleString()}</p>
                {selectedCommission.notes && <p><span className="font-medium">Notes:</span> {selectedCommission.notes}</p>}
              </div>
              <div>
                <Label>Decision</Label>
                <Select value={reviewData.status} onValueChange={(v) => setReviewData({ ...reviewData, status: v })}>
                  <SelectTrigger><SelectValue placeholder="Select action..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve (Ready for Payout)</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                    <SelectItem value="disputed">Flag as Disputed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {reviewData.status === 'approved' && (
                <div>
                  <Label htmlFor="approved-amount">Approved Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input id="approved-amount"
                      type="number"
                      step="0.01"
                      className="pl-8"
                      value={reviewData.approved_amount}
                      onChange={(e) => setReviewData({ ...reviewData, approved_amount: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="comment">Comment</Label>
                <Textarea id="comment"
                  value={reviewData.admin_comment}
                  onChange={(e) => setReviewData({ ...reviewData, admin_comment: e.target.value })}
                  placeholder="Reason for decision..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>Cancel</Button>
            <Button onClick={handleReview} disabled={submitting || !reviewData.status} className="bg-[#1a365d]">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
