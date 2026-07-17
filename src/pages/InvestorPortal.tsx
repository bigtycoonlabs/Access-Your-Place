import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { PortalHeader } from '@/components/investor/PortalHeader';
import { SavedDeals } from '@/components/investor/SavedDeals';
import { InquiryTracker } from '@/components/investor/InquiryTracker';
import { GuidedOnboarding } from '@/components/investor/GuidedOnboarding';
import { AccountSettings } from '@/components/investor/AccountSettings';
import { AcquisitionsTracker } from '@/components/investor/AcquisitionsTracker';
import { MarketReportSettings } from '@/components/investor/MarketReportSettings';
import { MarketReportGenerator } from '@/components/investor/MarketReportGenerator';
import { ReportHistory } from '@/components/investor/ReportHistory';
import { ReferralProgram } from '@/components/investor/ReferralProgram';
import { DashboardWidgets } from '@/components/investor/DashboardWidgets';
import { InvestorDocuments } from '@/components/investor/InvestorDocuments';
import { InvestorMessaging } from '@/components/investor/InvestorMessaging';
import { GuidedTour } from '@/components/investor/GuidedTour';
import { ProfileProgress } from '@/components/investor/ProfileProgress';
import SessionTimeoutWarning from '@/components/investor/SessionTimeoutWarning';
import { EmailPreferences } from '@/components/investor/EmailPreferences';
import { AccountCredits } from '@/components/investor/AccountCredits';
import { AcquisitionManagerSection } from '@/components/investor/AcquisitionManagerSection';
import { SetupManagerSection } from '@/components/investor/SetupManagerSection';
import { SetupProgressTracker } from '@/components/investor/SetupProgressTracker';
import { DealMatchPreferences } from '@/components/investor/DealMatchPreferences';
import { DealAlertSettings } from '@/components/investor/DealAlertSettings';


// New consolidated components
import { UnifiedNotificationsHub } from '@/components/investor/UnifiedNotificationsHub';
import { OnboardingChecklist } from '@/components/investor/OnboardingChecklist';
import { VideoTutorials } from '@/components/investor/VideoTutorials';
import { PWAInstallBanner } from '@/components/investor/PWAInstallBanner';
import { InvestorCalendar } from '@/components/investor/InvestorCalendar';
import { InvestorTabErrorBoundary } from '@/components/investor/InvestorTabErrorBoundary';
import { PaymentHistory } from '@/components/investor/PaymentHistory';
import { PropertySearchLocator } from '@/components/investor/PropertySearchLocator';

// Push Notification Manager for native iOS/Android
import { PushNotificationManager } from '@/components/investor/PushNotificationManager';
import { unregisterDeviceToken } from '@/services/PushNotificationService';

import { DocumentSigning } from '@/components/investor/DocumentSigning';
import { PendingAgreements } from '@/components/investor/PendingAgreements';

import { DealMarketplace } from '@/components/investor/DealMarketplace';
import IssueReportForm from '@/components/investor/IssueReportForm';
import { DisputeResolutionCenter } from '@/components/investor/DisputeResolutionCenter';
import { PennyChatButton } from '@/components/PennyChatButton';
import { SkipLinks, LiveRegion } from '@/hooks/useAccessibility';
import { useSessionSync } from '@/services/SessionSyncService';
import { AccountLinkSuggestionsBanner } from '@/components/admin/AccountLinkSuggestionsBanner';
import { InvestorMobileNav, getInvestorTabs } from '@/components/investor/InvestorMobileNav';
import { InvestorLeadForge } from '@/components/investor/InvestorLeadForge';


// Lazy load heavy components for better performance
const InvestorPortfolio = lazy(() => import('@/components/investor/InvestorPortfolio').then(m => ({ default: m.InvestorPortfolio })));
const PortfolioPerformanceTracker = lazy(() => import('@/components/investor/PortfolioPerformanceTracker').then(m => ({ default: m.PortfolioPerformanceTracker })));
const RevenueForecastChart = lazy(() => import('@/components/investor/RevenueForecastChart').then(m => ({ default: m.RevenueForecastChart })));

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import Footer from '@/components/Footer';

import { 
  Loader2, Building2, Heart, MessageSquare, Mail, Calendar, 
  Settings, Briefcase, FolderOpen, FileSignature, CreditCard, 
  FileText, Gift, Scale, LayoutDashboard, Home, Store, Bell, 
  BellRing, MailOpen, ArrowRight, Sparkles, MapPin, AlertTriangle,
  Wallet, WifiOff, RefreshCw, Shield, Brain, BookOpen, CalendarDays,
  Search, X, ChevronLeft, Wrench, Zap
} from 'lucide-react';







// Loading skeleton for portfolio tab
function PortfolioSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Properties list skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <Skeleton className="w-16 h-16 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-32 mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Skeleton className="h-16 w-20 rounded-lg" />
                  <Skeleton className="h-16 w-20 rounded-lg" />
                  <Skeleton className="h-16 w-20 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Connection error component
function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="py-12 text-center">
        <WifiOff className="w-12 h-12 mx-auto text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">Connection Issue</h3>
        <p className="text-red-600 mb-4 max-w-md mx-auto">
          We're having trouble connecting to our servers. Please check your internet connection and try again.
        </p>
        <Button onClick={onRetry} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}

interface QuickActionCardProps {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: 'primary' | 'secondary' | 'accent';
  className?: string;
}

function QuickActionCard({ onClick, icon, title, description, variant = 'secondary', className = '' }: QuickActionCardProps) {

  const baseStyles = "w-full text-left p-5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variantStyles = {
    primary: "bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] text-white hover:shadow-lg focus:ring-[#d4a574]",
    secondary: "bg-white border-2 border-gray-200 hover:border-[#d4a574]/50 hover:shadow-lg focus:ring-[#d4a574]",
    accent: "bg-white border-2 border-green-200 hover:border-green-400 hover:shadow-lg focus:ring-green-500"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      aria-label={`${title}: ${description}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2" aria-hidden="true">
            {icon}
          </div>
          <h2 className={`font-semibold ${variant === 'primary' ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h2>
          <p className={`text-sm ${variant === 'primary' ? 'opacity-80' : 'text-gray-600'}`}>
            {description}
          </p>
        </div>
        {variant === 'primary' && (
          <ArrowRight className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        )}
      </div>
    </button>
  );
}

// Personalized Deal Recommendations Component
function PersonalizedRecommendations({ investor, onNavigate }: { investor: any; onNavigate: (tab: string) => void }) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    setError(false);
    setLoading(true);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const { data } = await supabase.functions.invoke('get-properties', {
        body: { 
          action: 'get_recommended',
          investor_id: investor.id,
          preferred_markets: investor.preferred_markets || [],
          budget_min: investor.investment_budget_min,
          budget_max: investor.investment_budget_max,
          operation_types: investor.preferred_operation_types || [],
          limit: 3
        }
      });
      
      clearTimeout(timeoutId);
      
      const props = Array.isArray(data?.properties) ? data.properties : [];
      setRecommendations(props);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error('Recommendations request timed out');
      } else {
        console.error('Error fetching recommendations:', err);
      }
      setError(true);
    }
    setLoading(false);
  }, [investor]);

  useEffect(() => {
    if (investor.preferred_markets?.length > 0 || investor.investment_budget_max) {
      fetchRecommendations();
    } else {
      setLoading(false);
    }
  }, [investor, fetchRecommendations]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border rounded-lg">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-amber-200">
        <CardContent className="py-6 text-center">
          <p className="text-amber-700 mb-2">Unable to load recommendations</p>
          <Button variant="outline" size="sm" onClick={fetchRecommendations}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!investor.preferred_markets?.length && !investor.investment_budget_max) {
    return (
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Personalized Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Complete your profile to get personalized deal recommendations based on your investment preferences.
          </p>
          <Button 
            onClick={() => onNavigate('settings')}
            className="bg-[#d4a574] hover:bg-[#c49464]"
          >
            Complete Profile
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#d4a574]" />
            Recommended For You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            No matching deals found right now. We'll notify you when new deals match your criteria!
          </p>
          <Button 
            variant="outline"
            onClick={() => onNavigate('deal-alerts')}
            className="mt-3"
          >
            <Bell className="w-4 h-4 mr-2" />
            Set Up Deal Alerts
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#d4a574]" />
            Recommended For You
          </CardTitle>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            Based on your preferences
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {(Array.isArray(recommendations) ? recommendations : []).map((deal: any) => (
            <div 
              key={deal.id}
              className="p-4 border rounded-lg hover:border-[#d4a574] transition-colors cursor-pointer"
              onClick={() => window.location.href = '/deals'}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <MapPin className="w-3 h-3" />
                  <span>{deal.city}, {deal.state}</span>
                </div>
                {deal.match_score && (
                  <Badge className="bg-green-100 text-green-700 text-xs">
                    {deal.match_score}% match
                  </Badge>
                )}
              </div>
              <p className="font-semibold text-gray-900">
                {deal.bedrooms} bed / {deal.bathrooms} bath
              </p>
              <p className="text-sm text-gray-500">{deal.property_type || 'Single Family'}</p>
              <div className="mt-2 pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Monthly Rent</span>
                  <span className="font-semibold text-green-600">
                    ${deal.monthly_rent?.toLocaleString() || 'TBD'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link to="/deals">
            <Button className="bg-[#d4a574] hover:bg-[#c49464]">
              View All Deals
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InvestorPortal() {
  const [investor, setInvestor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingData, setBookingData] = useState<any>(null);
  const [bookingForm, setBookingForm] = useState({ preferred_date: '', preferred_time: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [announcement, setAnnouncement] = useState('');
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Initialize session - check localStorage and validate with timeout
  const initializeSession = useCallback(async () => {
    setLoading(true);
    setConnectionError(false);
    
    const stored = localStorage.getItem('investorSession');
    if (!stored) {
      navigate('/investor/login');
      return;
    }
    
    try {
      const investorData = JSON.parse(stored);
      
      // Check "Remember Me" flag to determine session max age
      const rememberMe = localStorage.getItem('investorRememberMe') === 'true';
      const maxAge = rememberMe 
        ? 30 * 24 * 60 * 60 * 1000  // 30 days if "Remember Me" was checked
        : 24 * 60 * 60 * 1000;       // 24 hours default
      
      const sessionAge = Date.now() - (investorData.loginTime || 0);
      
      if (sessionAge > maxAge) {
        console.log(`Session expired (age: ${Math.round(sessionAge / 3600000)}h, max: ${Math.round(maxAge / 3600000)}h, rememberMe: ${rememberMe})`);
        localStorage.removeItem('investorSession');
        localStorage.removeItem('investorSessionToken');
        localStorage.removeItem('investorRememberMe');
        navigate('/investor/login', { 
          state: { 
            message: 'Your session has expired. Please sign in again.', 
            type: 'timeout' 
          } 
        });
        return;
      }
      
      setInvestor(investorData);
      
      // Refresh loginTime to extend session on active use
      const updatedData = { ...investorData, loginTime: Date.now() };
      localStorage.setItem('investorSession', JSON.stringify(updatedData));
      
      // Check if we should show the guided tour
      const tourCompleted = localStorage.getItem(`tour_completed_${investorData.id}`);
      if (investorData.show_guided_tour && !tourCompleted) {
        setShowGuidedTour(true);
      }
    } catch (err) {
      console.error('Error parsing investor session:', err);
      localStorage.removeItem('investorSession');
      navigate('/investor/login');
    }
    
    setLoading(false);
  }, [navigate]);


  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Announce tab changes to screen readers

  useEffect(() => {
    if (activeTab) {
      const tabNames: Record<string, string> = {
        'dashboard': 'Dashboard',
        'portfolio': 'Portfolio',
        'marketplace': 'Marketplace',
        'property-search': 'Property Search',
        'notifications-hub': 'Notifications & Alerts Hub',
        'deal-alerts': 'Deal Alert Settings',
        'email-preferences': 'Email Preferences',
        'saved': 'Saved Deals',
        'inquiries': 'Inquiries',
        'messages': 'Messages',
        'acquisitions': 'Acquisitions',
        'setup': 'Property Setup',
        'documents': 'Documents',
        'signatures': 'Document Signatures',
        'deal-matching': 'Deal Matching',
        'financial': 'Financial Hub',
        'calendar': 'Calendar & Milestones',
        'tutorials': 'Video Tutorials',
        'reports': 'Market Reports',
        'referrals': 'Referral Program',
        'disputes': 'Dispute Resolution',
        'settings': 'Account Settings',
        'leadforge': 'LeadForge'
      };
      const name = tabNames[activeTab] || activeTab;
      setAnnouncement(`Navigated to ${name} tab`);
    }

  }, [activeTab]);




  const handleTourComplete = useCallback(() => {
    setShowGuidedTour(false);
    if (investor?.id) {
      localStorage.setItem(`tour_completed_${investor.id}`, 'true');
    }
  }, [investor?.id]);

  const handleBookCall = useCallback((data: any) => { 
    setBookingData(data); 
    setBookingOpen(true); 
  }, []);
  
  // Logout using investor-login function with logout action
  // Logout using investor-login function with logout action
  const handleLogout = useCallback(async () => {
    // Unregister push notification token before logout
    if (investor?.id) {
      try {
        await unregisterDeviceToken(investor.id);
      } catch (err) {
        console.error('Push token unregister error:', err);
      }
    }
    
    try {
      const sessionToken = localStorage.getItem('investorSessionToken');
      if (sessionToken) {
        // Call the investor-login function with logout action
        await supabase.functions.invoke('investor-login', {
          body: { 
            action: 'logout',
            session_token: sessionToken
          }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
    
    // Clear local storage regardless of API result
    localStorage.removeItem('investorSession');
    localStorage.removeItem('investorSessionToken');
    localStorage.removeItem('staffSessionBackup'); // Clear any staff session backup
    localStorage.removeItem('pushNotificationToken');
    localStorage.removeItem('pushTokenInvestorId');
    navigate('/investor/login'); 
  }, [navigate, investor?.id]);

  
  const handleUpdateInvestor = useCallback((updated: any) => { 
    setInvestor(updated); 
    localStorage.setItem('investorSession', JSON.stringify({
      ...updated,
      loginTime: Date.now()
    })); 
    
    // Show guided tour after onboarding
    if (updated.show_guided_tour) {
      const tourCompleted = localStorage.getItem(`tour_completed_${updated.id}`);
      if (!tourCompleted) {
        setShowGuidedTour(true);
      }
    }
  }, []);

  const submitBooking = async () => {
    setSubmitting(true);
    setAnnouncement('Scheduling your call, please wait...');
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      await supabase.functions.invoke('book-discovery-call', {
        body: { 
          investor_id: investor.id, 
          property_id: bookingData?.property?.id, 
          search_result_data: bookingData?.property, 
          request_type: bookingData?.type || 'general', 
          ...bookingForm 
        }
      });
      
      clearTimeout(timeoutId);
      toast({ title: 'Call Scheduled!', description: 'An acquisition manager will contact you soon.' });
      setAnnouncement('Call scheduled successfully. An acquisition manager will contact you soon.');
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        toast({ title: 'Request Timeout', description: 'The request took too long. Please try again.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to schedule call. Please try again.', variant: 'destructive' });
      }
      setAnnouncement('Failed to schedule call. Please try again.');
    }
    setSubmitting(false); 
    setBookingOpen(false); 
    setBookingForm({ preferred_date: '', preferred_time: '', notes: '' });
  };

  // Show loading state with skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header skeleton */}
        <div className="bg-white border-b px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Welcome skeleton */}
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-5 w-80" />
          </div>
          
          {/* Quick actions skeleton */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-8 w-8 rounded-lg mb-3" />
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </Card>
            ))}
          </div>
          
          {/* Tabs skeleton */}
          <Skeleton className="h-12 w-full mb-6 rounded-lg" />
          
          {/* Content skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-60 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Show connection error
  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <ConnectionError onRetry={initializeSession} />
      </div>
    );
  }

  if (!investor) return null;
  
  if (!investor.onboarding_completed) {
    return <GuidedOnboarding investor={investor} onComplete={handleUpdateInvestor} />;
  }


  const firstName = investor.full_name?.split(' ')[0] || 'Investor';

  // Email verification banner component - uses investor-session for resend
  const EmailVerificationBanner = () => {
    const [resending, setResending] = useState(false);
    
    const handleResendVerification = async () => {
      setResending(true);
      try {
        // Use the new investor-session function with resend_verification action
        // Pass email instead of investor_id as per edge function API
        const { data } = await supabase.functions.invoke('investor-session', {
          body: { 
            action: 'resend_verification', 
            email: investor.email, 
            base_url: window.location.origin 
          }
        });
        if (data?.success) {
          toast({ title: 'Verification Email Sent', description: 'Please check your inbox and spam folder.' });
        } else {
          toast({ title: 'Error', description: data?.error || 'Failed to send email', variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to send verification email', variant: 'destructive' });
      }
      setResending(false);
    };


    if (investor.email_verified) return null;

    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Please verify your email address</p>
            <p className="text-sm text-amber-600">Check your inbox for a verification link to unlock all features.</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleResendVerification}
          disabled={resending}
          className="border-amber-300 text-amber-700 hover:bg-amber-100"
        >
          {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resend Email'}
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Push Notification Manager - registers tokens and handles deep linking */}
      <PushNotificationManager
        investorId={investor.id}
        investorName={investor.full_name || 'Investor'}
        onNavigateToTab={setActiveTab}
      />

      {/* Session Timeout Warning - silently refreshes every 15 minutes while active */}
      <SessionTimeoutWarning 
        warningTime={5 * 60 * 1000} // Show warning 5 minutes before expiration
        silentRefreshInterval={15 * 60 * 1000} // Silently refresh every 15 minutes if active
        onSessionExpired={handleLogout}
      />


      {/* Guided Tour Modal */}
      {showGuidedTour && (
        <GuidedTour 
          onComplete={handleTourComplete}
          onNavigate={setActiveTab}
        />
      )}

      {/* Skip Links for keyboard navigation */}
      <SkipLinks />
      
      {/* Live region for screen reader announcements */}
      <LiveRegion message={announcement} />

      <PortalHeader 
        investor={investor} 
        onSettingsClick={() => setActiveTab('settings')} 
        onMessagesClick={() => setActiveTab('messages')}
      />
      
      {/* Full-screen tab close bar - shown when a non-dashboard tab is active */}
      {activeTab !== 'dashboard' && (
        <div className="sticky top-0 z-40 bg-[#1a365d] text-white shadow-lg" role="navigation" aria-label="Tab navigation bar">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('dashboard')}
                className="text-white hover:bg-white/20 gap-2"
                aria-label="Close this tab and return to dashboard"
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div className="h-5 w-px bg-white/30" aria-hidden="true" />
              <h2 className="text-sm font-medium text-white/90">
                {({
                  'portfolio': 'Portfolio',
                  'marketplace': 'Marketplace',
                  'property-search': 'Property Search',
                  'notifications-hub': 'Notifications & Alerts',
                  'saved': 'Saved Deals',
                  'inquiries': 'Inquiries',
                  'messages': 'Messages',
                  'acquisitions': 'Acquisitions',
                  'documents': 'Documents',
                  'signatures': 'Signatures',
                  'deal-matching': 'Deal Matching',
                  'deal-alerts': 'Deal Alerts',
                  'financial': 'Financial Hub',
                  'calendar': 'Calendar',
                  'reports': 'Market Reports',
                  'referrals': 'Referrals',
                  'disputes': 'Disputes',
                  'tutorials': 'Tutorials',
                  'email-preferences': 'Email Preferences',
                  'settings': 'Settings',
                  'issues': 'Report Issue'
                } as Record<string, string>)[activeTab] || activeTab}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('dashboard')}
              className="text-white hover:bg-white/20"
              aria-label="Close tab"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      <main id="main-content" className={`mx-auto px-4 py-8 ${activeTab === 'dashboard' ? 'max-w-7xl' : 'max-w-7xl'}`} role="main" aria-label="Investor Portal Dashboard">
        {/* Email Verification Banner */}
        <EmailVerificationBanner />
        
        {/* Dashboard header, quick actions, and tab list - only shown on dashboard */}
        {activeTab === 'dashboard' && (
          <>
            <header className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {firstName}!
              </h1>
              <p className="text-gray-600">
                Track your acquisitions and discover new opportunities
              </p>
              
              {/* Priority Investor Badge */}
              {investor.deals_closed > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Priority Investor — Expedited Address Access
                </div>
              )}
            </header>

            {/* TOS Compliance Banner */}
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-medium text-sm">Important Compliance Notice</p>
                  <p className="text-amber-700 text-sm mt-1">
                    Unauthorized landlord outreach before formal Success Team introduction is a violation of our Terms of Service and grounds for immediate platform ban. 
                    All property inquiries must go through your assigned acquisition manager.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions - 3 cards */}
            <nav className="grid md:grid-cols-3 gap-4 mb-8" aria-label="Quick actions">
              <QuickActionCard
                onClick={() => navigate('/deals')}
                icon={<Building2 className="w-8 h-8 text-[#d4a574]" />}
                title="Active Deal Flow"
                description="Pre-verified properties"
                variant="primary"
              />
              
              <QuickActionCard
                onClick={() => setActiveTab('marketplace')}
                icon={<Store className="w-8 h-8 text-green-600" />}
                title="Sell Your Operation"
                description="List deals for sale"
                variant="accent"
              />
              
              <QuickActionCard
                onClick={() => handleBookCall({ type: 'general' })}
                icon={<Calendar className="w-8 h-8 text-[#d4a574]" />}
                title="Book a Call"
                description="Speak with an expert"
                variant="secondary"
              />
            </nav>
          </>
        )}



        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="space-y-6"
          activationMode="manual"
        >
          {activeTab === 'dashboard' && (
            <>
              {/* Mobile Navigation - dropdown menu for small screens */}
              <InvestorMobileNav
                items={getInvestorTabs()}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {/* Desktop Navigation - horizontal tab bar, hidden on mobile */}
              <div className="hidden md:block" role="region" aria-label="Dashboard navigation">
                <TabsList 
                  className="bg-white shadow flex-wrap h-auto p-1 gap-1" 
                  aria-label="Dashboard navigation tabs"
                >
                  <TabsTrigger value="dashboard" className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                    <span>Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="portfolio" className="flex items-center gap-2">
                    <Home className="w-4 h-4" aria-hidden="true" />
                    <span>Portfolio</span>
                  </TabsTrigger>
                  <TabsTrigger value="marketplace" className="flex items-center gap-2">
                    <Store className="w-4 h-4" aria-hidden="true" />
                    <span>Marketplace</span>
                  </TabsTrigger>
                  <TabsTrigger value="property-search" className="flex items-center gap-2">
                    <Search className="w-4 h-4" aria-hidden="true" />
                    <span>Property Search</span>
                  </TabsTrigger>
                  <TabsTrigger value="notifications-hub" className="flex items-center gap-2">
                    <Bell className="w-4 h-4" aria-hidden="true" />
                    <span>Notifications</span>
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="flex items-center gap-2">
                    <Heart className="w-4 h-4" aria-hidden="true" />
                    <span>Saved</span>
                  </TabsTrigger>
                  <TabsTrigger value="inquiries" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" aria-hidden="true" />
                    <span>Inquiries</span>
                  </TabsTrigger>
                  <TabsTrigger value="messages" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    <span>Messages</span>
                  </TabsTrigger>
                  <TabsTrigger value="acquisitions" className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" aria-hidden="true" />
                    <span>Acquisitions</span>
                  </TabsTrigger>
                  <TabsTrigger value="setup" className="flex items-center gap-2">
                    <Wrench className="w-4 h-4" aria-hidden="true" />
                    <span>Property Setup</span>
                  </TabsTrigger>

                  <TabsTrigger value="documents" className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" aria-hidden="true" />
                    <span>Documents</span>
                  </TabsTrigger>
                  <TabsTrigger value="signatures" className="flex items-center gap-2">
                    <FileSignature className="w-4 h-4" aria-hidden="true" />
                    <span>Signatures</span>
                  </TabsTrigger>
                  <TabsTrigger value="deal-matching" className="flex items-center gap-2">
                    <Brain className="w-4 h-4" aria-hidden="true" />
                    <span>Deal Matching</span>
                  </TabsTrigger>
                  <TabsTrigger value="deal-alerts" className="flex items-center gap-2">
                    <BellRing className="w-4 h-4" aria-hidden="true" />
                    <span>Deal Alerts</span>
                  </TabsTrigger>
                  <TabsTrigger value="financial" className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" aria-hidden="true" />
                    <span>Financial</span>
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" aria-hidden="true" />
                    <span>Calendar</span>
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    <span>Reports</span>
                  </TabsTrigger>
                  <TabsTrigger value="referrals" className="flex items-center gap-2">
                    <Gift className="w-4 h-4" aria-hidden="true" />
                    <span>Referrals</span>
                  </TabsTrigger>
                  <TabsTrigger value="disputes" className="flex items-center gap-2">
                    <Scale className="w-4 h-4" aria-hidden="true" />
                    <span>Disputes</span>
                  </TabsTrigger>
                  <TabsTrigger value="tutorials" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" aria-hidden="true" />
                    <span>Tutorials</span>
                  </TabsTrigger>
                  <TabsTrigger value="email-preferences" className="flex items-center gap-2">
                    <MailOpen className="w-4 h-4" aria-hidden="true" />
                    <span>Email</span>
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex items-center gap-2">
                    <Settings className="w-4 h-4" aria-hidden="true" />
                    <span>Settings</span>
                  </TabsTrigger>
                  <TabsTrigger value="leadforge" className="flex items-center gap-2">
                    <Zap className="w-4 h-4" aria-hidden="true" />
                    <span>LeadForge</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </>
          )}




          {/* ===== DASHBOARD TAB ===== */}

          <TabsContent value="dashboard" role="tabpanel" aria-label="Dashboard overview">
            <InvestorTabErrorBoundary tabName="Dashboard">
              <div className="space-y-6">
                {/* PWA Install Banner */}
                <PWAInstallBanner />

                {/* Pending Agreements - High Priority */}
                <PendingAgreements
                  investorId={investor.id}
                  investorName={investor.full_name}
                  investorEmail={investor.email}
                  onNavigateToSignatures={() => setActiveTab('signatures')}
                />

                {/* Account Link Suggestions Banner */}
                <AccountLinkSuggestionsBanner 
                  investorId={investor.id}
                  onLinkAccepted={() => {
                    const stored = localStorage.getItem('investorSession');
                    if (stored) {
                      const data = JSON.parse(stored);
                      setInvestor({ ...data, linked_staff_id: true });
                    }
                  }}
                />

                {/* Onboarding Checklist */}
                <OnboardingChecklist 
                  investor={investor} 
                  onNavigate={setActiveTab}
                  onBookCall={() => handleBookCall({ type: 'general' })}
                />
                
                {/* Your Team Section - AM and SM */}
                <div className="grid md:grid-cols-2 gap-6">
                  <AcquisitionManagerSection
                    investorId={investor.id}
                    investorName={investor.full_name}
                    investorEmail={investor.email}
                    onNavigateToMessages={() => setActiveTab('messages')}
                    onAMUpdated={(am) => {
                      const stored = localStorage.getItem('investorSession');
                      if (stored) {
                        const data = JSON.parse(stored);
                        setInvestor({ ...data, assigned_acquisition_manager_id: am?.id });
                        localStorage.setItem('investorSession', JSON.stringify({ ...data, assigned_acquisition_manager_id: am?.id }));
                      }
                    }}
                  />
                  <SetupManagerSection
                    investorId={investor.id}
                    investorName={investor.full_name}
                    investorEmail={investor.email}
                    onSMUpdated={(sm) => {
                      const stored = localStorage.getItem('investorSession');
                      if (stored) {
                        const data = JSON.parse(stored);
                        setInvestor({ ...data, assigned_setup_manager_id: sm?.id });
                        localStorage.setItem('investorSession', JSON.stringify({ ...data, assigned_setup_manager_id: sm?.id }));
                      }
                    }}
                  />
                </div>

                
                <ProfileProgress investor={investor} onNavigate={setActiveTab} />
                <PersonalizedRecommendations investor={investor} onNavigate={setActiveTab} />
                <DashboardWidgets 
                  investorId={investor.id} 
                  onNavigate={setActiveTab} 
                  onBookCall={() => handleBookCall({ type: 'general' })} 
                />
              </div>
            </InvestorTabErrorBoundary>
          </TabsContent>


          {/* ===== PORTFOLIO TAB ===== */}
          <TabsContent value="portfolio" role="tabpanel" aria-label="Your investment portfolio">
            <InvestorTabErrorBoundary tabName="Portfolio">
              <Suspense fallback={<PortfolioSkeleton />}>
                <InvestorPortfolio 
                  investorId={investor.id} 
                  investorName={investor.full_name} 
                />
              </Suspense>
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== MARKETPLACE TAB ===== */}
          <TabsContent value="marketplace" role="tabpanel" aria-label="Deal marketplace">
            <InvestorTabErrorBoundary tabName="Marketplace">
              <DealMarketplace 
                investorId={investor.id}
                investorName={investor.full_name}
                investorEmail={investor.email}
              />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== PROPERTY SEARCH TAB ===== */}
          <TabsContent value="property-search" role="tabpanel" aria-label="Property search and locator">
            <InvestorTabErrorBoundary tabName="Property Search">
              <PropertySearchLocator 
                investorId={investor.id}
                investorName={investor.full_name}
                investorEmail={investor.email}
                onBookCall={(data) => handleBookCall(data)}
              />
            </InvestorTabErrorBoundary>
          </TabsContent>


          {/* ===== UNIFIED NOTIFICATIONS & ALERTS HUB ===== */}
          <TabsContent value="notifications-hub" role="tabpanel" aria-label="Notifications and alerts hub">
            <InvestorTabErrorBoundary tabName="Notifications & Alerts">
              <UnifiedNotificationsHub 
                investorId={investor.id}
                investorEmail={investor.email}
                investorPhone={investor.phone}
              />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== SAVED DEALS TAB ===== */}
          <TabsContent value="saved" role="tabpanel" aria-label="Your saved deals">
            <InvestorTabErrorBoundary tabName="Saved Deals">
              <SavedDeals 
                investorId={investor.id} 
                onInquire={(deal) => handleBookCall({ property: deal, type: 'verified_deal' })} 
              />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== INQUIRIES TAB ===== */}
          <TabsContent value="inquiries" role="tabpanel" aria-label="Your deal inquiries">
            <InvestorTabErrorBoundary tabName="Inquiries">
              <InquiryTracker investorEmail={investor.email} />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== MESSAGES TAB ===== */}
          <TabsContent value="messages" role="tabpanel" aria-label="Your messages">
            <InvestorTabErrorBoundary tabName="Messages">
              <InvestorMessaging 
                investorId={investor.id} 
                investorName={investor.full_name}
                assignedAMId={investor.assigned_acquisition_manager_id}
                assignedAMName={investor.acquisition_manager_name}
              />
            </InvestorTabErrorBoundary>
          </TabsContent>


          {/* ===== ACQUISITIONS TAB ===== */}
          <TabsContent value="acquisitions" role="tabpanel" aria-label="Your acquisitions tracker">
            <InvestorTabErrorBoundary tabName="Acquisitions">
              <AcquisitionsTracker 
                investorId={investor.id} 
                investorName={investor.full_name} 
                investorEmail={investor.email} 
              />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== PROPERTY SETUP TAB ===== */}
          <TabsContent value="setup" role="tabpanel" aria-label="Property setup progress tracker">
            <InvestorTabErrorBoundary tabName="Property Setup">
              <SetupProgressTracker
                investorId={investor.id}
                investorName={investor.full_name}
                investorEmail={investor.email}
              />
            </InvestorTabErrorBoundary>
          </TabsContent>


          {/* ===== DOCUMENTS TAB ===== */}
          <TabsContent value="documents" role="tabpanel" aria-label="Your documents">
            <InvestorTabErrorBoundary tabName="Documents">
              <InvestorDocuments 
                investorId={investor.id} 
                investorName={investor.full_name}
                onNavigateToSigning={() => setActiveTab('signatures')}
              />
            </InvestorTabErrorBoundary>
          </TabsContent>


          {/* ===== SIGNATURES TAB ===== */}
          <TabsContent value="signatures" role="tabpanel" aria-label="Documents requiring signature">
            <InvestorTabErrorBoundary tabName="Signatures">
              <DocumentSigning investorId={investor.id} investorName={investor.full_name} />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== DEAL MATCHING TAB ===== */}
          <TabsContent value="deal-matching" role="tabpanel" aria-label="Intelligent deal matching preferences">
            <InvestorTabErrorBoundary tabName="Deal Matching">
              <DealMatchPreferences investorId={investor.id} />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== DEAL ALERTS TAB ===== */}
          <TabsContent value="deal-alerts" role="tabpanel" aria-label="Deal alert settings and history">
            <InvestorTabErrorBoundary tabName="Deal Alerts">
              <DealAlertSettings 
                investorId={investor.id}
                investorEmail={investor.email}
                onNavigate={setActiveTab}
              />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== FINANCIAL HUB (Merged Account & Credits + Payments) ===== */}
          <TabsContent value="financial" role="tabpanel" aria-label="Financial hub - account, credits, and payments">
            <InvestorTabErrorBoundary tabName="Financial Hub">
              <Tabs defaultValue="account" className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Wallet className="w-6 h-6 text-[#d4a574]" />
                      Financial Hub
                    </h2>
                    <p className="text-sm text-gray-500">Manage your account funding, credits, and payment history</p>
                  </div>
                </div>
                <TabsList className="bg-white shadow">
                  <TabsTrigger value="account" className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Account & Credits
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment History
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="account">
                  <AccountCredits 
                    investorId={investor.id} 
                    investorEmail={investor.email}
                    onFundingComplete={() => {
                      const stored = localStorage.getItem('investorSession');
                      if (stored) {
                        const data = JSON.parse(stored);
                        setInvestor({ ...data, account_funded: true });
                      }
                    }} 
                  />
                </TabsContent>
                <TabsContent value="payments">
                  <PaymentHistory investorId={investor.id} />
                </TabsContent>
              </Tabs>
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== CALENDAR TAB ===== */}
          <TabsContent value="calendar" role="tabpanel" aria-label="Calendar and milestones">
            <InvestorTabErrorBoundary tabName="Calendar">
              <InvestorCalendar 
                investorId={investor.id}
                investorName={investor.full_name}
              />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== REPORTS TAB ===== */}
          <TabsContent value="reports" className="space-y-6" role="tabpanel" aria-label="Market reports">
            <InvestorTabErrorBoundary tabName="Reports">
              <MarketReportGenerator investorId={investor.id} />
              <ReportHistory 
                investorId={investor.id} 
                preferredMarkets={investor.preferred_markets || []} 
              />
              <MarketReportSettings 
                investorId={investor.id} 
                preferredMarkets={investor.preferred_markets || []} 
              />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== REFERRALS TAB ===== */}
          <TabsContent value="referrals" role="tabpanel" aria-label="Referral program">
            <InvestorTabErrorBoundary tabName="Referrals">
              <ReferralProgram 
                investorId={investor.id} 
                investorName={investor.full_name} 
              />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== ISSUES TAB ===== */}
          <TabsContent value="issues" role="tabpanel" aria-label="Report an issue">
            <InvestorTabErrorBoundary tabName="Issues">
              <IssueReportForm />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== DISPUTES TAB ===== */}
          <TabsContent value="disputes" role="tabpanel" aria-label="Dispute resolution center">
            <InvestorTabErrorBoundary tabName="Disputes">
              <DisputeResolutionCenter 
                investorId={investor.id}
                investorName={investor.full_name}
                investorEmail={investor.email}
              />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== TUTORIALS TAB ===== */}
          <TabsContent value="tutorials" role="tabpanel" aria-label="Video tutorials and help">
            <InvestorTabErrorBoundary tabName="Tutorials">
              <VideoTutorials investorId={investor.id} />
            </InvestorTabErrorBoundary>
          </TabsContent>


          {/* ===== EMAIL PREFERENCES TAB ===== */}
          <TabsContent value="email-preferences" role="tabpanel" aria-label="Email preferences">
            <InvestorTabErrorBoundary tabName="Email Preferences">
              <EmailPreferences investorId={investor.id} />
            </InvestorTabErrorBoundary>
          </TabsContent>

          {/* ===== SETTINGS TAB ===== */}
          <TabsContent value="settings" role="tabpanel" aria-label="Account settings">
            <InvestorTabErrorBoundary tabName="Settings">
              <AccountSettings 
                investor={investor} 
                onUpdate={handleUpdateInvestor} 
                onLogout={handleLogout} 
              />
            </InvestorTabErrorBoundary>
          </TabsContent>
          {/* ===== LEADFORGE TAB ===== */}
          <TabsContent value="leadforge" role="tabpanel" aria-label="Apollo LeadForge - investor lead search">
            <InvestorTabErrorBoundary tabName="LeadForge">
              <InvestorLeadForge investorId={investor.id} investorName={investor.full_name} />
            </InvestorTabErrorBoundary>
          </TabsContent>

        </Tabs>


      </main>

      <Footer />

      {/* Booking Dialog with proper accessibility */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent aria-describedby="booking-dialog-description">
          <DialogHeader>
            <DialogTitle>Book Discovery Call</DialogTitle>
            <DialogDescription id="booking-dialog-description">
              Schedule a call with one of our acquisition managers to discuss your investment goals.
            </DialogDescription>
          </DialogHeader>
          <form 
            onSubmit={(e) => { e.preventDefault(); submitBooking(); }} 
            className="space-y-4"
            aria-label="Book a discovery call form"
          >
            {bookingData?.property && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm" role="region" aria-label="Selected property">
                <p className="font-medium">{bookingData.property.city}, {bookingData.property.state}</p>
                <p className="text-gray-500">{bookingData.property.bedrooms} bed / {bookingData.property.bathrooms} bath</p>
              </div>
            )}
            <div>
              <Label htmlFor="booking-date">Preferred Date</Label>
              <Input 
                id="booking-date"
                type="date" 
                value={bookingForm.preferred_date} 
                onChange={e => setBookingForm({...bookingForm, preferred_date: e.target.value})}
                required
                aria-required="true"
              />
            </div>
            <div>
              <Label htmlFor="booking-time">Preferred Time</Label>
              <Input 
                id="booking-time"
                placeholder="e.g. 2:00 PM EST" 
                value={bookingForm.preferred_time} 
                onChange={e => setBookingForm({...bookingForm, preferred_time: e.target.value})}
                required
                aria-required="true"
              />
            </div>
            <div>
              <Label htmlFor="booking-notes">Notes (Optional)</Label>
              <Textarea 
                id="booking-notes"
                placeholder="Any specific questions or topics you'd like to discuss?" 
                value={bookingForm.notes} 
                onChange={e => setBookingForm({...bookingForm, notes: e.target.value})}
              />
            </div>
            <Button 
              type="submit"
              disabled={submitting} 
              className="w-full bg-[#d4a574] hover:bg-[#c49464]"
              aria-busy={submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              {submitting ? 'Scheduling...' : 'Schedule Call'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Penny AI Floating Chat Button - Unified AI chat for investors */}
      {investor?.id && (
        <PennyChatButton
          userId={investor.id}
          userName={investor.full_name || 'Investor'}
          userType="investor"
        />
      )}
    </div>
  );
}
