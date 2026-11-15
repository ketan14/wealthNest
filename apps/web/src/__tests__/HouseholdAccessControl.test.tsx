import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ok } from '@wealthnest/shared';
import type {
  FamilyMember,
  FamilyMemberAccessGrant,
  HoldingOwnerShareInput,
  HouseholdAccessMember,
  HouseholdInvitationPreview,
  HouseholdSummary,
  LiabilityPartyShareInput,
  RecordVisibility,
} from '@wealthnest/domain';
import type { FamilyRepositoryPort, HouseholdRepositoryPort } from '@wealthnest/application';
import { AuthProvider } from '../lib/supabase/auth-context';
import { RepositoryProvider, defaultSupabaseBundle } from '../lib/persistence/repository-context';
import { HouseholdProvider, useHousehold } from '../lib/supabase/household-context';
import { FamilyProvider } from '../lib/family/family-context';
import { InviteAcceptPage } from '../pages/InviteAcceptPage';
import { JointOwnershipEditor } from '../components/household/JointOwnershipEditor';
import { VisibilityControl } from '../components/household/VisibilityControl';
import { supabase } from '../lib/supabase/client';

vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const MOCK_USER_ID = '11111111-1111-4111-8111-111111111102';
const MOCK_HH_PRIMARY = '22222222-2222-4222-8222-222222222201';
const MOCK_HH_SECONDARY = '22222222-2222-4222-8222-222222222202';

const SAMPLE_MEMBERS: FamilyMember[] = [
  {
    id: 'fm-ketan',
    userId: MOCK_USER_ID,
    householdId: MOCK_HH_PRIMARY,
    name: 'Ketan Vaghela',
    relationship: 'self',
    entityType: 'individual',
    panMasked: 'ABCDE1234F',
    colorHex: '#3b82f6',
    isPrimary: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'fm-ananya',
    userId: MOCK_USER_ID,
    householdId: MOCK_HH_PRIMARY,
    name: 'Ananya Vaghela',
    relationship: 'spouse',
    entityType: 'individual',
    panMasked: 'FGHIJ5678K',
    colorHex: '#ec4899',
    isPrimary: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

function createMockRepos(overrides?: {
  households?: HouseholdSummary[];
  householdMembers?: HouseholdAccessMember[];
  accessGrants?: FamilyMemberAccessGrant[];
  preview?: HouseholdInvitationPreview;
}) {
  const households = overrides?.households ?? [
    {
      id: MOCK_HH_PRIMARY,
      name: 'Vaghela Marital Household',
      role: 'admin',
      status: 'active',
      memberCount: 4,
    },
    {
      id: MOCK_HH_SECONDARY,
      name: 'Shinde Parental Household',
      role: 'viewer',
      status: 'active',
      memberCount: 2,
    },
  ];

  const householdMembers = overrides?.householdMembers ?? [
    {
      id: 'hm-1',
      householdId: MOCK_HH_PRIMARY,
      userId: '11111111-1111-4111-8111-111111111101',
      householdRole: 'primary_owner',
      status: 'active',
      displayName: 'Ketan Vaghela',
      email: 'ketan@wealthnest.local',
      joinedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'hm-2',
      householdId: MOCK_HH_PRIMARY,
      userId: MOCK_USER_ID,
      householdRole: 'admin',
      status: 'active',
      displayName: 'Ananya Vaghela',
      email: 'ananya@wealthnest.local',
      joinedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'hm-3',
      householdId: MOCK_HH_PRIMARY,
      userId: '11111111-1111-4111-8111-111111111104',
      householdRole: 'viewer',
      status: 'active',
      displayName: 'Meera Nair (CA)',
      email: 'meera@wealthnest.local',
      joinedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const householdRepo: HouseholdRepositoryPort = Object.assign(
    Object.create(Object.getPrototypeOf(defaultSupabaseBundle.householdRepo)),
    defaultSupabaseBundle.householdRepo,
    {
      listMyHouseholds: vi.fn().mockResolvedValue(ok(households)),
      listAccessMembers: vi.fn().mockResolvedValue(
        ok(
          householdMembers.map((m) => ({
            id: m.id,
            householdId: m.householdId,
            userId: m.userId,
            displayName: m.displayName,
            email: m.email,
            householdRole: m.householdRole,
            status: m.status,
            joinedAt: m.joinedAt,
          }))
        )
      ),
      listHouseholdMembers: vi.fn().mockResolvedValue(ok(householdMembers)),
      listHouseholdInvitations: vi.fn().mockResolvedValue(ok([])),
      listFamilyMemberAccessGrants: vi
        .fn()
        .mockResolvedValue(ok(overrides?.accessGrants ?? [])),
      createHousehold: vi.fn().mockResolvedValue(
        ok({
          id: 'hh-new-huf',
          name: 'Vaghela HUF Trust',
          role: 'primary_owner',
          status: 'active',
          memberCount: 1,
        })
      ),
      previewInvitation: vi.fn().mockResolvedValue(
        ok(
          overrides?.preview ?? {
            valid: true,
            householdName: 'Vaghela Marital Household',
            householdRole: 'admin',
            invitedEmail: 'a***@wealthnest.local',
            familyMemberName: 'Ananya Vaghela',
          }
        )
      ),
      acceptInvitation: vi.fn().mockResolvedValue(
        ok({
          householdId: MOCK_HH_PRIMARY,
          householdRole: 'admin',
          familyMemberId: 'fm-ananya',
        })
      ),
    }
  );

  const familyRepo: FamilyRepositoryPort = Object.assign(
    Object.create(Object.getPrototypeOf(defaultSupabaseBundle.familyRepo)),
    defaultSupabaseBundle.familyRepo,
    {
      getMembers: vi.fn().mockResolvedValue(ok(SAMPLE_MEMBERS)),
      getMembersByHousehold: vi.fn().mockResolvedValue(ok(SAMPLE_MEMBERS)),
      getAccounts: vi.fn().mockResolvedValue(ok([])),
      getAccountsByHousehold: vi.fn().mockResolvedValue(ok([])),
    }
  );

  return { householdRepo, familyRepo };
}

function HouseholdProbe() {
  const {
    activeHouseholdId,
    activeHousehold,
    householdRole,
    canEditFinancials,
    canManageMembers,
    canManageAdminsOrTransfer,
    switchHousehold,
    createHousehold,
  } = useHousehold();

  return (
    <div>
      <span data-testid="active-hh-id">{activeHouseholdId ?? 'none'}</span>
      <span data-testid="active-hh-name">{activeHousehold?.name ?? 'none'}</span>
      <span data-testid="active-role">{householdRole ?? 'none'}</span>
      <span data-testid="can-edit">{String(canEditFinancials)}</span>
      <span data-testid="can-manage-members">{String(canManageMembers)}</span>
      <span data-testid="can-transfer">{String(canManageAdminsOrTransfer)}</span>
      <button type="button" onClick={() => switchHousehold(MOCK_HH_SECONDARY)}>
        Switch to Parental
      </button>
      <button type="button" onClick={() => void createHousehold('Vaghela HUF Trust')}>
        Create Household
      </button>
    </div>
  );
}

describe('Phase 18A Part 2: Household Access Control, Invitations & Joint Ownership UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          user: {
            id: MOCK_USER_ID,
            email: 'ananya@wealthnest.local',
            user_metadata: { display_name: 'Ananya Vaghela' },
          },
        },
      },
    });
  });

  describe('HouseholdContext Multi-Household & Role Capabilities', () => {
    it('loads user households, computes role flags, and clears QueryClient cache on switch', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      const clearSpy = vi.spyOn(queryClient, 'clear');

      const { householdRepo, familyRepo } = createMockRepos();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RepositoryProvider customRepositories={{ householdRepo, familyRepo }}>
              <HouseholdProvider>
                <HouseholdProbe />
              </HouseholdProvider>
            </RepositoryProvider>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('active-hh-id').textContent).toBe(MOCK_HH_PRIMARY);
      });

      // Seed active household query data, then switch households and verify isolation purge
      queryClient.setQueryData(['holdings', MOCK_HH_PRIMARY], [{ id: 'stale-holding' }]);
      const clearsBeforeSwitch = clearSpy.mock.calls.length;

      // Primary marital household: role = 'admin' (can edit & manage members, NOT appoint admins/transfer owner)
      expect(screen.getByTestId('active-role').textContent).toBe('admin');
      expect(screen.getByTestId('can-edit').textContent).toBe('true');
      expect(screen.getByTestId('can-manage-members').textContent).toBe('true');
      expect(screen.getByTestId('can-transfer').textContent).toBe('false');

      fireEvent.click(screen.getByRole('button', { name: 'Switch to Parental' }));

      await waitFor(() => {
        expect(screen.getByTestId('active-hh-id').textContent).toBe(MOCK_HH_SECONDARY);
      });

      // Secondary parental household: role = 'viewer' -> read-only permissions & cleared cache
      expect(clearSpy.mock.calls.length).toBeGreaterThan(clearsBeforeSwitch);
      expect(queryClient.getQueryData(['holdings', MOCK_HH_PRIMARY])).toBeUndefined();
      expect(screen.getByTestId('active-role').textContent).toBe('viewer');
      expect(screen.getByTestId('can-edit').textContent).toBe('false');
      expect(screen.getByTestId('can-manage-members').textContent).toBe('false');
    });

    it('invokes householdRepo.createHousehold when creating a secondary workspace', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      const { householdRepo, familyRepo } = createMockRepos();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RepositoryProvider customRepositories={{ householdRepo, familyRepo }}>
              <HouseholdProvider>
                <HouseholdProbe />
              </HouseholdProvider>
            </RepositoryProvider>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('active-hh-id').textContent).toBe(MOCK_HH_PRIMARY);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Create Household' }));

      await waitFor(() => {
        expect(householdRepo.createHousehold).toHaveBeenCalledWith(
          'Vaghela HUF Trust',
          'Ananya Vaghela'
        );
      });
    });
  });

  describe('InviteAcceptPage Flow', () => {
    it('shows unauthenticated invitation preview and preserves invite token on signup/login links', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const { householdRepo, familyRepo } = createMockRepos();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RepositoryProvider customRepositories={{ householdRepo, familyRepo }}>
              <HouseholdProvider>
                <FamilyProvider>
                  <MemoryRouter initialEntries={['/invite?token=raw-invite-token-123']}>
                    <Routes>
                      <Route path="/invite" element={<InviteAcceptPage />} />
                    </Routes>
                  </MemoryRouter>
                </FamilyProvider>
              </HouseholdProvider>
            </RepositoryProvider>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Vaghela Marital Household')).toBeInTheDocument();
      });

      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('Ananya Vaghela')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Create Account/i }).getAttribute('href')
      ).toBe('/signup?invite=raw-invite-token-123');
      expect(screen.getByRole('link', { name: /Sign In/i }).getAttribute('href')).toBe(
        '/login?invite=raw-invite-token-123'
      );
    });

    it('renders explicit expiry message when invitation preview reports EXPIRED', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const { householdRepo, familyRepo } = createMockRepos({
        preview: { valid: false, reason: 'EXPIRED' },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RepositoryProvider customRepositories={{ householdRepo, familyRepo }}>
              <HouseholdProvider>
                <FamilyProvider>
                  <MemoryRouter initialEntries={['/invite?token=expired-tok']}>
                    <Routes>
                      <Route path="/invite" element={<InviteAcceptPage />} />
                    </Routes>
                  </MemoryRouter>
                </FamilyProvider>
              </HouseholdProvider>
            </RepositoryProvider>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/invitation has expired/i);
      });
    });

    it('accepts a valid invitation for an authenticated user and switches to joined household', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const { householdRepo, familyRepo } = createMockRepos();

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RepositoryProvider customRepositories={{ householdRepo, familyRepo }}>
              <HouseholdProvider>
                <FamilyProvider>
                  <MemoryRouter initialEntries={['/invite?token=valid-tok-999']}>
                    <Routes>
                      <Route path="/invite" element={<InviteAcceptPage />} />
                      <Route path="/" element={<div>Dashboard</div>} />
                    </Routes>
                  </MemoryRouter>
                </FamilyProvider>
              </HouseholdProvider>
            </RepositoryProvider>
          </AuthProvider>
        </QueryClientProvider>
      );

      const acceptBtn = await screen.findByRole('button', {
        name: /Accept & Join Household/i,
      });
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(householdRepo.acceptInvitation).toHaveBeenCalledWith('valid-tok-999');
        expect(screen.getByText(/Joined Vaghela Marital Household/i)).toBeInTheDocument();
      });
    });
  });

  describe('JointOwnershipEditor Component', () => {
    it('adds co-owners evenly and displays remaining split percentage warnings until sum equals 100%', () => {
      function Harness() {
        const [shares, setShares] = React.useState<HoldingOwnerShareInput[]>([
          { familyMemberId: 'fm-ketan', ownershipShare: 100, isPrimaryOwner: true },
        ]);
        return (
          <JointOwnershipEditor
            mode="holding"
            members={SAMPLE_MEMBERS}
            shares={shares}
            onChange={setShares}
          />
        );
      }

      render(<Harness />);
      expect(screen.getByText(/Total\s*100\s*%/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Add Joint Co-Owner/i }));

      const shareInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(shareInputs).toHaveLength(2);
      expect(Number(shareInputs[0]?.value) + Number(shareInputs[1]?.value)).toBeCloseTo(100, 2);

      // Split evenly 50% / 50%, then mutate row 0 to trigger 80% warning
      fireEvent.click(screen.getByRole('button', { name: /Split Evenly/i }));
      const evenInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(Number(evenInputs[0]?.value)).toBeCloseTo(50, 2);
      expect(Number(evenInputs[1]?.value)).toBeCloseTo(50, 2);

      fireEvent.change(evenInputs[0]!, { target: { value: '30' } });
      expect(screen.getByText(/Total\s*80\s*%/i)).toBeInTheDocument();
    });

    it('renders liability borrower roles and supports adding co-borrower rows', () => {
      function Harness() {
        const [parties, setParties] = React.useState<LiabilityPartyShareInput[]>([
          {
            familyMemberId: 'fm-ketan',
            partyRole: 'primary_borrower',
            liabilityShare: 100,
          },
        ]);
        return (
          <JointOwnershipEditor
            mode="liability"
            members={SAMPLE_MEMBERS}
            shares={parties}
            onChange={setParties}
          />
        );
      }

      render(<Harness />);
      fireEvent.click(screen.getByRole('button', { name: /Add Co-Borrower/i }));
      expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
      expect(screen.getAllByText('Co-Borrower').length).toBeGreaterThan(0);
    });
  });

  describe('VisibilityControl Component', () => {
    it('switches visibility modes and renders grantee selector when restricted is chosen', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const { householdRepo, familyRepo } = createMockRepos();

      function VisibilityHarness() {
        const [visibility, setVisibility] =
          React.useState<RecordVisibility>('household_shared');
        const [grantees, setGrantees] = React.useState<string[]>([]);
        return (
          <VisibilityControl
            visibility={visibility}
            onChange={setVisibility}
            granteeUserIds={grantees}
            onGranteeUserIdsChange={setGrantees}
          />
        );
      }

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RepositoryProvider customRepositories={{ householdRepo, familyRepo }}>
              <HouseholdProvider>
                <VisibilityHarness />
              </HouseholdProvider>
            </RepositoryProvider>
          </AuthProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(householdRepo.listMyHouseholds).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /Owner Only/i }));
      fireEvent.click(screen.getByRole('button', { name: /Restricted/i }));

      await waitFor(() => {
        expect(householdRepo.listAccessMembers).toHaveBeenCalledWith(MOCK_HH_PRIMARY);
      });

      const caPill = await screen.findByRole('button', { name: /Meera Nair \(CA\)/i });
      fireEvent.click(caPill);
      expect(caPill.className).toContain('bg-cyan-500/15');
    });
  });
});
