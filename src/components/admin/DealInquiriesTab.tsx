import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { InquiryStats } from './InquiryStats';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Mail, Phone, MapPin, MessageSquare, Calendar } from 'lucide-react';

interface Inquiry {
  id: string;
  investor_name: string;
  investor_email: string;
  investor_phone?: string;
  message?: string;
  investment_type: string;
  status: string;
  staff_notes?: string;
  created_at: string;
  contacted_at?: string;
  properties?: { id: string; listing_title: string; city: string; state: string; bedrooms: number };
}

export function DealInquiriesTab() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [statistics, setStatistics] = useState({ total: 0, new: 0, contacted: 0, qualified: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [noteText, setNoteText] = useState('');
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchInquiries(); }, [statusFilter]);

  const fetchInquiries = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('manage-deal-inquiries', {
      body: { action: 'list', status_filter: statusFilter }
    });
    if (data) {
      setInquiries(data.inquiries || []);
      setStatistics(data.statistics || { total: 0, new: 0, contacted: 0, qualified: 0, closed: 0 });
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    const { error } = await supabase.functions.invoke('manage-deal-inquiries', {
      body: { action: 'update_status', inquiry_id: id, status }
    });
    if (error) toast({ title: 'Error', variant: 'destructive' });
    else { toast({ title: `Status updated to ${status}` }); fetchInquiries(); }
    setUpdating(false);
  };

  const addNote = async () => {
    if (!selectedInquiry || !noteText.trim()) return;
    setUpdating(true);
    const { error } = await supabase.functions.invoke('manage-deal-inquiries', {
      body: { action: 'add_note', inquiry_id: selectedInquiry.id, notes: noteText }
    });
    if (error) toast({ title: 'Error', variant: 'destructive' });
    else { toast({ title: 'Note added' }); setNoteText(''); fetchInquiries(); setSelectedInquiry(null); }
    setUpdating(false);
  };

  const filtered = inquiries.filter(i => !search || i.investor_name.toLowerCase().includes(search.toLowerCase()) || i.investor_email.toLowerCase().includes(search.toLowerCase()));

  const statusColors: Record<string, string> = { new: 'bg-yellow-500', contacted: 'bg-purple-500', qualified: 'bg-green-500', closed: 'bg-gray-500' };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div><CardTitle>Deal Inquiries</CardTitle><CardDescription>Manage investor inquiries</CardDescription></div>
          <Button onClick={fetchInquiries} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
        </div>
      </CardHeader>
      <CardContent>
        <InquiryStats statistics={statistics} />
        <div className="flex gap-3 mb-4">
          <Input aria-label="Search by name or email" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
          <div className="space-y-3">
            {filtered.map(inq => (
              <div key={inq.id} className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{inq.investor_name}</h4>
                      <Badge className={statusColors[inq.status]}>{inq.status}</Badge>
                      <Badge variant="outline">{inq.investment_type}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{inq.investor_email}</span>
                      {inq.investor_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{inq.investor_phone}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(inq.created_at).toLocaleDateString()}</span>
                    </div>
                    {inq.properties && <p className="text-sm mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" />{inq.properties.listing_title || `${inq.properties.bedrooms}BR`} - {inq.properties.city}, {inq.properties.state}</p>}
                    {inq.message && <p className="text-sm mt-2 text-gray-700 bg-gray-50 p-2 rounded"><MessageSquare className="w-3 h-3 inline mr-1" />{inq.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Select value={inq.status} onValueChange={(v) => updateStatus(inq.id, v)}>
                      <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => setSelectedInquiry(inq)}>Add Note</Button>
                  </div>
                </div>
                {inq.staff_notes && <div className="mt-3 pt-3 border-t text-sm text-gray-600"><strong>Notes:</strong><pre className="whitespace-pre-wrap mt-1">{inq.staff_notes}</pre></div>}
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center py-8 text-gray-500">No inquiries found</p>}
          </div>
        )}
      </CardContent>
      <Dialog open={!!selectedInquiry} onOpenChange={() => setSelectedInquiry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Note for {selectedInquiry?.investor_name}</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Enter your note..." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedInquiry(null)}>Cancel</Button>
            <Button onClick={addNote} disabled={updating || !noteText.trim()} className="bg-[#d4a574]">{updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
