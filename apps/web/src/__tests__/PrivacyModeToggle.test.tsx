import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivacyProvider } from '../lib/preferences/privacy-context';
import { PreferencesProvider } from '../lib/preferences/preferences-context';
import { AuthProvider } from '../lib/supabase/auth-context';
import { FamilyProvider } from '../lib/family/family-context';
import { RepositoryProvider } from '../lib/persistence/repository-context';
import { SupportSessionProvider } from '../lib/admin/support-session-context';
import { Header } from '../components/layout/Header';
import AnalyticsPage from '../pages/AnalyticsPage';
import { RealEstatePage } from '../pages/RealEstatePage';
import { GoalsPage } from '../pages/GoalsPage';
import { PortfolioPage } from '../pages/PortfolioPage';
import { FamilyDistributionWidget } from '../components/family/FamilyDistributionWidget';

function renderWithPrivacyShell(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RepositoryProvider>
          <SupportSessionProvider>
            <PreferencesProvider>
              <PrivacyProvider>
                <FamilyProvider>
                  <MemoryRouter>
                    <Header />
                    {ui}
                  </MemoryRouter>
                </FamilyProvider>
              </PrivacyProvider>
            </PreferencesProvider>
          </SupportSessionProvider>
        </RepositoryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Header Privacy Toggle Masking', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('masks monetary figures in AnalyticsPage when header-privacy-toggle is active', async () => {
    renderWithPrivacyShell(<AnalyticsPage />);

    // Wait for analytics holdings query to populate non-zero values
    expect((await screen.findAllByText('Sovereign Gold Bond 2028')).length).toBeGreaterThanOrEqual(
      1
    );

    fireEvent.click(screen.getByTestId('header-privacy-toggle'));

    expect(screen.getAllByText('₹ ••••••').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText(/₹1\.32L/)).not.toBeInTheDocument();
  });

  it('masks monetary figures in RealEstatePage when header-privacy-toggle is active', async () => {
    renderWithPrivacyShell(<RealEstatePage />);

    expect(await screen.findByText('3BHK Apartment — Prahlad Nagar')).toBeInTheDocument();
    expect(screen.getAllByText(/92\.50L/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByTestId('header-privacy-toggle'));

    expect(screen.getAllByText('₹ ••••••').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText(/92\.50L/)).not.toBeInTheDocument();
  });

  it('masks monetary figures in GoalsPage when header-privacy-toggle is active', () => {
    renderWithPrivacyShell(<GoalsPage />);

    expect(screen.getByText('Emergency Reserve Fund (6 Months)')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('header-privacy-toggle'));

    expect(screen.getAllByText('₹ ••••••').length).toBeGreaterThanOrEqual(6);
  });

  it('masks monetary figures in FamilyDistributionWidget when header-privacy-toggle is active', async () => {
    renderWithPrivacyShell(<FamilyDistributionWidget />);

    expect(
      await screen.findByText(/Family Wealth Distribution & Multi-PAN Architecture/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('header-privacy-toggle'));

    expect(screen.getAllByText('₹ ••••••').length).toBeGreaterThanOrEqual(4);
  });

  it('masks monetary figures in PortfolioPage summary, allocation, and holdings rows when header-privacy-toggle is active', () => {
    renderWithPrivacyShell(<PortfolioPage />);

    expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument();
    expect(screen.getAllByText(/2,36,000/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByTestId('header-privacy-toggle'));

    expect(screen.getAllByText('₹ ••••••').length).toBeGreaterThanOrEqual(10);
    expect(screen.queryByText(/2,36,000/)).not.toBeInTheDocument();
  });
});
