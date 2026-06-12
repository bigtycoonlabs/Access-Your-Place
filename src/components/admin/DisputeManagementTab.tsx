import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Search, Filter, MessageSquare, Clock, CheckCircle, 
  XCircle, AlertTriangle, Eye, Send, FileText, BarChart3, User
} from 'lucide-react';
import { SOPHelpButton } from './SOPHelpButton';


interface Dispute {
  id: string;
  investor_id: string;
  category: string;
  subcategory: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assigned_staff_id: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  investors?: { full_name: string; email: string; phone: string };
  staff_users?: { first_name: string; last_name: string };
}

interface DisputeMessage {
  id: string;
  sender_type: string;
  sender_name: string;
  message: string;
  is_internal: boolean;
  created_at: string;
}

interface DisputeStats {
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  avg_resolution_hours: number;
  resolved_count: number;
}

interface Props {
  staffId: string;
  staffName: string;
}

const CATEGORIES = [
  { value: 'operation_delays', label: 'Operation Delays' },
  { value: 'credit_request', label: 'Credit Requests' },
  { value: 'refund_request', label: 'Refund Requests' },
  { value: 'property_verification', label: 'Property Verification' },
  { value: 'corporate_application', label: 'Corporate Applications' },
  { value: 'operator_dispute', label: 'Operator Disputes' },
  { value: 'vendor_issue', label: 'Vendor Issues' },
  { value: 'other', label: 'Other Issues' }
];

const STATUSES = [
  { value: 'submitted', label: 'Submitted', color: 'bg-gray-500' },
  { value: 'under_review', label: 'Under Review', color: 'bg-blue-500' },
  { value: 'awaiting_response', label: 'Awaiting Response', color: 'bg-yellow-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-400' }
];

export function DisputeManagementTab({ staffId, staffName }: Props) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [stats, setStats] = useState<DisputeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Response form
  const [responseMessage, setResponseMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sendingResponse, setSendingResponse] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    loadDisputes();
    loadStats();
  }, [statusFilter, categoryFilter]);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-disputes', {
        body: { 
          action: 'get_all_disputes',
          status: statusFilter,
          category: categoryFilter,
          limit: 100
        }
      });
      if (data?.disputes) {
        setDisputes(data.disputes);
      }
    } catch (err) {
      console.error('Error loading disputes:', err);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const { data } = await supabase.functions.invoke('manage-disputes', {
        body: { action: 'get_stats' }
      });
      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadDisputeDetails = async (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setNewStatus(dispute.status);
    setResolutionNotes(dispute.resolution_notes || '');
    setDetailOpen(true);
    setLoadingMessages(true);
    
    try {
      const { data } = await supabase.functions.invoke('manage-disputes', {
        body: { 
          action: 'get_dispute_details',
          dispute_id: dispute.id,
          include_internal: true
        }
      });
      if (data?.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
    setLoadingMessages(false);
  };

  const handleSendResponse = async () => {
    if (!selectedDispute || !responseMessage.trim()) return;

    setSendingResponse(true);
    try {
      const { data } = await supabase.functions.invoke('manage-disputes', {
        body: {
          action: 'add_message',
          dispute_id: selectedDispute.id,
          sender_type: 'staff',
          sender_id: staffId,
          sender_name: staffName,
          message: responseMessage,
          is_internal: isInternal
        }
      });

      if (data?.success) {
        toast({ title: isInternal ? 'Internal note added' : 'Response sent to investor' });
        setResponseMessage('');
        setIsInternal(false);
        // Reload messages
        const { data: msgData } = await supabase.functions.invoke('manage-disputes', {
          body: { 
            action: 'get_dispute_details',
            dispute_id: selectedDispute.id,
            include_internal: true
          }
        });
        if (msgData?.messages) {
          setMessages(msgData.messages);
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSendingResponse(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedDispute) return;

    try {
      const { data } = await supabase.functions.invoke('manage-disputes', {
        body: {
          action: 'update_status',
          dispute_id: selectedDispute.id,
          status: newStatus,
          resolution_notes: resolutionNotes,
          assigned_staff_id: staffId
        }
      });

      if (data?.success) {
        toast({ title: 'Dispute updated' });
        loadDisputes();
        setSelectedDispute({ ...selectedDispute, status: newStatus, resolution_notes: resolutionNotes });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find(st => st.value === status);
    return <Badge className={s?.color || 'bg-gray-500'}>{s?.label || status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[priority] || colors.medium}`}>
        {priority?.charAt(0).toUpperCase() + priority?.slice(1)}
      </span>
    );
  };

  const filteredDisputes = disputes.filter(d => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return d.subject.toLowerCase().includes(query) ||
             d.description.toLowerCase().includes(query) ||
             d.investors?.full_name?.toLowerCase().includes(query) ||
             d.investors?.email?.toLowerCase().includes(query);
    }
    return true;
  });

  return (
    <div className="space-y-6" role="main" aria-label="Dispute Management">
      {/* Stats Overview */}
      {stats && (
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">Dispute Statistics</h2>
          <div className="grid md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg" aria-hidden="true">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Disputes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg" aria-hidden="true">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.by_status?.submitted || 0}</p>
                    <p className="text-sm text-muted-foreground">New</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg" aria-hidden="true">
                    <AlertTriangle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.by_status?.under_review || 0}</p>
                    <p className="text-sm text-muted-foreground">Under Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg" aria-hidden="true">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.resolved_count}</p>
                    <p className="text-sm text-muted-foreground">Resolved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg" aria-hidden="true">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.avg_resolution_hours}h</p>
                    <p className="text-sm text-muted-foreground">Avg Resolution</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}


      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dispute Management</CardTitle>
              <CardDescription>Review and resolve investor disputes and issues</CardDescription>
            </div>
            <SOPHelpButton
              sopKey="Dispute Resolution"
              category="Dispute Resolution"
              userRole="Success_Team"
              buttonText="Dispute SOP"
              ariaLabel="View Dispute Resolution SOP"
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search" className="sr-only">Search disputes</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <Input
                  id="search"
                  placeholder="Search by subject, investor name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-[180px]">
              <Label htmlFor="status-filter" className="sr-only">Filter by status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Label htmlFor="category-filter" className="sr-only">Filter by category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" aria-label="Loading disputes" />
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
              <p className="font-medium">No disputes found</p>
              <p className="text-sm">Adjust your filters or check back later</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Investor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDisputes.map(dispute => (
                    <TableRow key={dispute.id}>
                      <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                      <TableCell>{getPriorityBadge(dispute.priority)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{dispute.subject}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{dispute.investors?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{dispute.investors?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {CATEGORIES.find(c => c.value === dispute.category)?.label || dispute.category}
                      </TableCell>
                      <TableCell>{new Date(dispute.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadDisputeDetails(dispute)}
                          aria-label={`View details for ${dispute.subject}`}
                        >
                          <Eye className="w-4 h-4 mr-1" aria-hidden="true" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dispute Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="dispute-detail-desc">
          {selectedDispute && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(selectedDispute.status)}
                  {getPriorityBadge(selectedDispute.priority)}
                </div>
                <DialogTitle>{selectedDispute.subject}</DialogTitle>
                <DialogDescription id="dispute-detail-desc">
                  Case #{selectedDispute.id.slice(0, 8)} • {selectedDispute.investors?.full_name} ({selectedDispute.investors?.email})
                </DialogDescription>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column - Details & Messages */}
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Original Issue</h4>
                    <p className="text-gray-600 text-sm">{selectedDispute.description}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      <p>Category: {CATEGORIES.find(c => c.value === selectedDispute.category)?.label}</p>
                      <p>Submitted: {new Date(selectedDispute.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-3">Communication History</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto border rounded-lg p-3" role="log" aria-label="Message history">
                      {loadingMessages ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin" aria-label="Loading messages" />
                        </div>
                      ) : messages.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No messages yet</p>
                      ) : (
                        messages.map(msg => (
                          <div 
                            key={msg.id}
                            className={`p-3 rounded-lg ${
                              msg.is_internal 
                                ? 'bg-yellow-50 border border-yellow-200' 
                                : msg.sender_type === 'investor' 
                                  ? 'bg-gray-100' 
                                  : 'bg-blue-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm flex items-center gap-1">
                                {msg.is_internal && <span className="text-yellow-600">[Internal]</span>}
                                {msg.sender_name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(msg.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{msg.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Send Response */}
                  <div className="border-t pt-4">
                    <Label htmlFor="response-message">Send Response</Label>
                    <Textarea
                      id="response-message"
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      placeholder="Type your response..."
                      rows={3}
                      className="mt-1"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded"
                        />
                        Internal note (not visible to investor)
                      </label>
                      <Button 
                        onClick={handleSendResponse}
                        disabled={sendingResponse || !responseMessage.trim()}
                        size="sm"
                      >
                        {sendingResponse && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                        <Send className="w-4 h-4 mr-1" aria-hidden="true" />
                        Send
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right Column - Status & Resolution */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Update Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="new-status">Status</Label>
                        <Select value={newStatus} onValueChange={setNewStatus}>
                          <SelectTrigger id="new-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="resolution-notes">Resolution Notes</Label>
                        <Textarea
                          id="resolution-notes"
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Add resolution notes (visible to investor when resolved)..."
                          rows={4}
                        />
                      </div>

                      <Button onClick={handleUpdateStatus} className="w-full">
                        Update Dispute
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Investor Info</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" aria-hidden="true" />
                          <span>{selectedDispute.investors?.full_name}</span>
                        </div>
                        <p className="text-gray-600">{selectedDispute.investors?.email}</p>
                        {selectedDispute.investors?.phone && (
                          <p className="text-gray-600">{selectedDispute.investors?.phone}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
