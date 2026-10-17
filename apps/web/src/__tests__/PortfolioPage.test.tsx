import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(screen.getByText(/Asset Class Allocation/i)).toBeInTheDocument();

    // Holdings table
    expect(screen.getByText('Portfolio Holdings')).toBeInTheDocument();
    expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument();
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
  });

  it('opens and closes the Import CAS modal without React hook errors', async () => {
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

    const importBtns = screen.getAllByRole('button', { name: /Import CAS/i });
    expect(importBtns.length).toBeGreaterThan(0);

    fireEvent.click(importBtns[0]!);

    expect(screen.getByText(/Import Investments from NSDL \/ CDSL CAS/i)).toBeInTheDocument();
    expect(screen.getByText(/Load Sample CDSL CAS/i)).toBeInTheDocument();
    expect(screen.getByText(/Load Sample NSDL CAS/i)).toBeInTheDocument();
  });
});
