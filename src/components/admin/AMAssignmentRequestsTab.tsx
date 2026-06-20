import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  Loader2, CheckCircle, XCircle, Clock, Search, User, Mail, 
  Phone, Calendar, UserPlus, AlertTriangle, UserCheck, RefreshCw,
  MessageSquare, ArrowRight
} from 'lucide-react';

interface AMAssignmentRequest {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  investor_phone?: string;
  am_first_name: string;
  am_last_name: string;
  notes?: string;
  status: 'pending' | 'matched' | 'rejected';
  requested_at: string;
  matched_staff_id?: string;
  matched_at?: string;
  matched_by?: string;
}

interface AMChangeRequest {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  current_am_id?: string;
  current_am_name?: string;
  reason: string;
  preferred_am_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  department: string;
  investor_count?: number;
}

interface Props {
  staffId: string;
  staffName: string;
}

export function AMAssignmentRequestsTab({ staffId, staffName }: Props) {
  const [assignmentRequests, setAssignmentRequests] = useState<AMAssignmentRequest[]>([]);
  const [changeRequests, setChangeRequests] = useState<AMChangeRequest[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Match modal state
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AMAssignmentRequest | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [matchNotes, setMatchNotes] = useState('');
  
  // Change request modal state
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<AMChangeRequest | null>(null);
  const [newAMId, setNewAMId] = useState('');
  const [changeResponseNotes, setChangeResponseNotes] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Try the new dedicated manage-am-assignments function first for AM data
      const [requestsRes, changeRes, amsRes] = await Promise.all([
        supabase.functions.invoke('manage-am-assignments', {
          body: { action: 'get_am_assignment_requests' }
        }),
        supabase.functions.invoke('manage-am-assignments', {
          body: { action: 'get_am_assignment_requests', status: 'all' }
        }).catch(() => ({ data: { requests: [] } })),
        supabase.functions.invoke('manage-am-assignments', {
          body: { action: 'get_acquisition_managers_with_counts' }
        })
      ]);

      // Handle assignment requests
      if (requestsRes.data?.success && requestsRes.data?.requests) {
        setAssignmentRequests(requestsRes.data.requests);
      } else {
        // Fallback to manage-staff
        const { data: fallbackData } = await supabase.functions.invoke('manage-staff', {
          body: { action: 'get_am_assignment_requests' }
        });
        if (fallbackData?.requests) {
          setAssignmentRequests(fallbackData.requests);
        }
      }

      // Handle change requests (try manage-staff as fallback)
      const { data: changeData } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'get_am_change_requests' }
      });
      if (changeData?.requests) {
        setChangeRequests(changeData.requests);
      }

      // Handle AMs response
      if (amsRes.data?.success && amsRes.data?.acquisition_managers) {
        const amsWithCounts = amsRes.data.acquisition_managers.map((am: any) => ({
          id: am.id,
          full_name: am.display_name || am.name || `${am.first_name || ''} ${am.last_name || ''}`.trim() || am.email,
          email: am.email,
          department: 'acquisition_managers',
          investor_count: am.investor_count || 0
        }));
        setStaffMembers(amsWithCounts);
      } else {
        // Fallback to manage-staff
        const { data: staffData } = await supabase.functions.invoke('manage-staff', {
          body: { action: 'get_staff_list', department: 'acquisition_managers' }
        });
        if (staffData?.staff) {
          const amsWithCounts = staffData.staff.map((s: any) => ({
            id: s.id,
            full_name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email,
            email: s.email,
            department: s.department,
            investor_count: 0
          }));
          setStaffMembers(amsWithCounts);
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast({ title: 'Error', description: 'Failed to load requests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };




  // Find potential matches based on name
  const findPotentialMatches = (firstName: string, lastName: string): StaffMember[] => {
    const normalizedFirst = firstName?.toLowerCase().trim() || '';
    const normalizedLast = lastName?.toLowerCase().trim() || '';
    const fullName = `${normalizedFirst} ${normalizedLast}`;
    
    return staffMembers.filter(staff => {
      const staffName = staff.full_name?.toLowerCase().trim() || '';
      // Check for exact match, partial match, or similar names
      return staffName === fullName || 
             staffName.includes(normalizedFirst) || 
             staffName.includes(normalizedLast) ||
             fullName.includes(staffName.split(' ')[0]) ||
             fullName.includes(staffName.split(' ')[1] || '');
    });
  };

  const handleMatchRequest = async () => {
    if (!selectedRequest || !selectedStaffId) return;

    setProcessing(selectedRequest.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'match_am_assignment',
          request_id: selectedRequest.id,
          investor_id: selectedRequest.investor_id,
          staff_id: selectedStaffId,
          matched_by: staffId,
          notes: matchNotes
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to match AM');
      }

      toast({ 
        title: 'AM Matched Successfully!', 
        description: `${selectedRequest.investor_name} has been matched with their acquisition manager. Both parties have been notified.`
      });
      
      setMatchModalOpen(false);
      setSelectedRequest(null);
      setSelectedStaffId('');
      setMatchNotes('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectRequest = async (request: AMAssignmentRequest, reason: string) => {
    setProcessing(request.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'reject_am_assignment',
          request_id: request.id,
          investor_id: request.investor_id,
          reason: reason || 'No matching acquisition manager found'
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to reject request');
      }

      toast({ 
        title: 'Request Handled', 
        description: 'Investor has been notified that we could not find a matching AM.'
      });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveChangeRequest = async () => {
    if (!selectedChangeRequest || !newAMId) return;

    setProcessing(selectedChangeRequest.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'approve_am_change',
          request_id: selectedChangeRequest.id,
          investor_id: selectedChangeRequest.investor_id,
          new_am_id: newAMId,
          approved_by: staffId,
          notes: changeResponseNotes
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to approve change');
      }

      toast({ 
        title: 'AM Change Approved!', 
        description: `${selectedChangeRequest.investor_name}'s acquisition manager has been changed. All parties have been notified.`
      });
      
      setChangeModalOpen(false);
      setSelectedChangeRequest(null);
      setNewAMId('');
      setChangeResponseNotes('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectChangeRequest = async (request: AMChangeRequest) => {
    setProcessing(request.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'reject_am_change',
          request_id: request.id,
          investor_id: request.investor_id,
          reason: 'Request reviewed and declined'
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to reject change');
      }

      toast({ 
        title: 'Change Request Declined', 
        description: 'Investor has been notified.'
      });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const filteredAssignmentRequests = assignmentRequests.filter(r => 
    r.investor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.investor_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${r.am_first_name} ${r.am_last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredChangeRequests = changeRequests.filter(r =>
    r.investor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.investor_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingAssignments = filteredAssignmentRequests.filter(r => r.status === 'pending');
  const pendingChanges = filteredChangeRequests.filter(r => r.status === 'pending');

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1a365d]" />
          <p className="mt-2 text-gray-500">Loading AM requests...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{pendingAssignments.length}</p>
                <p className="text-sm text-amber-600">New AM Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{pendingChanges.length}</p>
                <p className="text-sm text-blue-600">Change Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{staffMembers.length}</p>
                <p className="text-sm text-green-600">Available AMs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">
                  {assignmentRequests.filter(r => r.status === 'matched').length}
                </p>
                <p className="text-sm text-purple-600">Matched This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by investor name, email, or AM name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs for different request types */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments" className="relative">
            New AM Requests
            {pendingAssignments.length > 0 && (
              <Badge className="ml-2 bg-amber-500">{pendingAssignments.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="changes" className="relative">
            Change Requests
            {pendingChanges.length > 0 && (
              <Badge className="ml-2 bg-blue-500">{pendingChanges.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* New AM Assignment Requests */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#d4a574]" />
                AM Assignment Requests
              </CardTitle>
              <CardDescription>
                Investors who have submitted their acquisition manager's name for matching.
                Match them to the correct staff member to complete the assignment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingAssignments.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">All caught up!</p>
                  <p className="text-sm text-gray-500">No pending AM assignment requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingAssignments.map((request) => {
                    const potentialMatches = findPotentialMatches(request.am_first_name, request.am_last_name);
                    const hasMatch = potentialMatches.length > 0;

                    return (
                      <div
                        key={request.id}
                        className={`border rounded-lg p-4 transition-all ${
                          hasMatch 
                            ? 'bg-green-50 border-green-200 hover:shadow-md' 
                            : 'bg-amber-50 border-amber-200 hover:shadow-md'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Investor Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="font-semibold">{request.investor_name}</span>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {request.investor_email}
                              </span>
                              {request.investor_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {request.investor_phone}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(request.requested_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Requested AM Info */}
                          <div className="flex-1">
                            <p className="text-sm text-gray-500 mb-1">Requested AM:</p>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {request.am_first_name} {request.am_last_name}
                              </span>
                              {hasMatch ? (
                                <Badge className="bg-green-100 text-green-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {potentialMatches.length} Match{potentialMatches.length !== 1 ? 'es' : ''}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  No Auto-Match
                                </Badge>
                              )}
                            </div>
                            {hasMatch && (
                              <p className="text-xs text-green-600 mt-1">
                                Suggested: {potentialMatches[0].full_name} ({potentialMatches[0].email})
                              </p>
                            )}
                            {request.notes && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                Note: {request.notes}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setSelectedRequest(request);
                                if (hasMatch) {
                                  setSelectedStaffId(potentialMatches[0].id);
                                }
                                setMatchModalOpen(true);
                              }}
                              disabled={processing === request.id}
                              className={hasMatch ? 'bg-green-600 hover:bg-green-700' : 'bg-[#1a365d]'}
                            >
                              {processing === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <UserCheck className="w-4 h-4 mr-2" />
                              )}
                              {hasMatch ? 'Quick Match' : 'Select AM'}
                            </Button>
                            <Button
                              variant="outline"
                              className="text-gray-600"
                              onClick={() => handleRejectRequest(request, 'No matching AM found')}
                              disabled={processing === request.id}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Can't Match
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
        </TabsContent>

        {/* AM Change Requests */}
        <TabsContent value="changes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-600" />
                AM Change Requests
              </CardTitle>
              <CardDescription>
                Investors who have requested a different acquisition manager.
                Review their reason and assign a new AM if appropriate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingChanges.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No pending change requests</p>
                  <p className="text-sm text-gray-500">All AM change requests have been handled</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingChanges.map((request) => (
                    <div
                      key={request.id}
                      className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        {/* Investor Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold">{request.investor_name}</span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {request.investor_email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(request.requested_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {/* Current AM */}
                          {request.current_am_name && (
                            <div className="text-sm mb-2">
                              <span className="text-gray-500">Current AM:</span>{' '}
                              <span className="font-medium">{request.current_am_name}</span>
                            </div>
                          )}
                          
                          {/* Preferred AM if specified */}
                          {request.preferred_am_name && (
                            <div className="text-sm mb-2">
                              <span className="text-gray-500">Preferred AM:</span>{' '}
                              <span className="font-medium text-blue-600">{request.preferred_am_name}</span>
                            </div>
                          )}
                        </div>

                        {/* Reason */}
                        <div className="flex-1">
                          <p className="text-sm text-gray-500 mb-1">Reason for change:</p>
                          <div className="bg-gray-50 rounded-lg p-3 border">
                            <p className="text-sm text-gray-700">{request.reason}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => {
                              setSelectedChangeRequest(request);
                              setChangeModalOpen(true);
                            }}
                            disabled={processing === request.id}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {processing === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <UserCheck className="w-4 h-4 mr-2" />
                            )}
                            Assign New AM
                          </Button>
                          <Button
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleRejectChangeRequest(request)}
                            disabled={processing === request.id}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Match AM Modal */}
      <Dialog open={matchModalOpen} onOpenChange={setMatchModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              Match Acquisition Manager
            </DialogTitle>
            <DialogDescription>
              Match {selectedRequest?.investor_name}'s request to the correct acquisition manager.
              Both the investor and AM will receive email notifications.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Request Details */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <p className="text-sm text-gray-500 mb-2">Investor requested:</p>
              <p className="font-medium text-lg">
                {selectedRequest?.am_first_name} {selectedRequest?.am_last_name}
              </p>
              {selectedRequest?.notes && (
                <p className="text-sm text-gray-500 mt-2 italic">
                  "{selectedRequest.notes}"
                </p>
              )}
            </div>

            {/* Staff Selection */}
            <div>
              <Label htmlFor="staff-select">Select Acquisition Manager</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose an AM..." />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{staff.full_name}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          ({staff.investor_count || 0} investors)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="match-notes">Internal Notes (Optional)</Label>
              <Textarea
                id="match-notes"
                value={matchNotes}
                onChange={(e) => setMatchNotes(e.target.value)}
                placeholder="Any notes about this match..."
                rows={2}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setMatchModalOpen(false);
              setSelectedRequest(null);
              setSelectedStaffId('');
              setMatchNotes('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleMatchRequest}
              disabled={!selectedStaffId || processing === selectedRequest?.id}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing === selectedRequest?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Match & Notify Both
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Request Modal */}
      <Dialog open={changeModalOpen} onOpenChange={setChangeModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-600" />
              Approve AM Change
            </DialogTitle>
            <DialogDescription>
              Assign a new acquisition manager to {selectedChangeRequest?.investor_name}.
              The investor, old AM, and new AM will all be notified.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Current AM */}
            {selectedChangeRequest?.current_am_name && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <p className="text-sm text-red-600">
                  Current AM: <strong>{selectedChangeRequest.current_am_name}</strong>
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="bg-gray-50 rounded-lg p-3 border">
              <p className="text-sm text-gray-500 mb-1">Reason for change:</p>
              <p className="text-sm">{selectedChangeRequest?.reason}</p>
            </div>

            {/* New AM Selection */}
            <div>
              <Label htmlFor="new-am-select">Select New Acquisition Manager</Label>
              <Select value={newAMId} onValueChange={setNewAMId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a new AM..." />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers
                    .filter(s => s.id !== selectedChangeRequest?.current_am_id)
                    .map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{staff.full_name}</span>
                          <span className="text-gray-500 text-xs ml-2">
                            ({staff.investor_count || 0} investors)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Response Notes */}
            <div>
              <Label htmlFor="change-notes">Response Notes (Optional)</Label>
              <Textarea
                id="change-notes"
                value={changeResponseNotes}
                onChange={(e) => setChangeResponseNotes(e.target.value)}
                placeholder="Any notes to include in the notification..."
                rows={2}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setChangeModalOpen(false);
              setSelectedChangeRequest(null);
              setNewAMId('');
              setChangeResponseNotes('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleApproveChangeRequest}
              disabled={!newAMId || processing === selectedChangeRequest?.id}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing === selectedChangeRequest?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Approve & Notify All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
