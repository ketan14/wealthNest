import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  CustomPlanLimits,
  PLAN_ENTITLEMENTS,
  PlanTier,
  resolveEffectivePlanLimits,
} from '@wealthnest/domain';
import { PlanQuotaBadge } from '../components/plans/PlanQuotaBadge';
import { PortfolioPage } from '../pages/PortfolioPage';
import { GoalsPage } from '../pages/GoalsPage';
import { LiabilitiesPage } from '../pages/LiabilitiesPage';
import { RealEstatePage } from '../pages/RealEstatePage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AuthProvider } from '../lib/supabase/auth-context';
import { PreferencesProvider } from '../lib/preferences/preferences-context';

let mockPlanTier: PlanTier = 'free';
let mockCustomLimits: CustomPlanLimits | null = null;

vi.mock('../lib/supabase/household-context', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase/household-context')>(
    '../lib/supabase/household-context'
  );
  return {
    ...actual,
    useHousehold: () => {
      const def = PLAN_ENTITLEMENTS[mockPlanTier];
      return {
        households: [
          {
            ...actual.DEMO_HOUSEHOLD_SUMMARY,
            planTier: mockPlanTier,
            customLimits: mockCustomLimits,
          },
        ],
        activeHousehold: {
          ...actual.DEMO_HOUSEHOLD_SUMMARY,
          planTier: mockPlanTier,
          customLimits: mockCustomLimits,
        },
        activeHouseholdId: actual.DEMO_HOUSEHOLD_SUMMARY.id,
        householdRole: 'primary_owner' as const,
        planTier: mockPlanTier,
        planDefinition: def,
        planLimits: resolveEffectivePlanLimits(mockPlanTier, mockCustomLimits),
        planFeatures: def.features,
        customLimits: mockCustomLimits,
        planExpiresAt: null,
        isLoading: false,
        error: null,
        canEditFinancials: true,
        canManageMembers: true,
        canManageAdminsOrTransfer: true,
        switchHousehold: vi.fn(),
        refreshHouseholds: vi.fn(),
        createHousehold: vi.fn(),
        renameHousehold: vi.fn(),
      };
    },
  };
});

function renderWithAppProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PreferencesProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </PreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Phase 1: Plan Entitlements & Quota Enforcement UI', () => {
  beforeEach(() => {
    mockPlanTier = 'free';
    mockCustomLimits = null;
  });

  it('renders PlanQuotaBadge for limited plans and hides it for unlimited Family Office', () => {
    const { rerender } = render(
      <PlanQuotaBadge resource="holdings" currentCount={4} planTier="free" />
    );
    expect(screen.getByText(/Free · 4\/5 Investment Holdings/i)).toBeInTheDocument();

    rerender(<PlanQuotaBadge resource="holdings" currentCount={5} planTier="free" />);
    expect(screen.getByText(/Free · 5\/5 Investment Holdings/i)).toBeInTheDocument();

    const { container } = render(
      <PlanQuotaBadge resource="holdings" currentCount={12} planTier="family" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('blocks adding new holdings in PortfolioPage on Free tier when quota is exceeded while keeping edits enabled', async () => {
    mockPlanTier = 'free';
    renderWithAppProviders(<PortfolioPage />);

    // Demo portfolio has >= 5 holdings, so Free quota badge shows and Add Holding triggers PlanLimitModal
    expect(screen.getByText(/Free · \d+\/5 Investment Holdings/i)).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /Add Asset/i });
    fireEvent.click(addBtn);

    expect(await screen.findByText('Free Starter Limit Reached')).toBeInTheDocument();
    expect(
      screen.getByText(/Your existing records remain fully accessible/i)
    ).toBeInTheDocument();

    // Close PlanLimitModal
    fireEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(screen.queryByText('Free Starter Limit Reached')).not.toBeInTheDocument();
  });

  it('allows opening Add Holding modal on Pro Investor tier (unlimited holdings)', async () => {
    mockPlanTier = 'pro';
    renderWithAppProviders(<PortfolioPage />);

    // Unlimited holdings badge is not displayed
    expect(screen.queryByText(/Investment Holdings/i)).not.toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /Add Asset/i });
    fireEvent.click(addBtn);

    expect(screen.queryByText('Pro Investor Limit Reached')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Add/i })).toBeInTheDocument();
  });

  it('blocks Create Goal on Free tier when household already has >= 2 goals', async () => {
    mockPlanTier = 'free';
    renderWithAppProviders(<GoalsPage />);

    expect(screen.getByText(/Free · \d+\/2 Financial Goals/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Create Goal$/i }));

    expect(await screen.findByText('Free Starter Limit Reached')).toBeInTheDocument();
  });

  it('blocks Add Liability on Free tier when household already has >= 1 active loan', async () => {
    mockPlanTier = 'free';
    renderWithAppProviders(<LiabilitiesPage />);

    expect(screen.getByText(/Free · \d+\/1 Active Loans/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add Liability/i }));

    expect(await screen.findByText('Free Starter Limit Reached')).toBeInTheDocument();
  });

  it('blocks Add Property on Free tier when household already has >= 1 real estate property', async () => {
    mockPlanTier = 'free';
    renderWithAppProviders(<RealEstatePage />);

    expect(screen.getByText(/Free · \d+\/1 Real Estate Properties/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add Property/i }));

    expect(await screen.findByText('Free Starter Limit Reached')).toBeInTheDocument();
  });

  it('honors admin custom quota overrides and enforces Phase 2 feature gates on Free tier', async () => {
    mockPlanTier = 'free';
    mockCustomLimits = { holdings: 15 };
    renderWithAppProviders(<PortfolioPage />);

    // Custom override raises holding quota to 15, so badge reads 9/15 and Add Holding opens
    expect(screen.getByText(/Free · \d+\/15 Investment Holdings/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add Asset/i }));
    expect(screen.queryByText('Free Starter Limit Reached')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Close/i }));

    // Auto-Poll is gated on Free tier
    fireEvent.click(screen.getByRole('button', { name: /Auto-Poll: Off/i }));
    expect(await screen.findByText('Live 25-Second Auto-Poll')).toBeInTheDocument();
  });

  it('gates Section 112A Tax Harvesting Intelligence on AnalyticsPage when on Free tier', async () => {
    mockPlanTier = 'free';
    renderWithAppProviders(<AnalyticsPage />);

    expect(
      screen.getByText(/Capital Gains Tax & Section 112A Harvesting Intelligence/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Unlock Full Tax Harvesting/i }));

    expect(
      await screen.findByText('Section 112A Tax Harvesting & Analytics')
    ).toBeInTheDocument();
  });

  it('renders Settings -> Plan & Usage tab with live quota bars and submits an upgrade request', async () => {
    mockPlanTier = 'free';
    renderWithAppProviders(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Plan & Usage/i }));

    expect(screen.getByText('Live Household Quota Usage')).toBeInTheDocument();
    expect(screen.getByText('Investment Holdings')).toBeInTheDocument();
    expect(screen.getByText('Financial Goals')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Request Pro Investor/i }));
    expect(
      await screen.findByText(/Upgrade request for Pro Investor submitted/i)
    ).toBeInTheDocument();
  });
});
