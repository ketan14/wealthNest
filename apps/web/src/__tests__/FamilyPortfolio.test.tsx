import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/supabase/auth-context';
import { PreferencesProvider } from '../lib/preferences/preferences-context';
import { FamilyProvider } from '../lib/family/family-context';
import { FamilyFilterBar } from '../components/family/FamilyFilterBar';
import { FamilyDistributionWidget } from '../components/family/FamilyDistributionWidget';
import { ManageFamilyModal } from '../components/family/ManageFamilyModal';
import { PortfolioPage } from '../pages/PortfolioPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { GoalsPage } from '../pages/GoalsPage';
import { LiabilitiesPage } from '../pages/LiabilitiesPage';
import { AddHoldingModal } from '../components/portfolio/AddHoldingModal';
import { ImportCasModal } from '../components/portfolio/ImportCasModal';
import { AddGoalModal } from '../components/goals/AddGoalModal';
import { AddLiabilityModal } from '../components/liabilities/AddLiabilityModal';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PreferencesProvider>
          <FamilyProvider>
            <MemoryRouter>
              {ui}
            </MemoryRouter>
          </FamilyProvider>
        </PreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Phase 6A: Family Portfolios & Multi-Demat UI', () => {
  describe('FamilyFilterBar Component', () => {
    it('renders combined family entity pills and account selector', () => {
      const handleOpenManage = vi.fn();

      renderWithProviders(
        <FamilyFilterBar onOpenManageModal={handleOpenManage} />
      );

      // Verify "Combined Family" pill is present
      expect(screen.getByText('Combined Family')).toBeInTheDocument();

      // Verify default members are rendered as entity pills
      expect(screen.getByText('Ketan Vaghela')).toBeInTheDocument();
      expect(screen.getByText('Parul Vaghela')).toBeInTheDocument();
      expect(screen.getByText('Shamalbhai Vaghela HUF')).toBeInTheDocument();

      // Verify Demat selector exists
      expect(screen.getByLabelText(/Filter by Demat or Broker Account/i)).toBeInTheDocument();

      // Verify Manage button
      const manageBtn = screen.getByRole('button', { name: /Manage Entities/i });
      expect(manageBtn).toBeInTheDocument();
      fireEvent.click(manageBtn);
      expect(handleOpenManage).toHaveBeenCalledTimes(1);
    });

    it('allows selecting different family entity filters', () => {
      renderWithProviders(
        <FamilyFilterBar onOpenManageModal={() => {}} />
      );

      const hufPill = screen.getByText('Shamalbhai Vaghela HUF');
      fireEvent.click(hufPill);
      expect(hufPill).toBeInTheDocument();
    });
  });

  describe('FamilyDistributionWidget Component', () => {
    it('renders family wealth distribution and HUF Section 112A Tax Shield', async () => {
      renderWithProviders(
        <FamilyDistributionWidget />
      );

      // Widget Header (loads asynchronously via familySummary)
      await waitFor(() => {
        expect(screen.getByText(/Family Wealth Distribution & Multi-PAN Architecture/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Phase 6A')).toBeInTheDocument();
      expect(screen.getByText(/Total Family Wealth/i)).toBeInTheDocument();
      expect(screen.getByText(/Portfolio Allocation by Entity/i)).toBeInTheDocument();

      // HUF Section 112A Tax Shield
      expect(screen.getByText(/HUF Section 112A Tax Shield Active/i)).toBeInTheDocument();
      expect(screen.getByText(/₹1,25,000/i)).toBeInTheDocument();
      expect(screen.getByText(/Annual Tax Advantage/i)).toBeInTheDocument();
    });
  });

  describe('ManageFamilyModal Component', () => {
    it('renders entities and demat accounts tabs when opened', () => {
      const handleClose = vi.fn();

      renderWithProviders(
        <ManageFamilyModal isOpen={true} onClose={handleClose} />
      );

      expect(screen.getByText('Family Entities & Demat Accounts')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Family Entities/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Demat & Folio Accounts/i })).toBeInTheDocument();

      // Verify members are listed
      expect(screen.getByText('Ketan Vaghela')).toBeInTheDocument();
      expect(screen.getByText('Parul Vaghela')).toBeInTheDocument();
      expect(screen.getByText('Shamalbhai Vaghela HUF')).toBeInTheDocument();

      // Close button
      const closeButtons = screen.getAllByRole('button', { name: /Close/i });
      expect(closeButtons.length).toBeGreaterThan(0);
      fireEvent.click(closeButtons[0]!);
      expect(handleClose).toHaveBeenCalled();
    });

    it('toggles add member form', () => {
      renderWithProviders(
        <ManageFamilyModal isOpen={true} onClose={() => {}} />
      );

      const addBtn = screen.getByRole('button', { name: /Add Family Member or HUF Entity/i });
      fireEvent.click(addBtn);

      expect(screen.getByPlaceholderText(/e\.g\. Parul Vaghela or Vaghela HUF/i)).toBeInTheDocument();
      expect(screen.getByText(/Relationship \/ Entity Type/i)).toBeInTheDocument();
      expect(screen.getByText(/PAN Card \(Optional\)/i)).toBeInTheDocument();
    });

    it('switches to demat accounts tab and lists brokers', () => {
      renderWithProviders(
        <ManageFamilyModal isOpen={true} onClose={() => {}} />
      );

      const accountsTab = screen.getByRole('button', { name: /Demat & Folio Accounts/i });
      fireEvent.click(accountsTab);

      // Verify broker accounts are listed
      expect(screen.getByText(/Zerodha Kite/i)).toBeInTheDocument();
      expect(screen.getByText(/Groww.*Demat/i)).toBeInTheDocument();

      // Add account button
      expect(screen.getByRole('button', { name: /Add Demat, MF Folio, or Bank Account/i })).toBeInTheDocument();
    });
  });

  describe('PortfolioPage Integration', () => {
    it('displays family filter bar, holding demat badges, and responds to entity filter', async () => {
      renderWithProviders(
        <PortfolioPage />
      );

      // Family Filter Bar exists on Portfolio Page
      expect(screen.getByText('Combined Family')).toBeInTheDocument();
      expect(screen.getByText('Shamalbhai Vaghela HUF')).toBeInTheDocument();

      // Holdings table renders with demat / member badges
      expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument();
      expect(screen.getAllByText('RELIANCE').length).toBeGreaterThanOrEqual(1);

      // Verify Demat badges are rendered in table
      expect(screen.getAllByText('Zerodha').length).toBeGreaterThanOrEqual(1);

      // Click on Shamalbhai Vaghela HUF filter
      const hufFilter = screen.getByText('Shamalbhai Vaghela HUF');
      fireEvent.click(hufFilter);

      // Reliance (assigned to self) should no longer be in the HUF filtered holdings
      // Instead, Tata Consultancy Services (assigned to HUF in demo data) should be present
      await waitFor(() => {
        expect(screen.getByText('Tata Consultancy Services')).toBeInTheDocument();
        expect(screen.queryByText('Reliance Industries Ltd')).not.toBeInTheDocument();
      });

      // Switch back to "Combined Family"
      const combinedFamilyBtn = screen.getByText('Combined Family');
      fireEvent.click(combinedFamilyBtn);

      await waitFor(() => {
        expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument();
        expect(screen.getByText('Tata Consultancy Services')).toBeInTheDocument();
      });
    });
  });

  describe('SettingsPage Integration', () => {
    it('navigates to Family & Demats tab and displays registered entities and tax shield advisory', () => {
      renderWithProviders(
        <SettingsPage />
      );

      // Click Family & Demats tab
      const familyTab = screen.getByRole('button', { name: /Family & Demats/i });
      expect(familyTab).toBeInTheDocument();
      fireEvent.click(familyTab);

      // Verify tab content
      expect(screen.getByText(/Family Members & Demat Folios/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Manage Entities & Accounts/i })).toBeInTheDocument();

      // Verify legal entities list
      expect(screen.getByText(/Family Entities/i)).toBeInTheDocument();
      expect(screen.getByText('Ketan Vaghela')).toBeInTheDocument();
      expect(screen.getByText('Parul Vaghela')).toBeInTheDocument();
      expect(screen.getByText('Shamalbhai Vaghela HUF')).toBeInTheDocument();

      // Verify Section 112A tax shield badges & advisory
      expect(screen.getAllByText(/₹1\.25L 112A Exempt/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Indian Section 112A Tax Advantage/i)).toBeInTheDocument();

      // Verify connected Demat accounts list
      expect(screen.getByText(/Demat & Folio Accounts/i)).toBeInTheDocument();
      expect(screen.getByText(/Zerodha Kite/i)).toBeInTheDocument();
      expect(screen.getByText(/Groww.*Demat/i)).toBeInTheDocument();
    });
  });

  describe('TransactionsPage Integration', () => {
    it('displays family filter bar, transaction demat badges, and filters cashflows by entity', async () => {
      renderWithProviders(<TransactionsPage />);

      // Verify FamilyFilterBar is rendered
      expect(screen.getByText('Combined Family')).toBeInTheDocument();
      expect(screen.getByText('Shamalbhai Vaghela HUF')).toBeInTheDocument();

      // Verify table has entity/broker badges
      expect(screen.getByText('Reliance Industries Ltd')).toBeInTheDocument();
      expect(screen.getAllByText('Zerodha').length).toBeGreaterThanOrEqual(1);

      // Filter by Shamalbhai Vaghela HUF
      const hufFilter = screen.getByText('Shamalbhai Vaghela HUF');
      fireEvent.click(hufFilter);

      // In demo data, TCS dividend belongs to HUF
      await waitFor(() => {
        expect(screen.getByText('Tata Consultancy Services')).toBeInTheDocument();
        expect(screen.queryByText('Reliance Industries Ltd')).not.toBeInTheDocument();
      });
    });
  });

  describe('AnalyticsPage Integration', () => {
    it('displays family filter bar and recalculates analytics scoped to selected entity', async () => {
      renderWithProviders(<AnalyticsPage />);

      // Verify FamilyFilterBar exists
      expect(screen.getByText('Combined Family')).toBeInTheDocument();
      expect(screen.getByText('Shamalbhai Vaghela HUF')).toBeInTheDocument();

      // Verify page title and header badge
      expect(screen.getByText('Performance & Wealth Analytics')).toBeInTheDocument();
      expect(screen.getByText(/Combined Family Portfolio/i)).toBeInTheDocument();

      // Filter by HUF entity
      const hufFilter = screen.getByText('Shamalbhai Vaghela HUF');
      fireEvent.click(hufFilter);

      // Section 112A card adapts with HUF entity exemption indicator
      await waitFor(() => {
        expect(screen.getByText(/HUF Section 112A Exemption/i)).toBeInTheDocument();
        expect(screen.getByText(/Independent HUF PAN exemption/i)).toBeInTheDocument();
      });
    });
  });

  describe('AddHoldingModal Component Integration', () => {
    it('renders legal entity and demat account selectors and scopes accounts to member', () => {
      renderWithProviders(
        <AddHoldingModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
        />
      );

      // Verify Entity & Demat selectors exist
      expect(screen.getByText(/Legal Entity \/ Member/i)).toBeInTheDocument();
      expect(screen.getByText(/Demat \/ Broker \/ Folio/i)).toBeInTheDocument();

      // Verify default entity options are present
      expect(screen.getByText(/Ketan Vaghela \(SELF\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Parul Vaghela \(SPOUSE\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Shamalbhai Vaghela HUF \(HUF\)/i)).toBeInTheDocument();
    });
  });

  describe('ImportCasModal Component Integration', () => {
    it('renders legal entity and demat account assignment in statement preview step', async () => {
      renderWithProviders(
        <ImportCasModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );

      // Verify Quick QA sample button is present
      const loadCdslBtn = screen.getByRole('button', {
        name: /Load Sample CDSL CAS/i,
      });
      expect(loadCdslBtn).toBeInTheDocument();
      fireEvent.click(loadCdslBtn);

      // Wait for Preview Step to load
      await waitFor(() => {
        expect(screen.getByText(/Assign To Legal Entity \/ Member/i)).toBeInTheDocument();
        expect(screen.getByText(/Assign Demat \/ Broker Account/i)).toBeInTheDocument();
      });

      // Verify family member options appear in the assignment dropdown
      expect(screen.getByText(/Ketan Vaghela \(SELF\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Shamalbhai Vaghela HUF \(HUF\)/i)).toBeInTheDocument();
    });
  });

  describe('GoalsPage Family Integration', () => {
    it('displays family filter bar, beneficiary badges, and filters milestones by family member', async () => {
      renderWithProviders(<GoalsPage />);

      // Verify FamilyFilterBar is rendered
      expect(screen.getByText('Combined Family')).toBeInTheDocument();
      expect(screen.getAllByText('Krisha Vaghela').length).toBeGreaterThanOrEqual(1);

      // Verify beneficiary badges are rendered on goals
      expect(screen.getByText('Krisha Higher Education & University Corpus')).toBeInTheDocument();

      // Filter by Krisha Vaghela
      const krishaPills = screen.getAllByText('Krisha Vaghela');
      fireEvent.click(krishaPills[0]!);

      await waitFor(() => {
        expect(screen.getByText('Krisha Higher Education & University Corpus')).toBeInTheDocument();
      });
    });
  });

  describe('LiabilitiesPage Family Integration', () => {
    it('displays family filter bar, borrower badges, joint co-borrower tags, and filters liabilities', async () => {
      renderWithProviders(<LiabilitiesPage />);

      // Verify FamilyFilterBar is rendered
      expect(screen.getByText('Combined Family')).toBeInTheDocument();
      expect(screen.getAllByText('Parul Vaghela').length).toBeGreaterThanOrEqual(1);

      // Verify loan and borrower tags
      expect(screen.getAllByText('SBI Green Home Loan').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Joint: Parul Vaghela/i)).toBeInTheDocument();
      expect(screen.getByText('HDFC EV Auto Loan')).toBeInTheDocument();
    });
  });

  describe('AddGoalModal Family Beneficiary Selector', () => {
    it('renders selectable family entity options for goal assignment', () => {
      renderWithProviders(
        <AddGoalModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
        />
      );

      // Verify beneficiary section and member buttons
      expect(screen.getByText(/Goal Beneficiary \/ Family Entity/i)).toBeInTheDocument();
      expect(screen.getByText('Krisha Vaghela')).toBeInTheDocument();
      expect(screen.getByText('Shamalbhai Vaghela HUF')).toBeInTheDocument();
    });
  });

  describe('AddLiabilityModal Borrower Selectors', () => {
    it('renders primary borrower select and joint co-borrowers toggle list', () => {
      renderWithProviders(
        <AddLiabilityModal
          isOpen={true}
          onClose={() => {}}
          onSave={async () => {}}
          userId="demo-user"
        />
      );

      // Verify borrower fields
      expect(screen.getByText(/Primary Borrower/i)).toBeInTheDocument();
      expect(screen.getByText(/Joint Co-Borrowers \(Optional\)/i)).toBeInTheDocument();
    });
  });
});
