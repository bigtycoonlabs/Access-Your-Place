import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AcquisitionAssignmentModal } from './AcquisitionAssignmentModal';
import { SetupTasksManager } from './SetupTasksManager';
import { SOPHelpButton } from './SOPHelpButton';
import { TraineeCertificationProgress } from './TraineeCertificationProgress';
import { AMSubmitDealModal } from './AMSubmitDealModal';
import { AMMessageDialog, AMNotesDialog, AMDocumentsDialog, AMSendDealDialog } from './AMInvestorActionsDialogs';
import { AMActivityFeed } from './AMActivityFeed';
import { AMSubmittedDealsTracker } from './AMSubmittedDealsTracker';



import { 
  Loader2, Search, Building2, Users, FileText, DollarSign,
  CheckCircle, Clock, AlertTriangle, Send, Eye, Edit,
  UserCheck, Briefcase, Shield, Star, Filter, RefreshCw,
  MapPin, Calendar, TrendingUp, MessageSquare, Bot, Lock,
  Receipt, Mail, ExternalLink, Copy, MoreHorizontal, Phone,
  Home, Settings, Rocket, ListTodo, ChevronRight, ArrowRight,
  Target, Zap, Bell, CreditCard, FileCheck, Truck, ClipboardCheck,
  GripVertical, Plus, Award, FolderOpen, Activity
} from 'lucide-react';



interface Props {
  staffId: string;
  staffRole: string;
  staffRoles?: string[];
  isSuccessManager?: boolean;
  staffName?: string;
}


interface Deal {
  id: string;
  address: string;
  title?: string;
  city: string;
  state: string;
  zip_code?: string;
  status: string;
  deal_type: string;
  asking_price: number;
  monthly_revenue: number;
  monthly_rent?: number;
  verification_status: string;
  assigned_manager_id?: string;
  assigned_investor_id?: string;
  workflow_stage?: string;
  acquisition_fee_paid?: boolean;
  created_at: string;
}

interface Investor {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  account_funded: boolean;
  funding_tier: string;
  assigned_acquisition_manager_id?: string;
  assigned_acquisition_manager_name?: string;
  assigned_setup_manager_id?: string;
  assigned_setup_manager_name?: string;
  priority_investor: boolean;
  discovery_call_completed?: boolean;
  can_purchase_deals?: boolean;
  created_at: string;
}

interface AcquisitionRequest {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  property_id: string;
  property_address: string;
  status: string;
  request_type: string;
  created_at: string;
}

const WORKFLOW_STAGES = [
  { value: 'payment_received', label: 'Payment', icon: DollarSign, color: 'bg-green-500', order: 1 },
  { value: 'application_process', label: 'Application', icon: FileText, color: 'bg-blue-500', order: 2 },
  { value: 'lease_review', label: 'Lease Review', icon: FileCheck, color: 'bg-purple-500', order: 3 },
  { value: 'setup_furniture', label: 'Furniture', icon: Home, color: 'bg-orange-500', order: 4 },
  { value: 'setup_software', label: 'Software', icon: Settings, color: 'bg-indigo-500', order: 5 },
  { value: 'setup_utilities', label: 'Utilities', icon: Zap, color: 'bg-teal-500', order: 6 },
  { value: 'vendor_matching', label: 'Vendors', icon: Users, color: 'bg-pink-500', order: 7 },
  { value: 'marketing_launch', label: 'Marketing', icon: Rocket, color: 'bg-yellow-500', order: 8 },
  { value: 'completed', label: 'Complete', icon: CheckCircle, color: 'bg-emerald-600', order: 9 }
];

export function AcquisitionManagerDashboard({ staffId, staffRole, staffRoles = [], isSuccessManager = false, staffName = '' }: Props) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [acquisitionRequests, setAcquisitionRequests] = useState<AcquisitionRequest[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<any>(null);
  const [showTasksModal, setShowTasksModal] = useState<any>(null);
  const [showRequestDetailModal, setShowRequestDetailModal] = useState<any>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [processing, setProcessing] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  
  // Lead management state
  const [investorSearch, setInvestorSearch] = useState('');
  const [investorSearchResults, setInvestorSearchResults] = useState<any[]>([]);
  const [searchingInvestors, setSearchingInvestors] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', company: '', notes: '' });
  const [addingLead, setAddingLead] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [selfAssigning, setSelfAssigning] = useState<string | null>(null);
  
  // My Leads list state
  const [myLeads, setMyLeads] = useState<any[]>([]);
  const [myLeadsStats, setMyLeadsStats] = useState({ total: 0, pending: 0, sent: 0, signed_up: 0, failed: 0 });
  const [loadingMyLeads, setLoadingMyLeads] = useState(false);

  
  // Investor view toggle state
  const [investorViewMode, setInvestorViewMode] = useState<'my' | 'all'>(isSuccessManager ? 'all' : 'my');
  const [investorSearchFilter, setInvestorSearchFilter] = useState('');

  // Submit Deal Modal state
  const [showSubmitDealModal, setShowSubmitDealModal] = useState(false);

  // Investor action dialog states
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showDocumentsDialog, setShowDocumentsDialog] = useState(false);
  const [showSendDealDialog, setShowSendDealDialog] = useState(false);
  const [actionInvestor, setActionInvestor] = useState<Investor | null>(null);

  // Derive staff display name
  const staffDisplayName = staffName || 'Acquisition Manager';

  
  const { toast } = useToast();

  const [invoiceForm, setInvoiceForm] = useState({
    investor_id: '',
    amount: '',
    description: '',
    invoice_type: 'acquisition_fee',
    property_id: '',
    notes: '',
    due_days: '7'
  });

  // Check if user has acquisition manager permissions
  const hasAcquisitionAccess = isSuccessManager || 
    staffRole === 'acquisition_managers' || 
    staffRole === 'setup_managers' ||
    staffRoles.includes('acquisition_managers') ||
    staffRoles.includes('setup_managers');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all deals
      const dealsRes = await supabase.functions.invoke('get-properties', {
        body: { action: 'get_all', include_private: true }
      });
      
      if (dealsRes.data?.properties) {
        setDeals(dealsRes.data.properties);
      }

      // Fetch ALL investors (let frontend handle filtering)
      // Handle both data and error responses (edge function may return non-200)
      const investorsRes = await supabase.functions.invoke('manage-investor-admin', {
        body: { 
          action: 'get_all_investors',
          limit: 500
        }
      });

      // Extract data - handle case where response is in error field due to non-200 status
      let investorData = investorsRes.data;
      if (!investorData?.investors && investorsRes.error) {
        // Try to extract from error (non-200 responses put body in error)
        try {
          if (typeof investorsRes.error === 'object' && investorsRes.error.investors) {
            investorData = investorsRes.error;
          } else if (typeof investorsRes.error === 'object' && investorsRes.error.message) {
            const parsed = JSON.parse(investorsRes.error.message);
            if (parsed.investors) investorData = parsed;
          }
        } catch { /* not parseable */ }
      }

      if (investorData?.investors) {
        console.log(`[AM Dashboard] Loaded ${investorData.investors.length} investors`);
        setInvestors(investorData.investors);
      } else {
        console.warn('[AM Dashboard] No investors returned from API. Raw data:', investorsRes.data, 'Raw error:', investorsRes.error);
      }

      // Fetch acquisition requests
      const requestsRes = await supabase.functions.invoke('manage-acquisition-requests', {
        body: { 
          action: 'get_requests',
          assigned_manager_id: isSuccessManager ? undefined : staffId
        }
      });

      if (requestsRes.data?.requests) {
        setAcquisitionRequests(requestsRes.data.requests);
      }

      // Fetch staff members for assignment (success managers only)
      if (isSuccessManager) {
        const staffRes = await supabase.functions.invoke('manage-staff', {
          body: { action: 'get_staff' }
        });
        if (staffRes.data?.staff) {
          setStaffMembers(staffRes.data.staff.filter((s: any) => 
            s.department === 'acquisition_managers' || 
            s.department === 'setup_managers' ||
            s.roles?.includes('acquisition_managers') ||
            s.roles?.includes('setup_managers')
          ));
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    }
    setLoading(false);
  }, [staffId, isSuccessManager, toast]);


  useEffect(() => {
    if (hasAcquisitionAccess) {
      fetchData();
    }
  }, [hasAcquisitionAccess, fetchData]);

  // Compute filtered investors based on view mode
  const myInvestors = investors.filter(i => i.assigned_acquisition_manager_id === staffId);
  const displayedInvestors = isSuccessManager 
    ? (investorViewMode === 'my' ? myInvestors : investors)
    : (investorViewMode === 'all' ? investors : myInvestors);
  
  // Apply search filter on displayed investors
  const filteredDisplayedInvestors = investorSearchFilter 
    ? displayedInvestors.filter(inv => {
        const q = investorSearchFilter.toLowerCase();
        return inv.full_name?.toLowerCase().includes(q) ||
          inv.email?.toLowerCase().includes(q) ||
          inv.phone?.includes(investorSearchFilter);
      })
    : displayedInvestors;

  // Verify deal and notify investor
  const handleVerifyDeal = async (dealId: string, verified: boolean) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-property', {
        body: {
          property_id: dealId,
          verification_status: verified ? 'verified' : 'rejected',
          verification_notes: verificationNotes,
          verified_by: staffId,
          verified_at: new Date().toISOString()
        }
      });

      if (data?.success) {
        const deal = deals.find(d => d.id === dealId);
        if (deal?.assigned_investor_id) {
          await supabase.functions.invoke('investor-email-notifications', {
            body: {
              action: 'deal_status_update',
              investor_id: deal.assigned_investor_id,
              deal_id: dealId,
              status: verified ? 'verified' : 'rejected',
              notes: verificationNotes
            }
          });
        }

        toast({
          title: verified ? 'Deal Verified' : 'Deal Rejected',
          description: `The deal has been ${verified ? 'verified and approved' : 'rejected'}. Investor notified.`
        });
        setShowVerifyModal(false);
        setVerificationNotes('');
        fetchData();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update verification status',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  // Send invoice and notify investor
  const handleSendInvoice = async () => {
    if (!invoiceForm.investor_id || !invoiceForm.amount) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-acquisition-emails', {
        body: {
          action: 'send_invoice',
          investor_id: invoiceForm.investor_id,
          amount: parseFloat(invoiceForm.amount),
          description: invoiceForm.description,
          invoice_type: invoiceForm.invoice_type,
          property_id: invoiceForm.property_id || undefined,
          sent_by: staffId
        }
      });

      if (data?.success) {
        toast({
          title: 'Invoice Sent',
          description: 'The invoice has been sent to the investor via email.'
        });
        setShowInvoiceModal(false);
        setInvoiceForm({ investor_id: '', amount: '', description: '', invoice_type: 'acquisition_fee', property_id: '', notes: '', due_days: '7' });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to send invoice',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  // Assign manager to investor and notify
  const handleAssignManager = async (investorId: string, managerId: string, managerType: 'acquisition' | 'setup') => {
    if (!isSuccessManager) {
      toast({
        title: 'Permission Denied',
        description: 'Only Success Managers can assign managers',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      const manager = staffMembers.find(s => s.id === managerId);
      const managerName = manager ? `${manager.first_name || ''} ${manager.last_name || ''}`.trim() : '';
      const investor = investors.find(i => i.id === investorId);
      
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: {
          action: managerType === 'acquisition' ? 'assign_acquisition_manager' : 'assign_setup_manager',
          investor_id: investorId,
          manager_id: managerId,
          manager_name: managerName,
          manager_type: managerType
        }
      });

      if (data?.success) {
        // Notify the investor about their new manager
        await supabase.functions.invoke('send-acquisition-emails', {
          body: {
            action: 'manager_assigned',
            investor_id: investorId,
            manager_type: managerType,
            manager_name: managerName
          }
        });

        // Notify the assigned AM/SM via staff messaging that they have a new investor
        if (manager?.email) {
          try {
            await supabase.functions.invoke('investor-messaging', {
              body: {
                action: 'send_staff_message',
                from_staff_id: staffId,
                to_staff_id: managerId,
                subject: `New Investor Assigned: ${investor?.full_name || 'Unknown'}`,
                message: `You have been assigned as the ${managerType === 'acquisition' ? 'Acquisition Manager' : 'Setup Manager'} for ${investor?.full_name || 'an investor'} (${investor?.email || ''}).\n\nPlease review their account and reach out to introduce yourself.\n\nAssigned by: ${staffDisplayName}`
              }
            });
          } catch (notifyErr) {
            console.warn('[AM Dashboard] Failed to notify assigned manager via messaging:', notifyErr);
          }
        }

        // Send email notification to the assigned AM/SM via am-submit-deal edge function
        try {
          await supabase.functions.invoke('am-submit-deal', {
            body: {
              action: 'notify_am_investor_assigned',
              am_staff_id: managerId,
              investor_name: investor?.full_name || 'Unknown',
              investor_email: investor?.email || '',
              investor_id: investorId,
              assigned_by_name: staffDisplayName
            }
          });
        } catch (emailErr) {
          console.warn('[AM Dashboard] Failed to send AM assignment email notification:', emailErr);
        }

        toast({
          title: 'Manager Assigned',
          description: `${managerType === 'acquisition' ? 'Acquisition' : 'Setup'} manager assigned. Both investor and manager notified via email.`
        });
        fetchData();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to assign manager',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };



  // Advance workflow stage and notify investor
  const advanceWorkflowStage = async (propertyId: string, currentStage: string) => {
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-acquisition-workflow', { 
        body: { action: 'advance_stage', property_id: propertyId, stage: currentStage } 
      });

      if (data?.success) {
        const deal = deals.find(d => d.id === propertyId);
        if (deal?.assigned_investor_id) {
          const nextStage = WORKFLOW_STAGES.find(s => s.value === data.next_stage);
          await supabase.functions.invoke('investor-email-notifications', {
            body: {
              action: 'workflow_stage_update',
              investor_id: deal.assigned_investor_id,
              property_id: propertyId,
              stage: data.next_stage,
              stage_name: nextStage?.label || data.next_stage
            }
          });
        }

        toast({ 
          title: 'Stage Advanced', 
          description: `Moved to ${data.next_stage || 'next stage'}. Investor notified.` 
        });
        fetchData();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to advance stage', variant: 'destructive' });
    }
    setProcessing(false);
  };

  // Record payment and notify investor
  const recordPayment = async (propertyId: string, amount: number = 2500) => {
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-acquisition-workflow', { 
        body: { action: 'record_payment', property_id: propertyId, data: { amount } } 
      });

      if (data?.success) {
        const deal = deals.find(d => d.id === propertyId);
        if (deal?.assigned_investor_id) {
          await supabase.functions.invoke('investor-email-notifications', {
            body: {
              action: 'payment_received',
              investor_id: deal.assigned_investor_id,
              property_id: propertyId,
              amount
            }
          });
        }

        toast({ title: 'Payment Recorded', description: 'Payment recorded and investor notified.' });
        fetchData();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to record payment', variant: 'destructive' });
    }
    setProcessing(false);
  };

  // Run Penny AI analysis
  const runPennyAnalysis = async (dealId: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-property-analysis', {
        body: { property_id: dealId }
      });

      if (data?.analysis) {
        toast({
          title: 'Penny AI Analysis Complete',
          description: 'The property analysis has been updated.'
        });
        fetchData();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to run Penny AI analysis',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  // Search investors on platform
  const handleInvestorSearch = async () => {
    if (investorSearch.trim().length < 2) {
      toast({ title: 'Enter at least 2 characters', variant: 'destructive' });
      return;
    }
    setSearchingInvestors(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'search_investors', query: investorSearch.trim() }
      });
      if (error) throw error;
      setInvestorSearchResults(data?.investors || []);
      if (data?.investors?.length === 0) {
        toast({ title: 'No Results', description: 'No investors found matching your search.' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSearchingInvestors(false);
  };

  // Self-assign as AM for an investor
  const handleSelfAssign = async (investorId: string) => {
    setSelfAssigning(investorId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'self_assign_am', investor_id: investorId, staff_id: staffId }
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Assigned!', description: data.message });
        // Refresh search results
        if (investorSearch.trim().length >= 2) {
          const refreshRes = await supabase.functions.invoke('manage-investor-admin', {
            body: { action: 'search_investors', query: investorSearch.trim() }
          });
          setInvestorSearchResults(refreshRes.data?.investors || []);
        }
        fetchData();
      } else {
        throw new Error(data?.error || 'Failed to assign');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSelfAssigning(null);
  };

  // Filter deals
  const filteredDeals = deals.filter(deal => {
    const matchesSearch = deal.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || deal.verification_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Get deals in workflow (assigned to investors)
  const workflowDeals = deals.filter(d => d.assigned_investor_id);
  const filteredWorkflowDeals = workflowFilter === 'all' 
    ? workflowDeals 
    : workflowDeals.filter(d => d.workflow_stage === workflowFilter);

  // Unassigned approved deals
  const unassignedDeals = deals.filter(d => !d.assigned_investor_id && d.status === 'approved');

  // Stats
  const stats = {
    pendingVerification: deals.filter(d => d.verification_status === 'pending').length,
    verifiedDeals: deals.filter(d => d.verification_status === 'verified').length,
    activeWorkflows: workflowDeals.filter(d => d.workflow_stage !== 'completed').length,
    completedWorkflows: workflowDeals.filter(d => d.workflow_stage === 'completed').length,
    activeRequests: acquisitionRequests.filter(r => r.status === 'pending' || r.status === 'in_progress').length,
    fundedInvestors: investors.filter(i => i.account_funded).length,
    priorityInvestors: investors.filter(i => i.priority_investor).length,
    myInvestors: myInvestors.length,
    allInvestors: investors.length,
    readyToPurchase: investors.filter(i => i.can_purchase_deals).length
  };

  if (!hasAcquisitionAccess) {
    return (
      <Card className="bg-red-50 border-red-200" role="alert">
        <CardContent className="py-12 text-center">
          <Lock className="w-12 h-12 mx-auto text-red-400 mb-4" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-red-800">Access Denied</h3>
          <p className="text-red-600 mt-2">
            You don't have permission to access the Acquisition Manager Dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading dashboard">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" aria-hidden="true" />
        <span className="sr-only">Loading Acquisition Manager Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Acquisition Manager Dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1a365d] flex items-center gap-2">
            <Target className="w-6 h-6 text-[#d4a574]" aria-hidden="true" />
            Acquisition Manager Dashboard
          </h2>
          <p className="text-gray-600">
            {isSuccessManager ? 'Full access to all acquisition operations' : 'Manage your assigned investors and deals'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap" role="toolbar" aria-label="Dashboard actions">
          <SOPHelpButton
            sopKey="Acquisition Process"
            category="Acquisition Process"
            userRole={isSuccessManager ? 'Success_Team' : 'Acquisition_Manager'}
            buttonText="Acquisition SOP"
          />
          <Button variant="outline" onClick={fetchData} aria-label="Refresh dashboard data">
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowSubmitDealModal(true)}
            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white"
            aria-label="Submit a property to deal flow"
          >
            <Building2 className="w-4 h-4 mr-2" aria-hidden="true" />
            Submit Property
          </Button>
          <Button onClick={() => setShowInvoiceModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]" aria-label="Send an invoice">
            <Send className="w-4 h-4 mr-2" aria-hidden="true" />
            Send Invoice
          </Button>
        </div>

      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4" role="list" aria-label="Dashboard statistics">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200" role="listitem">
          <CardContent className="pt-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-amber-600 mb-1" aria-hidden="true" />
            <p className="text-2xl font-bold text-amber-700" aria-label={`${stats.pendingVerification} pending verification`}>{stats.pendingVerification}</p>
            <p className="text-xs text-amber-600">Pending Verification</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200" role="listitem">
          <CardContent className="pt-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto text-green-600 mb-1" aria-hidden="true" />
            <p className="text-2xl font-bold text-green-700" aria-label={`${stats.verifiedDeals} verified deals`}>{stats.verifiedDeals}</p>
            <p className="text-xs text-green-600">Verified Deals</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200" role="listitem">
          <CardContent className="pt-4 text-center">
            <Briefcase className="w-6 h-6 mx-auto text-blue-600 mb-1" aria-hidden="true" />
            <p className="text-2xl font-bold text-blue-700" aria-label={`${stats.activeWorkflows} active workflows`}>{stats.activeWorkflows}</p>
            <p className="text-xs text-blue-600">Active Workflows</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200" role="listitem">
          <CardContent className="pt-4 text-center">
            <Users className="w-6 h-6 mx-auto text-purple-600 mb-1" aria-hidden="true" />
            <p className="text-2xl font-bold text-purple-700" aria-label={`${stats.myInvestors} of your investors`}>{stats.myInvestors}</p>
            <p className="text-xs text-purple-600">My Investors</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#d4a574]/20 to-[#d4a574]/30 border-[#d4a574]" role="listitem">
          <CardContent className="pt-4 text-center">
            <Star className="w-6 h-6 mx-auto text-[#d4a574] mb-1" aria-hidden="true" />
            <p className="text-2xl font-bold text-[#1a365d]" aria-label={`${stats.readyToPurchase} ready to purchase`}>{stats.readyToPurchase}</p>
            <p className="text-xs text-[#1a365d]">Ready to Purchase</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white shadow flex-wrap h-auto p-1" aria-label="Dashboard navigation tabs">
          <TabsTrigger value="overview" className="flex items-center gap-2" aria-label="Overview tab">
            <TrendingUp className="w-4 h-4" aria-hidden="true" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2" aria-label="Activity Feed tab">
            <Activity className="w-4 h-4" aria-hidden="true" />
            <span>Activity Feed</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2" aria-label="My Leads tab">
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>My Leads</span>
          </TabsTrigger>
          <TabsTrigger value="my-deals" className="flex items-center gap-2" aria-label="My Submitted Deals tracker tab">
            <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
            <span>My Deals</span>
          </TabsTrigger>



          <TabsTrigger value="trainees" className="flex items-center gap-2" aria-label={isSuccessManager ? 'All Trainees tab' : 'My Trainees tab'}>
            <Award className="w-4 h-4" aria-hidden="true" />
            <span>{isSuccessManager ? 'All Trainees' : 'My Trainees'}</span>
          </TabsTrigger>
          <TabsTrigger value="workflow" className="flex items-center gap-2" aria-label={`Workflow tab, ${stats.activeWorkflows} active`}>
            <Briefcase className="w-4 h-4" aria-hidden="true" />
            <span>Workflow</span>
            {stats.activeWorkflows > 0 && (
              <Badge className="ml-1 bg-blue-500" aria-hidden="true">{stats.activeWorkflows}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deals" className="flex items-center gap-2" aria-label={`Deals tab, ${stats.pendingVerification} pending`}>
            <Building2 className="w-4 h-4" aria-hidden="true" />
            <span>Deals</span>
            {stats.pendingVerification > 0 && (
              <Badge className="ml-1 bg-amber-500" aria-hidden="true">{stats.pendingVerification}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="investors" className="flex items-center gap-2" aria-label={`Investors tab, ${stats.myInvestors} assigned to you`}>
            <Users className="w-4 h-4" aria-hidden="true" />
            <span>Investors</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2" aria-label={`Requests tab, ${stats.activeRequests} active`}>
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>Requests</span>
            {stats.activeRequests > 0 && (
              <Badge className="ml-1 bg-purple-500" aria-hidden="true">{stats.activeRequests}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="certification" className="flex items-center gap-2" aria-label={isSuccessManager ? 'AM Certification tab' : 'My Certification tab'}>
            <Shield className="w-4 h-4" aria-hidden="true" />
            <span>{isSuccessManager ? 'AM Certification' : 'My Certification'}</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6" role="tabpanel" aria-label="Overview">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4" role="list" aria-label="Quick actions">
                <Button variant="outline" onClick={() => setActiveTab('deals')} className="h-auto py-4 flex flex-col items-center" role="listitem" aria-label={`Verify Deals, ${stats.pendingVerification} pending`}>
                  <Building2 className="w-6 h-6 mb-2 text-amber-600" aria-hidden="true" />
                  <span>Verify Deals</span>
                  <span className="text-xs text-gray-500">{stats.pendingVerification} pending</span>
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('workflow')} className="h-auto py-4 flex flex-col items-center" role="listitem" aria-label={`Manage Workflows, ${stats.activeWorkflows} active`}>
                  <Briefcase className="w-6 h-6 mb-2 text-blue-600" aria-hidden="true" />
                  <span>Manage Workflows</span>
                  <span className="text-xs text-gray-500">{stats.activeWorkflows} active</span>
                </Button>
                <Button variant="outline" onClick={() => setShowInvoiceModal(true)} className="h-auto py-4 flex flex-col items-center" role="listitem" aria-label="Send Invoice">
                  <DollarSign className="w-6 h-6 mb-2 text-green-600" aria-hidden="true" />
                  <span>Send Invoice</span>
                  <span className="text-xs text-gray-500">Custom or acquisition</span>
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('investors')} className="h-auto py-4 flex flex-col items-center" role="listitem" aria-label={`View Investors, ${stats.myInvestors} assigned`}>
                  <Users className="w-6 h-6 mb-2 text-purple-600" aria-hidden="true" />
                  <span>View Investors</span>
                  <span className="text-xs text-gray-500">{stats.myInvestors} assigned</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Ready to Assign Section */}
          {unassignedDeals.length > 0 && (
            <Card className="border-green-300 bg-green-50" role="region" aria-label="Deals ready to assign">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-800 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" aria-hidden="true" />
                  Ready to Assign ({unassignedDeals.length})
                </CardTitle>
                <CardDescription className="text-green-700">
                  Approved deals waiting for investor assignment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-3">
                  {unassignedDeals.slice(0, 6).map(deal => (
                    <Card key={deal.id} className="p-3 bg-white">
                      <p className="font-semibold text-sm">{deal.title || deal.address}</p>
                      <p className="text-xs text-gray-600">{deal.city}, {deal.state}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          ${deal.monthly_rent?.toLocaleString() || deal.monthly_revenue?.toLocaleString()}/mo
                        </Badge>
                      </div>
                      <Button 
                        size="sm" 
                        className="mt-2 w-full bg-green-600 hover:bg-green-700"
                        onClick={() => setShowAssignModal(deal)}
                        aria-label={`Assign investor to ${deal.title || deal.address}`}
                      >
                        Assign Investor
                      </Button>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card role="region" aria-label="Pending verifications">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" aria-hidden="true" />
                  Pending Verifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deals.filter(d => d.verification_status === 'pending').slice(0, 5).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending verifications</p>
                ) : (
                  <div className="space-y-3" role="list">
                    {deals.filter(d => d.verification_status === 'pending').slice(0, 5).map(deal => (
                      <div key={deal.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50" role="listitem">
                        <div>
                          <p className="font-medium text-sm">{deal.title || deal.address}</p>
                          <p className="text-xs text-gray-500">{deal.city}, {deal.state}</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedDeal(deal);
                            setShowVerifyModal(true);
                          }}
                          aria-label={`Review ${deal.title || deal.address}`}
                        >
                          <Eye className="w-4 h-4 mr-1" aria-hidden="true" />
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card role="region" aria-label="Active workflows">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-500" aria-hidden="true" />
                  Active Workflows
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workflowDeals.filter(d => d.workflow_stage !== 'completed').slice(0, 5).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No active workflows</p>
                ) : (
                  <div className="space-y-3" role="list">
                    {workflowDeals.filter(d => d.workflow_stage !== 'completed').slice(0, 5).map(deal => {
                      const stage = WORKFLOW_STAGES.find(s => s.value === deal.workflow_stage);
                      const StageIcon = stage?.icon || Clock;
                      const stageIdx = WORKFLOW_STAGES.findIndex(s => s.value === deal.workflow_stage);
                      const progressVal = ((stageIdx + 1) / WORKFLOW_STAGES.length) * 100;
                      
                      return (
                        <div key={deal.id} className="p-3 border rounded-lg hover:bg-gray-50" role="listitem">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">{deal.title || deal.address}</p>
                              <p className="text-xs text-gray-500">{deal.city}, {deal.state}</p>
                            </div>
                            <Badge className={stage?.color}>
                              <StageIcon className="w-3 h-3 mr-1" aria-hidden="true" />
                              {stage?.label}
                            </Badge>
                          </div>
                          <Progress value={progressVal} className="h-1.5" aria-label={`Workflow progress: ${Math.round(progressVal)}%`} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Feed Tab */}
        <TabsContent value="activity" className="space-y-6" role="tabpanel" aria-label="Activity Feed">
          <AMActivityFeed
            staffId={staffId}
            staffName={staffName || ''}
            onNavigateToInvestor={(id) => {
              const inv = investors.find(i => i.id === id);
              if (inv) {
                setSelectedInvestor(inv);
                setActiveTab('leads');
              }
            }}
          />
        </TabsContent>


        {/* My Leads Tab */}
        {/* My Leads Tab */}
        <TabsContent value="leads" className="space-y-4" role="tabpanel" aria-label="My Leads">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                  My Leads
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    setLoadingMyLeads(true);
                    try {
                      const { data } = await supabase.functions.invoke('send-investor-invitation', {
                        body: { action: 'get_my_leads', staff_id: staffId }
                      });
                      if (data?.leads) { setMyLeads(data.leads); setMyLeadsStats(data.stats || { total: 0, pending: 0, sent: 0, signed_up: 0, failed: 0 }); }
                    } catch (err) { console.error('Failed to load leads:', err); }
                    setLoadingMyLeads(false);
                  }}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${loadingMyLeads ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button onClick={() => setShowAddLeadModal(true)} className="bg-[#d4a574] hover:bg-[#c49464]" aria-label="Add a new lead">
                    <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                    Add New Lead
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Add leads and invite them to join the platform. Once they register, find them in the Investors tab and assign yourself as their AM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lead Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center border">
                  <p className="text-xl font-bold text-gray-800">{myLeadsStats.total}</p>
                  <p className="text-xs text-gray-500">Total Leads</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
                  <p className="text-xl font-bold text-amber-700">{myLeadsStats.pending}</p>
                  <p className="text-xs text-amber-600">Pending</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                  <p className="text-xl font-bold text-blue-700">{myLeadsStats.sent}</p>
                  <p className="text-xs text-blue-600">Invited</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                  <p className="text-xl font-bold text-green-700">{myLeadsStats.signed_up}</p>
                  <p className="text-xs text-green-600">Signed Up</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                  <p className="text-xl font-bold text-red-700">{myLeadsStats.failed}</p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              </div>

              {/* Leads List */}
              {loadingMyLeads ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" />
                </div>
              ) : myLeads.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Users className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No leads added yet</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Add New Lead" to get started, or click Refresh to load your leads.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={async () => {
                    setLoadingMyLeads(true);
                    try {
                      const { data } = await supabase.functions.invoke('send-investor-invitation', {
                        body: { action: 'get_my_leads', staff_id: staffId }
                      });
                      if (data?.leads) { setMyLeads(data.leads); setMyLeadsStats(data.stats || { total: 0, pending: 0, sent: 0, signed_up: 0, failed: 0 }); }
                    } catch (err) { console.error('Failed:', err); }
                    setLoadingMyLeads(false);
                  }}>
                    <RefreshCw className="w-4 h-4 mr-1" /> Load My Leads
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {myLeads.map((lead: any) => {
                    const isSignedUp = lead.signed_up_at || lead.investor_id;
                    const isSent = lead.status === 'sent' || lead.delivery_status === 'delivered' || lead.delivery_status === 'queued';
                    const isFailed = lead.status === 'failed' || lead.delivery_status === 'failed';
                    const isPending = lead.status === 'pending';

                    return (
                      <div key={lead.id} className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors ${isSignedUp ? 'border-l-4 border-l-green-500 bg-green-50/30' : ''}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                            isSignedUp ? 'bg-green-500' : isSent ? 'bg-blue-500' : isPending ? 'bg-amber-500' : 'bg-gray-400'
                          }`}>
                            {lead.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{lead.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {lead.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />{lead.email}</span>}
                              {lead.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{lead.phone}</span>}
                            </div>
                            {lead.company && <p className="text-xs text-gray-400">{lead.company}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isSignedUp ? (
                            <Badge className="bg-green-500 text-white text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" /> Signed Up
                            </Badge>
                          ) : isSent ? (
                            <Badge className="bg-blue-500 text-white text-xs">
                              <Send className="w-3 h-3 mr-1" /> Invited
                            </Badge>
                          ) : isFailed ? (
                            <Badge className="bg-red-500 text-white text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Failed
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500 text-white text-xs">
                              <Clock className="w-3 h-3 mr-1" /> Pending
                            </Badge>
                          )}
                          {/* Resend / Send for pending or failed */}
                          {(isPending || isFailed) && (lead.email || lead.phone) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={sendingInvite === lead.id}
                              onClick={async () => {
                                setSendingInvite(lead.id);
                                try {
                                  if (isPending) {
                                    const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
                                      body: { action: 'send_pending', contact_ids: [lead.id], channel: 'both' }
                                    });
                                    if (error) throw error;
                                    if (data?.sent > 0) {
                                      toast({ title: 'Invitation Sent!', description: `Invitation sent to ${lead.name}` });
                                      // Refresh leads
                                      const { data: refreshData } = await supabase.functions.invoke('send-investor-invitation', {
                                        body: { action: 'get_my_leads', staff_id: staffId }
                                      });
                                      if (refreshData?.leads) { setMyLeads(refreshData.leads); setMyLeadsStats(refreshData.stats || myLeadsStats); }
                                    } else {
                                      throw new Error(data?.results?.[0]?.error || 'Send failed');
                                    }
                                  } else {
                                    const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
                                      body: { action: 'resend', invitation_id: lead.id }
                                    });
                                    if (error) throw error;
                                    if (data?.success) {
                                      toast({ title: 'Resent!', description: `Invitation resent to ${lead.name}` });
                                      const { data: refreshData } = await supabase.functions.invoke('send-investor-invitation', {
                                        body: { action: 'get_my_leads', staff_id: staffId }
                                      });
                                      if (refreshData?.leads) { setMyLeads(refreshData.leads); setMyLeadsStats(refreshData.stats || myLeadsStats); }
                                    }
                                  }
                                } catch (err: any) {
                                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                }
                                setSendingInvite(null);
                              }}
                            >
                              {sendingInvite === lead.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                              {isPending ? 'Send' : 'Resend'}
                            </Button>
                          )}
                          {isSent && !isSignedUp && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={sendingInvite === lead.id}
                              onClick={async () => {
                                setSendingInvite(lead.id);
                                try {
                                  const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
                                    body: { action: 'resend', invitation_id: lead.id }
                                  });
                                  if (error) throw error;
                                  if (data?.success) {
                                    toast({ title: 'Resent!', description: `Invitation resent to ${lead.name}` });
                                  }
                                } catch (err: any) {
                                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                }
                                setSendingInvite(null);
                              }}
                            >
                              {sendingInvite === lead.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                              Resend
                            </Button>
                          )}
                          <span className="text-[10px] text-gray-400 hidden md:inline">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Lead Modal */}
          <Dialog open={showAddLeadModal} onOpenChange={setShowAddLeadModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                  Add New Lead
                </DialogTitle>
                <DialogDescription>
                  Enter your lead's details. You can save them as pending or send an invitation immediately.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="lead-name">Full Name *</Label>
                    <Input
                      id="lead-name"
                      value={newLead.name}
                      onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                      placeholder="John Doe"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead-email">Email</Label>
                    <Input
                      id="lead-email"
                      type="email"
                      value={newLead.email}
                      onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead-phone">Phone</Label>
                    <Input
                      id="lead-phone"
                      type="tel"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead-company">Company</Label>
                    <Input
                      id="lead-company"
                      value={newLead.company}
                      onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                      placeholder="ABC Properties LLC"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead-notes">Notes</Label>
                    <Input
                      id="lead-notes"
                      value={newLead.notes}
                      onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                      placeholder="Met at conference..."
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setShowAddLeadModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  disabled={addingLead || !newLead.name}
                  onClick={async () => {
                    if (!newLead.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
                    setAddingLead(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
                        body: {
                          action: 'add_pending',
                          staff_id: staffId,
                          staff_name: staffDisplayName,
                          contacts: [{ name: newLead.name, phone: newLead.phone?.replace(/\D/g, '') || undefined, email: newLead.email || undefined, company: newLead.company || undefined, notes: newLead.notes || undefined }]
                        }
                      });
                      if (error) throw error;
                      if (data?.added > 0) {
                        toast({ title: 'Lead Saved', description: `${newLead.name} added to pending list` });
                        setNewLead({ name: '', phone: '', email: '', company: '', notes: '' });
                        setShowAddLeadModal(false);
                        // Refresh leads list
                        const { data: refreshData } = await supabase.functions.invoke('send-investor-invitation', {
                          body: { action: 'get_my_leads', staff_id: staffId }
                        });
                        if (refreshData?.leads) { setMyLeads(refreshData.leads); setMyLeadsStats(refreshData.stats || myLeadsStats); }
                      }
                    } catch (err: any) {
                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                    }
                    setAddingLead(false);
                  }}
                  aria-label="Save lead as pending"
                >
                  {addingLead && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                  Save as Pending
                </Button>
                <Button
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                  disabled={addingLead || !newLead.name || (!newLead.phone && !newLead.email)}
                  onClick={async () => {
                    if (!newLead.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
                    if (!newLead.phone && !newLead.email) { toast({ title: 'Phone or email required to send invitation', variant: 'destructive' }); return; }
                    setAddingLead(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
                        body: {
                          channel: 'both',
                          staff_id: staffId,
                          staff_name: staffDisplayName,
                          contacts: [{ name: newLead.name, phone: newLead.phone?.replace(/\D/g, '') || undefined, email: newLead.email || undefined, company: newLead.company || undefined }]
                        }
                      });
                      if (error) throw error;
                      if (data?.sent > 0) {
                        toast({ title: 'Invitation Sent!', description: `Invitation sent to ${newLead.name}` });
                        setNewLead({ name: '', phone: '', email: '', company: '', notes: '' });
                        setShowAddLeadModal(false);
                        // Refresh leads list
                        const { data: refreshData } = await supabase.functions.invoke('send-investor-invitation', {
                          body: { action: 'get_my_leads', staff_id: staffId }
                        });
                        if (refreshData?.leads) { setMyLeads(refreshData.leads); setMyLeadsStats(refreshData.stats || myLeadsStats); }
                      } else {
                        throw new Error(data?.results?.[0]?.error || 'Failed to send invitation');
                      }
                    } catch (err: any) {
                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                    }
                    setAddingLead(false);
                  }}
                  aria-label="Save lead and send invitation"
                >
                  {addingLead && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                  <Send className="w-4 h-4 mr-2" aria-hidden="true" />
                  Save & Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* My Submitted Deals Tracker Tab */}
        <TabsContent value="my-deals" className="space-y-4" role="tabpanel" aria-label="My Submitted Deals">
          <AMSubmittedDealsTracker
            staffId={staffId}
            staffName={staffDisplayName}
          />
        </TabsContent>


        {/* Trainees Tab */}
        <TabsContent value="trainees" className="space-y-4" role="tabpanel" aria-label="Trainees">
          <TraineeCertificationProgress
            staffId={staffId}
            staffRole={staffRole}
            isSuccessManager={isSuccessManager}
            isTrainee={false}
            compact={false}
          />
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-4" role="tabpanel" aria-label="Workflow Management">
          <div className="flex gap-2 overflow-x-auto pb-2" role="toolbar" aria-label="Workflow stage filters">
            <Button 
              variant={workflowFilter === 'all' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setWorkflowFilter('all')}
              aria-pressed={workflowFilter === 'all'}
              aria-label={`Show all workflows, ${workflowDeals.length} total`}
            >
              All ({workflowDeals.length})
            </Button>
            {WORKFLOW_STAGES.map(s => {
              const count = workflowDeals.filter(d => d.workflow_stage === s.value).length;
              return (
                <Button 
                  key={s.value} 
                  variant={workflowFilter === s.value ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setWorkflowFilter(s.value)}
                  className="whitespace-nowrap"
                  aria-pressed={workflowFilter === s.value}
                  aria-label={`Filter by ${s.label}, ${count} deals`}
                >
                  {s.label} ({count})
                </Button>
              );
            })}
          </div>

          <div className="space-y-4" role="list" aria-label="Workflow deals">
            {filteredWorkflowDeals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p className="text-gray-500">No deals in workflow</p>
                  <p className="text-sm text-gray-400 mt-1">Assign investors to deals to start workflows</p>
                </CardContent>
              </Card>
            ) : (
              filteredWorkflowDeals.map(deal => {
                const stage = WORKFLOW_STAGES.find(s => s.value === deal.workflow_stage);
                const StageIcon = stage?.icon || Clock;
                const stageIdx = WORKFLOW_STAGES.findIndex(s => s.value === deal.workflow_stage);
                
                return (
                  <Card key={deal.id} role="listitem">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={stage?.color}>
                              <StageIcon className="w-3 h-3 mr-1" aria-hidden="true" />
                              {stage?.label}
                            </Badge>
                            {deal.acquisition_fee_paid && (
                              <Badge className="bg-green-600">
                                <DollarSign className="w-3 h-3 mr-1" aria-hidden="true" />
                                Paid
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold">{deal.title || deal.address}</h3>
                          <p className="text-sm text-gray-600">{deal.city}, {deal.state} {deal.zip_code}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {stageIdx >= 3 && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setShowTasksModal(deal)}
                              aria-label={`View tasks for ${deal.title || deal.address}`}
                            >
                              <ListTodo className="w-4 h-4 mr-1" aria-hidden="true" />
                              Tasks
                            </Button>
                          )}
                          {!deal.acquisition_fee_paid && deal.workflow_stage === 'payment_received' && (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => recordPayment(deal.id)}
                              disabled={processing}
                              aria-label={`Mark payment received for ${deal.title || deal.address}`}
                            >
                              <DollarSign className="w-4 h-4 mr-1" aria-hidden="true" />
                              Mark Paid
                            </Button>
                          )}
                          {deal.workflow_stage !== 'completed' && (
                            <Button 
                              size="sm"
                              onClick={() => advanceWorkflowStage(deal.id, deal.workflow_stage || '')}
                              disabled={processing}
                              aria-label={`Advance workflow stage for ${deal.title || deal.address}`}
                            >
                              <ArrowRight className="w-4 h-4 mr-1" aria-hidden="true" />
                              Advance
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1" role="progressbar" aria-valuenow={stageIdx + 1} aria-valuemin={1} aria-valuemax={WORKFLOW_STAGES.length} aria-label={`Workflow stage ${stageIdx + 1} of ${WORKFLOW_STAGES.length}`}>
                        {WORKFLOW_STAGES.map((s, i) => (
                          <div 
                            key={s.value} 
                            className={`h-2 flex-1 rounded ${
                              i < stageIdx ? 'bg-green-500' : 
                              i === stageIdx ? 'bg-blue-500' : 'bg-gray-200'
                            }`} 
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value="deals" className="space-y-4" role="tabpanel" aria-label="Deals Management">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <Input aria-label="Search deals by address or city"
                placeholder="Search deals by address or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search deals"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48" aria-label="Filter deals by verification status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending Verification</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3" role="list" aria-label="Deals list" aria-live="polite">
            {filteredDeals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p className="text-gray-500">No deals found</p>
                </CardContent>
              </Card>
            ) : (
              filteredDeals.map(deal => (
                <Card key={deal.id} className="hover:shadow-md transition-shadow" role="listitem">
                  <CardContent className="pt-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#1a365d]/10 rounded-lg" aria-hidden="true">
                          <Building2 className="w-6 h-6 text-[#1a365d]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-semibold">{deal.title || deal.address}</h4>
                            <Badge variant="outline" className={
                              deal.deal_type === 'yp_approved' ? 'border-green-500 text-green-700' : 'border-blue-500 text-blue-700'
                            }>
                              {deal.deal_type === 'yp_approved' ? 'YP Approved' : 'Third-Party'}
                            </Badge>
                            <Badge className={
                              deal.verification_status === 'verified' ? 'bg-green-500' :
                              deal.verification_status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                            }>
                              {deal.verification_status || 'Pending'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{deal.city}, {deal.state}</p>
                          <div className="flex gap-4 mt-2 text-sm text-gray-500">
                            <span>Price: ${deal.asking_price?.toLocaleString() || 'N/A'}</span>
                            <span>Revenue: ${deal.monthly_revenue?.toLocaleString() || deal.monthly_rent?.toLocaleString() || 'N/A'}/mo</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runPennyAnalysis(deal.id)}
                          disabled={processing}
                          aria-label={`Run Penny AI analysis on ${deal.title || deal.address}`}
                        >
                          <Bot className="w-4 h-4 mr-1" aria-hidden="true" />
                          Penny AI
                        </Button>
                        {deal.verification_status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedDeal(deal);
                              setShowVerifyModal(true);
                            }}
                            className="bg-[#d4a574] hover:bg-[#c49464]"
                            aria-label={`Verify ${deal.title || deal.address}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" aria-hidden="true" />
                            Verify
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Investors Tab - With Toggle */}
        <TabsContent value="investors" className="space-y-4" role="tabpanel" aria-label="Investor Management">
          {/* Investor View Toggle */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-[#1a365d] flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                    Investor View
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {isSuccessManager 
                      ? 'As a Success Manager, you can view all investors on the platform.'
                      : 'Toggle between your assigned investors and all platform investors.'}
                  </p>
                </div>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="Investor view toggle">
                  <button
                    className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                      investorViewMode === 'my' 
                        ? 'bg-[#1a365d] text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setInvestorViewMode('my')}
                    aria-pressed={investorViewMode === 'my'}
                    aria-label={`My Investors, ${stats.myInvestors} investors`}
                  >
                    <UserCheck className="w-4 h-4" aria-hidden="true" />
                    My Investors
                    <Badge className={`ml-1 ${investorViewMode === 'my' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {stats.myInvestors}
                    </Badge>
                  </button>
                  <button
                    className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors border-l ${
                      investorViewMode === 'all' 
                        ? 'bg-[#1a365d] text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setInvestorViewMode('all')}
                    aria-pressed={investorViewMode === 'all'}
                    aria-label={`All Investors, ${stats.allInvestors} investors`}
                  >
                    <Users className="w-4 h-4" aria-hidden="true" />
                    All Investors
                    <Badge className={`ml-1 ${investorViewMode === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {stats.allInvestors}
                    </Badge>
                  </button>
                </div>
              </div>

              {/* Search within investors */}
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <Input aria-label="Filter investors by name, email, or phone"
                    placeholder="Filter investors by name, email, or phone..."
                    value={investorSearchFilter}
                    onChange={(e) => setInvestorSearchFilter(e.target.value)}
                    className="pl-10"
                    aria-label="Filter displayed investors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Find Client on Platform - Server-side search (merged from former Find Client tab) */}
          <Card className="border-[#d4a574]/30 bg-gradient-to-r from-amber-50/50 to-white">
            <CardContent className="pt-4 pb-4">
              <h4 className="font-semibold text-[#1a365d] flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
                Find Client on Platform
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Search by name, email, or phone to find any investor on the platform and assign yourself as their AM.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <Input aria-label="Search investors by name, email, or phone"
                    placeholder="Search investors by name, email, or phone..."
                    value={investorSearch}
                    onChange={(e) => setInvestorSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInvestorSearch()}
                    className="pl-10"
                    aria-label="Search for investors on the platform"
                  />
                </div>
                <Button
                  onClick={handleInvestorSearch}
                  disabled={searchingInvestors || investorSearch.trim().length < 2}
                  className="bg-[#d4a574] hover:bg-[#c49464]"
                  aria-label="Search investors"
                >
                  {searchingInvestors ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
                </Button>
              </div>

              {/* Search Results */}
              {investorSearchResults.length > 0 && (
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto" role="list" aria-label="Platform search results">
                  <p className="text-xs text-gray-500 font-medium">{investorSearchResults.length} result(s) found</p>
                  {investorSearchResults.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-2 bg-white border rounded-lg text-sm" role="listitem">
                      <div>
                        <p className="font-medium">{inv.full_name}</p>
                        <p className="text-xs text-gray-500">{inv.email} {inv.phone ? `• ${inv.phone}` : ''}</p>
                        {inv.assigned_acquisition_manager_name && (
                          <p className="text-xs text-blue-600">AM: {inv.assigned_acquisition_manager_name}</p>
                        )}
                      </div>
                      {!inv.assigned_acquisition_manager_id ? (
                        <Button
                          size="sm"
                          className="bg-[#d4a574] hover:bg-[#c49464]"
                          disabled={selfAssigning === inv.id}
                          onClick={() => handleSelfAssign(inv.id)}
                          aria-label={`Assign yourself as AM for ${inv.full_name}`}
                        >
                          {selfAssigning === inv.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserCheck className="w-3 h-3 mr-1" />}
                          Assign to Me
                        </Button>
                      ) : inv.assigned_acquisition_manager_id === staffId ? (
                        <Badge className="bg-[#1a365d] text-white text-xs">My Client</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Assigned</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>


          {/* Investor List */}
          <div className="space-y-3" role="list" aria-label={`${investorViewMode === 'my' ? 'My' : 'All'} investors, ${filteredDisplayedInvestors.length} shown`} aria-live="polite">
            {filteredDisplayedInvestors.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p className="text-gray-500">
                    {investorViewMode === 'my' 
                      ? 'No investors assigned to you yet' 
                      : investorSearchFilter 
                        ? 'No investors match your search' 
                        : 'No investors found'}
                  </p>
                  {investorViewMode === 'my' && stats.allInvestors > 0 && (
                    <p className="text-sm text-gray-400 mt-2">
                      Use the platform search below to find investors and assign yourself, or switch to "All Investors" to browse.
                    </p>

                  )}
                </CardContent>
              </Card>
            ) : (
              filteredDisplayedInvestors.map(investor => {
                const isMyInvestor = investor.assigned_acquisition_manager_id === staffId;
                return (
                  <Card key={investor.id} role="listitem" className={`hover:shadow-md transition-shadow ${investor.priority_investor ? 'border-[#d4a574]' : ''} ${isMyInvestor ? 'border-l-4 border-l-[#1a365d]' : ''}`}>
                    <CardContent className="pt-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${investor.priority_investor ? 'bg-gradient-to-br from-[#d4a574] to-[#c49464]' : 'bg-gradient-to-br from-[#1a365d] to-[#2d4a7c]'}`} aria-hidden="true">
                            {investor.full_name?.charAt(0) || 'I'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-semibold">{investor.full_name}</h4>
                              {isMyInvestor && (
                                <Badge className="bg-[#1a365d] text-white text-xs">
                                  <UserCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                                  My Client
                                </Badge>
                              )}
                              {investor.priority_investor && (
                                <Badge className="bg-[#d4a574]">
                                  <Star className="w-3 h-3 mr-1" aria-hidden="true" />
                                  Priority
                                </Badge>
                              )}
                              {investor.can_purchase_deals ? (
                                <Badge className="bg-green-500">Ready to Purchase</Badge>
                              ) : investor.account_funded ? (
                                <Badge className="bg-blue-500">Funded</Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-500 text-amber-700">Not Funded</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{investor.email}</p>
                            {investor.phone && <p className="text-sm text-gray-500">{investor.phone}</p>}
                            <div className="flex gap-4 mt-1 text-xs text-gray-500">
                              {investor.assigned_acquisition_manager_name && (
                                <span className="text-blue-600">
                                  AM: {investor.assigned_acquisition_manager_name}
                                </span>
                              )}
                              {investor.assigned_setup_manager_name && (
                                <span className="text-emerald-600">
                                  SM: {investor.assigned_setup_manager_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {/* AM Investor Action Buttons */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => {
                              setActionInvestor(investor);
                              setShowMessageDialog(true);
                            }}
                            aria-label={`Message ${investor.full_name}`}
                          >
                            <MessageSquare className="w-4 h-4 mr-1" aria-hidden="true" />
                            Message
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() => {
                              setActionInvestor(investor);
                              setShowNotesDialog(true);
                            }}
                            aria-label={`View notes for ${investor.full_name}`}
                          >
                            <FileText className="w-4 h-4 mr-1" aria-hidden="true" />
                            Notes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-purple-600 border-purple-200 hover:bg-purple-50"
                            onClick={() => {
                              setActionInvestor(investor);
                              setShowDocumentsDialog(true);
                            }}
                            aria-label={`View documents for ${investor.full_name}`}
                          >
                            <FolderOpen className="w-4 h-4 mr-1" aria-hidden="true" />
                            Docs
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => {
                              setActionInvestor(investor);
                              setShowSendDealDialog(true);
                            }}
                            aria-label={`Send a deal to ${investor.full_name}`}
                          >
                            <Building2 className="w-4 h-4 mr-1" aria-hidden="true" />
                            Send Deal
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInvestor(investor);
                              setInvoiceForm(f => ({ ...f, investor_id: investor.id }));
                              setShowInvoiceModal(true);
                            }}
                            aria-label={`Send invoice to ${investor.full_name}`}
                          >
                            <DollarSign className="w-4 h-4 mr-1" aria-hidden="true" />
                            Invoice
                          </Button>
                          {!isMyInvestor && !investor.assigned_acquisition_manager_id && (
                            <Button
                              size="sm"
                              className="bg-[#d4a574] hover:bg-[#c49464]"
                              disabled={selfAssigning === investor.id}
                              onClick={() => handleSelfAssign(investor.id)}
                              aria-label={`Assign yourself as AM for ${investor.full_name}`}
                            >
                              {selfAssigning === investor.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> : <UserCheck className="w-4 h-4 mr-2" aria-hidden="true" />}
                              Assign to Me
                            </Button>
                          )}
                          {isSuccessManager && (
                            <>
                              <Select
                                value={investor.assigned_acquisition_manager_id || ''}
                                onValueChange={(value) => handleAssignManager(investor.id, value, 'acquisition')}
                              >
                                <SelectTrigger className="w-36" aria-label={`Assign acquisition manager for ${investor.full_name}`}>
                                  <SelectValue placeholder="Assign AM" />
                                </SelectTrigger>
                                <SelectContent>
                                  {staffMembers.filter(s => s.department === 'acquisition_managers' || s.roles?.includes('acquisition_managers')).map(staff => (
                                    <SelectItem key={staff.id} value={staff.id}>
                                      {staff.first_name} {staff.last_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={investor.assigned_setup_manager_id || ''}
                                onValueChange={(value) => handleAssignManager(investor.id, value, 'setup')}
                              >
                                <SelectTrigger className="w-36" aria-label={`Assign setup manager for ${investor.full_name}`}>
                                  <SelectValue placeholder="Assign SM" />
                                </SelectTrigger>
                                <SelectContent>
                                  {staffMembers.filter(s => s.department === 'setup_managers' || s.roles?.includes('setup_managers')).map(staff => (
                                    <SelectItem key={staff.id} value={staff.id}>
                                      {staff.first_name} {staff.last_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
          <p className="text-sm text-gray-400 text-center">
            Showing {filteredDisplayedInvestors.length} of {investorViewMode === 'my' ? stats.myInvestors : stats.allInvestors} investors
          </p>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4" role="tabpanel" aria-label="Acquisition Requests">
          <div className="space-y-3" role="list" aria-label="Acquisition requests">
            {acquisitionRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p className="text-gray-500">No acquisition requests</p>
                </CardContent>
              </Card>
            ) : (
              acquisitionRequests.map(req => (
                <Card key={req.id} className="hover:shadow-md transition-shadow" role="listitem">
                  <CardContent className="pt-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-semibold">{req.investor_name}</h4>
                          <Badge className={
                            req.status === 'pending' ? 'bg-amber-500' :
                            req.status === 'in_progress' ? 'bg-blue-500' :
                            req.status === 'completed' ? 'bg-green-500' : 'bg-gray-500'
                          }>
                            {req.status}
                          </Badge>
                          <Badge variant="outline">{req.request_type}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">{req.property_address}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setShowRequestDetailModal(req)}
                          aria-label={`View details for request from ${req.investor_name}`}
                        >
                          <Eye className="w-4 h-4 mr-1" aria-hidden="true" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Certification Tab */}
        <TabsContent value="certification" className="space-y-4" role="tabpanel" aria-label="Certification Progress">
          <TraineeCertificationProgress
            staffId={staffId}
            staffRole={staffRole}
            isSuccessManager={isSuccessManager}
            isTrainee={staffRole === 'acquisition_managers' && !isSuccessManager}
          />
        </TabsContent>
      </Tabs>

      {/* Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
              Send Invoice
            </DialogTitle>
            <DialogDescription>
              Send an invoice to an investor. They will receive an email notification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="invoice-investor">Investor *</Label>
              <Select 
                value={invoiceForm.investor_id} 
                onValueChange={(v) => setInvoiceForm(f => ({ ...f, investor_id: v }))}
              >
                <SelectTrigger id="invoice-investor" aria-label="Select investor for invoice">
                  <SelectValue placeholder="Select investor" />
                </SelectTrigger>
                <SelectContent>
                  {investors.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.full_name} ({inv.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="invoice-type">Invoice Type *</Label>
              <Select 
                value={invoiceForm.invoice_type} 
                onValueChange={(v) => setInvoiceForm(f => ({ ...f, invoice_type: v }))}
              >
                <SelectTrigger id="invoice-type" aria-label="Select invoice type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acquisition_fee">Acquisition Fee</SelectItem>
                  <SelectItem value="account_funding">Account Funding</SelectItem>
                  <SelectItem value="setup_fee">Setup Fee</SelectItem>
                  <SelectItem value="custom">Custom Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="invoice-amount">Amount ($) *</Label>
              <Input
                id="invoice-amount"
                type="number"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="499"
                aria-required="true"
              />
            </div>

            <div>
              <Label htmlFor="invoice-description">Description</Label>
              <Textarea
                id="invoice-description"
                value={invoiceForm.description}
                onChange={(e) => setInvoiceForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Invoice description..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendInvoice}
              disabled={processing}
              className="bg-[#d4a574] hover:bg-[#c49464]"
              aria-label="Send invoice"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              Send Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Deal Modal */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
              Verify Deal
            </DialogTitle>
            <DialogDescription>
              Review and verify this deal. The investor will be notified of your decision.
            </DialogDescription>
          </DialogHeader>

          {selectedDeal && (
            <div className="space-y-4">
              <Card className="bg-gray-50">
                <CardContent className="pt-4">
                  <h4 className="font-semibold">{selectedDeal.title || selectedDeal.address}</h4>
                  <p className="text-sm text-gray-600">{selectedDeal.city}, {selectedDeal.state}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>Price: ${selectedDeal.asking_price?.toLocaleString()}</span>
                    <span>Revenue: ${selectedDeal.monthly_revenue?.toLocaleString() || selectedDeal.monthly_rent?.toLocaleString()}/mo</span>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label htmlFor="verify-deal-notes">Verification Notes</Label>
                <Textarea
                  id="verify-deal-notes"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Add notes about the verification..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleVerifyDeal(selectedDeal.id, false)}
                  disabled={processing}
                  aria-label="Reject this deal"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" aria-hidden="true" />
                  Reject
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleVerifyDeal(selectedDeal.id, true)}
                  disabled={processing}
                  aria-label="Verify and approve this deal"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                  )}
                  Verify & Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assignment Modal */}
      {showAssignModal && (
        <AcquisitionAssignmentModal 
          property={showAssignModal} 
          open={!!showAssignModal} 
          onOpenChange={() => setShowAssignModal(null)} 
          onAssigned={fetchData} 
        />
      )}
      
      {/* Tasks Modal */}
      <Dialog open={!!showTasksModal} onOpenChange={() => setShowTasksModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Setup Tasks - {showTasksModal?.title || showTasksModal?.city}</DialogTitle>
          </DialogHeader>
          {showTasksModal && (
            <SetupTasksManager 
              propertyId={showTasksModal.id} 
              investorId={showTasksModal.assigned_investor_id} 
              propertyTitle={showTasksModal.title} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Request Detail Modal */}
      <Dialog open={!!showRequestDetailModal} onOpenChange={() => setShowRequestDetailModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acquisition Request Details</DialogTitle>
          </DialogHeader>
          {showRequestDetailModal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Investor</Label>
                  <p className="font-medium">{showRequestDetailModal.investor_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <p className="font-medium">{showRequestDetailModal.investor_email}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Property</Label>
                  <p className="font-medium">{showRequestDetailModal.property_address}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Request Type</Label>
                  <p className="font-medium capitalize">{showRequestDetailModal.request_type}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <Badge className={
                    showRequestDetailModal.status === 'pending' ? 'bg-amber-500' :
                    showRequestDetailModal.status === 'in_progress' ? 'bg-blue-500' :
                    showRequestDetailModal.status === 'completed' ? 'bg-green-500' : 'bg-gray-500'
                  }>
                    {showRequestDetailModal.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Created</Label>
                  <p className="font-medium">{new Date(showRequestDetailModal.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Submit Property to Deal Flow Modal */}
      <AMSubmitDealModal
        open={showSubmitDealModal}
        onOpenChange={setShowSubmitDealModal}
        staffId={staffId}
        staffName={staffDisplayName}
        onSubmitted={fetchData}
      />

      {/* Investor Action Dialogs */}
      <AMMessageDialog
        open={showMessageDialog}
        onOpenChange={setShowMessageDialog}
        investor={actionInvestor}
        staffId={staffId}
        staffName={staffDisplayName}
      />
      <AMNotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        investor={actionInvestor}
        staffId={staffId}
        staffName={staffDisplayName}
      />
      <AMDocumentsDialog
        open={showDocumentsDialog}
        onOpenChange={setShowDocumentsDialog}
        investor={actionInvestor}
        staffId={staffId}
        staffName={staffDisplayName}
      />
      <AMSendDealDialog
        open={showSendDealDialog}
        onOpenChange={setShowSendDealDialog}
        investor={actionInvestor}
        staffId={staffId}
        staffName={staffDisplayName}
        deals={deals.map(d => ({
          id: d.id,
          title: d.title,
          address: d.address,
          city: d.city,
          state: d.state,
          asking_price: d.asking_price,
          monthly_revenue: d.monthly_revenue,
          monthly_rent: d.monthly_rent
        }))}
      />
    </div>
  );
}
