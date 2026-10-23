import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders header, badges, action buttons, and top 4 debt KPI cards', () => {
    renderLiabilitiesPage();

    // Header & Badges
    expect(screen.getByText('Loans & Liabilities')).toBeInTheDocument();
    expect(screen.getByText(/Phase 5: Loans & Liabilities Engine/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Loan \/ Liability/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync/i })).toBeInTheDocument();

    // 4 KPI Cards
    expect(screen.getByText('Total Outstanding Debt')).toBeInTheDocument();
    expect(screen.getByText('Monthly EMI Commitment')).toBeInTheDocument();
    expect(screen.getByText('Debt-To-Assets Ratio')).toBeInTheDocument();
    expect(screen.getByText('True Net Worth')).toBeInTheDocument();
  });

  it('renders property equity and collateral breakdown with LTV ratio', () => {
    renderLiabilitiesPage();

    expect(screen.getByText('Property Equity & Loan-To-Value (LTV)')).toBeInTheDocument();
    expect(screen.getAllByText('3BHK Apartment - Bengaluru').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Positive Equity')).toBeInTheDocument();
    expect(screen.getByText('Net Home Equity')).toBeInTheDocument();
    expect(screen.getByText(/48.5% LTV/i)).toBeInTheDocument();
  });

  it('renders loan portfolio table with Indian institutions and filter tabs', () => {
    renderLiabilitiesPage();

    expect(screen.getByText('Loan Portfolio & Balances')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Active \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Closed \(0\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All \(2\)/i })).toBeInTheDocument();

    // Loans present in UI
    expect(screen.getAllByText('SBI Green Home Loan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/State Bank of India/i)).toBeInTheDocument();
    expect(screen.getByText('HDFC EV Auto Loan')).toBeInTheDocument();
    expect(screen.getByText(/HDFC Bank/i)).toBeInTheDocument();
  });

  it('opens and closes Add Loan Modal on user interaction', () => {
    renderLiabilitiesPage();

    const addBtn = screen.getByRole('button', { name: /Add Loan \/ Liability/i });
    fireEvent.click(addBtn);

    // Modal opens
    expect(screen.getByText('Add New Loan / Liability')).toBeInTheDocument();
    expect(
      screen.getByText(/Track mortgages, vehicle loans, and personal debts integrated with your Net Worth/i)
    ).toBeInTheDocument();

    // Close modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Modal closes
    expect(screen.queryByText('Add New Loan / Liability')).not.toBeInTheDocument();
  });
});
