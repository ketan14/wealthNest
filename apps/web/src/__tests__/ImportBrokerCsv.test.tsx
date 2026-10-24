import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImportCasModal } from '../components/portfolio/ImportCasModal';
import { PortfolioPage } from '../pages/PortfolioPage';
import { AuthProvider } from '../lib/supabase/auth-context';
import { FamilyProvider } from '../lib/family/family-context';

describe('Broker Tradebook & Holdings CSV Importers (Zerodha Kite & Groww)', () => {
  it('switches between CAS PDF, Zerodha CSV, and Groww CSV modes', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <FamilyProvider>
            <ImportCasModal isOpen={true} onClose={() => {}} />
          </FamilyProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Initial state: CAS Statement (PDF)
    expect(screen.getByText('CAS Statement (PDF)')).toBeInTheDocument();
    expect(screen.getByText('Document Password (if encrypted)')).toBeInTheDocument();

    // Switch to Zerodha Kite (CSV)
    fireEvent.click(screen.getByText('Zerodha Kite (CSV)'));
    expect(screen.getByText(/No Document Password Required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Click to choose or drag-and-drop your Zerodha Holdings or Tradebook CSV/i)
    ).toBeInTheDocument();

    // Switch to Groww (CSV)
    fireEvent.click(screen.getByText('Groww (CSV)'));
    expect(screen.getByText(/No Document Password Required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Click to choose or drag-and-drop your Groww Holdings or Orders CSV/i)
    ).toBeInTheDocument();
  });

  it('parses and previews Zerodha Kite Holdings CSV correctly', async () => {
    const onSuccessMock = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <FamilyProvider>
            <ImportCasModal isOpen={true} onClose={() => {}} onSuccess={onSuccessMock} />
          </FamilyProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Click Load Sample Zerodha Holdings CSV
    const zerodhaBtn = screen.getByText(/Load Sample Zerodha Holdings CSV/i);
    fireEvent.click(zerodhaBtn);

    // Verify preview displays Zerodha statement metadata and holdings
    await waitFor(() => {
      expect(screen.getByText(/ZERODHA Statement/i)).toBeInTheDocument();
    });

    // Check parsed holdings in Equities tab
    expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument();
    expect(screen.getByText('Tata Consultancy Services Ltd')).toBeInTheDocument();
    expect(screen.getByText('Nippon India ETF Gold BeES')).toBeInTheDocument();

    // Check ISINs
    expect(screen.getByText('INE002A01018')).toBeInTheDocument();
    expect(screen.getByText('INE467B01029')).toBeInTheDocument();

    // Confirm & Import
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Import/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/CAS Import Completed Successfully!/i)).toBeInTheDocument();
    });

    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    const importedItems = onSuccessMock.mock.calls[0]![0];
    expect(importedItems.length).toBe(3);
  });

  it('parses and previews Zerodha Console Tradebook CSV correctly', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <FamilyProvider>
            <ImportCasModal isOpen={true} onClose={() => {}} />
          </FamilyProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Click Load Sample Zerodha Tradebook CSV
    const tradebookBtn = screen.getByText(/Load Sample Zerodha Tradebook CSV/i);
    fireEvent.click(tradebookBtn);

    // Automatically switches to Historical Transactions tab
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Historical Transactions/i })).toBeInTheDocument();
    });

    // Verify buy and sell transactions
    expect(screen.getAllByText('RELIANCE').length).toBe(2);
    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getAllByText(/BUY/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SELL/i).length).toBeGreaterThan(0);
  });

  it('parses and previews Groww Holdings CSV containing equities and mutual funds', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <FamilyProvider>
            <ImportCasModal isOpen={true} onClose={() => {}} />
          </FamilyProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Click Load Sample Groww Holdings CSV
    const growwBtn = screen.getByText(/Load Sample Groww Holdings CSV/i);
    fireEvent.click(growwBtn);

    await waitFor(() => {
      expect(screen.getByText(/GROWW Statement/i)).toBeInTheDocument();
    });

    // Check Direct Equities tab has 2 stocks
    expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument();
    expect(screen.getByText('Tata Consultancy Services Ltd')).toBeInTheDocument();

    // Switch to Mutual Funds tab to check Parag Parikh Flexi Cap Fund
    const mfTabBtn = screen.getByRole('button', { name: /^Mutual Funds/i });
    fireEvent.click(mfTabBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Parag Parikh Flexi Cap Fund Direct-Growth/i)
      ).toBeInTheDocument();
    });
  });

  it('integrates seamlessly with PortfolioPage allowing family member assignment', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <FamilyProvider>
            <MemoryRouter>
              <PortfolioPage />
            </MemoryRouter>
          </FamilyProvider>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Open Import Modal
    const importBtns = screen.getAllByRole('button', { name: /Import CAS/i });
    fireEvent.click(importBtns[0]!);

    // Load Groww Holdings
    const growwBtn = screen.getByText(/Load Sample Groww Holdings CSV/i);
    fireEvent.click(growwBtn);

    await waitFor(() => {
      expect(screen.getByText(/GROWW Statement/i)).toBeInTheDocument();
    });

    // Change assignment to Parul Vaghela
    const memberSelect = screen.getByLabelText(/Assign To Legal Entity \/ Member/i);
    fireEvent.change(memberSelect, { target: { value: 'mem-spouse' } });

    // Confirm Import
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Import/i });
    fireEvent.click(confirmBtn);

    // Verify completion
    await waitFor(() => {
      expect(screen.getByText(/CAS Import Completed Successfully!/i)).toBeInTheDocument();
    });
  });
});
