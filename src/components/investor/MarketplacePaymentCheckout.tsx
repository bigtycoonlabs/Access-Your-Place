import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Shield, FileText, Handshake, CheckCircle, 
  Lock, CreditCard, AlertCircle, Users, Key
} from 'lucide-react';

// Initialize Stripe with the platform's publishable key
// Stripe retired 6 Aug 2026. The gateway these payments routed through
// (stripe.gateway.fastrouter.io) is NOT this company's, confirmed by the owner, so a
// card form here could have sent a client's money to a third party. Rails are Zelle,
// wire transfer, Cash App and Bitcoin — Penny issues a payment link.
// null means <Elements> never mounts a card field.
const stripePromise = null;

interface PaymentCheckoutProps {
  open: boolean;
  onClose: () => void;
  paymentType: 'verification' | 'report' | 'full_transaction' | 'escrow';
  listingId: string;
  investorId: string;
  investorEmail: string;
  investorName: string;
  salePrice: number;
  propertyAddress?: string;
  onSuccess: () => void;
}

interface PaymentFormProps {
  paymentType: 'verification' | 'report' | 'full_transaction' | 'escrow';
  listingId: string;
  investorId: string;
  salePrice: number;
  onSuccess: () => void;
  onCancel: () => void;
}

// Payment form component that uses Stripe Elements
function PaymentForm({ paymentType, listingId, investorId, salePrice, onSuccess, onCancel }: PaymentFormProps) {
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
          return_url: `${window.location.origin}/investor-portal?payment=success&type=${paymentType}&listing=${listingId}`,
        },
        redirect: 'if_required'
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setLoading(false);
        return;
      }

      // Payment succeeded
      if (paymentIntent?.status === 'succeeded') {
        // Update the deal status based on payment type
        let action = '';
        switch (paymentType) {
          case 'verification':
            action = 'request_verification';
            break;
          case 'report':
            action = 'release_report';
            break;
          case 'full_transaction':
          case 'escrow':
            action = 'opt_full_transaction';
            break;
        }

        const { data, error: updateError } = await supabase.functions.invoke('manage-deal-marketplace', {
          body: {
            action,
            listing_id: listingId,
            investor_id: investorId,
            payment_intent_id: paymentIntent.id
          }
        });

        if (updateError || data?.error) {
          console.error('Failed to update deal status:', updateError || data?.error);
        }

        toast({
          title: 'Payment Successful',
          description: getSuccessMessage(paymentType)
        });

        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    }

    setLoading(false);
  };

  const getSuccessMessage = (type: string) => {
    switch (type) {
      case 'verification':
        return 'Verification requested. Our team will begin the process within 24-48 hours.';
      case 'report':
        return 'Report released! You can now view the full verification details.';
      case 'full_transaction':
      case 'escrow':
        return 'Transaction initiated. Someone from the Success Team will be assigned shortly.';
      default:
        return 'Payment completed successfully.';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement 
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card']
        }}
      />
      
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          className="flex-1"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || loading}
          className="flex-1 bg-[#d4a574] hover:bg-[#c49464]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Pay Securely
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        Secured by Stripe. Your payment info is encrypted.
      </p>
    </form>
  );
}

export function MarketplacePaymentCheckout({
  open,
  onClose,
  paymentType,
  listingId,
  investorId,
  investorEmail,
  investorName,
  salePrice,
  propertyAddress,
  onSuccess
}: PaymentCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Calculate amount based on payment type
  const getAmount = () => {
    switch (paymentType) {
      case 'verification':
        return 100;
      case 'report':
        return 99;
      case 'full_transaction':
        return Math.round(salePrice * 0.2);
      case 'escrow':
        return salePrice;
      default:
        return 0;
    }
  };

  const amount = getAmount();

  // Create PaymentIntent when modal opens
  useEffect(() => {
    if (open && !clientSecret) {
      createPaymentIntent();
    }
  }, [open]);

  const createPaymentIntent = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('marketplace-payments', {
        body: {
          action: paymentType === 'escrow' ? 'create_escrow_payment' : 'create_payment_intent',
          payment_type: paymentType,
          listing_id: listingId,
          investor_id: investorId,
          customer_email: investorEmail,
          customer_name: investorName,
          amount: paymentType === 'full_transaction' ? salePrice : undefined,
          sale_price: paymentType === 'escrow' ? salePrice : undefined
        }
      });

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'Failed to initialize payment');
      }

      setClientSecret(data.client_secret);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Payment Error',
        description: err.message,
        variant: 'destructive'
      });
    }

    setLoading(false);
  };

  const handleClose = () => {
    setClientSecret(null);
    setError(null);
    onClose();
  };

  const getPaymentTitle = () => {
    switch (paymentType) {
      case 'verification':
        return 'Request Deal Verification';
      case 'report':
        return 'Release Verification Report';
      case 'full_transaction':
        return 'Full Transaction Management';
      case 'escrow':
        return 'Complete Purchase';
      default:
        return 'Payment';
    }
  };

  const getPaymentIcon = () => {
    switch (paymentType) {
      case 'verification':
        return Shield;
      case 'report':
        return FileText;
      case 'full_transaction':
        return Handshake;
      case 'escrow':
        return Key;
      default:
        return CreditCard;
    }
  };

  const PaymentIcon = getPaymentIcon();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PaymentIcon className="w-5 h-5 text-[#d4a574]" />
            {getPaymentTitle()}
          </DialogTitle>
          {propertyAddress && (
            <DialogDescription>
              For property: {propertyAddress}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Summary */}
          <Card className="bg-gray-50">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Service:</span>
                  <Badge variant="outline">{getPaymentTitle()}</Badge>
                </div>
                
                {paymentType === 'full_transaction' && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Sale Price:</span>
                      <span>${salePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">AYP Fee (20%):</span>
                      <span>${amount.toLocaleString()}</span>
                    </div>
                  </>
                )}

                {paymentType === 'escrow' && (
                  <div className="text-sm text-gray-600">
                    <p>Full purchase amount held in escrow until:</p>
                    <ul className="mt-2 space-y-1 text-xs">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        All documents signed
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Property access transferred
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Lease agreements completed
                      </li>
                    </ul>
                  </div>
                )}

                <Separator />
                
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Due:</span>
                  <span className="text-2xl font-bold text-[#1a365d]">
                    ${amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What's Included */}
          <div className="text-sm text-gray-600">
            {paymentType === 'verification' && (
              <div className="space-y-2">
                <p className="font-medium">Verification includes:</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Seller verification call
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Landlord vetting
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Property standards check
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Revenue verification
                  </li>
                </ul>
              </div>
            )}

            {paymentType === 'report' && (
              <div className="space-y-2">
                <p className="font-medium">Report includes:</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Full verification findings
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Landlord contact information
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    License requirements
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Property condition notes
                  </li>
                </ul>
              </div>
            )}

            {(paymentType === 'full_transaction' || paymentType === 'escrow') && (
              <div className="space-y-2">
                <p className="font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Full transaction management includes:
                </p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Dedicated Success Team support
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Acquisition agreements
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Lease transfer documents
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Compliance verification
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Escrow protection
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Stripe Payment Form */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-2" />
              <p className="text-red-600">{error}</p>
              <Button 
                variant="outline" 
                onClick={createPaymentIntent}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          )}

          {clientSecret && !loading && !error && (
            <Elements 
              stripe={stripePromise} 
              options={{ 
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#d4a574',
                    borderRadius: '8px'
                  }
                }
              }}
            >
              <PaymentForm
                paymentType={paymentType}
                listingId={listingId}
                investorId={investorId}
                salePrice={salePrice}
                onSuccess={() => {
                  handleClose();
                  onSuccess();
                }}
                onCancel={handleClose}
              />
            </Elements>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Transaction Status Tracker Component
export function TransactionStatusTracker({ 
  status, 
  successManager 
}: { 
  status: string;
  successManager?: { name: string; email: string; phone?: string };
}) {
  const stages = [
    { key: 'pending_payment', label: 'Payment', icon: CreditCard },
    { key: 'payment_received', label: 'Escrow', icon: Lock },
    { key: 'documents_pending', label: 'Documents', icon: FileText },
    { key: 'documents_signed', label: 'Signed', icon: CheckCircle },
    { key: 'access_transferred', label: 'Access', icon: Key },
    { key: 'completed', label: 'Complete', icon: CheckCircle }
  ];

  const currentIndex = stages.findIndex(s => s.key === status);

  return (
    <Card>
      <CardContent className="pt-4">
        <h4 className="font-semibold mb-4">Transaction Progress</h4>
        
        <div className="flex justify-between mb-6">
          {stages.map((stage, index) => {
            const isComplete = index < currentIndex;
            const isCurrent = index === currentIndex;
            const StageIcon = stage.icon;

            return (
              <div key={stage.key} className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${isComplete ? 'bg-green-500 text-white' : 
                    isCurrent ? 'bg-[#d4a574] text-white' : 
                    'bg-gray-200 text-gray-400'}
                `}>
                  <StageIcon className="w-5 h-5" />
                </div>
                <span className={`text-xs mt-1 ${isCurrent ? 'font-semibold' : ''}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>

        {successManager && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-800">Your Success Manager</p>
            <p className="font-semibold">{successManager.name}</p>
            <p className="text-sm text-blue-600">{successManager.email}</p>
            {successManager.phone && (
              <p className="text-sm text-blue-600">{successManager.phone}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
