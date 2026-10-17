import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { PlaceholderModulePage } from '@/pages/PlaceholderModulePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { AuthProvider } from '@/lib/supabase/auth-context';

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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route
                path="portfolio"
                element={
                  <PlaceholderModulePage
                    title="Portfolio Management"
                    description="Multi-asset allocation tracking, holdings valuation, and asset class distribution."
                    targetPhase="Phase 2"
                  />
                }
              />
              <Route
                path="transactions"
                element={
                  <PlaceholderModulePage
                    title="Transactions & Cashflow"
                    description="Inflows, outflows, transfers, asset acquisitions, and audit log history."
                    targetPhase="Phase 3"
                  />
                }
              />
              <Route
                path="analytics"
                element={
                  <PlaceholderModulePage
                    title="Performance & Wealth Analytics"
                    description="Historical return calculations, benchmarks, volatility, and net worth trajectory."
                    targetPhase="Phase 4"
                  />
                }
              />
              <Route
                path="goals"
                element={
                  <PlaceholderModulePage
                    title="Financial Goals & Milestones"
                    description="Target tracking, emergency fund modeling, and retirement forecasting."
                    targetPhase="Phase 5"
                  />
                }
              />
              <Route
                path="settings"
                element={
                  <PlaceholderModulePage
                    title="System & Account Settings"
                    description="Currency preferences, data export, sync settings, and security credentials."
                    targetPhase="Phase 1"
                  />
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
