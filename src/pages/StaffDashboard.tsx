import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useDealFlowRealtime } from '@/hooks/useDealFlowRealtime';


import { DraftArticle } from '@/types/admin';
import { blogArticles } from '@/data/blogArticles';
import { TabErrorBoundary } from '@/components/admin/TabErrorBoundary';
import { useLogoutSync, sessionSyncService } from '@/services/SessionSyncService';
import { DashboardSelector, DashboardType } from '@/components/admin/DashboardSelector';
import { StaffMobileNav, getSuccessTeamTabs, getAcquisitionTabs, getSetupTabs } from '@/components/admin/StaffMobileNav';
import { PennyChatButton } from '@/components/PennyChatButton';
import { AMNotificationBell } from '@/components/admin/AMNotificationBell';


// Lazy-loaded tab components with prefetch support
const BlogArticlesTab = lazy(() => import('@/components/admin/BlogArticlesTab').then(m => ({ default: m.BlogArticlesTab })));
const ArticleEditorModal = lazy(() => import('@/components/admin/ArticleEditorModal').then(m => ({ default: m.ArticleEditorModal })));
const DealFlowTab = lazy(() => import('@/components/dealflow/DealFlowTab').then(m => ({ default: m.DealFlowTab })));
const PublishedDealsTab = lazy(() => import('@/components/dealflow/PublishedDealsTab').then(m => ({ default: m.PublishedDealsTab })));
const ArchivedDealsTab = lazy(() => import('@/components/dealflow/ArchivedDealsTab').then(m => ({ default: m.ArchivedDealsTab })));
const AddressCorrectionTool = lazy(() => import('@/components/admin/AddressCorrectionTool').then(m => ({ default: m.AddressCorrectionTool })));

const PennyScoreMonitoringDashboard = lazy(() => import('@/components/admin/PennyScoreMonitoringDashboard').then(m => ({ default: m.PennyScoreMonitoringDashboard })));
const DealInquiriesTab = lazy(() => import('@/components/admin/DealInquiriesTab').then(m => ({ default: m.DealInquiriesTab })));
const AcquisitionWorkflowTab = lazy(() => import('@/components/admin/AcquisitionWorkflowTab').then(m => ({ default: m.AcquisitionWorkflowTab })));
const EmailTemplatesTab = lazy(() => import('@/components/admin/EmailTemplatesTab').then(m => ({ default: m.EmailTemplatesTab })));
const EmailTemplateBuilder = lazy(() => import('@/components/admin/EmailTemplateBuilder').then(m => ({ default: m.EmailTemplateBuilder })));
const BulkEmailCampaign = lazy(() => import('@/components/admin/BulkEmailCampaign').then(m => ({ default: m.BulkEmailCampaign })));
const EmailDeliveryTab = lazy(() => import('@/components/admin/EmailDeliveryTab').then(m => ({ default: m.EmailDeliveryTab })));
const SMSLogsTab = lazy(() => import('@/components/admin/SMSLogsTab').then(m => ({ default: m.SMSLogsTab })));
const FollowupRulesTab = lazy(() => import('@/components/admin/FollowupRulesTab').then(m => ({ default: m.FollowupRulesTab })));
const AnalyticsDashboard = lazy(() => import('@/components/admin/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
// UnifiedCRMTab removed - functionality consolidated into Investor Management tab

const InvestorManagementTab = lazy(() => import('@/components/admin/InvestorManagementTab').then(m => ({ default: m.InvestorManagementTab })));
const AIContentGenerator = lazy(() => import('@/components/admin/AIContentGenerator').then(m => ({ default: m.AIContentGenerator })));
const InvestorCreditsTab = lazy(() => import('@/components/admin/InvestorCreditsTab').then(m => ({ default: m.InvestorCreditsTab })));
const PortfolioApprovalsTab = lazy(() => import('@/components/admin/PortfolioApprovalsTab').then(m => ({ default: m.PortfolioApprovalsTab })));
const MarketplaceVerificationsTab = lazy(() => import('@/components/admin/MarketplaceVerificationsTab').then(m => ({ default: m.MarketplaceVerificationsTab })));
const TransactionManagementTab = lazy(() => import('@/components/admin/TransactionManagementTab').then(m => ({ default: m.TransactionManagementTab })));
const StaffManagementTab = lazy(() => import('@/components/admin/StaffManagementTab').then(m => ({ default: m.StaffManagementTab })));
const StaffMessaging = lazy(() => import('@/components/admin/StaffMessaging').then(m => ({ default: m.StaffMessaging })));
const DocumentTemplatesTab = lazy(() => import('@/components/admin/DocumentTemplatesTab').then(m => ({ default: m.DocumentTemplatesTab })));
const SuccessAgreementManager = lazy(() => import('@/components/admin/SuccessAgreementManager').then(m => ({ default: m.SuccessAgreementManager })));
const SetupManagementDashboard = lazy(() => import('@/components/admin/SetupManagementDashboard').then(m => ({ default: m.SetupManagementDashboard })));
const InvestorInvitationTab = lazy(() => import('@/components/admin/InvestorInvitationTab').then(m => ({ default: m.InvestorInvitationTab })));
const DisputeManagementTab = lazy(() => import('@/components/admin/DisputeManagementTab').then(m => ({ default: m.DisputeManagementTab })));
const ReferralAnalyticsTab = lazy(() => import('@/components/admin/ReferralAnalyticsTab').then(m => ({ default: m.ReferralAnalyticsTab })));
const DealVerificationTab = lazy(() => import('@/components/admin/DealVerificationTab').then(m => ({ default: m.DealVerificationTab })));
const StaffSettingsTab = lazy(() => import('@/components/admin/StaffSettingsTab').then(m => ({ default: m.StaffSettingsTab })));
const AccountLinkSuggestionsBanner = lazy(() => import('@/components/admin/AccountLinkSuggestionsBanner').then(m => ({ default: m.AccountLinkSuggestionsBanner })));
const EmailMatchMigrationTool = lazy(() => import('@/components/admin/EmailMatchMigrationTool').then(m => ({ default: m.EmailMatchMigrationTool })));
const AcquisitionManagerDashboard = lazy(() => import('@/components/admin/AcquisitionManagerDashboard').then(m => ({ default: m.AcquisitionManagerDashboard })));
const AMVerificationRequests = lazy(() => import('@/components/admin/AMVerificationRequests').then(m => ({ default: m.AMVerificationRequests })));
const AMAssignmentRequestsTab = lazy(() => import('@/components/admin/AMAssignmentRequestsTab').then(m => ({ default: m.AMAssignmentRequestsTab })));
const SMAssignmentTab = lazy(() => import('@/components/admin/SMAssignmentTab').then(m => ({ default: m.SMAssignmentTab })));
const AssignedInvestorsTab = lazy(() => import('@/components/admin/AssignedInvestorsTab').then(m => ({ default: m.AssignedInvestorsTab })));
const InvestorsWithoutAMWidget = lazy(() => import('@/components/admin/InvestorsWithoutAMWidget').then(m => ({ default: m.InvestorsWithoutAMWidget })));
const AuthErrorsWidget = lazy(() => import('@/components/admin/AuthErrorsWidget').then(m => ({ default: m.AuthErrorsWidget })));
const SupportRequestsTab = lazy(() => import('@/components/admin/SupportRequestsTab').then(m => ({ default: m.SupportRequestsTab })));
const PerformanceTrackingDashboard = lazy(() => import('@/components/admin/PerformanceTrackingDashboard').then(m => ({ default: m.PerformanceTrackingDashboard })));
const PennyMonthlyAccuracyReport = lazy(() => import('@/components/admin/PennyMonthlyAccuracyReport').then(m => ({ default: m.PennyMonthlyAccuracyReport })));
const PennyConversationAnalytics = lazy(() => import('@/components/admin/PennyConversationAnalytics').then(m => ({ default: m.PennyConversationAnalytics })));
const SOPWorkflowsTab = lazy(() => import('@/components/admin/SOPWorkflowsTab').then(m => ({ default: m.SOPWorkflowsTab })));
const TopicDiscoveryTab = lazy(() => import('@/components/admin/TopicDiscoveryTab').then(m => ({ default: m.TopicDiscoveryTab })));
const MySetupProjectsTab = lazy(() => import('@/components/admin/MySetupProjectsTab').then(m => ({ default: m.MySetupProjectsTab })));
const ManualPaymentApprovalTab = lazy(() => import('@/components/admin/ManualPaymentApprovalTab').then(m => ({ default: m.ManualPaymentApprovalTab })));
const PendingReservationsTab = lazy(() => import('@/components/admin/PendingReservationsTab').then(m => ({ default: m.PendingReservationsTab })));
const AMSubmittedDealsTab = lazy(() => import('@/components/admin/AMSubmittedDealsTab').then(m => ({ default: m.AMSubmittedDealsTab })));
const PendingAMDealsBanner = lazy(() => import('@/components/admin/PendingAMDealsBanner').then(m => ({ default: m.PendingAMDealsBanner })));
const PropertyReferralsManagementTab = lazy(() => import('@/components/admin/PropertyReferralsManagementTab').then(m => ({ default: m.PropertyReferralsManagementTab })));
const PendingCreditsWidget = lazy(() => import('@/components/admin/PendingCreditsWidget').then(m => ({ default: m.PendingCreditsWidget })));
const DocumentsTabContent = lazy(() => import('@/components/admin/DocumentsTabContent').then(m => ({ default: m.DocumentsTabContent })));
const UnassignedLandlordsTab = lazy(() => import('@/components/admin/UnassignedLandlordsTab').then(m => ({ default: m.UnassignedLandlordsTab })));
const PropertyReviewQueue = lazy(() => import('@/components/admin/PropertyReviewQueue').then(m => ({ default: m.PropertyReviewQueue })));
const LandlordOperationsTab = lazy(() => import('@/components/admin/LandlordOperationsTab').then(m => ({ default: m.LandlordOperationsTab })));
const HRCommissionDashboard = lazy(() => import('@/components/admin/HRCommissionDashboard').then(m => ({ default: m.HRCommissionDashboard })));
const TimeTrackerWidget = lazy(() => import('@/components/admin/TimeTrackerWidget').then(m => ({ default: m.TimeTrackerWidget })));
const PennyAIConsolidatedTab = lazy(() => import('@/components/admin/PennyAIConsolidatedTab').then(m => ({ default: m.PennyAIConsolidatedTab })));
const SuccessTeamRequestCenter = lazy(() => import('@/components/admin/SuccessTeamRequestCenter').then(m => ({ default: m.SuccessTeamRequestCenter })));
const StaffPortfolioEditor = lazy(() => import('@/components/admin/StaffPortfolioEditor').then(m => ({ default: m.StaffPortfolioEditor })));
const WeeklyDigestManager = lazy(() => import('@/components/admin/WeeklyDigestManager').then(m => ({ default: m.WeeklyDigestManager })));
const PennyScoreHealthWidget = lazy(() => import('@/components/admin/PennyScoreHealthWidget').then(m => ({ default: m.PennyScoreHealthWidget })));
const SiteAnalyticsWidget = lazy(() => import('@/components/admin/SiteAnalyticsWidget').then(m => ({ default: m.SiteAnalyticsWidget })));






// Prefetch map for tab hover preloading
const TAB_PREFETCH_MAP: Record<string, () => void> = {
  'analytics': () => { import('@/components/admin/AnalyticsDashboard'); },
  'acq-dashboard': () => { import('@/components/admin/AcquisitionManagerDashboard'); },
  'dealflow': () => { import('@/components/dealflow/DealFlowTab'); },
  'investors': () => { import('@/components/admin/InvestorManagementTab'); },
  'content': () => { import('@/components/admin/BlogArticlesTab'); },
  'communications': () => { import('@/components/admin/EmailTemplatesTab'); },
  'documents': () => { import('@/components/admin/SuccessAgreementManager'); import('@/components/admin/DocumentTemplatesTab'); },
  'staff': () => { import('@/components/admin/StaffManagementTab'); },
  'setups': () => { import('@/components/admin/SetupManagementDashboard'); },
  'disputes': () => { import('@/components/admin/DisputeManagementTab'); },
  'support': () => { import('@/components/admin/SupportRequestsTab'); },
  'sops': () => { import('@/components/admin/SOPWorkflowsTab'); },
  'settings': () => { import('@/components/admin/StaffSettingsTab'); },
  'my-investors': () => { import('@/components/admin/AssignedInvestorsTab'); },
  'my-setups': () => { import('@/components/admin/MySetupProjectsTab'); },
  'landlord-ops': () => { import('@/components/admin/LandlordOperationsTab'); },
  'hr-commissions': () => { import('@/components/admin/HRCommissionDashboard'); },
};




// Skeleton loading fallback for lazy tabs
function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-4">
        {[1,2,3,4].map(i => (
          <Card key={i} className="flex-1">
            <CardContent className="pt-4">
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-8">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}



import { 
  LogOut, Home, FileText, Users, Settings, Bell, Mail, 
  BarChart3, MessageSquare, Building, DollarSign, Briefcase,
  UserCheck, Shield, HelpCircle, Wrench, CreditCard, FolderCheck, 
  Store, Handshake, UsersRound, ArrowLeftRight, UserPlus, Scale,
  Target, ClipboardCheck, HeadphonesIcon, BookOpen, AlertCircle,
  PenTool, Upload, Download, Trash2, UserCircle, UserCog, Loader2,
  Bot, Activity, ChevronLeft, X, Landmark, Inbox
} from 'lucide-react';





import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Lead {
  id: string;
  form_type: string;
  name: string;
  email: string;
  phone?: string;
  data?: any;
  created_at: string;
}

interface DigitalProduct {
  id: string;
  title: string;
  description: string;
  file_url: string;
  file_name: string;
  category: string;
  created_at: string;
}

interface DiscoveredTopic {
  id: string;
  title: string;
  content: string;
  source: string;
  source_url: string;
  engagement_score: number;
  relevance_score: number;
  trending_score: number;
  priority_score: number;
  added_to_queue: boolean;
  discovered_at: string;
}

interface StaffSession {
  id?: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  team: string;
  role: string;
  department?: string;
  permissions?: string[];
  roles?: string[];
  loginTime: number;
  linked_investor_id?: string;
  agreement_signed?: boolean;
  agreement_id?: string | null;
}


export default function StaffDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [draftArticles, setDraftArticles] = useState<DraftArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingArticles, setGeneratingArticles] = useState(false);
  const [syncingArticles, setSyncingArticles] = useState(false);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [hasInvestorBackup, setHasInvestorBackup] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const [activeDashboard, setActiveDashboard] = useState<DashboardType>('success');
  const [announcement, setAnnouncement] = useState('');
  const [unassignedInvestorCount, setUnassignedInvestorCount] = useState(0);
  const [myInvestorCount, setMyInvestorCount] = useState(0);
  const [landlordOpsCount, setLandlordOpsCount] = useState(0);



  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<DigitalProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingArticle, setEditingArticle] = useState<DraftArticle | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<DraftArticle | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle logout events from other tabs
  const handleLogoutFromOtherTab = useCallback((userType: string) => {
    if (userType === 'staff' || userType === 'all') {
      navigate('/staff/login');
    }
  }, [navigate]);

  useLogoutSync(handleLogoutFromOtherTab);

  useEffect(() => {
    // Check authentication
    const session = localStorage.getItem('staffSession');
    if (!session) {
      navigate('/staff/login');
      return;
    }
    
    const parsed = JSON.parse(session);
    setStaffSession(parsed);

    // v7.0: Check if AM needs to sign agreement before accessing dashboard
    const isAMDept = parsed.department === 'acquisition_managers' || (parsed.roles || []).includes('acquisition_managers');
    if (isAMDept && parsed.agreement_signed === false && parsed.agreement_id) {
      toast({ 
        title: 'Agreement Required', 
        description: 'Please review and sign your service agreement before accessing the dashboard.',
        variant: 'destructive'
      });
      navigate(`/am-agreement/${parsed.agreement_id}`);
      return;
    }
    
    // Check for investor backup session
    const investorBackup = localStorage.getItem('investorSessionBackup');
    setHasInvestorBackup(!!investorBackup);
    
    fetchLeads();
    fetchProducts();
    fetchDraftArticles();
    
    if (parsed.id) {
      loadUnreadCount(parsed.id);
      // Fetch unassigned investor count for badge
      supabase.functions.invoke('manage-investor-admin', {
        body: { action: 'get_unassigned_investors', limit: 100 }
      }).then(({ data }) => {
        if (data?.total !== undefined) setUnassignedInvestorCount(data.total);
        else if (data?.investors) setUnassignedInvestorCount(Array.isArray(data.investors) ? data.investors.length : 0);
      }).catch(() => {});

      // Fetch landlord ops counts for badge (unassigned landlords + pending property reviews)
      // Uses edge function first, falls back to direct DB query if JWT auth fails
      Promise.allSettled([
        supabase.functions.invoke('manage-landlord-portal', {
          body: { action: 'get_unassigned_landlords' }
        }).then(res => {
          // Check if edge function returned an auth error
          if (res.data?.error?.includes?.('Authorization') || res.data?.error?.includes?.('token')) {
            throw new Error('Auth required - falling back to DB');
          }
          return res;
        }),
        supabase.functions.invoke('manage-landlord-portal', {
          body: { action: 'get_landlord_properties_for_review', status_filter: 'pending_analysis' }
        }).then(res => {
          if (res.data?.error?.includes?.('Authorization') || res.data?.error?.includes?.('token')) {
            throw new Error('Auth required - falling back to DB');
          }
          return res;
        })
      ]).then(async ([unassignedRes, pendingRes]) => {
        let totalCount = 0;
        
        if (unassignedRes.status === 'fulfilled') {
          const d = unassignedRes.value.data;
          totalCount += d?.total ?? (Array.isArray(d?.landlords) ? d.landlords.length : 0);
        } else {
          // DB fallback for unassigned landlords
          try {
            const { data } = await supabase
              .from('landlord_contacts')
              .select('id', { count: 'exact', head: true })
              .eq('portal_enabled', true)
              .is('assigned_am_id', null);
            // head: true doesn't return data array, use count from response
            totalCount += 0; // Will be updated below
          } catch {}
          try {
            const { data } = await supabase
              .from('landlord_contacts')
              .select('id')
              .eq('portal_enabled', true)
              .is('assigned_am_id', null);
            totalCount += data?.length || 0;
          } catch {}
        }
        
        if (pendingRes.status === 'fulfilled') {
          const d = pendingRes.value.data;
          totalCount += d?.total ?? (Array.isArray(d?.properties) ? d.properties.length : 0);
        } else {
          // DB fallback for pending property reviews
          try {
            const { data } = await supabase
              .from('landlord_properties')
              .select('id')
              .eq('submission_status', 'pending_analysis');
            totalCount += data?.length || 0;
          } catch {}
        }
        
        setLandlordOpsCount(totalCount);
      }).catch(() => {});

    }


    // Set default dashboard and tab based on role
    const parsedRoles = parsed.roles || [];
    const parsedPermissions = parsed.permissions || [];
    const parsedRole = parsed.role || '';
    const parsedIsSuccessManager = 
      parsedPermissions.includes('all') || 
      parsed.department === 'success_managers' || 
      parsedRoles.includes('success_managers') ||
      parsedRole === 'success_managers' ||
      parsedRole === 'success_manager' ||
      parsedRole === 'admin';
    
    if (parsedIsSuccessManager) {
      setActiveDashboard('success');
      setActiveTab('analytics');
    } else if (parsed.department === 'acquisition_managers' || parsedRoles.includes('acquisition_managers')) {
      setActiveDashboard('acquisitions');
      setActiveTab('acq-dashboard');
    } else if (parsed.department === 'setup_managers' || parsedRoles.includes('setup_managers')) {
      setActiveDashboard('setups');
      setActiveTab('setups');
    }

  }, [navigate]);


  // Handle dashboard switching
  const handleDashboardSwitch = useCallback((dashboard: DashboardType) => {
    setActiveDashboard(dashboard);
    // Set default tab for each dashboard
    if (dashboard === 'success') {
      setActiveTab('analytics');
    } else if (dashboard === 'acquisitions') {
      setActiveTab('acq-dashboard');
    } else if (dashboard === 'setups') {
      setActiveTab('setups');
    }
  }, []);


  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    const tabLabels: Record<string, string> = {
      'analytics': 'Analytics Dashboard',
      'request-center': 'Success Team Request Center',
      'acq-dashboard': 'Acquisition Manager Dashboard',

      'investors': 'Investor Management',
      'landlord-ops': 'Landlord Operations',
      'content': 'Content Management',
      'communications': 'Communications',
      'documents': 'Documents',
      'staff': 'Staff Management',
      'setups': 'Setup Manager Dashboard',
      'disputes': 'Disputes',
      'my-investors': 'My Investors',
      'support': 'Support',
      'sops': 'Standard Operating Procedures',
      'settings': 'Settings',
      'hr-commissions': 'HR & Commissions',
    };
    setAnnouncement(`Now viewing ${tabLabels[value] || value}`);
  }, []);




  const loadUnreadCount = async (staffId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'get_unread_count', staff_id: staffId }
      });
      if (data?.count !== undefined) {
        setUnreadMessages(data.count);
      } else if (error || data?.error) {
        // Edge function failed (likely auth error) - try direct DB fallback
        console.warn('[loadUnreadCount] Edge function failed, trying DB fallback:', error?.message || data?.error);
        try {
          const { data: messages } = await supabase
            .from('staff_messages')
            .select('id', { count: 'exact', head: false })
            .eq('recipient_id', staffId)
            .eq('read', false);
          setUnreadMessages(messages?.length || 0);
        } catch (dbErr) {
          console.warn('[loadUnreadCount] DB fallback also failed:', dbErr);
          setUnreadMessages(0);
        }
      }
    } catch (err) {
      console.error('Failed to load unread count:', err);
      setUnreadMessages(0);
    }
  };


  const handleLogout = () => {
    localStorage.removeItem('staffSession');
    localStorage.removeItem('staffSessionBackup');
    sessionSyncService.forceLogoutAll('staff');
    navigate('/staff/login');
  };

  const handleSwitchToInvestor = async () => {
    if (!staffSession?.id) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('staff-login', {
        body: { 
          action: 'get_linked_investor',
          staff_id: staffSession.id
        }
      });
      
      if (error) throw error;
      
      if (data?.investor) {
        localStorage.setItem('staffSessionBackup', JSON.stringify(staffSession));
        const investorSession = {
          ...data.investor,
          loginTime: Date.now()
        };
        localStorage.setItem('investorSession', JSON.stringify(investorSession));
        sessionSyncService.setInvestorSession(investorSession);
        
        toast({
          title: 'Switched to Investor Portal',
          description: `Welcome, ${data.investor.full_name || 'Investor'}!`
        });
        
        navigate('/investor');
      } else {
        toast({ 
          title: 'Error', 
          description: 'Could not load investor account data', 
          variant: 'destructive' 
        });
      }
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to switch to investor portal', 
        variant: 'destructive' 
      });
    }
  };

  // Check permissions
  const hasPermission = (permission: string): boolean => {
    if (!staffSession) return false;
    if (staffSession.permissions?.includes('all')) return true;
    return staffSession.permissions?.includes(permission) || false;
  };

   // Role checks - Consider department, roles array, role field, AND permissions for multi-role staff
  // A staff member might have department='acquisition_managers' but roles=['acquisition_managers','success_managers']
  // Or they might have permissions=['all'] which grants full access
  // Or they might have role='admin' or role='success_manager' (singular)
  const staffRoles = staffSession?.roles || [];
  const staffPermissions = staffSession?.permissions || [];
  const hasAllPermissions = staffPermissions.includes('all');
  const staffRole = staffSession?.role || '';
  const staffDepartment = staffSession?.department || '';

  // isSuccessManager: true if department is success_managers, OR roles array includes it, OR has 'all' permissions,
  // OR the singular 'role' field is success_managers/success_manager/admin
  const isSuccessManager = hasAllPermissions ||
    staffDepartment === 'success_managers' ||
    staffDepartment === 'success_manager' ||
    staffRoles.includes('success_managers') ||
    staffRoles.includes('success_manager') ||
    staffRole === 'success_managers' ||
    staffRole === 'success_manager' ||
    staffRole === 'admin';

  // isAcquisitionManager: accept both plural + singular variants so AMs with inconsistent
  // session data (e.g. department='acquisition_manager' vs 'acquisition_managers') are
  // still recognised â€” prevents AMs from falling through to the 'Setup_Manager' default
  // in <DealFlowTab>, which would block them from uploading deals.
  const isAcquisitionManager =
    staffDepartment === 'acquisition_managers' ||
    staffDepartment === 'acquisition_manager' ||
    staffRoles.includes('acquisition_managers') ||
    staffRoles.includes('acquisition_manager') ||
    staffRole === 'acquisition_managers' ||
    staffRole === 'acquisition_manager';

  const isSetupManager =
    staffDepartment === 'setup_managers' ||
    staffDepartment === 'setup_manager' ||
    staffRoles.includes('setup_managers') ||
    staffRoles.includes('setup_manager') ||
    staffRole === 'setup_managers' ||
    staffRole === 'setup_manager';

  // ADMIN CHECK â€” used to gate the HR Executive Overview (master weekly report,
  // executive KPIs, staff_list). The `manage-hr-commissions` edge function
  // returns 403 for non-admins. Success Managers are treated as
  // admin-equivalent by this platform (they run operations), so they're
  // included here â€” this restores the Executive Overview / Master Weekly
  // Report features for Success Team after the earlier over-strict fix
  // accidentally locked them out. Acquisition Managers and Setup Managers
  // remain excluded, preventing the original 403 errors.
  const isAdmin =
    hasAllPermissions ||
    staffRole === 'admin' ||
    staffRoles.includes('admin') ||
    isSuccessManager;

  // Access control: Success team can access everything
  // Multi-role staff get combined access from all their roles
  // Staff with 'all' permissions get full access
  const canAccessAcquisitionDashboard = isSuccessManager || isAcquisitionManager;
  const canAccessSetupDashboard = isSuccessManager || isSetupManager;
  const canAccessDealFlow = isSuccessManager || isAcquisitionManager || hasPermission('deals');
  const canAccessInvestors = isSuccessManager || isAcquisitionManager || hasPermission('investors');



  // Real-time deal flow notification badges for Acquisitions sub-tabs
  // Hook is called unconditionally (React rules of hooks) but `enabled` gates the subscriptions
  const {
    unverifiedCount: dealFlowUnverifiedCount,
    newDealCount: dealFlowNewDealCount,
  } = useDealFlowRealtime({
    staffId: staffSession?.id,
    isSuccessManager: isSuccessManager || false,
    isAcquisitionManager: isAcquisitionManager || false,
    enabled: !!staffSession?.id && (!!canAccessAcquisitionDashboard),
  });

  // Combined badge count for the top-level Acquisitions tab
  const acqBadgeTotal = dealFlowUnverifiedCount + dealFlowNewDealCount;




  const syncStaticArticles = async () => {
    setSyncingArticles(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-static-articles', {
        body: { articles: blogArticles }
      });

      if (error) {
        toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ 
          title: 'Sync completed', 
          description: `${data?.synced || 0} articles synced, ${data?.skipped || 0} skipped`
        });
        fetchDraftArticles();
      }
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSyncingArticles(false);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-leads');
      if (data?.leads) {
        setLeads(data.leads);
      } else if (error || data?.error) {
        // Edge function failed (likely auth error) - try direct DB query as fallback
        console.warn('[fetchLeads] Edge function failed, trying DB fallback:', error?.message || data?.error);
        try {
          const { data: dbLeads } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });
          if (dbLeads) setLeads(dbLeads as Lead[]);
        } catch (dbErr) {
          console.warn('[fetchLeads] DB fallback also failed:', dbErr);
        }
      }
    } catch (err) {
      console.warn('[fetchLeads] Error:', err);
    }
    setLoading(false);
  };


  const fetchProducts = async () => {
    const { data } = await supabase.functions.invoke('get-digital-products');
    if (Array.isArray(data?.products)) setProducts(data.products);
  };

  const fetchDraftArticles = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('get-draft-articles', {
      body: { status: 'all' }
    });
    if (data?.articles) setDraftArticles(data.articles);
    setLoading(false);
  };

  const generateNewArticles = async () => {
    setGeneratingArticles(true);
    const { data, error } = await supabase.functions.invoke('research-and-generate-articles');
    
    if (error) {
      toast({ 
        title: 'Generation failed', 
        description: error.message,
        variant: 'destructive' 
      });
    } else {
      toast({ 
        title: 'Articles generated successfully', 
        description: `${data?.articlesGenerated || 0} new articles created`
      });
      fetchDraftArticles();
    }
    setGeneratingArticles(false);
  };

  const handleArticleAction = async (articleId: string, action: 'approve' | 'reject' | 'publish' | 'delete') => {
    if (action === 'delete') {
      const { error } = await supabase.functions.invoke('delete-article', {
        body: { articleId }
      });
      if (error) {
        toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Article deleted' });
        fetchDraftArticles();
      }
      return;
    }

    const statusMap = { approve: 'approved', reject: 'rejected', publish: 'published' };
    const { error } = await supabase.functions.invoke('update-article-status', {
      body: { articleId, status: statusMap[action], approvedBy: 'staff' }
    });

    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Article ${statusMap[action]}` });
      fetchDraftArticles();
    }
  };

  const handleArticleEdit = (article: DraftArticle) => {
    setEditingArticle(article);
    setEditDialogOpen(true);
  };

  const handleArticlePreview = (article: DraftArticle) => {
    setPreviewArticle(article);
    setPreviewDialogOpen(true);
  };

  const handleSaveArticle = async (article: DraftArticle) => {
    const { error } = await supabase.functions.invoke('update-article-status', {
      body: { 
        articleId: article.id,
        status: article.status,
        articleData: {
          title: article.title,
          excerpt: article.excerpt,
          content: article.content,
          category: article.category,
          tags: article.tags,
          seo_title: article.seo_title,
          seo_description: article.seo_description,
          seo_keywords: article.seo_keywords,
          scheduled_for: article.scheduled_for
        }
      }
    });

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: article.status === 'scheduled' ? 'Article scheduled' : 'Article saved' });
      fetchDraftArticles();
      setEditDialogOpen(false);
      setEditingArticle(null);
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!uploadFile) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;

    const filePath = `${Date.now()}-${uploadFile.name}`;
    const { error: uploadError } = await supabase.storage.from('digital-products').upload(filePath, uploadFile);

    if (uploadError) {
      toast({ title: 'Upload failed', variant: 'destructive' });
      return;
    }

    const { data: urlData } = supabase.storage.from('digital-products').getPublicUrl(filePath);

    await supabase.functions.invoke('upload-digital-product', {
      body: { title, description, fileUrl: urlData.publicUrl, fileName: uploadFile.name, category, createdBy: 'staff' }
    });

    toast({ title: 'Product uploaded successfully' });
    fetchProducts();
    setUploadFile(null);
    (e.target as HTMLFormElement).reset();
  };

  const handleDeleteClick = (product: DigitalProduct) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    setDeleting(true);
    const { data, error } = await supabase.functions.invoke('delete-digital-product', {
      body: { productId: productToDelete.id, fileUrl: productToDelete.file_url }
    });

    if (error || data?.error) {
      toast({ 
        title: 'Delete failed', 
        description: error?.message || data?.error,
        variant: 'destructive' 
      });
    } else {
      toast({ title: 'Product deleted successfully' });
      fetchProducts();
    }

    setDeleting(false);
    setDeleteDialogOpen(false);
    setProductToDelete(null);
  };

  const staffDisplayName = staffSession?.first_name 
    ? `${staffSession.first_name} ${staffSession.last_name || ''}`.trim() 
    : staffSession?.name || 'Staff';

  // Get dashboard title based on role
  const getDashboardTitle = () => {
    if (isSuccessManager) return 'Success Team Dashboard';
    if (isAcquisitionManager) return 'Acquisition Manager Dashboard';
    if (isSetupManager) return 'Setup Manager Dashboard';
    return 'Staff Dashboard';
  };

  // Guard: render loading spinner until session is loaded from localStorage.
  // Prevents first-paint crash where staffSession=null causes isSuccessManager=false
  // and locked DashboardSelector cards crash components expecting a valid session.
  if (!staffSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#d4a574] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to main content link - WCAG 2.1 Level A: Bypass Blocks (2.4.1) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-[#1a365d] focus:ring-2 focus:ring-[#d4a574] focus:outline-none focus:font-medium"
      >
        Skip to main content
      </a>


      {/* Live region for screen reader announcements */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announcement}
      </div>

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40" role="banner">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center" 
              aria-hidden="true"
            >
              <span className="text-white font-bold">AYP</span>
            </div>
            <div>
              <h1 className="font-bold text-[#1a365d]">{getDashboardTitle()}</h1>
              <p className="text-xs text-gray-500">
                {staffSession?.department?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Staff'}
              </p>
            </div>
          </div>

          {/* Time Tracker Widget - Compact in header */}
          {staffSession?.id && (
            <Suspense fallback={null}>
              <TimeTrackerWidget staffId={staffSession.id} compact />
            </Suspense>
          )}


          <nav className="flex items-center gap-3" aria-label="Header actions">
            {/* Switch to Investor Account Button */}
            {staffSession?.linked_investor_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSwitchToInvestor}
                className="bg-gradient-to-r from-[#d4a574]/10 to-[#d4a574]/5 border-[#d4a574]/30 hover:bg-[#d4a574]/20"
                aria-label="Switch to your investor account"
              >
                <ArrowLeftRight className="w-4 h-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Investor Portal</span>
              </Button>
            )}

            {/* Messages Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMessagesOpen(true)}
              className="relative"
              aria-label={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              {unreadMessages > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  {unreadMessages}
                </span>
              )}
            </Button>

            {/* Book a Call â€” quick-dial to success team */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = 'mailto:success@accessyourplace.com?subject=Discovery%20Call%20Request&body=Hi%20Success%20Team%2C%0A%0AI%20would%20like%20to%20schedule%20a%20discovery%20call.%0A%0AClient%20name%3A%0AMarket%20of%20interest%3A%0ABest%20time%3A%0A';
              }}
              className="hidden sm:flex items-center gap-1 text-[#d4a574] border-[#d4a574]/40 hover:bg-[#d4a574]/10"
              aria-label="Book a discovery call â€” opens email to success team"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-medium">Book a Call</span>
            </Button>

            {/* Deal Status Notification Bell - Shows for AMs and Success Team */}
            {staffSession?.id && canAccessDealFlow && (
              <AMNotificationBell
                staffId={staffSession.id}
                staffName={staffDisplayName}
              />
            )}

            {/* User Menu */}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="User menu">
                  <UserCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">{staffDisplayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {staffSession?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {staffSession?.linked_investor_id && (
                  <>
                    <DropdownMenuItem onClick={handleSwitchToInvestor}>
                      <ArrowLeftRight className="w-4 h-4 mr-2" aria-hidden="true" />
                      Switch to Investor
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>

      {/* Full-screen tab navigation bar - shown when a non-default tab is active */}
      {(() => {
        const defaultTabs: Record<string, string> = { success: 'analytics', acquisitions: 'acq-dashboard', setups: 'setups' };
        const defaultTab = defaultTabs[activeDashboard] || 'analytics';
        const isOnDefaultTab = activeTab === defaultTab;
        
        const staffTabLabels: Record<string, string> = {
          'analytics': 'Analytics Dashboard', 'acq-dashboard': 'Acquisitions Dashboard',
          'dealflow': 'Deal Flow & Marketplace', 'investors': 'Investor Management',
          'landlord-ops': 'Landlord Operations', 'content': 'Content Management',
          'communications': 'Communications Hub', 'hr-commissions': 'HR & Commissions',
          'my-investors': 'My Assigned Investors', 'my-setups': 'My Setup Projects',
          'documents': 'Documents', 'staff': 'Staff Management', 'setups': 'Setup Dashboard',
          'disputes': 'Disputes', 'support': 'Support Requests', 'sops': 'SOPs', 'settings': 'Settings'
        };



        if (isOnDefaultTab) return null;

        return (
          <div className="sticky top-[57px] z-30 bg-[#1a365d] text-white shadow-lg" role="navigation" aria-label="Tab navigation bar">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab(defaultTab)}
                  className="text-white hover:bg-white/20 gap-2"
                  aria-label="Close this tab and return to main dashboard"
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                  <span className="sm:hidden">Back</span>
                </Button>
                <div className="h-5 w-px bg-white/30" aria-hidden="true" />
                <h2 className="text-sm font-medium text-white/90">
                  {staffTabLabels[activeTab] || activeTab}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveTab(defaultTab)}
                className="text-white hover:bg-white/20"
                aria-label="Close tab"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        );
      })()}

      <main id="main-content" className="container mx-auto py-6 px-4" role="main">
        {/* Dashboard Selector - Role-based access */}
        {(() => {
          const defaultTabs: Record<string, string> = { success: 'analytics', acquisitions: 'acq-dashboard', setups: 'setups' };
          const defaultTab = defaultTabs[activeDashboard] || 'analytics';
          const isOnDefaultTab = activeTab === defaultTab;
          
          // Only show dashboard selector and tab list on default tab
          if (!isOnDefaultTab) return null;
          
          return (
            <DashboardSelector
              activeDashboard={activeDashboard}
              onSelect={handleDashboardSwitch}
              canAccessSuccess={isSuccessManager || false}
              canAccessAcquisitions={canAccessAcquisitionDashboard || false}
              canAccessSetups={canAccessSetupDashboard || false}
              isSuccessManager={isSuccessManager || false}
              investorCount={myInvestorCount}
              unassignedCount={unassignedInvestorCount}
            />
          );
        })()}

        <Suspense fallback={<TabSkeleton />}>
        <Tabs value={activeTab} onValueChange={handleTabChange} activationMode="manual">
          {/* CRITICAL FIX: Always-rendered hidden TabsList ensures Radix Tabs maintains 
              internal trigger state even when the visible nav is conditionally hidden.
              Without this, mobile browsers may fail to render TabsContent when navigating 
              away from the default tab because the TabsTriggers are removed from the DOM. */}
          <TabsList className="sr-only" aria-hidden="true">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="request-center">Request Center</TabsTrigger>
            <TabsTrigger value="acq-dashboard">Acquisitions</TabsTrigger>
            <TabsTrigger value="dealflow">Deal Flow</TabsTrigger>
            <TabsTrigger value="investors">Investors</TabsTrigger>

            <TabsTrigger value="landlord-ops">Landlord Ops</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="hr-commissions">HR</TabsTrigger>
            <TabsTrigger value="setups">Setups</TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="sops">SOPs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="my-investors">My Investors</TabsTrigger>
            <TabsTrigger value="my-setups">My Setups</TabsTrigger>
            <TabsTrigger value="weekly-digest">Weekly Digest</TabsTrigger>
          </TabsList>



          {(() => {
            const defaultTabs: Record<string, string> = { success: 'analytics', acquisitions: 'acq-dashboard', setups: 'setups' };

            const defaultTab = defaultTabs[activeDashboard] || 'analytics';
            const isOnDefaultTab = activeTab === defaultTab;
            
            if (!isOnDefaultTab) return null;

            // Determine which mobile nav items and accent to use
            const mobileNavItems = activeDashboard === 'success' 
              ? getSuccessTeamTabs(unassignedInvestorCount, landlordOpsCount)
              : activeDashboard === 'acquisitions'
                ? getAcquisitionTabs(landlordOpsCount)
                : getSetupTabs();

            
            const mobileAccent = activeDashboard === 'success' 
              ? 'amber' 
              : activeDashboard === 'acquisitions' 
                ? 'indigo' 
                : 'emerald';
            
            return (
              <>
                {/* Mobile Navigation - dropdown menu */}
                <StaffMobileNav
                  items={mobileNavItems}
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  accentColor={mobileAccent}
                />

                {/* Desktop Navigation - horizontal tab bar */}
                <div 
                  className="mb-6 overflow-x-auto hidden md:block" 
                  role="region" 
                  aria-label="Dashboard navigation"
                >
                  <TabsList 
                    className="flex flex-nowrap gap-1 bg-transparent min-w-max p-1" 
                    aria-label="Dashboard sections"
                  >
                    {/* ===== SUCCESS TEAM TABS ===== */}
                    {activeDashboard === 'success' && (
                      <>
                        <TabsTrigger value="analytics" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <BarChart3 className="w-4 h-4 mr-1" aria-hidden="true" /><span>Analytics</span>
                        </TabsTrigger>
                        <TabsTrigger value="acq-dashboard" className="data-[state=active]:bg-amber-100 whitespace-nowrap relative">
                          <Target className="w-4 h-4 mr-1" aria-hidden="true" /><span>Acquisitions</span>
                          {acqBadgeTotal > 0 && (
                            <span 
                              className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-indigo-500 text-white animate-pulse"
                              aria-label={`${acqBadgeTotal} deals need attention`}
                            >
                              {acqBadgeTotal}
                            </span>
                          )}
                        </TabsTrigger>

                        <TabsTrigger value="dealflow" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <Building className="w-4 h-4 mr-1" aria-hidden="true" /><span>Deal Flow</span>
                        </TabsTrigger>
                        <TabsTrigger value="investors" className="data-[state=active]:bg-amber-100 whitespace-nowrap relative">
                          <UserCog className="w-4 h-4 mr-1" aria-hidden="true" /><span>Investors</span>
                          {unassignedInvestorCount > 0 && (
                            <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-red-500 text-white animate-pulse">{unassignedInvestorCount}</span>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="landlord-ops" className="data-[state=active]:bg-amber-100 whitespace-nowrap relative">

                          <Landmark className="w-4 h-4 mr-1" aria-hidden="true" /><span>Landlord Ops</span>
                          {landlordOpsCount > 0 && (
                            <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-orange-500 text-white animate-pulse">{landlordOpsCount}</span>
                          )}
                        </TabsTrigger>

                        <TabsTrigger value="content" className="data-[state=active]:bg-amber-100 whitespace-nowrap">

                          <PenTool className="w-4 h-4 mr-1" aria-hidden="true" /><span>Content</span>
                        </TabsTrigger>
                        <TabsTrigger value="communications" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <Mail className="w-4 h-4 mr-1" aria-hidden="true" /><span>Communications</span>
                        </TabsTrigger>
                        <TabsTrigger value="documents" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <FileText className="w-4 h-4 mr-1" aria-hidden="true" /><span>Documents</span>
                        </TabsTrigger>
                        <TabsTrigger value="staff" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <UsersRound className="w-4 h-4 mr-1" aria-hidden="true" /><span>Staff</span>
                        </TabsTrigger>
                        <TabsTrigger value="hr-commissions" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <Briefcase className="w-4 h-4 mr-1" aria-hidden="true" /><span>HR & Pay</span>
                        </TabsTrigger>

                        <TabsTrigger value="setups" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <Wrench className="w-4 h-4 mr-1" aria-hidden="true" /><span>Setups</span>
                        </TabsTrigger>
                        <TabsTrigger value="disputes" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <Scale className="w-4 h-4 mr-1" aria-hidden="true" /><span>Disputes</span>
                        </TabsTrigger>
                        <TabsTrigger value="support" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <HeadphonesIcon className="w-4 h-4 mr-1" aria-hidden="true" /><span>Support</span>
                        </TabsTrigger>
                        <TabsTrigger value="sops" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <BookOpen className="w-4 h-4 mr-1" aria-hidden="true" /><span>SOPs</span>
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="data-[state=active]:bg-amber-100 whitespace-nowrap">
                          <Settings className="w-4 h-4 mr-1" aria-hidden="true" /><span>Settings</span>
                        </TabsTrigger>
                      </>
                    )}

                    {/* ===== ACQUISITION MANAGER TABS ===== */}
                    {activeDashboard === 'acquisitions' && (
                      <>
                        <TabsTrigger value="acq-dashboard" className="data-[state=active]:bg-indigo-100 whitespace-nowrap">
                          <Target className="w-4 h-4 mr-1" aria-hidden="true" /><span>Dashboard</span>
                        </TabsTrigger>
                        <TabsTrigger value="my-investors" className="data-[state=active]:bg-indigo-100 whitespace-nowrap">
                          <UserCheck className="w-4 h-4 mr-1" aria-hidden="true" /><span>My Investors</span>
                        </TabsTrigger>
                        <TabsTrigger value="dealflow" className="data-[state=active]:bg-indigo-100 whitespace-nowrap">
                          <Building className="w-4 h-4 mr-1" aria-hidden="true" /><span>Deal Flow</span>
                        </TabsTrigger>
                        <TabsTrigger value="landlord-ops" className="data-[state=active]:bg-indigo-100 whitespace-nowrap relative">
                          <Landmark className="w-4 h-4 mr-1" aria-hidden="true" /><span>Landlord Ops</span>
                          {landlordOpsCount > 0 && (
                            <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-orange-500 text-white animate-pulse">{landlordOpsCount}</span>
                          )}
                        </TabsTrigger>

                        <TabsTrigger value="hr-commissions" className="data-[state=active]:bg-indigo-100 whitespace-nowrap">
                          <Briefcase className="w-4 h-4 mr-1" aria-hidden="true" /><span>HR & Pay</span>
                        </TabsTrigger>
                        <TabsTrigger value="sops" className="data-[state=active]:bg-indigo-100 whitespace-nowrap">
                          <BookOpen className="w-4 h-4 mr-1" aria-hidden="true" /><span>SOPs</span>
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="data-[state=active]:bg-indigo-100 whitespace-nowrap">
                          <Settings className="w-4 h-4 mr-1" aria-hidden="true" /><span>Settings</span>
                        </TabsTrigger>
                      </>
                    )}


                    {/* ===== SETUP MANAGER TABS ===== */}
                    {activeDashboard === 'setups' && (
                      <>
                        <TabsTrigger value="setups" className="data-[state=active]:bg-emerald-100 whitespace-nowrap">
                          <Wrench className="w-4 h-4 mr-1" aria-hidden="true" /><span>Setup Dashboard</span>
                        </TabsTrigger>
                        <TabsTrigger value="my-setups" className="data-[state=active]:bg-emerald-100 whitespace-nowrap">
                          <ClipboardCheck className="w-4 h-4 mr-1" aria-hidden="true" /><span>My Projects</span>
                        </TabsTrigger>
                        <TabsTrigger value="hr-commissions" className="data-[state=active]:bg-emerald-100 whitespace-nowrap">
                          <Briefcase className="w-4 h-4 mr-1" aria-hidden="true" /><span>HR & Pay</span>
                        </TabsTrigger>
                        <TabsTrigger value="sops" className="data-[state=active]:bg-emerald-100 whitespace-nowrap">
                          <BookOpen className="w-4 h-4 mr-1" aria-hidden="true" /><span>SOPs</span>
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="data-[state=active]:bg-emerald-100 whitespace-nowrap">
                          <Settings className="w-4 h-4 mr-1" aria-hidden="true" /><span>Settings</span>
                        </TabsTrigger>

                      </>
                    )}
                  </TabsList>
                </div>
              </>
            );
          })()}



          {/* Analytics Tab */}

          <TabsContent value="analytics" role="tabpanel" aria-label="Analytics dashboard">
            <TabErrorBoundary tabName="Analytics Dashboard">
              <div className="space-y-6">
                {isSuccessManager && (
                  <Suspense fallback={null}>
                    <PendingAMDealsBanner
                      staffName={staffDisplayName}
                      onNavigateToReview={() => {
                        setActiveTab('acq-dashboard');
                      }}
                    />
                  </Suspense>
                )}
                {isSuccessManager && staffSession?.id && (
                  <TabErrorBoundary tabName="Auth Errors Widget">
                    <AuthErrorsWidget staffId={staffSession.id} />
                  </TabErrorBoundary>
                )}
                {isSuccessManager && (
                  <TabErrorBoundary tabName="Penny Score Health">
                    <Suspense fallback={<TabSkeleton />}>
                      <PennyScoreHealthWidget
                        staffId={staffSession?.id}
                        staffName={staffDisplayName}
                      />
                    </Suspense>
                  </TabErrorBoundary>
                )}
                <TabErrorBoundary tabName="Site Analytics">
                  <Suspense fallback={<TabSkeleton />}>
                    <SiteAnalyticsWidget />
                  </Suspense>
                </TabErrorBoundary>
                <AnalyticsDashboard />
              </div>
            </TabErrorBoundary>
          </TabsContent>



          {/* Success Team Request Center */}
          <TabsContent value="request-center" role="tabpanel" aria-label="Success Team Request Center">
            <TabErrorBoundary tabName="Request Center">
              {staffSession?.id && (
                <SuccessTeamRequestCenter
                  staffId={staffSession.id}
                  staffName={staffDisplayName}
                />
              )}
            </TabErrorBoundary>
          </TabsContent>


          {/* Acquisition Manager Dashboard - UNIFIED with Acquisitions Workflow */}
          <TabsContent value="acq-dashboard" role="tabpanel" aria-label="Acquisition Manager Dashboard">
            <TabErrorBoundary tabName="Acquisitions Dashboard">
              <Card className="mb-6 border-indigo-200 bg-gradient-to-r from-indigo-50 to-indigo-100">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-indigo-900">Acquisitions Dashboard</CardTitle>
                      <CardDescription className="text-indigo-700">
                        Manage property acquisitions, investor assignments, workflow, and deal pipeline
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
              
              {/* Sub-tabs for Acquisitions */}
              <Tabs defaultValue="dashboard" className="space-y-4" activationMode="manual">

                <TabsList aria-label="Acquisition sub-sections" className="flex-wrap h-auto">
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger value="am-submissions" className="relative">
                    AM Submissions
                    {dealFlowNewDealCount > 0 && (
                      <span 
                        className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse"
                        aria-label={`${dealFlowNewDealCount} new AM submissions awaiting review`}
                      >
                        {dealFlowNewDealCount}
                      </span>
                    )}
                  </TabsTrigger>
                  {isSuccessManager && (
                    <TabsTrigger value="reservations">Pending Reservations</TabsTrigger>
                  )}
                  {isSuccessManager && (
                    <TabsTrigger value="workflow">Workflow Pipeline</TabsTrigger>
                  )}
                  {isSuccessManager && (
                    <TabsTrigger value="verification" className="relative">
                      Deal Verification
                      {dealFlowUnverifiedCount > 0 && (
                        <span 
                          className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-violet-500 text-white animate-pulse"
                          aria-label={`${dealFlowUnverifiedCount} unverified deals awaiting review`}
                        >
                          {dealFlowUnverifiedCount}
                        </span>
                      )}
                    </TabsTrigger>
                  )}
                  {isSuccessManager && (
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                  )}
                  {isSuccessManager && (
                    <TabsTrigger value="payments">Payment Approvals</TabsTrigger>
                  )}
                  {isSuccessManager && (
                    <TabsTrigger value="property-referrals">Property Referrals</TabsTrigger>
                  )}
                  {isSuccessManager && (
                    <TabsTrigger value="referrals">Client Referrals</TabsTrigger>
                  )}
                  <TabsTrigger value="penny-ai">Penny AI</TabsTrigger>
                </TabsList>


                <TabsContent value="dashboard">
                  <TabErrorBoundary tabName="Acquisition Manager Dashboard">
                    {staffSession?.id && (
                      <AcquisitionManagerDashboard
                        staffId={staffSession.id}
                        staffRole={staffSession.department || ''}
                        staffRoles={staffRoles}
                        isSuccessManager={isSuccessManager}
                        staffName={staffDisplayName}
                      />

                    )}
                  </TabErrorBoundary>
                </TabsContent>

                <TabsContent value="am-submissions">
                  <TabErrorBoundary tabName="AM Submitted Deals">
                    {staffSession?.id && (
                      <AMSubmittedDealsTab
                        staffId={staffSession.id}
                        staffName={staffDisplayName}
                        isSuccessManager={isSuccessManager || false}
                      />
                    )}
                  </TabErrorBoundary>
                </TabsContent>
                
                {/* Success-team-only sub-tab content panels - gated to prevent AM access via URL manipulation */}
                {isSuccessManager && (
                  <TabsContent value="reservations">
                    <TabErrorBoundary tabName="Pending Reservations">
                      {staffSession?.id && (
                        <PendingReservationsTab 
                          staffId={staffSession.id}
                          staffName={staffDisplayName}
                          isSuccessManager={isSuccessManager}
                        />
                      )}
                    </TabErrorBoundary>
                  </TabsContent>
                )}

                {isSuccessManager && (
                  <TabsContent value="workflow">
                    <TabErrorBoundary tabName="Acquisition Workflow Pipeline">
                      <AcquisitionWorkflowTab />
                    </TabErrorBoundary>
                  </TabsContent>
                )}
                
                {isSuccessManager && (
                  <TabsContent value="verification">
                    <TabErrorBoundary tabName="Deal Verification">
                      <DealVerificationTab 
                        staffId={staffSession?.id}
                        staffName={staffDisplayName}
                      />
                    </TabErrorBoundary>
                  </TabsContent>
                )}

                {isSuccessManager && (
                  <TabsContent value="transactions">
                    <TabErrorBoundary tabName="Transaction Management">
                      <TransactionManagementTab />
                    </TabErrorBoundary>
                  </TabsContent>
                )}
                
                {isSuccessManager && (
                  <TabsContent value="payments">
                    <TabErrorBoundary tabName="Manual Payment Approvals">
                      {staffSession?.id && (
                        <ManualPaymentApprovalTab 
                          staffId={staffSession.id}
                          staffName={staffDisplayName}
                        />
                      )}
                    </TabErrorBoundary>
                  </TabsContent>
                )}
                
                {isSuccessManager && (
                  <TabsContent value="property-referrals">
                    <TabErrorBoundary tabName="Property Referrals">
                      {staffSession?.id && (
                        <PropertyReferralsManagementTab 
                          staffId={staffSession.id}
                          staffName={staffDisplayName}
                        />
                      )}
                    </TabErrorBoundary>
                  </TabsContent>
                )}

                {isSuccessManager && (
                  <TabsContent value="referrals">
                    <TabErrorBoundary tabName="Client Referral Analytics">
                      <ReferralAnalyticsTab />
                    </TabErrorBoundary>
                  </TabsContent>
                )}

                
                <TabsContent value="penny-ai">
                  <TabErrorBoundary tabName="Penny AI">
                    {staffSession?.id && (
                      <PennyAIConsolidatedTab 
                        staffId={staffSession.id}
                        staffName={staffDisplayName}
                      />
                    )}
                  </TabErrorBoundary>
                </TabsContent>


              </Tabs>
            </TabErrorBoundary>
          </TabsContent>


          {/* Deal Flow & Marketplace Tab - Unified */}
          <TabsContent value="dealflow" role="tabpanel" aria-label="Deal flow and marketplace management">
            <TabErrorBoundary tabName="Deal Flow & Marketplace">
              <Tabs defaultValue="pipeline" className="space-y-4" activationMode="manual">

                <TabsList aria-label="Deal flow sub-sections" className="flex-wrap h-auto">
                  <TabsTrigger value="pipeline">Deal Pipeline</TabsTrigger>
                  <TabsTrigger value="published">Published Deals</TabsTrigger>
                  <TabsTrigger value="archived">Archived Deals</TabsTrigger>
                  {isSuccessManager && (
                    <TabsTrigger value="marketplace" className="relative">
                      Marketplace Verifications
                      <Badge className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0">Success Team</Badge>
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="pipeline">
                  <TabErrorBoundary tabName="Deal Pipeline">
                    <DealFlowTab 
                      userRole={isSuccessManager ? 'Success_Manager' : isAcquisitionManager ? 'Acquisition_Manager' : 'Setup_Manager'}
                      staffId={staffSession?.id}
                      staffName={staffDisplayName}
                    />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="published">
                  <TabErrorBoundary tabName="Published Deals">
                    <PublishedDealsTab 
                      staffId={staffSession?.id}
                      staffName={staffDisplayName}
                      userRole={isSuccessManager ? 'Success_Manager' : isAcquisitionManager ? 'Acquisition_Manager' : 'Setup_Manager'}
                    />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="archived">
                  <TabErrorBoundary tabName="Archived Deals">
                    <ArchivedDealsTab 
                      staffId={staffSession?.id}
                      staffName={staffDisplayName}
                      userRole={isSuccessManager ? 'Success_Manager' : isAcquisitionManager ? 'Acquisition_Manager' : 'Setup_Manager'}
                    />
                  </TabErrorBoundary>
                </TabsContent>
                {isSuccessManager && (
                  <TabsContent value="marketplace">
                    <TabErrorBoundary tabName="Marketplace Verifications">
                      <MarketplaceVerificationsTab />
                    </TabErrorBoundary>
                  </TabsContent>
                )}
              </Tabs>
            </TabErrorBoundary>
          </TabsContent>





          {/* Investors Tab - UNIFIED: Management + Invitations + Credits + Portfolio + Inquiries */}
          <TabsContent value="investors" role="tabpanel" aria-label="Investor management">
            <TabErrorBoundary tabName="Investor Management">
              <Tabs defaultValue="management" className="space-y-4" activationMode="manual">

                <TabsList aria-label="Investor sub-sections" className="flex-wrap h-auto">
                  <TabsTrigger value="management">Management</TabsTrigger>
                  <TabsTrigger value="invitations">Invite Investors</TabsTrigger>
                  <TabsTrigger value="manage-portfolios">Manage Portfolios</TabsTrigger>
                  <TabsTrigger value="credits">Credits</TabsTrigger>
                  <TabsTrigger value="pending-credits">Pending Credits</TabsTrigger>
                  <TabsTrigger value="portfolio">Portfolio Approvals</TabsTrigger>
                  <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
                </TabsList>
                <TabsContent value="management">
                  <TabErrorBoundary tabName="Investor Management List">
                    <InvestorManagementTab />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="invitations">
                  <TabErrorBoundary tabName="Investor Invitations">
                    <InvestorInvitationTab />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="manage-portfolios">
                  <TabErrorBoundary tabName="Manage Portfolios">
                    {staffSession?.id && (
                      <StaffPortfolioEditor
                        staffId={staffSession.id}
                        staffName={staffDisplayName}
                      />
                    )}
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="credits">
                  <TabErrorBoundary tabName="Investor Credits">
                    <InvestorCreditsTab />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="pending-credits">
                  <TabErrorBoundary tabName="Pending Portfolio Credits">
                    {staffSession?.id && (
                      <PendingCreditsWidget 
                        staffId={staffSession.id}
                        staffName={staffDisplayName}
                      />
                    )}
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="portfolio">
                  <TabErrorBoundary tabName="Portfolio Approvals">
                    <PortfolioApprovalsTab />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="inquiries">
                  <TabErrorBoundary tabName="Deal Inquiries">
                    <DealInquiriesTab />
                  </TabErrorBoundary>
                </TabsContent>
              </Tabs>
            </TabErrorBoundary>
          </TabsContent>





          {/* Content Tab */}
          <TabsContent value="content" role="tabpanel" aria-label="Content management">
            <TabErrorBoundary tabName="Content Management">
              <Tabs defaultValue="articles" className="space-y-4" activationMode="manual">

                <TabsList aria-label="Content sub-sections">
                  <TabsTrigger value="articles">Articles</TabsTrigger>
                  <TabsTrigger value="ai-generator">AI Generator</TabsTrigger>
                  <TabsTrigger value="products">Products</TabsTrigger>
                </TabsList>
                <TabsContent value="articles">
                  <TabErrorBoundary tabName="Blog Articles">
                    <BlogArticlesTab
                      draftArticles={draftArticles}
                      generatingArticles={generatingArticles}
                      syncingArticles={syncingArticles}
                      onGenerateArticles={generateNewArticles}
                      onSyncStaticArticles={syncStaticArticles}
                      onArticleAction={handleArticleAction}
                      onArticleEdit={handleArticleEdit}
                      onArticlePreview={handleArticlePreview}
                    />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="ai-generator">
                  <TabErrorBoundary tabName="AI Content Generator">
                    <AIContentGenerator />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="products">
                  <TabErrorBoundary tabName="Digital Products">
                    <Card>
                      <CardHeader>
                        <CardTitle>Digital Products</CardTitle>
                        <CardDescription>Upload PDFs, spreadsheets, and documents</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleUpload} className="space-y-4 mb-8 p-4 bg-gray-50 rounded-lg">
                          <div>
                            <Label htmlFor="product-title">Title</Label>
                            <Input id="product-title" name="title" required aria-required="true" />
                          </div>
                          <div>
                            <Label htmlFor="product-description">Description</Label>
                            <Textarea id="product-description" name="description" required aria-required="true" />
                          </div>
                          <div>
                            <Label htmlFor="product-category">Category</Label>
                            <Input id="product-category" name="category" placeholder="e.g., Market Analysis, Templates" required aria-required="true" />
                          </div>
                          <div>
                            <Label htmlFor="product-file">File (PDF, CSV, XLSX, DOCX)</Label>
                            <Input 
                              id="product-file" 
                              type="file" 
                              accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.txt" 
                              onChange={(e) => setUploadFile(e.target.files?.[0] || null)} 
                              required 
                              aria-required="true"
                            />
                          </div>
                          <Button type="submit" className="bg-[#d4a574]">
                            <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                            Upload Product
                          </Button>
                        </form>

                        <div className="space-y-4" role="list" aria-label="Digital products">
                          {(!Array.isArray(products) || products.length === 0) ? (
                            <p className="text-center text-gray-500 py-8">No digital products uploaded yet.</p>
                          ) : (
                            products.map(product => (
                              <article key={product.id} className="border p-4 rounded-lg bg-white flex justify-between items-start" role="listitem">
                                <div className="flex-1">
                                  <p className="font-semibold text-lg">{product.title}</p>
                                  <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                                  <p className="text-xs text-gray-500 mt-2">
                                    Category: {product.category} â€¢ File: {product.file_name}
                                  </p>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => window.open(product.file_url, '_blank')}
                                    aria-label={`Download ${product.title}`}
                                  >
                                    <Download className="w-4 h-4" aria-hidden="true" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="destructive" 
                                    onClick={() => handleDeleteClick(product)}
                                    aria-label={`Delete ${product.title}`}
                                  >
                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                  </Button>
                                </div>
                              </article>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabErrorBoundary>
                </TabsContent>
              </Tabs>
            </TabErrorBoundary>
          </TabsContent>


          {/* Communications Tab */}
          <TabsContent value="communications" role="tabpanel" aria-label="Communications management">
            <TabErrorBoundary tabName="Communications">
              <Tabs defaultValue="templates" className="space-y-4" activationMode="manual">

                <TabsList aria-label="Communications sub-sections" className="flex-wrap h-auto">
                  <TabsTrigger value="templates">Email Templates</TabsTrigger>
                  <TabsTrigger value="builder">Template Builder</TabsTrigger>
                  <TabsTrigger value="campaigns">Bulk Campaigns</TabsTrigger>
                  <TabsTrigger value="delivery">Delivery Logs</TabsTrigger>
                  <TabsTrigger value="sms">SMS Logs</TabsTrigger>
                  <TabsTrigger value="followups">Follow-ups</TabsTrigger>
                </TabsList>
                <TabsContent value="templates">
                  <TabErrorBoundary tabName="Email Templates">
                    <EmailTemplatesTab />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="builder">
                  <TabErrorBoundary tabName="Template Builder">
                    <EmailTemplateBuilder />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="campaigns">
                  <TabErrorBoundary tabName="Bulk Email Campaigns">
                    <BulkEmailCampaign />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="delivery">
                  <TabErrorBoundary tabName="Email Delivery Logs">
                    <EmailDeliveryTab />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="sms">
                  <TabErrorBoundary tabName="SMS Logs">
                    <SMSLogsTab />
                  </TabErrorBoundary>
                </TabsContent>
                <TabsContent value="followups">
                  <TabErrorBoundary tabName="Follow-up Rules">
                    <FollowupRulesTab />
                  </TabErrorBoundary>
                </TabsContent>
              </Tabs>
            </TabErrorBoundary>
          </TabsContent>

          {/* Documents Tab - FIXED: Using controlled state component, no nested Radix Tabs context conflicts */}
          <TabsContent value="documents" role="tabpanel" aria-label="Documents and agreements">
            <TabErrorBoundary tabName="Documents & Agreements">
              <Suspense fallback={<TabSkeleton />}>
                {staffSession?.id ? (
                  <DocumentsTabContent staffId={staffSession.id} staffName={staffDisplayName} />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-gray-500">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#d4a574]" />
                      <p>Loading staff session...</p>
                    </CardContent>
                  </Card>
                )}
              </Suspense>
            </TabErrorBoundary>
          </TabsContent>





          {/* Staff Management Tab - UNIFIED: Staff + AM Management + Certifications */}
          <TabsContent value="staff" role="tabpanel" aria-label="Staff management">
            <TabErrorBoundary tabName="Staff Management">
              <div className="space-y-6">
                {staffSession?.id && (
                  <TabErrorBoundary tabName="Account Link Suggestions">
                    <AccountLinkSuggestionsBanner 
                      staffId={staffSession.id}
                      onLinkAccepted={() => {
                        const stored = localStorage.getItem('staffSession');
                        if (stored) {
                          const data = JSON.parse(stored);
                          setStaffSession({ ...data, linked_investor_id: true });
                        }
                      }}
                    />
                  </TabErrorBoundary>
                )}
                {isSuccessManager && (
                  <TabErrorBoundary tabName="Email Match Migration">
                    <EmailMatchMigrationTool />
                  </TabErrorBoundary>
                )}
                
                {/* Sub-tabs for Staff Management */}
                <Tabs defaultValue="team" className="space-y-4" activationMode="manual">

                  <TabsList aria-label="Staff management sub-sections" className="flex-wrap h-auto">
                    <TabsTrigger value="team">Team Members</TabsTrigger>
                    <TabsTrigger value="am-assignments">AM Assignments</TabsTrigger>
                    <TabsTrigger value="sm-assignments">SM Assignments</TabsTrigger>
                    <TabsTrigger value="unassigned">Unassigned Investors</TabsTrigger>
                    <TabsTrigger value="verifications">AM Verifications</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="team">
                    <TabErrorBoundary tabName="Team Members">
                      <StaffManagementTab 
                        currentStaffId={staffSession?.id}
                        isSuccessManager={isSuccessManager}
                      />
                    </TabErrorBoundary>
                  </TabsContent>
                  
                  <TabsContent value="am-assignments">
                    <TabErrorBoundary tabName="AM Assignment Requests">
                      {staffSession?.id && (
                        <AMAssignmentRequestsTab 
                          staffId={staffSession.id}
                          staffName={staffDisplayName}
                        />
                      )}
                    </TabErrorBoundary>
                  </TabsContent>
                  
                  <TabsContent value="sm-assignments">
                    <TabErrorBoundary tabName="SM Assignments">
                      {staffSession?.id && (
                        <SMAssignmentTab 
                          staffId={staffSession.id}
                          staffName={staffDisplayName}
                        />
                      )}
                    </TabErrorBoundary>
                  </TabsContent>
                  
                  <TabsContent value="unassigned">
                    <TabErrorBoundary tabName="Unassigned Investors">
                      {staffSession?.id && (
                        <InvestorsWithoutAMWidget staffId={staffSession.id} onCountChange={setUnassignedInvestorCount} />

                      )}
                    </TabErrorBoundary>
                  </TabsContent>
                  
                  <TabsContent value="verifications">
                    <TabErrorBoundary tabName="AM Verifications">
                      {staffSession?.id && (
                        <AMVerificationRequests staffId={staffSession.id} />
                      )}
                    </TabErrorBoundary>
                  </TabsContent>
                </Tabs>
              </div>
            </TabErrorBoundary>
          </TabsContent>



          {/* My Setup Projects Tab - Setup Managers only */}
          <TabsContent value="my-setups" role="tabpanel" aria-label="My setup projects">
            <TabErrorBoundary tabName="My Setup Projects">
              {staffSession?.id && (
                <MySetupProjectsTab 
                  staffId={staffSession.id}
                  staffName={staffDisplayName}
                />
              )}
            </TabErrorBoundary>
          </TabsContent>


          {/* Setup Manager Dashboard - Clearly labeled */}
          <TabsContent value="setups" role="tabpanel" aria-label="Setup Manager Dashboard">
            <TabErrorBoundary tabName="Setup Manager Dashboard">
              <Card className="mb-6 border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                      <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-emerald-900">Setup Manager Dashboard</CardTitle>
                      <CardDescription className="text-emerald-700">
                        Manage property setups, furniture procurement, and quality inspections
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
              <SetupManagementDashboard 
                currentStaffId={staffSession?.id}
                currentStaffName={staffDisplayName}
              />
            </TabErrorBoundary>
          </TabsContent>


          {/* Disputes Tab */}
          <TabsContent value="disputes" role="tabpanel" aria-label="Dispute resolution">
            <TabErrorBoundary tabName="Dispute Resolution">
              {staffSession?.id && (
                <DisputeManagementTab 
                  staffId={staffSession.id} 
                  staffName={staffDisplayName} 
                />
              )}
            </TabErrorBoundary>
          </TabsContent>

          {/* My Investors Tab */}
          <TabsContent value="my-investors" role="tabpanel" aria-label="My assigned investors">
            <TabErrorBoundary tabName="My Assigned Investors">
              {staffSession?.id && (
                <AssignedInvestorsTab 
                  staffId={staffSession.id}
                  staffName={staffDisplayName}
                />
              )}
            </TabErrorBoundary>
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support" role="tabpanel" aria-label="Support requests">
            <TabErrorBoundary tabName="Support Requests">
              {staffSession?.id && (
                <SupportRequestsTab 
                  staffId={staffSession.id}
                  staffName={staffDisplayName}
                />
              )}
            </TabErrorBoundary>
          </TabsContent>

          {/* SOPs Tab */}
          <TabsContent value="sops" role="tabpanel" aria-label="Standard Operating Procedures">
            <TabErrorBoundary tabName="Standard Operating Procedures">
              {staffSession && (
                <SOPWorkflowsTab 
                  userRole={isSuccessManager ? 'Success_Team' : isAcquisitionManager ? 'Acquisition_Manager' : 'Setup_Manager'}
                  userName={staffDisplayName}
                  staffId={staffSession.id}
                />
              )}
            </TabErrorBoundary>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" role="tabpanel" aria-label="Account settings">
            <TabErrorBoundary tabName="Account Settings">
              {staffSession && (
                <StaffSettingsTab 
                  staffSession={staffSession} 
                  onSessionUpdate={(updated) => {
                    setStaffSession(updated);
                    localStorage.setItem('staffSession', JSON.stringify(updated));
                  }}
                  isSuccessManager={isSuccessManager || false}
                />
              )}
            </TabErrorBoundary>

          </TabsContent>

          {/* HR & Commissions Tab - Rendered directly to bypass Radix Tabs rendering issues on mobile */}
          <TabsContent value="hr-commissions" forceMount className={activeTab === 'hr-commissions' ? '' : 'hidden'} role="tabpanel" aria-label="HR and commissions">
            <TabErrorBoundary tabName="HR & Commissions">
              {staffSession?.id && (
                <HRCommissionDashboard
                  staffId={staffSession.id}
                  staffName={`${staffSession.first_name || ''} ${staffSession.last_name || ''}`.trim() || 'Staff'}
                  isAdmin={isAdmin}
                />
              )}
            </TabErrorBoundary>
          </TabsContent>



          {/* Landlord Operations Tab */}
          <TabsContent value="landlord-ops" role="tabpanel" aria-label="Landlord operations">
            <TabErrorBoundary tabName="Landlord Operations">
              {staffSession?.id && (
                <LandlordOperationsTab
                  staffId={staffSession.id}
                  staffName={staffDisplayName}
                  isAdmin={activeDashboard === 'success'}
                  userRole={isSuccessManager ? 'Success_Manager' : isAcquisitionManager ? 'Acquisition_Manager' : 'Setup_Manager'}
                />
              )}
            </TabErrorBoundary>
          </TabsContent>

          {/* Weekly Digest Manager Tab - Success Team Only */}
          {isSuccessManager && (
            <TabsContent value="weekly-digest" role="tabpanel" aria-label="Weekly Digest Manager">
              <TabErrorBoundary tabName="Weekly Digest Manager">
                <WeeklyDigestManager />
              </TabErrorBoundary>
            </TabsContent>
          )}

        </Tabs>


        </Suspense>



        {/* Messages Dialog */}
        <Dialog open={messagesOpen} onOpenChange={setMessagesOpen}>
          <DialogContent 
            className="max-w-2xl max-h-[80vh] overflow-y-auto" 
            aria-describedby="messages-description"
          >
            <DialogHeader>
              <DialogTitle>Staff Messages</DialogTitle>
              <DialogDescription id="messages-description">
                Internal messaging with SMS notifications
              </DialogDescription>
            </DialogHeader>
            {staffSession?.id && (
              <StaffMessaging 
                staffId={staffSession.id} 
                staffName={staffDisplayName} 
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Article Editor Modal */}
        <ArticleEditorModal
          article={editingArticle}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingArticle(null);
          }}
          onSave={handleSaveArticle}
        />

        {/* Preview Article Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent 
            className="max-w-4xl max-h-[80vh] overflow-y-auto" 
            aria-describedby="preview-description"
          >
            <DialogHeader>
              <DialogTitle>{previewArticle?.title}</DialogTitle>
              <DialogDescription id="preview-description">{previewArticle?.excerpt}</DialogDescription>
            </DialogHeader>
            {previewArticle && (
              <div className="prose prose-sm max-w-none">
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2" role="list" aria-label="Article tags">
                    {previewArticle.tags.map(tag => (
                      <Badge key={tag} variant="secondary" role="listitem">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <div dangerouslySetInnerHTML={{ __html: previewArticle.content }} className="text-gray-700" />
                {previewArticle.research_sources?.length > 0 && (
                  <div className="mt-8 pt-4 border-t">
                    <h4 className="font-semibold mb-2">Sources</h4>
                    <ul className="text-sm text-gray-600">
                      {previewArticle.research_sources.map((source, i) => (
                        <li key={i}>{source}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Product Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Digital Product</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;{productToDelete?.title}&rdquo;? This will permanently remove the file from storage. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setProductToDelete(null); }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>
      </div>
    );
}

