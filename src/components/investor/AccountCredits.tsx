import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, CreditCard, CheckCircle, Lock, Unlock, Shield, 
  Star, Zap, Crown, Clock, DollarSign, AlertTriangle,
  Coins, Receipt, Gift, Send, History, Info, HelpCircle,
  User, Award, Search, Infinity
} from 'lucide-react';

const stripePromise = loadStripe('pk_live_51OJhJBHdGQpsHqInIzu7c6PzGPSH0yImD4xfpofvxvFZs0VFhPRXZCyEgYkkhOtBOXFWvssYASs851mflwQvjnrl00T6DbUwWZ', {
  stripeAccount: 'acct_1SkzQdHCHxA6NXwy'
});

interface Props {
  investorId: string;
  investorEmail?: string;
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

interface Credit {
  id: string;
  amount: number;
  credit_type: string;
  source_description: string;
  credit_status: string;
  expires_at: string | null;
  used_at?: string;
  created_at: string;
}

interface CreditSummary {
  total_active_credits: number;
  total_active_amount: number;
  total_used_credits: number;
  total_used_amount: number;
  total_saved: number;
  recent_usage: any[];
  active_credits: Credit[];
}

interface AcquisitionManager {
  first_name: string;
  last_name: string;
  verification_status: 'none' | 'pending' | 'verified' | 'not_found';
  is_yp_certified?: boolean;
}

// Payment form component
function PaymentForm({ 
  onSuccess, onCancel, investorId, selectedTier
}: { 
  onSuccess: () => void; onCancel: () => void; investorId: string; selectedTier: FundingTier;
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
        confirmParams: { return_url: window.location.origin + '/investor?tab=account&status=success' },
        redirect: 'if_required'
      });
      if (submitError) { setError(submitError.message || 'Payment failed'); setLoading(false); return; }
      if (paymentIntent?.status === 'succeeded') {
        const { data, error: confirmError } = await supabase.functions.invoke('process-account-funding', {
          body: { action: 'confirm_funding', investor_id: investorId, payment_intent_id: paymentIntent.id }
        });
        if (confirmError || data?.error) { setError(data?.error || 'Failed to confirm funding'); setLoading(false); return; }
        toast({ title: 'Account Funded!', description: `You now have ${selectedTier.addresses_unlocked} property address${selectedTier.addresses_unlocked > 1 ? 'es' : ''} unlocked.` });
        onSuccess();
      }
    } catch (err: any) { setError(err.message || 'An error occurred'); }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center">
          <span className="font-medium">{selectedTier.name}</span>
          <span className="text-xl font-bold text-[#d4a574]">${selectedTier.amount.toLocaleString()}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{selectedTier.addresses_unlocked} property address{selectedTier.addresses_unlocked > 1 ? 'es' : ''} unlocked</p>
      </div>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />{error}
        </div>
      )}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={!stripe || loading} className="flex-1 bg-[#d4a574] hover:bg-[#c49464]">
          {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>) : (<><Lock className="w-4 h-4 mr-2" />Pay ${selectedTier.amount.toLocaleString()}</>)}
        </Button>
      </div>
    </form>
  );
}

export function AccountCredits({ investorId, investorEmail, onFundingComplete }: Props) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [fundingStatus, setFundingStatus] = useState<FundingStatus | null>(null);
  const [tiers, setTiers] = useState<FundingTier[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);
  const [creditRequests, setCreditRequests] = useState<any[]>([]);
  const [selectedTier, setSelectedTier] = useState<FundingTier | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  const [acquisitionManager, setAcquisitionManager] = useState<AcquisitionManager>({ first_name: '', last_name: '', verification_status: 'none' });
  const [showAMModal, setShowAMModal] = useState(false);
  const [amForm, setAmForm] = useState({ first_name: '', last_name: '' });
  const [verifying, setVerifying] = useState(false);
  
  const [showCreditRequestModal, setShowCreditRequestModal] = useState(false);
  const [creditRequestForm, setCreditRequestForm] = useState({ amount: '', reason: '', details: '', property_address: '' });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => { fetchData(); }, [investorId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, tiersRes, creditsRes] = await Promise.allSettled([
        supabase.functions.invoke('process-account-funding', { body: { action: 'get_funding_status', investor_id: investorId } }),
        supabase.functions.invoke('process-account-funding', { body: { action: 'get_funding_tiers' } }),
        supabase.functions.invoke('manage-investor-credits', { body: { action: 'get_investor_credit_summary', investor_id: investorId } })
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.data) {
        setFundingStatus(statusRes.value.data.funding_status);
        setHistory(statusRes.value.data.history || []);
        if (statusRes.value.data.acquisition_manager) setAcquisitionManager(statusRes.value.data.acquisition_manager);
      }
      if (tiersRes.status === 'fulfilled' && tiersRes.value.data?.tiers) setTiers(tiersRes.value.data.tiers);
      if (creditsRes.status === 'fulfilled' && creditsRes.value.data?.summary) {
        setCreditSummary(creditsRes.value.data.summary);
      } else {
        // Fallback: direct DB query for credits
        try {
          const { data: directCredits } = await supabase
            .from('investor_credits')
            .select('*')
            .eq('investor_id', investorId)
            .eq('credit_status', 'active')
            .order('created_at', { ascending: false });
          if (directCredits && directCredits.length > 0) {
            const totalActive = directCredits.reduce((s, c) => s + (parseFloat(String(c.amount)) || 0), 0);
            setCreditSummary({
              total_active_credits: directCredits.length,
              total_active_amount: totalActive,
              total_used_credits: 0,
              total_used_amount: 0,
              total_saved: 0,
              recent_usage: [],
              active_credits: directCredits as any
            });
          }
        } catch {}
      }

      // Fetch credit requests
      try {
        const { data: requestsData } = await supabase.functions.invoke('investor-auth', {
          body: { action: 'get_credit_requests', investor_id: investorId }
        });
        if (requestsData?.requests) setCreditRequests(requestsData.requests);
      } catch {}
    } catch (err) { console.error('Error fetching data:', err); }
    setLoading(false);
  };

  const handleSelectTier = async (tier: FundingTier) => {
    setSelectedTier(tier);
    setProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-account-funding', {
        body: { action: 'create_funding_payment', investor_id: investorId, amount: tier.amount, funding_type: 'account_activation' }
      });
      if (error || data?.error) { toast({ title: 'Error', description: data?.error || 'Failed to initialize payment', variant: 'destructive' }); setProcessingPayment(false); return; }
      setClientSecret(data.clientSecret);
      setShowPaymentModal(true);
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setProcessingPayment(false);
  };

  const handlePaymentSuccess = () => { setShowPaymentModal(false); setClientSecret(null); setSelectedTier(null); fetchData(); onFundingComplete?.(); };

  const handleSaveAM = async () => {
    if (!amForm.first_name.trim() || !amForm.last_name.trim()) { toast({ title: 'Missing Information', description: 'Please enter both first and last name.', variant: 'destructive' }); return; }
    setVerifying(true);
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: { action: 'set_acquisition_manager', investor_id: investorId, am_first_name: amForm.first_name.trim(), am_last_name: amForm.last_name.trim() }
      });
      if (data?.success) {
        setAcquisitionManager({ first_name: amForm.first_name.trim(), last_name: amForm.last_name.trim(), verification_status: 'none' });
        toast({ title: 'Acquisition Manager Saved' });
        setShowAMModal(false);
      } else throw new Error(data?.error || 'Failed to save');
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setVerifying(false);
  };

  const handleRequestVerification = async () => {
    if (!acquisitionManager.first_name || !acquisitionManager.last_name) { toast({ title: 'No Acquisition Manager', variant: 'destructive' }); return; }
    setVerifying(true);
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: { action: 'request_am_verification', investor_id: investorId, investor_email: investorEmail, am_first_name: acquisitionManager.first_name, am_last_name: acquisitionManager.last_name }
      });
      if (data?.success) { setAcquisitionManager(prev => ({ ...prev, verification_status: 'pending' })); toast({ title: 'Verification Requested' }); }
      else throw new Error(data?.error || 'Failed');
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setVerifying(false);
  };

  const submitCreditRequest = async () => {
    if (!creditRequestForm.reason) { toast({ title: 'Missing Information', description: 'Please explain why you believe you have a credit.', variant: 'destructive' }); return; }
    setSubmittingRequest(true);
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: { action: 'submit_credit_request', investor_id: investorId, amount_requested: parseFloat(creditRequestForm.amount) || 0, description: creditRequestForm.reason, request_type: 'missing_credit', related_property_address: creditRequestForm.property_address, details: creditRequestForm.details }
      });
      if (data?.success) {
        toast({ title: 'Request Submitted' });
        setShowCreditRequestModal(false);
        setCreditRequestForm({ amount: '', reason: '', details: '', property_address: '' });
        fetchData();
      } else throw new Error(data?.error || 'Failed');
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setSubmittingRequest(false);
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>;

  const usedUnlocks = history.filter(h => h.status === 'completed').reduce((sum, h) => sum + (h.addresses_unlocked || 0), 0);
  const remainingUnlocks = (fundingStatus?.addresses_unlocked || 0) - usedUnlocks;

  return (
    <div className="space-y-6">
      {/* Account Status Card */}
      <Card className={`${fundingStatus?.is_funded ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-[#1a365d] to-[#2d4a7c]'} text-white`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            {fundingStatus?.is_funded ? (<><CheckCircle className="w-6 h-6" />Account Active</>) : (<><Lock className="w-6 h-6" />Account Not Funded</>)}
            {fundingStatus?.is_priority && <Badge className="bg-[#d4a574] text-white ml-2"><Star className="w-3 h-3 mr-1" />Priority Investor</Badge>}
          </CardTitle>
          <CardDescription className="text-white/80">
            {fundingStatus?.is_funded ? 'Your account is active with access to property addresses' : 'Fund your account to unlock property addresses'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div><p className="text-sm text-white/60">Total Funded</p><p className="text-2xl font-bold">${(fundingStatus?.funding_amount || 0).toLocaleString()}</p></div>
            <div><p className="text-sm text-white/60">Addresses Unlocked</p><p className="text-2xl font-bold">{fundingStatus?.addresses_unlocked || 0}</p></div>
            <div><p className="text-sm text-white/60">Remaining Unlocks</p><p className="text-2xl font-bold">{remainingUnlocks}</p></div>
            <div><p className="text-sm text-white/60">Available Credits</p><p className="text-2xl font-bold text-[#d4a574]">${(creditSummary?.total_active_amount || 0).toLocaleString()}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Acquisition Manager Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-[#d4a574]" />Your Acquisition Manager</CardTitle>
          <CardDescription>Enter the name of the acquisition manager you've been working with</CardDescription>
        </CardHeader>
        <CardContent>
          {acquisitionManager.first_name && acquisitionManager.last_name ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center text-white font-bold">
                    {acquisitionManager.first_name[0]}{acquisitionManager.last_name[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{acquisitionManager.first_name} {acquisitionManager.last_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {acquisitionManager.verification_status === 'verified' && acquisitionManager.is_yp_certified ? (
                        <Badge className="bg-green-500"><Award className="w-3 h-3 mr-1" />YP Certified</Badge>
                      ) : acquisitionManager.verification_status === 'verified' ? (
                        <Badge className="bg-blue-500"><CheckCircle className="w-3 h-3 mr-1" />Verified Staff</Badge>
                      ) : acquisitionManager.verification_status === 'pending' ? (
                        <Badge className="bg-amber-500"><Clock className="w-3 h-3 mr-1" />Verification Pending</Badge>
                      ) : acquisitionManager.verification_status === 'not_found' ? (
                        <Badge variant="outline" className="border-red-300 text-red-600">Not Found in System</Badge>
                      ) : (
                        <Badge variant="outline">Not Verified</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setAmForm({ first_name: acquisitionManager.first_name, last_name: acquisitionManager.last_name }); setShowAMModal(true); }}>Edit</Button>
                  {acquisitionManager.verification_status === 'none' && (
                    <Button size="sm" onClick={handleRequestVerification} disabled={verifying} className="bg-[#d4a574] hover:bg-[#c49464]">
                      {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}Verify YP Status
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <User className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 mb-4">No acquisition manager assigned yet</p>
              <Button onClick={() => setShowAMModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]"><User className="w-4 h-4 mr-2" />Enter Acquisition Manager</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="funding">Fund Account</TabsTrigger>
          <TabsTrigger value="credits">
            Credits
            {creditSummary?.total_active_credits ? <Badge className="ml-2 bg-green-500">{creditSummary.total_active_credits}</Badge> : null}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {history.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-[#d4a574]" />Funding History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {history.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tx.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                          {tx.status === 'completed' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-yellow-600" />}
                        </div>
                        <div>
                          <p className="font-medium">{tx.funding_tier?.charAt(0).toUpperCase() + tx.funding_tier?.slice(1)} Activation</p>
                          <p className="text-sm text-gray-500">{tx.addresses_unlocked} address{tx.addresses_unlocked > 1 ? 'es' : ''} unlocked</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${tx.amount?.toLocaleString()}</p>
                        <Badge className={tx.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}>{tx.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {creditSummary?.active_credits && creditSummary.active_credits.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Coins className="w-5 h-5 text-[#d4a574]" />Active Credits</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {creditSummary.active_credits.slice(0, 3).map((credit) => (
                    <div key={credit.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div>
                        <p className="font-bold text-amber-700">${parseFloat(String(credit.amount)).toLocaleString()}</p>
                        <p className="text-sm text-amber-600">{credit.source_description}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <Infinity className="w-3 h-3" />
                        <span>Never Expires</span>
                      </div>
                    </div>
                  ))}
                </div>
                {creditSummary.active_credits.length > 3 && (
                  <Button variant="link" onClick={() => setActiveTab('credits')} className="mt-2">View all {creditSummary.active_credits.length} credits</Button>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-2">Important Policy Information</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Account funding is <strong>non-refundable</strong> under all circumstances</li>
                    <li>The only exception: Private sales where a deal falls through due to seller/landlord issues</li>
                    <li>YP-verified deals and AYP-approved operations are not eligible for refunds</li>
                    <li>Credits are issued for incomplete acquisitions and can be applied to future deals</li>
                    <li><strong>Credits at Access Your Place do NOT expire</strong></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Funding Tab */}
        <TabsContent value="funding" className="space-y-4">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-2">Address Protection Policy</p>
                  <p>Property addresses are released only after account funding to protect our landlord relationships. <strong>Unauthorized landlord outreach before formal Success Team introduction is a violation of TOS.</strong></p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-[#1a365d]">{fundingStatus?.is_funded ? 'Add More Address Unlocks' : 'Choose Your Activation Tier'}</h2>
            <p className="text-gray-600 mt-1">Select a tier to unlock property addresses</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <Card key={tier.id} className={`relative overflow-hidden transition-all hover:shadow-lg ${tier.popular ? 'ring-2 ring-[#d4a574]' : ''}`}>
                {tier.popular && <div className="absolute top-0 right-0 bg-[#d4a574] text-white text-xs px-3 py-1 rounded-bl-lg font-medium">Most Popular</div>}
                <CardHeader className={`bg-gradient-to-r ${getTierColor(tier.id)} text-white`}>
                  <div className="flex items-center gap-3">
                    {getTierIcon(tier.id)}
                    <div><CardTitle className="text-white">{tier.name}</CardTitle><p className="text-white/80 text-sm">{tier.addresses_unlocked} address{tier.addresses_unlocked > 1 ? 'es' : ''}</p></div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold text-[#1a365d]">${tier.amount.toLocaleString()}</span>
                    <span className="text-gray-500 ml-1">one-time</span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /><span>{feature}</span></li>
                    ))}
                  </ul>
                  <Button onClick={() => handleSelectTier(tier)} disabled={processingPayment} className={`w-full ${tier.popular ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}`} variant={tier.popular ? 'default' : 'outline'}>
                    {processingPayment && selectedTier?.id === tier.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                    Select {tier.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-4">
          <Card className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-white/70">Available Credit</p>
                  <p className="text-3xl font-bold">${(creditSummary?.total_active_amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-white/60">{creditSummary?.total_active_credits || 0} active credit(s)</p>
                </div>
                <div>
                  <p className="text-sm text-white/70">Total Saved</p>
                  <p className="text-2xl font-bold">${(creditSummary?.total_saved || 0).toLocaleString()}</p>
                  <p className="text-xs text-white/60">Lifetime savings</p>
                </div>
                <div>
                  <p className="text-sm text-white/70">Credits Used</p>
                  <p className="text-2xl font-bold">${(creditSummary?.total_used_amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-white/60">{creditSummary?.total_used_credits || 0} credit(s)</p>
                </div>
                <div className="flex items-end">
                  <Button onClick={() => setShowCreditRequestModal(true)} variant="secondary" className="bg-white text-amber-600 hover:bg-gray-100">
                    <Send className="w-4 h-4 mr-2" />Report Missing Credit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {!creditSummary?.active_credits || creditSummary.active_credits.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Coins className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="font-medium">No active credits at this time</p>
                <p className="text-sm mt-2">Credits are issued when acquisitions are incomplete or as promotional bonuses.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Active Credits</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {creditSummary.active_credits.map((credit) => (
                    <div key={credit.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg"><Coins className="w-5 h-5 text-amber-600" /></div>
                        <div>
                          <p className="font-bold text-xl text-amber-700">${parseFloat(String(credit.amount)).toLocaleString()}</p>
                          <p className="text-sm text-gray-600">{credit.source_description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-500">Active</Badge>
                        <p className="text-xs text-gray-400 mt-2">Added {formatDate(credit.created_at)}</p>
                        <p className="text-xs text-green-600 mt-1 flex items-center justify-end gap-1">
                          <Infinity className="w-3 h-3" /> Never Expires
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {creditRequests.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-[#d4a574]" />Credit Requests</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {creditRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${request.request_status === 'approved' ? 'bg-green-100' : request.request_status === 'rejected' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                          {request.request_status === 'approved' ? <CheckCircle className="w-5 h-5 text-green-600" /> : request.request_status === 'rejected' ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <Clock className="w-5 h-5 text-yellow-600" />}
                        </div>
                        <div>
                          <p className="font-semibold">{request.amount_requested > 0 ? `$${request.amount_requested.toLocaleString()} Request` : 'Credit Request'}</p>
                          <p className="text-sm text-gray-500">{request.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={request.request_status === 'approved' ? 'bg-green-500' : request.request_status === 'rejected' ? 'bg-red-500' : 'bg-orange-500'}>{request.request_status}</Badge>
                        <p className="text-xs text-gray-400 mt-2">{formatDate(request.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Updated Credit Info - NO EXPIRATION */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Infinity className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold mb-2">How Credits Work at Access Your Place</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Credits are automatically applied at checkout for new acquisitions</li>
                    <li>Credits can <strong>only</strong> be applied to acquisition fees</li>
                    <li>Credits <strong>cannot</strong> be applied to logistics, furniture, or setup services</li>
                    <li className="font-semibold">Credits at Access Your Place do NOT expire — they remain on your account indefinitely</li>
                    <li>If you believe you're missing a credit, use the "Report Missing Credit" button above</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#d4a574]" />Complete Payment</DialogTitle>
            <DialogDescription>Enter your payment details to fund your account</DialogDescription>
          </DialogHeader>
          {clientSecret && selectedTier && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
              <PaymentForm onSuccess={handlePaymentSuccess} onCancel={() => { setShowPaymentModal(false); setClientSecret(null); }} investorId={investorId} selectedTier={selectedTier} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>

      {/* AM Modal */}
      <Dialog open={showAMModal} onOpenChange={setShowAMModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5 text-[#d4a574]" />Enter Acquisition Manager</DialogTitle>
            <DialogDescription>Enter the name of the acquisition manager you've been working with</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="am-first-name">First Name *</Label><Input id="am-first-name" value={amForm.first_name} onChange={(e) => setAmForm(f => ({ ...f, first_name: e.target.value }))} placeholder="John" /></div>
              <div><Label htmlFor="am-last-name">Last Name *</Label><Input id="am-last-name" value={amForm.last_name} onChange={(e) => setAmForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Smith" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAMModal(false)}>Cancel</Button>
            <Button onClick={handleSaveAM} disabled={verifying || !amForm.first_name.trim() || !amForm.last_name.trim()} className="bg-[#d4a574] hover:bg-[#c49464]">
              {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Request Modal */}
      <Dialog open={showCreditRequestModal} onOpenChange={setShowCreditRequestModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5 text-[#d4a574]" />Report Missing Credit</DialogTitle>
            <DialogDescription>If you believe you have a credit that's not showing, submit a request for review.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitCreditRequest(); }} className="space-y-4">
            <div>
              <Label>Estimated Credit Amount ($)</Label>
              <Input type="number" min="0" value={creditRequestForm.amount} onChange={(e) => setCreditRequestForm({ ...creditRequestForm, amount: e.target.value })} placeholder="499" />
              <p className="text-xs text-gray-500 mt-1">Leave blank if unsure</p>
            </div>
            <div>
              <Label>Related Property Address (if applicable)</Label>
              <Input value={creditRequestForm.property_address} onChange={(e) => setCreditRequestForm({ ...creditRequestForm, property_address: e.target.value })} placeholder="123 Main St, City, State" />
            </div>
            <div>
              <Label>Reason for Credit *</Label>
              <Textarea value={creditRequestForm.reason} onChange={(e) => setCreditRequestForm({ ...creditRequestForm, reason: e.target.value })} placeholder="e.g., I paid for a deal but the property fell through..." rows={3} required />
            </div>
            <div>
              <Label>Additional Details</Label>
              <Textarea value={creditRequestForm.details} onChange={(e) => setCreditRequestForm({ ...creditRequestForm, details: e.target.value })} placeholder="Any reference numbers, dates, or other information..." rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreditRequestModal(false)}>Cancel</Button>
              <Button type="submit" disabled={submittingRequest} className="bg-[#d4a574] hover:bg-[#c49464]">
                {submittingRequest && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
