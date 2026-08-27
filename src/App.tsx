import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import NativeShell from "@/components/NativeShell";
import { PageTracker } from "@/hooks/usePageTracking";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Deals from "./pages/Deals";
import PropertyDetail from "./pages/PropertyDetail";
import InvestorLogin from "./pages/InvestorLogin";
import InvestorPortal from "./pages/InvestorPortal";
import InvestorResetPassword from "./pages/InvestorResetPassword";
import InvestorVerifyEmail from "./pages/InvestorVerifyEmail";
import InvestorUnsubscribe from "./pages/InvestorUnsubscribe";
import StaffLogin from "./pages/StaffLogin";
import StaffDashboard from "./pages/StaffDashboard";
import StaffWorkspace from "./pages/StaffWorkspace";
import StaffHomeRoute from "./pages/StaffHomeRoute";
import StaffLeadForge from "./pages/StaffLeadForge";
import StaffResetPassword from "./pages/StaffResetPassword";
import StaffQuickAddContact from "./pages/StaffQuickAddContact";
import AMAgreementSign from "./pages/AMAgreementSign";
import KnowledgeLibrary from "./pages/KnowledgeLibrary";
import BlogArticle from "./pages/BlogArticle";
import SetupServices from "./pages/SetupServices";
import LandlordPartnership from "./pages/LandlordPartnership";
import LandlordLogin from "./pages/LandlordLogin";
import LandlordResetPassword from '@/pages/LandlordResetPassword';
import StartPage from '@/pages/StartPage';
import ListYourProperty from '@/pages/ListYourProperty';
import ResearchReview from '@/pages/ResearchReview';
import LandlordPortal from "./pages/LandlordPortal";
import AdminComments from "./pages/AdminComments";
import OAuthCallback from "./pages/OAuthCallback";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import HowItWorks from "./pages/HowItWorks";
import CoreValues from "./pages/CoreValues";
import Careers from "./pages/Careers";
import ProPortal from "./pages/ProPortal";
import CommunityStandards from "./pages/CommunityStandards";
import LegalAgreementGate from "./pages/LegalAgreementGate";
import PennyAI from "@/components/PennyAI";
import PennyPage from "./pages/PennyPage";

// Global error boundary — catches any unhandled React render crash and shows
// a recoverable error screen instead of a blank white page.
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-gray-500 text-sm mb-6">{this.state.error?.message}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/staff/login";
              }}
              className="px-4 py-2 bg-[#d4a574] text-white rounded-lg text-sm font-medium"
            >
              Return to Login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AppProvider>
          <TooltipProvider>
            <NativeShell>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <PageTracker />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/deals" element={<Deals />} />
                  <Route path="/deal-flow" element={<Navigate to="/deals" replace />} />
                  <Route path="/deals/:id" element={<PropertyDetail />} />
                  <Route path="/client-access" element={<Navigate to="/investor/login" replace />} />
                  <Route path="/investor/login" element={<InvestorLogin />} />
                  <Route path="/investor" element={<InvestorPortal />} />
                  <Route path="/investor/portal" element={<InvestorPortal />} />
                  <Route path="/investor/reset-password" element={<InvestorResetPassword />} />
                  <Route path="/investor/verify-email" element={<InvestorVerifyEmail />} />
                  <Route path="/investor/unsubscribe" element={<InvestorUnsubscribe />} />
                  <Route path="/staff/login" element={<StaffLogin />} />
                  <Route path="/staff-login" element={<Navigate to="/staff/login" replace />} />
                  {/* The new Success Team home. The full dashboard is still one link away at
                      ?view=full, so nothing is taken away before this has been judged. */}
                  <Route path="/staff/home" element={<StaffHomeRoute />} />
                  <Route path="/staff/dashboard" element={<StaffDashboard />} />
                  {/* Redesign, built alongside the existing dashboard so nothing breaks. */}
                  <Route path="/staff/workspace" element={<StaffWorkspace />} />
                  <Route path="/staff/leadforge" element={<StaffLeadForge />} />
                  <Route path="/staff/reset-password" element={<StaffResetPassword />} />
                  <Route path="/staff/quick-add" element={<StaffQuickAddContact />} />
                  {/* Redirect /staff to /staff/dashboard */}
                  {/* ONE LANDING, NOT TWO. Signing in used to drop a Success Team member on the old
                      dashboard's Penny tab; then /staff/home was a second, different home. That is
                      two front doors to the same building. /staff now goes to the console, and the
                      full dashboard is one link away from it. */}
                  <Route path="/staff" element={<Navigate to="/staff/home" replace />} />
                  <Route path="/knowledge" element={<KnowledgeLibrary />} />
                  <Route path="/knowledge-library" element={<KnowledgeLibrary />} />
                  <Route path="/article-demo" element={<Navigate to="/knowledge-library" replace />} />
                  <Route path="/blog/:slug" element={<BlogArticle />} />
                  {/* /pricing removed 11 Aug 2026, owner decision: unnecessary. */}
                  <Route path="/setup-services" element={<SetupServices />} />
                  <Route path="/landlord-partnership" element={<LandlordPartnership />} />
                  <Route path="/careers" element={<Careers />} />
                  <Route path="/start" element={<StartPage />} />
                  <Route path="/list-your-property" element={<ListYourProperty />} />
                  <Route path="/staff/research-review" element={<ResearchReview />} />
                  <Route path="/landlord/login" element={<LandlordLogin />} />
                  <Route path="/landlord/reset-password" element={<LandlordResetPassword />} />
                  <Route path="/landlord/portal" element={<LandlordPortal />} />
                  <Route path="/admin/comments" element={<AdminComments />} />
                  <Route path="/oauth/callback" element={<OAuthCallback />} />
                  <Route path="/oauth/callback/investor" element={<OAuthCallback />} />
                  <Route path="/terms-of-service" element={<TermsOfService />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
                  <Route path="/core-values" element={<CoreValues />} />
                  <Route path="/am-agreement/:agreementId" element={<AMAgreementSign />} />
                  <Route path="/pro-portal/:token" element={<ProPortal />} />
                  <Route path="/community-standards" element={<CommunityStandards />} />
                  <Route path="/legal-agreement-gate" element={<LegalAgreementGate />} />
                  <Route path="/penny-ai" element={<PennyPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </NativeShell>
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
