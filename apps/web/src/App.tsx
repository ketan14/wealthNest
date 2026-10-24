import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { PortfolioPage } from '@/pages/PortfolioPage';
import { LiabilitiesPage } from '@/pages/LiabilitiesPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminUserDetailPage } from '@/pages/admin/AdminUserDetailPage';
import { AdminHouseholdsPage } from '@/pages/admin/AdminHouseholdsPage';
import { AdminRolesPage } from '@/pages/admin/AdminRolesPage';
import { AdminAuditLogsPage } from '@/pages/admin/AdminAuditLogsPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';

import { SignUpPage } from '@/pages/SignUpPage';
import { LoginPage } from '@/pages/LoginPage';

import { AuthProvider } from '@/lib/supabase/auth-context';
import { AdminProvider } from '@/lib/admin/admin-context';
import { SupportSessionProvider } from '@/lib/admin/support-session-context';
import { PreferencesProvider } from '@/lib/preferences/preferences-context';
import { FamilyProvider } from '@/lib/family/family-context';

// Initialize TanStack Query client with production-ready defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminProvider>
          <SupportSessionProvider>
            <PreferencesProvider>
              <FamilyProvider>
                <BrowserRouter>
                  <Routes>
                    {/* Dedicated Authentication Routes */}
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/login" element={<LoginPage />} />

                    {/* Investor App Shell */}
                    <Route path="/" element={<AppShell />}>
                      <Route index element={<HomePage />} />
                      <Route path="portfolio" element={<PortfolioPage />} />
                      <Route path="liabilities" element={<LiabilitiesPage />} />
                      <Route path="transactions" element={<TransactionsPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="goals" element={<GoalsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>

                    {/* Dedicated Platform Admin Portal */}
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboardPage />} />
                      <Route path="users" element={<AdminUsersPage />} />
                      <Route path="users/:userId" element={<AdminUserDetailPage />} />
                      <Route path="households" element={<AdminHouseholdsPage />} />
                      <Route path="roles" element={<AdminRolesPage />} />
                      <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                      <Route path="settings" element={<AdminSettingsPage />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </FamilyProvider>
            </PreferencesProvider>
          </SupportSessionProvider>
        </AdminProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
