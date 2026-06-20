import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Search, DollarSign, Clock, CheckCircle, XCircle, 
  AlertTriangle, Plus, User, Calendar, Filter, RefreshCw,
  CreditCard, TrendingUp, History, FileText, Building2, ArrowRight,
  Coins, Receipt
} from 'lucide-react';
import { SOPHelpButton } from './SOPHelpButton';


interface Credit {
  id: string;
  investor_id: string;
  investor_name?: string;
  investor_email?: string;
  amount: number;
  credit_type: string;
  source_description: string;
  credit_status: string;
  expires_at: string;
  used_at?: string;
  used_for?: string;
  used_for_assignment_id?: string;
  used_for_payment_intent?: string;
  created_at: string;
  created_by?: string;
}

interface CreditRequest {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  request_type: string;
  amount_requested: number;
  description: string;
  related_property_address?: string;
  request_status: string;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

interface CreditUsageAudit {
  id: string;
  investor_id: string;
  investor_name?: string;
  investor_email?: string;
  assignment_id?: string;
  property_id?: string;
  property_title?: string;
  property_location?: string;
  payment_intent_id?: string;
  credits_used: string[];
  credit_details: any[];
  total_credit_amount: number;
  original_fee: number;
  final_amount_paid: number;
  transaction_type: string;
  created_at: string;
}

interface Stats {
  total_active_credits: number;
  total_active_amount: number;
  total_used_credits: number;
  total_used_amount: number;
  expiring_soon: number;
  pending_requests: number;
}

interface UsageStats {
  total_transactions: number;
  total_credits_used: number;
  credits_only_transactions: number;
  partial_credit_transactions: number;
  average_credit_per_transaction: number;
}

interface Investor {
  id: string;
  name: string;
  email: string;
}

export function InvestorCreditsTab() {
  const [activeTab, setActiveTab] = useState('requests');
  const [credits, setCredits] = useState<Credit[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [expiringCredits, setExpiringCredits] = useState<Credit[]>([]);
  const [usageAudit, setUsageAudit] = useState<CreditUsageAudit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showUsageDetailModal, setShowUsageDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CreditRequest | null>(null);
  const [selectedUsage, setSelectedUsage] = useState<CreditUsageAudit | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Assign credit form
  const [assignForm, setAssignForm] = useState({
    investor_id: '',
    investor_search: '',
    amount: '',
    credit_type: 'manual',
    description: '',
    expires_in_days: 'never'
  });

  const [searchResults, setSearchResults] = useState<Investor[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);

  
  // Review form
  const [reviewForm, setReviewForm] = useState({
    admin_notes: '',
    approved_amount: ''
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const { data: statsData } = await supabase.functions.invoke('manage-investor-credits', {
        body: { action: 'get_stats' }
      });
      if (statsData?.stats) setStats(statsData.stats);

      // Fetch credit requests
      const { data: requestsData } = await supabase.functions.invoke('manage-investor-credits', {
        body: { action: 'get_credit_requests', status_filter: statusFilter }
      });
      if (requestsData?.requests) setRequests(requestsData.requests);

      // Fetch all credits
      const { data: creditsData } = await supabase.functions.invoke('manage-investor-credits', {
        body: { action: 'get_all_credits' }
      });
      if (creditsData?.credits) setCredits(creditsData.credits);

      // Fetch expiring credits
      const { data: expiringData } = await supabase.functions.invoke('manage-investor-credits', {
        body: { action: 'get_expiring_credits', days_until_expiry: 30 }
      });
      if (expiringData?.credits) setExpiringCredits(expiringData.credits);

      // Fetch usage audit
      const { data: auditData } = await supabase.functions.invoke('manage-investor-credits', {
        body: { action: 'get_credit_usage_audit' }
      });
      if (auditData?.audit_records) setUsageAudit(auditData.audit_records);

      // Fetch usage stats
      const { data: usageStatsData } = await supabase.functions.invoke('manage-investor-credits', {
        body: { action: 'get_credit_usage_stats' }
      });
      if (usageStatsData?.stats) setUsageStats(usageStatsData.stats);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  const handleSearchInvestors = async (query: string) => {
    setAssignForm({ ...assignForm, investor_search: query });
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    // Try manage-investor-credits first
    try {
      const { data } = await supabase.functions.invoke('manage-investor-credits', {
        body: { action: 'search_investors', query }
      });
      if (data?.investors?.length) {
        setSearchResults(data.investors);
        return;
      }
    } catch {}

    // Fallback: try manage-investor-admin
    try {
      const { data } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'search_investors', query }
      });
      if (data?.investors?.length) {
        setSearchResults(data.investors.map((i: any) => ({
          id: i.id,
          name: i.full_name || i.name || i.email?.split('@')[0],
          email: i.email
        })));
        return;
      }
    } catch {}

    // Fallback: direct DB query
    try {
      const { data } = await supabase
        .from('investors')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
      if (data?.length) {
        setSearchResults(data.map((i: any) => ({
          id: i.id,
          name: i.full_name || i.email?.split('@')[0],
          email: i.email
        })));
      }
    } catch {}
  };


  const handleSelectInvestor = (investor: Investor) => {
    setSelectedInvestor(investor);
    setAssignForm({ ...assignForm, investor_id: investor.id, investor_search: investor.name });
    setSearchResults([]);
  };

  const handleAssignCredit = async () => {
    if (!assignForm.investor_id || !assignForm.amount) {
      toast({ title: 'Missing Information', description: 'Please select an investor and enter an amount.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      // Determine expiration - 'never' means no expiration (null)
      const expiresInDays = assignForm.expires_in_days === 'never' ? null : parseInt(assignForm.expires_in_days);
      
      const { data, error } = await supabase.functions.invoke('manage-investor-credits', {
        body: {
          action: 'assign_credit',
          investor_id: assignForm.investor_id,
          amount: parseFloat(assignForm.amount),
          credit_type: assignForm.credit_type,
          description: assignForm.description,
          expires_in_days: expiresInDays,
          no_expiration: assignForm.expires_in_days === 'never',
          staff_name: 'Staff Admin'
        }
      });

      if (data?.success) {
        toast({ title: 'Credit Assigned', description: `$${assignForm.amount} credit assigned to ${selectedInvestor?.name}${assignForm.expires_in_days === 'never' ? ' (no expiration)' : ''}` });
        setShowAssignModal(false);
        setAssignForm({ investor_id: '', investor_search: '', amount: '', credit_type: 'manual', description: '', expires_in_days: 'never' });
        setSelectedInvestor(null);
        fetchData();
      } else {
        // Fallback: try direct DB insert
        try {
          const creditData: any = {
            investor_id: assignForm.investor_id,
            amount: parseFloat(assignForm.amount),
            credit_type: assignForm.credit_type,
            source_description: assignForm.description || `Manual credit assigned by Staff Admin`,
            credit_status: 'active',
            created_by: 'Staff Admin',
            created_at: new Date().toISOString()
          };
          // Only set expires_at if not 'never'
          if (assignForm.expires_in_days !== 'never' && expiresInDays) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresInDays);
            creditData.expires_at = expiresAt.toISOString();
          }
          
          const { error: dbError } = await supabase.from('investor_credits').insert(creditData);
          if (!dbError) {
            toast({ title: 'Credit Assigned', description: `$${assignForm.amount} credit assigned to ${selectedInvestor?.name}` });
            setShowAssignModal(false);
            setAssignForm({ investor_id: '', investor_search: '', amount: '', credit_type: 'manual', description: '', expires_in_days: 'never' });
            setSelectedInvestor(null);
            fetchData();
          } else {
            throw new Error(dbError.message || 'Failed to assign credit');
          }
        } catch (dbErr: any) {
          throw new Error(data?.error || dbErr.message || 'Failed to assign credit');
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };


  const handleReviewRequest = (request: CreditRequest) => {
    setSelectedRequest(request);
    setReviewForm({ admin_notes: '', approved_amount: request.amount_requested?.toString() || '' });
    setShowReviewModal(true);
  };

  const handleApproveRequest = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-credits', {
        body: {
          action: 'approve_credit_request',
          request_id: selectedRequest.id,
          admin_notes: reviewForm.admin_notes,
          approved_amount: parseFloat(reviewForm.approved_amount) || selectedRequest.amount_requested,
          staff_name: 'Staff Admin'
        }
      });

      if (data?.success) {
        toast({ title: 'Request Approved', description: 'Credit has been assigned to the investor.' });
        setShowReviewModal(false);
        setSelectedRequest(null);
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to approve request');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-credits', {
        body: {
          action: 'reject_credit_request',
          request_id: selectedRequest.id,
          admin_notes: reviewForm.admin_notes,
          staff_name: 'Staff Admin'
        }
      });

      if (data?.success) {
        toast({ title: 'Request Rejected', description: 'The credit request has been rejected.' });
        setShowReviewModal(false);
        setSelectedRequest(null);
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to reject request');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleViewUsageDetail = (usage: CreditUsageAudit) => {
    setSelectedUsage(usage);
    setShowUsageDetailModal(true);
  };

  const filteredCredits = credits.filter(credit => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      credit.investor_name?.toLowerCase().includes(query) ||
      credit.investor_email?.toLowerCase().includes(query) ||
      credit.source_description?.toLowerCase().includes(query)
    );
  });

  const filteredRequests = requests.filter(request => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      request.investor_name?.toLowerCase().includes(query) ||
      request.investor_email?.toLowerCase().includes(query) ||
      request.description?.toLowerCase().includes(query)
    );
  });

  const filteredUsageAudit = usageAudit.filter(usage => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      usage.investor_name?.toLowerCase().includes(query) ||
      usage.investor_email?.toLowerCase().includes(query) ||
      usage.property_title?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
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
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.total_active_credits || 0}</p>
                <p className="text-xs text-muted-foreground">Active Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">${(stats?.total_active_amount || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Active Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.total_used_credits || 0}</p>
                <p className="text-xs text-muted-foreground">Used Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">${(stats?.total_used_amount || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Used Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats?.expiring_soon ? 'border-yellow-300' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.expiring_soon || 0}</p>
                <p className="text-xs text-muted-foreground">Expiring (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats?.pending_requests ? 'border-orange-300' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.pending_requests || 0}</p>
                <p className="text-xs text-muted-foreground">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{usageStats?.total_transactions || 0}</p>
                <p className="text-xs text-muted-foreground">Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">${(usageStats?.total_credits_used || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Credits Applied</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by investor name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <SOPHelpButton
            sopKey="Credit"
            category="Compliance"
            userRole="Success_Team"
            buttonText="Credits SOP"
            ariaLabel="View Credit Management SOP"
          />
        </div>
        <Button onClick={() => setShowAssignModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
          <Plus className="w-4 h-4 mr-2" />
          Assign Credit
        </Button>
      </div>


      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requests">
            Credit Requests
            {stats?.pending_requests ? (
              <Badge className="ml-2 bg-orange-500">{stats.pending_requests}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="all-credits">All Credits</TabsTrigger>
          <TabsTrigger value="usage-history">
            Usage History
            {usageStats?.total_transactions ? (
              <Badge className="ml-2 bg-purple-500">{usageStats.total_transactions}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="expiring">
            Expiring Soon
            {stats?.expiring_soon ? (
              <Badge className="ml-2 bg-yellow-500">{stats.expiring_soon}</Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Credit Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex gap-2 items-center">
            <Filter className="w-4 h-4 text-gray-500" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No credit requests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <Card key={request.id} className={request.request_status === 'pending' ? 'border-orange-200' : ''}>
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold">{request.investor_name}</span>
                          <span className="text-sm text-gray-500">{request.investor_email}</span>
                        </div>
                        <p className="text-gray-700 mb-2">{request.description}</p>
                        {request.related_property_address && (
                          <p className="text-sm text-gray-500">Property: {request.related_property_address}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="outline">{request.request_type}</Badge>
                          <Badge className={
                            request.request_status === 'pending' ? 'bg-orange-500' :
                            request.request_status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                          }>
                            {request.request_status}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {formatDate(request.created_at)}
                          </span>
                        </div>
                        {request.admin_notes && (
                          <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                            <strong>Admin Notes:</strong> {request.admin_notes}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-2xl font-bold text-[#d4a574]">
                          ${request.amount_requested?.toLocaleString() || '0'}
                        </p>
                        {request.request_status === 'pending' && (
                          <Button onClick={() => handleReviewRequest(request)} className="bg-[#d4a574] hover:bg-[#c49464]">
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* All Credits Tab */}
        <TabsContent value="all-credits" className="space-y-4">
          {filteredCredits.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CreditCard className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No credits found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredCredits.map((credit) => (
                <Card key={credit.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold">{credit.investor_name}</span>
                          <span className="text-sm text-gray-500">{credit.investor_email}</span>
                        </div>
                        <p className="text-gray-700 mb-2">{credit.source_description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="outline">{credit.credit_type}</Badge>
                          <Badge className={
                            credit.credit_status === 'active' ? 'bg-green-500' :
                            credit.credit_status === 'used' ? 'bg-blue-500' : 'bg-gray-500'
                          }>
                            {credit.credit_status}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Created: {formatDate(credit.created_at)}
                          </span>
                          {credit.expires_at && credit.credit_status === 'active' && (
                            <span className="text-sm text-gray-500">
                              Expires: {formatDate(credit.expires_at)}
                            </span>
                          )}
                        </div>
                        {credit.used_for && (
                          <p className="text-sm text-gray-600 mt-2">
                            <strong>Used for:</strong> {credit.used_for}
                          </p>
                        )}
                        {credit.used_for_assignment_id && (
                          <p className="text-xs text-gray-500 mt-1">
                            Assignment ID: {credit.used_for_assignment_id}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#d4a574]">
                          ${parseFloat(credit.amount as any).toLocaleString()}
                        </p>
                        {credit.created_by && (
                          <p className="text-xs text-gray-500">by {credit.created_by}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Usage History Tab */}
        <TabsContent value="usage-history" className="space-y-4">
          {/* Usage Stats Summary */}
          {usageStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-purple-50">
                <CardContent className="pt-4">
                  <p className="text-sm text-purple-700">Total Transactions</p>
                  <p className="text-2xl font-bold text-purple-900">{usageStats.total_transactions}</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-50">
                <CardContent className="pt-4">
                  <p className="text-sm text-amber-700">Total Credits Used</p>
                  <p className="text-2xl font-bold text-amber-900">${usageStats.total_credits_used.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="pt-4">
                  <p className="text-sm text-green-700">Fully Covered</p>
                  <p className="text-2xl font-bold text-green-900">{usageStats.credits_only_transactions}</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50">
                <CardContent className="pt-4">
                  <p className="text-sm text-blue-700">Partial Credit</p>
                  <p className="text-2xl font-bold text-blue-900">{usageStats.partial_credit_transactions}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {filteredUsageAudit.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No credit usage history yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredUsageAudit.map((usage) => (
                <Card key={usage.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold">{usage.investor_name}</span>
                          <span className="text-sm text-gray-500">{usage.investor_email}</span>
                        </div>
                        
                        {usage.property_title && (
                          <div className="flex items-center gap-2 text-gray-700 mb-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span>{usage.property_title}</span>
                            {usage.property_location && (
                              <span className="text-sm text-gray-500">({usage.property_location})</span>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge className={
                            usage.transaction_type === 'credits_only' ? 'bg-green-500' : 'bg-blue-500'
                          }>
                            {usage.transaction_type === 'credits_only' ? 'Fully Covered by Credits' : 'Partial Credit Applied'}
                          </Badge>
                          <Badge variant="outline">
                            {usage.credits_used?.length || 0} credit(s) used
                          </Badge>
                          <span className="text-sm text-gray-500">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {formatDateTime(usage.created_at)}
                          </span>
                        </div>

                        {/* Transaction Summary */}
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Original Fee</p>
                              <p className="font-semibold">${usage.original_fee?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div>
                              <p className="text-amber-600">Credits Applied</p>
                              <p className="font-semibold text-amber-700">-${usage.total_credit_amount?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Amount Paid</p>
                              <p className="font-semibold text-green-600">${usage.final_amount_paid?.toFixed(2) || '0.00'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Credits Applied</p>
                          <p className="text-2xl font-bold text-amber-600">
                            ${usage.total_credit_amount?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewUsageDetail(usage)}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Expiring Credits Tab */}
        <TabsContent value="expiring" className="space-y-4">
          {expiringCredits.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-4" />
                <p className="text-gray-500">No credits expiring in the next 30 days</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {expiringCredits.map((credit) => {
                const daysLeft = getDaysUntilExpiry(credit.expires_at);
                return (
                  <Card key={credit.id} className={daysLeft <= 7 ? 'border-red-300' : 'border-yellow-300'}>
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold">{credit.investor_name}</span>
                            <span className="text-sm text-gray-500">{credit.investor_email}</span>
                          </div>
                          <p className="text-gray-700 mb-2">{credit.source_description}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Badge className={daysLeft <= 7 ? 'bg-red-500' : 'bg-yellow-500'}>
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {daysLeft} days left
                            </Badge>
                            <span className="text-sm text-gray-500">
                              Expires: {formatDate(credit.expires_at)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-[#d4a574]">
                            ${parseFloat(credit.amount as any).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Assign Credit Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Credit to Investor</DialogTitle>
            <DialogDescription>
              Manually assign a credit to an investor's account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Search Investor</Label>
              <div className="relative">
                <Input
                  placeholder="Type investor name or email..."
                  value={assignForm.investor_search}
                  onChange={(e) => handleSearchInvestors(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map((investor) => (
                      <button
                        key={investor.id}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => handleSelectInvestor(investor)}
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{investor.name}</p>
                          <p className="text-sm text-gray-500">{investor.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedInvestor && (
                <p className="text-sm text-green-600 mt-1">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  Selected: {selectedInvestor.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={assignForm.amount}
                  onChange={(e) => setAssignForm({ ...assignForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Credit Type</Label>
                <Select
                  value={assignForm.credit_type}
                  onValueChange={(value) => setAssignForm({ ...assignForm, credit_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Assignment</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                    <SelectItem value="acquisition_fee">Acquisition Fee</SelectItem>
                    <SelectItem value="referral">Referral Bonus</SelectItem>
                    <SelectItem value="compensation">Compensation</SelectItem>
                    <SelectItem value="incomplete_acquisition">Incomplete Acquisition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Expiration</Label>
              <Select
                value={assignForm.expires_in_days}
                onValueChange={(value) => setAssignForm({ ...assignForm, expires_in_days: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never Expires (Recommended)</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="730">2 years</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-green-600 mt-1">
                Credits at Access Your Place typically do not expire.
              </p>
            </div>

            <div>
              <Label>Description / Reason</Label>
              <Textarea
                value={assignForm.description}
                onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
                placeholder="Reason for assigning this credit..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>

            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignCredit} 
              disabled={processing || !assignForm.investor_id || !assignForm.amount}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Request Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Credit Request</DialogTitle>
            <DialogDescription>
              Review and approve or reject this credit request.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <Card className="bg-gray-50">
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <p><strong>Investor:</strong> {selectedRequest.investor_name}</p>
                    <p><strong>Email:</strong> {selectedRequest.investor_email}</p>
                    <p><strong>Type:</strong> {selectedRequest.request_type}</p>
                    <p><strong>Requested Amount:</strong> ${selectedRequest.amount_requested?.toLocaleString()}</p>
                    <p><strong>Description:</strong> {selectedRequest.description}</p>
                    {selectedRequest.related_property_address && (
                      <p><strong>Property:</strong> {selectedRequest.related_property_address}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label>Approved Amount ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={reviewForm.approved_amount}
                  onChange={(e) => setReviewForm({ ...reviewForm, approved_amount: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can adjust the amount if needed
                </p>
              </div>

              <div>
                <Label>Admin Notes</Label>
                <Textarea
                  value={reviewForm.admin_notes}
                  onChange={(e) => setReviewForm({ ...reviewForm, admin_notes: e.target.value })}
                  placeholder="Add notes about this decision..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRejectRequest}
              disabled={processing}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button 
              onClick={handleApproveRequest}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Detail Modal */}
      <Dialog open={showUsageDetailModal} onOpenChange={setShowUsageDetailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-600" />
              Credit Usage Details
            </DialogTitle>
            <DialogDescription>
              Audit trail for this credit transaction
            </DialogDescription>
          </DialogHeader>

          {selectedUsage && (
            <div className="space-y-4">
              {/* Investor Info */}
              <Card className="bg-gray-50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <User className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-semibold">{selectedUsage.investor_name}</p>
                      <p className="text-sm text-gray-500">{selectedUsage.investor_email}</p>
                    </div>
                  </div>
                  {selectedUsage.property_title && (
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium">{selectedUsage.property_title}</p>
                        <p className="text-sm text-gray-500">{selectedUsage.property_location}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Transaction Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Transaction Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Original Acquisition Fee</span>
                      <span className="font-semibold">${selectedUsage.original_fee?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-600">
                      <span className="flex items-center gap-1">
                        <Coins className="w-4 h-4" />
                        Credits Applied
                      </span>
                      <span className="font-semibold">-${selectedUsage.total_credit_amount?.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="font-medium">Final Amount Paid</span>
                      <span className="font-bold text-lg text-green-600">
                        ${selectedUsage.final_amount_paid?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credits Used */}
              {selectedUsage.credit_details && selectedUsage.credit_details.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Credits Used ({selectedUsage.credit_details.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedUsage.credit_details.map((detail: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-amber-50 rounded">
                          <div>
                            <p className="text-sm font-medium">{detail.credit_type || 'Credit'}</p>
                            <p className="text-xs text-gray-500">{detail.source || 'N/A'}</p>
                          </div>
                          <span className="font-semibold text-amber-700">
                            ${parseFloat(detail.amount_used || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Metadata */}
              <div className="text-sm text-gray-500 space-y-1">
                <p><strong>Transaction Type:</strong> {selectedUsage.transaction_type}</p>
                <p><strong>Date:</strong> {formatDateTime(selectedUsage.created_at)}</p>
                {selectedUsage.payment_intent_id && (
                  <p><strong>Payment Intent:</strong> {selectedUsage.payment_intent_id}</p>
                )}
                {selectedUsage.assignment_id && (
                  <p><strong>Assignment ID:</strong> {selectedUsage.assignment_id}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUsageDetailModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
