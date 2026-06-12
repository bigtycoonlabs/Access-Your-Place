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
import { LandlordDetailModal } from './LandlordDetailModal';
import { BulkEmailModal } from './BulkEmailModal';
import { CSVUploadModal } from './CSVUploadModal';
import { InvestorPipelineTab } from './InvestorPipelineTab';
import { ReferralAnalyticsTab } from './ReferralAnalyticsTab';
import { 
  Search, Upload, Mail, Users, TrendingUp, RefreshCw, GitBranch, 
  List, Gift, Building, Phone, Download, UserPlus, Filter, MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Contact {
  id: string;
  type: 'investor' | 'landlord' | 'lead';
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  status?: string;
  activity_level?: string;
  engagement_score?: number;
  tags?: string[];
  created_at: string;
  last_activity_at?: string;
  // Investor specific
  investment_budget_min?: number;
  investment_budget_max?: number;
  preferred_markets?: string[];
  total_inquiries?: number;
  total_acquisitions?: number;
  // Landlord specific
  total_communications?: number;
  response_rate?: number;
  // Lead specific
  form_type?: string;
  data?: any;
}

export function UnifiedCRMTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'investor' | 'landlord' | 'lead'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [showAddLandlord, setShowAddLandlord] = useState(false);
  const [activeView, setActiveView] = useState('list');
  const [stats, setStats] = useState({ total: 0, investors: 0, landlords: 0, leads: 0 });
  const { toast } = useToast();

  useEffect(() => { 
    fetchAllContacts(); 
  }, [typeFilter, statusFilter]);

  const fetchAllContacts = async () => {
    setLoading(true);
    const allContacts: Contact[] = [];

    try {
      // Fetch investors
      if (typeFilter === 'all' || typeFilter === 'investor') {
        const { data: investorData } = await supabase.functions.invoke('manage-investor-crm', {
          body: { action: 'list', search, activity_level: statusFilter === 'all' ? undefined : statusFilter }
        });
        if (investorData?.investors) {
          allContacts.push(...investorData.investors.map((inv: any) => ({
            ...inv,
            type: 'investor' as const,
            name: inv.full_name,
            status: inv.activity_level
          })));
        }
      }

      // Fetch landlords
      if (typeFilter === 'all' || typeFilter === 'landlord') {
        const { data: landlordData } = await supabase.functions.invoke('manage-landlords', {
          body: { action: 'list' }
        });
        if (landlordData?.landlords) {
          allContacts.push(...landlordData.landlords.map((ll: any) => ({
            ...ll,
            type: 'landlord' as const
          })));
        }
      }

      // Fetch leads
      if (typeFilter === 'all' || typeFilter === 'lead') {
        const { data: leadData } = await supabase.functions.invoke('get-leads');
        if (leadData?.leads) {
          allContacts.push(...leadData.leads.map((lead: any) => ({
            ...lead,
            type: 'lead' as const,
            status: 'new'
          })));
        }
      }

      // Apply search filter
      const filtered = search 
        ? allContacts.filter(c => 
            c.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.email?.toLowerCase().includes(search.toLowerCase()) ||
            c.company_name?.toLowerCase().includes(search.toLowerCase())
          )
        : allContacts;

      // Sort by most recent
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setContacts(filtered);
      setStats({
        total: filtered.length,
        investors: filtered.filter(c => c.type === 'investor').length,
        landlords: filtered.filter(c => c.type === 'landlord').length,
        leads: filtered.filter(c => c.type === 'lead').length
      });
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({ title: 'Error loading contacts', variant: 'destructive' });
    }

    setLoading(false);
  };

  const handleSearch = () => fetchAllContacts();

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelectedIds(selectedIds.length === contacts.length ? [] : contacts.map(c => c.id));
  };

  const exportContacts = () => {
    const csv = [
      ['Type', 'Name', 'Email', 'Phone', 'Company', 'Status', 'Created'],
      ...contacts.map(c => [
        c.type,
        c.name,
        c.email,
        c.phone || '',
        c.company_name || '',
        c.status || c.activity_level || '',
        new Date(c.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${Date.now()}.csv`;
    a.click();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'investor': return 'bg-blue-100 text-blue-800';
      case 'landlord': return 'bg-green-100 text-green-800';
      case 'lead': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vip': return 'bg-purple-100 text-purple-800';
      case 'high': case 'active': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': case 'inactive': return 'bg-yellow-100 text-yellow-800';
      case 'new': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeView} onValueChange={setActiveView}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-2"><List className="w-4 h-4" />All Contacts</TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-2"><GitBranch className="w-4 h-4" />Pipeline</TabsTrigger>
            <TabsTrigger value="referrals" className="gap-2"><Gift className="w-4 h-4" />Referrals</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddLandlord(true)}>
              <UserPlus className="w-4 h-4 mr-2" />Add Contact
            </Button>
            <Button variant="outline" onClick={() => setShowCSVUpload(true)}>
              <Upload className="w-4 h-4 mr-2" />Import
            </Button>
            <Button variant="outline" onClick={exportContacts}>
              <Download className="w-4 h-4 mr-2" />Export
            </Button>
            <Button 
              className="bg-[#d4a574]" 
              onClick={() => setShowBulkEmail(true)} 
              disabled={selectedIds.length === 0}
            >
              <Mail className="w-4 h-4 mr-2" />Email ({selectedIds.length})
            </Button>
          </div>
        </div>

        <TabsContent value="pipeline" className="mt-0">
          <InvestorPipelineTab />
        </TabsContent>

        <TabsContent value="referrals" className="mt-0">
          <ReferralAnalyticsTab />
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="cursor-pointer hover:border-[#d4a574] transition-colors" onClick={() => setTypeFilter('all')}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-[#d4a574]" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-gray-500">All Contacts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setTypeFilter('investor')}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.investors}</p>
                    <p className="text-sm text-gray-500">Investors</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-green-500 transition-colors" onClick={() => setTypeFilter('landlord')}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Building className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.landlords}</p>
                    <p className="text-sm text-gray-500">Landlords</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-yellow-500 transition-colors" onClick={() => setTypeFilter('lead')}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-8 h-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.leads}</p>
                    <p className="text-sm text-gray-500">Leads</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Unified Contact List
                {typeFilter !== 'all' && (
                  <Badge variant="outline" className="ml-2 capitalize">{typeFilter}s</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Search by name, email, or company..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSearch()} 
                    className="pl-10" 
                  />
                </div>
                <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                  <SelectTrigger className="w-40">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="investor">Investors</SelectItem>
                    <SelectItem value="landlord">Landlords</SelectItem>
                    <SelectItem value="lead">Leads</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleSearch}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Contact Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.length === contacts.length && contacts.length > 0} 
                          onChange={selectAll} 
                        />
                      </th>
                      <th className="p-3 text-left">Contact</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Details</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Added</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading contacts...
                        </td>
                      </tr>
                    ) : contacts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500">
                          No contacts found
                        </td>
                      </tr>
                    ) : (
                      contacts.map(contact => (
                        <tr key={`${contact.type}-${contact.id}`} className="border-t hover:bg-gray-50">
                          <td className="p-3">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(contact.id)} 
                              onChange={() => toggleSelect(contact.id)} 
                            />
                          </td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-sm text-gray-500">{contact.email}</p>
                              {contact.phone && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />{contact.phone}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge className={getTypeColor(contact.type)}>
                              {contact.type}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm">
                            {contact.type === 'investor' && contact.preferred_markets && (
                              <div className="flex flex-wrap gap-1">
                                {contact.preferred_markets.slice(0, 2).map(m => (
                                  <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                                ))}
                                {contact.preferred_markets.length > 2 && (
                                  <Badge variant="outline" className="text-xs">+{contact.preferred_markets.length - 2}</Badge>
                                )}
                              </div>
                            )}
                            {contact.type === 'investor' && contact.investment_budget_max && (
                              <p className="text-gray-500 mt-1">
                                Budget: ${(contact.investment_budget_min || 0)/1000}k-${contact.investment_budget_max/1000}k
                              </p>
                            )}
                            {contact.type === 'landlord' && contact.company_name && (
                              <p className="text-gray-600">{contact.company_name}</p>
                            )}
                            {contact.type === 'lead' && contact.form_type && (
                              <p className="text-gray-600">From: {contact.form_type}</p>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge className={getStatusColor(contact.status || contact.activity_level || 'new')}>
                              {contact.status || contact.activity_level || 'new'}
                            </Badge>
                            {contact.engagement_score !== undefined && (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className="bg-[#d4a574] h-1.5 rounded-full" 
                                    style={{ width: `${contact.engagement_score}%` }} 
                                  />
                                </div>
                                <span className="text-xs text-gray-500">{contact.engagement_score}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-sm text-gray-500">
                            {new Date(contact.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleContactClick(contact)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedIds([contact.id]);
                                  setShowBulkEmail(true);
                                }}>
                                  Send Email
                                </DropdownMenuItem>
                                {contact.phone && (
                                  <DropdownMenuItem onClick={() => window.open(`tel:${contact.phone}`)}>
                                    Call
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination info */}
              <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
                <p>Showing {contacts.length} contacts</p>
                <p>{selectedIds.length} selected</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {selectedContact && selectedContact.type === 'investor' && (
        <InvestorDetailModal 
          investor={selectedContact as any} 
          onClose={() => { setSelectedContact(null); fetchAllContacts(); }} 
        />
      )}
      
      {selectedContact && selectedContact.type === 'landlord' && (
        <LandlordDetailModal 
          landlord={selectedContact} 
          onClose={() => { setSelectedContact(null); fetchAllContacts(); }} 
        />
      )}

      {showAddLandlord && (
        <LandlordDetailModal 
          landlord={null} 
          onClose={() => { setShowAddLandlord(false); fetchAllContacts(); }} 
          isNew 
        />
      )}

      <BulkEmailModal 
        open={showBulkEmail} 
        onClose={() => setShowBulkEmail(false)} 
        investorIds={selectedIds} 
        onSent={() => { setSelectedIds([]); fetchAllContacts(); }} 
      />
      
      <CSVUploadModal 
        open={showCSVUpload} 
        onClose={() => setShowCSVUpload(false)} 
        onImported={fetchAllContacts} 
      />
    </div>
  );
}
