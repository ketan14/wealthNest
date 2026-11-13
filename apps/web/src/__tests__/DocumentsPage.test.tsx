import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentsPage } from '../pages/DocumentsPage';
import { AuthProvider } from '../lib/supabase/auth-context';
import { RepositoryProvider } from '../lib/persistence/repository-context';
import { SupportSessionProvider } from '../lib/admin/support-session-context';
import { FamilyProvider } from '../lib/family/family-context';

function renderDocumentsPage() {
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
                <DocumentsPage />
              </MemoryRouter>
            </FamilyProvider>
          </SupportSessionProvider>
        </RepositoryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('DocumentsPage (VAULT-DOC-01)', () => {
  it('renders Family Document Vault KPIs and Vaghela Household demo documents', async () => {
    renderDocumentsPage();

    expect(screen.getByText('Family Document Vault')).toBeInTheDocument();
    expect(screen.getByText('Vault Documents')).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();
    expect(screen.getByText('Expiring / Renewals')).toBeInTheDocument();
    expect(screen.getByText('Household RLS')).toBeInTheDocument();

    expect(await screen.findByText('Ketan Vaghela — PAN Card')).toBeInTheDocument();
    expect(screen.getByText('Shamalbhai Vaghela HUF — Formation Deed & PAN')).toBeInTheDocument();
    expect(screen.getByText('Parul & Ketan — Family Floater Health Insurance')).toBeInTheDocument();
    expect(screen.getByText('Krisha Vaghela — Birth Certificate & Aadhaar')).toBeInTheDocument();
  });

  it('filters documents by category and opens upload modal', async () => {
    renderDocumentsPage();

    await screen.findByText('Ketan Vaghela — PAN Card');

    // Filter by HUF Deed & Records
    fireEvent.click(screen.getByRole('button', { name: /HUF Deed & Records/i }));
    expect(screen.getByText('Shamalbhai Vaghela HUF — Formation Deed & PAN')).toBeInTheDocument();
    expect(screen.queryByText('Ketan Vaghela — PAN Card')).not.toBeInTheDocument();

    // Reset filter to All
    fireEvent.click(screen.getByRole('button', { name: /^All \(/i }));
    expect(screen.getByText('Ketan Vaghela — PAN Card')).toBeInTheDocument();

    // Open Upload Modal
    fireEvent.click(screen.getByRole('button', { name: /Upload Document/i }));
    expect(screen.getByText('Upload to Family Vault')).toBeInTheDocument();
  });
});
