import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from '../pages/HomePage';
import { AuthProvider } from '../lib/supabase/auth-context';
import { RepositoryProvider } from '../lib/persistence/repository-context';
import { PreferencesProvider } from '../lib/preferences/preferences-context';
import { FamilyProvider } from '../lib/family/family-context';

describe('HomePage Executive Overview', () => {
  it('renders Family Net Worth, Liquid Assets, Monthly EMI, and Wealth Modules according to wireframe', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RepositoryProvider>
            <PreferencesProvider>
              <FamilyProvider>
                <MemoryRouter>
                  <HomePage />
                </MemoryRouter>
              </FamilyProvider>
            </PreferencesProvider>
          </RepositoryProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Verify Family Net Worth is present (case insensitive for mobile/desktop headers)
    expect(screen.getAllByText(/FAMILY NET WORTH/i).length).toBeGreaterThan(0);

    // Verify 2x2 executive metrics
    expect(screen.getByText('Liquid Assets')).toBeInTheDocument();
    expect(screen.getByText('Monthly EMI')).toBeInTheDocument();
    expect(screen.getByText('Monthly Cash Flow')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();

    // Verify Wealth Trajectory & Modules
    expect(screen.getAllByText('Wealth Trajectory').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Portfolio').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Real Estate|Properties/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Liabilities|Loans/i).length).toBeGreaterThan(0);

    // Verify Quick Add button is present
    expect(screen.getByText('Quick Add')).toBeInTheDocument();
  });
});
