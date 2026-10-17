import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionsPage } from '../pages/TransactionsPage';
import { AuthProvider } from '../lib/supabase/auth-context';

describe('TransactionsPage Component (India First)', () => {
  it('renders cashflow summary cards, ratio breakdown, and demo transactions', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <TransactionsPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Header and button
    expect(screen.getByText('Transactions & Cashflow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record Transaction/i })).toBeInTheDocument();

    // Summary metrics
    expect(screen.getByText('Total Inflows')).toBeInTheDocument();
    expect(screen.getByText('Total Outflows')).toBeInTheDocument();
    expect(screen.getByText('Net Cashflow')).toBeInTheDocument();
    expect(screen.getByText('Audit Volume')).toBeInTheDocument();

    // Audit log table
    expect(screen.getByText('Transaction Audit Log')).toBeInTheDocument();
    expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument();
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
  });
});
