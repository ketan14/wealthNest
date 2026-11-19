import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { calculatePortfolioAnalytics } from '@wealthnest/domain';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { AnalyticsTrajectoryChartCard } from '../components/analytics/AnalyticsTrajectoryChartCard';
import { BenchmarkAndRebalanceSection } from '../components/analytics/BenchmarkAndRebalanceSection';
import { AuthProvider } from '../lib/supabase/auth-context';
import { FamilyProvider } from '../lib/family/family-context';
import { PreferencesProvider } from '../lib/preferences/preferences-context';

describe('AnalyticsPage Component (Phase 4 & Budget 2024 Tax Engine)', () => {
  it('renders performance KPI cards, unified INR strip, filters, timeframes, trajectory chart, benchmarks, and tax intelligence', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PreferencesProvider>
            <FamilyProvider>
              <MemoryRouter>
                <AnalyticsPage />
              </MemoryRouter>
            </FamilyProvider>
          </PreferencesProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Header & entity chips
    expect(screen.getByText('Performance & Wealth Analytics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Combined Family/i })).toBeInTheDocument();

    // Standardized Net Worth / Assets / Liabilities strip (zero displays ₹0)
    expect(screen.getByText('Total Net Worth')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Liabilities')).toBeInTheDocument();
    expect(screen.getAllByText('₹0').length).toBeGreaterThanOrEqual(1);

    // Account & Category filter bar
    expect(screen.getByRole('button', { name: 'All Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All Categories' })).toBeInTheDocument();

    // Strategy Model buttons
    expect(screen.getByRole('button', { name: /Balanced/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aggressive/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conservative/i })).toBeInTheDocument();

    // Top 4 Primary KPI cards
    expect(screen.getByText('Portfolio XIRR')).toBeInTheDocument();
    expect(screen.getByText('Total Return & CAGR')).toBeInTheDocument();
    expect(screen.getByText('Benchmark Alpha')).toBeInTheDocument();
    expect(screen.getByText('Diversification Score')).toBeInTheDocument();

    // Trajectory Timeline Chart & all 6 timeframe pills
    expect(screen.getByText('Portfolio Trajectory & Capital Growth Timeline')).toBeInTheDocument();
    for (const tf of ['1M', '3M', '6M', 'YTD', '1Y', 'ALL']) {
      expect(screen.getByRole('button', { name: tf })).toBeInTheDocument();
    }

    // Wait for query data to populate then test category filtering
    expect((await screen.findAllByText('Sovereign Gold Bond 2028')).length).toBeGreaterThanOrEqual(
      1
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gold' }));
    expect(screen.getAllByText(/₹1\.32L/).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'All Categories' }));

    // Benchmark comparison card
    expect(screen.getByText('Indian Market Benchmarks & Alpha')).toBeInTheDocument();
    expect(screen.getByText('Nifty 50 TRI')).toBeInTheDocument();
    expect(screen.getByText('BSE Sensex')).toBeInTheDocument();
    expect(screen.getByText('Sovereign Gold (SGB)')).toBeInTheDocument();

    // Asset allocation drift card
    expect(screen.getByText('Asset Allocation Drift & Rebalancing')).toBeInTheDocument();

    // Union Budget 2024 Tax Intelligence Section
    expect(
      screen.getByText('Capital Gains Tax & Loss Harvesting Intelligence')
    ).toBeInTheDocument();
    expect(screen.getByText(/Budget 2024 Rules Enforced/i)).toBeInTheDocument();
    expect(screen.getByText('Section 112A LTCG Exemption')).toBeInTheDocument();
    expect(screen.getByText(/Taxable LTCG/i)).toBeInTheDocument();
    expect(screen.getByText(/Taxable STCG/i)).toBeInTheDocument();
    expect(screen.getByText('Loss Harvesting Savings')).toBeInTheDocument();

    // Section 112A Multi-Entity Tax Harvesting Simulator
    expect(
      screen.getByText(/Section 112A Multi-Entity Tax Harvesting Simulator/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Total Family Tax Shield/i)).toBeInTheDocument();
  });

  it('renders compact empty states for Net Worth Trend and Asset Allocation when no data exists', () => {
    const emptyAnalytics = calculatePortfolioAnalytics([], [], 'INR', 'balanced');

    render(
      <MemoryRouter>
        <AnalyticsTrajectoryChartCard trajectory={[]} netWorthRupees={0} />
        <BenchmarkAndRebalanceSection
          analytics={emptyAnalytics}
          xirrDisplay="N/A"
          modelType="balanced"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('No net worth history yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Transaction/i })).toBeInTheDocument();
    expect(screen.getByText('No assets')).toBeInTheDocument();
    expect(screen.getByText(/Investments · Real Estate · Cash & Bank · Gold/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Asset/i })).toBeInTheDocument();
  });
});
