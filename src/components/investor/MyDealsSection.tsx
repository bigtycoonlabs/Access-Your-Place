import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { StartAcquisitionModal } from './StartAcquisitionModal';
import {
  Loader2, Building2, Clock, CheckCircle, AlertTriangle, DollarSign,
  MapPin, Calendar, CreditCard, MessageSquare, User, Timer, Eye,
  FileText, Home, Rocket, Settings, RefreshCw, ArrowRight, Phone,
  Mail, ChevronDown, ChevronUp, Briefcase, Shield, Zap, ExternalLink
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
  investorEmail: string;
  hasAM?: boolean;
  amName?: string;
  amEmail?: string;
  onContactAM?: () => void;
}

interface DealReservation {
  id: string;
  property_id: string;
  property_title: string;
  property_city: string;
  property_state: string;
  property_address?: string;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  photos?: string[];
  status: string;
  am_permission_granted: boolean;
  expires_at: string;
  created_at: string;
}

interface Acquisition {
  id: string;
  property_id: string;
  title: string;
  address?: string;
  city: string;
  state: string;
  zip_code?: string;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  photos?: string[];
  payment_status: string;
  payment_method?: string;
  workflow_stage?: string;
  acquisition_fee_paid?: boolean;
  created_at: string;
  landlord_name?: string;
  landlord_email?: string;
  landlord_phone?: string;
}

const WORKFLOW_STAGES = [
  { value: 'payment_received', label: 'Payment', icon: DollarSign, color: 'bg-green-500' },
  { value: 'application_process', label: 'Application', icon: FileText, color: 'bg-blue-500' },
  { value: 'lease_review', label: 'Lease Review', icon: FileText, color: 'bg-purple-500' },
  { value: 'setup_furniture', label: 'Furniture', icon: Home, color: 'bg-orange-500' },
  { value: 'setup_software', label: 'Software', icon: Settings, color: 'bg-indigo-500' },
  { value: 'setup_utilities', label: 'Utilities', icon: Zap, color: 'bg-teal-500' },
  { value: 'vendor_matching', label: 'Vendors', icon: User, color: 'bg-pink-500' },
  { value: 'marketing_launch', label: 'Marketing', icon: Rocket, color: 'bg-yellow-500' },
  { value: 'completed', label: 'Complete', icon: CheckCircle, color: 'bg-emerald-600' }
];

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
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setIsUrgent(hours < 6);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertTriangle className="w-4 h-4" />
        <span className="font-medium">Reservation Expired</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
      <Timer className={`w-4 h-4 ${isUrgent ? 'animate-pulse' : ''}`} />
      <span className="font-medium">{timeLeft} remaining</span>
    </div>
  );
}

export function MyDealsSection({ 
  investorId, 
  investorName, 
  investorEmail, 
  hasAM = false,
  amName,
  amEmail,
  onContactAM 
}: Props) {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<DealReservation[]>([]);
  const [pendingAcquisitions, setPendingAcquisitions] = useState<Acquisition[]>([]);
  const [completedAcquisitions, setCompletedAcquisitions] = useState<Acquisition[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const { toast } = useToast();

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch reservations
      const { data: reservationsData } = await supabase.functions.invoke('manage-acquisition-requests', {
        body: { 
          action: 'get_investor_reservations',
          investor_id: investorId
        }
      });

      if (reservationsData?.reservations) {
        setReservations(reservationsData.reservations);
      }

      // Fetch acquisitions (pending and completed)
      const { data: acquisitionsData } = await supabase.functions.invoke('investor-deal-locator', {
        body: { 
          action: 'get_assigned_deals',
          investor_id: investorId
        }
      });

      if (acquisitionsData?.deals || acquisitionsData?.assigned_deals) {
        const deals = acquisitionsData.deals || acquisitionsData.assigned_deals || [];
        setPendingAcquisitions(deals.filter((d: any) => 
          d.payment_status === 'pending' || 
          (d.payment_status === 'paid' && d.workflow_stage !== 'completed')
        ));
        setCompletedAcquisitions(deals.filter((d: any) => 
          d.workflow_stage === 'completed'
        ));
      }
    } catch (err) {
      console.error('Error fetching deals:', err);
      toast({
        title: 'Error',
        description: 'Failed to load your deals',
        variant: 'destructive'
      });
    }
    setLoading(false);
  }, [investorId, toast]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleStartPayment = (deal: any) => {
    setSelectedDeal(deal);
    setShowPaymentModal(true);
  };

  const handleViewDetails = (deal: any) => {
    setSelectedDetails(deal);
    setShowDetailsModal(true);
  };

  const totalDeals = reservations.length + pendingAcquisitions.length + completedAcquisitions.length;
  const activeReservations = reservations.filter(r => r.status !== 'expired' && r.status !== 'cancelled');
  const awaitingPermission = reservations.filter(r => !r.am_permission_granted && r.status === 'reserved');
  const readyToPay = reservations.filter(r => r.am_permission_granted && r.status === 'pending_payment');

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
          <h2 className="text-2xl font-bold text-[#1a365d] flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-[#d4a574]" />
            My Deals
          </h2>
          <p className="text-gray-600">
            Track all your deal reservations, pending acquisitions, and completed purchases
          </p>
        </div>
        <Button variant="outline" onClick={fetchDeals}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold text-amber-700">{activeReservations.length}</p>
            <p className="text-xs text-amber-600">Active Reservations</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4 text-center">
            <Briefcase className="w-6 h-6 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-700">{pendingAcquisitions.length}</p>
            <p className="text-xs text-blue-600">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-700">{completedAcquisitions.length}</p>
            <p className="text-xs text-green-600">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-4 text-center">
            <Building2 className="w-6 h-6 mx-auto text-purple-600 mb-1" />
            <p className="text-2xl font-bold text-purple-700">{totalDeals}</p>
            <p className="text-xs text-purple-600">Total Deals</p>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Alerts */}
      {awaitingPermission.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">
                  {awaitingPermission.length} Deal{awaitingPermission.length > 1 ? 's' : ''} Awaiting AM Approval
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  Your acquisition manager needs to grant permission before you can proceed with payment.
                  {hasAM && amName && (
                    <span> Your AM is <strong>{amName}</strong>.</span>
                  )}
                </p>
                {hasAM && onContactAM && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2 border-amber-400 text-amber-700"
                    onClick={onContactAM}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Contact Your AM
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {readyToPay.length > 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <CreditCard className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">
                  {readyToPay.length} Deal{readyToPay.length > 1 ? 's' : ''} Ready for Payment!
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Your acquisition manager has approved your deal{readyToPay.length > 1 ? 's' : ''}. 
                  Complete payment to unlock full property details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white shadow">
          <TabsTrigger value="all">
            All ({totalDeals})
          </TabsTrigger>
          <TabsTrigger value="reservations">
            Reservations ({activeReservations.length})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            In Progress ({pendingAcquisitions.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedAcquisitions.length})
          </TabsTrigger>
        </TabsList>

        {/* All Deals */}
        <TabsContent value="all" className="space-y-4">
          {totalDeals === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Deals Yet</h3>
                <p className="text-gray-500 mt-2">
                  Start by browsing our deal flow and clicking "Start My Acquisition" on a property you like.
                </p>
                <Button 
                  className="mt-4 bg-[#d4a574] hover:bg-[#c49464]"
                  onClick={() => window.location.href = '/deals'}
                >
                  Browse Deals
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Reservations */}
              {activeReservations.map(reservation => (
                <ReservationCard 
                  key={reservation.id}
                  reservation={reservation}
                  hasAM={hasAM}
                  onStartPayment={() => handleStartPayment(reservation)}
                  onViewDetails={() => handleViewDetails(reservation)}
                  onContactAM={onContactAM}
                />
              ))}

              {/* Pending Acquisitions */}
              {pendingAcquisitions.map(acq => (
                <AcquisitionCard
                  key={acq.id}
                  acquisition={acq}
                  expanded={expandedId === acq.id}
                  onToggleExpand={() => setExpandedId(expandedId === acq.id ? null : acq.id)}
                  onStartPayment={() => handleStartPayment(acq)}
                  onViewDetails={() => handleViewDetails(acq)}
                />
              ))}

              {/* Completed Acquisitions */}
              {completedAcquisitions.map(acq => (
                <CompletedCard
                  key={acq.id}
                  acquisition={acq}
                  expanded={expandedId === acq.id}
                  onToggleExpand={() => setExpandedId(expandedId === acq.id ? null : acq.id)}
                />
              ))}
            </>
          )}
        </TabsContent>

        {/* Reservations Tab */}
        <TabsContent value="reservations" className="space-y-4">
          {activeReservations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Active Reservations</h3>
                <p className="text-gray-500 mt-2">
                  When you reserve a deal, it will appear here with a countdown timer.
                </p>
              </CardContent>
            </Card>
          ) : (
            activeReservations.map(reservation => (
              <ReservationCard 
                key={reservation.id}
                reservation={reservation}
                hasAM={hasAM}
                onStartPayment={() => handleStartPayment(reservation)}
                onViewDetails={() => handleViewDetails(reservation)}
                onContactAM={onContactAM}
              />
            ))
          )}
        </TabsContent>

        {/* In Progress Tab */}
        <TabsContent value="in-progress" className="space-y-4">
          {pendingAcquisitions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Acquisitions In Progress</h3>
                <p className="text-gray-500 mt-2">
                  Once you complete payment for a deal, it will appear here with progress tracking.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingAcquisitions.map(acq => (
              <AcquisitionCard
                key={acq.id}
                acquisition={acq}
                expanded={expandedId === acq.id}
                onToggleExpand={() => setExpandedId(expandedId === acq.id ? null : acq.id)}
                onStartPayment={() => handleStartPayment(acq)}
                onViewDetails={() => handleViewDetails(acq)}
              />
            ))
          )}
        </TabsContent>

        {/* Completed Tab */}
        <TabsContent value="completed" className="space-y-4">
          {completedAcquisitions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Completed Acquisitions</h3>
                <p className="text-gray-500 mt-2">
                  Your completed acquisitions will appear here with full property details.
                </p>
              </CardContent>
            </Card>
          ) : (
            completedAcquisitions.map(acq => (
              <CompletedCard
                key={acq.id}
                acquisition={acq}
                expanded={expandedId === acq.id}
                onToggleExpand={() => setExpandedId(expandedId === acq.id ? null : acq.id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Payment Modal */}
      {showPaymentModal && selectedDeal && (
        <StartAcquisitionModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          deal={selectedDeal}
          investorId={investorId}
          investorName={investorName}
          investorEmail={investorEmail}
          hasAM={hasAM}
          onSuccess={() => {
            setShowPaymentModal(false);
            fetchDeals();
          }}
        />
      )}

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deal Details</DialogTitle>
          </DialogHeader>
          {selectedDetails && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Property</p>
                  <p className="font-semibold">{selectedDetails.property_title || selectedDetails.title}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-semibold">
                    {selectedDetails.property_city || selectedDetails.city}, {selectedDetails.property_state || selectedDetails.state}
                  </p>
                </div>
                {selectedDetails.monthly_rent && (
                  <div>
                    <p className="text-sm text-gray-500">Monthly Rent</p>
                    <p className="font-semibold text-green-600">${selectedDetails.monthly_rent.toLocaleString()}</p>
                  </div>
                )}
                {selectedDetails.bedrooms && (
                  <div>
                    <p className="text-sm text-gray-500">Bedrooms/Bathrooms</p>
                    <p className="font-semibold">{selectedDetails.bedrooms} bed / {selectedDetails.bathrooms} bath</p>
                  </div>
                )}
              </div>
              {selectedDetails.photos?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Photos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedDetails.photos.slice(0, 6).map((photo: string, i: number) => (
                      <img 
                        key={i} 
                        src={photo} 
                        alt="" 
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Reservation Card Component
function ReservationCard({ 
  reservation, 
  hasAM, 
  onStartPayment, 
  onViewDetails,
  onContactAM 
}: { 
  reservation: DealReservation;
  hasAM: boolean;
  onStartPayment: () => void;
  onViewDetails: () => void;
  onContactAM?: () => void;
}) {
  const canPay = reservation.am_permission_granted || hasAM;

  return (
    <Card className={`overflow-hidden ${reservation.am_permission_granted ? 'border-green-300' : 'border-amber-300'}`}>
      <CardHeader className={`pb-3 ${reservation.am_permission_granted ? 'bg-green-50' : 'bg-amber-50'}`}>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#d4a574]" />
              {reservation.property_title}
            </CardTitle>
            <CardDescription>
              {reservation.property_city}, {reservation.property_state}
            </CardDescription>
          </div>
          <div className="text-right">
            <Badge className={reservation.am_permission_granted ? 'bg-green-500' : 'bg-amber-500'}>
              {reservation.am_permission_granted ? 'Ready to Pay' : 'Awaiting Approval'}
            </Badge>
            <div className="mt-2">
              <CountdownTimer expiresAt={reservation.expires_at} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-4">
            {reservation.monthly_rent && (
              <div className="bg-green-50 px-3 py-2 rounded-lg">
                <p className="text-xs text-gray-500">Monthly Rent</p>
                <p className="font-bold text-green-600">${reservation.monthly_rent.toLocaleString()}</p>
              </div>
            )}
            {reservation.bedrooms && (
              <div className="bg-gray-50 px-3 py-2 rounded-lg">
                <p className="text-xs text-gray-500">Beds/Baths</p>
                <p className="font-bold">{reservation.bedrooms}/{reservation.bathrooms}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onViewDetails}>
              <Eye className="w-4 h-4 mr-1" />
              Details
            </Button>
            {!reservation.am_permission_granted && onContactAM && (
              <Button variant="outline" size="sm" onClick={onContactAM}>
                <MessageSquare className="w-4 h-4 mr-1" />
                Contact AM
              </Button>
            )}
            {reservation.am_permission_granted && (
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
                onClick={onStartPayment}
              >
                <CreditCard className="w-4 h-4 mr-1" />
                Complete Payment
              </Button>
            )}
          </div>
        </div>
        
        {!reservation.am_permission_granted && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Next Step:</strong> Your acquisition manager will review this deal and grant permission for you to proceed with payment. 
              You'll receive a notification when approved.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Acquisition Card Component
function AcquisitionCard({ 
  acquisition, 
  expanded, 
  onToggleExpand, 
  onStartPayment,
  onViewDetails 
}: { 
  acquisition: Acquisition;
  expanded: boolean;
  onToggleExpand: () => void;
  onStartPayment: () => void;
  onViewDetails: () => void;
}) {
  const currentStageIdx = WORKFLOW_STAGES.findIndex(s => s.value === acquisition.workflow_stage) || 0;
  const stage = WORKFLOW_STAGES[currentStageIdx];
  const StageIcon = stage?.icon || Clock;
  const progress = ((currentStageIdx + 1) / WORKFLOW_STAGES.length) * 100;
  const isPaid = acquisition.payment_status === 'paid' || acquisition.acquisition_fee_paid;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#d4a574]" />
              {acquisition.title}
            </CardTitle>
            <CardDescription className="text-white/80">
              {acquisition.city}, {acquisition.state} {acquisition.zip_code}
            </CardDescription>
          </div>
          <div className="text-right">
            <Badge className={isPaid ? 'bg-green-500' : 'bg-amber-500'}>
              {isPaid ? 'Paid' : 'Payment Pending'}
            </Badge>
            {stage && (
              <Badge className={`ml-2 ${stage.color}`}>
                <StageIcon className="w-3 h-3 mr-1" />
                {stage.label}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Progress Bar */}
        {isPaid && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Acquisition Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex gap-1 mt-2">
              {WORKFLOW_STAGES.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div 
                    key={s.value}
                    className={`flex-1 text-center text-xs p-1 rounded ${
                      i < currentStageIdx ? 'bg-green-100 text-green-700' :
                      i === currentStageIdx ? 'bg-blue-100 text-blue-700 font-medium' :
                      'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Icon className="w-3 h-3 mx-auto mb-0.5" />
                    <span className="hidden md:inline">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {acquisition.monthly_rent && (
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <DollarSign className="w-5 h-5 mx-auto text-green-500 mb-1" />
              <p className="font-bold text-green-700">${acquisition.monthly_rent.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Monthly Rent</p>
            </div>
          )}
          {acquisition.bedrooms && (
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <Home className="w-5 h-5 mx-auto text-gray-400 mb-1" />
              <p className="font-bold">{acquisition.bedrooms} / {acquisition.bathrooms}</p>
              <p className="text-xs text-gray-500">Beds / Baths</p>
            </div>
          )}
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <Calendar className="w-5 h-5 mx-auto text-blue-500 mb-1" />
            <p className="font-bold">{new Date(acquisition.created_at).toLocaleDateString()}</p>
            <p className="text-xs text-gray-500">Started</p>
          </div>
          <div className={`p-3 rounded-lg text-center ${isPaid ? 'bg-green-50' : 'bg-amber-50'}`}>
            <CreditCard className={`w-5 h-5 mx-auto mb-1 ${isPaid ? 'text-green-500' : 'text-amber-500'}`} />
            <p className={`font-bold ${isPaid ? 'text-green-700' : 'text-amber-700'}`}>
              {isPaid ? 'Paid' : 'Pending'}
            </p>
            <p className="text-xs text-gray-500">Payment</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </Button>
          {!isPaid && (
            <Button 
              size="sm" 
              className="bg-[#d4a574] hover:bg-[#c49464]"
              onClick={onStartPayment}
            >
              <CreditCard className="w-4 h-4 mr-1" />
              Complete Payment
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onToggleExpand}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Less' : 'More'}
          </Button>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="border-t pt-4 space-y-3">
            {acquisition.address && (
              <div>
                <p className="text-sm text-gray-500">Full Address</p>
                <p className="font-medium">{acquisition.address}</p>
              </div>
            )}
            {acquisition.landlord_name && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">Landlord Contact</h4>
                <p className="text-sm">{acquisition.landlord_name}</p>
                {acquisition.landlord_email && (
                  <p className="text-sm text-blue-600">{acquisition.landlord_email}</p>
                )}
                {acquisition.landlord_phone && (
                  <p className="text-sm">{acquisition.landlord_phone}</p>
                )}
              </div>
            )}
            {acquisition.photos?.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {acquisition.photos.slice(0, 6).map((photo, i) => (
                  <img 
                    key={i} 
                    src={photo} 
                    alt="" 
                    className="w-full h-20 object-cover rounded-lg"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Completed Card Component
function CompletedCard({ 
  acquisition, 
  expanded, 
  onToggleExpand 
}: { 
  acquisition: Acquisition;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <Card className="overflow-hidden border-green-300">
      <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {acquisition.title}
            </CardTitle>
            <CardDescription className="text-white/80">
              {acquisition.address || `${acquisition.city}, ${acquisition.state}`}
            </CardDescription>
          </div>
          <Badge className="bg-white text-green-700">Completed</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {acquisition.monthly_rent && (
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <DollarSign className="w-5 h-5 mx-auto text-green-500 mb-1" />
              <p className="font-bold text-green-700">${acquisition.monthly_rent.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Monthly Rent</p>
            </div>
          )}
          {acquisition.bedrooms && (
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <Home className="w-5 h-5 mx-auto text-gray-400 mb-1" />
              <p className="font-bold">{acquisition.bedrooms} / {acquisition.bathrooms}</p>
              <p className="text-xs text-gray-500">Beds / Baths</p>
            </div>
          )}
        </div>

        {/* Landlord Info */}
        {acquisition.landlord_name && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Landlord Contact
            </h4>
            <div className="space-y-1">
              <p className="text-sm font-medium">{acquisition.landlord_name}</p>
              {acquisition.landlord_email && (
                <p className="text-sm text-blue-600 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {acquisition.landlord_email}
                </p>
              )}
              {acquisition.landlord_phone && (
                <p className="text-sm flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {acquisition.landlord_phone}
                </p>
              )}
            </div>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={onToggleExpand}>
          {expanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          {expanded ? 'Show Less' : 'Show More'}
        </Button>

        {expanded && acquisition.photos?.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {acquisition.photos.map((photo, i) => (
              <img 
                key={i} 
                src={photo} 
                alt="" 
                className="w-full h-24 object-cover rounded-lg"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
