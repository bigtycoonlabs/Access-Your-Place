import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Search,
  RefreshCw,
  Mail,
  Key,
  Unlock,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Phone,
  Calendar,
  ChevronRight,
  Send,
  Shield,
  AlertTriangle,
  ExternalLink,
  FileText,
  Reply
} from 'lucide-react';

interface SupportRequest {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  message: string;
  request_type: string;
  context: any;
  investor_id: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  conversation_history: any[];
  created_at: string;
  updated_at: string;
  investor?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    status: string;
    email_verified: boolean;
    account_locked: boolean;
    failed_login_attempts: number;
  };
  assigned_staff?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface Stats {
  open: number;
  in_progress: number;
  resolved: number;
  today: number;
  total: number;
}

interface SupportRequestsTabProps {
  staffId: string;
  staffName: string;
}

export function SupportRequestsTab({ staffId, staffName }: SupportRequestsTabProps) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  
  // Reply to investor state
  const [replyMessage, setReplyMessage] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadRequests();
    loadStats();
  }, [statusFilter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: {
          action: 'get_requests',
          status: statusFilter,
          search: searchQuery || undefined,
          limit: 100
        }
      });

      if (error) throw error;
      
      // Handle both data shapes - direct or nested
      const responseData = data?.error ? null : data;
      setRequests(responseData?.requests || []);
    } catch (err: any) {
      console.error('Error loading requests:', err);
      toast({ title: 'Error loading requests', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: { action: 'get_stats' }
      });
      if (!error && data?.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleSearch = () => {
    loadRequests();
  };

  const handleViewDetails = async (request: SupportRequest) => {
    setSelectedRequest(request);
    setDetailsOpen(true);
    setShowReplyForm(false);
    setReplyMessage('');
    setReplySubject('');
    
    // Load full details
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: { action: 'get_request_details', request_id: request.id }
      });
      if (!error && data?.request) {
        setSelectedRequest(data.request);
      }
    } catch (err) {
      console.error('Failed to load request details:', err);
    }
  };

  const handleAssignToMe = async (requestId: string) => {
    setActionLoading('assign');
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: {
          action: 'assign_request',
          request_id: requestId,
          staff_id: staffId
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({ title: 'Request assigned to you' });
      loadRequests();
      loadStats();
      
      if (selectedRequest?.id === requestId) {
        handleViewDetails({ ...selectedRequest, assigned_to: staffId, status: 'in_progress' });
      }
    } catch (err: any) {
      toast({ title: 'Error assigning request', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedRequest) return;
    
    setActionLoading('reply');
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: {
          action: 'reply_to_investor',
          request_id: selectedRequest.id,
          email: selectedRequest.email,
          reply_message: replyMessage,
          reply_subject: replySubject || `Re: Your Support Request - Access Your Place`,
          staff_id: staffId,
          staff_name: staffName
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const emailSent = data?.email_sent;
      toast({ 
        title: emailSent ? 'Reply Sent' : 'Reply Logged',
        description: emailSent 
          ? `Email reply sent to ${selectedRequest.email}` 
          : 'Reply logged but email delivery may have failed. Check logs.'
      });
      
      setReplyMessage('');
      setReplySubject('');
      setShowReplyForm(false);
      
      // Refresh the request details
      handleViewDetails(selectedRequest);
      loadRequests();
      loadStats();
    } catch (err: any) {
      toast({ title: 'Error sending reply', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendPasswordReset = async (email: string, requestId?: string) => {
    setActionLoading('password_reset');
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: {
          action: 'send_password_reset',
          email,
          request_id: requestId,
          staff_id: staffId,
          staff_name: staffName
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({ title: 'Password reset email sent', description: `Sent to ${email}` });
      
      if (requestId && selectedRequest) {
        handleViewDetails(selectedRequest);
      }
    } catch (err: any) {
      toast({ title: 'Error sending password reset', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendVerification = async (email: string, requestId?: string) => {
    setActionLoading('verification');
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: {
          action: 'resend_verification',
          email,
          request_id: requestId,
          staff_id: staffId,
          staff_name: staffName
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({ title: 'Verification email sent', description: `Sent to ${email}` });
      
      if (requestId && selectedRequest) {
        handleViewDetails(selectedRequest);
      }
    } catch (err: any) {
      toast({ title: 'Error sending verification', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlockAccount = async (email: string, requestId?: string) => {
    setActionLoading('unlock');
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: {
          action: 'unlock_account',
          email,
          request_id: requestId,
          staff_id: staffId,
          staff_name: staffName
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({ title: 'Account unlocked', description: `${email} can now log in` });
      
      if (requestId && selectedRequest) {
        handleViewDetails(selectedRequest);
      }
    } catch (err: any) {
      toast({ title: 'Error unlocking account', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedRequest) return;
    
    setActionLoading('note');
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: {
          action: 'add_message',
          request_id: selectedRequest.id,
          message: newNote,
          staff_id: staffId,
          staff_name: staffName,
          message_type: 'note'
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({ title: 'Note added' });
      setNewNote('');
      handleViewDetails(selectedRequest);
    } catch (err: any) {
      toast({ title: 'Error adding note', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!selectedRequest) return;
    
    setActionLoading('resolve');
    try {
      const { data, error } = await supabase.functions.invoke('manage-support-requests', {
        body: {
          action: 'update_status',
          request_id: selectedRequest.id,
          status: 'resolved',
          staff_id: staffId,
          resolution_notes: resolutionNotes
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({ title: 'Request resolved' });
      setResolveDialogOpen(false);
      setResolutionNotes('');
      setDetailsOpen(false);
      loadRequests();
      loadStats();
    } catch (err: any) {
      toast({ title: 'Error resolving request', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">Open</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">In Progress</Badge>;
      case 'resolved':
        return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return null;
    }
  };

  const getMessageIcon = (messageType: string) => {
    switch (messageType) {
      case 'email_sent': return <Mail className="w-4 h-4 text-blue-500" />;
      case 'reply_sent': return <Reply className="w-4 h-4 text-indigo-500" />;
      case 'action_taken': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={`cursor-pointer transition-all ${statusFilter === 'open' ? 'ring-2 ring-red-500' : ''}`} onClick={() => setStatusFilter('open')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Open</p>
                <p className="text-2xl font-bold text-red-600">{stats?.open || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={`cursor-pointer transition-all ${statusFilter === 'in_progress' ? 'ring-2 ring-amber-500' : ''}`} onClick={() => setStatusFilter('in_progress')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-amber-600">{stats?.in_progress || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={`cursor-pointer transition-all ${statusFilter === 'resolved' ? 'ring-2 ring-green-500' : ''}`} onClick={() => setStatusFilter('resolved')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{stats?.resolved || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setStatusFilter('all')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.total || 0}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today</p>
                <p className="text-2xl font-bold text-purple-600">{stats?.today || 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#d4a574]" />
                Support Requests
              </CardTitle>
              <CardDescription>
                Help investors with login issues, password resets, and account problems
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input aria-label="Search by email or name"
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="icon" aria-label="Refresh support requests" onClick={() => { loadRequests(); loadStats(); }}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
              <p className="text-gray-500">No {statusFilter !== 'all' ? statusFilter.replace('_', ' ') : ''} support requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleViewDetails(request)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[#1a365d]">{request.name || 'Unknown User'}</span>
                        {getStatusBadge(request.status)}
                        {request.priority === 'high' && getPriorityBadge(request.priority)}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{request.email}</p>
                      <p className="text-sm text-gray-500 line-clamp-2">{request.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(request.created_at)}
                        </span>
                        {request.context?.failed_login_attempts && (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="w-3 h-3" />
                            {request.context.failed_login_attempts} failed attempts
                          </span>
                        )}
                        {request.investor && (
                          <span className="flex items-center gap-1 text-green-600">
                            <User className="w-3 h-3" />
                            Existing investor
                          </span>
                        )}
                        {request.assigned_staff && (
                          <span className="text-blue-600">
                            Assigned to: {request.assigned_staff.full_name}
                          </span>
                        )}
                        {(request.conversation_history?.length || 0) > 0 && (
                          <span className="flex items-center gap-1 text-indigo-600">
                            <MessageSquare className="w-3 h-3" />
                            {request.conversation_history.length} update{request.conversation_history.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Support Request Details
              {selectedRequest && getStatusBadge(selectedRequest.status)}
            </DialogTitle>
            <DialogDescription>
              Review and take action on this support request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Name</Label>
                    <p className="font-medium">{selectedRequest.name || 'Not provided'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Email</Label>
                    <p className="font-medium">{selectedRequest.email}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Phone</Label>
                    <p className="font-medium">{selectedRequest.phone || 'Not provided'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Submitted</Label>
                    <p className="font-medium">{formatDate(selectedRequest.created_at)}</p>
                  </div>
                </div>

                {/* Original Message */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <Label className="text-xs text-gray-500 mb-2 block">Original Message</Label>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedRequest.message}</p>
                </div>

                {/* Context Info */}
                {selectedRequest.context && Object.keys(selectedRequest.context).length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <Label className="text-xs text-amber-700 mb-2 block">Additional Context</Label>
                    <div className="space-y-1 text-sm">
                      {selectedRequest.context.failed_login_attempts && (
                        <p className="text-amber-800">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          {selectedRequest.context.failed_login_attempts} failed login attempts
                        </p>
                      )}
                      {selectedRequest.context.last_attempt_email && (
                        <p className="text-amber-800">Last attempted email: {selectedRequest.context.last_attempt_email}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Investor Account Info */}
                {selectedRequest.investor && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <Label className="text-xs text-blue-700 mb-2 block">Linked Investor Account</Label>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Name:</span>{' '}
                        <span className="font-medium">{selectedRequest.investor.full_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>{' '}
                        <Badge variant="outline" className="ml-1">{selectedRequest.investor.status}</Badge>
                      </div>
                      <div>
                        <span className="text-gray-500">Email Verified:</span>{' '}
                        {selectedRequest.investor.email_verified ? (
                          <Badge className="bg-green-100 text-green-700 ml-1">Yes</Badge>
                        ) : (
                          <Badge variant="destructive" className="ml-1">No</Badge>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500">Account Locked:</span>{' '}
                        {selectedRequest.investor.account_locked ? (
                          <Badge variant="destructive" className="ml-1">Locked</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 ml-1">Active</Badge>
                        )}
                      </div>
                      {selectedRequest.investor.failed_login_attempts > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Failed Login Attempts:</span>{' '}
                          <span className="font-medium text-red-600">{selectedRequest.investor.failed_login_attempts}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="border rounded-lg p-4">
                  <Label className="text-xs text-gray-500 mb-3 block">Quick Actions</Label>
                  <div className="flex flex-wrap gap-2">
                    {/* REPLY TO INVESTOR - Primary action */}
                    <Button
                      size="sm"
                      onClick={() => setShowReplyForm(!showReplyForm)}
                      className={showReplyForm ? 'bg-indigo-700 hover:bg-indigo-800' : 'bg-indigo-600 hover:bg-indigo-700'}
                    >
                      <Reply className="w-4 h-4 mr-2" />
                      Reply to Investor
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendPasswordReset(selectedRequest.email, selectedRequest.id)}
                      disabled={actionLoading === 'password_reset'}
                    >
                      {actionLoading === 'password_reset' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Key className="w-4 h-4 mr-2" />
                      )}
                      Send Password Reset
                    </Button>
                    
                    {selectedRequest.investor && !selectedRequest.investor.email_verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendVerification(selectedRequest.email, selectedRequest.id)}
                        disabled={actionLoading === 'verification'}
                      >
                        {actionLoading === 'verification' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4 mr-2" />
                        )}
                        Resend Verification
                      </Button>
                    )}
                    
                    {selectedRequest.investor && (selectedRequest.investor.account_locked || selectedRequest.investor.failed_login_attempts > 0) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlockAccount(selectedRequest.email, selectedRequest.id)}
                        disabled={actionLoading === 'unlock'}
                        className="border-green-300 text-green-700 hover:bg-green-50"
                      >
                        {actionLoading === 'unlock' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Unlock className="w-4 h-4 mr-2" />
                        )}
                        Unlock Account
                      </Button>
                    )}
                    
                    {selectedRequest.status === 'open' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignToMe(selectedRequest.id)}
                        disabled={actionLoading === 'assign'}
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        {actionLoading === 'assign' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <User className="w-4 h-4 mr-2" />
                        )}
                        Assign to Me
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reply to Investor Form */}
                {showReplyForm && selectedRequest.status !== 'resolved' && (
                  <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50/50">
                    <Label className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                      <Reply className="w-4 h-4" />
                      Send Email Reply to {selectedRequest.name || selectedRequest.email}
                    </Label>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-gray-600" htmlFor="subject-optional">Subject (optional)</Label>
                        <Input id="subject-optional"
                          placeholder="Re: Your Support Request - Access Your Place"
                          value={replySubject}
                          onChange={(e) => setReplySubject(e.target.value)}
                          className="bg-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600" htmlFor="message">Message</Label>
                        <Textarea id="message"
                          placeholder="Type your reply to the investor... This will be sent as an email."
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          className="bg-white min-h-[120px]"
                          rows={5}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-indigo-600 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          Will be sent to: {selectedRequest.email}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setShowReplyForm(false); setReplyMessage(''); setReplySubject(''); }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSendReply}
                            disabled={!replyMessage.trim() || actionLoading === 'reply'}
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            {actionLoading === 'reply' ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4 mr-2" />
                            )}
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conversation History */}
                {selectedRequest.conversation_history && selectedRequest.conversation_history.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <Label className="text-xs text-gray-500 mb-3 block">Activity Log ({selectedRequest.conversation_history.length})</Label>
                    <div className="space-y-3">
                      {selectedRequest.conversation_history.map((entry: any, index: number) => (
                        <div key={entry.id || index} className={`flex gap-3 text-sm ${entry.message_type === 'reply_sent' ? 'bg-indigo-50 p-3 rounded-lg border border-indigo-100' : ''}`}>
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            {getMessageIcon(entry.message_type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{entry.staff_name || 'System'}</span>
                              {entry.message_type === 'reply_sent' && (
                                <Badge className="bg-indigo-100 text-indigo-700 text-xs">Email Reply</Badge>
                              )}
                              {entry.message_type === 'email_sent' && (
                                <Badge className="bg-blue-100 text-blue-700 text-xs">Email Sent</Badge>
                              )}
                              {entry.message_type === 'action_taken' && (
                                <Badge className="bg-green-100 text-green-700 text-xs">Action</Badge>
                              )}
                              <span className="text-xs text-gray-400">{formatDate(entry.created_at)}</span>
                            </div>
                            <p className="text-gray-600 mt-1 whitespace-pre-wrap">{entry.message}</p>
                            {entry.email_sent === false && entry.message_type === 'reply_sent' && (
                              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Email delivery may have failed
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Internal Note */}
                {selectedRequest.status !== 'resolved' && (
                  <div className="border rounded-lg p-4">
                    <Label className="text-xs text-gray-500 mb-2 block" htmlFor="add-internal-note">Add Internal Note</Label>
                    <div className="flex gap-2">
                      <Textarea id="add-internal-note"
                        placeholder="Add an internal note (not visible to investor)..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="flex-1"
                        rows={2}
                      />
                      <Button
                        onClick={handleAddNote}
                        disabled={!newNote.trim() || actionLoading === 'note'}
                        className="bg-[#1a365d]"
                      >
                        {actionLoading === 'note' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Resolution Notes (if resolved) */}
                {selectedRequest.status === 'resolved' && selectedRequest.resolution_notes && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <Label className="text-xs text-green-700 mb-2 block">Resolution Notes</Label>
                    <p className="text-green-800">{selectedRequest.resolution_notes}</p>
                    {selectedRequest.resolved_at && (
                      <p className="text-xs text-green-600 mt-2">
                        Resolved on {formatDate(selectedRequest.resolved_at)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
            {selectedRequest && selectedRequest.status !== 'resolved' && (
              <Button
                onClick={() => setResolveDialogOpen(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark as Resolved
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Confirmation Dialog */}
      <AlertDialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve Support Request</AlertDialogTitle>
            <AlertDialogDescription>
              Add any final notes about how this issue was resolved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea aria-label="Resolution notes (optional)"
              placeholder="Resolution notes (optional)..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResolve}
              disabled={actionLoading === 'resolve'}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading === 'resolve' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Resolve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
