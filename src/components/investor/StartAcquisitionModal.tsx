import { useState, useEffect } from 'react';
import PaymentMethodPanel from '@/components/investor/PaymentMethodPanel';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, CreditCard, CheckCircle, AlertCircle, Shield, 
  MapPin, Building2, DollarSign, FileText, Upload, X,
  ArrowLeft, Lock, Coins, Clock, AlertTriangle, Banknote,
  Copy, ExternalLink, Phone, Mail, User
} from 'lucide-react';

const stripePromise = loadStripe('pk_live_51OJhJBHdGQpsHqInIzu7c6PzGPSH0yImD4xfpofvxvFZs0VFhPRXZCyEgYkkhOtBOXFWvssYASs851mflwQvjnrl00T6DbUwWZ');

interface Deal {
  id: string;
  listing_title?: string;
  city: string;
  state: string;
  zip_code?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthly_rent?: number;
  acquisition_fee?: number;
  photos?: string[];
  is_verified?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
  investorId: string;
  investorName: string;
  investorEmail: string;
  hasAcquisitionManager: boolean;
  acquisitionManagerName?: string;
  onSuccess: () => void;
}

// PAYMENT_INFO REMOVED -- it was fabricated placeholder data rendered to real clients
// with working copy buttons: a Zelle address on a domain we do not own, a (555) 123-4567
// placeholder phone, "Your Places LLC" (the wrong legal entity), a masked account number
// against a real Chase routing number, and an invented street address.
//
// A client could copy those and send a wire. Nothing in the UI marked them as fake.
//
// Payment destinations now come from ONE place: company_payment_methods, read through
// get-payment-methods and rendered by PaymentMethodPanel with copy buttons, aria-live
// announcements and 44px targets. A destination is never hardcoded in a component again.

// Terms of Service Component
function TermsOfService({ onAccept, accepted }: { onAccept: (accepted: boolean) => void; accepted: boolean }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border rounded-lg">
        <ScrollArea className="h-64 p-4">
          <div className="prose prose-sm max-w-none">
            <h3 className="text-lg font-semibold mb-4">Acquisition Service Agreement</h3>
            
            <p className="text-sm text-gray-600 mb-4">
              By proceeding with this acquisition, you agree to the following terms:
            </p>

            <h4 className="font-semibold mt-4 mb-2">1. Service Description</h4>
            <p className="text-sm text-gray-600">
              Your Places provides acquisition services to help investors secure rental arbitrage properties. 
              Our services include property research, landlord negotiation, lease review assistance, and 
              ongoing support throughout the acquisition process.
            </p>

            <h4 className="font-semibold mt-4 mb-2">2. Acquisition Fee</h4>
            <p className="text-sm text-gray-600">
              The acquisition fee is a one-time payment for our services. This fee covers property research, 
              landlord outreach, negotiation support, and access to our platform resources. The fee is 
              non-refundable once the acquisition process has begun.
            </p>

            <h4 className="font-semibold mt-4 mb-2">3. Property Information</h4>
            <p className="text-sm text-gray-600">
              Full property details including the exact address and landlord contact information will be 
              released only after payment is confirmed. Property availability is not guaranteed until 
              a lease agreement is signed.
            </p>

            <h4 className="font-semibold mt-4 mb-2">4. No Guarantee of Approval</h4>
            <p className="text-sm text-gray-600">
              While we assist with the application process, we cannot guarantee landlord approval. 
              If your application is denied through no fault of your own, you may be eligible for 
              credits toward future acquisitions.
            </p>

            <h4 className="font-semibold mt-4 mb-2">5. Investor Responsibilities</h4>
            <p className="text-sm text-gray-600">
              You are responsible for conducting your own due diligence, securing necessary financing, 
              maintaining communication with your acquisition manager, and complying with all local 
              regulations regarding short-term rentals.
            </p>

            <h4 className="font-semibold mt-4 mb-2">6. Confidentiality</h4>
            <p className="text-sm text-gray-600">
              Property information shared with you is confidential and should not be shared with 
              third parties without written consent from Your Places.
            </p>

            <h4 className="font-semibold mt-4 mb-2">7. Dispute Resolution</h4>
            <p className="text-sm text-gray-600">
              Any disputes arising from this agreement will be resolved through mediation before 
              pursuing legal action. This agreement is governed by the laws of the State of Texas.
            </p>
          </div>
        </ScrollArea>
      </div>

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <Checkbox
          id="accept-terms"
          checked={accepted}
          onCheckedChange={(checked) => onAccept(checked as boolean)}
        />
        <label htmlFor="accept-terms" className="text-sm text-amber-800 cursor-pointer">
          I have read and agree to the Acquisition Service Agreement. I understand that the acquisition 
          fee is non-refundable once the process begins and that property availability is not guaranteed.
        </label>
      </div>
    </div>
  );
}

// Stripe Payment Form
function StripePaymentForm({ 
  onSuccess, 
  onCancel 
}: { 
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(submitError.message || 'Payment failed');
        setLoading(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg border">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button type="submit" disabled={!stripe || loading} className="flex-1 bg-[#1a365d]">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
          Pay Now
        </Button>
      </div>
    </form>
  );
}

// Zelle Payment Instructions
function ZellePayment({ 
  amount, 
  onUploadProof, 
  uploading 
}: { 
  amount: number; 
  onUploadProof: (file: File) => void;
  uploading: boolean;
}) {
  const { toast } = useToast();
  const [proofFile, setProofFile] = useState<File | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PaymentMethodPanel />
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Amount to send</p>
          <span className="text-xl font-bold text-purple-700">${amount.toFixed(2)}</span>
          <p className="text-sm text-purple-800 mt-2">
            <strong>Important:</strong> include your name and &quot;Acquisition Fee&quot; in the memo or note field.
          </p>
        </div>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 mb-2">Upload proof of Zelle payment</p>
        <p className="text-xs text-gray-500 mb-4">Screenshot or confirmation image (PNG, JPG)</p>
        
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="zelle-proof"
        />
        <label htmlFor="zelle-proof">
          <Button variant="outline" asChild>
            <span>Select File</span>
          </Button>
        </label>
        
        {proofFile && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {proofFile.name}
            </p>
            <Button 
              onClick={() => onUploadProof(proofFile)}
              disabled={uploading}
              className="mt-2 bg-green-600 hover:bg-green-700"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Submit Proof of Payment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Wire Transfer Instructions
function WireTransferPayment({ 
  amount, 
  onUploadProof, 
  uploading 
}: { 
  amount: number; 
  onUploadProof: (file: File) => void;
  uploading: boolean;
}) {
  const { toast } = useToast();
  const [proofFile, setProofFile] = useState<File | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PaymentMethodPanel />
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Amount to wire</p>
          <span className="text-xl font-bold text-blue-700">${amount.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-100 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Reference:</strong> Include your full name and "Acquisition Fee" in the wire reference field.
          </p>
        </div>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 mb-2">Upload wire transfer confirmation</p>
        <p className="text-xs text-gray-500 mb-4">Bank confirmation or receipt (PNG, JPG, PDF)</p>
        
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileChange}
          className="hidden"
          id="wire-proof"
        />
        <label htmlFor="wire-proof">
          <Button variant="outline" asChild>
            <span>Select File</span>
          </Button>
        </label>
        
        {proofFile && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {proofFile.name}
            </p>
            <Button 
              onClick={() => onUploadProof(proofFile)}
              disabled={uploading}
              className="mt-2 bg-green-600 hover:bg-green-700"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Submit Proof of Payment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// No AM Notification Component
function NoAMNotification({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center py-6">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Clock className="w-10 h-10 text-amber-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Deal Reserved!</h3>
      <p className="text-gray-600 mb-4">
        This deal has been taken off the market and reserved for you.
      </p>
      
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left mb-6">
        <h4 className="font-semibold text-amber-800 mb-2">What happens next?</h4>
        <ul className="space-y-2 text-sm text-amber-700">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Our Success Team has been notified of your interest</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>You'll be contacted within a couple of hours to finalize your purchase</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>You'll be matched with an acquisition manager to guide you through the process</span>
          </li>
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-700">
          <strong>Need immediate assistance?</strong><br />
          Email <a href="mailto:support@accessyourplace.com" className="underline">support@accessyourplace.com</a>,
          or message your acquisition manager from your portal and we&apos;ll pick it up there.
        </p>
      </div>

      <Button onClick={onClose} className="w-full bg-[#1a365d]">
        Got It
      </Button>
    </div>
  );
}

export function StartAcquisitionModal({
  open,
  onOpenChange,
  deal,
  investorId,
  investorName,
  investorEmail,
  hasAcquisitionManager,
  acquisitionManagerName,
  onSuccess
}: Props) {
  const [step, setStep] = useState<'terms' | 'payment' | 'no-am' | 'success'>('terms');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'zelle' | 'wire'>('stripe');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const acquisitionFee = deal.acquisition_fee || 499;

  useEffect(() => {
    if (open) {
      setStep('terms');
      setTermsAccepted(false);
      setClientSecret(null);
    }
  }, [open]);

  const handleProceedToPayment = async () => {
    if (!termsAccepted) {
      toast({ title: 'Please accept the terms', variant: 'destructive' });
      return;
    }

    // If no AM, show notification and reserve deal
    if (!hasAcquisitionManager) {
      setLoading(true);
      try {
        await supabase.functions.invoke('manage-acquisition-requests', {
          body: {
            action: 'reserve_deal_no_am',
            investor_id: investorId,
            investor_name: investorName,
            investor_email: investorEmail,
            property_id: deal.id,
            property_title: deal.listing_title || `${deal.bedrooms}BR in ${deal.city}`,
            property_city: deal.city,
            property_state: deal.state
          }
        });
        setStep('no-am');
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Has AM - proceed to payment
    setStep('payment');
    
    // Create payment intent for Stripe
    if (paymentMethod === 'stripe') {
      await createPaymentIntent();
    }
  };

  const createPaymentIntent = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'create_acquisition_payment',
          investor_id: investorId,
          property_id: deal.id,
          amount: acquisitionFee * 100, // cents
          notify_am: true,
          am_name: acquisitionManagerName
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to initialize payment');
      }

      setClientSecret(data.clientSecret);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadProof = async (file: File) => {
    setUploading(true);
    try {
      // Upload to storage
      const fileName = `${investorId}/${deal.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('investor-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Record the payment proof
      const { data, error } = await supabase.functions.invoke('process-acquisition-payment', {
        body: {
          action: 'submit_manual_payment_proof',
          investor_id: investorId,
          property_id: deal.id,
          payment_method: paymentMethod,
          proof_url: uploadData.path,
          amount: acquisitionFee,
          notify_am: true,
          am_name: acquisitionManagerName
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Failed to submit payment proof');
      }

      toast({
        title: 'Proof Submitted!',
        description: 'Your payment proof has been submitted. Our team will verify and approve it within 24 hours.'
      });
      setStep('success');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleStripeSuccess = () => {
    toast({ title: 'Payment Successful!', description: 'Your acquisition has been started.' });
    setStep('success');
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#d4a574]" />
            Start My Acquisition
          </DialogTitle>
          <DialogDescription>
            {deal.listing_title || `${deal.bedrooms}BR Property`} in {deal.city}, {deal.state}
          </DialogDescription>
        </DialogHeader>

        {/* Property Summary */}
        <div className="bg-gray-50 rounded-lg p-4 border mb-4">
          <div className="flex gap-4">
            {deal.photos?.[0] ? (
              <img src={deal.photos[0]} alt="" className="w-24 h-24 object-cover rounded-lg" />
            ) : (
              <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                <Building2 className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <h4 className="font-semibold">{deal.listing_title || `${deal.bedrooms}BR Property`}</h4>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {deal.city}, {deal.state} {deal.zip_code}
              </p>
              <div className="flex gap-4 mt-2 text-sm">
                <span>{deal.bedrooms} bed</span>
                <span>{deal.bathrooms} bath</span>
                {deal.monthly_rent && <span className="text-green-600 font-medium">${deal.monthly_rent.toLocaleString()}/mo</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Acquisition Fee</p>
              <p className="text-2xl font-bold text-[#1a365d]">${acquisitionFee.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {step === 'terms' && (
          <div className="space-y-4">
            <TermsOfService onAccept={setTermsAccepted} accepted={termsAccepted} />
            
            <Button 
              onClick={handleProceedToPayment}
              disabled={!termsAccepted || loading}
              className="w-full bg-[#d4a574] hover:bg-[#c49464]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {hasAcquisitionManager ? 'Continue to Payment' : 'Reserve This Deal'}
            </Button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stripe" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Card
                </TabsTrigger>
                <TabsTrigger value="zelle" className="flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Zelle
                </TabsTrigger>
                <TabsTrigger value="wire" className="flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  Wire
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stripe" className="mt-4">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-[#d4a574] mx-auto" />
                    <p className="text-gray-500 mt-2">Initializing payment...</p>
                  </div>
                ) : clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripePaymentForm 
                      onSuccess={handleStripeSuccess}
                      onCancel={() => setStep('terms')}
                    />
                  </Elements>
                ) : (
                  <Button onClick={createPaymentIntent} className="w-full">
                    Load Payment Form
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="zelle" className="mt-4">
                <ZellePayment 
                  amount={acquisitionFee} 
                  onUploadProof={handleUploadProof}
                  uploading={uploading}
                />
              </TabsContent>

              <TabsContent value="wire" className="mt-4">
                <WireTransferPayment 
                  amount={acquisitionFee} 
                  onUploadProof={handleUploadProof}
                  uploading={uploading}
                />
              </TabsContent>
            </Tabs>

            <Button variant="outline" onClick={() => setStep('terms')} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Terms
            </Button>
          </div>
        )}

        {step === 'no-am' && (
          <NoAMNotification onClose={() => onOpenChange(false)} />
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Acquisition Started!</h3>
            <p className="text-gray-600 mb-4">
              {paymentMethod === 'stripe' 
                ? 'Your payment has been processed successfully.'
                : 'Your payment proof has been submitted for verification.'}
            </p>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left mb-6">
              <h4 className="font-semibold text-green-800 mb-2">What happens next?</h4>
              <ul className="space-y-2 text-sm text-green-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5" />
                  <span>Full property address will be released to your dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5" />
                  <span>Your acquisition manager has been notified</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5" />
                  <span>You'll receive deal documentation via email</span>
                </li>
              </ul>
            </div>

            <Button onClick={() => { onOpenChange(false); onSuccess(); }} className="w-full bg-[#1a365d]">
              Go to Dashboard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
