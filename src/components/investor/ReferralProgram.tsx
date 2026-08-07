import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { notifyAMAboutAction, notifyInvestorAboutUpdate } from '@/utils/notifyAM';


import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { 
  Loader2, Copy, Gift, Users, DollarSign, Link2, 
  CheckCircle, Clock, Share2, CreditCard, Banknote,
  AlertCircle, Plus, Send, Mail, Building2, Home,
  FileText, ShieldCheck, AlertTriangle, MapPin, Phone,
  ScrollText, ArrowRight, Percent, XCircle
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
}

interface Referral {
  id: string;
  status: string;
  created_at: string;
  is_manual_entry?: boolean;
  referred?: { full_name?: string; email?: string; };
  referred_email?: string;
}

interface PropertyReferral {
  id: string;
  referral_type: string;
  property_address: string;
  property_city?: string;
  property_state?: string;
  landlord_name?: string;
  status: string;
  payout_amount?: number;
  payout_status?: string;
  rejection_reason?: string;
  am_notes?: string;
  assigned_am_name?: string;
  created_at: string;
}

interface Reward {
  id: string;
  amount: number;
  status: string;
  reward_type: string;
  created_at: string;
}

interface Payout {
  id: string;
  amount: number;
  payout_method: string;
  status: string;
  scheduled_for?: string;
  paid_at?: string;
  created_at: string;
}

const REFERRAL_TOS = `THIRD-PARTY SELLER & REFERRAL PARTNER TERMS OF SERVICE
Set Up Your Place LLC (DBA: Access Your Place / AYP)
A Subsidiary of Cooper Family Inc.
Effective Date: February 1, 2026

1. ACCEPTANCE OF TERMS
By submitting a referral, property lead, or listing an operation for sale on the Access Your Place (AYP) platform, you (the "Partner" or "Seller") agree to be bound by these Terms of Service. These terms apply to all individuals, regardless of whether they are current investors with AYP.

2. DEFINITIONS & CLASSIFICATIONS
• Referral Partner: An individual who introduces a new potential client OR a new property opportunity to AYP but does not own the lease or operation.
• Third-Party Seller: An existing operator who holds a valid lease and assets (furniture/inventory) and wishes to sell/transfer this active operation to another investor through the AYP Marketplace.
• Acquisition Fee: The fee paid by the final buyer to secure the deal.

3. THE REFERRAL PARTNER PROGRAM
For individuals submitting leads via the "Referral Tab" in the Investor Portal.

3.1 Client Referrals ($300 Flat Fee)
• Definition: Referring a new individual who has never transacted with AYP.
• Payout: $300.00 (USD).
• Condition: Payout occurs only when the referred client closes and funds their first deal.
• Payment Method: Partner may choose between Cash (Direct Deposit/Zelle) or AYP Credit (Applied to future services).

3.2 Property Referrals (20% Commission)
• Empty Property Referral: Partner identifies a vacant unit where the landlord is open to corporate leasing. AYP handles negotiations and due diligence.
• Furnished Property Referral: Partner identifies a furnished unit (landlord-owned furniture) but does not hold the lease. AYP handles negotiations.
• Payout: 20% of the final Acquisition Fee collected by AYP.
• "First Acquisition" Limitation: Commission is paid ONLY on the first acquisition at that specific property/unit location. The Partner does not receive residual commissions for repeat purchases, lease renewals, or subsequent units within the same community.

3.3 Referral Partner Obligations
• No Negotiation Required: The Partner is not obligated (nor authorized) to finalize lease terms.
• The "Hand-Off": The Partner's sole responsibility is to confirm the Landlord is interested in corporate leasing/arbitrage and to successfully connect that Landlord with an AYP Acquisition Manager.

4. THE THIRD-PARTY SELLER PROGRAM
For Operators selling an active Arbitrage Operation.

4.1 Definition of Third-Party Deal
A transaction where an Operator transfers an active lease, furniture, and booking history to a new buyer.

4.2 Seller Obligations (The "Verified Listing" Standard)
To list an operation on the AYP Marketplace, the Seller must provide:
• Proof of Lease: Confirmation of a secured lease agreement with the Master Landlord.
• Inventory List: A detailed breakdown of all furniture and assets included in the sale.
• Visual Verification: Confirmation of a property tour (video walkthrough or in-person) to verify condition.
• Financial Data: Profit & Loss (P&L) statements or verified booking history (Airbnb/VRBO data).

4.3 Commission & Pricing
• Pricing Authority: The Seller reserves the right to set their own Acquisition/Takeover Fee.
• AYP Commission: AYP retains 20% of the final Acquisition Fee as a marketing and facilitation fee.
• Seller Net: The Seller receives 80% of the final Acquisition Fee.

5. QUALITY CONTROL & RESTRICTIONS

5.1 Due Diligence Rights
AYP is not required to accept every deal submitted. We reserve the absolute right to perform independent due diligence on any referral or listing. If a deal does not meet our "Foundation of Truth" standards (market viability, safety, profit potential), it will be rejected.

5.2 The "Four Strikes" Rule
If a Partner consistently submits deals that are inaccurate, unverified, or do not meet the criteria (e.g., landlord was never contacted, numbers are falsified):
• Strike Count: After four (4) consecutively failed submissions, the Partner will be blocked/restricted from the Referral Program.
• Ban: Restricted Partners may lose access to the "Referral Tab" in their portal.

6. PAYMENT TERMS
• Timing: Referral Payouts are processed 14 days after the referred deal has officially funded and the lease is signed.
• Third-Party Seller Payouts: Seller funds are disbursed within 3 business days of the buyer's funds clearing AYP's escrow account and the lease assignment being executed.

7. LEGAL & COMPLIANCE

7.1 Independent Contractor Status
Partners and Sellers are independent contractors, not employees of Set Up Your Place LLC. You are responsible for reporting your own taxes on commissions earned.

7.2 Non-Circumvention
Partners agree not to circumvent AYP by attempting to sell a referred property directly to an AYP Client outside of the platform once the lead has been submitted.

7.3 Liability
AYP acts solely as a transactional marketplace and technology platform. AYP is not liable for the performance, profitability, or condition of any property listed or referred through the platform.`;

export function ReferralProgram({ investorId, investorName }: Props) {
  const [referralCode, setReferralCode] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [propertyReferrals, setPropertyReferrals] = useState<PropertyReferral[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [payoutMethod, setPayoutMethod] = useState('yp_credit');
  const [payoutDetails, setPayoutDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [sending, setSending] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [tosAgreed, setTosAgreed] = useState(false);
  const [tosAgreedAt, setTosAgreedAt] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  const [showTosModal, setShowTosModal] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);
  const [agreeingTos, setAgreeingTos] = useState(false);
  const [submitPropertyOpen, setSubmitPropertyOpen] = useState(false);
  const [submittingProperty, setSubmittingProperty] = useState(false);
  const [propertyForm, setPropertyForm] = useState({
    referral_type: 'empty_property' as 'empty_property' | 'furnished_property',
    property_address: '',
    property_city: '',
    property_state: '',
    property_zip: '',
    landlord_name: '',
    landlord_phone: '',
    landlord_email: '',
    projected_revenue: '',
    average_daily_rate: '',
    projected_monthly_room_rent: '',
    property_rent: '',
    deposit_amount: '',
    special_negotiations: ''
  });
  const { toast } = useToast();

  useEffect(() => { loadData(); }, [investorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load core referral data first - these are critical
      const [codeRes, refRes, rewRes, prefsRes] = await Promise.all([
        supabase.functions.invoke('manage-referrals', { body: { action: 'get_referral_code', investor_id: investorId } }).catch(e => ({ data: null, error: e })),
        supabase.functions.invoke('manage-referrals', { body: { action: 'get_referrals', investor_id: investorId } }).catch(e => ({ data: null, error: e })),
        supabase.functions.invoke('manage-referrals', { body: { action: 'get_rewards', investor_id: investorId } }).catch(e => ({ data: null, error: e })),
        supabase.functions.invoke('manage-referrals', { body: { action: 'get_payout_preferences', investor_id: investorId } }).catch(e => ({ data: null, error: e })),
      ]);
      
      setReferralCode(codeRes.data?.referral_code || '');
      setReferrals(refRes.data?.referrals || []);
      setRewards(rewRes.data?.rewards || []);
      setPayouts(rewRes.data?.payouts || []);
      setTotalCredits(rewRes.data?.total_credits || 0);
      setTotalEarned(rewRes.data?.total_earned || 0);
      setPayoutMethod(prefsRes.data?.payout_method || 'yp_credit');
      setPayoutDetails(prefsRes.data?.payout_details || {});

      // Load property referrals separately - this function may not exist yet
      try {
        const propRefRes = await supabase.functions.invoke('manage-property-referrals', { 
          body: { action: 'get_property_referrals', investor_id: investorId } 
        });
        setPropertyReferrals(propRefRes.data?.referrals || []);
        setTosAgreed(propRefRes.data?.tos_agreed || false);
        setTosAgreedAt(propRefRes.data?.tos_agreed_at || null);
        setBlocked(propRefRes.data?.blocked || false);
        setStrikeCount(propRefRes.data?.strike_count || 0);
      } catch (propErr) {
        console.warn('Property referrals function not available:', propErr);
        // Set defaults so the tab still works
        setPropertyReferrals([]);
        setTosAgreed(false);
        setTosAgreedAt(null);
        setBlocked(false);
        setStrikeCount(0);
      }
    } catch (err) {
      console.error('Error loading referral data:', err);
    }
    setLoading(false);
  };


  const referralLink = `${window.location.origin}/investor/login?ref=${referralCode}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied!', description: 'Referral link copied to clipboard' });
    } catch { toast({ title: 'Copy failed', description: 'Please copy the link manually', variant: 'destructive' }); }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Join Access Your Place', text: `${investorName} invited you to Access Your Place!`, url: referralLink }); } catch { copyLink(); }
    } else { copyLink(); }
  };

  const claimReward = async (type: 'credit' | 'cash') => {
    if (!selectedReward) return;
    setClaiming(selectedReward.id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-referrals', {
        body: { action: 'claim_reward', reward_id: selectedReward.id, reward_type: type, investor_id: investorId, payout_method: type === 'cash' ? payoutMethod : 'yp_credit', payout_details: type === 'cash' ? payoutDetails : {} }
      });
      if (data?.success) {
        toast({ title: 'Reward Claimed!', description: type === 'credit' ? 'Credit added to your account' : 'Cash payout scheduled' });
        setClaimDialogOpen(false);
        loadData();
      } else { throw new Error(data?.error || 'Failed to claim reward'); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setClaiming(null);
  };

  const savePayoutPreferences = async () => {
    setSavingPrefs(true);
    try {
      const { data } = await supabase.functions.invoke('manage-referrals', {
        body: { action: 'update_payout_preferences', investor_id: investorId, payout_method: payoutMethod, payout_details: payoutDetails }
      });
      if (data?.success) { toast({ title: 'Preferences Saved' }); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setSavingPrefs(false);
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    setSending(true);
    try {
      const { data } = await supabase.functions.invoke('manage-referrals', {
        body: { action: 'invite_referral', investor_id: investorId, email: inviteEmail }
      });
      if (data?.success) { toast({ title: 'Invitation Sent!', description: `Sent to ${inviteEmail}` }); notifyAMAboutAction(investorId, 'Investor Referral', `Referred a new investor via email — ${inviteEmail}`); setInviteOpen(false); setInviteEmail(''); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setSending(false);
  };



  const agreeToTos = async () => {
    if (!tosChecked) { toast({ title: 'Please agree to the terms', variant: 'destructive' }); return; }
    setAgreeingTos(true);
    try {
      const { data } = await supabase.functions.invoke('manage-property-referrals', {
        body: { action: 'agree_to_tos', investor_id: investorId, tos_type: 'both' }
      });
      if (data?.success) {
        setTosAgreed(true);
        setTosAgreedAt(new Date().toISOString());
        setShowTosModal(false);
        toast({ title: 'Terms Accepted', description: 'You can now submit property referrals and list operations for sale.' });
      }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setAgreeingTos(false);
  };

  const submitPropertyReferral = async () => {
    if (!propertyForm.property_address) {
      toast({ title: 'Property address is required', variant: 'destructive' }); return;
    }
    if (!propertyForm.projected_revenue && !propertyForm.average_daily_rate) {
      toast({ title: 'Please provide projected revenue or average daily rate', variant: 'destructive' }); return;
    }
    if (!propertyForm.property_rent) {
      toast({ title: 'Property rent is required', variant: 'destructive' }); return;
    }
    setSubmittingProperty(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-property-referrals', {
        body: {
          action: 'submit_property_referral',
          investor_id: investorId,
          ...propertyForm,
          projected_revenue: propertyForm.projected_revenue ? parseFloat(propertyForm.projected_revenue) : null,
          average_daily_rate: propertyForm.average_daily_rate ? parseFloat(propertyForm.average_daily_rate) : null,
          projected_monthly_room_rent: propertyForm.projected_monthly_room_rent ? parseFloat(propertyForm.projected_monthly_room_rent) : null,
          property_rent: propertyForm.property_rent ? parseFloat(propertyForm.property_rent) : null,
          deposit_amount: propertyForm.deposit_amount ? parseFloat(propertyForm.deposit_amount) : null,
        }
      });
      if (data?.success) {
        toast({ title: 'Property Referral Submitted!', description: 'Our Success Team will review your submission and an Acquisition Manager will reach out to the landlord.' });
        notifyAMAboutAction(investorId, 'Property Referral', `Submitted a ${propertyForm.referral_type === 'furnished_property' ? 'furnished' : 'empty'} property referral — ${propertyForm.property_address}, ${propertyForm.property_city}, ${propertyForm.property_state}`);
        setSubmitPropertyOpen(false);
        setPropertyForm({ referral_type: 'empty_property', property_address: '', property_city: '', property_state: '', property_zip: '', landlord_name: '', landlord_phone: '', landlord_email: '', projected_revenue: '', average_daily_rate: '', projected_monthly_room_rent: '', property_rent: '', deposit_amount: '', special_negotiations: '' });
        loadData();
      } else {
        throw new Error(data?.error || error?.message || 'Failed to submit');
      }

    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setSubmittingProperty(false);
  };

  const stats = {
    total: referrals.length,
    pending: referrals.filter(r => r.status === 'pending' || r.status === 'signed_up').length,
    qualified: referrals.filter(r => r.status === 'qualified').length,
    rewarded: referrals.filter(r => r.status === 'rewarded').length,
    propertyTotal: propertyReferrals.length,
    propertyPending: propertyReferrals.filter(r => ['pending_review', 'under_review', 'am_outreach'].includes(r.status)).length,
    propertyApproved: propertyReferrals.filter(r => ['finalized', 'published', 'approved_payout', 'paid_out'].includes(r.status)).length,
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" /></div>
    );
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending_review: { label: 'Pending Review', className: 'bg-yellow-500' },
      under_review: { label: 'Under Review', className: 'bg-blue-500' },
      am_outreach: { label: 'AM Outreach', className: 'bg-indigo-500' },
      finalized: { label: 'Finalized', className: 'bg-emerald-500' },
      published: { label: 'Published on AYP', className: 'bg-green-600' },
      approved_payout: { label: 'Payout Approved', className: 'bg-[#d4a574]' },
      paid_out: { label: 'Paid Out', className: 'bg-green-700' },
      rejected: { label: 'Rejected', className: 'bg-red-500' },
    };
    const s = map[status] || { label: status, className: 'bg-gray-500' };
    return <Badge className={s.className}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Blocked Warning */}
      {blocked && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800">Referral Partner Access Restricted</p>
                <p className="text-sm text-red-600 mt-1">Your referral partner access has been restricted due to {strikeCount} failed submissions (Four Strikes Rule). Please contact support at success@accessyourplace.com.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strike Warning */}
      {!blocked && strikeCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Strike Warning: {strikeCount}/4</p>
                <p className="text-sm text-amber-600">You have {strikeCount} rejected submission(s). After 4 strikes, your referral partner access will be restricted.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commission Structure */}
      <Card className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white border-0">
        <CardContent className="pt-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Gift className="w-5 h-5 text-[#d4a574]" /> Referral Commission Structure</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#d4a574] rounded-lg flex items-center justify-center"><Home className="w-4 h-4 text-white" /></div>
                <h4 className="font-semibold">Property Referrals</h4>
              </div>
              <p className="text-3xl font-bold text-[#d4a574]">20%</p>
              <p className="text-sm text-white/70 mt-1">Of the Acquisition Fee for empty or furnished property referrals. Paid on first acquisition only.</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#d4a574] rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>
                <h4 className="font-semibold">Client Referrals</h4>
              </div>
              <p className="text-3xl font-bold text-[#d4a574]">$300</p>
              <p className="text-sm text-white/70 mt-1">Flat fee per new client who closes their first deal. Choose cash or YP credit.</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#d4a574] rounded-lg flex items-center justify-center"><Building2 className="w-4 h-4 text-white" /></div>
                <h4 className="font-semibold">Sell Your Operation</h4>
              </div>
              <p className="text-3xl font-bold text-[#d4a574]">80%</p>
              <p className="text-sm text-white/70 mt-1">You set the fee. AYP takes 20% for marketing & facilitation. You keep 80%.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-muted-foreground">Client Referrals</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 bg-purple-100 rounded-lg"><Building2 className="w-5 h-5 text-purple-600" /></div><div><p className="text-2xl font-bold">{stats.propertyTotal}</p><p className="text-sm text-muted-foreground">Property Referrals</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div><div><p className="text-2xl font-bold">{stats.propertyApproved}</p><p className="text-sm text-muted-foreground">Approved</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-100 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">${totalEarned}</p><p className="text-sm text-muted-foreground">Total Earned</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 bg-[#d4a574]/20 rounded-lg"><CreditCard className="w-5 h-5 text-[#d4a574]" /></div><div><p className="text-2xl font-bold">${totalCredits}</p><p className="text-sm text-muted-foreground">Available Credit</p></div></div></CardContent></Card>
      </div>

      {/* Referral Link Card */}
      <Card className="bg-gradient-to-r from-[#d4a574]/10 to-[#d4a574]/5 border-[#d4a574]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="w-5 h-5" />Your Referral Link</CardTitle>
          <CardDescription>Share this link to refer new investors and earn <strong>$300</strong> for each client who closes their first deal.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={referralLink} readOnly className="font-mono text-sm flex-1" />
            <div className="flex gap-2">
              <Button onClick={copyLink} variant="outline">{copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</Button>
              <Button onClick={shareLink} className="bg-[#d4a574] hover:bg-[#c49464]"><Share2 className="w-4 h-4 mr-2" />Share</Button>
              <Button onClick={() => setInviteOpen(true)} variant="outline"><Mail className="w-4 h-4 mr-2" />Invite</Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">Your code: <span className="font-mono font-bold">{referralCode}</span></p>
        </CardContent>
      </Card>

      {/* TOS Agreement Gate */}
      {!tosAgreed && !blocked && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex gap-3">
                <ScrollText className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-amber-800">Terms of Service Required</p>
                  <p className="text-sm text-amber-600 mt-1">To submit property referrals or list operations for sale, you must agree to the Third-Party Seller & Referral Partner Terms of Service.</p>
                </div>
              </div>
              <Button onClick={() => setShowTosModal(true)} className="bg-[#d4a574] hover:bg-[#c49464] whitespace-nowrap">
                <FileText className="w-4 h-4 mr-2" />Review & Agree
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="property-referrals" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="property-referrals"><Building2 className="w-4 h-4 mr-2" />Property Referrals ({propertyReferrals.length})</TabsTrigger>
          <TabsTrigger value="client-referrals"><Users className="w-4 h-4 mr-2" />Client Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="rewards"><Gift className="w-4 h-4 mr-2" />Rewards</TabsTrigger>
          <TabsTrigger value="payouts"><Banknote className="w-4 h-4 mr-2" />Payouts</TabsTrigger>
          <TabsTrigger value="settings"><CreditCard className="w-4 h-4 mr-2" />Payout Settings</TabsTrigger>
          <TabsTrigger value="terms"><ScrollText className="w-4 h-4 mr-2" />Terms</TabsTrigger>
        </TabsList>

        {/* Property Referrals Tab */}
        <TabsContent value="property-referrals">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Property Referrals</CardTitle>
                  <CardDescription>Submit empty or furnished property leads. Earn 20% of the Acquisition Fee on approved deals.</CardDescription>
                </div>
                <Button 
                  onClick={() => { if (!tosAgreed) { setShowTosModal(true); } else { setSubmitPropertyOpen(true); } }}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                  disabled={blocked}
                >
                  <Plus className="w-4 h-4 mr-2" />Refer a Property
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {propertyReferrals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium">No property referrals yet</p>
                  <p className="text-sm mt-1">Know a property that would be great for arbitrage? Submit it and earn 20% commission!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {propertyReferrals.map(r => (
                    <div key={r.id} className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{r.property_address}</p>
                            <Badge variant="outline" className="text-xs">{r.referral_type === 'furnished_property' ? 'Furnished' : 'Empty'}</Badge>
                          </div>
                          {(r.property_city || r.property_state) && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{r.property_city}{r.property_state ? `, ${r.property_state}` : ''}</p>
                          )}
                          {r.landlord_name && <p className="text-sm text-muted-foreground mt-1">Landlord: {r.landlord_name}</p>}
                          {r.assigned_am_name && <p className="text-sm text-blue-600 mt-1">AM: {r.assigned_am_name}</p>}
                          {r.am_notes && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                              <p className="text-xs font-medium text-blue-700">AM Notes:</p>
                              <p className="text-xs text-blue-600">{r.am_notes}</p>
                            </div>
                          )}
                          {r.rejection_reason && (
                            <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                              <p className="text-xs font-medium text-red-700">Rejection Reason:</p>
                              <p className="text-xs text-red-600">{r.rejection_reason}</p>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(r.status)}
                          {r.payout_amount && r.payout_status === 'paid' && (
                            <span className="text-sm font-semibold text-green-600">${r.payout_amount.toLocaleString()} paid</span>
                          )}
                          {r.payout_amount && r.payout_status === 'eligible' && (
                            <span className="text-sm font-semibold text-[#d4a574]">${r.payout_amount.toLocaleString()} pending</span>
                          )}
                        </div>
                      </div>
                      {/* Status Timeline */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <PropertyReferralTimeline status={r.status} createdAt={r.created_at} />
                      </div>
                    </div>
                  ))}

                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Client Referrals Tab */}
        <TabsContent value="client-referrals">
          <Card>
            <CardHeader><CardTitle>Client Referrals</CardTitle><CardDescription>Refer new investors to earn $300 per closed deal.</CardDescription></CardHeader>
            <CardContent>
              {referrals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="font-medium">No client referrals yet</p>
                  <p className="text-sm">Share your referral link to get started!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {referrals.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{r.referred?.full_name || r.referred_email || 'Pending signup'}</p>
                        <p className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}{r.is_manual_entry && ' - Manual entry'}</p>
                      </div>
                      <ReferralStatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards">
          <Card>
            <CardContent className="pt-6">
              {rewards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><Gift className="w-12 h-12 mx-auto text-gray-300 mb-4" /><p className="font-medium">No rewards yet</p></div>
              ) : (
                <div className="space-y-3">
                  {rewards.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div><p className="font-medium">${r.amount} Referral Reward</p><p className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p></div>
                      {(r.status === 'pending' || r.reward_type === 'pending_choice') ? (
                        <Button onClick={() => { setSelectedReward(r); setClaimDialogOpen(true); }} className="bg-[#d4a574] hover:bg-[#c49464]">Claim</Button>
                      ) : (
                        <Badge className={r.status === 'paid' ? 'bg-green-500' : 'bg-blue-500'}>{r.status === 'paid' ? (r.reward_type === 'credit' ? 'Credit Applied' : 'Cash Paid') : r.status}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader><CardTitle>Payout History</CardTitle><CardDescription>Referral payouts are processed 14 days after the deal has funded and the lease is signed.</CardDescription></CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><Banknote className="w-12 h-12 mx-auto text-gray-300 mb-4" /><p className="font-medium">No payouts yet</p></div>
              ) : (
                <div className="space-y-3">
                  {payouts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div><p className="font-medium">${p.amount}</p><p className="text-sm text-muted-foreground">{getPayoutMethodLabel(p.payout_method)}{p.scheduled_for && ` - Scheduled: ${new Date(p.scheduled_for).toLocaleDateString()}`}</p></div>
                      <Badge className={p.status === 'paid' ? 'bg-green-500' : p.status === 'scheduled' ? 'bg-yellow-500' : 'bg-gray-500'}>{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payout Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle>Payout Preferences</CardTitle><CardDescription>Choose how you'd like to receive your referral rewards</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={payoutMethod} onValueChange={setPayoutMethod}>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { value: 'yp_credit', icon: CreditCard, label: 'YP Credit', desc: 'Apply to acquisitions' },
                    { value: 'zelle', icon: Banknote, label: 'Zelle', desc: 'Direct bank transfer' },
                    { value: 'cashapp', icon: DollarSign, label: 'Cash App', desc: '$cashtag payment' },
                    { value: 'venmo', icon: DollarSign, label: 'Venmo', desc: '@username payment' },
                    { value: 'apple_pay', icon: DollarSign, label: 'Apple Pay', desc: 'Phone number payment' },
                  ].map(opt => (
                    <Label key={opt.value} className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer ${payoutMethod === opt.value ? 'border-[#d4a574] bg-[#d4a574]/5' : ''}`}>
                      <RadioGroupItem value={opt.value} />
                      <opt.icon className="w-5 h-5" />
                      <div><p className="font-medium">{opt.label}</p><p className="text-sm text-muted-foreground">{opt.desc}</p></div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
              {payoutMethod !== 'yp_credit' && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Payment Details</h4>
                  {payoutMethod === 'zelle' && <div><Label htmlFor="zelle-email-or-phone">Zelle Email or Phone</Label><Input id="zelle-email-or-phone" value={payoutDetails.email || ''} onChange={(e) => setPayoutDetails({ ...payoutDetails, email: e.target.value })} placeholder="email@example.com" /></div>}
                  {payoutMethod === 'cashapp' && <div><Label htmlFor="cash-app-cashtag">Cash App $Cashtag</Label><Input id="cash-app-cashtag" value={payoutDetails.username || ''} onChange={(e) => setPayoutDetails({ ...payoutDetails, username: e.target.value })} placeholder="$yourcashtag" /></div>}
                  {payoutMethod === 'venmo' && <div><Label htmlFor="venmo-username">Venmo Username</Label><Input id="venmo-username" value={payoutDetails.username || ''} onChange={(e) => setPayoutDetails({ ...payoutDetails, username: e.target.value })} placeholder="@yourusername" /></div>}
                  {payoutMethod === 'apple_pay' && <div><Label htmlFor="apple-pay-phone">Apple Pay Phone</Label><Input id="apple-pay-phone" value={payoutDetails.phone || ''} onChange={(e) => setPayoutDetails({ ...payoutDetails, phone: e.target.value })} placeholder="(555) 123-4567" /></div>}
                </div>
              )}
              <Button onClick={savePayoutPreferences} disabled={savingPrefs} className="bg-[#d4a574] hover:bg-[#c49464]">
                {savingPrefs && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Terms Tab */}
        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ScrollText className="w-5 h-5" />Third-Party Seller & Referral Partner Terms</CardTitle>
              {tosAgreed && tosAgreedAt && (
                <CardDescription className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />Agreed on {new Date(tosAgreedAt).toLocaleDateString()}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-6 max-h-[500px] overflow-y-auto border">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{REFERRAL_TOS}</pre>
              </div>
              {!tosAgreed && (
                <div className="mt-4">
                  <Button onClick={() => setShowTosModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
                    <FileText className="w-4 h-4 mr-2" />Agree to Terms
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* TOS Agreement Modal */}
      <Dialog open={showTosModal} onOpenChange={setShowTosModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Third-Party Seller & Referral Partner Terms of Service</DialogTitle>
            <DialogDescription>Please read and agree to the following terms to use referral partner and third-party seller features.</DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto border text-sm">
            <pre className="whitespace-pre-wrap font-sans leading-relaxed text-gray-700">{REFERRAL_TOS}</pre>
          </div>
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <Checkbox id="tos-agree" checked={tosChecked} onCheckedChange={(c) => setTosChecked(c === true)} />
            <Label htmlFor="tos-agree" className="text-sm cursor-pointer leading-relaxed">
              I have read and agree to the Third-Party Seller & Referral Partner Terms of Service. I understand the commission structure, the Four Strikes Rule, and that AYP reserves the right to reject any submission that does not meet quality standards.
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTosModal(false)}>Cancel</Button>
            <Button onClick={agreeToTos} disabled={!tosChecked || agreeingTos} className="bg-[#d4a574] hover:bg-[#c49464]">
              {agreeingTos && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}I Agree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Property Referral Modal */}
      <Dialog open={submitPropertyOpen} onOpenChange={setSubmitPropertyOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />Submit Property Referral</DialogTitle>
            <DialogDescription>Submit a property lead. An Acquisition Manager will handle landlord outreach and negotiations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Referral Type *</Label>
              <Select value={propertyForm.referral_type} onValueChange={(v) => setPropertyForm({ ...propertyForm, referral_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empty_property">Empty Property (Vacant unit, landlord open to corporate leasing)</SelectItem>
                  <SelectItem value="furnished_property">Furnished Property (Landlord-owned furniture, no lease held)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="property-address">Property Address *</Label>
              <Input id="property-address" value={propertyForm.property_address} onChange={(e) => setPropertyForm({ ...propertyForm, property_address: e.target.value })} placeholder="123 Main St, Apt 4B" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label htmlFor="city">City</Label><Input id="city" value={propertyForm.property_city} onChange={(e) => setPropertyForm({ ...propertyForm, property_city: e.target.value })} placeholder="Miami" /></div>
              <div><Label htmlFor="state">State</Label><Input id="state" value={propertyForm.property_state} onChange={(e) => setPropertyForm({ ...propertyForm, property_state: e.target.value })} placeholder="FL" /></div>
              <div><Label htmlFor="zip">ZIP</Label><Input id="zip" value={propertyForm.property_zip} onChange={(e) => setPropertyForm({ ...propertyForm, property_zip: e.target.value })} placeholder="33126" /></div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2"><Phone className="w-4 h-4" />Landlord Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><Label htmlFor="landlord-name">Landlord Name</Label><Input id="landlord-name" value={propertyForm.landlord_name} onChange={(e) => setPropertyForm({ ...propertyForm, landlord_name: e.target.value })} placeholder="John Smith" /></div>
                <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={propertyForm.landlord_phone} onChange={(e) => setPropertyForm({ ...propertyForm, landlord_phone: e.target.value })} placeholder="(555) 123-4567" /></div>
                <div><Label htmlFor="email">Email</Label><Input id="email" value={propertyForm.landlord_email} onChange={(e) => setPropertyForm({ ...propertyForm, landlord_email: e.target.value })} placeholder="landlord@email.com" /></div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" />Financial Projections *</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="projected-monthly-revenue">Projected Monthly Revenue</Label><Input id="projected-monthly-revenue" type="number" value={propertyForm.projected_revenue} onChange={(e) => setPropertyForm({ ...propertyForm, projected_revenue: e.target.value })} placeholder="4500" /></div>
                <div><Label htmlFor="average-daily-rate-adr">Average Daily Rate (ADR)</Label><Input id="average-daily-rate-adr" type="number" value={propertyForm.average_daily_rate} onChange={(e) => setPropertyForm({ ...propertyForm, average_daily_rate: e.target.value })} placeholder="150" /></div>
                <div><Label htmlFor="monthly-room-rent-if-applicable">Monthly Room Rent (if applicable)</Label><Input id="monthly-room-rent-if-applicable" type="number" value={propertyForm.projected_monthly_room_rent} onChange={(e) => setPropertyForm({ ...propertyForm, projected_monthly_room_rent: e.target.value })} placeholder="800" /></div>
                <div><Label htmlFor="property-rent">Property Rent *</Label><Input id="property-rent" type="number" value={propertyForm.property_rent} onChange={(e) => setPropertyForm({ ...propertyForm, property_rent: e.target.value })} placeholder="2000" /></div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div><Label htmlFor="deposit-amount">Deposit Amount</Label><Input id="deposit-amount" type="number" value={propertyForm.deposit_amount} onChange={(e) => setPropertyForm({ ...propertyForm, deposit_amount: e.target.value })} placeholder="2000" /></div>
              <div><Label htmlFor="depositspecialsnegotiations">Deposit/Specials/Negotiations</Label><Textarea id="depositspecialsnegotiations" value={propertyForm.special_negotiations} onChange={(e) => setPropertyForm({ ...propertyForm, special_negotiations: e.target.value })} placeholder="e.g., First month free, reduced deposit, landlord agreed to 12-month lease..." rows={3} /></div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Important</p>
              <ul className="mt-1 space-y-1 list-disc list-inside text-xs">
                <li>Your sole responsibility is to confirm the landlord is interested and connect them with AYP.</li>
                <li>Commission is paid only on the first acquisition at this location.</li>
                <li>Payouts are processed 14 days after the deal has funded and lease is signed.</li>
                <li>Inaccurate or unverified submissions count toward the Four Strikes Rule.</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitPropertyOpen(false)}>Cancel</Button>
            <Button onClick={submitPropertyReferral} disabled={submittingProperty} className="bg-[#d4a574] hover:bg-[#c49464]">
              {submittingProperty && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />Submit Referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Claim Reward Dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Claim Your Reward</DialogTitle><DialogDescription>Choose how you'd like to receive your referral bonus</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2" onClick={() => claimReward('credit')} disabled={!!claiming}>
              {claiming ? <Loader2 className="w-8 h-8 animate-spin" /> : <CreditCard className="w-8 h-8 text-[#d4a574]" />}
              <span className="font-semibold">YP Credit</span><span className="text-xs text-muted-foreground">Instant</span>
            </Button>
            <Button variant="outline" className="h-auto py-6 flex flex-col items-center gap-2" onClick={() => claimReward('cash')} disabled={!!claiming}>
              {claiming ? <Loader2 className="w-8 h-8 animate-spin" /> : <Banknote className="w-8 h-8 text-green-600" />}
              <span className="font-semibold">Cash</span><span className="text-xs text-muted-foreground">{getPayoutMethodLabel(payoutMethod)}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Someone</DialogTitle><DialogDescription>Send an email invitation with your referral link</DialogDescription></DialogHeader>
          <div><Label htmlFor="email-address">Email Address</Label><Input id="email-address" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="friend@example.com" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={sendInvite} disabled={sending} className="bg-[#d4a574] hover:bg-[#c49464]">
              {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}<Send className="w-4 h-4 mr-2" />Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getPayoutMethodLabel(method: string) {
  const labels: Record<string, string> = { zelle: 'Zelle', cashapp: 'Cash App', venmo: 'Venmo', apple_pay: 'Apple Pay', yp_credit: 'YP Credit' };
  return labels[method] || method;
}

function ReferralStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { variant: 'default' | 'secondary' | 'outline'; className?: string }> = {
    pending: { variant: 'secondary' }, signed_up: { variant: 'outline' }, qualified: { variant: 'default', className: 'bg-purple-500' }, rewarded: { variant: 'default', className: 'bg-green-500' }
  };
  const labels: Record<string, string> = { pending: 'Pending', signed_up: 'Signed Up', qualified: 'Ready to Claim', rewarded: 'Rewarded' };
  const s = styles[status] || styles.pending;
  return <Badge variant={s.variant} className={s.className}>{labels[status] || status}</Badge>;
}

// Status timeline for property referrals - visible to investor
function PropertyReferralTimeline({ status, createdAt }: { status: string; createdAt: string }) {
  const STAGES = [
    { key: 'pending_review', label: 'Submitted', color: 'bg-yellow-500' },
    { key: 'under_review', label: 'Under Review', color: 'bg-blue-500' },
    { key: 'am_outreach', label: 'AM Outreach', color: 'bg-indigo-500' },
    { key: 'finalized', label: 'Finalized', color: 'bg-emerald-500' },
    { key: 'published', label: 'Published', color: 'bg-green-600' },
    { key: 'approved_payout', label: 'Payout Approved', color: 'bg-[#d4a574]' },
    { key: 'paid_out', label: 'Paid Out', color: 'bg-green-700' },
  ];

  // If rejected, show a different flow
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <div className="flex flex-col items-center shrink-0">
          <div className="w-5 h-5 rounded-full bg-yellow-500 text-white flex items-center justify-center">
            <CheckCircle className="w-3 h-3" />
          </div>
          <span className="text-[9px] mt-0.5 font-medium text-gray-600">Submitted</span>
          <span className="text-[8px] text-gray-400">{new Date(createdAt).toLocaleDateString()}</span>
        </div>
        <div className="w-6 h-0.5 bg-gray-300 mt-[-14px]" />
        <div className="flex flex-col items-center shrink-0">
          <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center ring-2 ring-offset-1 ring-red-300">
            <XCircle className="w-3 h-3" />
          </div>
          <span className="text-[9px] mt-0.5 font-medium text-red-600">Rejected</span>
        </div>
      </div>
    );
  }

  const stageOrder = STAGES.map(s => s.key);
  const currentIdx = stageOrder.indexOf(status);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={stage.key} className="flex items-center gap-1 shrink-0">
            <div className="flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${
                isCompleted || isCurrent ? stage.color : 'bg-gray-200'
              } ${isCurrent ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                {isCompleted ? (
                  <CheckCircle className="w-3 h-3" />
                ) : isCurrent ? (
                  <Clock className="w-3 h-3" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                )}
              </div>
              <span className={`text-[9px] mt-0.5 whitespace-nowrap ${
                isCurrent ? 'font-semibold text-gray-800' : isCompleted ? 'font-medium text-gray-600' : 'text-gray-400'
              }`}>
                {stage.label}
              </span>
              {idx === 0 && (
                <span className="text-[8px] text-gray-400">{new Date(createdAt).toLocaleDateString()}</span>
              )}
            </div>
            {idx < STAGES.length - 1 && (
              <div className={`w-4 h-0.5 mt-[-14px] ${isCompleted ? 'bg-gray-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
