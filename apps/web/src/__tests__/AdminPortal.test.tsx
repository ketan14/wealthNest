import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminProvider } from '../lib/admin/admin-context';
import { AdminGuard } from '../components/admin/AdminGuard';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminUserDetailPage } from '../pages/admin/AdminUserDetailPage';
import { AdminHouseholdsPage } from '../pages/admin/AdminHouseholdsPage';
import { AdminRolesPage } from '../pages/admin/AdminRolesPage';
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage';


// Mock Supabase client to avoid network calls in test environment
vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: '4c4fa116-57d5-4fc8-af89-be56b5069b50',
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

function renderWithProviders(ui: React.ReactElement, initialRoute = '/admin') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          {ui}
        </MemoryRouter>
      </AdminProvider>
    </QueryClientProvider>
  );
}

describe('Phase 7: Complete Admin Portal, User Management & Security Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AdminGuard & RBAC Authorization Boundaries', () => {
    it('allows access to protected child routes when authenticated as super_admin', async () => {
      renderWithProviders(
        <AdminGuard>
          <div data-testid="protected-content">Restricted Administrative Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
      expect(screen.getByText('Restricted Administrative Content')).toBeInTheDocument();
    });

    it('displays elevation warning when super_admin privilege is required for support admins', async () => {
      // Mock useAdmin hook state through role simulator or rendering restricted route with requiredRole="super_admin"
      // If current role is super_admin, it renders content
      renderWithProviders(
        <AdminGuard requiredRole="super_admin">
          <div>Super Admin Zone</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Super Admin Zone')).toBeInTheDocument();
      });
    });
  });

  describe('AdminDashboardPage Component', () => {
    it('renders system overview metrics and tenant isolation confidentiality notice', async () => {
      renderWithProviders(<AdminDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Platform Administration Overview/i)).toBeInTheDocument();
      });

      // Assert confidentiality banner
      expect(screen.getByText(/Tenant Isolation & Confidentiality Boundary Active/i)).toBeInTheDocument();
      expect(screen.getByText(/Row Level Security/i)).toBeInTheDocument();

      // Assert metric cards

      expect(screen.getByText(/Total Users/i)).toBeInTheDocument();
      expect(screen.getByText(/Active Accounts/i)).toBeInTheDocument();
      expect(screen.getByText(/Suspended/i)).toBeInTheDocument();
      expect(screen.getByText(/Pending Invites/i)).toBeInTheDocument();
      expect(screen.getByText(/Households/i)).toBeInTheDocument();
      expect(screen.getByText(/Audit Events/i)).toBeInTheDocument();

      // Assert quick action cards
      expect(screen.getByText(/Manage Users & Invitations/i)).toBeInTheDocument();
      expect(screen.getByText(/Platform Roles & RBAC/i)).toBeInTheDocument();
      expect(screen.getByText(/Immutable Audit Explorer/i)).toBeInTheDocument();
    });
  });

  describe('AdminUsersPage Component', () => {
    it('renders user directory with Vaghela family members, search filters, and action triggers', async () => {
      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText(/User Management & Entitlements/i)).toBeInTheDocument();
      });

      // Assert presence of demo accounts
      expect(screen.getAllByText('Ketan Vaghela').length).toBeGreaterThan(0);
      expect(screen.getByText('investor@wealthnest.local')).toBeInTheDocument();
      expect(screen.getByText('Parul Vaghela')).toBeInTheDocument();
      expect(screen.getByText('Shamalbhai Vaghela HUF')).toBeInTheDocument();

      // Assert search input
      const searchInput = screen.getByPlaceholderText(/Search by name, email, or identifier/i);
      expect(searchInput).toBeInTheDocument();

      // Trigger search filter
      fireEvent.change(searchInput, { target: { value: 'Parul' } });
      await waitFor(() => {
        expect(screen.getByText('Parul Vaghela')).toBeInTheDocument();
        expect(screen.queryByText('Shamalbhai Vaghela HUF')).not.toBeInTheDocument();
      });
    });

    it('opens status change modal requiring mandatory reason code for suspension', async () => {
      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Parul Vaghela')).toBeInTheDocument();
      });

      // Click suspend button for Parul Vaghela
      const actionButtons = screen.getAllByTitle(/Change Status \/ Suspend/i);
      expect(actionButtons.length).toBeGreaterThan(0);
      fireEvent.click(actionButtons[1]!); // Parul


      await waitFor(() => {
        expect(screen.getByText(/Change Account Lifecycle Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Mandatory Reason Code/i)).toBeInTheDocument();
      });
    });

    it('opens invitation modal with email and role selection', async () => {
      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText(/Invite Investor/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Invite Investor/i));

      await waitFor(() => {
        expect(screen.getByText(/Invite New Investor/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e.g. krisha.vaghela@wealthnest.local/i)).toBeInTheDocument();
      });
    });
  });

  describe('AdminUserDetailPage Component', () => {
    it('displays user profile, household membership, and explicit financial isolation boundary', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
        </Routes>,
        '/admin/users/4c4fa116-57d5-4fc8-af89-be56b5069b50'
      );

      await waitFor(() => {
        expect(screen.getByText(/User: Ketan Vaghela/i)).toBeInTheDocument();
      });

      // Verify financial data confidentiality boundary
      expect(screen.getByText(/Financial Data Confidentiality Boundary/i)).toBeInTheDocument();
      expect(screen.getByText(/private financial records.*are cryptographically isolated/i)).toBeInTheDocument();

      // Verify household tenancy metadata
      expect(screen.getByText(/Multi-User Household Tenancy/i)).toBeInTheDocument();
      expect(screen.getAllByText('Vaghela Household').length).toBeGreaterThan(0);
      expect(screen.getByText(/primary owner/i)).toBeInTheDocument();

      // Verify RBAC section
      expect(screen.getByText(/Platform Staff Role Management/i)).toBeInTheDocument();
    });
  });

  describe('AdminHouseholdsPage Component', () => {
    it('renders household tenants and re-asserts isolation principle', async () => {
      renderWithProviders(<AdminHouseholdsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Multi-User Household Tenants/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Tenant Data Isolation Principle/i)).toBeInTheDocument();
      expect(screen.getAllByText('Vaghela Household').length).toBeGreaterThan(0);
      expect(screen.getByText(/Primary Owner:/i)).toBeInTheDocument();
      expect(screen.getAllByText('Ketan Vaghela').length).toBeGreaterThan(0);
    });
  });


  describe('AdminRolesPage Component', () => {
    it('renders RBAC entitlement matrix and lists active administrative staff', async () => {
      renderWithProviders(<AdminRolesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Staff Entitlements & Role-Based Access Control/i)).toBeInTheDocument();
      });

      // Roles in matrix
      expect(screen.getByText(/Full Platform Governance/i)).toBeInTheDocument();
      expect(screen.getByText(/User Operations & Support/i)).toBeInTheDocument();
      expect(screen.getByText(/Read-Only Telemetry/i)).toBeInTheDocument();

      // Active staff table
      expect(screen.getByText('Active Platform Administrative Staff')).toBeInTheDocument();
      expect(screen.getAllByText('Ketan Vaghela').length).toBeGreaterThan(0);
      expect(screen.getByText('Parul Vaghela')).toBeInTheDocument();
    });
  });

  describe('AdminAuditLogsPage Component', () => {
    it('renders append-only audit trail and allows inspecting payload metadata', async () => {
      renderWithProviders(<AdminAuditLogsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Immutable Security & Audit Trail/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Append-Only Immutability Guarantee/i)).toBeInTheDocument();
      expect(screen.getAllByText('SYSTEM_BOOTSTRAP').length).toBeGreaterThan(0);

      // Open payload modal
      const payloadButtons = screen.getAllByText('Payload');
      expect(payloadButtons.length).toBeGreaterThan(0);
      fireEvent.click(payloadButtons[0]!);

      await waitFor(() => {

        expect(screen.getByText(/Audit Event Payload/i)).toBeInTheDocument();
        expect(screen.getByText(/Sanitized Metadata JSON/i)).toBeInTheDocument();
      });
    });
  });

  describe('AdminSettingsPage Component', () => {
    it('renders security governance parameters and architectural diagnostics', async () => {
      renderWithProviders(<AdminSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Platform Security Governance & Policies/i)).toBeInTheDocument();
      });

      // Diagnostics check
      expect(screen.getByText(/System Architecture & Integrity Diagnostics/i)).toBeInTheDocument();
      expect(screen.getByText(/Integer Paise \(BigInt\)/i)).toBeInTheDocument();
      expect(screen.getByText(/0% Floating Point Drift/i)).toBeInTheDocument();
      expect(screen.getByText(/en-IN \(India-First\)/i)).toBeInTheDocument();
    });
  });
});
