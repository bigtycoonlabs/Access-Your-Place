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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Loader2, CheckCircle, XCircle, Clock, Search, User, Mail, 
  Phone, Calendar, Shield, AlertTriangle, UserCheck
} from 'lucide-react';

interface VerificationRequest {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  acquisition_manager_first_name: string;
  acquisition_manager_last_name: string;
  am_verification_status: string;
  am_verification_requested_at: string;
  account_funded?: boolean;
  created_at: string;
}

interface CertifiedAM {
  id: string;
  full_name: string;
  email: string;
}

interface Props {
  staffId: string;
}

export function AMVerificationRequests({ staffId }: Props) {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [certifiedAMs, setCertifiedAMs] = useState<CertifiedAM[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAMId, setSelectedAMId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: requestsData } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'get_am_verification_requests' }
      });

      if (requestsData?.requests) {
        setRequests(requestsData.requests);
      }

      const { data: amsData } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'get_certified_ams' }
      });

      if (amsData?.ams) {
        setCertifiedAMs(amsData.ams);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast({ title: 'Error', description: 'Failed to load verification requests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const findMatchingAM = (firstName: string, lastName: string): CertifiedAM | null => {
    const normalizedFirst = firstName?.toLowerCase().trim() || '';
    const normalizedLast = lastName?.toLowerCase().trim() || '';
    const fullName = `${normalizedFirst} ${normalizedLast}`;
    
    return certifiedAMs.find(am => {
      const amName = am.full_name?.toLowerCase().trim() || '';
      return amName === fullName || amName.includes(fullName) || fullName.includes(amName);
    }) || null;
  };

  const handleVerify = async (request: VerificationRequest) => {
    const matchingAM = findMatchingAM(
      request.acquisition_manager_first_name,
      request.acquisition_manager_last_name
    );

    if (!matchingAM) {
      toast({ 
        title: 'No Match Found', 
        description: 'No certified AM matches this name. You can assign a different AM or mark as not found.',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(request.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'verify_am_request',
          investor_id: request.id,
          am_staff_id: matchingAM.id,
          verified_by: staffId
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Verification failed');
      }

      toast({ title: 'Verified!', description: `${request.full_name}'s AM has been verified as YP certified. Both investor and AM have been notified.` });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setProcessing(selectedRequest.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'reject_am_request',
          investor_id: selectedRequest.id,
          reason: rejectReason || 'No certified AM found with this name'
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Rejection failed');
      }

      toast({ title: 'Marked as Not Found', description: 'Investor has been notified via email and in-app notification' });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleAssignDifferentAM = async () => {
    if (!selectedRequest || !selectedAMId) return;

    setProcessing(selectedRequest.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'assign_am_to_investor',
          investor_id: selectedRequest.id,
          am_staff_id: selectedAMId,
          assigned_by: staffId
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Assignment failed');
      }

      toast({ title: 'AM Assigned!', description: 'Investor and AM have been notified via email' });
      setAssignModalOpen(false);
      setSelectedRequest(null);
      setSelectedAMId('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const filteredRequests = requests.filter(r => 
    r.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${r.acquisition_manager_first_name} ${r.acquisition_manager_last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1a365d]" />
          <p className="mt-2 text-gray-500">Loading verification requests...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{filteredRequests.length}</p>
                <p className="text-sm text-amber-600">Pending Verifications</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{certifiedAMs.length}</p>
                <p className="text-sm text-green-600">YP Certified AMs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{certifiedAMs.length}</p>
                <p className="text-sm text-blue-600">Available for Assignment</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#d4a574]" />
            AM Verification Requests
          </CardTitle>
          <CardDescription>
            Verify that investors' Acquisition Managers are YP certified. AMs receive email notification only after you approve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by investor name, email, or AM name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Requests List */}
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">All caught up!</p>
              <p className="text-sm text-gray-500">No pending verification requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => {
                const matchingAM = findMatchingAM(
                  request.acquisition_manager_first_name,
                  request.acquisition_manager_last_name
                );

                return (
                  <div
                    key={request.id}
                    className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Investor Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold">{request.full_name}</span>
                          {request.account_funded && (
                            <Badge className="bg-green-100 text-green-700">Funded</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {request.email}
                          </span>
                          {request.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {request.phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Requested {new Date(request.am_verification_requested_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* AM Info */}
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-1">Requested AM:</p>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {request.acquisition_manager_first_name} {request.acquisition_manager_last_name}
                          </span>
                          {matchingAM ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Match Found
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              No Match
                            </Badge>
                          )}
                        </div>
                        {matchingAM && (
                          <p className="text-xs text-green-600 mt-1">
                            Matches: {matchingAM.full_name} ({matchingAM.email})
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {matchingAM ? (
                          <Button
                            onClick={() => handleVerify(request)}
                            disabled={processing === request.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {processing === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle className="w-4 h-4 mr-2" />
                            )}
                            Verify & Notify AM
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(request);
                              setAssignModalOpen(true);
                            }}
                          >
                            <UserCheck className="w-4 h-4 mr-2" />
                            Assign AM
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            setSelectedRequest(request);
                            setRejectDialogOpen(true);
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Not Found
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

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark AM as Not Found</AlertDialogTitle>
            <AlertDialogDescription>
              This will notify {selectedRequest?.full_name} that no certified AM was found matching 
              "{selectedRequest?.acquisition_manager_first_name} {selectedRequest?.acquisition_manager_last_name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              placeholder="Additional details for the investor..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedRequest(null);
              setRejectReason('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
              disabled={processing === selectedRequest?.id}
            >
              {processing === selectedRequest?.id && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Mark as Not Found
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Different AM Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Certified AM</DialogTitle>
            <DialogDescription>
              Select a YP certified Acquisition Manager to assign to {selectedRequest?.full_name}. 
              Both the investor and AM will receive email notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">
                Investor requested: <strong>{selectedRequest?.acquisition_manager_first_name} {selectedRequest?.acquisition_manager_last_name}</strong>
              </p>
            </div>
            <div>
              <Label>Select Certified AM</Label>
              <Select value={selectedAMId} onValueChange={setSelectedAMId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose an AM..." />
                </SelectTrigger>
                <SelectContent>
                  {certifiedAMs.map((am) => (
                    <SelectItem key={am.id} value={am.id}>
                      {am.full_name} - {am.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssignModalOpen(false);
              setSelectedRequest(null);
              setSelectedAMId('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignDifferentAM}
              disabled={!selectedAMId || processing === selectedRequest?.id}
              className="bg-[#1a365d]"
            >
              {processing === selectedRequest?.id && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Assign & Notify Both
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
