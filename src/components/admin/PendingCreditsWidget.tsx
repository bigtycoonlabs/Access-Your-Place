import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, CreditCard, CheckCircle, XCircle, RefreshCw,
  DollarSign, User, MapPin, Clock, AlertCircle, Search,
  Building2, FileText, ChevronDown, ChevronUp
} from 'lucide-react';

interface PendingCredit {
  id: string;
  investor_id: string;
  portfolio_property_id: string;
  credit_amount: number;
  credit_reason: string;
  credit_status: string;
  created_at: string;
  notes?: string;
  investor_name: string;
  investor_email: string;
  // Enriched from property lookup
  property_address?: string;
  property_city?: string;
  property_state?: string;
}

interface Props {
  staffId?: string;
  staffName?: string;
}

export function PendingCreditsWidget({ staffId, staffName }: Props) {
  const [credits, setCredits] = useState<PendingCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCredit, setExpandedCredit] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [stats, setStats] = useState({ total: 0, totalAmount: 0 });
  const { toast } = useToast();

  const fetchCredits = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch pending credits from manage-investor-admin (already enriched server-side)
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'get_portfolio_credits' }
      });

      if (error) throw error;

      // The edge function already enriches with investor_name, investor_email,
      // property_address, property_city, property_state from server-side lookups
      const creditsList: PendingCredit[] = data?.credits || [];

      setCredits(creditsList);
      setStats({
        total: creditsList.length,
        totalAmount: creditsList.reduce((sum, c) => sum + (c.credit_amount || 0), 0)
      });
    } catch (err: any) {
      console.error('Failed to fetch credits:', err);
      
      // Fallback: direct query (no enrichment)
      try {
        const { data: directCredits } = await supabase
          .from('portfolio_credits')
          .select('*')
          .eq('credit_status', 'pending_approval')
          .order('created_at', { ascending: false });
        
        if (directCredits) {
          setCredits(directCredits.map((c: any) => ({
            ...c,
            investor_name: 'Unknown',
            investor_email: ''
          })));
          setStats({
            total: directCredits.length,
            totalAmount: directCredits.reduce((sum: number, c: any) => sum + (c.credit_amount || 0), 0)
          });
        }
      } catch (e) {
        console.error('Direct query also failed:', e);
      }
    }
    setLoading(false);
  }, []);


  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const handleApprove = async (credit: PendingCredit) => {
    setProcessing(credit.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: 'approve_portfolio_credit',
          credit_id: credit.id,
          property_id: credit.portfolio_property_id,
          investor_id: credit.investor_id,
          approved: true,
          staff_name: staffName || 'Success Team'
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to approve credit');

      toast({
        title: 'Credit Approved',
        description: `$${credit.credit_amount.toLocaleString()} credit approved for ${credit.investor_name}. The amount has been added to their account balance.`
      });

      fetchCredits();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to approve credit',
        variant: 'destructive'
      });
    }
    setProcessing(null);
  };

  const handleDeny = async (credit: PendingCredit) => {
    setProcessing(credit.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: 'approve_portfolio_credit',
          credit_id: credit.id,
          property_id: credit.portfolio_property_id,
          investor_id: credit.investor_id,
          approved: false,
          deny_reason: denyReason || undefined,
          staff_name: staffName || 'Success Team'
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to deny credit');

      toast({
        title: 'Credit Denied',
        description: `Credit request for ${credit.investor_name} has been denied.${denyReason ? ` Reason: ${denyReason}` : ''}`
      });

      setExpandedCredit(null);
      setDenyReason('');
      fetchCredits();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to deny credit',
        variant: 'destructive'
      });
    }
    setProcessing(null);
  };


  const filteredCredits = searchQuery
    ? credits.filter(c =>
        c.investor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.investor_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.property_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.property_city?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : credits;

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-amber-600" />
            Pending Portfolio Credits
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve acquisition fee credit requests from investors
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCredits} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-900">{stats.total}</p>
                <p className="text-xs text-amber-700">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalAmount.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total Pending Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${stats.total > 0 ? Math.round(stats.totalAmount / stats.total).toLocaleString() : '0'}
                </p>
                <p className="text-xs text-gray-500">Avg Credit Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      {credits.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input aria-label="Search by investor name, email, or property address"
            placeholder="Search by investor name, email, or property address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Credit Requests List */}
      {filteredCredits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">
              {searchQuery ? 'No matching credit requests' : 'All Caught Up!'}
            </h3>
            <p className="text-gray-500 mt-2">
              {searchQuery 
                ? 'Try adjusting your search query.' 
                : 'There are no pending portfolio credit requests to review.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCredits.map((credit) => {
            const isExpanded = expandedCredit === credit.id;
            const isProcessing = processing === credit.id;
            
            return (
              <Card key={credit.id} className="border-l-4 border-l-amber-400 hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Credit Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                          <DollarSign className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg text-amber-900">
                              ${credit.credit_amount?.toLocaleString()}
                            </h3>
                            <Badge className="bg-amber-100 text-amber-800 text-xs">
                              Pending Approval
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {formatTimeAgo(credit.created_at)}
                            </span>
                          </div>
                          
                          {/* Investor Info */}
                          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{credit.investor_name}</span>
                            {credit.investor_email && (
                              <span className="text-gray-400">({credit.investor_email})</span>
                            )}
                          </div>

                          {/* Property Info */}
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span>
                              {credit.property_address || 'Property ID: ' + credit.portfolio_property_id?.substring(0, 8)}
                              {credit.property_city && `, ${credit.property_city}`}
                              {credit.property_state && `, ${credit.property_state}`}
                            </span>
                          </div>

                          {/* Reason */}
                          {credit.credit_reason && (
                            <div className="flex items-start gap-2 mt-2 text-sm text-gray-500">
                              <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span>{credit.credit_reason}</span>
                            </div>
                          )}

                          {/* Submitted Date */}
                          <p className="text-xs text-gray-400 mt-2">
                            Submitted: {new Date(credit.created_at).toLocaleString('en-US', { 
                              dateStyle: 'medium', timeStyle: 'short' 
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 lg:min-w-[200px]">
                      <Button
                        onClick={() => handleApprove(credit)}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700 text-white w-full"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Approve Credit
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedCredit(null);
                            setDenyReason('');
                          } else {
                            setExpandedCredit(credit.id);
                          }
                        }}
                        disabled={isProcessing}
                        className="text-red-600 border-red-200 hover:bg-red-50 w-full"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Deny
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 ml-auto" />
                        ) : (
                          <ChevronDown className="w-4 h-4 ml-auto" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Deny Section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-red-100 bg-red-50/50 -mx-5 -mb-5 p-5 rounded-b-lg">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-red-800" htmlFor="reason-for-denial-optional">Reason for Denial (optional)</label>
                          <Textarea id="reason-for-denial-optional"
                            value={denyReason}
                            onChange={(e) => setDenyReason(e.target.value)}
                            placeholder="e.g., Lease agreements have been confirmed as received..."
                            rows={2}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setExpandedCredit(null);
                              setDenyReason('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeny(credit)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            Confirm Denial
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">About Portfolio Credits</p>
              <p className="text-blue-600">
                When an investor adds an AYP-acquired property to their portfolio and has not yet received 
                lease agreements, their acquisition fee is automatically submitted as a pending credit request. 
                Approving a credit adds the amount to the investor's account balance. If lease agreements are 
                later confirmed as received, the credit is automatically cancelled.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
