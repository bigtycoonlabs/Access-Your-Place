import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { StaffPortfolioManager } from './StaffPortfolioManager';
import {
  Loader2, Search, Building2, Users, User, ChevronRight, RefreshCw,
  ArrowLeft, MapPin, Clock, CheckCircle, AlertTriangle, Bell, Home, Plus
} from 'lucide-react';

interface Investor {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  portfolio_count?: number;
  pending_count?: number;
  active_count?: number;
  assigned_am_name?: string;
  created_at?: string;
}

interface RecentPortfolioAddition {
  id: string;
  investor_id: string;
  investor_name: string;
  address: string;
  city: string;
  state: string;
  property_status: string;
  created_at: string;
  community_name?: string;
}

interface Props {
  staffId: string;
  staffName: string;
}

export function StaffPortfolioEditor({ staffId, staffName }: Props) {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [recentAdditions, setRecentAdditions] = useState<RecentPortfolioAddition[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [stats, setStats] = useState({ totalInvestors: 0, totalProperties: 0, pendingApproval: 0 });
  const { toast } = useToast();

  useEffect(() => {
    fetchInvestors();
    fetchRecentAdditions();
  }, []);

  const fetchInvestors = async () => {
    setLoading(true);
    try {
      // Fetch all investors with AM assignment fields directly from investors table
      const { data: investorData, error } = await supabase
        .from('investors')
        .select('id, full_name, email, phone, created_at, assigned_am_id, assigned_am_name')
        .order('full_name', { ascending: true });

      if (error) throw error;

      const investorList = investorData || [];

      // Fetch portfolio counts for all investors
      let portfolioCounts: Record<string, { total: number; pending: number; active: number }> = {};
      try {
        const { data: portfolioData } = await supabase
          .from('investor_portfolio')
          .select('investor_id, property_status');
        
        if (portfolioData) {
          for (const p of portfolioData) {
            if (!portfolioCounts[p.investor_id]) {
              portfolioCounts[p.investor_id] = { total: 0, pending: 0, active: 0 };
            }
            portfolioCounts[p.investor_id].total++;
            if (p.property_status === 'pending' || p.property_status === 'pending_approval') {
              portfolioCounts[p.investor_id].pending++;
            }
            if (p.property_status === 'active') {
              portfolioCounts[p.investor_id].active++;
            }
          }
        }
      } catch (e) {
        console.warn('Could not fetch portfolio counts:', e);
      }

      // PRIMARY: Use assigned_am_name directly from investors table
      // FALLBACK 1: Try investor_am_assignments table
      // FALLBACK 2: Look up AM name from staff_users table using assigned_am_id
      let amAssignments: Record<string, string> = {};
      
      // First, populate from investors table directly (most reliable)
      for (const inv of investorList) {
        if (inv.assigned_am_name) {
          amAssignments[inv.id] = inv.assigned_am_name;
        }
      }

      // For investors without AM name but with AM id, look up from staff_users
      const investorsNeedingAMName = investorList.filter(
        inv => inv.assigned_am_id && !inv.assigned_am_name
      );
      
      if (investorsNeedingAMName.length > 0) {
        const amIds = [...new Set(investorsNeedingAMName.map(inv => inv.assigned_am_id).filter(Boolean))];
        if (amIds.length > 0) {
          try {
            const { data: staffData } = await supabase
              .from('staff_users')
              .select('id, name, first_name, last_name')
              .in('id', amIds);
            if (staffData) {
              const staffNameMap: Record<string, string> = {};
              for (const s of staffData) {
                staffNameMap[s.id] = s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown AM';
              }
              for (const inv of investorsNeedingAMName) {
                if (inv.assigned_am_id && staffNameMap[inv.assigned_am_id]) {
                  amAssignments[inv.id] = staffNameMap[inv.assigned_am_id];
                }
              }
            }
          } catch (e) {
            console.warn('Could not fetch AM names from staff_users:', e);
          }
        }
      }

      // FALLBACK: Try investor_am_assignments table for any remaining
      const investorsStillMissingAM = investorList.filter(inv => !amAssignments[inv.id]);
      if (investorsStillMissingAM.length > 0) {
        try {
          const { data: assignData } = await supabase
            .from('investor_am_assignments')
            .select('investor_id, am_name');
          if (assignData) {
            for (const a of assignData) {
              if (!amAssignments[a.investor_id]) {
                amAssignments[a.investor_id] = a.am_name;
              }
            }
          }
        } catch (e) {
          // Table may not exist - this is expected
          console.warn('investor_am_assignments table not available (expected):', e);
        }
      }

      const enrichedInvestors: Investor[] = investorList.map(inv => ({
        ...inv,
        portfolio_count: portfolioCounts[inv.id]?.total || 0,
        pending_count: portfolioCounts[inv.id]?.pending || 0,
        active_count: portfolioCounts[inv.id]?.active || 0,
        assigned_am_name: amAssignments[inv.id] || undefined,
      }));

      setInvestors(enrichedInvestors);
      setStats({
        totalInvestors: enrichedInvestors.length,
        totalProperties: Object.values(portfolioCounts).reduce((sum, c) => sum + c.total, 0),
        pendingApproval: Object.values(portfolioCounts).reduce((sum, c) => sum + c.pending, 0),
      });
    } catch (err: any) {
      console.error('Error fetching investors:', err);
      toast({ title: 'Error', description: 'Failed to load investors', variant: 'destructive' });
    }
    setLoading(false);
  };


  const fetchRecentAdditions = async () => {
    setLoadingRecent(true);
    try {
      const { data, error } = await supabase
        .from('investor_portfolio')
        .select('id, investor_id, address, city, state, property_status, created_at, community_name')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        // Enrich with investor names
        const investorIds = [...new Set(data.map(d => d.investor_id))];
        let nameMap: Record<string, string> = {};
        if (investorIds.length > 0) {
          const { data: names } = await supabase
            .from('investors')
            .select('id, full_name')
            .in('id', investorIds);
          if (names) {
            nameMap = Object.fromEntries(names.map(n => [n.id, n.full_name]));
          }
        }

        setRecentAdditions(data.map(d => ({
          ...d,
          investor_name: nameMap[d.investor_id] || 'Unknown Investor',
        })));
      }
    } catch (e) {
      console.warn('Could not fetch recent additions:', e);
    }
    setLoadingRecent(false);
  };

  const filteredInvestors = searchQuery.trim()
    ? investors.filter(inv => {
        const q = searchQuery.toLowerCase();
        return (
          inv.full_name?.toLowerCase().includes(q) ||
          inv.email?.toLowerCase().includes(q) ||
          inv.phone?.includes(searchQuery)
        );
      })
    : investors;

  // If an investor is selected, show their portfolio manager
  if (selectedInvestor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedInvestor(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" />Back to Investors
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#1a365d] flex items-center gap-2">
              <User className="w-5 h-5 text-[#d4a574]" />
              {selectedInvestor.full_name}'s Portfolio
            </h2>
            <p className="text-sm text-gray-500">{selectedInvestor.email}</p>
          </div>
        </div>

        <StaffPortfolioManager
          investorId={selectedInvestor.id}
          investorName={selectedInvestor.full_name}
          staffId={staffId}
          staffName={staffName}
          onRefresh={() => {
            fetchInvestors();
            fetchRecentAdditions();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1a365d] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#d4a574]" />
            Portfolio Manager
          </h2>
          <p className="text-sm text-gray-600">
            Add, update, and manage properties in any investor's portfolio
          </p>
        </div>
        <Button variant="outline" onClick={() => { fetchInvestors(); fetchRecentAdditions(); }} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="w-5 h-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-blue-700">{stats.totalInvestors}</p>
            <p className="text-xs text-gray-500">Total Investors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Home className="w-5 h-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold text-green-700">{stats.totalProperties}</p>
            <p className="text-xs text-gray-500">Portfolio Properties</p>
          </CardContent>
        </Card>
        <Card className={stats.pendingApproval > 0 ? 'border-amber-300' : ''}>
          <CardContent className="pt-4 text-center">
            <Clock className="w-5 h-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold text-amber-700">{stats.pendingApproval}</p>
            <p className="text-xs text-gray-500">Pending Approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Recently Added Properties Banner */}
      {recentAdditions.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
              <Bell className="w-4 h-4 text-blue-600" />
              Recently Added Portfolio Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAdditions.slice(0, 5).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-100 hover:border-blue-300 cursor-pointer transition-colors"
                  onClick={() => {
                    const inv = investors.find(i => i.id === item.investor_id);
                    if (inv) setSelectedInvestor(inv);
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      item.property_status === 'active' ? 'bg-green-500' :
                      item.property_status === 'pending' || item.property_status === 'pending_approval' ? 'bg-amber-500' :
                      'bg-gray-400'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.community_name || item.address}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.investor_name} - {item.city}, {item.state}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-[10px] ${
                      item.property_status === 'active' ? 'bg-green-500' :
                      item.property_status === 'pending' || item.property_status === 'pending_approval' ? 'bg-amber-500' :
                      'bg-gray-500'
                    }`}>
                      {item.property_status === 'pending_approval' ? 'Pending' : item.property_status}
                    </Badge>
                    <span className="text-[10px] text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input aria-label="Search investors by name, email, or phone"
          placeholder="Search investors by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Investor List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#d4a574]" />
            <p className="text-sm text-gray-500 mt-2">Loading investors...</p>
          </CardContent>
        </Card>
      ) : filteredInvestors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {searchQuery ? `No investors matching "${searchQuery}"` : 'No investors found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{filteredInvestors.length} investor{filteredInvestors.length !== 1 ? 's' : ''}</p>
          <div className="border rounded-lg divide-y max-h-[60vh] overflow-y-auto">
            {filteredInvestors.map(investor => (
              <button
                key={investor.id}
                className="w-full text-left px-4 py-3 hover:bg-[#d4a574]/5 focus:bg-[#d4a574]/10 focus:outline-none transition-colors flex items-center justify-between gap-3"
                onClick={() => setSelectedInvestor(investor)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    (investor.portfolio_count || 0) > 0 ? 'bg-[#d4a574]/20 text-[#d4a574]' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{investor.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-gray-500 truncate">{investor.email}</p>
                    {investor.assigned_am_name && (
                      <p className="text-[10px] text-indigo-600 truncate">AM: {investor.assigned_am_name}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <p className="text-sm font-bold text-[#1a365d]">{investor.portfolio_count || 0}</p>
                      <p className="text-[10px] text-gray-400">Properties</p>
                    </div>
                    {(investor.pending_count || 0) > 0 && (
                      <Badge className="bg-amber-500 text-[10px] px-1.5 py-0">
                        {investor.pending_count} pending
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
