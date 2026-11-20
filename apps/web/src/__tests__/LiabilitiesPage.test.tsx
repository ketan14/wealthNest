import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LiabilitiesPage } from '../pages/LiabilitiesPage';
import { AuthProvider } from '../lib/supabase/auth-context';
import { PreferencesProvider } from '../lib/preferences/preferences-context';

describe('LiabilitiesPage Component (Sprint 4)', () => {
  const renderLiabilitiesPage = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PreferencesProvider>
            <MemoryRouter>
              <LiabilitiesPage />
            </MemoryRouter>
          </PreferencesProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  it('renders header, badges, action buttons, and top debt KPI cards', () => {
    renderLiabilitiesPage();

    // Header & Badges
    expect(screen.getByText('Loans & Liabilities')).toBeInTheDocument();
    expect(screen.getByText(/Loans & Liabilities Engine/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Sync/i }).length).toBeGreaterThan(0);

    // Streamlined Essential KPI Cards
    expect(screen.getByText('Total Debt')).toBeInTheDocument();
    expect(screen.getAllByText('Monthly EMI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Property Equity')).toBeInTheDocument();
  });

  it('renders property equity and collateral breakdown with LTV ratio', () => {
    renderLiabilitiesPage();

    expect(screen.getByText('Property Equity & Loan-To-Value (LTV)')).toBeInTheDocument();
    expect(screen.getAllByText('3BHK Apartment - Bengaluru').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Positive Equity')).toBeInTheDocument();
    expect(screen.getByText('Net Home Equity')).toBeInTheDocument();
    expect(screen.getAllByText(/48.5% LTV/i).length).toBeGreaterThan(0);
  });

  it('renders loan portfolio table with Indian institutions and filter tabs', () => {
    renderLiabilitiesPage();

    expect(screen.getByText('Loan Portfolio & Balances')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Active \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Closed \(0\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All \(2\)/i })).toBeInTheDocument();

    // Loans present in UI
    expect(screen.getAllByText('SBI Green Home Loan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/State Bank of India/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('HDFC EV Auto Loan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/HDFC Bank/i).length).toBeGreaterThanOrEqual(1);
  });

  it('opens and closes Add Loan Modal on user interaction', () => {
    renderLiabilitiesPage();

    const addBtn = screen.getByRole('button', { name: /Add Liability/i });
    fireEvent.click(addBtn);

    // Modal opens
    expect(screen.getByText('Add New Loan / Liability')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Track mortgages, vehicle loans, and personal debts integrated with your Net Worth/i
      )
    ).toBeInTheDocument();

    // Close modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Modal closes
    expect(screen.queryByText('Add New Loan / Liability')).not.toBeInTheDocument();
  });

  it('allows editing all fields including original principal and current outstanding balance after part-payment', async () => {
    renderLiabilitiesPage();

    const editButtons = screen.getAllByTitle('Edit loan details');
    expect(editButtons[0]).toBeDefined();
    fireEvent.click(editButtons[0]!);

    expect(screen.getByText('Edit Loan / Liability')).toBeInTheDocument();

    const originalPrincipalInput = screen.getByLabelText(
      /Original Sanctioned Principal/i
    ) as HTMLInputElement;
    const currentBalanceInput = screen.getByLabelText(
      /Current Outstanding Principal/i
    ) as HTMLInputElement;

    expect(originalPrincipalInput).not.toBeDisabled();
    expect(currentBalanceInput).not.toBeDisabled();
    expect(currentBalanceInput.value).toBe('4125000');

    // Simulate part-payment reducing outstanding balance to 25,00,000
    fireEvent.change(originalPrincipalInput, { target: { value: '7400000' } });
    fireEvent.change(currentBalanceInput, { target: { value: '2500000' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByText('Edit Loan / Liability')).not.toBeInTheDocument();
    });

    // Re-open edit modal to verify updated values persisted cleanly in state
    const updatedEditButtons = screen.getAllByTitle('Edit loan details');
    expect(updatedEditButtons[0]).toBeDefined();
    fireEvent.click(updatedEditButtons[0]!);
    expect(
      (screen.getByLabelText(/Original Sanctioned Principal/i) as HTMLInputElement).value
    ).toBe('7400000');
    expect(
      (screen.getByLabelText(/Current Outstanding Principal/i) as HTMLInputElement).value
    ).toBe('2500000');
  });
});
