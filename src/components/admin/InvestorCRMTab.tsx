import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { InvestorDetailModal } from './InvestorDetailModal';
import { BulkEmailModal } from './BulkEmailModal';
import { CSVUploadModal } from './CSVUploadModal';
import { InvestorPipelineTab } from './InvestorPipelineTab';
import { ReferralAnalyticsTab } from './ReferralAnalyticsTab';
import { Search, Upload, Mail, Users, TrendingUp, RefreshCw, GitBranch, List, Gift } from 'lucide-react';


interface Investor {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  company_name?: string;
  investment_budget_min: number;
  investment_budget_max: number;
  preferred_markets: string[];
  activity_level: string;
  engagement_score: number;
  total_inquiries: number;
  total_acquisitions: number;
  tags: string[];
  last_activity_at?: string;
  created_at: string;
}

export function InvestorCRMTab() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [total, setTotal] = useState(0);
  const [activeView, setActiveView] = useState('list');
  const { toast } = useToast();

  useEffect(() => { fetchInvestors(); }, [activityFilter]);

  const fetchInvestors = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('manage-investor-crm', {
      body: { action: 'list', search, activity_level: activityFilter }
    });
    if (data?.investors) { setInvestors(data.investors); setTotal(data.total || 0); }
    setLoading(false);
  };

  const handleSearch = () => fetchInvestors();

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelectedIds(selectedIds.length === investors.length ? [] : investors.map(i => i.id));
  };

  const activityColors: Record<string, string> = {
    vip: 'bg-purple-100 text-purple-800',
    high: 'bg-green-100 text-green-800',
    medium: 'bg-blue-100 text-blue-800',
    low: 'bg-yellow-100 text-yellow-800',
    new: 'bg-gray-100 text-gray-800'
  };

  const stats = {
    total: total,
    active: investors.filter(i => ['high', 'vip'].includes(i.activity_level)).length,
    avgScore: Math.round(investors.reduce((a, b) => a + b.engagement_score, 0) / (investors.length || 1))
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeView} onValueChange={setActiveView}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-2"><List className="w-4 h-4" />List View</TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-2"><GitBranch className="w-4 h-4" />Pipeline</TabsTrigger>
            <TabsTrigger value="referrals" className="gap-2"><Gift className="w-4 h-4" />Referrals</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCSVUpload(true)}><Upload className="w-4 h-4 mr-2" />Import CSV</Button>
            <Button className="bg-[#d4a574]" onClick={() => setShowBulkEmail(true)} disabled={selectedIds.length === 0}><Mail className="w-4 h-4 mr-2" />Email ({selectedIds.length})</Button>
          </div>
        </div>

        <TabsContent value="pipeline" className="mt-0">
          <InvestorPipelineTab />
        </TabsContent>

        <TabsContent value="referrals" className="mt-0">
          <ReferralAnalyticsTab />
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><Users className="w-8 h-8 text-[#d4a574]" /><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-gray-500">Total</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><TrendingUp className="w-8 h-8 text-green-500" /><div><p className="text-2xl font-bold">{stats.active}</p><p className="text-sm text-gray-500">Active</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><TrendingUp className="w-8 h-8 text-blue-500" /><div><p className="text-2xl font-bold">{stats.avgScore}</p><p className="text-sm text-gray-500">Avg Score</p></div></div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><Mail className="w-8 h-8 text-purple-500" /><div><p className="text-2xl font-bold">{selectedIds.length}</p><p className="text-sm text-gray-500">Selected</p></div></div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Investor List</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="pl-10" /></div>
                <Select value={activityFilter} onValueChange={setActivityFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="vip">VIP</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>
                <Button variant="outline" onClick={handleSearch}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="p-3 text-left"><input type="checkbox" checked={selectedIds.length === investors.length && investors.length > 0} onChange={selectAll} /></th><th className="p-3 text-left">Investor</th><th className="p-3 text-left">Budget</th><th className="p-3 text-left">Markets</th><th className="p-3 text-left">Activity</th><th className="p-3 text-left">Score</th><th className="p-3">Actions</th></tr></thead>
                  <tbody>
                    {investors.map(inv => (
                      <tr key={inv.id} className="border-t hover:bg-gray-50">
                        <td className="p-3"><input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={() => toggleSelect(inv.id)} /></td>
                        <td className="p-3"><p className="font-medium">{inv.full_name}</p><p className="text-sm text-gray-500">{inv.email}</p></td>
                        <td className="p-3 text-sm">${(inv.investment_budget_min/1000).toFixed(0)}k-${(inv.investment_budget_max/1000).toFixed(0)}k</td>
                        <td className="p-3"><div className="flex flex-wrap gap-1">{inv.preferred_markets?.slice(0, 2).map(m => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}</div></td>
                        <td className="p-3"><Badge className={activityColors[inv.activity_level]}>{inv.activity_level}</Badge></td>
                        <td className="p-3"><div className="flex items-center gap-2"><div className="w-12 bg-gray-200 rounded-full h-2"><div className="bg-[#d4a574] h-2 rounded-full" style={{ width: `${inv.engagement_score}%` }} /></div><span className="text-xs">{inv.engagement_score}</span></div></td>
                        <td className="p-3 text-center"><Button size="sm" variant="outline" onClick={() => setSelectedInvestor(inv)}>View</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedInvestor && <InvestorDetailModal investor={selectedInvestor} onClose={() => { setSelectedInvestor(null); fetchInvestors(); }} />}
      <BulkEmailModal open={showBulkEmail} onClose={() => setShowBulkEmail(false)} investorIds={selectedIds} onSent={() => { setSelectedIds([]); fetchInvestors(); }} />
      <CSVUploadModal open={showCSVUpload} onClose={() => setShowCSVUpload(false)} onImported={fetchInvestors} />
    </div>
  );
}

