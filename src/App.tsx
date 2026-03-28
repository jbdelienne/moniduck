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
import DashboardOverview from "@/pages/DashboardOverview";
import StackPage from "@/pages/StackPage";
import StackDetailPage from "@/pages/StackDetailPage";
import ServicesPage from "@/pages/ServicesPage";
import ServiceDetailPage from "@/pages/ServiceDetailPage";
import IncidentsPage from "@/pages/IncidentsPage";
import Alerts from "@/pages/Alerts";
import ReportsPage from "@/pages/ReportsPage";
import SettingsPage from "@/pages/SettingsPage";
import OnboardingPage from "@/pages/OnboardingPage";
import CloudResourcesPage from "@/pages/CloudResourcesPage";
import CloudProvidersPage from "@/pages/CloudProvidersPage";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";
import Waitlist from "@/pages/Waitlist";
import PublicReport from "@/pages/PublicReport";

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
    <Route path="/auth" element={<Auth />} />
    <Route path="/reports/shared/:shareToken" element={<PublicReport />} />
    <Route path="/onboarding" element={
      <ProtectedRoute><OnboardingPage /></ProtectedRoute>
    } />
    <Route element={<ProtectedLayout />}>
      <Route path="/dashboard" element={<DashboardOverview />} />
      <Route path="/stack" element={<StackPage />} />
      <Route path="/stack/:slug" element={<StackDetailPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/services/:id" element={<ServiceDetailPage />} />
      <Route path="/incidents" element={<IncidentsPage />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/views" element={<Dashboard />} />
      <Route path="/views/:id" element={<Dashboard />} />
      <Route path="/cloud" element={<CloudResourcesPage />} />
      <Route path="/cloud-providers" element={<CloudProvidersPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
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
