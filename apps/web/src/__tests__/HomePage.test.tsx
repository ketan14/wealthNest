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
  it('renders Family Net Worth, Runway, Real Estate, and Document Vault summary cards', async () => {
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

    expect(screen.getByText('Family Net Worth')).toBeInTheDocument();
    expect(screen.getByText('Real Estate')).toBeInTheDocument();
    expect(screen.getByText('Document Vault')).toBeInTheDocument();
    expect(screen.getByText('Equity, LTV & Yield')).toBeInTheDocument();
    expect(screen.getByText('PAN, HUF & Policies')).toBeInTheDocument();
    expect(screen.getByText('Action & Attention')).toBeInTheDocument();
    expect(screen.getByText('HUF Section 112A Tax Shield')).toBeInTheDocument();
  });
});
