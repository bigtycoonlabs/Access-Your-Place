import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, AlertTriangle, Users, UserPlus, Mail, Calendar, 
  CheckCircle, RefreshCw, Clock, AlertCircle, Send, Bell
} from 'lucide-react';

interface Investor {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  created_at: string;
  account_funded?: boolean;
  onboarding_completed?: boolean;
  wait_time_hours?: number;
  is_escalated?: boolean;
}

interface AM {
  id: string;
  full_name: string;
  email: string;
  investor_count: number;
}

interface Props {
  staffId: string;
  onCountChange?: (count: number) => void;
}

export function InvestorsWithoutAMWidget({ staffId, onCountChange }: Props) {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [ams, setAMs] = useState<AM[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvestors, setSelectedInvestors] = useState<string[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedAMId, setSelectedAMId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [sendingEscalation, setSendingEscalation] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [investorsRes, amsRes] = await Promise.all([
        supabase.functions.invoke('manage-investor-admin', {
          body: { action: 'get_unassigned_investors', limit: 100 }
        }),
        supabase.functions.invoke('manage-staff', {
          body: { action: 'get_acquisition_managers_with_counts' }
        })
      ]);

      let investorsList: Investor[] = [];
      if (investorsRes.data?.success && investorsRes.data?.investors) {
        investorsList = Array.isArray(investorsRes.data.investors) 
          ? investorsRes.data.investors 
          : [];
      } else if (!investorsRes.error) {
        try {
          const fallbackRes = await supabase.functions.invoke('manage-investor-admin', {
            body: { action: 'get_investors', filters: { has_am: false }, limit: 100 }
          });
          if (fallbackRes.data?.investors) {
            const allInvestors = Array.isArray(fallbackRes.data.investors) 
              ? fallbackRes.data.investors 
              : [];
            investorsList = allInvestors.filter((inv: any) => !inv.assigned_acquisition_manager_id);
          }
        } catch (fallbackErr) {
          console.error('Fallback investor fetch failed:', fallbackErr);
        }
      }
      setInvestors(investorsList);
      onCountChange?.(investorsList.length);
      
      let amsList: AM[] = [];
      if (amsRes.data?.success && amsRes.data?.acquisition_managers) {
        const rawAMs = Array.isArray(amsRes.data.acquisition_managers) 
          ? amsRes.data.acquisition_managers 
          : [];
        amsList = rawAMs.map((am: any) => ({
          id: am.id,
          full_name: am.display_name || am.name || `${am.first_name || ''} ${am.last_name || ''}`.trim() || am.email,
          email: am.email,
          investor_count: am.investor_count || 0
        }));
      } else if (!amsRes.error) {
        try {
          const staffRes = await supabase.functions.invoke('manage-staff', {
            body: { action: 'get_staff_list', department: 'acquisition_managers' }
          });
          if (staffRes.data?.staff) {
            const staffList = Array.isArray(staffRes.data.staff) 
              ? staffRes.data.staff 
              : [];
            amsList = staffList.map((s: any) => ({
              id: s.id,
              full_name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email,
              email: s.email,
              investor_count: 0
            }));
          }
        } catch (staffErr) {
          console.error('Fallback staff fetch failed:', staffErr);
        }
      }
      setAMs(amsList);
    } catch (err) {
      console.error('Failed to load data:', err);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
      setInvestors([]);
      setAMs([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleInvestor = (id: string) => {
    setSelectedInvestors(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedInvestors.length === investors.length) {
      setSelectedInvestors([]);
    } else {
      setSelectedInvestors(investors.map(i => i.id));
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedAMId || selectedInvestors.length === 0) return;
    setAssigning(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'bulk_assign_am',
          investor_ids: selectedInvestors,
          am_staff_id: selectedAMId,
          assigned_by: staffId
        }
      });
      if (error || data?.error) throw new Error(data?.error || 'Assignment failed');
      const successCount = data?.results?.filter((r: any) => r.success).length || 0;
      toast({ 
        title: 'Investors Assigned!', 
        description: `${successCount} investor(s) assigned. Email notifications sent to all parties.` 
      });
      setBulkAssignOpen(false);
      setSelectedInvestors([]);
      setSelectedAMId('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  const handleQuickAssign = async (investorId: string, amId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'assign_am_to_investor',
          investor_id: investorId,
          am_staff_id: amId,
          assigned_by: staffId
        }
      });
      if (error || data?.error) throw new Error(data?.error || 'Assignment failed');
      toast({ title: 'AM Assigned!', description: 'Investor and AM have been notified via email' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendDigest = async () => {
    setSendingDigest(true);
    try {
      const { data, error } = await supabase.functions.invoke('unassigned-investor-digest', {
        body: { action: 'send_digest' }
      });
      if (error) throw error;
      toast({ 
        title: 'Digest Sent', 
        description: `Daily digest sent to ${data?.sent || 0} success team member(s)` 
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSendingDigest(false);
  };

  const handleSendEscalation = async (investorId: string) => {
    setSendingEscalation(investorId);
    try {
      const { data, error } = await supabase.functions.invoke('unassigned-investor-digest', {
        body: { action: 'send_escalation_alert', investor_id: investorId }
      });
      if (error) throw error;
      toast({ title: 'Escalation Alert Sent', description: data?.message || 'Alert sent to success team' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSendingEscalation(null);
  };

  const formatWaitTime = (hours: number) => {
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1a365d]" />
          <p className="text-sm text-gray-500 mt-2">Loading investors...</p>
        </CardContent>
      </Card>
    );
  }

  const safeInvestors = Array.isArray(investors) ? investors : [];
  const safeAMs = Array.isArray(ams) ? ams : [];
  const escalatedInvestors = safeInvestors.filter(i => i.is_escalated || (i.wait_time_hours && i.wait_time_hours > 48));
  const normalInvestors = safeInvestors.filter(i => !i.is_escalated && (!i.wait_time_hours || i.wait_time_hours <= 48));

  return (
    <div className="space-y-6">
      {/* Escalation Alert */}
      {escalatedInvestors.length > 0 && (
        <Card className="border-red-300 bg-gradient-to-r from-red-50 to-red-100">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-800 text-lg">
                  {escalatedInvestors.length} Escalated Investor{escalatedInvestors.length !== 1 ? 's' : ''} (48h+)
                </h3>
                <p className="text-red-700 text-sm mt-1">
                  These investors have been waiting over 48 hours for an AM assignment. Immediate action required.
                </p>
                <div className="mt-3 space-y-2">
                  {escalatedInvestors.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between bg-white/70 rounded-lg p-3 border border-red-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {(inv.full_name || 'U').charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{inv.full_name || 'Unknown'}</p>
                          <p className="text-xs text-red-600">{inv.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-600 text-white">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatWaitTime(inv.wait_time_hours || 0)}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-100"
                          onClick={() => handleSendEscalation(inv.id)}
                          disabled={sendingEscalation === inv.id}
                        >
                          {sendingEscalation === inv.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Bell className="w-3 h-3" />
                          )}
                        </Button>
                        {safeAMs.length > 0 && (
                          <Select onValueChange={(amId) => handleQuickAssign(inv.id, amId)}>
                            <SelectTrigger className="w-[160px] h-8 text-xs">
                              <SelectValue placeholder="Assign AM..." />
                            </SelectTrigger>
                            <SelectContent>
                              {safeAMs.map((am) => (
                                <SelectItem key={am.id} value={am.id}>
                                  {am.full_name} ({am.investor_count})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Alert */}
      {safeInvestors.length > 0 && (
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 text-lg">
                  {safeInvestors.length} Investor{safeInvestors.length !== 1 ? 's' : ''} Without AM
                </h3>
                <p className="text-amber-700 text-sm mt-1">
                  These investors need an Acquisition Manager assigned to help them find deals.
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {selectedInvestors.length > 0 && (
                    <Button
                      onClick={() => setBulkAssignOpen(true)}
                      className="bg-amber-600 hover:bg-amber-700"
                      size="sm"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Assign {selectedInvestors.length} Selected
                    </Button>
                  )}
                  <Button
                    onClick={handleSendDigest}
                    variant="outline"
                    size="sm"
                    className="border-amber-300 text-amber-700"
                    disabled={sendingDigest}
                  >
                    {sendingDigest ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send Digest to Team
                  </Button>
                  <Button
                    onClick={loadData}
                    variant="outline"
                    size="sm"
                    className="border-amber-300 text-amber-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investors List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#d4a574]" />
                Investors Needing AM Assignment
              </CardTitle>
              <CardDescription>
                Assign Acquisition Managers to help these investors find deals
              </CardDescription>
            </div>
            {safeInvestors.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedInvestors.length === safeInvestors.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {safeInvestors.length === 0 ? (
            <div className="text-center py-12 bg-green-50 rounded-lg">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-green-700 font-medium">All investors have AMs assigned!</p>
              <p className="text-sm text-green-600">Great job keeping everyone supported.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {safeInvestors.map((investor) => {
                const waitHours = investor.wait_time_hours || 0;
                const isEscalated = waitHours > 48;
                return (
                  <div
                    key={investor.id}
                    className={`border rounded-lg p-4 transition-all ${
                      isEscalated 
                        ? 'border-red-300 bg-red-50' 
                        : selectedInvestors.includes(investor.id) 
                          ? 'border-amber-400 bg-amber-50' 
                          : 'bg-white hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={selectedInvestors.includes(investor.id)}
                        onCheckedChange={() => toggleInvestor(investor.id)}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold">{investor.full_name || 'Unknown'}</span>
                          {investor.account_funded && (
                            <Badge className="bg-green-100 text-green-700">Funded</Badge>
                          )}
                          {!investor.onboarding_completed && (
                            <Badge variant="outline" className="text-amber-600">Onboarding</Badge>
                          )}
                          {isEscalated ? (
                            <Badge className="bg-red-500 text-white">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {formatWaitTime(waitHours)} waiting
                            </Badge>
                          ) : waitHours > 0 ? (
                            <Badge variant="outline" className={waitHours > 24 ? 'text-amber-600 border-amber-300' : 'text-gray-500'}>
                              <Clock className="w-3 h-3 mr-1" />
                              {formatWaitTime(waitHours)}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {investor.email || 'No email'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Joined {investor.created_at ? new Date(investor.created_at).toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEscalated && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-100"
                            onClick={() => handleSendEscalation(investor.id)}
                            disabled={sendingEscalation === investor.id}
                          >
                            {sendingEscalation === investor.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Bell className="w-4 h-4 mr-1" />
                                Alert
                              </>
                            )}
                          </Button>
                        )}
                        {safeAMs.length > 0 && (
                          <Select onValueChange={(amId) => handleQuickAssign(investor.id, amId)}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Assign AM..." />
                            </SelectTrigger>
                            <SelectContent>
                              {safeAMs.map((am) => (
                                <SelectItem key={am.id} value={am.id}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{am.full_name}</span>
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {am.investor_count}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Assign Modal */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign Acquisition Manager</DialogTitle>
            <DialogDescription>
              Assign {selectedInvestors.length} investor{selectedInvestors.length !== 1 ? 's' : ''} to an Acquisition Manager.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Select Acquisition Manager</label>
            <Select value={selectedAMId} onValueChange={setSelectedAMId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose an AM..." />
              </SelectTrigger>
              <SelectContent>
                {safeAMs.map((am) => (
                  <SelectItem key={am.id} value={am.id}>
                    <div className="flex items-center gap-2">
                      <span>{am.full_name}</span>
                      <span className="text-gray-500">({am.email})</span>
                      <Badge variant="outline" className="ml-2">
                        {am.investor_count} investors
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setBulkAssignOpen(false);
              setSelectedAMId('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={!selectedAMId || assigning}
              className="bg-[#1a365d]"
            >
              {assigning ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Assign & Notify All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
