import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ok } from '@wealthnest/shared';
import {
  GetNetWorthSummaryUseCase,
  UpdateLiabilityUseCase,
  LiabilityRepositoryPort,
  HoldingRepositoryPort,
} from '@wealthnest/application';
import { HomePage } from '../pages/HomePage';
import { AuthProvider } from '../lib/supabase/auth-context';
import { RepositoryProvider, createSqliteRepositoryBundle } from '../lib/persistence/repository-context';
import { TauriSqliteAdapter, DEFAULT_LOCAL_USER_ID } from '../lib/tauri/tauri-sqlite-adapter';
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

  it('updates TauriSqliteAdapter loan balance and reflects invalidated outstanding debt on HomePage System Overview', async () => {
    const db = new TauriSqliteAdapter(undefined, { persistToStorage: false });
    db.initialize();
    const sqliteBundle = createSqliteRepositoryBundle(db);

    const updateUc = new UpdateLiabilityUseCase(sqliteBundle.liabilityRepo);
    const updateRes = await updateUc.execute({
      id: 'lia-local-1',
      userId: DEFAULT_LOCAL_USER_ID,
      householdId: 'hh-local-vaghela',
      originalPrincipalCents: 490000000n,
      currentBalanceCents: 195000000n,
      startDate: '2023-02-01',
    });
    expect(updateRes.success).toBe(true);

    const netWorthUc = new GetNetWorthSummaryUseCase(
      sqliteBundle.holdingRepo,
      sqliteBundle.liabilityRepo
    );
    const summaryRes = await netWorthUc.execute({
      userId: DEFAULT_LOCAL_USER_ID,
      householdId: 'hh-local-vaghela',
    });
    expect(summaryRes.success).toBe(true);
    if (summaryRes.success) {
      expect(summaryRes.value.totalLiabilities.cents).toBe(195000000n);
    }

    // Also verify System Overview (<HomePage />) reflects updated debt once cache is invalidated
    let currentBalanceCents = 412500000n;
    const mockHoldingRepo: Partial<HoldingRepositoryPort> = {
      listDetailsByHousehold: vi.fn().mockResolvedValue(ok([])),
      listDetailsByUser: vi.fn().mockResolvedValue(ok([])),
    };
    const pendingResolvers: Array<() => void> = [];
    let shouldDelayNextFetch = false;

    const mockLiabilityRepo: Partial<LiabilityRepositoryPort> = {
      listLiabilitiesByHousehold: vi.fn().mockImplementation(async () =>
        ok([
          {
            id: 'lia-1',
            userId: 'user-1',
            name: 'Home Loan',
            loanType: 'home_loan',
            lender: 'SBI',
            originalPrincipalCents: 500000000n,
            currentBalanceCents,
            interestRate: 8.5,
            interestType: 'floating',
            emiAmountCents: 4339100n,
            currency: 'INR',
            startDate: '2023-01-15',
            status: 'active',
            createdAt: '2023-01-15T00:00:00Z',
            updatedAt: '2026-11-20T00:00:00Z',
          },
        ])
      ),
      listLiabilitiesByUser: vi.fn().mockResolvedValue(ok([])),
      listAssetLiabilityLinks: vi.fn().mockResolvedValue(ok([])),
      listLiabilityBalances: vi.fn().mockImplementation(async () => {
        if (shouldDelayNextFetch) {
          await new Promise<void>((resolve) => {
            pendingResolvers.push(resolve);
          });
        }
        return ok([
          {
            id: 'bal-1',
            liabilityId: 'lia-1',
            userId: 'user-1',
            balanceCents: currentBalanceCents,
            asOfDate: '2026-11-20',
            source: 'manual',
            createdAt: '2026-11-20T00:00:00Z',
          },
        ]);
      }),
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 1000 * 60 * 5 } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RepositoryProvider
            mode="sqlite"
            customRepositories={{
              holdingRepo: mockHoldingRepo as HoldingRepositoryPort,
              liabilityRepo: mockLiabilityRepo as LiabilityRepositoryPort,
            }}
          >
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

    await waitFor(() => {
      expect(screen.getAllByText('₹41.25L').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Syncing…')).not.toBeInTheDocument();

    // Simulate part-payment & cache invalidation triggered from LiabilitiesPage
    currentBalanceCents = 120000000n;
    shouldDelayNextFetch = true;
    const invalidationPromise = queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });

    await waitFor(() => {
      expect(screen.getAllByText('Syncing…').length).toBeGreaterThan(0);
    });

    shouldDelayNextFetch = false;
    pendingResolvers.forEach((resolve) => resolve());
    await invalidationPromise;

    await waitFor(() => {
      expect(screen.getAllByText('₹12.00L').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Syncing…')).not.toBeInTheDocument();
  });
});
