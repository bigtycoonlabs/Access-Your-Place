import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, CreditCard, CheckCircle, Lock, Unlock, Shield, 
  Star, Zap, Crown, MapPin, Clock, DollarSign, AlertTriangle,
  Building2, TrendingUp, Gift
} from 'lucide-react';

const stripePromise = loadStripe('pk_live_51OJhJBHdGQpsHqInIzu7c6PzGPSH0yImD4xfpofvxvFZs0VFhPRXZCyEgYkkhOtBOXFWvssYASs851mflwQvjnrl00T6DbUwWZ', {
  stripeAccount: 'acct_1SkzQdHCHxA6NXwy'
});

interface Props {
  investorId: string;
  onFundingComplete?: () => void;
}

interface FundingTier {
  id: string;
  name: string;
  amount: number;
  addresses_unlocked: number;
  features: string[];
  popular?: boolean;
}

interface FundingStatus {
  is_funded: boolean;
  funding_amount: number;
  funding_date: string | null;
  funding_tier: string;
  addresses_unlocked: number;
  is_priority: boolean;
}

// Payment form component
function PaymentForm({ 
  onSuccess, 
  onCancel,
  investorId,
  selectedTier
}: { 
  onSuccess: () => void; 
  onCancel: () => void;
  investorId: string;
  selectedTier: FundingTier;
}) {
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
          return_url: window.location.origin + '/investor?tab=funding&status=success',
        },
        redirect: 'if_required'
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setLoading(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Confirm funding on backend
        const { data, error: confirmError } = await supabase.functions.invoke('process-account-funding', {
          body: {
            action: 'confirm_funding',
            investor_id: investorId,
            payment_intent_id: paymentIntent.id
          }
        });

        if (confirmError || data?.error) {
          setError(data?.error || 'Failed to confirm funding');
          setLoading(false);
          return;
        }

        toast({
          title: 'Account Funded Successfully!',
          description: `You now have ${selectedTier.addresses_unlocked} property address${selectedTier.addresses_unlocked > 1 ? 'es' : ''} unlocked.`
        });
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center">
          <span className="font-medium">{selectedTier.name}</span>
          <span className="text-xl font-bold text-[#d4a574]">${selectedTier.amount.toLocaleString()}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {selectedTier.addresses_unlocked} property address{selectedTier.addresses_unlocked > 1 ? 'es' : ''} unlocked
        </p>
      </div>

      <PaymentElement options={{ layout: 'tabs' }} />
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
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
              Pay ${selectedTier.amount.toLocaleString()}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function AccountFunding({ investorId, onFundingComplete }: Props) {
  const [loading, setLoading] = useState(true);
  const [fundingStatus, setFundingStatus] = useState<FundingStatus | null>(null);
  const [tiers, setTiers] = useState<FundingTier[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [credits, setCredits] = useState<{ total_available: number; items: any[] }>({ total_available: 0, items: [] });
  const [selectedTier, setSelectedTier] = useState<FundingTier | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [investorId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, tiersRes] = await Promise.all([
        supabase.functions.invoke('process-account-funding', {
          body: { action: 'get_funding_status', investor_id: investorId }
        }),
        supabase.functions.invoke('process-account-funding', {
          body: { action: 'get_funding_tiers' }
        })
      ]);

      if (statusRes.data) {
        setFundingStatus(statusRes.data.funding_status);
        setHistory(statusRes.data.history || []);
        setCredits(statusRes.data.credits || { total_available: 0, items: [] });
      }

      if (tiersRes.data?.tiers) {
        setTiers(tiersRes.data.tiers);
      }
    } catch (err) {
      console.error('Error fetching funding data:', err);
    }
    setLoading(false);
  };

  const handleSelectTier = async (tier: FundingTier) => {
    setSelectedTier(tier);
    setProcessingPayment(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-account-funding', {
        body: {
          action: 'create_funding_payment',
          investor_id: investorId,
          amount: tier.amount,
          funding_type: 'account_activation'
        }
      });

      if (error || data?.error) {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to initialize payment',
          variant: 'destructive'
        });
        setProcessingPayment(false);
        return;
      }

      setClientSecret(data.clientSecret);
      setShowPaymentModal(true);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to initialize payment',
        variant: 'destructive'
      });
    }
    setProcessingPayment(false);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setClientSecret(null);
    setSelectedTier(null);
    fetchData();
    onFundingComplete?.();
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'standard': return <Shield className="w-6 h-6" />;
      case 'plus': return <Star className="w-6 h-6" />;
      case 'premium': return <Crown className="w-6 h-6" />;
      default: return <Shield className="w-6 h-6" />;
    }
  };

  const getTierColor = (tierId: string) => {
    switch (tierId) {
      case 'standard': return 'from-blue-500 to-blue-600';
      case 'plus': return 'from-[#d4a574] to-[#c49464]';
      case 'premium': return 'from-purple-500 to-purple-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  // Calculate remaining unlocks
  const usedUnlocks = history.filter(h => h.status === 'completed').reduce((sum, h) => sum + (h.addresses_unlocked || 0), 0);
  const remainingUnlocks = (fundingStatus?.addresses_unlocked || 0) - usedUnlocks;

  return (
    <div className="space-y-6">
      {/* Funding Status Card */}
      <Card className={`${fundingStatus?.is_funded ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-[#1a365d] to-[#2d4a7c]'} text-white`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            {fundingStatus?.is_funded ? (
              <>
                <CheckCircle className="w-6 h-6" />
                Account Funded
              </>
            ) : (
              <>
                <Lock className="w-6 h-6" />
                Account Not Funded
              </>
            )}
            {fundingStatus?.is_priority && (
              <Badge className="bg-[#d4a574] text-white ml-2">
                <Star className="w-3 h-3 mr-1" />
                Priority Investor
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-white/80">
            {fundingStatus?.is_funded 
              ? 'Your account is active and you have access to property addresses'
              : 'Fund your account to unlock property addresses and begin your evaluation'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-white/60">Total Funded</p>
              <p className="text-2xl font-bold">${(fundingStatus?.funding_amount || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Addresses Unlocked</p>
              <p className="text-2xl font-bold">{fundingStatus?.addresses_unlocked || 0}</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Remaining Unlocks</p>
              <p className="text-2xl font-bold">{remainingUnlocks}</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Available Credits</p>
              <p className="text-2xl font-bold text-[#d4a574]">${credits.total_available.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TOS Compliance Notice */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-2">Important: Address Protection Policy</p>
              <p>
                Property addresses are released only after account funding to protect our landlord relationships.
                <strong> Unauthorized landlord outreach before formal Success Team introduction is a violation of TOS 
                and grounds for an immediate platform ban.</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Funding Tiers */}
      {!fundingStatus?.is_funded && (
        <>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#1a365d]">Choose Your Activation Tier</h2>
            <p className="text-gray-600 mt-2">Select a tier to fund your account and unlock property addresses</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <Card 
                key={tier.id}
                className={`relative overflow-hidden transition-all hover:shadow-lg ${tier.popular ? 'ring-2 ring-[#d4a574]' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute top-0 right-0 bg-[#d4a574] text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                    Most Popular
                  </div>
                )}
                <CardHeader className={`bg-gradient-to-r ${getTierColor(tier.id)} text-white`}>
                  <div className="flex items-center gap-3">
                    {getTierIcon(tier.id)}
                    <div>
                      <CardTitle className="text-white">{tier.name}</CardTitle>
                      <p className="text-white/80 text-sm">{tier.addresses_unlocked} address{tier.addresses_unlocked > 1 ? 'es' : ''}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold text-[#1a365d]">${tier.amount.toLocaleString()}</span>
                    <span className="text-gray-500 ml-1">one-time</span>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    onClick={() => handleSelectTier(tier)}
                    disabled={processingPayment}
                    className={`w-full ${tier.popular ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}`}
                    variant={tier.popular ? 'default' : 'outline'}
                  >
                    {processingPayment && selectedTier?.id === tier.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Select {tier.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add More Unlocks (for funded accounts) */}
      {fundingStatus?.is_funded && remainingUnlocks <= 1 && (
        <Card className="border-[#d4a574]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#d4a574]" />
              Need More Address Unlocks?
            </CardTitle>
            <CardDescription>
              Add more address unlocks to continue evaluating properties
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {tiers.map((tier) => (
                <Button
                  key={tier.id}
                  variant="outline"
                  onClick={() => handleSelectTier(tier)}
                  disabled={processingPayment}
                  className="h-auto py-4 flex flex-col items-center"
                >
                  <span className="font-bold text-lg">${tier.amount}</span>
                  <span className="text-sm text-gray-500">{tier.addresses_unlocked} address{tier.addresses_unlocked > 1 ? 'es' : ''}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funding History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#d4a574]" />
              Funding History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tx.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                      {tx.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{tx.funding_tier?.charAt(0).toUpperCase() + tx.funding_tier?.slice(1)} Activation</p>
                      <p className="text-sm text-gray-500">
                        {tx.addresses_unlocked} address{tx.addresses_unlocked > 1 ? 'es' : ''} unlocked
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${tx.amount?.toLocaleString()}</p>
                    <Badge className={tx.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}>
                      {tx.status}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Credits */}
      {credits.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#d4a574]" />
              Available Credits
            </CardTitle>
            <CardDescription>
              Credits can be applied to acquisition fees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {credits.items.map((credit) => (
                <div 
                  key={credit.id}
                  className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-amber-800">${parseFloat(credit.amount).toLocaleString()}</p>
                    <p className="text-sm text-amber-600">{credit.source_description}</p>
                  </div>
                  {credit.expires_at && (
                    <p className="text-xs text-amber-600">
                      Expires {new Date(credit.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#d4a574]" />
              Complete Payment
            </DialogTitle>
            <DialogDescription>
              Enter your payment details to fund your account
            </DialogDescription>
          </DialogHeader>

          {clientSecret && selectedTier && (
            <Elements 
              stripe={stripePromise} 
              options={{ 
                clientSecret,
                appearance: { theme: 'stripe' }
              }}
            >
              <PaymentForm
                onSuccess={handlePaymentSuccess}
                onCancel={() => {
                  setShowPaymentModal(false);
                  setClientSecret(null);
                }}
                investorId={investorId}
                selectedTier={selectedTier}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
