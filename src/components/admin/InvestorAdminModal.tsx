import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { AccountLinkingModal } from './AccountLinkingModal';
import { InvestorCreditsManager } from './InvestorCreditsManager';
import { StaffPortfolioManager } from './StaffPortfolioManager';
import { 
  Loader2, Send, Upload, User, MessageSquare, FileText, ClipboardList, Building2,
  Calendar, DollarSign, MapPin, Phone, CheckCircle, Clock, AlertCircle, RefreshCw,
  UserCheck, PhoneCall, Shield, Search, Link2, ArrowRightLeft, CreditCard, Home,
  Plus, FileSignature, Wallet, Package, Coins
} from 'lucide-react';



interface Props { investor: any; onClose: () => void; }

// Preloaded agreement templates
const AGREEMENT_TEMPLATES: Record<string, string> = {
  'Acquisition Agreement': "ACQUISITION AGREEMENT\n\nThis Acquisition Agreement (\"Agreement\") is entered into as of {{date}} by and between:\n\nCOMPANY: At Your Pace LLC (\"AYP\" or \"Company\")\nAddress: [Company Address]\n\nINVESTOR: {{investor_name}} (\"Investor\")\nEmail: {{investor_email}}\nPhone: {{investor_phone}}\n\n1. PURPOSE\nThis Agreement outlines the terms under which AYP will facilitate the acquisition of a short-term rental property on behalf of the Investor.\n\n2. SCOPE OF SERVICES\nAYP agrees to:\na) Identify and source suitable rental arbitrage opportunities\nb) Conduct due diligence on potential properties\nc) Negotiate lease terms with property owners/landlords\nd) Coordinate the setup and furnishing of the property\ne) Provide ongoing operational support and guidance\n\n3. ACQUISITION FEE\nThe Investor agrees to pay an acquisition fee of ${{acquisition_fee}} upon execution of this Agreement. This fee covers property sourcing, due diligence, lease negotiation, and initial setup coordination.\n\n4. PROPERTY DETAILS\nProperty Address: {{property_address}}\nCity/State: {{property_city}}, {{property_state}}\nMonthly Rent: ${{monthly_rent}}\nProjected Monthly Revenue: ${{projected_revenue}}\n\n5. INVESTOR RESPONSIBILITIES\nThe Investor agrees to:\na) Provide timely funding as outlined in this Agreement\nb) Maintain all required insurance coverage\nc) Comply with local regulations and HOA rules\nd) Communicate promptly with the assigned Acquisition Manager\n\n6. TIMELINE\nEstimated acquisition timeline: {{timeline}} days from execution of this Agreement.\n\n7. TERMINATION\nEither party may terminate this Agreement with 30 days written notice. Acquisition fees are non-refundable once property sourcing has commenced.\n\n8. SIGNATURES\n\nInvestor Signature: _________________________\nName: {{investor_name}}\nDate: {{date}}\n\nCompany Representative: _________________________\nName: {{company_rep}}\nDate: {{date}}",

  'Third-Party Seller Agreement': "THIRD-PARTY SELLER AGREEMENT\n\nThis Third-Party Seller Agreement (\"Agreement\") is entered into as of {{date}} by and between:\n\nSELLER: {{seller_name}} (\"Seller\")\nEmail: {{seller_email}}\n\nBUYER/INVESTOR: {{investor_name}} (\"Buyer\")\nEmail: {{investor_email}}\n\nFACILITATOR: At Your Pace LLC (\"AYP\")\n\n1. PURPOSE\nThis Agreement governs the sale and transfer of an existing short-term rental operation from the Seller to the Buyer, facilitated by AYP through its Deal Marketplace.\n\n2. PROPERTY & OPERATION DETAILS\nProperty Address: {{property_address}}\nCity/State: {{property_city}}, {{property_state}}\nCurrent Monthly Revenue: ${{monthly_revenue}}\nAsking Price: ${{asking_price}}\nLease Remaining: {{lease_remaining}} months\n\n3. INCLUDED IN SALE\na) All furniture, fixtures, and equipment currently in the property\nb) All active bookings and reservation history\nc) Listing accounts and platform credentials\nd) Operational SOPs and vendor contacts\ne) Smart lock codes and access credentials\n\n4. TRANSFER PROCESS\na) Buyer to complete due diligence within {{due_diligence_days}} business days\nb) Seller to provide all operational documentation\nc) AYP to facilitate lease assignment/transfer with landlord\nd) Closing to occur within {{closing_days}} business days of agreement execution\n\n5. PAYMENT TERMS\nTotal Purchase Price: ${{asking_price}}\nEscrow Deposit: ${{escrow_amount}} (due within 3 business days)\nBalance Due at Closing: ${{balance_due}}\n\n6. SELLER REPRESENTATIONS\nThe Seller represents and warrants that:\na) All financial information provided is accurate\nb) The property is in good condition\nc) There are no outstanding disputes or violations\nd) All bookings are legitimate and confirmed\n\n7. BUYER RESPONSIBILITIES\nThe Buyer agrees to:\na) Complete due diligence in the specified timeframe\nb) Secure necessary funding prior to closing\nc) Assume all lease obligations upon transfer\n\n8. AYP FACILITATION FEE\nAYP's marketplace facilitation fee of ${{facilitation_fee}} is included in the transaction and will be collected at closing.\n\n9. SIGNATURES\n\nSeller Signature: _________________________\nName: {{seller_name}}\nDate: {{date}}\n\nBuyer Signature: _________________________\nName: {{investor_name}}\nDate: {{date}}\n\nAYP Representative: _________________________\nDate: {{date}}",

  'Corporate Sublease Agreement': "CORPORATE SUBLEASE AGREEMENT\n\nThis Corporate Sublease Agreement (\"Agreement\") is entered into as of {{date}} by and between:\n\nSUBLESSOR: {{sublessor_name}} (\"Sublessor\")\nSUBLESSEE: {{investor_name}} (\"Sublessee\")\nEmail: {{investor_email}}\n\nORIGINAL LANDLORD: {{landlord_name}}\nPROPERTY OWNER CONSENT: Required / Obtained\n\n1. PREMISES\nThe Sublessor hereby subleases to the Sublessee the following premises:\nProperty Address: {{property_address}}\nCity/State: {{property_city}}, {{property_state}}\nUnit/Suite: {{unit_number}}\n\n2. TERM\nCommencement Date: {{start_date}}\nExpiration Date: {{end_date}}\nTotal Term: {{lease_term}} months\n\n3. RENT\nMonthly Rent: ${{monthly_rent}}\nSecurity Deposit: ${{security_deposit}}\nDue Date: {{rent_due_day}} of each month\nLate Fee: ${{late_fee}} after {{grace_period}} day grace period\n\n4. PERMITTED USE\nThe Sublessee is permitted to operate the premises as a furnished short-term rental (Airbnb, VRBO, etc.) subject to:\na) All applicable local laws and regulations\nb) The original lease terms and conditions\nc) HOA rules and building regulations\nd) Maximum occupancy limits\n\n5. UTILITIES & SERVICES\nThe following utilities are included/excluded:\n- Electric: {{electric_included}}\n- Water: {{water_included}}\n- Internet: {{internet_included}}\n- Trash: {{trash_included}}\n\n6. MAINTENANCE & REPAIRS\na) Sublessee responsible for routine maintenance and cleaning\nb) Sublessor responsible for structural repairs\nc) Emergency repairs: Contact {{emergency_contact}}\n\n7. INSURANCE\nSublessee must maintain:\na) Renter's insurance with minimum ${{insurance_min}} coverage\nb) Short-term rental liability insurance\nc) Sublessor named as additional insured\n\n8. TERMINATION\na) Either party may terminate with {{notice_days}} days written notice\nb) Early termination fee: ${{early_termination_fee}}\nc) Security deposit returned within 30 days of move-out\n\n9. SIGNATURES\n\nSublessor Signature: _________________________\nName: {{sublessor_name}}\nDate: {{date}}\n\nSublessee Signature: _________________________\nName: {{investor_name}}\nDate: {{date}}\n\nLandlord Consent (if required): _________________________\nDate: {{date}}"
};


export function InvestorAdminModal({ investor, onClose }: Props) {
  const [data, setData] = useState<any>({ messages: [], documents: [], inquiries: [], portfolio: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [documentUpload, setDocumentUpload] = useState({ name: '', url: '', type: 'contract' });
  const [uploading, setUploading] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  
  // Acquisition Manager fields
  const [managerName, setManagerName] = useState(investor.acquisition_manager_name || '');
  const [discoveryCompleted, setDiscoveryCompleted] = useState(investor.discovery_call_completed || false);
  const [savingManager, setSavingManager] = useState(false);
  
  // v13: Success Team fields
  const [accountFunded, setAccountFunded] = useState(investor.account_funded || false);
  const [fundingTier, setFundingTier] = useState(investor.funding_tier || '');
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditOperation, setCreditOperation] = useState('set');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [savingFunding, setSavingFunding] = useState(false);
  const [savingCredits, setSavingCredits] = useState(false);
  
  // Property management
  const [newProperty, setNewProperty] = useState({ address: '', city: '', state: '', property_id: '' });
  const [addingProperty, setAddingProperty] = useState(false);
  
  // Agreement sending
  const [selectedAgreement, setSelectedAgreement] = useState('');
  const [agreementContent, setAgreementContent] = useState('');
  const [sendingAgreement, setSendingAgreement] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const staffSession = JSON.parse(localStorage.getItem('staffSession') || '{}');
  const staffName = staffSession.first_name ? `${staffSession.first_name} ${staffSession.last_name || ''}`.trim() : staffSession.name || 'Staff';

  useEffect(() => { fetchData(); }, [investor.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data.messages]);

  const fetchData = async () => {
    setLoading(true);
    const { data: d } = await supabase.functions.invoke('manage-investor-admin', { 
      body: { action: 'get_investor', investor_id: investor.id } 
    });
    if (d) {
      setData(d);
      if (d.investor) {
        setManagerName(d.investor.acquisition_manager_name || '');
        setDiscoveryCompleted(d.investor.discovery_call_completed || false);
        setAccountFunded(d.investor.account_funded || false);
        setFundingTier(d.investor.funding_tier || '');
        setCreditBalance(d.investor.credit_balance || 0);
      }
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!message.subject || !message.message) return;
    setSending(true);
    await supabase.functions.invoke('manage-investor-admin', { 
      body: { action: 'send_message', investor_id: investor.id, ...message, staff_name: staffName } 
    });
    toast({ title: 'Message sent!' });
    setMessage({ subject: '', message: '' });
    fetchData();
    setSending(false);
  };

  const uploadDocument = async () => {
    if (!documentUpload.name || !documentUpload.url) return;
    setUploading(true);
    await supabase.functions.invoke('manage-investor-admin', {
      body: { action: 'upload_document', investor_id: investor.id, document_name: documentUpload.name, document_url: documentUpload.url, document_type: documentUpload.type, staff_name: staffName }
    });
    toast({ title: 'Document added!' });
    setDocumentUpload({ name: '', url: '', type: 'contract' });
    fetchData();
    setUploading(false);
  };

  const handleAssignManager = async () => {
    setSavingManager(true);
    try {
      const { error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'assign_acquisition_manager', investor_id: investor.id, manager_name: managerName.trim() || null }
      });
      if (error) throw error;
      toast({ title: managerName.trim() ? 'Manager Assigned' : 'Manager Removed' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingManager(false); }
  };

  const handleDiscoveryCallToggle = async () => {
    setSavingManager(true);
    try {
      const { error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'complete_discovery_call', investor_id: investor.id }
      });
      if (error) throw error;
      setDiscoveryCompleted(true);
      toast({ title: 'Discovery Call Completed' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingManager(false); }
  };

  const handleResetSearchLimit = async () => {
    try {
      await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'reset_search_limit', investor_id: investor.id }
      });
      toast({ title: 'Search Limit Reset' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // v13: Funding status
  const handleUpdateFunding = async () => {
    setSavingFunding(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'update_funding_status', investor_id: investor.id, funded: accountFunded, funding_tier: fundingTier, staff_name: staffName }
      });
      if (error) throw error;
      toast({ title: accountFunded ? 'Account Marked as Funded' : 'Account Marked as Unfunded' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingFunding(false); }
  };

  // v13: Update credits
  const handleUpdateCredits = async () => {
    if (!creditAmount) { toast({ title: 'Enter credit amount', variant: 'destructive' }); return; }
    setSavingCredits(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'update_credits', investor_id: investor.id, credits: creditAmount, operation: creditOperation, reason: creditReason, staff_name: staffName }
      });
      if (error) throw error;
      toast({ title: 'Credits Updated', description: `Balance: ${result?.new_balance ?? creditAmount}` });
      setCreditAmount('');
      setCreditReason('');
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingCredits(false); }
  };

  // v13: Add property
  const handleAddProperty = async () => {
    if (!newProperty.address) { toast({ title: 'Enter property address', variant: 'destructive' }); return; }
    setAddingProperty(true);
    try {
      const { error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'add_property_to_portfolio', investor_id: investor.id, property_address: newProperty.address, property_city: newProperty.city, property_state: newProperty.state, property_id: newProperty.property_id || undefined, staff_name: staffName }
      });
      if (error) throw error;
      toast({ title: 'Property Added to Portfolio' });
      setNewProperty({ address: '', city: '', state: '', property_id: '' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setAddingProperty(false); }
  };

  // v13: Send agreement
  const handleSendAgreement = async () => {
    if (!selectedAgreement || !agreementContent) { toast({ title: 'Select and prepare an agreement', variant: 'destructive' }); return; }
    setSendingAgreement(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'send_agreement', investor_id: investor.id, agreement_type: selectedAgreement, agreement_content: agreementContent, staff_name: staffName }
      });
      if (error) throw error;
      toast({ title: 'Agreement Sent', description: result?.message || 'Agreement sent for signature' });
      setSelectedAgreement('');
      setAgreementContent('');
      setEditingAgreement(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSendingAgreement(false); }
  };

  // Load agreement template with variable replacement
  const loadAgreementTemplate = (type: string) => {
    setSelectedAgreement(type);
    let content = AGREEMENT_TEMPLATES[type] || '';
    const invName = investor.full_name || investor.email?.split('@')[0] || '';
    content = content.replace(/{{investor_name}}/g, invName);
    content = content.replace(/{{investor_email}}/g, investor.email || '');
    content = content.replace(/{{investor_phone}}/g, investor.phone || '');
    content = content.replace(/{{date}}/g, new Date().toLocaleDateString());
    setAgreementContent(content);
    setEditingAgreement(true);
  };

  const sortedMessages = [...(data.messages || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const canPurchase = managerName && discoveryCompleted;
  const linkedStaff = data.linked_staff;

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-[#1a365d] to-[#2d4a7c]">
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-full bg-[#d4a574] flex items-center justify-center text-[#1a365d] font-bold text-lg">
                {investor.full_name?.charAt(0).toUpperCase() || investor.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <span className="text-lg">{investor.full_name || investor.email?.split('@')[0]}</span>
                <p className="text-sm text-white/70 font-normal">{investor.email}</p>
              </div>
              <div className="flex gap-2">
                {accountFunded && <Badge className="bg-green-500 text-white">Funded</Badge>}
                {canPurchase && <Badge className="bg-emerald-500 text-white">Can Purchase</Badge>}
                {linkedStaff && <Badge className="bg-blue-500 text-white"><Link2 className="w-3 h-3 mr-1" />Linked</Badge>}
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Info Summary */}
          <div className="px-6 py-3 bg-gray-50 border-b">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /><span>{investor.phone || 'No phone'}</span></div>
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /><span>Joined {new Date(investor.created_at).toLocaleDateString()}</span></div>
              <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-gray-400" /><span>{investor.budget || 'Budget N/A'}</span></div>
              <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-gray-400" /><span>Credits: {creditBalance}</span></div>
              <div className="flex items-center gap-2">
                {accountFunded ? (
                  <Badge className="bg-green-100 text-green-800"><Wallet className="w-3 h-3 mr-1" />Funded</Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1" />Not Funded</Badge>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>
          ) : (
            <Tabs defaultValue="account" className="flex-1">
              <TabsList className="w-full justify-start px-6 pt-2 bg-transparent border-b rounded-none overflow-x-auto flex-nowrap">
                <TabsTrigger value="account" className="data-[state=active]:border-b-2 data-[state=active]:border-[#d4a574] rounded-none whitespace-nowrap">
                  <Wallet className="w-4 h-4 mr-1" />Account
                </TabsTrigger>
                <TabsTrigger value="credits" className="data-[state=active]:border-b-2 data-[state=active]:border-[#d4a574] rounded-none whitespace-nowrap">
                  <Coins className="w-4 h-4 mr-1" />Credits
                </TabsTrigger>
                <TabsTrigger value="properties" className="data-[state=active]:border-b-2 data-[state=active]:border-[#d4a574] rounded-none whitespace-nowrap">
                  <Home className="w-4 h-4 mr-1" />Properties
                </TabsTrigger>
                <TabsTrigger value="agreements" className="data-[state=active]:border-b-2 data-[state=active]:border-[#d4a574] rounded-none whitespace-nowrap">
                  <FileSignature className="w-4 h-4 mr-1" />Agreements
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:border-b-2 data-[state=active]:border-[#d4a574] rounded-none whitespace-nowrap">
                  <UserCheck className="w-4 h-4 mr-1" />Settings
                </TabsTrigger>
                <TabsTrigger value="linking" className="data-[state=active]:border-b-2 data-[state=active]:border-[#d4a574] rounded-none whitespace-nowrap">
                  <Link2 className="w-4 h-4 mr-1" />Link
                </TabsTrigger>
                <TabsTrigger value="messages" className="data-[state=active]:border-b-2 data-[state=active]:border-[#d4a574] rounded-none whitespace-nowrap">
                  <MessageSquare className="w-4 h-4 mr-1" />Messages ({data.messages?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="documents" className="data-[state=active]:border-b-2 data-[state=active]:border-[#d4a574] rounded-none whitespace-nowrap">
                  <FileText className="w-4 h-4 mr-1" />Documents ({data.documents?.length || 0})
                </TabsTrigger>
              </TabsList>


              {/* Account Management Tab */}
              <TabsContent value="account" className="m-0 h-[400px]">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-6">
                    {/* Funding Status */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><Wallet className="w-5 h-5 text-[#d4a574]" />Account Funding Status</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            {accountFunded ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-yellow-600" />}
                            <div>
                              <p className="font-medium">{accountFunded ? 'Account Funded' : 'Account Not Funded'}</p>
                              {fundingTier && <p className="text-xs text-gray-500">Tier: {fundingTier}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch checked={accountFunded} onCheckedChange={setAccountFunded} />
                            <span className="text-sm text-gray-500">{accountFunded ? 'Funded' : 'Not Funded'}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Funding Tier</Label>
                            <Select value={fundingTier} onValueChange={setFundingTier}>
                              <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="starter">Starter ($2,500)</SelectItem>
                                <SelectItem value="growth">Growth ($5,000)</SelectItem>
                                <SelectItem value="premium">Premium ($10,000)</SelectItem>
                                <SelectItem value="enterprise">Enterprise ($25,000+)</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end">
                            <Button onClick={handleUpdateFunding} disabled={savingFunding} className="bg-[#d4a574] hover:bg-[#c49464] w-full">
                              {savingFunding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                              Save Funding Status
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Credits Management */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#d4a574]" />Credits Management</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] rounded-lg text-white">
                          <p className="text-sm opacity-80">Current Balance</p>
                          <p className="text-3xl font-bold">{creditBalance} <span className="text-sm font-normal opacity-70">credits</span></p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label>Operation</Label>
                            <Select value={creditOperation} onValueChange={setCreditOperation}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="set">Set To</SelectItem>
                                <SelectItem value="add">Add</SelectItem>
                                <SelectItem value="subtract">Subtract</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Amount</Label>
                            <Input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="0" />
                          </div>
                          <div>
                            <Label>Reason</Label>
                            <Input value={creditReason} onChange={e => setCreditReason(e.target.value)} placeholder="Reason for change" />
                          </div>
                        </div>
                        <Button onClick={handleUpdateCredits} disabled={savingCredits} className="bg-[#1a365d] hover:bg-[#2d4a7c] w-full">
                          {savingCredits ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                          Update Credits
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Credits Management Tab - Full Featured */}
              <TabsContent value="credits" className="m-0 h-[400px]">
                <ScrollArea className="h-full px-6 py-4">
                  <InvestorCreditsManager
                    investorId={investor.id}
                    investorName={investor.full_name || investor.email?.split('@')[0] || 'Investor'}
                    currentBalance={creditBalance}
                    onBalanceChanged={(newBalance) => {
                      setCreditBalance(newBalance);
                      fetchData();
                    }}
                  />
                </ScrollArea>
              </TabsContent>


              {/* Properties Tab - Full StaffPortfolioManager */}
              <TabsContent value="properties" className="m-0 h-[400px]">
                <ScrollArea className="h-full">
                  <div className="px-6 py-4">
                    <StaffPortfolioManager
                      investorId={investor.id}
                      investorName={investor.full_name || investor.email?.split('@')[0] || 'Investor'}
                      staffId={staffSession?.id || ''}
                      staffName={staffName}
                      portfolio={data.portfolio}
                      onRefresh={fetchData}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>


              {/* Agreements Tab */}
              <TabsContent value="agreements" className="m-0 h-[400px]">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-6">
                    {!editingAgreement ? (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2"><FileSignature className="w-5 h-5 text-[#d4a574]" />Send Agreement for Signature</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-500 mb-4">Select an agreement template to customize and send to this investor for signature.</p>
                          <div className="grid gap-3">
                            {Object.keys(AGREEMENT_TEMPLATES).map(type => (
                              <Button key={type} variant="outline" className="justify-start h-auto py-4 px-4 text-left" onClick={() => loadAgreementTemplate(type)}>
                                <div className="flex items-center gap-3 w-full">
                                  <div className="w-10 h-10 rounded-lg bg-[#1a365d]/10 flex items-center justify-center flex-shrink-0">
                                    <FileSignature className="w-5 h-5 text-[#1a365d]" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium">{type}</p>
                                    <p className="text-xs text-gray-500">Click to customize and send</p>
                                  </div>
                                  <Send className="w-4 h-4 text-gray-400" />
                                </div>
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <FileSignature className="w-5 h-5 text-[#d4a574]" />
                              Edit: {selectedAgreement}
                            </CardTitle>
                            <Button variant="outline" size="sm" onClick={() => { setEditingAgreement(false); setSelectedAgreement(''); setAgreementContent(''); }}>
                              Back to Templates
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm text-amber-800">Edit the agreement below. Variables like {'{{investor_name}}'} have been auto-filled. You can modify any part before sending.</p>
                          </div>
                          <Textarea
                            value={agreementContent}
                            onChange={e => setAgreementContent(e.target.value)}
                            rows={14}
                            className="font-mono text-sm"
                          />
                          <div className="flex gap-3">
                            <Button onClick={handleSendAgreement} disabled={sendingAgreement} className="bg-[#d4a574] hover:bg-[#c49464] flex-1">
                              {sendingAgreement ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                              Send for Signature
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Sent Agreements */}
                    {data.documents?.filter((d: any) => d.document_type === 'agreement').length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Sent Agreements</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {data.documents.filter((d: any) => d.document_type === 'agreement').map((doc: any) => (
                              <div key={doc.id} className="p-3 border rounded-lg flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{doc.document_name}</p>
                                  <p className="text-xs text-gray-500">{new Date(doc.created_at).toLocaleDateString()} - {doc.status || 'pending_signature'}</p>
                                </div>
                                <Badge className={doc.status === 'signed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                  {doc.status === 'signed' ? 'Signed' : 'Pending Signature'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="m-0 h-[400px]">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-6">
                    <Card className={canPurchase ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {canPurchase ? <Shield className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-yellow-600" />}
                          <div>
                            <h4 className={`font-semibold ${canPurchase ? 'text-green-800' : 'text-yellow-800'}`}>
                              {canPurchase ? 'Eligible to Purchase Deals' : 'Not Yet Eligible'}
                            </h4>
                            {!canPurchase && (
                              <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                                {!managerName && <li>- Assign an acquisition manager</li>}
                                {!discoveryCompleted && <li>- Complete discovery call</li>}
                              </ul>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-3">
                      <Label className="text-base font-semibold flex items-center gap-2"><UserCheck className="w-5 h-5 text-[#d4a574]" />Acquisition Manager</Label>
                      <div className="flex gap-2">
                        <Input placeholder="Manager name" value={managerName} onChange={e => setManagerName(e.target.value)} className="flex-1" />
                        <Button onClick={handleAssignManager} disabled={savingManager} className="bg-[#d4a574] hover:bg-[#c49464]">
                          {savingManager ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base font-semibold flex items-center gap-2"><PhoneCall className="w-5 h-5 text-[#d4a574]" />Discovery Call</Label>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {discoveryCompleted ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-yellow-600" />}
                          <p className="font-medium">{discoveryCompleted ? 'Completed' : 'Pending'}</p>
                        </div>
                        {!discoveryCompleted && (
                          <Button onClick={handleDiscoveryCallToggle} disabled={savingManager} className="bg-green-600 hover:bg-green-700">
                            {savingManager ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base font-semibold flex items-center gap-2"><Search className="w-5 h-5 text-[#d4a574]" />Penny AI Search Limit</Label>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium">Searches: {data.investor?.penny_searches_this_week || 0} / 10</p>
                        <Button variant="outline" onClick={handleResetSearchLimit}><RefreshCw className="w-4 h-4 mr-2" />Reset</Button>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Account Linking Tab */}
              <TabsContent value="linking" className="m-0 h-[400px]">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-6">
                    {linkedStaff ? (
                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <div>
                                <p className="font-medium text-green-800">Linked to Staff</p>
                                <p className="text-sm text-green-700">{linkedStaff.first_name} {linkedStaff.last_name} ({linkedStaff.email})</p>
                              </div>
                            </div>
                            <Button variant="outline" onClick={() => setLinkModalOpen(true)}>Manage</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-dashed">
                        <CardContent className="p-6 text-center">
                          <Link2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                          <h4 className="font-medium mb-2">No Staff Account Linked</h4>
                          <Button onClick={() => setLinkModalOpen(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
                            <Link2 className="w-4 h-4 mr-2" />Link to Staff
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              {/* Messages Tab */}
              <TabsContent value="messages" className="m-0 flex flex-col h-[400px]">
                <ScrollArea className="flex-1 px-6 py-4">
                  <div className="space-y-4">
                    {sortedMessages.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No messages yet</p>
                      </div>
                    ) : (
                      sortedMessages.map((m: any) => (
                        <div key={m.id} className={`flex ${m.sender_type === 'staff' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-lg p-3 ${m.sender_type === 'staff' ? 'bg-[#1a365d] text-white' : 'bg-gray-100 text-gray-900'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {m.sender_type === 'staff' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                              <span className="text-xs font-medium">{m.sender_name}</span>
                              <span className={`text-xs ${m.sender_type === 'staff' ? 'text-white/60' : 'text-gray-400'}`}>{new Date(m.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-xs font-semibold mb-1">{m.subject}</p>
                            <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="border-t px-6 py-4 bg-gray-50">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-2">
                      <Input value={message.subject} onChange={e => setMessage({...message, subject: e.target.value})} placeholder="Subject" className="text-sm" />
                      <Textarea value={message.message} onChange={e => setMessage({...message, message: e.target.value})} placeholder="Type your message..." rows={2} className="text-sm resize-none" />
                    </div>
                    <Button onClick={sendMessage} disabled={sending || !message.subject || !message.message} className="bg-[#d4a574] hover:bg-[#c49464] self-end">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="m-0 h-[400px] flex flex-col">
                <div className="px-6 py-4 border-b bg-gray-50">
                  <p className="text-sm font-medium mb-3">Add Document</p>
                  <div className="grid grid-cols-4 gap-3">
                    <Input placeholder="Document name" value={documentUpload.name} onChange={e => setDocumentUpload({...documentUpload, name: e.target.value})} />
                    <Input placeholder="Document URL" value={documentUpload.url} onChange={e => setDocumentUpload({...documentUpload, url: e.target.value})} className="col-span-2" />
                    <div className="flex gap-2">
                      <Select value={documentUpload.type} onValueChange={v => setDocumentUpload({...documentUpload, type: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="agreement">Agreement</SelectItem>
                          <SelectItem value="report">Report</SelectItem>
                          <SelectItem value="invoice">Invoice</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={uploadDocument} disabled={uploading || !documentUpload.name || !documentUpload.url} className="bg-[#d4a574]">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <ScrollArea className="flex-1 px-6 py-4">
                  <div className="space-y-2">
                    {data.documents?.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No documents uploaded</p>
                      </div>
                    ) : (
                      data.documents?.map((doc: any) => (
                        <div key={doc.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center hover:bg-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#1a365d] flex items-center justify-center">
                              <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{doc.document_name}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          {doc.document_url && (
                            <Button size="sm" variant="outline" onClick={() => window.open(doc.document_url, '_blank')}>View</Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <AccountLinkingModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        mode="investor"
        sourceAccount={{
          id: investor.id,
          name: investor.full_name || investor.email?.split('@')[0] || 'Investor',
          email: investor.email,
          linkedAccountId: linkedStaff?.id,
          linkedAccountName: linkedStaff ? `${linkedStaff.first_name} ${linkedStaff.last_name}` : undefined,
          linkedAccountEmail: linkedStaff?.email
        }}
        onLinked={fetchData}
      />
    </>
  );
}
