import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortfolioPage } from '../pages/PortfolioPage';
import { AuthProvider } from '../lib/supabase/auth-context';

describe('PortfolioPage Component', () => {
  it('renders portfolio summary cards, asset allocation, and demo holdings', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <PortfolioPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Header and button
    expect(screen.getByText('Portfolio & Asset Allocation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Holding/i })).toBeInTheDocument();

    // Summary metrics
    expect(screen.getByText('Total Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Total Cost Basis')).toBeInTheDocument();
    expect(screen.getByText('Unrealized Profit/Loss')).toBeInTheDocument();
    expect(screen.getByText('Asset Diversity')).toBeInTheDocument();

    // Asset allocation section
    expect(screen.getByText('Asset Class Allocation')).toBeInTheDocument();

    // Holdings table
    expect(screen.getByText('Portfolio Holdings')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });
});
