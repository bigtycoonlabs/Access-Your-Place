import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, FileText, Eye, Save, Plus, Trash2, Copy,
  FileSignature, Key, ClipboardList, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';

interface DocumentTemplate {
  id: string;
  name: string;
  template_type: string;
  category: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const templateCategories = [
  { key: 'legal', label: 'Legal Documents', icon: FileSignature },
  { key: 'operational', label: 'Operational Documents', icon: ClipboardList },
  { key: 'access', label: 'Access & Transfer', icon: Key }
];

const templateTypes = [
  { key: 'acquisition_agreement', label: 'Rental Arbitrage Acquisition Agreement', category: 'legal' },
  { key: 'sublease_agreement', label: 'Corporate Sublease Agreement', category: 'legal' },
  { key: 'setup_services_agreement', label: 'Property Setup Services Agreement', category: 'legal' },
  { key: 'lease_assignment', label: 'Corporate Lease Assignment', category: 'legal' },
  { key: 'third_party_seller', label: 'Third-Party Seller Agreement', category: 'legal' },
  { key: 'inventory_list', label: 'Inventory Transfer List', category: 'operational' },
  { key: 'access_transfer', label: 'Access Transfer Document', category: 'operational' },
  { key: 'terms_of_service', label: 'Terms of Service', category: 'legal' },
  { key: 'privacy_policy', label: 'Privacy Policy', category: 'legal' }
];


// Real AYP agreement templates — templatized with {{variable}} placeholders
const PRELOADED_TEMPLATES: Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Rental Arbitrage Acquisition Agreement',
    template_type: 'acquisition_agreement',
    category: 'legal',
    is_active: true,
    variables: ['date_day', 'date_month_year', 'client_name', 'client_email', 'property_address', 'community_name', 'acquisition_type', 'acquisition_fee', 'company_rep_name', 'company_rep_title'],
    content: `RENTAL ARBITRAGE ACQUISITION AGREEMENT
Set Up Your Place LLC (DBA: Access Your Place / AYP / Your Place)
A Subsidiary of Cooper Family Inc.

THIS AGREEMENT is made and entered into on this {{date_day}} day of {{date_month_year}}, by and between:

THE COMPANY:
Set Up Your Place LLC (DBA: Access Your Place / AYP / Your Place)
1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
(Hereinafter referred to as "The Company" or "AYP")

AND

THE CLIENT:
Name/Entity: {{client_name}}
Email: {{client_email}}
(Hereinafter referred to as "Client" or "Operator")

1. THE TRANSACTION & OPERATION TYPE
The Client agrees to acquire the rights to establish or takeover a rental arbitrage operation (the "Operation") at the premises defined below. The Client acknowledges that they are purchasing a service package to secure this opportunity, not purchasing real estate.

1.1 The Property
 * Address: {{property_address}}
 * Community/Building Name: {{community_name}}

1.2 Acquisition Type
The Client acknowledges they are acquiring the following specific class of Operation:
 * {{acquisition_type}}

1.3 Acquisition Fee
The Client agrees to pay a non-refundable Acquisition Fee for the services rendered in securing this Operation.
 * Total Acquisition Fee: \${{acquisition_fee}} (PAID)
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
Print Name: {{company_rep_name}}
Title: {{company_rep_title}}

THE CLIENT:
{{client_name}}
Signature: __________________________
Print Name: __________________________
Date: __________________________`
  },
  {
    name: 'Corporate Sublease Agreement',
    template_type: 'sublease_agreement',
    category: 'legal',
    is_active: true,
    variables: ['effective_date', 'client_name', 'property_address', 'community_name', 'unit_configuration', 'lease_term_written', 'lease_term_months', 'possession_date', 'expiration_date', 'monthly_rent', 'prorated_rent', 'prorated_period_start', 'prorated_period_end', 'security_deposit', 'landlord_name', 'company_rep_name', 'company_rep_title'],
    content: `CORPORATE SUBLEASE AGREEMENT
Set Up Your Place LLC (DBA: Access Your Place)

THIS SUBLEASE AGREEMENT (the "Sublease") is made and entered into on this {{effective_date}} (the "Effective Date"), by and between:

SUBLESSOR:
Set Up Your Place LLC
1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
(Hereinafter referred to as "Sublessor" or "AYP")

AND

SUBLESSEE:
{{client_name}}
(Hereinafter referred to as "Sublessee" or "Client")

1. PREMISES
Sublessor hereby subleases to Sublessee, and Sublessee hereby rents from Sublessor, the fully furnished residential unit located at:
 * Address: {{property_address}} ({{community_name}})
 * Configuration: {{unit_configuration}}
 * Included Assets: Unit includes furnishings, smart lock, fresh linens, and household supplies (the "Inventory").

2. TERM
The term of this Sublease shall be for {{lease_term_written}} ({{lease_term_months}}) Months.
 * Agreement Effective Date: {{effective_date}} (Signing Date)
 * Possession & Rent Commencement Date: {{possession_date}} (Move-In Date)
 * Expiration Date: {{expiration_date}}

3. RENT & PAYMENTS

3.1 Monthly Rent
Sublessee agrees to pay monthly rent in the amount of \${{monthly_rent}}.
Rent is due on the 1st day of each month.

3.2 Prorated First Month Rent
For the first partial month of possession ({{prorated_period_start}} – {{prorated_period_end}}), Sublessee shall pay the prorated amount of \${{prorated_rent}} on or before the Move-In Date ({{possession_date}}).

3.3 Payment Instructions (Direct to Landlord)
Sublessee is directed to remit all Rent payments directly to the Master Landlord ({{landlord_name}}).
 * Accepted Methods: Zelle, Venmo, or Wire Transfer.
 * Proof of Payment: Sublessee must upload a screenshot/receipt of the payment to the AYP Staff Dashboard or email it to the Success Team monthly as proof of compliance.

4. SECURITY DEPOSIT
Upon execution of this Sublease, Sublessee shall deposit the sum of \${{security_deposit}} as a Security Deposit.
 * Refund: The deposit will be refunded within 30 days of vacancy, provided the Premises and Inventory are returned in the same condition as received, reasonable wear and tear excepted.

5. UTILITIES (ALL-INCLUSIVE)
The Monthly Rent of \${{monthly_rent}} includes:
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
Print Name: {{company_rep_name}}
Title: {{company_rep_title}}

SUBLESSEE:
{{client_name}}
Signature: __________________________
Print Name: __________________________
Title: __________________________`
  },
  {
    name: 'Property Setup Services Agreement',
    template_type: 'setup_services_agreement',
    category: 'legal',
    is_active: true,
    variables: ['effective_date', 'client_name', 'client_email', 'property_address', 'community_name', 'setup_package', 'setup_fee', 'estimated_completion', 'company_rep_name', 'company_rep_title'],
    content: `PROPERTY SETUP SERVICES AGREEMENT
Set Up Your Place LLC (DBA: Access Your Place / AYP / Your Place)
A Subsidiary of Cooper Family Inc.

THIS AGREEMENT is made and entered into on {{effective_date}}, by and between:

THE COMPANY:
Set Up Your Place LLC (DBA: Access Your Place / AYP / Your Place)
1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
(Hereinafter referred to as "The Company" or "AYP")

AND

THE CLIENT:
Name/Entity: {{client_name}}
Email: {{client_email}}
(Hereinafter referred to as "Client" or "Operator")

1. SCOPE OF SETUP SERVICES
AYP agrees to provide full-service property setup for the Client's rental arbitrage operation at the following premises:
 * Address: {{property_address}}
 * Community/Building Name: {{community_name}}

1.1 Setup Package
The Client has selected the following setup package:
 * {{setup_package}}

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
The Client agrees to pay a Setup Fee of \${{setup_fee}} for the services described above.

2.2 Payment Schedule
 * 50% due upon execution of this Agreement (deposit)
 * 50% due upon completion of setup and Client walkthrough approval

2.3 Additional Costs
The Setup Fee covers labor, coordination, and project management. Furniture, fixtures, and equipment (FF&E) costs are billed separately based on the approved design plan and budget.

3. TIMELINE & COMPLETION

3.1 Estimated Completion
AYP will make reasonable efforts to complete the property setup within {{estimated_completion}} business days of receiving the initial deposit and property access.

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
Print Name: {{company_rep_name}}
Title: {{company_rep_title}}

THE CLIENT:
{{client_name}}
Signature: __________________________
Print Name: __________________________
Date: __________________________`
  }
];


// Helper: convert preloaded templates to full DocumentTemplate objects
function getPreloadedAsTemplates(): DocumentTemplate[] {
  return PRELOADED_TEMPLATES.map((t, i) => ({
    ...t,
    id: `preloaded-${i}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
}

export function DocumentTemplatesTab() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>(() => getPreloadedAsTemplates());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('legal');
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();
  
  // CRITICAL: Track whether we've already attempted seeding to prevent infinite loops
  const seedAttemptedRef = useRef(false);
  const loadAttemptedRef = useRef(false);

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    template_type: '',
    category: 'legal',
    content: ''
  });

  const loadTemplates = useCallback(async (skipSeed = false) => {
    // Prevent duplicate calls
    if (loadAttemptedRef.current && !skipSeed) {
      setLoading(false);
      return;
    }
    loadAttemptedRef.current = true;
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'list_documents' }
      });
      
      if (error) {
        console.warn('Template API error, using preloaded templates:', error);
        setTemplates(getPreloadedAsTemplates());
        setLoading(false);
        return;
      }
      
      if (data?.templates && Array.isArray(data.templates) && data.templates.length > 0) {
        // API returned real templates - use them
        setTemplates(data.templates);
      } else if (!skipSeed && !seedAttemptedRef.current) {
        // API returned empty but we haven't tried seeding yet
        // Show preloaded templates immediately so user sees content
        setTemplates(getPreloadedAsTemplates());
        // Attempt to seed in background (fire-and-forget, NO recursive loadTemplates call)
        seedAttemptedRef.current = true;
        seedTemplatesInBackground();
      } else {
        // API returned empty and we already tried seeding - just show preloaded
        setTemplates(getPreloadedAsTemplates());
      }
    } catch (err) {
      console.warn('Failed to load templates from API, using preloaded:', err);
      setTemplates(getPreloadedAsTemplates());
    }
    
    setLoading(false);
  }, []);

  // Background seeding - does NOT call loadTemplates again (breaks the infinite loop)
  const seedTemplatesInBackground = async () => {
    try {
      const staffSession = localStorage.getItem('staffSession');
      const staffData = staffSession ? JSON.parse(staffSession) : {};
      
      let successCount = 0;
      for (const template of PRELOADED_TEMPLATES) {
        try {
          await supabase.functions.invoke('manage-email-templates', {
            body: {
              action: 'create_document',
              ...template,
              created_by: staffData.id
            }
          });
          successCount++;
        } catch {
          // Individual template seed failure is OK
        }
      }
      
      if (successCount > 0) {
        // Try to reload from API now that we've seeded
        try {
          const { data } = await supabase.functions.invoke('manage-email-templates', {
            body: { action: 'list_documents' }
          });
          if (data?.templates && Array.isArray(data.templates) && data.templates.length > 0) {
            setTemplates(data.templates);
          }
        } catch {
          // Keep showing preloaded templates
        }
      }
    } catch (err) {
      console.warn('Background seed failed:', err);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Manual seed button handler
  const handleManualSeed = async () => {
    setSeeding(true);
    seedAttemptedRef.current = false; // Allow retry
    try {
      const staffSession = localStorage.getItem('staffSession');
      const staffData = staffSession ? JSON.parse(staffSession) : {};
      
      let successCount = 0;
      for (const template of PRELOADED_TEMPLATES) {
        try {
          await supabase.functions.invoke('manage-email-templates', {
            body: {
              action: 'create_document',
              ...template,
              created_by: staffData.id
            }
          });
          successCount++;
        } catch {
          // Continue
        }
      }
      
      if (successCount > 0) {
        toast({ title: 'Templates Seeded', description: `${successCount} templates saved to database.` });
        // Try to reload
        loadAttemptedRef.current = false;
        seedAttemptedRef.current = true;
        await loadTemplates(true);
      } else {
        toast({ title: 'Seed Failed', description: 'Could not save templates to database. Preloaded templates are still available.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Manual seed failed:', err);
      toast({ title: 'Seed Failed', variant: 'destructive' });
    }
    setSeeding(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    if (selected.id.startsWith('preloaded-')) {
      toast({ title: 'Saving preloaded template...', description: 'Creating in database first.' });
      const staffSession = localStorage.getItem('staffSession');
      const staffData = staffSession ? JSON.parse(staffSession) : {};
      try {
        const { data } = await supabase.functions.invoke('manage-email-templates', {
          body: { action: 'create_document', name: selected.name, template_type: selected.template_type, category: selected.category, content: selected.content, variables: selected.variables, is_active: selected.is_active, created_by: staffData.id }
        });
        if (data?.success && data?.template?.id) {
          // Update the local template with the real ID
          setTemplates(prev => prev.map(t => t.id === selected.id ? { ...selected, id: data.template.id } : t));
          setSelected({ ...selected, id: data.template.id });
          toast({ title: 'Template saved to database!' });
        } else {
          // Save locally even if API fails
          setTemplates(prev => prev.map(t => t.id === selected.id ? { ...selected, updated_at: new Date().toISOString() } : t));
          toast({ title: 'Template updated locally' });
        }
      } catch { 
        setTemplates(prev => prev.map(t => t.id === selected.id ? { ...selected, updated_at: new Date().toISOString() } : t));
        toast({ title: 'Template updated locally (API unavailable)' }); 
      }
      return;
    }
    
    setSaving(true);
    try {
      const staffSession = localStorage.getItem('staffSession');
      const staffData = staffSession ? JSON.parse(staffSession) : {};
      const { data } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'update_document', template_id: selected.id, name: selected.name, content: selected.content, variables: selected.variables, is_active: selected.is_active, updated_by: staffData.id }
      });
      if (data?.success) { 
        toast({ title: 'Template saved!' }); 
        // Update locally
        setTemplates(prev => prev.map(t => t.id === selected.id ? { ...selected, updated_at: new Date().toISOString() } : t));
      } else {
        toast({ title: 'Save may have failed', description: 'Check and try again.', variant: 'destructive' });
      }
    } catch { toast({ title: 'Error saving', variant: 'destructive' }); }
    setSaving(false);
  };

  const handlePreview = () => {
    if (!selected) return;
    let preview = selected.content;
    const sampleData: Record<string, string> = {
      // Rental Arbitrage Acquisition Agreement variables
      date_day: '26th',
      date_month_year: 'February, 2026',
      client_name: 'Sample Client LLC',
      client_email: 'client@example.com',
      property_address: '1234 Main Street, Unit 5, Tampa, FL 33609',
      community_name: 'Sunset Apartments',
      acquisition_type: '[X] Furnished Operation (Turn-Key): A property already furnished by the landlord or AYP, ready for immediate operation.',
      acquisition_fee: '2,000.00',
      company_rep_name: 'AYP Representative',
      company_rep_title: 'Acquisition Manager',
      // Corporate Sublease Agreement variables
      effective_date: 'February 26, 2026',
      unit_configuration: 'Studio / 1 Bathroom',
      lease_term_written: 'Twelve',
      lease_term_months: '12',
      possession_date: 'April 4, 2026',
      expiration_date: 'April 3, 2027',
      monthly_rent: '1,950.00',
      prorated_rent: '1,755.00',
      prorated_period_start: 'April 4, 2026',
      prorated_period_end: 'April 30, 2026',
      security_deposit: '500.00',
      landlord_name: 'Sunset Apartments Management',
      // Setup Services Agreement variables
      setup_package: 'Full-Service Turn-Key Setup (Furniture, Technology, Photography, Listing Creation)',
      setup_fee: '3,500.00',
      estimated_completion: '14',
    };
    Object.entries(sampleData).forEach(([key, val]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    });
    setPreviewContent(preview);
    setPreviewOpen(true);
  };


  const handleCreate = async () => {
    if (!newTemplate.name || !newTemplate.template_type || !newTemplate.content) {
      toast({ title: 'Fill in all required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const staffSession = localStorage.getItem('staffSession');
      const staffData = staffSession ? JSON.parse(staffSession) : {};
      const variableMatches = newTemplate.content.match(/{{(\w+)}}/g) || [];
      const variables = [...new Set(variableMatches.map(v => v.replace(/[{}]/g, '')))];
      
      const { data } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'create_document', ...newTemplate, variables, created_by: staffData.id }
      });
      
      const newId = data?.template?.id || `local-${Date.now()}`;
      const createdTemplate: DocumentTemplate = {
        id: newId,
        name: newTemplate.name,
        template_type: newTemplate.template_type,
        category: newTemplate.category,
        content: newTemplate.content,
        variables,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setTemplates(prev => [...prev, createdTemplate]);
      toast({ title: 'Template created!' });
      setCreateOpen(false);
      setNewTemplate({ name: '', template_type: '', category: 'legal', content: '' });
    } catch { 
      // Even if API fails, add locally
      const variableMatches = newTemplate.content.match(/{{(\w+)}}/g) || [];
      const variables = [...new Set(variableMatches.map(v => v.replace(/[{}]/g, '')))];
      const createdTemplate: DocumentTemplate = {
        id: `local-${Date.now()}`,
        name: newTemplate.name,
        template_type: newTemplate.template_type,
        category: newTemplate.category,
        content: newTemplate.content,
        variables,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setTemplates(prev => [...prev, createdTemplate]);
      toast({ title: 'Template created locally' });
      setCreateOpen(false);
      setNewTemplate({ name: '', template_type: '', category: 'legal', content: '' });
    }
    setSaving(false);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Delete this template?')) return;
    if (templateId.startsWith('preloaded-') || templateId.startsWith('local-')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setSelected(null);
      toast({ title: 'Template removed' });
      return;
    }
    try {
      const { data } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'delete_document', template_id: templateId }
      });
      if (data?.success) { 
        toast({ title: 'Template deleted' }); 
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        setSelected(null); 
      }
    } catch { toast({ title: 'Error deleting', variant: 'destructive' }); }
  };

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/{{(\w+)}}/g) || [];
    return [...new Set(matches.map(v => v.replace(/[{}]/g, '')))];
  };

  const getTemplatesForCategory = (category: string) => templates.filter(t => t.category === category);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
        <span className="ml-3 text-gray-500">Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#d4a574]" />
                Document Templates
              </CardTitle>
              <CardDescription>
                Manage legal agreements, operational documents, and transfer forms. {templates.length} template{templates.length !== 1 ? 's' : ''} available.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleManualSeed} disabled={seeding}>
                {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync to Database
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="bg-[#d4a574] hover:bg-[#c49464]">
                <Plus className="w-4 h-4 mr-2" />New Template
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Template count summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {templateCategories.map(cat => {
          const count = getTemplatesForCategory(cat.key).length;
          const Icon = cat.icon;
          return (
            <Card 
              key={cat.key} 
              className={`cursor-pointer hover:border-[#d4a574] transition ${activeCategory === cat.key ? 'border-[#d4a574] bg-amber-50 shadow-sm' : ''}`} 
              onClick={() => setActiveCategory(cat.key)}
            >
              <CardContent className="pt-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeCategory === cat.key ? 'bg-[#d4a574]/20' : 'bg-[#1a365d]/10'}`}>
                  <Icon className={`w-5 h-5 ${activeCategory === cat.key ? 'text-[#d4a574]' : 'text-[#1a365d]'}`} />
                </div>
                <div>
                  <p className="font-semibold text-lg">{count}</p>
                  <p className="text-xs text-gray-500">{cat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Category navigation - using plain buttons instead of nested Radix Tabs */}
      <div className="space-y-4">
        <nav className="flex gap-1 p-1 bg-muted rounded-lg w-fit" role="tablist" aria-label="Template categories">
          {templateCategories.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeCategory === cat.key 
                    ? 'bg-white shadow-sm text-[#1a365d]' 
                    : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                }`}
                role="tab"
                aria-selected={activeCategory === cat.key}
                aria-controls={`category-panel-${cat.key}`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {cat.label}
              </button>
            );
          })}
        </nav>

        {/* Category content panels */}
        {templateCategories.map(cat => (
          <div 
            key={cat.key}
            id={`category-panel-${cat.key}`}
            role="tabpanel"
            hidden={activeCategory !== cat.key}
          >
            {activeCategory === cat.key && (
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Template list sidebar */}
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Templates</CardTitle>
                    <CardDescription className="text-xs">
                      {getTemplatesForCategory(cat.key).length} template{getTemplatesForCategory(cat.key).length !== 1 ? 's' : ''} in this category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {getTemplatesForCategory(cat.key).length === 0 ? (
                          <div className="text-center py-8">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-gray-500">No templates in this category</p>
                          </div>
                        ) : (
                          getTemplatesForCategory(cat.key).map(template => (
                            <div
                              key={template.id}
                              className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-[#d4a574] hover:shadow-sm ${
                                selected?.id === template.id ? 'border-[#d4a574] bg-amber-50 shadow-sm' : ''
                              }`}
                              onClick={() => setSelected({ ...template })}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected({ ...template }); } }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">{template.name}</h4>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {templateTypes.find(t => t.key === template.template_type)?.label || template.template_type}
                                  </p>
                                  {template.id.startsWith('preloaded-') && (
                                    <Badge variant="outline" className="text-[10px] mt-1 border-amber-300 text-amber-700">Built-in</Badge>
                                  )}
                                </div>
                                {template.is_active ? (
                                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 ml-2" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Template editor */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">{selected ? selected.name : 'Select a Template'}</CardTitle>
                    {selected && (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Active</Label>
                          <Switch checked={selected.is_active} onCheckedChange={(v) => setSelected({ ...selected, is_active: v })} />
                        </div>
                        {selected.id.startsWith('preloaded-') && (
                          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                            Built-in Template
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selected ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="template-name-2">Template Name</Label>
                          <Input id="template-name-2" value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="template-content-2">Template Content</Label>
                          <Textarea id="template-content-2"
                            value={selected.content}
                            onChange={(e) => {
                              const newContent = e.target.value;
                              setSelected({ ...selected, content: newContent, variables: extractVariables(newContent) });
                            }}
                            rows={16}
                            className="mt-1 font-mono text-sm"
                          />
                        </div>
                        <div>
                          <Label>Detected Variables ({selected.variables?.length || 0})</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selected.variables?.length > 0 ? (
                              selected.variables.map(v => (
                                <Badge key={v} variant="outline" className="font-mono text-xs cursor-pointer hover:bg-gray-100"
                                  onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); toast({ title: `Copied {{${v}}}` }); }}>
                                  {`{{${v}}}`}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-sm text-gray-500">No variables detected. Use {"{{variable_name}}"} syntax.</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 pt-4 border-t">
                          <Button onClick={handleSave} disabled={saving} className="bg-[#1a365d] hover:bg-[#2d4a7c]">
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save
                          </Button>
                          <Button variant="outline" onClick={handlePreview}><Eye className="w-4 h-4 mr-2" />Preview</Button>
                          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(selected.content); toast({ title: 'Content copied to clipboard' }); }}>
                            <Copy className="w-4 h-4 mr-2" />Copy
                          </Button>
                          <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(selected.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />Delete
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <FileText className="w-12 h-12 mb-4 text-gray-300" />
                        <p className="font-medium">Select a template to edit</p>
                        <p className="text-sm text-gray-400 mt-1">Click on a template from the list on the left</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Template Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>Create a new document template. Use {"{{variable_name}}"} for dynamic fields.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name *</Label>
              <Input id="template-name" value={newTemplate.name} onChange={(e) => setNewTemplate(t => ({ ...t, name: e.target.value }))} placeholder="e.g., Custom Agreement" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template Type *</Label>
                <Select value={newTemplate.template_type} onValueChange={(v) => setNewTemplate(t => ({ ...t, template_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {templateTypes.map(type => (<SelectItem key={type.key} value={type.key}>{type.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate(t => ({ ...t, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {templateCategories.map(cat => (<SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="template-content">Template Content *</Label>
              <Textarea id="template-content" value={newTemplate.content} onChange={(e) => setNewTemplate(t => ({ ...t, content: e.target.value }))} rows={12} className="font-mono text-sm" placeholder="Enter content with {{variable}} placeholders..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-[#d4a574] hover:bg-[#c49464]">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />Document Preview</DialogTitle>
            <DialogDescription>Preview with sample data filled in</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="bg-white p-8 border rounded-lg">
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{previewContent}</pre>
            </div>
          </ScrollArea>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
