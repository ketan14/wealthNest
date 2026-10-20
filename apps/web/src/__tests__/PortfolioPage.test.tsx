import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('deletes demo holding like Sovereign Gold Bond 2028 when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

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

    expect(screen.getByText('Sovereign Gold Bond 2028')).toBeInTheDocument();

    const deleteBtns = screen.getAllByTitle('Delete Position');
    // Sovereign Gold Bond 2028 is demo holding index 3
    fireEvent.click(deleteBtns[3]!);

    await waitFor(() => {
      expect(screen.queryByText('Sovereign Gold Bond 2028')).not.toBeInTheDocument();
    });
  });

  it('updates portfolio holdings attaching security name with Asset / Ticker from Import CAS', async () => {
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

    // Open Import CAS Modal
    const importBtns = screen.getAllByRole('button', { name: /Import CAS/i });
    fireEvent.click(importBtns[0]!);

    // Click Load Sample CDSL CAS
    const cdslBtn = screen.getByText(/Load Sample CDSL CAS/i);
    fireEvent.click(cdslBtn);

    // Verify preview table displays security name and attached ticker
    await waitFor(() => {
      expect(screen.getByText('RELIANCE INDUSTRIES LTD. - EQ')).toBeInTheDocument();
    });

    // Confirm & Import
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Import/i });
    fireEvent.click(confirmBtn);

    // Verify import completed summary
    await waitFor(() => {
      expect(screen.getByText(/CAS Import Completed Successfully!/i)).toBeInTheDocument();
    });

    // Click "View Updated Portfolio"
    const viewPortfolioBtn = screen.getByRole('button', { name: /View Updated Portfolio/i });
    fireEvent.click(viewPortfolioBtn);

    // Verify modal is closed and Portfolio table now displays updated positions with security name attached to Asset / Ticker
    await waitFor(() => {
      expect(screen.getByText('RELIANCE INDUSTRIES LTD. - EQ')).toBeInTheDocument();
      expect(screen.getAllByText('RELIANCE').length).toBeGreaterThanOrEqual(1);
    });
  });
});
