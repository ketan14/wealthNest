import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { AuthProvider } from '../lib/supabase/auth-context';

describe('AnalyticsPage Component (Phase 4 & Budget 2024 Tax Engine)', () => {
  it('renders performance KPI cards, trajectory chart, benchmarks, rebalancing drift, and Budget 2024 tax intelligence', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <AnalyticsPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Header & badges
    expect(screen.getByText('Performance & Wealth Analytics')).toBeInTheDocument();
    expect(screen.getByText('India First (₹ INR)')).toBeInTheDocument();

    // Strategy Model buttons
    expect(screen.getByRole('button', { name: /Balanced/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aggressive/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conservative/i })).toBeInTheDocument();

    // Top 4 Primary KPI cards
    expect(screen.getByText('Portfolio XIRR')).toBeInTheDocument();
    expect(screen.getByText('Total Return & CAGR')).toBeInTheDocument();
    expect(screen.getByText('Benchmark Alpha')).toBeInTheDocument();
    expect(screen.getByText('Diversification Score')).toBeInTheDocument();

    // Trajectory Timeline Chart
    expect(screen.getByText('Portfolio Trajectory & Capital Growth Timeline')).toBeInTheDocument();

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
  });
});
