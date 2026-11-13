import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { SignUpPage } from '@/pages/SignUpPage';
import { LoginPage } from '@/pages/LoginPage';

const PortfolioPage = lazy(() =>
  import('@/pages/PortfolioPage').then((m) => ({ default: m.PortfolioPage }))
);
const RealEstatePage = lazy(() =>
  import('@/pages/RealEstatePage').then((m) => ({ default: m.RealEstatePage }))
);
const LiabilitiesPage = lazy(() =>
  import('@/pages/LiabilitiesPage').then((m) => ({ default: m.LiabilitiesPage }))
);
const TransactionsPage = lazy(() =>
  import('@/pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage }))
);
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
);
const GoalsPage = lazy(() => import('@/pages/GoalsPage').then((m) => ({ default: m.GoalsPage })));
const DocumentsPage = lazy(() =>
  import('@/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage }))
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))
);
const AdminUserDetailPage = lazy(() =>
  import('@/pages/admin/AdminUserDetailPage').then((m) => ({ default: m.AdminUserDetailPage }))
);
const AdminHouseholdsPage = lazy(() =>
  import('@/pages/admin/AdminHouseholdsPage').then((m) => ({ default: m.AdminHouseholdsPage }))
);
const AdminRolesPage = lazy(() =>
  import('@/pages/admin/AdminRolesPage').then((m) => ({ default: m.AdminRolesPage }))
);
const AdminAuditLogsPage = lazy(() =>
  import('@/pages/admin/AdminAuditLogsPage').then((m) => ({ default: m.AdminAuditLogsPage }))
);
const AdminSettingsPage = lazy(() =>
  import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage }))
);

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-sm text-slate-400">
      Loading view...
    </div>
  );
}

import { AuthProvider } from '@/lib/supabase/auth-context';
import { RepositoryProvider } from '@/lib/persistence/repository-context';
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
        <RepositoryProvider>
          <AdminProvider>
            <SupportSessionProvider>
              <PreferencesProvider>
                <FamilyProvider>
                  <BrowserRouter>
                    <Suspense fallback={<RouteLoadingFallback />}>
                      <Routes>
                      {/* Dedicated Authentication Routes */}
                      <Route path="/signup" element={<SignUpPage />} />
                      <Route path="/login" element={<LoginPage />} />

                      {/* Investor App Shell */}
                      <Route path="/" element={<AppShell />}>
                        <Route index element={<HomePage />} />
                        <Route path="portfolio" element={<PortfolioPage />} />
                        <Route path="real-estate" element={<RealEstatePage />} />
                        <Route path="liabilities" element={<LiabilitiesPage />} />
                        <Route path="transactions" element={<TransactionsPage />} />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="goals" element={<GoalsPage />} />
                        <Route path="documents" element={<DocumentsPage />} />
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
                    </Suspense>
                  </BrowserRouter>
                </FamilyProvider>
              </PreferencesProvider>
            </SupportSessionProvider>
          </AdminProvider>
        </RepositoryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
