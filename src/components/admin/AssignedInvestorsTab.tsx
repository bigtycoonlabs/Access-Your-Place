import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, Search, User, Mail, Phone, DollarSign, Calendar,
  MessageSquare, Eye, Filter, ArrowUpDown, Users, TrendingUp,
  Clock, CheckCircle, Send, Building2, Home, RefreshCw, Zap
} from 'lucide-react';
import { InvestorAdminModal } from './InvestorAdminModal';

interface Investor {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  account_funded: boolean;
  account_balance?: number;
  acquisition_stage?: string;
  last_activity_at?: string;
  created_at: string;
  preferred_markets?: string[];
  investment_budget_min?: number;
  investment_budget_max?: number;
  portfolio_count?: number;
  portfolio_monthly_revenue?: number;
}

interface Props {
  staffId: string;
  staffName: string;
}

const stageLabels: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  onboarding: { label: 'Onboarding', color: 'bg-purple-100 text-purple-700' },
  searching: { label: 'Searching', color: 'bg-amber-100 text-amber-700' },
  application: { label: 'In Application', color: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  setup: { label: 'In Setup', color: 'bg-cyan-100 text-cyan-700' },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' }
};

export function AssignedInvestorsTab({ staffId, staffName }: Props) {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fundingFilter, setFundingFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Aggregate stats from API
  const [aggregate, setAggregate] = useState<{
    total_portfolio_revenue: number;
    total_properties: number;
    funded_count: number;
    active_count: number;
  } | null>(null);
  
  // Full admin modal for portfolio management
  const [adminModalInvestor, setAdminModalInvestor] = useState<any>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    loadInvestors();
  }, [staffId, fundingFilter, sortBy]);

  const loadInvestors = async () => {
    setLoading(true);
    try {
      // Try manage-investor-admin first (has portfolio data)
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: 'get_assigned_investors',
          staff_id: staffId,
          limit: 200
        }
      });

      if (!error && data?.investors) {
        setInvestors(data.investors);
        if (data.aggregate) setAggregate(data.aggregate);
      } else {
        // Fallback: try manage-staff
        console.warn('manage-investor-admin failed, trying fallback:', error);
        try {
          const { data: fallbackData } = await supabase.functions.invoke('manage-staff', {
            body: {
              action: 'get_assigned_investors',
              staff_id: staffId,
              funding_status: fundingFilter,
              sort_by: sortBy
            }
          });
          if (fallbackData?.investors) {
            setInvestors(fallbackData.investors);
          }
        } catch (fallbackErr) {
          console.error('Fallback also failed:', fallbackErr);
        }
        
        // If still no investors, try direct DB
        if (investors.length === 0) {
          try {
            const { data: dbData } = await supabase
              .from('investors')
              .select('*')
              .or(`assigned_acquisition_manager_id.eq.${staffId},assigned_setup_manager_id.eq.${staffId}`)
              .order('created_at', { ascending: false })
              .limit(200);
            if (dbData) {
              setInvestors(dbData as any);
            }
          } catch (dbErr) {
            console.error('Direct DB query failed:', dbErr);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load investors:', err);
      toast({ title: 'Error', description: 'Failed to load assigned investors', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPortfolioCounts = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'sync_portfolio_counts' }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Sync failed');
      }

      toast({ 
        title: 'Portfolio Sync Complete', 
        description: `Updated ${data?.updated || 0} investors. ${data?.total_properties || 0} total active properties across ${data?.investors_with_properties || 0} investors.`
      });
      
      // Reload to show updated counts
      await loadInvestors();
    } catch (err: any) {
      toast({ title: 'Sync Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedInvestor || !messageText.trim()) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: {
          action: 'send_to_investor',
          investor_id: selectedInvestor.id,
          message: messageText,
          subject: messageSubject || 'Message from your AM',
          staff_id: staffId,
          staff_name: staffName
        }
      });

      if (error || data?.error) throw new Error(data?.error || 'Failed to send message');

      toast({ title: 'Message Sent', description: `Message sent to ${selectedInvestor.full_name}` });
      setMessageModalOpen(false);
      setMessageText('');
      setMessageSubject('');
      setSelectedInvestor(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleOpenAdminModal = (investor: Investor) => {
    setAdminModalInvestor({
      id: investor.id,
      email: investor.email,
      full_name: investor.full_name,
      phone: investor.phone,
      created_at: investor.created_at,
      account_funded: investor.account_funded,
      account_balance: investor.account_balance,
      preferred_markets: investor.preferred_markets,
      investment_budget_min: investor.investment_budget_min,
      investment_budget_max: investor.investment_budget_max,
      portfolio_count: investor.portfolio_count,
      portfolio_monthly_revenue: investor.portfolio_monthly_revenue,
      acquisition_stage: investor.acquisition_stage
    });
  };

  // Client-side filtering
  const filteredInvestors = investors.filter(inv => {
    const matchesSearch = inv.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (fundingFilter === 'funded') return matchesSearch && inv.account_funded;
    if (fundingFilter === 'unfunded') return matchesSearch && !inv.account_funded;
    return matchesSearch;
  });

  // Use aggregate from API if available, otherwise calculate locally
  const stats = {
    total: investors.length,
    funded: aggregate?.funded_count ?? investors.filter(i => i.account_funded).length,
    active: aggregate?.active_count ?? investors.filter(i => i.acquisition_stage === 'active').length,
    totalBalance: investors.reduce((sum, i) => sum + (i.account_balance || 0), 0),
    withProperties: aggregate?.total_properties ?? investors.filter(i => (i.portfolio_count || 0) > 0).length,
    totalMonthlyRevenue: aggregate?.total_portfolio_revenue ?? investors.reduce((sum, i) => sum + (parseFloat(String(i.portfolio_monthly_revenue)) || 0), 0)
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1a365d]" />
          <p className="mt-2 text-gray-500">Loading your assigned investors...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
                <p className="text-xs text-blue-600">Total Investors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{stats.funded}</p>
                <p className="text-xs text-green-600">Funded</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{stats.active}</p>
                <p className="text-xs text-emerald-600">Active Ops</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">${stats.totalBalance.toLocaleString()}</p>
                <p className="text-xs text-amber-600">Total Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{typeof stats.withProperties === 'number' ? stats.withProperties : 0}</p>
                <p className="text-xs text-purple-600">Properties</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-700">${stats.totalMonthlyRevenue.toLocaleString()}</p>
                <p className="text-xs text-cyan-600">Monthly Rev</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#d4a574]" />
                My Assigned Investors
              </CardTitle>
              <CardDescription>
                Manage and communicate with your assigned investors. Click "Manage" to access portfolio, messaging, documents, and more.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSyncPortfolioCounts} 
                disabled={syncing}
                title="Recalculate portfolio counts and monthly revenue for all investors"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Sync Counts
              </Button>
              <Button variant="outline" size="sm" onClick={loadInvestors} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input aria-label="Search by name or email"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={fundingFilter} onValueChange={setFundingFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Funding Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Investors</SelectItem>
                <SelectItem value="funded">Funded Only</SelectItem>
                <SelectItem value="unfunded">Unfunded Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Date Added</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="funding">Account Balance</SelectItem>
                <SelectItem value="activity">Last Activity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Investors List */}
          {filteredInvestors.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No investors found</p>
              <p className="text-sm text-gray-500">
                {investors.length === 0 
                  ? "You don't have any assigned investors yet" 
                  : "No investors match your search criteria"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvestors.map((investor) => {
                const monthlyRev = parseFloat(String(investor.portfolio_monthly_revenue)) || 0;
                const propCount = investor.portfolio_count || 0;
                
                return (
                  <div
                    key={investor.id}
                    className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Investor Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold truncate">{investor.full_name}</span>
                          {investor.account_funded ? (
                            <Badge className="bg-green-100 text-green-700 flex-shrink-0">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Funded
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500 flex-shrink-0">
                              Unfunded
                            </Badge>
                          )}
                          {investor.acquisition_stage && stageLabels[investor.acquisition_stage] && (
                            <Badge className={`${stageLabels[investor.acquisition_stage].color} flex-shrink-0`}>
                              {stageLabels[investor.acquisition_stage].label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {investor.email}
                          </span>
                          {investor.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {investor.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        {investor.account_balance !== undefined && investor.account_balance > 0 && (
                          <div className="text-center">
                            <p className="font-semibold text-green-600">${investor.account_balance.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Balance</p>
                          </div>
                        )}
                        {propCount > 0 && (
                          <div className="text-center">
                            <p className="font-semibold text-blue-600">{propCount}</p>
                            <p className="text-xs text-gray-500">Properties</p>
                          </div>
                        )}
                        {monthlyRev > 0 && (
                          <div className="text-center">
                            <p className="font-semibold text-cyan-600">${monthlyRev.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Monthly Rev</p>
                          </div>
                        )}
                        <div className="text-center">
                          <p className="font-semibold text-gray-700">
                            {investor.last_activity_at 
                              ? new Date(investor.last_activity_at).toLocaleDateString()
                              : investor.created_at
                                ? new Date(investor.created_at).toLocaleDateString()
                                : 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">Last Active</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedInvestor(investor);
                            setMessageModalOpen(true);
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Message
                        </Button>
                        <Button
                          size="sm"
                          className="bg-[#d4a574] hover:bg-[#c49464]"
                          onClick={() => handleOpenAdminModal(investor)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Manage
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Modal */}
      <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Message {selectedInvestor?.full_name}</DialogTitle>
            <DialogDescription>
              Send a direct message to this investor. They'll receive an email and in-app notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input aria-label="Message subject"
                placeholder="Message subject..."
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <Textarea aria-label="Type your message"
                placeholder="Type your message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={5}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setMessageModalOpen(false);
              setMessageText('');
              setMessageSubject('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sending}
              className="bg-[#1a365d]"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Investor Admin Modal - Portfolio, Messages, Documents, etc. */}
      {adminModalInvestor && (
        <InvestorAdminModal 
          investor={adminModalInvestor} 
          onClose={() => { 
            setAdminModalInvestor(null); 
            loadInvestors(); // Refresh list after changes
          }} 
        />
      )}
    </div>
  );
}
