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
import StaffResetPassword from "./pages/StaffResetPassword";
import StaffQuickAddContact from "./pages/StaffQuickAddContact";
import AMAgreementSign from "./pages/AMAgreementSign";

import KnowledgeLibrary from "./pages/KnowledgeLibrary";
import BlogArticle from "./pages/BlogArticle";
import Pricing from "./pages/Pricing";
import SetupServices from "./pages/SetupServices";
import LandlordPartnership from "./pages/LandlordPartnership";
import LandlordLogin from "./pages/LandlordLogin";
import LandlordPortal from "./pages/LandlordPortal";
import AdminComments from "./pages/AdminComments";
import OAuthCallback from "./pages/OAuthCallback";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ProPortal from "./pages/ProPortal";
import Careers from "./pages/Careers";

const queryClient = new QueryClient();

const App = () => (
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
                <Route path="/staff/dashboard" element={<StaffDashboard />} />
                <Route path="/staff/reset-password" element={<StaffResetPassword />} />
                <Route path="/staff/quick-add" element={<StaffQuickAddContact />} />
                {/* Redirect /staff to /staff/dashboard */}
                <Route path="/staff" element={<Navigate to="/staff/dashboard" replace />} />

                <Route path="/knowledge" element={<KnowledgeLibrary />} />
                <Route path="/knowledge-library" element={<KnowledgeLibrary />} />
                <Route path="/article-demo" element={<Navigate to="/knowledge-library" replace />} />
                <Route path="/blog/:slug" element={<BlogArticle />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/setup-services" element={<SetupServices />} />
                <Route path="/landlord-partnership" element={<LandlordPartnership />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/landlord/login" element={<LandlordLogin />} />
                <Route path="/landlord/portal" element={<LandlordPortal />} />
                <Route path="/admin/comments" element={<AdminComments />} />
                <Route path="/oauth/callback" element={<OAuthCallback />} />
                <Route path="/oauth/callback/investor" element={<OAuthCallback />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/am-agreement/:agreementId" element={<AMAgreementSign />} />
                <Route path="/pro-portal/:token" element={<ProPortal />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </NativeShell>
        </TooltipProvider>
      </AppProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
