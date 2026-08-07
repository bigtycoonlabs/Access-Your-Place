import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DealPickerModal, type DealRecord } from './DealPickerModal';
import { generateAgreementPdf } from '@/utils/generateAgreementPdf';
import { notifyAgreementSent } from '@/utils/emailNotifications';
import {
  Loader2, Search, FileSignature, Send, Plus, Edit2, Eye, Clock,
  CheckCircle, XCircle, User, Calendar, RefreshCw, FileText, Building2,
  AlertCircle, Trash2, Copy, MapPin, Bed, Bath, DollarSign, X,
  Download, Printer, PenTool, Save
} from 'lucide-react';


interface Props {
  staffId: string;
  staffName: string;
}

interface AgreementDocument {
  id: string;
  investor_id: string;
  investor_name?: string;
  investor_email?: string;
  document_name: string;
  document_type: string;
  document_content: string;
  document_url?: string;
  signature_status: 'pending' | 'viewed' | 'signed' | 'rejected' | 'expired';
  signed_at?: string;
  expires_at?: string;
  sent_at?: string;
  sent_by?: string;
  created_at: string;
}

interface Investor {
  id: string;
  full_name: string;
  email: string;
}

const AGREEMENT_TEMPLATES: Record<string, { name: string; content: string }> = {
  acquisition_agreement: {
    name: 'Rental Arbitrage Acquisition Agreement',
    content: `RENTAL ARBITRAGE ACQUISITION AGREEMENT
Set Up Your Place LLC (DBA: Access Your Place / AYP / Your Place)
A Subsidiary of Cooper Family Inc.

THIS AGREEMENT is made and entered into on this {{DATE}}, by and between:

THE COMPANY:
Set Up Your Place LLC (DBA: Access Your Place / AYP / Your Place)
1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
(Hereinafter referred to as "The Company" or "AYP")

AND

THE CLIENT:
Name/Entity: {{INVESTOR_NAME}}
Email: {{INVESTOR_EMAIL}}
(Hereinafter referred to as "Client" or "Operator")

1. THE TRANSACTION & OPERATION TYPE
The Client agrees to acquire the rights to establish or takeover a rental arbitrage operation (the "Operation") at the premises defined below. The Client acknowledges that they are purchasing a service package to secure this opportunity, not purchasing real estate.

1.1 The Property
 * Address: [PROPERTY ADDRESS]
 * Community/Building Name: [COMMUNITY NAME]

1.2 Acquisition Type
The Client acknowledges they are acquiring the following specific class of Operation:
 * [ ] Furnished Operation (Turn-Key): A property already furnished by the landlord or AYP, ready for immediate operation.
 * [ ] Unfurnished Operation: A property requiring setup and furnishing by the Client or AYP Setup Services.
 * [ ] Takeover Operation: An existing operation being transferred from a current operator.

1.3 Acquisition Fee
The Client agrees to pay a non-refundable Acquisition Fee for the services rendered in securing this Operation.
 * Total Acquisition Fee: $[AMOUNT] (PAID)
 * Fee Disclosure: This fee covers market research, landlord negotiation, lease acquisition, and administrative onboarding.

2. SCOPE OF SERVICE & RESEARCH METHODOLOGY
AYP is a technology and service platform. We do not guarantee specific financial returns, but we guarantee the integrity of our research methodology.

2.1 The Research Formula ("Foundation of Truth")
The Client acknowledges that AYP has validated the viability of this Operation using proprietary research standards, including Market Data (ADR/Occupancy), Competitor Analysis, and Seasonality evaluations.

2.2 Operational Verification
AYP certifies that, as of the Effective Date, the Landlord/Community management is fully aware of and has consented to the intended commercial use (Short-Term Rental, Corporate Housing, or Co-Living).

3. FINANCIAL POLICY: REFUNDS, CREDITS & LIQUIDITY
Due to the nature of the intellectual property, relationship management, and proprietary data provided, The Company maintains a strict NO CASH REFUND policy.

3.1 The Service Provider Nature
The Acquisition Fee covers the labor, data research, and landlord relationship management required to secure the Operation. Once these services are rendered (i.e., the deal is presented and secured), the fee is considered earned.

3.2 The Credit System (Asset Protection)
In the event a deal cannot proceed due to Landlord denial or external factors not caused by the Client:
 * Non-Expiration: AYP Credits do not expire.
 * Liquidity Mechanism: While AYP does not offer cash refunds, the Client may convert a Credit to cash by applying the Credit to acquire a new Operation and subsequently selling that Operation through the AYP Marketplace.

4. COMPLIANCE & COMMUNITY INTEGRITY
The long-term viability of the AYP network relies on the "Integrity Standard." The Client agrees to strictly adhere to all Community Rules, HOA guidelines, and Lease Addendums.
 * Violation Penalty: Willful violation of community rules may result in a ban from the AYP Network and termination of in-progress projects.

5. OPERATIONAL PROTECTION & SUPPORT
AYP stands behind the validity of the lease structure. If a Landlord or Municipality changes regulations prohibiting the intended operation, AYP will provide representation to negotiate lease breaks or grandfather clauses.

6. PRIVACY, DATA & IDENTITY PROTECTION
The Company agrees not to disclose the Client's personal address or financial records to the general public. Client identity is shared only with the specific Landlord/Community required for the Corporate Application.

7. GENERAL PROVISIONS
 * Indemnification: The Client agrees to indemnify and hold harmless Set Up Your Place LLC from any claims arising from the Client's operation of the property.
 * Governing Law: This Agreement shall be governed by the laws of the State of Florida. Any disputes arising from this Agreement shall be resolved through binding arbitration in Miami-Dade County.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first above written.

THE COMPANY:
Set Up Your Place LLC
Signature: __________________________
Print Name: {{STAFF_NAME}}
Title: __________________________

THE CLIENT:
{{INVESTOR_NAME}}
Signature: __________________________
Print Name: __________________________
Date: __________________________`
  },
  corporate_sublease: {
    name: 'Corporate Sublease Agreement',
    content: `CORPORATE SUBLEASE AGREEMENT
Set Up Your Place LLC (DBA: Access Your Place)

THIS SUBLEASE AGREEMENT (the "Sublease") is made and entered into on this {{DATE}} (the "Effective Date"), by and between:

SUBLESSOR:
Set Up Your Place LLC
1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
(Hereinafter referred to as "Sublessor" or "AYP")

AND

SUBLESSEE:
{{INVESTOR_NAME}}
(Hereinafter referred to as "Sublessee" or "Client")

1. PREMISES
Sublessor hereby subleases to Sublessee, and Sublessee hereby rents from Sublessor, the fully furnished residential unit located at:
 * Address: [PROPERTY ADDRESS] ([COMMUNITY NAME])
 * Configuration: [UNIT CONFIGURATION]
 * Included Assets: Unit includes furnishings, smart lock, fresh linens, and household supplies (the "Inventory").

2. TERM
The term of this Sublease shall be for [TERM WRITTEN] ([TERM MONTHS]) Months.
 * Agreement Effective Date: {{DATE}} (Signing Date)
 * Possession & Rent Commencement Date: [MOVE-IN DATE] (Move-In Date)
 * Expiration Date: [EXPIRATION DATE]

3. RENT & PAYMENTS

3.1 Monthly Rent
Sublessee agrees to pay monthly rent in the amount of $[MONTHLY RENT].
Rent is due on the 1st day of each month.

3.2 Prorated First Month Rent
For the first partial month of possession ([PRORATE START] – [PRORATE END]), Sublessee shall pay the prorated amount of $[PRORATED AMOUNT] on or before the Move-In Date.

3.3 Payment Instructions (Direct to Landlord)
Sublessee is directed to remit all Rent payments directly to the Master Landlord ([LANDLORD NAME]).
 * Accepted Methods: Zelle, Venmo, or Wire Transfer.
 * Proof of Payment: Sublessee must upload a screenshot/receipt of the payment to the AYP Staff Dashboard or email it to the Success Team monthly as proof of compliance.

4. SECURITY DEPOSIT
Upon execution of this Sublease, Sublessee shall deposit the sum of $[DEPOSIT AMOUNT] as a Security Deposit.
 * Refund: The deposit will be refunded within 30 days of vacancy, provided the Premises and Inventory are returned in the same condition as received, reasonable wear and tear excepted.

5. UTILITIES (ALL-INCLUSIVE)
The Monthly Rent of $[MONTHLY RENT] includes:
 * Electricity
 * High-Speed Internet / Wi-Fi
 * Water / Sewer / Trash / Pest Control

6. DEFAULT, NON-PAYMENT & ASSET FORFEITURE

6.1 The "Operational Integrity" Clause
Sublessee acknowledges that this Sublease is part of a commercial "Rental Arbitrage Operation" facilitated by Sublessor. The stability of the Master Lease depends on timely payment.

6.2 Event of Default
Sublessee shall be in default if Rent is not received by the Master Landlord or Sublessor by the 3rd day of the month.

6.3 Remedies & Asset Forfeiture
In the event of a default that is not cured within twenty-four (24) hours of notice, Sublessor (Set Up Your Place LLC) reserves the absolute right to:
 * Immediate Possession: Re-enter the Premises, change the smart locks/access codes, and retake possession of the unit to protect the relationship with the Master Landlord.
 * Forfeiture of Operation: Sublessee immediately forfeits all rights to the "Operation," including the lease interest, future bookings, and revenue.
 * Seizure of Inventory: All furnishings, electronics, linens, and supplies located within the Premises shall automatically become the property of Sublessor to offset unpaid rent, damages, and lease breakage fees.
 * Client Ban: Sublessee will be permanently banned from the Access Your Place network and restricted from future acquisitions.

7. USE OF PREMISES
Sublessee is explicitly permitted to use the Premises for Short-Term Rental (STR), Corporate Housing, or Extended Stay purposes, utilizing platforms such as Airbnb, VRBO, and Furnished Finder.

8. INDEMNIFICATION
Sublessee agrees to indemnify and hold harmless Sublessor and the Master Landlord from any claims, damages, or liabilities arising from the commercial operation of the property, including guest injuries or property damage.

9. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Florida.

IN WITNESS WHEREOF, the parties have executed this Sublease as of the date first above written.

SUBLESSOR:
Set Up Your Place LLC
Signature: __________________________
Print Name: {{STAFF_NAME}}
Title: __________________________

SUBLESSEE:
{{INVESTOR_NAME}}
Signature: __________________________
Print Name: __________________________
Title: __________________________`
  },
  setup_services: {
    name: 'Property Setup Services Agreement',
    content: `PROPERTY SETUP SERVICES AGREEMENT
Set Up Your Place LLC (DBA: Access Your Place / AYP / Your Place)
A Subsidiary of Cooper Family Inc.

THIS AGREEMENT is made and entered into on {{DATE}}, by and between:

THE COMPANY:
Set Up Your Place LLC (DBA: Access Your Place / AYP / Your Place)
1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
(Hereinafter referred to as "The Company" or "AYP")

AND

THE CLIENT:
Name/Entity: {{INVESTOR_NAME}}
Email: {{INVESTOR_EMAIL}}
(Hereinafter referred to as "Client" or "Operator")

1. SCOPE OF SETUP SERVICES
AYP agrees to provide full-service property setup for the Client's rental arbitrage operation at the following premises:
 * Address: [PROPERTY ADDRESS]
 * Community/Building Name: [COMMUNITY NAME]

1.1 Setup Package
The Client has selected the following setup package:
 * [SETUP PACKAGE]

1.2 Services Included
Depending on the selected package, AYP will provide the following services:
 * Interior Design & Layout Planning
 * Furniture Procurement & Delivery Coordination
 * Bed, Bath & Kitchen Essentials Setup
 * Smart Lock Installation & Configuration
 * Wi-Fi Router Setup & Speed Verification
 * Professional Photography for Listing Optimization
 * Listing Creation on Airbnb, VRBO, Furnished Finder, and/or Booking.com
 * Welcome Guide & House Manual Creation
 * Cleaning Supply Kit & Initial Deep Clean
 * Noise Monitor Installation (if applicable)

2. SETUP FEE & PAYMENT TERMS

2.1 Total Setup Fee
The Client agrees to pay a Setup Fee of $[SETUP FEE] for the services described above.

2.2 Payment Schedule
 * 50% due upon execution of this Agreement (deposit)
 * 50% due upon completion of setup and Client walkthrough approval

2.3 Additional Costs
The Setup Fee covers labor, coordination, and project management. Furniture, fixtures, and equipment (FF&E) costs are billed separately based on the approved design plan and budget.

3. TIMELINE & COMPLETION

3.1 Estimated Completion
AYP will make reasonable efforts to complete the property setup within [ESTIMATED DAYS] business days of receiving the initial deposit and property access.

3.2 Delays
AYP is not responsible for delays caused by:
 * Landlord or building management access restrictions
 * Supply chain or shipping delays for furniture/equipment
 * Client-requested changes to the design plan after approval
 * Force majeure events

4. CLIENT RESPONSIBILITIES
The Client agrees to:
 * Provide timely property access (keys, codes, or smart lock credentials)
 * Approve the design plan and budget within 5 business days of presentation
 * Respond to AYP communications within 48 hours during the setup period
 * Ensure all utilities (electric, water, internet) are active before setup begins

5. QUALITY GUARANTEE
AYP guarantees that the property will be set up to "Guest-Ready" standards. If the Client identifies deficiencies within 7 days of the completion walkthrough, AYP will remedy them at no additional cost.

6. OWNERSHIP OF ASSETS
All furniture, fixtures, and equipment purchased with Client funds remain the sole property of the Client. AYP retains no ownership interest in any physical assets placed in the property.

7. PHOTOGRAPHY & MARKETING RIGHTS
The Client grants AYP a non-exclusive license to use photographs and descriptions of the completed setup for marketing purposes, including but not limited to the AYP website, social media, and case studies.

8. LIMITATION OF LIABILITY
AYP's total liability under this Agreement shall not exceed the Setup Fee paid by the Client. AYP is not liable for any consequential, incidental, or indirect damages including lost revenue or booking cancellations.

9. GENERAL PROVISIONS
 * Indemnification: The Client agrees to indemnify and hold harmless Set Up Your Place LLC from any claims arising from the Client's operation of the property after setup completion.
 * Governing Law: This Agreement shall be governed by the laws of the State of Florida. Any disputes arising from this Agreement shall be resolved through binding arbitration in Miami-Dade County.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first above written.

THE COMPANY:
Set Up Your Place LLC
Signature: __________________________
Print Name: {{STAFF_NAME}}
Title: __________________________

THE CLIENT:
{{INVESTOR_NAME}}
Signature: __________________________
Print Name: __________________________
Date: __________________________`
  }
};


export function SuccessAgreementManager({ staffId, staffName }: Props) {
  const [agreements, setAgreements] = useState<AgreementDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Send agreement modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('acquisition_agreement');
  const [agreementContent, setAgreementContent] = useState('');
  const [agreementName, setAgreementName] = useState('');
  const [investorSearch, setInvestorSearch] = useState('');
  const [investorResults, setInvestorResults] = useState<Investor[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [expiresInDays, setExpiresInDays] = useState('30');

  // Deal picker state
  const [showDealPicker, setShowDealPicker] = useState(false);
  const [showDealPickerForView, setShowDealPickerForView] = useState(false);
  const [loadedDeal, setLoadedDeal] = useState<DealRecord | null>(null);

  // View/Edit modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingAgreement, setViewingAgreement] = useState<AgreementDocument | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => { fetchAgreements(); }, []);

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-document-signatures', {
        body: { action: 'get_all_documents', staff_id: staffId }
      });
      if (data?.documents) {
        setAgreements(data.documents);
      } else {
        const { data: directData } = await supabase
          .from('document_signatures')
          .select('*, investors(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (directData) {
          setAgreements(directData.map((d: any) => ({
            ...d,
            investor_name: d.investors?.full_name,
            investor_email: d.investors?.email
          })));
        }
      }
    } catch (err) {
      console.error('Error fetching agreements:', err);
      try {
        const { data: directData } = await supabase
          .from('document_signatures')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (directData) setAgreements(directData);
      } catch (e) {
        console.error('Direct query also failed:', e);
      }
    }
    setLoading(false);
  };

  const handleSearchInvestors = async (query: string) => {
    setInvestorSearch(query);
    if (query.length < 2) { setInvestorResults([]); return; }
    
    try {
      const { data } = await supabase.functions.invoke('manage-investor-credits', {
        body: { action: 'search_investors', query }
      });
      if (data?.investors) {
        setInvestorResults(data.investors.map((i: any) => ({
          id: i.id,
          full_name: i.name || i.full_name,
          email: i.email
        })));
      }
    } catch {
      const { data } = await supabase
        .from('investors')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
      if (data) setInvestorResults(data);
    }
  };

  const handleSelectTemplate = (templateKey: string, dealToReapply?: DealRecord | null) => {
    setSelectedTemplate(templateKey);
    const template = AGREEMENT_TEMPLATES[templateKey];
    if (template) {
      setAgreementName(template.name);
      let content = template.content;
      content = content.replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      content = content.replace(/\{\{STAFF_NAME\}\}/g, staffName);
      if (selectedInvestor) {
        content = content.replace(/\{\{INVESTOR_NAME\}\}/g, selectedInvestor.full_name);
        content = content.replace(/\{\{INVESTOR_EMAIL\}\}/g, selectedInvestor.email);
      }
      if (dealToReapply) {
        content = applyDealToContent(content, dealToReapply);
      }
      setAgreementContent(content);
    }
  };

  const handleSelectInvestor = (investor: Investor) => {
    setSelectedInvestor(investor);
    setInvestorSearch(investor.full_name);
    setInvestorResults([]);
    let content = agreementContent;
    content = content.replace(/\{\{INVESTOR_NAME\}\}/g, investor.full_name);
    content = content.replace(/\{\{INVESTOR_EMAIL\}\}/g, investor.email);
    setAgreementContent(content);
  };

  const handleOpenSendModal = () => {
    setSelectedInvestor(null);
    setInvestorSearch('');
    setInvestorResults([]);
    setLoadedDeal(null);
    const template = AGREEMENT_TEMPLATES['acquisition_agreement'];
    setSelectedTemplate('acquisition_agreement');
    setAgreementName(template.name);
    let content = template.content;
    content = content.replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    content = content.replace(/\{\{STAFF_NAME\}\}/g, staffName);
    setAgreementContent(content);
    setExpiresInDays('30');
    setShowSendModal(true);
  };

  const buildFullAddress = (deal: DealRecord) => {
    const parts = [];
    if (deal.address) parts.push(deal.address);
    if (deal.city) parts.push(deal.city);
    if (deal.state) {
      parts.push(deal.zip_code ? `${deal.state} ${deal.zip_code}` : deal.state);
    }
    return parts.join(', ');
  };

  const buildUnitConfig = (deal: DealRecord) => {
    const beds = deal.bedrooms || 0;
    const baths = deal.bathrooms || 0;
    const sqft = deal.sqft || deal.square_feet;
    let config = `${beds} Bedroom${beds !== 1 ? 's' : ''} / ${baths} Bathroom${baths !== 1 ? 's' : ''}`;
    if (sqft) config += ` / ${sqft.toLocaleString()} sq ft`;

    return config;
  };

  const applyDealToContent = (content: string, deal: DealRecord): string => {
    const fullAddress = buildFullAddress(deal);
    const communityName = deal.listing_title || '';
    const unitConfig = buildUnitConfig(deal);
    const monthlyRent = deal.monthly_rent ? deal.monthly_rent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    const acquisitionFee = deal.acquisition_fee ? deal.acquisition_fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    const landlordName = deal.landlord_name || '';
    const furnishedCheck = deal.is_furnished ? '[X]' : '[ ]';
    const unfurnishedCheck = deal.is_furnished ? '[ ]' : '[X]';

    let result = content;

    if (fullAddress) result = result.replace(/\[PROPERTY ADDRESS\]/g, fullAddress);
    if (communityName) result = result.replace(/\[COMMUNITY NAME\]/g, communityName);
    if (unitConfig) result = result.replace(/\[UNIT CONFIGURATION\]/g, unitConfig);
    if (monthlyRent) result = result.replace(/\[MONTHLY RENT\]/g, monthlyRent);
    if (acquisitionFee) result = result.replace(/\[AMOUNT\]/g, acquisitionFee);
    if (landlordName) result = result.replace(/\[LANDLORD NAME\]/g, landlordName);

    result = result.replace(
      / \* \[ \] Furnished Operation \(Turn-Key\)/,
      ` * ${furnishedCheck} Furnished Operation (Turn-Key)`
    );
    result = result.replace(
      / \* \[ \] Unfurnished Operation/,
      ` * ${unfurnishedCheck} Unfurnished Operation`
    );

    return result;
  };

  const handleLoadDeal = (deal: DealRecord) => {
    setLoadedDeal(deal);
    const updatedContent = applyDealToContent(agreementContent, deal);
    setAgreementContent(updatedContent);

    const fullAddress = buildFullAddress(deal);
    const communityName = deal.listing_title || '';
    const filledFields: string[] = [];
    const remainingPlaceholders: string[] = [];

    if (fullAddress) filledFields.push('Property Address');
    else remainingPlaceholders.push('[PROPERTY ADDRESS]');
    if (communityName) filledFields.push('Community Name');
    else remainingPlaceholders.push('[COMMUNITY NAME]');
    if (deal.monthly_rent) filledFields.push('Monthly Rent');
    else remainingPlaceholders.push('[MONTHLY RENT]');
    filledFields.push('Unit Configuration');
    if (deal.acquisition_fee) filledFields.push('Acquisition Fee');
    else remainingPlaceholders.push('[AMOUNT]');
    if (deal.landlord_name) filledFields.push('Landlord Name');
    else remainingPlaceholders.push('[LANDLORD NAME]');

    const description = `Loaded ${filledFields.length} field${filledFields.length !== 1 ? 's' : ''} from deal.` +
      (remainingPlaceholders.length > 0
        ? ` ${remainingPlaceholders.length} placeholder${remainingPlaceholders.length !== 1 ? 's' : ''} still need manual entry.`
        : ' All property fields filled.');

    toast({ title: 'Deal Loaded', description });
  };

  // Load deal into the View/Edit modal's content
  const handleLoadDealForView = (deal: DealRecord) => {
    const updatedContent = applyDealToContent(editingContent, deal);
    setEditingContent(updatedContent);
    toast({ title: 'Deal Loaded', description: 'Property details have been applied to the agreement. Review and save.' });
  };

  const handleClearDeal = () => {
    setLoadedDeal(null);
    handleSelectTemplate(selectedTemplate);
    toast({ title: 'Deal Cleared', description: 'Property placeholders have been reset.' });
  };

  const handleSendAgreement = async () => {
    if (!selectedInvestor) {
      toast({ title: 'Select an Investor', description: 'Please search and select an investor to send the agreement to.', variant: 'destructive' });
      return;
    }
    if (!agreementContent.trim()) {
      toast({ title: 'Agreement content is required', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-document-signatures', {
        body: {
          action: 'send_document',
          investor_id: selectedInvestor.id,
          document_name: agreementName,
          document_type: selectedTemplate,
          document_content: agreementContent,
          expires_in_days: parseInt(expiresInDays),
          sent_by: staffName,
          sent_by_id: staffId,
          investor_name: selectedInvestor.full_name,
          investor_email: selectedInvestor.email
        }
      });

      if (error) throw error;

      // Send email notification to investor
      notifyAgreementSent({
        investorId: selectedInvestor.id,
        investorName: selectedInvestor.full_name,
        investorEmail: selectedInvestor.email,
        staffName,
        documentName: agreementName,
        documentType: selectedTemplate,
        expiresInDays: parseInt(expiresInDays)
      }).catch(err => console.warn('Email notification failed:', err));

      if (data?.success) {
        toast({ title: 'Agreement Sent!', description: `${agreementName} sent to ${selectedInvestor.full_name} for signature. Email notification delivered.` });
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        // Fallback: direct insert
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));

        const { error: insertErr } = await supabase
          .from('document_signatures')
          .insert({
            investor_id: selectedInvestor.id,
            document_name: agreementName,
            document_type: selectedTemplate,
            document_content: agreementContent,
            signature_status: 'pending',
            expires_at: expiresAt.toISOString(),
            sent_by: staffName,
            sent_by_id: staffId,
            investor_name: selectedInvestor.full_name,
            investor_email: selectedInvestor.email,
            reminder_count: 0,
            created_at: new Date().toISOString()
          });
        
        if (insertErr) throw insertErr;
        toast({ title: 'Agreement Sent!', description: `${agreementName} sent to ${selectedInvestor.full_name}. Email notification sent.` });
      }

      setShowSendModal(false);
      fetchAgreements();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send agreement', variant: 'destructive' });
    }
    setSending(false);
  };

  const handleViewAgreement = (agreement: AgreementDocument) => {
    setViewingAgreement(agreement);
    setEditingContent(agreement.document_content || '');
    setIsEditing(agreement.signature_status === 'pending' || agreement.signature_status === 'viewed');
    setShowViewModal(true);
  };

  const handleSaveEdit = async () => {
    if (!viewingAgreement) return;
    setSavingEdit(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-document-signatures', {
        body: {
          action: 'update_document',
          document_id: viewingAgreement.id,
          updates: {
            document_content: editingContent
          }
        }
      });

      if (error || !data?.success) {
        await supabase
          .from('document_signatures')
          .update({ document_content: editingContent, updated_at: new Date().toISOString() })
          .eq('id', viewingAgreement.id);
      }

      toast({ title: 'Agreement Updated', description: 'Changes have been saved successfully.' });
      // Update local state
      setViewingAgreement({ ...viewingAgreement, document_content: editingContent });
      fetchAgreements();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSavingEdit(false);
  };

  const handleDownloadPdf = () => {
    const content = viewingAgreement ? editingContent : agreementContent;
    const docName = viewingAgreement?.document_name || agreementName || 'Agreement';
    const invName = viewingAgreement?.investor_name || selectedInvestor?.full_name;
    const docType = viewingAgreement?.document_type || selectedTemplate;

    if (!content.trim()) {
      toast({ title: 'No Content', description: 'There is no agreement content to generate a PDF from.', variant: 'destructive' });
      return;
    }

    setGeneratingPdf(true);
    try {
      const result = generateAgreementPdf({
        documentName: docName,
        investorName: invName,
        content,
        documentType: docType
      });

      if (result.success) {
        toast({ title: 'PDF Downloaded', description: `Saved as ${result.filename}` });
      }
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast({ title: 'PDF Generation Failed', description: err.message || 'Could not generate PDF. Please try again.', variant: 'destructive' });
    }
    setGeneratingPdf(false);
  };

  const handleResendReminder = async (agreement: AgreementDocument) => {
    try {
      await supabase.functions.invoke('manage-document-signatures', {
        body: { action: 'send_reminder', document_id: agreement.id, staff_id: staffId }
      });
      toast({ title: 'Reminder Sent', description: `Reminder sent to ${agreement.investor_name || 'investor'}` });
      fetchAgreements();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const pendingAgreements = agreements.filter(a => a.signature_status === 'pending' || a.signature_status === 'viewed');
  const signedAgreements = agreements.filter(a => a.signature_status === 'signed');
  const allAgreements = agreements;

  const filteredAgreements = (list: AgreementDocument[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(a =>
      a.investor_name?.toLowerCase().includes(q) ||
      a.investor_email?.toLowerCase().includes(q) ||
      a.document_name?.toLowerCase().includes(q)
    );
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; label: string }> = {
      pending: { bg: 'bg-yellow-500', label: 'Pending' },
      viewed: { bg: 'bg-blue-500', label: 'Viewed' },
      signed: { bg: 'bg-green-500', label: 'Signed' },
      rejected: { bg: 'bg-red-500', label: 'Rejected' },
      expired: { bg: 'bg-gray-500', label: 'Expired' }
    };
    const s = map[status] || { bg: 'bg-gray-500', label: status };
    return <Badge className={s.bg}>{s.label}</Badge>;
  };

  const getDocTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      acquisition_agreement: 'Acquisition Agreement',
      corporate_sublease: 'Corporate Sublease',
      corporate_agreement: 'Corporate Sublease',
      setup_services: 'Setup Services',
      third_party_seller: 'Third-Party Seller',
    };
    return labels[type] || type?.replace(/_/g, ' ');
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{pendingAgreements.length}</p>
                <p className="text-xs text-muted-foreground">Pending Signature</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{signedAgreements.length}</p>
                <p className="text-xs text-muted-foreground">Signed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{allAgreements.length}</p>
                <p className="text-xs text-muted-foreground">Total Agreements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{agreements.filter(a => a.signature_status === 'expired' || a.signature_status === 'rejected').length}</p>
                <p className="text-xs text-muted-foreground">Expired/Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input aria-label="Search by investor name or email"
              placeholder="Search by investor name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={fetchAgreements}><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <Button onClick={handleOpenSendModal} className="bg-[#d4a574] hover:bg-[#c49464]">
          <Plus className="w-4 h-4 mr-2" />Send Agreement
        </Button>
      </div>

      {/* Tabs - using plain buttons to avoid nested Tabs context issues */}
      <div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-4">
          {[
            { key: 'pending', label: 'Pending', count: pendingAgreements.length },
            { key: 'signed', label: 'Signed', count: 0 },
            { key: 'all', label: 'All Agreements', count: 0 }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key 
                  ? 'bg-white shadow-sm text-[#1a365d]' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && tab.count > 0 && (
                <Badge className="bg-yellow-500 text-xs">{tab.count}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* Agreement List */}
        <div className="space-y-4">
          {(() => {
            const list = activeTab === 'pending' ? pendingAgreements : activeTab === 'signed' ? signedAgreements : allAgreements;
            const filtered = filteredAgreements(list);
            
            if (filtered.length === 0) {
              return (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileSignature className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No {activeTab} agreements found</p>
                  </CardContent>
                </Card>
              );
            }

            return filtered.map(agreement => (
              <Card key={agreement.id} className={agreement.signature_status === 'pending' ? 'border-yellow-200' : ''}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{agreement.investor_name || 'Unknown Investor'}</span>
                        <span className="text-sm text-gray-500">{agreement.investor_email}</span>
                      </div>
                      <p className="font-medium text-gray-900">{agreement.document_name}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{getDocTypeLabel(agreement.document_type)}</Badge>
                        {getStatusBadge(agreement.signature_status)}
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Sent {new Date(agreement.sent_at || agreement.created_at).toLocaleDateString()}
                        </span>
                        {agreement.signed_at && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Signed {new Date(agreement.signed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {agreement.sent_by && (
                        <p className="text-xs text-gray-400 mt-1">Sent by: {agreement.sent_by}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleViewAgreement(agreement)}>
                        {(agreement.signature_status === 'pending' || agreement.signature_status === 'viewed') ? (
                          <><Edit2 className="w-4 h-4 mr-1" />Edit</>
                        ) : (
                          <><Eye className="w-4 h-4 mr-1" />View</>
                        )}
                      </Button>
                      {(agreement.signature_status === 'pending' || agreement.signature_status === 'viewed') && (
                        <Button variant="outline" size="sm" onClick={() => handleResendReminder(agreement)}>
                          <Send className="w-4 h-4 mr-1" />Remind
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ));
          })()}
        </div>
      </div>

      {/* Send Agreement Modal */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-[#d4a574]" />
              Send Agreement for Signature
            </DialogTitle>
            <DialogDescription>
              Select a template, load property details from a deal, customize the content, and send to an investor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Investor Search */}
            <div>
              <Label htmlFor="search-investor">Search Investor *</Label>
              <div className="relative">
                <Input id="search-investor"
                  placeholder="Type investor name or email..."
                  value={investorSearch}
                  onChange={(e) => handleSearchInvestors(e.target.value)}
                />
                {investorResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {investorResults.map((inv) => (
                      <button
                        key={inv.id}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => handleSelectInvestor(inv)}
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{inv.full_name}</p>
                          <p className="text-sm text-gray-500">{inv.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedInvestor && (
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Selected: {selectedInvestor.full_name} ({selectedInvestor.email})
                </p>
              )}
            </div>

            {/* Template Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Agreement Template</Label>
                <Select value={selectedTemplate} onValueChange={(val) => handleSelectTemplate(val, loadedDeal)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acquisition_agreement">Rental Arbitrage Acquisition Agreement</SelectItem>
                    <SelectItem value="corporate_sublease">Corporate Sublease Agreement</SelectItem>
                    <SelectItem value="setup_services">Property Setup Services Agreement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expires In</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Load from Deal */}
            <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#1a365d]" />
                  Property Details
                </Label>
                {loadedDeal && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleClearDeal}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2">
                    <X className="w-3.5 h-3.5 mr-1" />Clear Deal
                  </Button>
                )}
              </div>

              {loadedDeal ? (
                <div className="bg-white border border-green-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-green-800">Deal loaded — fields auto-filled</span>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">{loadedDeal.status}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 ml-6 text-xs text-gray-700">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span>{buildFullAddress(loadedDeal) || 'No address'}</span>
                    </div>
                    {loadedDeal.listing_title && (
                      <div className="flex items-start gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span>{loadedDeal.listing_title}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Bed className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{loadedDeal.bedrooms} bed / {loadedDeal.bathrooms} bath</span>
                    </div>
                    {loadedDeal.monthly_rent > 0 && (
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>${loadedDeal.monthly_rent.toLocaleString()}/mo rent</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-amber-700 ml-6 mt-1 flex items-center gap-1">
                    <Edit2 className="w-3 h-3" />
                    Review and edit the agreement content below before sending.
                  </p>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs text-gray-500 mb-2">
                    Auto-fill property address, rent, unit config, and other deal details from the pipeline.
                  </p>
                  <Button type="button" variant="outline" onClick={() => setShowDealPicker(true)}
                    className="border-[#d4a574] text-[#d4a574] hover:bg-[#d4a574]/10 hover:text-[#c49464]">
                    <Building2 className="w-4 h-4 mr-2" />
                    Load from Deal
                  </Button>
                </div>
              )}
            </div>

            {/* Document Name */}
            <div>
              <Label htmlFor="document-name">Document Name</Label>
              <Input id="document-name" value={agreementName} onChange={(e) => setAgreementName(e.target.value)} />
            </div>

            {/* Agreement Content Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" />
                  Agreement Content (Fully Editable)
                </Label>
                <div className="flex items-center gap-2">
                  {loadedDeal && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowDealPicker(true)}
                      className="text-xs text-[#d4a574] hover:text-[#c49464] h-6 px-2">
                      <RefreshCw className="w-3 h-3 mr-1" />Load Different Deal
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={handleDownloadPdf}
                    disabled={generatingPdf || !agreementContent.trim()}
                    className="text-xs h-6 px-2">
                    {generatingPdf ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                    Preview PDF
                  </Button>
                </div>
              </div>
              <textarea
                ref={contentTextareaRef}
                value={agreementContent}
                onChange={(e) => setAgreementContent(e.target.value)}
                rows={18}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[300px]"
                placeholder="Agreement content will appear here after selecting a template..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Edit any text directly. Remaining placeholders like [PROPERTY ADDRESS] can be filled manually or via "Load from Deal".
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
            <Button
              onClick={handleSendAgreement}
              disabled={sending || !selectedInvestor}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />Send for Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal Picker Modal (for Send modal) */}
      <DealPickerModal
        open={showDealPicker}
        onClose={() => setShowDealPicker(false)}
        onSelectDeal={handleLoadDeal}
      />

      {/* Deal Picker Modal (for View/Edit modal) */}
      <DealPickerModal
        open={showDealPickerForView}
        onClose={() => setShowDealPickerForView(false)}
        onSelectDeal={handleLoadDealForView}
      />

      {/* View/Edit Agreement Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? <Edit2 className="w-5 h-5 text-[#d4a574]" /> : <Eye className="w-5 h-5 text-blue-600" />}
              {viewingAgreement?.document_name}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              <span>{viewingAgreement?.investor_name}</span>
              <span className="text-gray-300">|</span>
              <span>{getDocTypeLabel(viewingAgreement?.document_type || '')}</span>
              {viewingAgreement?.signature_status === 'signed' && viewingAgreement.signed_at && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Signed on {new Date(viewingAgreement.signed_at).toLocaleDateString()}
                  </span>
                </>
              )}
              {getStatusBadge(viewingAgreement?.signature_status || 'pending')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            {isEditing ? (
              <>
                {/* Editing toolbar */}
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border flex-wrap">
                  <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <PenTool className="w-3 h-3" />
                    Editing Mode
                  </span>
                  <div className="flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowDealPickerForView(true)}
                    className="text-xs h-7 border-[#d4a574] text-[#d4a574] hover:bg-[#d4a574]/10">
                    <Building2 className="w-3 h-3 mr-1" />
                    Load Property from Deal
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadPdf}
                    disabled={generatingPdf || !editingContent.trim()}
                    className="text-xs h-7">
                    {generatingPdf ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                    Download PDF
                  </Button>
                </div>

                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  rows={24}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[400px]"
                />
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Editing this agreement will update what the investor sees when they sign.</p>
                    <p className="text-xs mt-1">Click "Save Changes" to persist your edits. You can also load property details from a deal or download as PDF.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Read-only view with toolbar */}
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border">
                  <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    View Mode
                  </span>
                  <div className="flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadPdf}
                    disabled={generatingPdf || !editingContent.trim()}
                    className="text-xs h-7">
                    {generatingPdf ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                    Download PDF
                  </Button>
                </div>
                <div className="bg-gray-50 rounded-lg p-6 border overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                    {viewingAgreement?.document_content || 'No content available'}
                  </pre>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setShowViewModal(false)}>Close</Button>
            {isEditing && (
              <Button onClick={handleSaveEdit} disabled={savingEdit} className="bg-[#d4a574] hover:bg-[#c49464]">
                {savingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
