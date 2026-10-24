import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminProvider } from '../lib/admin/admin-context';
import { SupportSessionProvider, useSupportSession } from '../lib/admin/support-session-context';
import { PreferencesProvider } from '../lib/preferences/preferences-context';
import { FamilyProvider } from '../lib/family/family-context';
import { SupportModeBanner } from '../components/admin/SupportModeBanner';
import { ViewAsUserModal } from '../components/admin/ViewAsUserModal';
import { AdminUserDetailPage } from '../pages/admin/AdminUserDetailPage';
import { PortfolioPage } from '../pages/PortfolioPage';

// Mock Supabase client
vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: '4c4fa116-57d5-4fc8-af89-be56b5069b50', // Ketan Vaghela
              email: 'investor@wealthnest.local',
              user_metadata: { display_name: 'Ketan Vaghela' },
            },
          },
        },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    rpc: vi.fn().mockImplementation((fn: string) => {
      if (fn === 'get_platform_admin_role') {
        return Promise.resolve({ data: 'super_admin', error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
        }),
      }),
    }),
  },
}));

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminProvider>
        <SupportSessionProvider>
          <PreferencesProvider>
            <FamilyProvider>
              <MemoryRouter initialEntries={[initialRoute]}>
                {ui}
              </MemoryRouter>
            </FamilyProvider>
          </PreferencesProvider>
        </SupportSessionProvider>
      </AdminProvider>
    </QueryClientProvider>
  );
}

// Helper test harness component for testing SupportSessionContext programmatically
function SupportSessionTestHarness() {
  const {
    isSupportModeActive,
    activeSession,
    targetUser,
    formattedTimeRemaining,
    startSupportSession,
    endSupportSession,
  } = useSupportSession();

  return (
    <div>
      <SupportModeBanner />
      <div data-testid="support-active">{isSupportModeActive ? 'YES' : 'NO'}</div>
      <div data-testid="session-id">{activeSession?.id || 'NONE'}</div>
      <div data-testid="target-name">{targetUser?.displayName || 'NONE'}</div>
      <div data-testid="remaining-time">{formattedTimeRemaining}</div>
      <button
        data-testid="start-shamalbhai-btn"
        onClick={() =>
          startSupportSession(
            'usr-shamalbhai-vaghela-03',
            'Shamalbhai Vaghela HUF',
            'Investigating Section 112A LTCG tax shield report'
          )
        }
      >
        Start Shamalbhai Session
      </button>
      <button data-testid="end-session-btn" onClick={() => endSupportSession()}>
        End Session
      </button>
    </div>
  );
}

describe('Phase 8: Secure Admin View-as-User / Support Impersonation Mode', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('Session Initiation & Invariants', () => {
    it('initiates active support session and renders high-visibility banner', async () => {
      renderWithProviders(<SupportSessionTestHarness />);

      expect(screen.getByTestId('support-active').textContent).toBe('NO');
      expect(screen.queryByRole('banner')).toBeNull();

      fireEvent.click(screen.getByTestId('start-shamalbhai-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('support-active').textContent).toBe('YES');
      });

      expect(screen.getByTestId('target-name').textContent).toBe('Shamalbhai Vaghela HUF');
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByText('Support Impersonation Mode')).toBeInTheDocument();
      expect(screen.getAllByText('Shamalbhai Vaghela HUF').length).toBeGreaterThan(0);
      expect(screen.getByText('Read-Only • Direct Mutations Disabled')).toBeInTheDocument();
      expect(screen.getByText('Exit View as User')).toBeInTheDocument();
    });

    it('terminates active support session on exit button click', async () => {
      renderWithProviders(<SupportSessionTestHarness />);

      fireEvent.click(screen.getByTestId('start-shamalbhai-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('support-active').textContent).toBe('YES');
      });

      const exitBtn = screen.getByText('Exit View as User');
      fireEvent.click(exitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('support-active').textContent).toBe('NO');
      });
      expect(screen.queryByRole('banner')).toBeNull();
    });
  });

  describe('ViewAsUserModal Component', () => {
    const targetUser = {
      id: 'usr-shamalbhai-vaghela-03',
      displayName: 'Shamalbhai Vaghela HUF',
      email: 'shamalbhai.huf@wealthnest.local',
    };

    it('disables submit button until reason reaches minimum 8 characters', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <ViewAsUserModal isOpen={true} onClose={handleClose} targetUser={targetUser} />
      );

      const submitBtn = screen.getByRole('button', { name: /Start Support Session/i });
      expect(submitBtn).toBeDisabled();

      const textarea = screen.getByPlaceholderText(/Investigating Section 112A/i);
      fireEvent.change(textarea, { target: { value: 'Fix' } });
      expect(submitBtn).toBeDisabled();

      fireEvent.change(textarea, {
        target: { value: 'Investigating Section 112A tax report discrepancy' },
      });
      expect(submitBtn).toBeEnabled();
    });

    it('renders security isolation notice and targets correct family account', () => {
      renderWithProviders(
        <ViewAsUserModal isOpen={true} onClose={vi.fn()} targetUser={targetUser} />
      );

      expect(screen.getByText('Administrative Isolation Notice')).toBeInTheDocument();
      expect(screen.getByText(/Zero credentials are exchanged/i)).toBeInTheDocument();
      expect(screen.getAllByText('Shamalbhai Vaghela HUF').length).toBeGreaterThan(0);
    });
  });

  describe('AdminUserDetailPage Integration', () => {
    it('renders View Application as User button for non-self account', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
        </Routes>,
        '/admin/users/usr-shamalbhai-vaghela-03'
      );

      await waitFor(() => {
        expect(screen.getByText('View Application as User')).toBeInTheDocument();
      });
    });

    it('does not render View Application as User button for admin own account', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
        </Routes>,
        '/admin/users/4c4fa116-57d5-4fc8-af89-be56b5069b50' // Ketan Vaghela self
      );

      await waitFor(() => {
        expect(screen.getAllByText('Ketan Vaghela').length).toBeGreaterThan(0);
      });

      expect(screen.queryByText('View Application as User')).toBeNull();
    });
  });

  describe('Read-Only Guarantee on Investor Views', () => {
    it('disables Add Holding and Import CAS buttons during active support mode', async () => {
      // First mount test harness to activate support mode
      const TestContainer = () => {
        const { startSupportSession } = useSupportSession();
        return (
          <div>
            <SupportModeBanner />
            <button
              data-testid="activate-support"
              onClick={() =>
                startSupportSession(
                  'usr-shamalbhai-vaghela-03',
                  'Shamalbhai Vaghela HUF',
                  'Checking portfolio sync in support mode'
                )
              }
            >
              Activate
            </button>
            <PortfolioPage />
          </div>
        );
      };

      renderWithProviders(<TestContainer />, '/portfolio');

      // Before activation: buttons are enabled
      const importBtn = screen.getByRole('button', { name: /Import CAS/i });
      const addHoldingBtn = screen.getByRole('button', { name: /Add Holding/i });
      expect(importBtn).not.toBeDisabled();
      expect(addHoldingBtn).not.toBeDisabled();

      // Activate support mode
      fireEvent.click(screen.getByTestId('activate-support'));

      await waitFor(() => {
        expect(screen.getByRole('banner')).toBeInTheDocument();
      });

      // After activation: mutation buttons MUST be disabled
      expect(importBtn).toBeDisabled();
      expect(addHoldingBtn).toBeDisabled();
    });
  });
});
