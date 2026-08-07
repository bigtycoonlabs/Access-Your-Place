import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2, Users, DollarSign, Clock, CheckCircle, Gift, Trophy,
  CreditCard, Banknote, Calendar, Search, Filter, Download
} from 'lucide-react';

interface Referral {
  id: string;
  referrer_id: string;
  referred_id?: string;
  referred_email?: string;
  status: string;
  is_manual_entry?: boolean;
  created_at: string;
  qualified_at?: string;
  referrer?: { full_name?: string; email?: string };
  referred?: { full_name?: string; email?: string };
}

interface Payout {
  id: string;
  referrer_id: string;
  reward_id?: string;
  amount: number;
  payout_method: string;
  payout_details?: any;
  status: string;
  scheduled_for?: string;
  paid_at?: string;
  created_at: string;
  referrer?: { full_name?: string; email?: string };
}

interface Stats {
  total_referrals: number;
  signed_up: number;
  qualified: number;
  rewarded: number;
  pending_payouts: number;
  total_paid: number;
  next_payout_date: string;
}

export function ReferralAnalyticsTab() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-referrals', {
        body: { action: 'get_analytics' }
      });

      if (error) throw error;

      setReferrals(data?.referrals || []);
      setPayouts(data?.payouts || []);
      setStats(data?.stats || null);
    } catch (err: any) {
      console.error('Error loading referral analytics:', err);
      toast({ title: 'Error', description: 'Failed to load referral data', variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProcessPayout = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-referrals', {
        body: { action: 'process_payout', payout_id: payoutId }
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Payout marked as paid' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(null);
  };

  const handleProcessAllScheduled = async () => {
    setProcessing('all');
    try {
      const { data, error } = await supabase.functions.invoke('manage-referrals', {
        body: { action: 'process_scheduled_payouts' }
      });

      if (error) throw error;

      toast({ title: 'Success', description: `${data?.processed || 0} payouts moved to processing` });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(null);
  };

  const filteredReferrals = referrals.filter(r => {
    const matchesSearch = 
      r.referrer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referrer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referred?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referred?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referred_email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const pendingPayouts = payouts.filter(p => p.status === 'scheduled' || p.status === 'pending' || p.status === 'processing');
  const completedPayouts = payouts.filter(p => p.status === 'paid');

  const getPayoutMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      zelle: 'Zelle',
      cashapp: 'Cash App',
      venmo: 'Venmo',
      apple_pay: 'Apple Pay',
      yp_credit: 'YP Credit'
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12" role="status" aria-label="Loading referral analytics">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" aria-hidden="true" />
        <span className="sr-only">Loading referral analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Referral Analytics">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold">{stats?.total_referrals || 0}</p>
                <p className="text-xs text-muted-foreground">Total Referrals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold">{stats?.signed_up || 0}</p>
                <p className="text-xs text-muted-foreground">Signed Up</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-500" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold">{stats?.qualified || 0}</p>
                <p className="text-xs text-muted-foreground">Qualified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold">{stats?.rewarded || 0}</p>
                <p className="text-xs text-muted-foreground">Rewarded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-orange-500" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold">{stats?.pending_payouts || 0}</p>
                <p className="text-xs text-muted-foreground">Pending Payouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold">${stats?.total_paid?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#d4a574]/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">
                  {stats?.next_payout_date ? new Date(stats.next_payout_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Next Payout</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payouts" className="space-y-4">
        <TabsList aria-label="Referral management sections">
          <TabsTrigger value="payouts">
            <Banknote className="w-4 h-4 mr-2" aria-hidden="true" />
            Pending Payouts ({pendingPayouts.length})
          </TabsTrigger>
          <TabsTrigger value="referrals">
            <Users className="w-4 h-4 mr-2" aria-hidden="true" />
            All Referrals ({referrals.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
            Payout History ({completedPayouts.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Payouts Tab */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Pending Payouts</CardTitle>
                  <CardDescription>
                    Payouts scheduled for Friday after 12 PM EST
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleProcessAllScheduled}
                  disabled={processing === 'all' || pendingPayouts.length === 0}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                >
                  {processing === 'all' && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                  Process All Scheduled
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {pendingPayouts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Banknote className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p>No pending payouts</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Investor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayouts.map(payout => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payout.referrer?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{payout.referrer?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">${payout.amount}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getPayoutMethodLabel(payout.payout_method)}</Badge>
                          {payout.payout_details && Object.keys(payout.payout_details).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {payout.payout_details.email || payout.payout_details.phone || payout.payout_details.username}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {payout.scheduled_for ? new Date(payout.scheduled_for).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            payout.status === 'scheduled' ? 'bg-yellow-500' :
                            payout.status === 'processing' ? 'bg-blue-500' :
                            'bg-gray-500'
                          }>
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleProcessPayout(payout.id)}
                            disabled={processing === payout.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {processing === payout.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                              'Mark Paid'
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Referrals Tab */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle>All Referrals</CardTitle>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input aria-label="Search by name or email"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    aria-label="Search referrals"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]" aria-label="Filter by status">
                    <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="signed_up">Signed Up</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="rewarded">Rewarded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredReferrals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p>No referrals found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referrer</TableHead>
                      <TableHead>Referred</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReferrals.map(referral => (
                      <TableRow key={referral.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{referral.referrer?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{referral.referrer?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {referral.referred?.full_name || referral.referred_email || 'Pending'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {referral.referred?.email || ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            referral.status === 'rewarded' ? 'bg-green-500' :
                            referral.status === 'qualified' ? 'bg-purple-500' :
                            referral.status === 'signed_up' ? 'bg-blue-500' :
                            'bg-gray-500'
                          }>
                            {referral.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {referral.is_manual_entry ? (
                            <Badge variant="outline">Manual Entry</Badge>
                          ) : (
                            <Badge variant="secondary">Automatic</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payout History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Payout History</CardTitle>
              <CardDescription>Completed referral payouts</CardDescription>
            </CardHeader>
            <CardContent>
              {completedPayouts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p>No completed payouts yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Investor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Paid Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedPayouts.map(payout => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payout.referrer?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{payout.referrer?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-green-600">${payout.amount}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getPayoutMethodLabel(payout.payout_method)}</Badge>
                        </TableCell>
                        <TableCell>
                          {payout.paid_at ? new Date(payout.paid_at).toLocaleDateString() : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
