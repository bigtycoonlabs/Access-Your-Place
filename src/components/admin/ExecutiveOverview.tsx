
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
  DollarSign, TrendingUp, Users, Building, CreditCard, Banknote,
  Plus, Loader2, FileText, Trash2, BarChart3, CheckCircle, Clock,
  AlertTriangle, ArrowUpRight, Send, PieChart, ShieldAlert, Lock
} from 'lucide-react';


interface DealRecord {
  id: string;
  client_name: string;
  property_address: string;
  deal_status: string;
  payment_type: string;
  acquisition_fee_total: number;
  funded_payment: number;
  commission_paid: number;
  net_after_commission: number;
  assigned_staff_id: string;
  assigned_staff_name: string;
  staff_role: string;
  notes: string;
  submitted_by: string;
  created_at: string;
}

interface Overview {
  total_deals: number;
  closed_deals: number;
  credit_deals: number;
  cash_deals: number;
  completed_deals: number;
  pending_application: number;
  total_acquisition_fees: number;
  total_funded_payments: number;
  total_commissions_paid: number;
  net_earnings: number;
  by_staff: { name: string; deals: DealRecord[]; totalFees: number; totalCommissions: number }[];
}

interface MasterReport {
  week_start: string;
  staff_reports: any[];
  total_clients: number;
  total_closings: number;
  total_new_inventory: number;
  total_commissions_this_week: number;
  week_deals: any[];
  reports_submitted: number;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
}

interface ExecutiveOverviewProps {
  staffId: string;
  staffName: string;
  isAdmin?: boolean;
}

const DEAL_STATUSES = [
  { value: 'closed', label: 'Closed' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending_application', label: 'Pending Application' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_TYPES = [
  { value: 'cash', label: 'Cash (Full Payment)' },
  { value: 'credit', label: 'Credit' },
  { value: 'partial_credit', label: 'Partial Credit' },
  { value: 'funded', label: 'Funded' },
];

const STATUS_COLORS: Record<string, string> = {
  closed: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  pending_application: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function ExecutiveOverview({ staffId, staffName, isAdmin = false }: ExecutiveOverviewProps) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [masterReport, setMasterReport] = useState<MasterReport | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'deals' | 'weekly'>('overview');
  const [sendingSummary, setSendingSummary] = useState(false);
  const [formData, setFormData] = useState({
    client_name: '', property_address: '', deal_status: 'closed', payment_type: 'cash',
    acquisition_fee_total: '', funded_payment: '', commission_paid: '',
    assigned_staff_id: '', assigned_staff_name: '', staff_role: 'acquisition_manager', notes: ''
  });
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    // CRITICAL: Only admins can access executive overview and master weekly report.
    // Skip edge function calls entirely for non-admins to prevent 403 errors.
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [overviewRes, masterRes, staffRes] = await Promise.all([
      supabase.functions.invoke('manage-hr-commissions', { body: { action: 'get_executive_overview' } }),
      supabase.functions.invoke('manage-hr-commissions', { body: { action: 'get_master_weekly_report' } }),
      supabase.functions.invoke('manage-hr-commissions', { body: { action: 'get_staff_list' } })
    ]);
    if (overviewRes.data?.overview) setOverview(overviewRes.data.overview);
    if (overviewRes.data?.deals) setDeals(overviewRes.data.deals);
    if (masterRes.data?.master_report) setMasterReport(masterRes.data.master_report);
    if (staffRes.data?.staff) setStaffList(staffRes.data.staff);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitDeal = async () => {
    if (!formData.client_name) {
      toast({ title: 'Missing Fields', description: 'Client name is required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'submit_deal_record', ...formData, submitted_by: staffName }
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deal Record Added' });
      setShowAddDeal(false);
      setFormData({
        client_name: '', property_address: '', deal_status: 'closed', payment_type: 'cash',
        acquisition_fee_total: '', funded_payment: '', commission_paid: '',
        assigned_staff_id: '', assigned_staff_name: '', staff_role: 'acquisition_manager', notes: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm('Delete this deal record?')) return;
    const { error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'delete_deal_record', deal_id: dealId }
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Deal Record Deleted' }); loadData(); }
  };

  const handleSendFridaySummary = async () => {
    setSendingSummary(true);
    const { data, error } = await supabase.functions.invoke('manage-hr-commissions', {
      body: { action: 'send_friday_payout_summary' }
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Friday Summary Sent', description: `Sent to ${data?.sent_to?.length || 0} team members` });
    }
    setSendingSummary(false);
  };

  const handleStaffSelect = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    setFormData({
      ...formData,
      assigned_staff_id: staffId,
      assigned_staff_name: staff ? `${staff.first_name} ${staff.last_name}` : '',
      staff_role: staff?.department === 'setup_managers' ? 'setup_manager' : 'acquisition_manager'
    });
  };

  // Auto-calculate net
  const calcNet = () => {
    const fee = parseFloat(formData.acquisition_fee_total) || 0;
    const comm = parseFloat(formData.commission_paid) || 0;
    return (fee - comm).toFixed(2);
  };

  // Access gate: non-admins see restricted message and no edge function calls are made
  if (!isAdmin) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-12 text-center">
          <div className="mx-auto w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-amber-700" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center justify-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            Access Restricted
          </h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            The Executive Overview, Deal Records, and Weekly Master Report are only available to administrators.
            Please contact an administrator if you need access to this data.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* View Switcher */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'overview' as const, label: 'Executive Overview', icon: PieChart },
          { id: 'deals' as const, label: 'Deal Records', icon: Building },
          { id: 'weekly' as const, label: 'Weekly Master Report', icon: BarChart3 },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              activeView === v.id
                ? 'bg-[#1a365d] text-white border-[#1a365d]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <v.icon className="w-4 h-4" />
            {v.label}
          </button>
        ))}
      </div>

      {/* ===== EXECUTIVE OVERVIEW ===== */}
      {activeView === 'overview' && overview && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Deals</p>
                    <p className="text-3xl font-bold text-blue-700">{overview.total_deals}</p>
                  </div>
                  <Building className="w-8 h-8 text-blue-300" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Closed</p>
                    <p className="text-3xl font-bold text-emerald-700">{overview.closed_deals}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-emerald-300" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">On Credit</p>
                    <p className="text-3xl font-bold text-purple-700">{overview.credit_deals}</p>
                  </div>
                  <CreditCard className="w-8 h-8 text-purple-300" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Cash Paid</p>
                    <p className="text-3xl font-bold text-green-700">{overview.cash_deals}</p>
                  </div>
                  <Banknote className="w-8 h-8 text-green-300" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Pending App</p>
                    <p className="text-3xl font-bold text-yellow-700">{overview.pending_application}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-300" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-[#1a365d]/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-[#1a365d]" />
                  Revenue Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Total Acquisition Fees</span>
                    <span className="font-bold text-lg text-gray-900">${overview.total_acquisition_fees.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-700">Funded Payments Received</span>
                    <span className="font-bold text-lg text-blue-700">${overview.total_funded_payments.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="text-sm text-red-700">Commissions Paid Out</span>
                    <span className="font-bold text-lg text-red-700">-${overview.total_commissions_paid.toLocaleString()}</span>
                  </div>
                  <div className="border-t-2 border-[#1a365d] pt-3">
                    <div className="flex justify-between items-center p-3 bg-[#1a365d]/5 rounded-lg">
                      <span className="font-semibold text-[#1a365d]">Net Earnings After Commissions</span>
                      <span className="font-bold text-2xl text-[#1a365d]">${overview.net_earnings.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-600" />
                    By Staff Member
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={handleSendFridaySummary} disabled={sendingSummary}>
                    {sendingSummary ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                    Send Friday Summary
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {overview.by_staff.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No deal records yet.</p>
                ) : (
                  <div className="space-y-3">
                    {overview.by_staff.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.deals.length} deals</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-gray-900">${s.totalFees.toLocaleString()}</p>
                          <p className="text-xs text-red-600">-${s.totalCommissions.toLocaleString()} comm.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ===== DEAL RECORDS ===== */}
      {activeView === 'deals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">All Deal Records</h3>
            <Button onClick={() => setShowAddDeal(true)} className="bg-[#1a365d]">
              <Plus className="w-4 h-4 mr-2" /> Add Deal Record
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {deals.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No deal records yet. Add your first deal to start tracking.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Property</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Payment</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Acq. Fee</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Commission</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">Net</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">AM/SM</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {deals.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(d.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-medium">{d.client_name}</td>
                          <td className="px-4 py-3 text-gray-500 hidden lg:table-cell max-w-[180px] truncate">{d.property_address || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`text-xs ${STATUS_COLORS[d.deal_status] || 'bg-gray-100 text-gray-800'}`}>
                              {d.deal_status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className="text-xs capitalize">{d.payment_type.replace('_', ' ')}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">${Number(d.acquisition_fee_total).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-red-600">${Number(d.commission_paid).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">${Number(d.net_after_commission).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm">{d.assigned_staff_name || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteDeal(d.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== WEEKLY MASTER REPORT ===== */}
      {activeView === 'weekly' && masterReport && (
        <div className="space-y-6">
          <Card className="border-[#1a365d]/20 bg-gradient-to-r from-[#1a365d]/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#1a365d]" />
                Weekly Master Report
              </CardTitle>
              <CardDescription>
                Week of {masterReport.week_start} &middot; {masterReport.reports_submitted} staff reports submitted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-white rounded-lg border text-center">
                  <p className="text-3xl font-bold text-[#1a365d]">{masterReport.total_clients}</p>
                  <p className="text-xs text-gray-500 mt-1">Active Clients Engaged</p>
                </div>
                <div className="p-4 bg-white rounded-lg border text-center">
                  <p className="text-3xl font-bold text-emerald-700">{masterReport.total_closings}</p>
                  <p className="text-xs text-gray-500 mt-1">Deals Closed (Signed Lease)</p>
                </div>
                <div className="p-4 bg-white rounded-lg border text-center">
                  <p className="text-3xl font-bold text-purple-700">{masterReport.total_new_inventory}</p>
                  <p className="text-xs text-gray-500 mt-1">New Landlords/Properties</p>
                </div>
                <div className="p-4 bg-white rounded-lg border text-center">
                  <p className="text-3xl font-bold text-amber-700">${masterReport.total_commissions_this_week.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">Commissions Paid This Week</p>
                </div>
              </div>

              {/* Individual Staff Reports */}
              <h4 className="font-semibold text-gray-700 mb-3">Individual Staff Reports</h4>
              {masterReport.staff_reports.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No staff reports submitted this week yet.</p>
              ) : (
                <div className="space-y-3">
                  {masterReport.staff_reports.map((r: any) => (
                    <div key={r.id} className="p-4 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#1a365d] rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {(r.staff_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{r.staff_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.reviewed_at ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-xs">Reviewed</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs">Pending Review</Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Clients:</span>{' '}
                          <span className="font-semibold">{r.client_volume}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Closings:</span>{' '}
                          <span className="font-semibold">{r.closings}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">New Inventory:</span>{' '}
                          <span className="font-semibold">{r.new_inventory}</span>
                        </div>
                      </div>
                      {r.notes && (
                        <p className="text-sm text-gray-600 mt-2 italic border-t pt-2">{r.notes}</p>
                      )}
                      {r.admin_feedback && (
                        <div className="mt-2 p-2 bg-amber-50 rounded text-sm">
                          <span className="font-medium text-amber-800">Feedback:</span> {r.admin_feedback}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Deal Record Dialog */}
      <Dialog open={showAddDeal} onOpenChange={setShowAddDeal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby="add-deal-desc">
          <DialogHeader>
            <DialogTitle>Add Deal Record</DialogTitle>
            <DialogDescription id="add-deal-desc">
              Enter deal details. Net earnings will auto-calculate from acquisition fee minus commission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client Name *</Label>
              <Input value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} placeholder="Client full name" />
            </div>
            <div>
              <Label>Property Address</Label>
              <Input value={formData.property_address} onChange={(e) => setFormData({ ...formData, property_address: e.target.value })} placeholder="Property address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Deal Status</Label>
                <Select value={formData.deal_status} onValueChange={(v) => setFormData({ ...formData, deal_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEAL_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Type</Label>
                <Select value={formData.payment_type} onValueChange={(v) => setFormData({ ...formData, payment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Acquisition Fee</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input type="number" step="0.01" className="pl-8" value={formData.acquisition_fee_total} onChange={(e) => setFormData({ ...formData, acquisition_fee_total: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div>
                <Label>Funded Payment</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input type="number" step="0.01" className="pl-8" value={formData.funded_payment} onChange={(e) => setFormData({ ...formData, funded_payment: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div>
                <Label>Commission Paid</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input type="number" step="0.01" className="pl-8" value={formData.commission_paid} onChange={(e) => setFormData({ ...formData, commission_paid: e.target.value })} placeholder="0.00" />
                </div>
              </div>
            </div>
            {/* Auto-calculated net */}
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-emerald-700">Net After Commission (Auto-calculated)</span>
                <span className="text-lg font-bold text-emerald-800">${calcNet()}</span>
              </div>
            </div>
            <div>
              <Label>Assigned AM/SM</Label>
              <Select value={formData.assigned_staff_id} onValueChange={handleStaffSelect}>
                <SelectTrigger><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                <SelectContent>
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} ({s.department?.replace('_', ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDeal(false)}>Cancel</Button>
            <Button onClick={handleSubmitDeal} disabled={submitting} className="bg-[#1a365d]">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Deal Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
