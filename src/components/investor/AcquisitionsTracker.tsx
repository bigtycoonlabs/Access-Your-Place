import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PaymentCheckout, PaymentSuccess, PaymentHistory } from './PaymentCheckout';
import { 
  Loader2, Home, MapPin, DollarSign, FileText, Clock, CheckCircle, 
  Settings, ChevronDown, ChevronUp, Bed, Bath, Rocket, AlertTriangle,
  LogIn, RefreshCw, CreditCard, Receipt, Building2
} from 'lucide-react';

interface Props { 
  investorId: string; 
  investorName: string; 
  investorEmail: string; 
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

const STAGES = [
  { value: 'payment_received', label: 'Payment', icon: DollarSign },
  { value: 'application_process', label: 'Application', icon: FileText },
  { value: 'lease_review', label: 'Lease Review', icon: FileText },
  { value: 'setup_furniture', label: 'Furniture', icon: Home },
  { value: 'setup_software', label: 'Software', icon: Settings },
  { value: 'setup_utilities', label: 'Utilities', icon: Settings },
  { value: 'vendor_matching', label: 'Vendors', icon: Settings },
  { value: 'marketing_launch', label: 'Marketing', icon: Rocket },
  { value: 'completed', label: 'Complete', icon: CheckCircle }
];

export function AcquisitionsTracker({ investorId, investorName, investorEmail }: Props) {
  const [acquisitions, setAcquisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [completedPaymentId, setCompletedPaymentId] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { 
    validateAndFetch(); 
  }, [investorId]);

  // Check for payment success from redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const paymentIntentId = urlParams.get('payment_intent');
    
    if (paymentStatus === 'success' && paymentIntentId) {
      // Confirm payment on backend
      confirmPaymentFromRedirect(paymentIntentId);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const confirmPaymentFromRedirect = async (paymentIntentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'confirm_payment',
          investor_id: investorId,
          payment_intent_id: paymentIntentId
        }
      });

      if (data?.success) {
        setCompletedPaymentId(paymentIntentId);
        setShowSuccessModal(true);
        fetchAcquisitions();
      }
    } catch (err) {
      console.error('Failed to confirm payment:', err);
    }
  };

  const validateAndFetch = async () => {
    // Validate investor ID format
    if (!investorId) {
      setSessionError('No investor session found. Please log in to continue.');
      setLoading(false);
      return;
    }

    if (!isValidUUID(investorId)) {
      setSessionError('Your session appears to be invalid. Please log in again.');
      setLoading(false);
      localStorage.removeItem('investor');
      return;
    }

    await fetchAcquisitions();
  };

  const handleLoginRedirect = () => {
    localStorage.removeItem('investor');
    navigate('/investor/login');
  };

  const fetchAcquisitions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('investor-deal-locator', { 
        body: { action: 'get_assigned_deals', investor_id: investorId } 
      });
      
      if (error) {
        console.error('Error fetching acquisitions:', error);
        toast({
          title: 'Error loading acquisitions',
          description: 'Unable to load your acquisitions. Please try again.',
          variant: 'destructive'
        });
      } else {
        // Handle both response formats
        setAcquisitions(data?.deals || data?.assigned_deals || []);
      }
    } catch (e) {
      console.error('Fetch error:', e);
      toast({
        title: 'Error',
        description: 'Unable to connect to the server. Please try again.',
        variant: 'destructive'
      });
    }
    setLoading(false);
  };

  const handlePayNow = (assignment: any) => {
    setSelectedAssignment(assignment);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    if (selectedAssignment) {
      // Show success modal
      setCompletedPaymentId(selectedAssignment.payment_intent_id);
      setShowSuccessModal(true);
    }
    // Refresh acquisitions to show updated status
    fetchAcquisitions();
    toast({
      title: 'Payment Successful!',
      description: 'Your acquisition fee has been processed. Full property details are now available.',
    });
  };

  // Session Error UI
  if (sessionError) {
    return (
      <Card className="max-w-md mx-auto mt-8 border-2 border-red-200">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Session Issue</h3>
          <p className="text-gray-600 mb-6">{sessionError}</p>
          <div className="space-y-3">
            <Button 
              onClick={handleLoginRedirect}
              className="w-full bg-[#1a365d] hover:bg-[#2d4a7c]"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Log In Again
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setSessionError(null);
                setLoading(true);
                validateAndFetch();
              }}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>;

  if (acquisitions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <Home className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-600">No Active Acquisitions</h3>
        <p className="text-gray-500 mt-2">When you purchase a deal, your acquisition will appear here with full property details</p>
        <p className="text-sm text-gray-400 mt-4">Check the Deal Locator tab to see properties assigned to you</p>
      </div>
    );
  }

  // Separate paid and pending acquisitions
  const paidAcquisitions = acquisitions.filter(a => a.payment_status === 'paid' || a.assignment_status === 'paid');
  const pendingAcquisitions = acquisitions.filter(a => a.payment_status === 'pending' || a.assignment_status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-semibold text-gray-900">Your Acquisitions ({acquisitions.length})</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistoryModal(true)}>
            <Receipt className="w-4 h-4 mr-2" />
            Payment History
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAcquisitions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Pending Payments Alert */}
      {pendingAcquisitions.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <CreditCard className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800">
                  {pendingAcquisitions.length} Property Assignment{pendingAcquisitions.length > 1 ? 's' : ''} Pending Payment
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Complete your payment to unlock full property details including the exact address and landlord contact information.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Acquisitions */}
      {pendingAcquisitions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-700 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Pending Payment ({pendingAcquisitions.length})
          </h3>
          {pendingAcquisitions.map(acq => (
            <Card key={acq.id} className="overflow-hidden border-yellow-200">
              <CardHeader className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      {acq.title || 'Investment Property'}
                    </CardTitle>
                    <p className="text-sm text-white/80 mt-1">{acq.city}, {acq.state} {acq.zip_code}</p>
                    <p className="text-xs text-white/60 mt-1">Full address available after payment</p>
                  </div>
                  <Badge className="bg-white text-yellow-700">Payment Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="flex gap-4">
                  {acq.photos?.[0] ? (
                    <img 
                      src={acq.photos[0]} 
                      alt="" 
                      className="w-32 h-24 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-32 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <Bed className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                      <p className="font-bold">{acq.bedrooms || '-'}</p>
                      <p className="text-xs text-gray-500">Beds</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <Bath className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                      <p className="font-bold">{acq.bathrooms || '-'}</p>
                      <p className="text-xs text-gray-500">Baths</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <DollarSign className="w-5 h-5 mx-auto text-green-500 mb-1" />
                      <p className="font-bold text-green-700">${acq.monthly_rent?.toLocaleString() || '-'}</p>
                      <p className="text-xs text-gray-500">Rent/mo</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <p className="font-bold text-blue-700">{acq.cap_rate || 8}%</p>
                      <p className="text-xs text-gray-500">Cap Rate</p>
                    </div>
                  </div>
                </div>
                
                {acq.notes && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">{acq.notes}</p>
                  </div>
                )}

                {/* Payment CTA */}
                <div className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] rounded-lg p-4 text-white">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <p className="font-semibold">Acquisition Fee</p>
                      <p className="text-2xl font-bold">$499.00</p>
                      <p className="text-xs text-white/70">One-time payment</p>
                    </div>
                    <Button 
                      onClick={() => handlePayNow({
                        id: acq.assignment_id || acq.id,
                        property_id: acq.property_id || acq.id,
                        properties: {
                          id: acq.property_id || acq.id,
                          title: acq.title,
                          city: acq.city,
                          state: acq.state,
                          zip_code: acq.zip_code,
                          monthly_rent: acq.monthly_rent,
                          photos: acq.photos
                        }
                      })}
                      className="bg-[#d4a574] hover:bg-[#c49464] text-white"
                      size="lg"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pay Now & Unlock
                    </Button>
                  </div>
                </div>

                {/* What's Included */}
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Full property address
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Landlord contact info
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Deal documentation
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Active/Paid Acquisitions */}
      {paidAcquisitions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Active Acquisitions ({paidAcquisitions.length})
          </h3>
          {paidAcquisitions.map(acq => {
            const currentStageIdx = STAGES.findIndex(s => s.value === acq.workflow_stage) || 0;
            const isExpanded = expandedId === acq.id;
            const isComplete = acq.workflow_stage === 'completed';

            return (
              <Card key={acq.id} className="overflow-hidden">
                <CardHeader className={`${isComplete ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-[#1a365d] to-[#2d4a7c]'} text-white pb-4`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-[#d4a574]" />
                        {acq.title || acq.address || 'Investment Property'}
                      </CardTitle>
                      <p className="text-sm text-white/80 mt-1">{acq.city}, {acq.state} {acq.zip_code}</p>
                      {acq.address && (
                        <p className="text-xs text-white/60 mt-1">Full Address: {acq.address}</p>
                      )}
                    </div>
                    <Badge className={isComplete ? 'bg-white text-green-700' : 'bg-[#d4a574]'}>
                      {isComplete ? 'Complete' : STAGES[currentStageIdx]?.label || 'In Progress'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <Bed className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                      <p className="font-bold">{acq.bedrooms || '-'}</p>
                      <p className="text-xs text-gray-500">Beds</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <Bath className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                      <p className="font-bold">{acq.bathrooms || '-'}</p>
                      <p className="text-xs text-gray-500">Baths</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <DollarSign className="w-5 h-5 mx-auto text-green-500 mb-1" />
                      <p className="font-bold text-green-700">${acq.monthly_rent?.toLocaleString() || '-'}</p>
                      <p className="text-xs text-gray-500">Rent/mo</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <p className="font-bold text-blue-700">{acq.cap_rate || 8}%</p>
                      <p className="text-xs text-gray-500">Cap Rate</p>
                    </div>
                  </div>

                  {/* Workflow Progress */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Acquisition Progress
                    </h4>
                    <div className="flex gap-1 mb-2">
                      {STAGES.map((s, i) => (
                        <div 
                          key={s.value} 
                          className={`h-2 flex-1 rounded ${i < currentStageIdx ? 'bg-green-500' : i === currentStageIdx ? 'bg-blue-500' : 'bg-gray-200'}`} 
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-9 gap-1 text-xs">
                      {STAGES.map((s, i) => {
                        const Icon = s.icon;
                        const stageComplete = i < currentStageIdx;
                        const isCurrent = i === currentStageIdx;
                        return (
                          <div 
                            key={s.value} 
                            className={`text-center p-1 rounded ${stageComplete ? 'text-green-600' : isCurrent ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}
                          >
                            <Icon className="w-3 h-3 mx-auto mb-1" />
                            {s.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Landlord Info - only shown after lease_review stage */}
                  {currentStageIdx >= 3 && (
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                      <h4 className="font-semibold text-yellow-800 mb-2">Landlord Contact</h4>
                      <p className="text-sm">{acq.landlord_name || 'Contact details available'}</p>
                      {acq.landlord_email && <p className="text-sm text-blue-600">{acq.landlord_email}</p>}
                      {acq.landlord_phone && <p className="text-sm">{acq.landlord_phone}</p>}
                    </div>
                  )}

                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => setExpandedId(isExpanded ? null : acq.id)}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                    {isExpanded ? 'Hide Details' : 'View Full Details'}
                  </Button>

                  {isExpanded && (
                    <div className="border-t pt-4 space-y-3">
                      <p className="text-sm text-gray-700">
                        {acq.description || acq.notes || 'Property description will be available after acquisition is complete.'}
                      </p>
                      {acq.photos?.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {acq.photos.slice(0, 6).map((p: string, i: number) => (
                            <img key={i} src={p} alt="" className="rounded-lg h-24 w-full object-cover" />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Complete Payment</DialogTitle>
          </DialogHeader>
          {selectedAssignment && (
            <PaymentCheckout
              investorId={investorId}
              assignment={selectedAssignment}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPaymentModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Payment Successful</DialogTitle>
          </DialogHeader>
          {completedPaymentId && (
            <PaymentSuccess
              paymentIntentId={completedPaymentId}
              investorId={investorId}
              onClose={() => {
                setShowSuccessModal(false);
                setCompletedPaymentId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Payment History
            </DialogTitle>
          </DialogHeader>
          <PaymentHistory investorId={investorId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
