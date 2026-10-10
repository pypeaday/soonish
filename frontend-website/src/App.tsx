import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AppPickerPage } from '@/pages/AppPickerPage';
import { HomePage } from '@/pages/HomePage';
import { AppsPage } from '@/pages/AppsPage';
import {
  IntroductionPage,
  QuickStartPage,
  ConceptsPage,
  EventsPage,
  ChannelsPage,
  SubscriptionsPage,
  RolesPage,
  OrganizationsPage,
} from '@/pages/docs';
import {
  AdminOverviewPage,
  InstallationPage,
  ConfigurationPage,
  UpgradingPage,
  ArchitecturePage,
  TemporalPage,
  DatabasePage,
  AuthApiPage,
  EventsApiPage,
  ChannelsApiPage,
  SubscriptionsApiPage,
  BuildingAppsPage,
  ContributingPage,
} from '@/pages/docs/admin';
import {
  ITAlertsPage,
  TheaterVolunteerPage,
  VolunteerCoordinatorPage,
  EventPlannerPage,
  MindPage,
} from '@/pages/docs/apps';
import { BillingSuccessPage } from '@/pages/BillingSuccessPage';
import { BillingCancelPage } from '@/pages/BillingCancelPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center stars">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00d4ff] mx-auto" />
          <p className="mt-4 text-[#64748b]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/apps" element={<AppsPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Customer Documentation */}
          <Route path="/guide" element={<IntroductionPage />} />
          <Route path="/guide/quickstart" element={<QuickStartPage />} />
          <Route path="/guide/concepts" element={<ConceptsPage />} />
          <Route path="/guide/events" element={<EventsPage />} />
          <Route path="/guide/channels" element={<ChannelsPage />} />
          <Route path="/guide/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/guide/roles" element={<RolesPage />} />
          <Route path="/guide/organizations" element={<OrganizationsPage />} />
          
          {/* App Guides */}
          <Route path="/guide/apps/it-alerts" element={<ITAlertsPage />} />
          <Route path="/guide/apps/theater" element={<TheaterVolunteerPage />} />
          <Route path="/guide/apps/volunteer" element={<VolunteerCoordinatorPage />} />
          <Route path="/guide/apps/events" element={<EventPlannerPage />} />
          <Route path="/guide/apps/mind" element={<MindPage />} />
          
          {/* API Reference (For Developers) */}
          <Route path="/guide/api/auth" element={<AuthApiPage />} />
          <Route path="/guide/api/events" element={<EventsApiPage />} />
          <Route path="/guide/api/channels" element={<ChannelsApiPage />} />
          <Route path="/guide/api/subscriptions" element={<SubscriptionsApiPage />} />
          <Route path="/guide/dev/apps" element={<BuildingAppsPage />} />
          
          {/* Self-Hosting Documentation */}
          <Route path="/guide/admin" element={<AdminOverviewPage />} />
          <Route path="/guide/admin/installation" element={<InstallationPage />} />
          <Route path="/guide/admin/configuration" element={<ConfigurationPage />} />
          <Route path="/guide/admin/upgrading" element={<UpgradingPage />} />
          <Route path="/guide/admin/architecture" element={<ArchitecturePage />} />
          <Route path="/guide/admin/temporal" element={<TemporalPage />} />
          <Route path="/guide/admin/database" element={<DatabasePage />} />
          <Route path="/guide/admin/contributing" element={<ContributingPage />} />
          
          {/* Billing pages */}
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/billing/cancel" element={<BillingCancelPage />} />
          
          {/* Protected dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/apps"
            element={
              <ProtectedRoute>
                <AppPickerPage />
              </ProtectedRoute>
            }
          />
          
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
