import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { Loader2, CheckCircle, MapPin, Bed, Bath, DollarSign, Lock, Info } from 'lucide-react';

interface InquiryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: any;
  onSubmitted?: () => void;
}


// An inquiry requires an account. Identity is read from the session on the server.
function getInvestorSessionToken(): string | null {
  try {
    const direct = window.localStorage.getItem('investorSessionToken');
    if (direct) return direct;
    const raw = window.localStorage.getItem('investorSession');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.session_token || parsed?.token || null;
  } catch {
    return null;
  }
}

export function InquiryModal({ open, onOpenChange, deal, onSubmitted }: InquiryModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [investmentType, setInvestmentType] = useState('str');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sessionToken = getInvestorSessionToken();
    if (!sessionToken) {
      toast({
        title: 'Account required',
        description: 'Please create a free account or sign in to enquire about this deal.',
        variant: 'destructive',
      });
      window.location.href = `/investor-portal?redirect=/deals/${deal.id}`;
      return;
    }
    setSubmitting(true);

    const { data: result, error } = await supabase.functions.invoke('submit-deal-inquiry', {
      body: { property_id: deal.id, session_token: sessionToken, message, investment_type: investmentType }
    });

    setSubmitting(false);
    if (result?.error === 'account_required') {
      toast({ title: 'Account required', description: result.message, variant: 'destructive' });
      window.location.href = `/investor-portal?redirect=/deals/${deal.id}`;
      return;
    }
    if (error) {
      toast({ title: 'Error', description: 'Failed to submit inquiry', variant: 'destructive' });
    } else {
      setSubmitted(true);

      // Track funnel conversion event
      trackEvent('deal_inquiry_submitted', {
        property_id: deal?.id,
        investment_type: investmentType,
        city: deal?.city,
        state: deal?.state,
      });

      // Call the onSubmitted callback to log the activity
      if (onSubmitted) {
        onSubmitted();
      }

      setTimeout(() => {
        onOpenChange(false);
        setSubmitted(false);
        setName('');
        setEmail('');
        setPhone('');
        setMessage('');
      }, 2000);
    }
  };

  if (!deal) return null;

  // Generate display title without address
  const displayTitle = deal.listing_title || `${deal.bedrooms}BR Property in ${deal.city}`;
  const locationDisplay = `${deal.city}, ${deal.state} ${deal.zip_code || ''}`.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby="inquiry-description">
        <DialogHeader>
          <DialogTitle>
            {submitted ? 'Inquiry Submitted!' : 'Request Property Details'}
          </DialogTitle>
          <DialogDescription id="inquiry-description">
            {submitted 
              ? 'Thank you for your interest' 
              : 'Submit your information to receive full property details'}
          </DialogDescription>
        </DialogHeader>
        
        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank You!</h3>
            <p className="text-gray-600">Our team will contact you within 24 hours with full property details.</p>
          </div>
        ) : (
          <>
            {/* Property Summary - No address shown */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-gray-900 mb-2 line-clamp-1">{displayTitle}</h4>
              <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {locationDisplay}
              </div>
              <div className="flex gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Bed className="w-4 h-4" aria-hidden="true" /> {deal.bedrooms} bed
                </span>
                <span className="flex items-center gap-1">
                  <Bath className="w-4 h-4" aria-hidden="true" /> {deal.bathrooms} bath
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" aria-hidden="true" /> ${deal.acquisition_fee?.toLocaleString()} fee
                </span>
              </div>
              
              {/* Address Notice */}
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <Lock className="w-3 h-3" aria-hidden="true" />
                <span>Full address provided after inquiry approval</span>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4" aria-label="Property inquiry form">
              <div>
                <Label htmlFor="inquiry-name">Full Name *</Label>
                <Input 
                  id="inquiry-name"
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  aria-required="true"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <Label htmlFor="inquiry-email">Email *</Label>
                <Input 
                  id="inquiry-email"
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  aria-required="true"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="inquiry-phone">Phone</Label>
                <Input 
                  id="inquiry-phone"
                  type="tel"
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="inquiry-investment-type">Investment Interest</Label>
                <Select value={investmentType} onValueChange={setInvestmentType}>
                  <SelectTrigger id="inquiry-investment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="str">Short-Term Rental</SelectItem>
                    <SelectItem value="coliving">Co-Living</SelectItem>
                    <SelectItem value="mtr">Mid-Term Rental</SelectItem>
                    <SelectItem value="both">Multiple Strategies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="inquiry-message">Message (Optional)</Label>
                <Textarea 
                  id="inquiry-message"
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  placeholder="Tell us about your investment goals and any questions you have..."
                  rows={3} 
                />
              </div>
              
              {/* Info Notice */}
              <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-3">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  After submitting, our acquisition team will review your inquiry and provide you with 
                  the full property address, detailed analytics, and next steps for acquisition.
                </span>
              </div>
              
              <Button 
                type="submit" 
                disabled={submitting || !name || !email} 
                className="w-full bg-[#d4a574] hover:bg-[#c49464]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Submitting...
                  </>
                ) : (
                  'Submit Inquiry'
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
