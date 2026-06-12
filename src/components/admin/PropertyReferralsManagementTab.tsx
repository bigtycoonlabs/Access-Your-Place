import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { notifyInvestorAboutUpdate } from '@/utils/notifyAM';
import {
  Loader2, Search, Filter, Building2, MapPin, Phone, Mail, DollarSign,
  CheckCircle, XCircle, Clock, UserCheck, FileText, AlertTriangle,
  Eye, ArrowRight, RefreshCw, Users, Banknote, Target
} from 'lucide-react';


interface Props {
  staffId: string;
  staffName: string;
}

interface PropertyReferral {
  id: string;
  referrer_id: string;
  referrer_name?: string;
  referral_type: string;
  status: string;
  property_address: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  landlord_name?: string;
  landlord_phone?: string;
  landlord_email?: string;
  projected_revenue?: number;
  average_daily_rate?: number;
  projected_monthly_room_rent?: number;
  property_rent?: number;
  deposit_amount?: number;
  special_negotiations?: string;
  assigned_am_id?: string;
  assigned_am_name?: string;
  am_notes?: string;
  rejection_reason?: string;
  payout_amount?: number;
  payout_status?: string;
  payout_date?: string;
  created_at: string;
  updated_at?: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'am_outreach', label: 'AM Outreach' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'published', label: 'Published' },
  { value: 'approved_payout', label: 'Payout Approved' },
  { value: 'paid_out', label: 'Paid Out' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending_review: { label: 'Pending Review', className: 'bg-yellow-500' },
  under_review: { label: 'Under Review', className: 'bg-blue-500' },
  am_outreach: { label: 'AM Outreach', className: 'bg-indigo-500' },
  finalized: { label: 'Finalized', className: 'bg-emerald-500' },
  published: { label: 'Published', className: 'bg-green-600' },
  approved_payout: { label: 'Payout Approved', className: 'bg-[#d4a574]' },
  paid_out: { label: 'Paid Out', className: 'bg-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-500' },
};

export function PropertyReferralsManagementTab({ staffId, staffName }: Props) {
  const [referrals, setReferrals] = useState<PropertyReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReferral, setSelectedReferral] = useState<PropertyReferral | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [amName, setAmName] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const { toast } = useToast();

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-property-referrals', {
        body: { action: 'get_all_referrals', status_filter: statusFilter }
      });
      if (error) throw error;
      setReferrals(data?.referrals || []);
    } catch (err: any) {
      console.error('Error loading referrals:', err);
      toast({ title: 'Error', description: 'Failed to load property referrals', variant: 'destructive' });
    }
    setLoading(false);
  }, [statusFilter, toast]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  const handleStatusUpdate = async (referralId: string, newStatus: string, extraData: Record<string, any> = {}) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-property-referrals', {
        body: {
          action: 'update_referral_status',
          referral_id: referralId,
          status: newStatus,
          ...extraData
        }
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Status Updated', description: `Referral moved to ${STATUS_BADGE[newStatus]?.label || newStatus}` });

        // Send investor notification about the status change
        if (selectedReferral?.referrer_id) {
          const statusLabel = STATUS_BADGE[newStatus]?.label || newStatus;
          const addr = selectedReferral.property_address || 'your property referral';
          
          let notifTitle = `Property Referral Update — ${addr}`;
          let notifMessage = `Your property referral for ${addr} has been updated to: ${statusLabel}.`;
          
          if (newStatus === 'under_review') {
            notifMessage = `Great news! Your property referral for ${addr} is now under review by our team.`;
          } else if (newStatus === 'am_outreach') {
            notifMessage = `Your property referral for ${addr} has been assigned to an Acquisition Manager who will begin landlord outreach.`;
          } else if (newStatus === 'finalized') {
            notifMessage = `Your property referral for ${addr} has been finalized. The deal is being prepared for publication.`;
          } else if (newStatus === 'published') {
            notifMessage = `Your property referral for ${addr} has been published on the AYP marketplace! Your commission will be processed once the deal closes.`;
          } else if (newStatus === 'approved_payout') {
            const amt = extraData.payout_amount ? `$${extraData.payout_amount.toLocaleString()}` : '';
            notifMessage = `Your payout ${amt ? `of ${amt} ` : ''}for the property referral at ${addr} has been approved! Payment will be processed within 14 days.`;
            notifTitle = `Payout Approved — ${addr}`;
          } else if (newStatus === 'paid_out') {
            notifMessage = `Your referral commission for ${addr} has been paid out. Thank you for your referral!`;
            notifTitle = `Referral Payout Complete — ${addr}`;
          } else if (newStatus === 'rejected') {
            notifMessage = `Your property referral for ${addr} was not approved. Reason: ${extraData.rejection_reason || 'Does not meet current criteria'}. You can submit a new referral with updated information.`;
            notifTitle = `Property Referral Update — ${addr}`;
          }

          // Fire and forget - don't block the UI
          notifyInvestorAboutUpdate(
            selectedReferral.referrer_id,
            'property_referral_update',
            notifTitle,
            notifMessage
          ).catch(err => console.warn('[PropertyReferrals] Investor notification failed:', err));
        }

        setDetailOpen(false);
        setActionType(null);
        setActionNotes('');
        setAmName('');
        setPayoutAmount('');
        setRejectionReason('');
        loadReferrals();
      } else {
        throw new Error(data?.error || 'Failed to update');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };


  const openDetail = (referral: PropertyReferral) => {
    setSelectedReferral(referral);
    setAmName(referral.assigned_am_name || '');
    setActionNotes(referral.am_notes || '');
    setPayoutAmount(referral.payout_amount?.toString() || '');
    setDetailOpen(true);
    setActionType(null);
  };

  const filteredReferrals = referrals.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.property_address?.toLowerCase().includes(term) ||
      r.referrer_name?.toLowerCase().includes(term) ||
      r.landlord_name?.toLowerCase().includes(term) ||
      r.property_city?.toLowerCase().includes(term) ||
      r.property_state?.toLowerCase().includes(term)
    );
  });

  const stats = {
    total: referrals.length,
    pending: referrals.filter(r => r.status === 'pending_review').length,
    inProgress: referrals.filter(r => ['under_review', 'am_outreach'].includes(r.status)).length,
    finalized: referrals.filter(r => ['finalized', 'published'].includes(r.status)).length,
    pendingPayout: referrals.filter(r => r.status === 'approved_payout').length,
    paidOut: referrals.filter(r => r.status === 'paid_out').length,
    rejected: referrals.filter(r => r.status === 'rejected').length,
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'In Progress', value: stats.inProgress, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Finalized', value: stats.finalized, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Payout Pending', value: stats.pendingPayout, icon: DollarSign, color: 'text-[#d4a574]', bg: 'bg-[#d4a574]/10' },
          { label: 'Paid Out', value: stats.paidOut, icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Property Referrals</CardTitle>
              <CardDescription>Review and manage property referrals submitted by investors</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadReferrals}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by address, referrer, landlord, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredReferrals.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-gray-200 mb-4" />
              <p className="text-muted-foreground">No property referrals found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Referrer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Landlord</TableHead>
                    <TableHead>Financials</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AM</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map(referral => {
                    const badge = STATUS_BADGE[referral.status] || { label: referral.status, className: 'bg-gray-500' };
                    return (
                      <TableRow key={referral.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(referral)}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{referral.property_address}</p>
                            {(referral.property_city || referral.property_state) && (
                              <p className="text-xs text-muted-foreground">{referral.property_city}{referral.property_state ? `, ${referral.property_state}` : ''}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{referral.referrer_name || 'Unknown'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {referral.referral_type === 'furnished_property' ? 'Furnished' : 'Empty'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{referral.landlord_name || '-'}</p>
                            {referral.landlord_phone && <p className="text-xs text-muted-foreground">{referral.landlord_phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            {referral.projected_revenue && <p>Rev: ${referral.projected_revenue.toLocaleString()}/mo</p>}
                            {referral.property_rent && <p>Rent: ${referral.property_rent.toLocaleString()}/mo</p>}
                            {referral.average_daily_rate && <p>ADR: ${referral.average_daily_rate}</p>}
                          </div>
                        </TableCell>
                        <TableCell><Badge className={badge.className}>{badge.label}</Badge></TableCell>
                        <TableCell>
                          <p className="text-sm">{referral.assigned_am_name || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground">{new Date(referral.created_at).toLocaleDateString()}</p>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openDetail(referral); }}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail / Action Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedReferral && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" /> Property Referral Details
                </DialogTitle>
                <DialogDescription>
                  Submitted by {selectedReferral.referrer_name} on {new Date(selectedReferral.created_at).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* Status */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Current Status:</span>
                  <Badge className={STATUS_BADGE[selectedReferral.status]?.className || 'bg-gray-500'}>
                    {STATUS_BADGE[selectedReferral.status]?.label || selectedReferral.status}
                  </Badge>
                </div>

                {/* Property Info */}
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Property Information</h4>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Address:</span> <span className="font-medium">{selectedReferral.property_address}</span></div>
                      <div><span className="text-muted-foreground">City/State:</span> <span className="font-medium">{selectedReferral.property_city || '-'}, {selectedReferral.property_state || '-'} {selectedReferral.property_zip || ''}</span></div>
                      <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{selectedReferral.referral_type === 'furnished_property' ? 'Furnished Property' : 'Empty Property'}</span></div>
                    </div>
                  </CardContent>
                </Card>

                {/* Landlord Contact */}
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Landlord Contact</h4>
                    <div className="grid md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedReferral.landlord_name || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedReferral.landlord_phone || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedReferral.landlord_email || 'Not provided'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Projections */}
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Financial Projections</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { label: 'Projected Revenue', value: selectedReferral.projected_revenue, prefix: '$', suffix: '/mo' },
                        { label: 'Average Daily Rate', value: selectedReferral.average_daily_rate, prefix: '$' },
                        { label: 'Monthly Room Rent', value: selectedReferral.projected_monthly_room_rent, prefix: '$', suffix: '/mo' },
                        { label: 'Property Rent', value: selectedReferral.property_rent, prefix: '$', suffix: '/mo' },
                        { label: 'Deposit Amount', value: selectedReferral.deposit_amount, prefix: '$' },
                      ].map((item, i) => (
                        <div key={i} className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="font-bold">
                            {item.value ? `${item.prefix}${item.value.toLocaleString()}${item.suffix || ''}` : '-'}
                          </p>
                        </div>
                      ))}
                    </div>
                    {selectedReferral.special_negotiations && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs font-medium text-blue-700">Special Negotiations / Notes:</p>
                        <p className="text-sm text-blue-600 mt-1">{selectedReferral.special_negotiations}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AM Assignment & Notes */}
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2"><Target className="w-4 h-4" /> Acquisition Manager & Notes</h4>
                    <div className="space-y-3">
                      <div>
                        <Label>Assigned AM</Label>
                        <Input
                          value={amName}
                          onChange={(e) => setAmName(e.target.value)}
                          placeholder="Enter AM name..."
                        />
                      </div>
                      <div>
                        <Label>AM Notes</Label>
                        <Textarea
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                          placeholder="Add notes about landlord outreach, negotiations, etc."
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label>Payout Amount ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={payoutAmount}
                          onChange={(e) => setPayoutAmount(e.target.value)}
                          placeholder="Commission amount for referral partner"
                        />
                        <p className="text-xs text-muted-foreground mt-1">20% of the Acquisition Fee for property referrals</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleStatusUpdate(selectedReferral.id, selectedReferral.status, {
                          assigned_am_name: amName || undefined,
                          am_notes: actionNotes || undefined,
                          payout_amount: payoutAmount ? parseFloat(payoutAmount) : undefined,
                        })}
                        disabled={processing}
                      >
                        {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Notes & Assignment
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Rejection reason display */}
                {selectedReferral.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700"><strong>Rejection Reason:</strong> {selectedReferral.rejection_reason}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <Card className="border-[#d4a574]/30">
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3">Status Actions</h4>

                    {actionType === 'reject' ? (
                      <div className="space-y-3">
                        <Label>Rejection Reason *</Label>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Explain why this referral is being rejected..."
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleStatusUpdate(selectedReferral.id, 'rejected', {
                              rejection_reason: rejectionReason,
                              am_notes: actionNotes || undefined,
                            })}
                            disabled={processing || !rejectionReason}
                          >
                            {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirm Rejection
                          </Button>
                        </div>
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> This will increment the referrer's strike count (Four Strikes Rule).
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedReferral.status === 'pending_review' && (
                          <>
                            <Button size="sm" onClick={() => handleStatusUpdate(selectedReferral.id, 'under_review', { assigned_am_name: amName || undefined, am_notes: actionNotes || undefined })} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
                              <Eye className="w-4 h-4 mr-1" /> Start Review
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionType('reject')} disabled={processing}>
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {selectedReferral.status === 'under_review' && (
                          <>
                            <Button size="sm" onClick={() => handleStatusUpdate(selectedReferral.id, 'am_outreach', { assigned_am_name: amName || staffName, am_notes: actionNotes || undefined })} disabled={processing} className="bg-indigo-600 hover:bg-indigo-700">
                              <UserCheck className="w-4 h-4 mr-1" /> Begin AM Outreach
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionType('reject')} disabled={processing}>
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {selectedReferral.status === 'am_outreach' && (
                          <>
                            <Button size="sm" onClick={() => handleStatusUpdate(selectedReferral.id, 'finalized', { am_notes: actionNotes || undefined, assigned_am_name: amName || undefined })} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700">
                              <CheckCircle className="w-4 h-4 mr-1" /> Mark Finalized
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setActionType('reject')} disabled={processing}>
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {selectedReferral.status === 'finalized' && (
                          <Button size="sm" onClick={() => handleStatusUpdate(selectedReferral.id, 'published', { am_notes: actionNotes || undefined })} disabled={processing} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="w-4 h-4 mr-1" /> Publish on AYP
                          </Button>
                        )}
                        {selectedReferral.status === 'published' && (
                          <Button size="sm" onClick={() => handleStatusUpdate(selectedReferral.id, 'approved_payout', { payout_amount: payoutAmount ? parseFloat(payoutAmount) : undefined, am_notes: actionNotes || undefined })} disabled={processing || !payoutAmount} className="bg-[#d4a574] hover:bg-[#c49464]">
                            <DollarSign className="w-4 h-4 mr-1" /> Approve Payout
                          </Button>
                        )}
                        {selectedReferral.status === 'approved_payout' && (
                          <Button size="sm" onClick={() => handleStatusUpdate(selectedReferral.id, 'paid_out', { am_notes: actionNotes || undefined })} disabled={processing} className="bg-green-700 hover:bg-green-800">
                            <Banknote className="w-4 h-4 mr-1" /> Mark as Paid
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Status Flow */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-4 text-xs">
                      {['pending_review', 'under_review', 'am_outreach', 'finalized', 'published', 'approved_payout', 'paid_out'].map((s, i) => (
                        <div key={s} className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full ${selectedReferral.status === s ? 'bg-[#d4a574] text-white font-medium' : 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_BADGE[s]?.label}
                          </span>
                          {i < 6 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
