import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RealEstatePage } from '../pages/RealEstatePage';
import { AuthProvider } from '../lib/supabase/auth-context';
import { RepositoryProvider } from '../lib/persistence/repository-context';
import { SupportSessionProvider } from '../lib/admin/support-session-context';
import { FamilyProvider } from '../lib/family/family-context';

function renderRealEstatePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RepositoryProvider>
          <SupportSessionProvider>
            <FamilyProvider>
              <MemoryRouter>
                <RealEstatePage />
              </MemoryRouter>
            </FamilyProvider>
          </SupportSessionProvider>
        </RepositoryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('RealEstatePage (UX-04)', () => {
  it('renders Real Estate KPIs and Vaghela Household demo properties with LTV and rental yield', async () => {
    renderRealEstatePage();

    expect(screen.getByText('Real Estate Equity & Yield')).toBeInTheDocument();
    expect(screen.getByText('Total Property Value')).toBeInTheDocument();
    expect(screen.getByText('Net Property Equity')).toBeInTheDocument();
    expect(screen.getByText('Weighted LTV Ratio')).toBeInTheDocument();
    expect(screen.getByText('Monthly Rental Income')).toBeInTheDocument();

    expect(await screen.findByText('3BHK Apartment — Prahlad Nagar')).toBeInTheDocument();
    expect(screen.getByText('Commercial Shop — Satellite Road')).toBeInTheDocument();
    expect(screen.getByText('Embassy Office Parks REIT')).toBeInTheDocument();
    expect(screen.getByText(/Healthy LTV/i)).toBeInTheDocument();
  });

  it('opens PropertyMetricsModal when clicking Configure on a property card', async () => {
    renderRealEstatePage();

    await screen.findByText('3BHK Apartment — Prahlad Nagar');

    fireEvent.click(
      screen.getByRole('button', { name: /Configure 3BHK Apartment — Prahlad Nagar/i })
    );
    expect(screen.getByText('Property Rental & Cost Details')).toBeInTheDocument();
  });
});
