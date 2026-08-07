import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, RefreshCw, Users, Bell, Trash2, Eye, Building, UserPlus, 
  CheckCircle, AlertCircle, Phone, Mail, Calendar, DollarSign, 
  UserCheck, PhoneCall, Filter, Download, MoreHorizontal, WifiOff,
  Loader2, Bug, Shield, Database
} from 'lucide-react';
import { InvestorAdminModal } from './InvestorAdminModal';
import { StaffNotifications } from './StaffNotifications';
import { PropertyAssignmentModal } from './PropertyAssignmentModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Investor {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  created_at: string;
  onboarding_completed?: boolean;
  budget?: string;
  budget_min?: number;
  budget_max?: number;
  preferred_markets?: string[];
  company_name?: string;
  status?: string;
  discovery_call_completed?: boolean;
  acquisition_manager_name?: string;
  assigned_acquisition_manager_id?: string;
  assigned_setup_manager_id?: string;
  assigned_setup_manager_name?: string;
  can_purchase_deals?: boolean;
  wait_time_hours?: number;
  is_escalated?: boolean;
}

interface Counts {
  total: number;
  active: number;
  pending: number;
  with_manager: number;
  with_acquisition_manager?: number;
  with_setup_manager?: number;
  discovery_completed: number;
  can_purchase: number;
  unassigned?: number;
  escalated?: number;
}

// v10.0: Simplified response extraction - handles both data and error fields
function safeExtract(result: { data: any; error: any }): { responseData: any; responseError: string | null } {
  const { data, error } = result;
  
  // Case 1: data has expected shape
  if (data && (data.investors !== undefined || data.success !== undefined)) {
    return { responseData: data, responseError: null };
  }
  
  // Case 2: error contains the response body (non-200 status codes)
  if (error) {
    if (typeof error === 'object') {
      // Direct object with investors
      if (error.investors !== undefined || error.success !== undefined) {
        return { responseData: error, responseError: null };
      }
      // Message contains JSON
      if (error.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.investors !== undefined || parsed.success !== undefined) {
            return { responseData: parsed, responseError: null };
          }
        } catch { /* not JSON */ }
      }
      // Context contains response
      if (error.context) {
        try {
          const ctx = typeof error.context === 'string' ? JSON.parse(error.context) : error.context;
          if (ctx.investors !== undefined || ctx.success !== undefined) {
            return { responseData: ctx, responseError: null };
          }
        } catch { /* not parseable */ }
      }
    }
    const errMsg = typeof error === 'string' ? error : error.message || JSON.stringify(error);
    return { responseData: null, responseError: errMsg };
  }
  
  // Case 3: data exists but unexpected shape
  if (data) return { responseData: data, responseError: null };
  
  return { responseData: null, responseError: 'No response received' };
}

export function InvestorManagementTab() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, active: 0, pending: 0, with_manager: 0, discovery_completed: 0, can_purchase: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [investorForAssignment, setInvestorForAssignment] = useState<Investor | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const { toast } = useToast();

  const addDebugLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
    console.log(`[InvestorManagementTab] ${msg}`);
  }, []);

  const fetchInvestors = useCallback(async () => {
    setLoading(true);
    setError(null);
    addDebugLog('Starting fetchInvestors v10.0...');
    
    const requestBody = { 
      action: 'list_investors',
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined,
      limit: 500
    };
    addDebugLog(`Request: ${JSON.stringify(requestBody)}`);
    
    try {
      const startTime = Date.now();
      const result = await supabase.functions.invoke('manage-investor-admin', { body: requestBody });
      const elapsed = Date.now() - startTime;
      
      addDebugLog(`Response in ${elapsed}ms. data=${result.data !== null}, error=${result.error !== null}`);
      setRawResponse({ data: result.data, error: result.error });
      
      const { responseData, responseError } = safeExtract(result);
      
      if (responseError) {
        addDebugLog(`ERROR: ${responseError}`);
        setError(`Unable to load investors: ${responseError}`);
        setLoading(false);
        return;
      }
      
      if (responseData?.investors) {
        const investorList = Array.isArray(responseData.investors) ? responseData.investors : [];
        addDebugLog(`SUCCESS: ${investorList.length} investors loaded`);
        setInvestors(investorList);
        setError(null);
      } else if (responseData?.success === false) {
        addDebugLog(`Function error: ${responseData.error}`);
        setError(responseData.error || 'Edge function returned an error');
        setInvestors([]);
      } else {
        addDebugLog(`Unexpected response shape. Keys: ${responseData ? Object.keys(responseData).join(', ') : 'null'}`);
        setInvestors([]);
      }
      
      if (responseData?.counts) {
        setCounts(responseData.counts);
      }
    } catch (err: any) {
      addDebugLog(`EXCEPTION: ${err.message}`);
      setError(`Connection error: ${err.message}`);
      toast({ title: 'Error loading investors', description: err.message, variant: 'destructive' });
    }
    
    setLoading(false);
  }, [statusFilter, search, toast, addDebugLog]);

  useEffect(() => { 
    fetchInvestors(); 
    fetchUnreadCount(); 
  }, [statusFilter]);

  const fetchUnreadCount = async () => {
    try {
      const result = await supabase.functions.invoke('manage-investor-admin', { 
        body: { action: 'get_unread_count' } 
      });
      const { responseData } = safeExtract(result);
      if (responseData) setUnreadCount(responseData.count || 0);
    } catch {}
  };

  const handleSearch = () => fetchInvestors();

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this investor?')) return;
    try {
      const result = await supabase.functions.invoke('manage-investor-admin', { 
        body: { action: 'delete_investor', investor_id: id } 
      });
      const { responseError } = safeExtract(result);
      if (responseError) throw new Error(responseError);
      toast({ title: 'Investor deleted' });
      fetchInvestors();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleAssignProperty = (investor: Investor) => {
    setInvestorForAssignment({
      ...investor,
      first_name: investor.first_name || investor.full_name?.split(' ')[0] || '',
      last_name: investor.last_name || investor.full_name?.split(' ').slice(1).join(' ') || ''
    });
    setAssignmentModalOpen(true);
  };

  const getInvestorName = (inv: Investor) => {
    if (inv.full_name) return inv.full_name;
    if (inv.first_name || inv.last_name) return `${inv.first_name || ''} ${inv.last_name || ''}`.trim();
    return inv.email?.split('@')[0] || 'Unknown';
  };

  const getBudgetDisplay = (inv: Investor) => {
    if (inv.budget) return inv.budget;
    if (inv.budget_min || inv.budget_max) {
      const min = inv.budget_min ? `$${(inv.budget_min / 1000).toFixed(0)}k` : '';
      const max = inv.budget_max ? `$${(inv.budget_max / 1000).toFixed(0)}k` : '';
      if (min && max) return `${min} - ${max}`;
      return min || max;
    }
    return 'Not set';
  };

  const exportInvestors = () => {
    const csv = [
      ['Name', 'Email', 'Phone', 'Company', 'Budget', 'Markets', 'Status', 'Manager', 'Discovery Call', 'Can Purchase', 'Joined'],
      ...investors.map(inv => [
        getInvestorName(inv), inv.email, inv.phone || '', inv.company_name || '',
        getBudgetDisplay(inv), inv.preferred_markets?.join('; ') || '',
        inv.onboarding_completed ? 'Active' : 'Pending', inv.acquisition_manager_name || '',
        inv.discovery_call_completed ? 'Yes' : 'No', inv.can_purchase_deals ? 'Yes' : 'No',
        new Date(inv.created_at).toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredInvestors = search 
    ? investors.filter(inv => {
        const name = getInvestorName(inv).toLowerCase();
        const searchLower = search.toLowerCase();
        return name.includes(searchLower) || 
               inv.email?.toLowerCase().includes(searchLower) ||
               inv.company_name?.toLowerCase().includes(searchLower) ||
               inv.phone?.includes(search);
      })
    : investors;

  return (
    <div className="space-y-6" role="region" aria-label="Investor Management">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Investor Management
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)} className="text-gray-500">
            <Bug className="w-4 h-4 mr-1" /> Debug
          </Button>
          <Button variant="outline" onClick={exportInvestors}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button variant="outline" onClick={() => setShowNotifications(true)} className="relative">
            <Bell className="w-4 h-4 mr-2" /> Notifications
            {unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1.5">{unreadCount}</Badge>
            )}
          </Button>
          <Button variant="outline" onClick={fetchInvestors} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <Bug className="w-4 h-4" /> Debug Panel v10.0
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="bg-white border rounded p-2 font-mono max-h-40 overflow-y-auto">
              {debugLog.length === 0 ? (
                <p className="text-gray-400">No log entries yet.</p>
              ) : (
                debugLog.map((entry, i) => (
                  <p key={i} className={`${entry.includes('ERROR') || entry.includes('EXCEPTION') ? 'text-red-600' : entry.includes('SUCCESS') ? 'text-green-600' : 'text-gray-700'}`}>
                    {entry}
                  </p>
                ))
              )}
            </div>
            {rawResponse && (
              <div className="bg-white border rounded p-2 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                <p className="text-gray-500 mb-1">Raw response:</p>
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify({ data_type: typeof rawResponse.data, error_type: typeof rawResponse.error, data_null: rawResponse.data === null, error_null: rawResponse.error === null, data_keys: rawResponse.data ? Object.keys(rawResponse.data) : null }, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Banner */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">{error}</p>
                <p className="text-red-600 text-sm">Enable Debug mode for more details.</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchInvestors} disabled={loading} className="border-red-300 text-red-700">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card className="cursor-pointer hover:border-[#d4a574]" onClick={() => setStatusFilter('all')}>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{counts.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </CardContent>
        </Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-green-600">{counts.active}</p><p className="text-sm text-gray-500">Active</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-yellow-600">{counts.pending}</p><p className="text-sm text-gray-500">Pending</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-blue-600">{counts.with_manager}</p><p className="text-sm text-gray-500">With AM</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-purple-600">{counts.discovery_completed}</p><p className="text-sm text-gray-500">Discovery</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-emerald-600">{counts.can_purchase}</p><p className="text-sm text-gray-500">Can Purchase</p></CardContent></Card>
        {counts.unassigned !== undefined && (
          <Card className={counts.unassigned > 0 ? 'border-amber-300' : ''}>
            <CardContent className="pt-4">
              <p className={`text-2xl font-bold ${counts.unassigned > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{counts.unassigned}</p>
              <p className="text-sm text-gray-500">No AM</p>
            </CardContent>
          </Card>
        )}
        {counts.escalated !== undefined && counts.escalated > 0 && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-red-600">{counts.escalated}</p>
              <p className="text-sm text-red-500">Escalated</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Investor Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Investors ({filteredInvestors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input aria-label="Search by name, email, company, or phone" 
                placeholder="Search by name, email, company, or phone..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={loading}>Search</Button>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Investor</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Manager</th>
                  <th className="p-3 text-left">Budget</th>
                  <th className="p-3 text-left">Joined</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      <span>Loading investors...</span>
                    </td>
                  </tr>
                ) : filteredInvestors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No investors found</p>
                      <p className="text-sm">
                        {error ? 'Unable to load investors. Please try refreshing.' : 'Try adjusting your search or filters'}
                      </p>
                      <div className="flex gap-2 justify-center mt-3">
                        <Button variant="outline" size="sm" onClick={fetchInvestors}>
                          <RefreshCw className="w-4 h-4 mr-2" /> Retry
                        </Button>
                        {!showDebug && (
                          <Button variant="outline" size="sm" onClick={() => setShowDebug(true)} className="text-amber-700 border-amber-300">
                            <Bug className="w-4 h-4 mr-2" /> Show Debug
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInvestors.map(inv => (
                    <tr key={inv.id} className={`border-t hover:bg-gray-50 ${inv.is_escalated ? 'bg-red-50' : ''}`}>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{getInvestorName(inv)}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {inv.email}
                          </p>
                          {inv.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {inv.phone}</p>}
                          {inv.company_name && <p className="text-xs text-gray-400 flex items-center gap-1"><Building className="w-3 h-3" /> {inv.company_name}</p>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <Badge className={inv.onboarding_completed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {inv.onboarding_completed ? 'Active' : 'Pending'}
                          </Badge>
                          {inv.can_purchase_deals && (
                            <Badge className="bg-emerald-100 text-emerald-800 block w-fit">
                              <CheckCircle className="w-3 h-3 mr-1 inline" /> Can Purchase
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {inv.acquisition_manager_name ? (
                            <div className="flex items-center gap-1 text-sm">
                              <UserCheck className="w-4 h-4 text-green-600" />
                              <span>{inv.acquisition_manager_name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" /> Not assigned
                            </span>
                          )}
                          <Badge variant="outline" className={`text-xs ${inv.discovery_call_completed ? 'text-green-700 border-green-300' : 'text-yellow-700 border-yellow-300'}`}>
                            <PhoneCall className="w-3 h-3 mr-1" />
                            {inv.discovery_call_completed ? 'Discovery Done' : 'No Discovery'}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-gray-400" /> {getBudgetDisplay(inv)}
                        </div>
                        {inv.preferred_markets && inv.preferred_markets.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {inv.preferred_markets.slice(0, 2).map(m => (
                              <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                            ))}
                            {inv.preferred_markets.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{inv.preferred_markets.length - 2}</Badge>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" /> {new Date(inv.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedInvestor(inv)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedInvestor(inv)}>
                                <Eye className="w-4 h-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAssignProperty(inv)}>
                                <UserPlus className="w-4 h-4 mr-2" /> Assign Property
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(inv.id)} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" /> Delete Investor
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
            <p>Showing {filteredInvestors.length} of {counts.total} investors</p>
          </div>
        </CardContent>
      </Card>

      {selectedInvestor && (
        <InvestorAdminModal 
          investor={selectedInvestor} 
          onClose={() => { setSelectedInvestor(null); fetchInvestors(); }} 
        />
      )}
      
      {showNotifications && (
        <StaffNotifications 
          onClose={() => { setShowNotifications(false); fetchUnreadCount(); }} 
        />
      )}

      <PropertyAssignmentModal
        open={assignmentModalOpen}
        onOpenChange={setAssignmentModalOpen}
        mode="assign_to_investor"
        investor={investorForAssignment}
        onAssigned={() => { fetchInvestors(); setInvestorForAssignment(null); }}
      />
    </div>
  );
}
