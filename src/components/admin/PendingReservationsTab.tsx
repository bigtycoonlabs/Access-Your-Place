import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Clock, CheckCircle, AlertTriangle, Building2, User,
  MapPin, DollarSign, Phone, Mail, MessageSquare, Eye, UserCheck,
  Timer, RefreshCw, Shield, Send, Calendar, ExternalLink
} from 'lucide-react';

interface Props {
  staffId: string;
  staffName: string;
  isSuccessManager?: boolean;
}

interface Reservation {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  investor_phone?: string;
  property_id: string;
  property_title: string;
  property_city: string;
  property_state: string;
  property_address?: string;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  status: string;
  am_permission_granted: boolean;
  am_permission_granted_by?: string;
  am_permission_granted_at?: string;
  assigned_am_id?: string;
  assigned_am_name?: string;
  expires_at: string;
  created_at: string;
  notes?: string;
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const difference = expiry - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

      setIsUrgent(hours < 6);
      setTimeLeft(`${hours}h ${minutes}m`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (isExpired) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Expired
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={`flex items-center gap-1 ${isUrgent ? 'border-red-500 text-red-600' : 'border-amber-500 text-amber-600'}`}
    >
      <Timer className={`w-3 h-3 ${isUrgent ? 'animate-pulse' : ''}`} />
      {timeLeft}
    </Badge>
  );
}

export function PendingReservationsTab({ staffId, staffName, isSuccessManager = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [contactMessage, setContactMessage] = useState('');
  const [grantNotes, setGrantNotes] = useState('');
  const { toast } = useToast();

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: { 
          action: 'get_deal_reservations',
          assigned_manager_id: isSuccessManager ? undefined : staffId
        }
      });

      if (data?.reservations) {
        setReservations(data.reservations);
      }
    } catch (err) {
      console.error('Error fetching reservations:', err);
      toast({
        title: 'Error',
        description: 'Failed to load reservations',
        variant: 'destructive'
      });
    }
    setLoading(false);
  }, [staffId, isSuccessManager, toast]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Grant AM permission
  const handleGrantPermission = async () => {
    if (!selectedReservation) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: {
          action: 'grant_am_permission',
          reservation_id: selectedReservation.id,
          staff_id: staffId,
          staff_name: staffName,
          notes: grantNotes
        }
      });

      if (data?.success) {
        toast({
          title: 'Permission Granted',
          description: 'The investor has been notified and can now proceed with payment.'
        });
        setShowGrantModal(false);
        setGrantNotes('');
        fetchReservations();
      } else {
        throw new Error(data?.error || 'Failed to grant permission');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to grant permission',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  // Assign self as AM
  const handleAssignSelfAsAM = async (reservation: Reservation) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: 'assign_acquisition_manager',
          investor_id: reservation.investor_id,
          manager_id: staffId,
          manager_name: staffName
        }
      });

      if (data?.success) {
        // Also update the reservation
        await supabase.functions.invoke('manage-acquisition-requests', {
          body: {
            action: 'update_reservation_am',
            reservation_id: reservation.id,
            am_id: staffId,
            am_name: staffName
          }
        });

        toast({
          title: 'AM Assigned',
          description: `You are now the acquisition manager for ${reservation.investor_name}.`
        });
        fetchReservations();
      } else {
        throw new Error(data?.error || 'Failed to assign AM');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to assign AM',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  // Send message to investor
  const handleSendMessage = async () => {
    if (!selectedReservation || !contactMessage.trim()) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-messaging', {
        body: {
          action: 'send_message',
          investor_id: selectedReservation.investor_id,
          sender_id: staffId,
          sender_name: staffName,
          sender_type: 'staff',
          message: contactMessage,
          subject: `Regarding your deal reservation in ${selectedReservation.property_city}`
        }
      });

      if (data?.success) {
        toast({
          title: 'Message Sent',
          description: 'Your message has been sent to the investor.'
        });
        setShowContactModal(false);
        setContactMessage('');
      } else {
        throw new Error(data?.error || 'Failed to send message');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to send message',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  // Filter reservations
  const filteredReservations = reservations.filter(r => {
    const matchesSearch = 
      r.investor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.property_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.property_city?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'pending' && !r.am_permission_granted && r.status === 'reserved') ||
      (filterStatus === 'approved' && r.am_permission_granted) ||
      (filterStatus === 'expired' && r.status === 'expired');
    
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: reservations.length,
    pendingApproval: reservations.filter(r => !r.am_permission_granted && r.status === 'reserved').length,
    approved: reservations.filter(r => r.am_permission_granted).length,
    expired: reservations.filter(r => r.status === 'expired').length,
    noAM: reservations.filter(r => !r.assigned_am_id && r.status === 'reserved').length
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#1a365d] flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#d4a574]" />
            Pending Reservations
          </h3>
          <p className="text-sm text-gray-600">
            Review and approve deal reservations from investors
          </p>
        </div>
        <Button variant="outline" onClick={fetchReservations}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gray-50">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.pendingApproval}</p>
            <p className="text-xs text-amber-600">Pending Approval</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
            <p className="text-xs text-green-600">Approved</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-700">{stats.expired}</p>
            <p className="text-xs text-red-600">Expired</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-purple-700">{stats.noAM}</p>
            <p className="text-xs text-purple-600">No AM Assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Alert */}
      {stats.noAM > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-red-800">
                  {stats.noAM} Reservation{stats.noAM > 1 ? 's' : ''} Without AM
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  These investors reserved deals but don't have an acquisition manager assigned. 
                  Contact them promptly to assign an AM and grant payment permission.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Search by investor name, property, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-4"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reservations</SelectItem>
            <SelectItem value="pending">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reservations List */}
      <div className="space-y-4">
        {filteredReservations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600">No Reservations Found</h3>
              <p className="text-gray-500 mt-2">
                {filterStatus !== 'all' 
                  ? 'Try changing your filter settings'
                  : 'When investors reserve deals, they will appear here'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredReservations.map(reservation => (
            <Card 
              key={reservation.id} 
              className={`hover:shadow-md transition-shadow ${
                !reservation.assigned_am_id && reservation.status === 'reserved' 
                  ? 'border-red-300 bg-red-50/50' 
                  : reservation.am_permission_granted 
                    ? 'border-green-300' 
                    : 'border-amber-300'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Investor & Property Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center text-white font-bold">
                          {reservation.investor_name?.charAt(0) || 'I'}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{reservation.investor_name}</h4>
                          <p className="text-sm text-gray-500">{reservation.investor_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CountdownTimer expiresAt={reservation.expires_at} />
                        {reservation.am_permission_granted ? (
                          <Badge className="bg-green-500">Approved</Badge>
                        ) : (
                          <Badge className="bg-amber-500">Pending</Badge>
                        )}
                        {!reservation.assigned_am_id && (
                          <Badge variant="destructive">No AM</Badge>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-4 h-4 text-[#d4a574]" />
                        <span className="font-medium">{reservation.property_title}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {reservation.property_city}, {reservation.property_state}
                        </span>
                        {reservation.monthly_rent && (
                          <span className="flex items-center gap-1 text-green-600">
                            <DollarSign className="w-3 h-3" />
                            ${reservation.monthly_rent.toLocaleString()}/mo
                          </span>
                        )}
                        {reservation.bedrooms && (
                          <span>{reservation.bedrooms} bed / {reservation.bathrooms} bath</span>
                        )}
                      </div>
                    </div>

                    {reservation.assigned_am_name && (
                      <p className="text-sm text-blue-600">
                        <User className="w-3 h-3 inline mr-1" />
                        AM: {reservation.assigned_am_name}
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedReservation(reservation);
                        setShowDetailModal(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedReservation(reservation);
                        setShowContactModal(true);
                      }}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Contact
                    </Button>
                    {!reservation.assigned_am_id && (
                      <Button 
                        size="sm"
                        variant="outline"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50"
                        onClick={() => handleAssignSelfAsAM(reservation)}
                        disabled={processing}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Assign Myself
                      </Button>
                    )}
                    {!reservation.am_permission_granted && reservation.status === 'reserved' && (
                      <Button 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedReservation(reservation);
                          setShowGrantModal(true);
                        }}
                        disabled={processing}
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Grant Permission
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Investor Information
                  </h4>
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                    <p><strong>Name:</strong> {selectedReservation.investor_name}</p>
                    <p><strong>Email:</strong> {selectedReservation.investor_email}</p>
                    {selectedReservation.investor_phone && (
                      <p><strong>Phone:</strong> {selectedReservation.investor_phone}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Property Information
                  </h4>
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                    <p><strong>Title:</strong> {selectedReservation.property_title}</p>
                    <p><strong>Location:</strong> {selectedReservation.property_city}, {selectedReservation.property_state}</p>
                    {selectedReservation.monthly_rent && (
                      <p><strong>Monthly Rent:</strong> ${selectedReservation.monthly_rent.toLocaleString()}</p>
                    )}
                    {selectedReservation.bedrooms && (
                      <p><strong>Size:</strong> {selectedReservation.bedrooms} bed / {selectedReservation.bathrooms} bath</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Reservation Status
                </h4>
                <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                  <p><strong>Status:</strong> {selectedReservation.status}</p>
                  <p><strong>Created:</strong> {new Date(selectedReservation.created_at).toLocaleString()}</p>
                  <p><strong>Expires:</strong> {new Date(selectedReservation.expires_at).toLocaleString()}</p>
                  <p><strong>AM Permission:</strong> {selectedReservation.am_permission_granted ? 'Granted' : 'Pending'}</p>
                  {selectedReservation.assigned_am_name && (
                    <p><strong>Assigned AM:</strong> {selectedReservation.assigned_am_name}</p>
                  )}
                </div>
              </div>

              {selectedReservation.notes && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">Notes</h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p>{selectedReservation.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#d4a574]" />
              Contact Investor
            </DialogTitle>
            <DialogDescription>
              Send a message to {selectedReservation?.investor_name} about their deal reservation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>To:</strong> {selectedReservation?.investor_name} ({selectedReservation?.investor_email})
              </p>
              <p className="text-sm text-gray-600">
                <strong>Re:</strong> {selectedReservation?.property_title} in {selectedReservation?.property_city}
              </p>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage}
              disabled={processing || !contactMessage.trim()}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Permission Modal */}
      <Dialog open={showGrantModal} onOpenChange={setShowGrantModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Grant Payment Permission
            </DialogTitle>
            <DialogDescription>
              Allow {selectedReservation?.investor_name} to proceed with payment for this deal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="bg-gray-50">
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <p><strong>Investor:</strong> {selectedReservation?.investor_name}</p>
                  <p><strong>Property:</strong> {selectedReservation?.property_title}</p>
                  <p><strong>Location:</strong> {selectedReservation?.property_city}, {selectedReservation?.property_state}</p>
                </div>
              </CardContent>
            </Card>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <h4 className="font-semibold text-amber-800 mb-2">What happens when you grant permission:</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• The investor will be notified immediately via email and in-app notification</li>
                <li>• They can proceed to complete payment (Stripe, Zelle, or Wire Transfer)</li>
                <li>• You will be notified when payment is submitted</li>
                <li>• For Zelle/Wire payments, you'll need to approve the payment proof</li>
              </ul>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={grantNotes}
                onChange={(e) => setGrantNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleGrantPermission}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle className="w-4 h-4 mr-2" />
              Grant Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
