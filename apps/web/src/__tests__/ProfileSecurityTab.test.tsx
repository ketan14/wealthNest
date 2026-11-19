import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../lib/supabase/auth-context';
import { ProfileSecurityTab } from '../components/settings/ProfileSecurityTab';
import { supabase } from '../lib/supabase/client';

vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe('ProfileSecurityTab Inline Edit & Password Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  function renderTab(
    userEmail?: string | null,
    overrides?: {
      email?: string;
      legalName?: string;
      onUpdateDisplayName?: (v: string) => Promise<void> | void;
      onUpdateLegalName?: (v: string) => Promise<void> | void;
    }
  ) {
    return render(
      <AuthProvider>
        <ProfileSecurityTab
          displayName="Ketan Vaghela"
          legalName={overrides?.legalName ?? ''}
          email={overrides?.email ?? (userEmail || 'investor@wealthnest.in')}
          userEmail={userEmail}
          onUpdateDisplayName={overrides?.onUpdateDisplayName ?? vi.fn()}
          onUpdateLegalName={overrides?.onUpdateLegalName ?? vi.fn()}
          onSignOut={vi.fn()}
        />
      </AuthProvider>
    );
  }

  it('hides Change Password modal trigger when running in Demo / Local Vault mode', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    });

    renderTab(null);

    expect(
      await screen.findByText(/Password updates apply to authenticated Supabase server\/cloud accounts/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Change Password/i })).not.toBeInTheDocument();
  });

  it('unifies active session email instead of displaying user@wealthnest.local', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          user: { id: 'usr-live-1', email: 'ketan.v@example.com' },
        },
      },
    });

    renderTab('ketan.v@example.com', { email: 'user@wealthnest.local' });

    expect(await screen.findByText('ketan.v@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Signed in as ketan\.v@example\.com/i)).toBeInTheDocument();
    expect(screen.queryByText(/user@wealthnest\.local/i)).not.toBeInTheDocument();
  });

  it('opens EditSettingModal for Display Name and Legal/KYC Name with validation', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    });

    const onUpdateDisplayName = vi.fn().mockResolvedValue(undefined);
    const onUpdateLegalName = vi.fn().mockResolvedValue(undefined);

    renderTab(null, { onUpdateDisplayName, onUpdateLegalName });

    // Open Display Name edit modal
    fireEvent.click(screen.getByRole('button', { name: /Edit Display Name/i }));
    const displayInput = await screen.findByLabelText('Display Name');

    // Empty validation check
    fireEvent.change(displayInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    expect(await screen.findByText(/Display name cannot be empty/i)).toBeInTheDocument();
    expect(onUpdateDisplayName).not.toHaveBeenCalled();

    // Valid save
    fireEvent.change(displayInput, { target: { value: 'Ketan Shamalbhai' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(onUpdateDisplayName).toHaveBeenCalledWith('Ketan Shamalbhai');
    });

    // Open Legal / KYC Name edit modal
    fireEvent.click(screen.getByRole('button', { name: /Edit Legal \/ KYC Name/i }));
    const legalInput = await screen.findByLabelText('Legal / KYC Name');
    fireEvent.change(legalInput, { target: { value: 'KETAN S VAGHELA' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(onUpdateLegalName).toHaveBeenCalledWith('KETAN S VAGHELA');
    });
  });

  it('opens ChangePasswordModal with live rules, mismatch check, and calls supabase.auth.updateUser', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          user: { id: 'usr-live-1', email: 'investor@wealthnest.app' },
        },
      },
    });
    (supabase.auth.updateUser as any).mockResolvedValueOnce({
      data: { user: { id: 'usr-live-1', email: 'investor@wealthnest.app' } },
      error: null,
    });

    renderTab('investor@wealthnest.app');

    const openModalBtn = await screen.findByRole('button', { name: /Change Password/i });
    fireEvent.click(openModalBtn);

    const newPasswordInput = await screen.findByLabelText('New Password');
    const confirmInput = screen.getByLabelText('Confirm New Password');
    const updateBtn = screen.getByRole('button', { name: /Update Password/i });

    // Instant mismatch feedback
    fireEvent.change(newPasswordInput, { target: { value: 'WealthNest#2027' } });
    fireEvent.change(confirmInput, { target: { value: 'WealthNest#9999' } });
    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();

    // Weak password blocked by complexity check
    fireEvent.change(newPasswordInput, { target: { value: 'weakpass' } });
    fireEvent.change(confirmInput, { target: { value: 'weakpass' } });
    fireEvent.click(updateBtn);

    expect(await screen.findByText(/Password must be at least 12 characters/i)).toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();

    // Valid strong password submission
    fireEvent.change(newPasswordInput, { target: { value: 'WealthNest#2027' } });
    fireEvent.change(confirmInput, { target: { value: 'WealthNest#2027' } });
    expect(await screen.findByText(/Passwords match/i)).toBeInTheDocument();

    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'WealthNest#2027',
      });
    });

    expect(await screen.findByText(/Your password has been updated\./i)).toBeInTheDocument();
  });
});
