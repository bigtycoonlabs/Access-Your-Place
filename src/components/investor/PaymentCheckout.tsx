import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, CreditCard, CheckCircle, AlertCircle, Shield, 
  MapPin, Building2, DollarSign, FileText, Download, X,
  ArrowLeft, Lock, Coins, Gift, Clock, ChevronDown, ChevronUp
} from 'lucide-react';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe('pk_live_51OJhJBHdGQpsHqInIzu7c6PzGPSH0yImD4xfpofvxvFZs0VFhPRXZCyEgYkkhOtBOXFWvssYASs851mflwQvjnrl00T6DbUwWZ');

interface Credit {
  id: string;
  amount: number;
  credit_type: string;
  source_description: string;
  expires_at: string;
  credit_status: string;
}

interface PaymentCheckoutProps {
  investorId: string;
  assignment: {
    id: string;
    property_id: string;
    properties?: {
      id: string;
      title: string;
      address?: string;
      city: string;
      state: string;
      zip_code: string;
      monthly_rent?: number;
      photos?: string[];
    };
  };
  onSuccess: () => void;
  onCancel: () => void;
}

interface PaymentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  paymentIntentId: string;
  creditsApplied: number;
}

function PaymentForm({ onSuccess, onCancel, paymentIntentId, creditsApplied }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/investor/portal?payment=success',
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed. Please try again.');
        setLoading(false);
        return;
      }

      // Payment succeeded without redirect
      if (paymentIntent?.status === 'succeeded') {
        toast({
          title: 'Payment Successful!',
          description: creditsApplied > 0 
            ? `Your acquisition fee has been processed with $${creditsApplied.toFixed(2)} in credits applied.`
            : 'Your acquisition fee has been processed.',
        });
        onSuccess();
      } else if (paymentIntent?.status === 'processing') {
        toast({
          title: 'Payment Processing',
          description: 'Your payment is being processed. We\'ll update you shortly.',
        });
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg border">
        <PaymentElement 
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card'],
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Payment Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Lock className="w-4 h-4" />
        <span>Your payment is secured with 256-bit SSL encryption</span>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-[#1a365d] hover:bg-[#2d4a7c]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay Now
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// Credit Selection Component
function CreditSelector({ 
  credits, 
  selectedCredits, 
  onSelectionChange,
  maxAmount
}: { 
  credits: Credit[];
  selectedCredits: string[];
  onSelectionChange: (creditIds: string[], totalAmount: number) => void;
  maxAmount: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleCreditToggle = (creditId: string, creditAmount: number) => {
    let newSelection: string[];
    
    if (selectedCredits.includes(creditId)) {
      newSelection = selectedCredits.filter(id => id !== creditId);
    } else {
      newSelection = [...selectedCredits, creditId];
    }

    // Calculate total selected amount
    const totalSelected = credits
      .filter(c => newSelection.includes(c.id))
      .reduce((sum, c) => sum + parseFloat(String(c.amount)), 0);

    onSelectionChange(newSelection, Math.min(totalSelected * 100, maxAmount)); // Convert to cents, cap at max
  };

  const totalAvailable = credits.reduce((sum, c) => sum + parseFloat(String(c.amount)), 0);
  const totalSelected = credits
    .filter(c => selectedCredits.includes(c.id))
    .reduce((sum, c) => sum + parseFloat(String(c.amount)), 0);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getCreditTypeLabel = (type: string) => {
    switch (type) {
      case 'incomplete_acquisition': return 'Incomplete Acquisition';
      case 'approved_request': return 'Approved Request';
      case 'manual': return 'Manual Credit';
      case 'referral': return 'Referral Bonus';
      case 'promotional': return 'Promotional';
      default: return type;
    }
  };

  if (credits.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden bg-gradient-to-r from-amber-50 to-yellow-50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <Coins className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-amber-900">
              You have ${totalAvailable.toFixed(2)} in available credits
            </p>
            <p className="text-sm text-amber-700">
              {selectedCredits.length > 0 
                ? `$${Math.min(totalSelected, maxAmount / 100).toFixed(2)} selected to apply`
                : 'Click to apply credits to this purchase'}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-amber-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-amber-600" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-amber-200 p-4 space-y-3">
          <p className="text-sm text-amber-800 mb-3">
            Select which credits to apply to this acquisition:
          </p>
          
          {credits.map((credit) => {
            const isSelected = selectedCredits.includes(credit.id);
            const daysUntilExpiry = Math.ceil(
              (new Date(credit.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            const isExpiringSoon = daysUntilExpiry <= 30;

            return (
              <div 
                key={credit.id}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-amber-400 bg-amber-100' 
                    : 'border-amber-200 bg-white hover:border-amber-300'
                }`}
                onClick={() => handleCreditToggle(credit.id, parseFloat(String(credit.amount)))}
              >
                <div className="flex items-start gap-3">
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => handleCreditToggle(credit.id, parseFloat(String(credit.amount)))}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-lg text-amber-900">
                        ${parseFloat(String(credit.amount)).toFixed(2)}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={isExpiringSoon ? 'border-red-300 text-red-700 bg-red-50' : 'border-amber-300 text-amber-700'}
                      >
                        {isExpiringSoon ? (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            Expires in {daysUntilExpiry} days
                          </>
                        ) : (
                          `Expires ${formatDate(credit.expires_at)}`
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {credit.source_description || getCreditTypeLabel(credit.credit_type)}
                    </p>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {getCreditTypeLabel(credit.credit_type)}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}

          {selectedCredits.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-green-800 font-medium">Credits to apply:</span>
                <span className="text-green-700 font-bold text-lg">
                  -${Math.min(totalSelected, maxAmount / 100).toFixed(2)}
                </span>
              </div>
              {totalSelected * 100 > maxAmount && (
                <p className="text-xs text-green-600 mt-1">
                  Note: Only ${(maxAmount / 100).toFixed(2)} can be applied (remaining credits will be saved)
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PaymentCheckout({ investorId, assignment, onSuccess, onCancel }: PaymentCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseAmount, setBaseAmount] = useState<number>(49900);
  const [finalAmount, setFinalAmount] = useState<number>(49900);
  const [creditsApplied, setCreditsApplied] = useState<number>(0);
  const [availableCredits, setAvailableCredits] = useState<Credit[]>([]);
  const [selectedCreditIds, setSelectedCreditIds] = useState<string[]>([]);
  const [paidWithCredits, setPaidWithCredits] = useState(false);
  const { toast } = useToast();

  const property = assignment.properties;

  useEffect(() => {
    fetchAvailableCredits();
  }, []);

  const fetchAvailableCredits = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'get_available_credits',
          investor_id: investorId
        }
      });

      if (data?.credits) {
        setAvailableCredits(data.credits);
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    } finally {
      // After fetching credits, create payment intent
      createPaymentIntent([], 0);
    }
  };

  const handleCreditSelectionChange = (creditIds: string[], totalAmount: number) => {
    setSelectedCreditIds(creditIds);
    setCreditsApplied(totalAmount / 100); // Convert cents to dollars for display
    
    // Recalculate final amount
    const newFinalAmount = Math.max(0, baseAmount - totalAmount);
    setFinalAmount(newFinalAmount);
  };

  const createPaymentIntent = async (creditIds: string[] = [], creditAmount: number = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'create_payment_intent',
          investor_id: investorId,
          assignment_id: assignment.id,
          applied_credits: creditAmount,
          credit_ids: creditIds
        }
      });

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'Failed to initialize payment');
      }

      // Check if paid entirely with credits
      if (data.paid_with_credits) {
        setPaidWithCredits(true);
        setCreditsApplied(data.credits_applied || 0);
        toast({
          title: 'Payment Complete!',
          description: `Your acquisition fee was fully covered by $${data.credits_applied?.toFixed(2)} in credits.`,
        });
        onSuccess();
        return;
      }

      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setBaseAmount(data.original_amount || 49900);
      setFinalAmount(data.amount || 49900);
      setCreditsApplied(data.credits_applied || 0);
    } catch (err: any) {
      console.error('Payment init error:', err);
      setError(err.message);
      toast({
        title: 'Payment Error',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCredits = () => {
    // Recreate payment intent with selected credits
    const totalCreditAmount = availableCredits
      .filter(c => selectedCreditIds.includes(c.id))
      .reduce((sum, c) => sum + parseFloat(String(c.amount)) * 100, 0);
    
    createPaymentIntent(selectedCreditIds, Math.min(totalCreditAmount, baseAmount));
  };

  const handlePaymentSuccess = async () => {
    // Confirm payment on backend
    if (paymentIntentId) {
      try {
        await supabase.functions.invoke('process-acquisition-payment', {
          body: {
            action: 'confirm_payment',
            investor_id: investorId,
            payment_intent_id: paymentIntentId
          }
        });
      } catch (err) {
        console.error('Failed to confirm payment on backend:', err);
      }
    }
    onSuccess();
  };

  if (paidWithCredits) {
    return (
      <Card className="max-w-lg mx-auto overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center text-white">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Payment Complete!</h2>
          <p className="text-white/90">Your credits have been applied</p>
        </div>
        <CardContent className="p-6 text-center">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <Coins className="w-8 h-8 text-amber-600 mx-auto mb-2" />
            <p className="font-semibold text-amber-900">
              ${creditsApplied.toFixed(2)} in credits applied
            </p>
            <p className="text-sm text-amber-700">
              Your acquisition fee was fully covered by your available credits
            </p>
          </div>
          <Button onClick={onSuccess} className="w-full bg-[#1a365d] hover:bg-[#2d4a7c]">
            Continue to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#d4a574] mx-auto mb-4" />
          <p className="text-gray-600">Initializing secure payment...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="max-w-lg mx-auto border-red-200">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Error</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onCancel}>
              Go Back
            </Button>
            <Button onClick={() => createPaymentIntent(selectedCreditIds, creditsApplied * 100)} className="bg-[#1a365d] hover:bg-[#2d4a7c]">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <CardTitle>Complete Your Payment</CardTitle>
              <CardDescription className="text-white/80">
                Secure acquisition fee payment
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Property Summary */}
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#1a365d]" />
              Property Details
            </h4>
            <div className="flex gap-4">
              {property?.photos?.[0] ? (
                <img 
                  src={property.photos[0]} 
                  alt="" 
                  className="w-24 h-24 object-cover rounded-lg"
                />
              ) : (
                <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <h5 className="font-semibold text-[#1a365d]">
                  {property?.title || 'Investment Property'}
                </h5>
                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {property?.city}, {property?.state} {property?.zip_code}
                </p>
                {property?.monthly_rent && (
                  <p className="text-sm text-green-600 font-medium mt-2">
                    ${property.monthly_rent.toLocaleString()}/month rent
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Available Credits Section */}
          {availableCredits.length > 0 && (
            <CreditSelector
              credits={availableCredits}
              selectedCredits={selectedCreditIds}
              onSelectionChange={handleCreditSelectionChange}
              maxAmount={baseAmount}
            />
          )}

          {/* Apply Credits Button (if selection changed) */}
          {selectedCreditIds.length > 0 && !clientSecret && (
            <Button 
              onClick={handleApplyCredits}
              className="w-full bg-amber-500 hover:bg-amber-600"
            >
              <Coins className="w-4 h-4 mr-2" />
              Apply ${creditsApplied.toFixed(2)} in Credits
            </Button>
          )}

          {/* Payment Summary */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1a365d]" />
                Payment Summary
              </h4>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Property Acquisition Fee</span>
                <span className="font-medium">${(baseAmount / 100).toFixed(2)}</span>
              </div>
              
              {creditsApplied > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    Credits Applied
                  </span>
                  <span className="font-medium text-amber-600">-${creditsApplied.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Processing Fee</span>
                <span className="font-medium text-green-600">$0.00</span>
              </div>
              
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold text-gray-900">Total Due</span>
                <div className="text-right">
                  {creditsApplied > 0 && (
                    <span className="text-sm text-gray-400 line-through mr-2">
                      ${(baseAmount / 100).toFixed(2)}
                    </span>
                  )}
                  <span className="font-bold text-xl text-[#1a365d]">
                    ${(finalAmount / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {creditsApplied > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                  <p className="text-sm text-green-700 flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    You're saving ${creditsApplied.toFixed(2)} with your credits!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* What's Included */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              What's Included
            </h4>
            <ul className="space-y-2 text-sm text-green-700">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                Full property address access
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                Landlord contact information
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                Deal documentation package
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                Negotiation support from our team
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                Property verification report
              </li>
            </ul>
          </div>

          {/* Stripe Payment Form - only show if there's an amount to pay */}
          {clientSecret && finalAmount > 0 && (
            <Elements 
              stripe={stripePromise} 
              options={{ 
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#1a365d',
                    colorBackground: '#ffffff',
                    colorText: '#1a365d',
                    colorDanger: '#dc2626',
                    fontFamily: 'system-ui, sans-serif',
                    borderRadius: '8px',
                  }
                }
              }}
            >
              <PaymentForm 
                onSuccess={handlePaymentSuccess}
                onCancel={onCancel}
                paymentIntentId={paymentIntentId || ''}
                creditsApplied={creditsApplied}
              />
            </Elements>
          )}

          {/* If no payment needed (fully covered by credits) */}
          {finalAmount === 0 && selectedCreditIds.length > 0 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <Coins className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <p className="font-semibold text-amber-900">
                  Your credits fully cover this acquisition!
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  No additional payment required
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleApplyCredits}
                  className="flex-1 bg-amber-500 hover:bg-amber-600"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Complete with Credits
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-gray-50 border-t px-6 py-4">
          <div className="flex items-center gap-4 text-xs text-gray-500 w-full justify-center">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4" />
              <span>Secure Payment</span>
            </div>
            <span>•</span>
            <span>Powered by Stripe</span>
            <span>•</span>
            <span>256-bit SSL</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// Payment Success Component
export function PaymentSuccess({ 
  paymentIntentId, 
  investorId,
  onClose 
}: { 
  paymentIntentId: string;
  investorId: string;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReceipt();
  }, []);

  const fetchReceipt = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'generate_receipt',
          investor_id: investorId,
          payment_intent_id: paymentIntentId
        }
      });

      if (data?.receipt) {
        setReceipt(data.receipt);
      }
    } catch (err) {
      console.error('Failed to fetch receipt:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receipt) return;

    // Create a simple text receipt for download
    const creditsLine = receipt.credits_applied > 0 
      ? `Credits Applied: -$${(receipt.credits_applied / 100).toFixed(2)}\n` 
      : '';
    
    const receiptText = `
PAYMENT RECEIPT
===============

Receipt Number: ${receipt.receipt_number}
Date: ${new Date(receipt.payment_date).toLocaleDateString()}

BILLED TO:
${receipt.investor.name}
${receipt.investor.email}
${receipt.investor.company || ''}

PROPERTY:
${receipt.property.title}
${receipt.property.address}
${receipt.property.city}, ${receipt.property.state} ${receipt.property.zip_code}

PAYMENT DETAILS:
Original Amount: $${(receipt.original_amount / 100).toFixed(2)} ${receipt.currency.toUpperCase()}
${creditsLine}Amount Charged: $${(receipt.amount / 100).toFixed(2)} ${receipt.currency.toUpperCase()}
Status: ${receipt.status}
Payment Method: ${receipt.payment_method}
Description: ${receipt.description}

---
${receipt.company.name}
${receipt.company.address}
${receipt.company.support_email}
    `.trim();

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${receipt.receipt_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Receipt Downloaded',
      description: 'Your payment receipt has been downloaded.',
    });
  };

  return (
    <Card className="max-w-lg mx-auto overflow-hidden">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center text-white">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
        <p className="text-white/90">Your acquisition fee has been processed</p>
      </div>

      <CardContent className="p-6 space-y-6">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#d4a574] mx-auto" />
            <p className="text-gray-500 mt-2">Loading receipt...</p>
          </div>
        ) : receipt ? (
          <>
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-gray-500">Receipt Number</p>
                  <p className="font-mono font-bold text-[#1a365d]">{receipt.receipt_number}</p>
                </div>
                <Badge className="bg-green-100 text-green-700">Paid</Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span>{new Date(receipt.payment_date).toLocaleDateString()}</span>
                </div>
                {receipt.credits_applied > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Original Amount</span>
                      <span>${(receipt.original_amount / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-amber-600">
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        Credits Applied
                      </span>
                      <span>-${(receipt.credits_applied / 100).toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount Charged</span>
                  <span className="font-bold text-green-600">
                    ${(receipt.amount / 100).toFixed(2)} {receipt.currency.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Property</span>
                  <span className="text-right">
                    {receipt.property.city}, {receipt.property.state}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Method</span>
                  <span>{receipt.payment_method}</span>
                </div>
              </div>
            </div>

            {receipt.credits_applied > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <Coins className="w-5 h-5" />
                  <span className="font-medium">
                    You saved ${(receipt.credits_applied / 100).toFixed(2)} with credits!
                  </span>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">What's Next?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Full property address is now visible in your dashboard</li>
                <li>• Our team will contact you within 24 hours</li>
                <li>• Check your email for deal documentation</li>
              </ul>
            </div>

            <Button 
              onClick={handleDownloadReceipt}
              variant="outline"
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Receipt
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">Receipt details will be emailed to you.</p>
          </div>
        )}

        <Button 
          onClick={onClose}
          className="w-full bg-[#1a365d] hover:bg-[#2d4a7c]"
        >
          Return to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}

// Payment History Component
export function PaymentHistory({ investorId }: { investorId: string }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'get_payment_history',
          investor_id: investorId
        }
      });

      if (data?.payments) {
        setPayments(data.payments);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574] mx-auto" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No payment history yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {payments.map((payment) => (
        <Card key={payment.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-[#1a365d]">
                  {payment.property_assignments?.properties?.title || 'Acquisition Fee'}
                </p>
                <p className="text-sm text-gray-500">
                  {payment.property_assignments?.properties?.city}, {payment.property_assignments?.properties?.state}
                </p>
                {payment.credits_applied > 0 && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                    <Coins className="w-3 h-3" />
                    ${(payment.credits_applied / 100).toFixed(2)} credits applied
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-green-600">
                ${(payment.amount / 100).toFixed(2)}
              </p>
              {payment.credits_applied > 0 && (
                <p className="text-xs text-gray-400 line-through">
                  ${((payment.original_amount || payment.amount) / 100).toFixed(2)}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {new Date(payment.paid_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Credit Usage History Component
export function CreditUsageHistory({ investorId }: { investorId: string }) {
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageHistory();
  }, []);

  const fetchUsageHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'get_credit_usage_history',
          investor_id: investorId
        }
      });

      if (data?.usage_history) {
        setUsageHistory(data.usage_history);
      }
    } catch (err) {
      console.error('Failed to fetch credit usage history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574] mx-auto" />
      </div>
    );
  }

  if (usageHistory.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Coins className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No credit usage history yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {usageHistory.map((usage) => (
        <Card key={usage.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-[#1a365d]">
                  Credits Applied to Acquisition
                </p>
                <p className="text-sm text-gray-500">
                  {usage.credits_used?.length || 0} credit(s) used
                </p>
                <Badge variant="outline" className="mt-1 text-xs">
                  {usage.transaction_type === 'credits_only' ? 'Fully Covered' : 'Partial Payment'}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-amber-600">
                -${usage.total_credit_amount?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(usage.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
