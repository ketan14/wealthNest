import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPage } from '../pages/SettingsPage';
import { AuthProvider } from '../lib/supabase/auth-context';
import { PreferencesProvider } from '../lib/preferences/preferences-context';

describe('SettingsPage Component (Sprint 3)', () => {
  const renderSettingsPage = () => {
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
              <SettingsPage />
            </MemoryRouter>
          </PreferencesProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  it('renders settings header, tabs, and profile view by default', () => {
    renderSettingsPage();

    // Header & Badges
    expect(screen.getByText('Settings & Control Center')).toBeInTheDocument();
    expect(screen.getByText('System & Preferences')).toBeInTheDocument();
    expect(screen.getByText(/Client-Side Privacy Enforced/i)).toBeInTheDocument();

    // Tabs
    expect(screen.getByRole('button', { name: /Profile & Security/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Localization & Tax Standards/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Data Portability & Backup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /System Diagnostics/i })).toBeInTheDocument();

    // Profile Tab Content (compact rows + account tier grid)
    expect(screen.getByText('User Profile Information')).toBeInTheDocument();
    expect(screen.getByText('Display Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Display Name/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Legal \/ KYC Name/i })).toBeInTheDocument();
    expect(screen.getByText('Security & Access Credentials')).toBeInTheDocument();
    expect(screen.getByText('Row-Level Security (RLS)')).toBeInTheDocument();
    expect(screen.getByText('Self-Hosted Private Vault')).toBeInTheDocument();
  });

  it('navigates to Localization & Tax Standards tab and updates formatting options via EditSettingModal', async () => {
    renderSettingsPage();

    const locTab = screen.getByRole('button', { name: /Localization & Tax Standards/i });
    fireEvent.click(locTab);

    // Localization content
    expect(screen.getByText('Currency & Regional Standards')).toBeInTheDocument();
    expect(screen.getByText('Default Base Currency')).toBeInTheDocument();
    expect(screen.getByText(/Indian Rupee/i)).toBeInTheDocument();
    expect(screen.getByText(/Indian System \(en-IN\)/i)).toBeInTheDocument();
    expect(screen.getByText('Indian Fiscal Year (Apr 1 - Mar 31)')).toBeInTheDocument();
    expect(screen.getByText(/New Regime \(Sec 115BAC\)/i)).toBeInTheDocument();

    // Live Formatting Preview card
    expect(screen.getByText('Live Formatting Preview')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Valuation (Compact)')).toBeInTheDocument();

    // Edit Base Currency via EditSettingModal
    fireEvent.click(screen.getByRole('button', { name: /Edit Default Base Currency/i }));
    const select = await screen.findByLabelText('Base Currency');
    fireEvent.change(select, { target: { value: 'USD' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(await screen.findByText(/USD — US Dollar/i)).toBeInTheDocument();
  });

  it('navigates to Data Portability & Backup tab with export and restore capabilities', () => {
    renderSettingsPage();

    const dataTab = screen.getByRole('button', { name: /Data Portability & Backup/i });
    fireEvent.click(dataTab);

    // Export & Restore sections
    expect(screen.getByText('Export & Data Portability')).toBeInTheDocument();
    expect(screen.getByText('Complete JSON Backup')).toBeInTheDocument();
    expect(screen.getByText('Spreadsheet CSV Reports')).toBeInTheDocument();
    expect(screen.getByText(/Holdings & Valuations \(\.csv\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Transactions Log \(\.csv\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Loans & EMIs \(\.csv\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Goals & Runway \(\.csv\)/i)).toBeInTheDocument();

    // Restore section
    expect(screen.getByText('Restore from Backup')).toBeInTheDocument();
    expect(screen.getByText(/Click to select WealthNest backup JSON/i)).toBeInTheDocument();

    // Stage 1 (P0): Selective Financial Data Reset section
    expect(screen.getByText('Reset Selected Financial Data')).toBeInTheDocument();
    expect(screen.getByLabelText('Investment Portfolio')).toBeInTheDocument();
    expect(screen.getByLabelText('Real Estate')).toBeInTheDocument();
    expect(screen.getByLabelText('Loans & Liabilities')).toBeInTheDocument();
    expect(screen.getByLabelText('Transactions')).toBeInTheDocument();
    expect(screen.getByLabelText('Financial Goals')).toBeInTheDocument();
    expect(screen.getByLabelText('Documents Vault')).toBeInTheDocument();
    expect(screen.getByLabelText('CAS & Import History')).toBeInTheDocument();
  });

  it('supports selecting reset categories, viewing dependency warnings, and confirming with RESET MY DATA', async () => {
    renderSettingsPage();

    fireEvent.click(screen.getByRole('button', { name: /Data Portability & Backup/i }));

    // Initially 0 categories selected and Review button disabled
    const reviewBtn = screen.getByRole('button', { name: /Review Selection \(0\)/i });
    expect(reviewBtn).toBeDisabled();

    // Select Real Estate only -> triggers Dependent Record Handling warning about Home Loans
    fireEvent.click(screen.getByLabelText('Real Estate'));
    expect(screen.getByText('Dependent Record Handling')).toBeInTheDocument();
    expect(
      screen.getByText(/Real Estate is selected without Loans & Liabilities/i)
    ).toBeInTheDocument();

    // Test Select All / Deselect All
    fireEvent.click(screen.getByRole('button', { name: /Select All Categories/i }));
    expect(screen.getByRole('button', { name: /Review Selection \(7\)/i })).toBeEnabled();

    // Open Confirmation Modal
    fireEvent.click(screen.getByRole('button', { name: /Review Selection \(7\)/i }));
    expect(screen.getByText('Confirm Data Reset')).toBeInTheDocument();

    const confirmResetBtn = screen.getByRole('button', { name: /Confirm Permanent Reset/i });
    expect(confirmResetBtn).toBeDisabled();

    // Check both mandatory acknowledgements
    fireEvent.click(
      screen.getByLabelText(/I understand that selected records will be permanently deleted/i)
    );
    fireEvent.click(
      screen.getByLabelText(
        /I have downloaded a backup or understand that this operation may not be recoverable/i
      )
    );
    expect(confirmResetBtn).toBeDisabled();

    // Type RESET MY DATA
    const phraseInput = screen.getByPlaceholderText('RESET MY DATA');
    fireEvent.change(phraseInput, { target: { value: 'RESET MY DATA' } });
    expect(confirmResetBtn).toBeEnabled();
  });

  it('navigates to System Diagnostics tab and displays clean architecture layers', () => {
    renderSettingsPage();

    const sysTab = screen.getByRole('button', { name: /System Diagnostics/i });
    fireEvent.click(sysTab);

    expect(screen.getByText('Monorepo Layers')).toBeInTheDocument();
    expect(screen.getByText('Database Engine')).toBeInTheDocument();
    expect(screen.getByText('Architectural Layer Verification')).toBeInTheDocument();
    expect(screen.getByText(/Domain Layer \(@wealthnest\/domain\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Application Layer \(@wealthnest\/application\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared Layer \(@wealthnest\/shared\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Web Frontend \(@wealthnest\/web\)/i)).toBeInTheDocument();
  });
});
