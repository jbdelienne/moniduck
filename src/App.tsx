import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import '@/i18n';
import AppLayout from "@/components/layout/AppLayout";

import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import ServicesPage from "@/pages/ServicesPage";
import CloudResourcesPage from "@/pages/CloudResourcesPage";
import Integrations from "@/pages/Integrations";
import IntegrationDetail from "@/pages/IntegrationDetail";
import Alerts from "@/pages/Alerts";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";
import Waitlist from "@/pages/Waitlist";
import ReportsPage from "@/pages/ReportsPage";
import AwsCostDashboard from "@/pages/AwsCostDashboard";
import AwsIntegrationDetail from "@/pages/AwsIntegrationDetail";
import PublicReport from "@/pages/PublicReport";
import SaasStatusPage from "@/pages/SaasStatusPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Waitlist />} />
    <Route path="/reports/shared/:shareToken" element={<PublicReport />} />
    {/* All app routes hidden during beta — redirect to waitlist */}
    <Route path="/auth" element={<Navigate to="/" replace />} />
    <Route path="/dashboard" element={<Navigate to="/" replace />} />
    <Route path="/services" element={<Navigate to="/" replace />} />
    <Route path="/cloud-resources" element={<Navigate to="/" replace />} />
    <Route path="/saas-status" element={<Navigate to="/" replace />} />
    <Route path="/integrations/*" element={<Navigate to="/" replace />} />
    <Route path="/alerts" element={<Navigate to="/" replace />} />
    <Route path="/reports" element={<Navigate to="/" replace />} />
    <Route path="/settings" element={<Navigate to="/" replace />} />
    <Route path="/en/*" element={<Navigate to="/" replace />} />
    <Route path="/fr/*" element={<Navigate to="/" replace />} />
    <Route path="/de/*" element={<Navigate to="/" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
