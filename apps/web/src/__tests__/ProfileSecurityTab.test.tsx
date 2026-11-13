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

describe('ProfileSecurityTab In-App Password Change (AUTH-02 & AUTH-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  function renderTab(userEmail?: string | null) {
    return render(
      <AuthProvider>
        <ProfileSecurityTab
          displayName="Ketan Vaghela"
          email={userEmail || 'local@wealthnest.local'}
          userEmail={userEmail}
          nameInput="Ketan Vaghela"
          onNameInputChange={vi.fn()}
          isSavingName={false}
          nameSavedSuccess={false}
          onSaveProfile={vi.fn()}
          onSignOut={vi.fn()}
        />
      </AuthProvider>
    );
  }

  it('disables in-app password updates when running in Demo / Local Vault mode', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    });

    renderTab(null);

    expect(
      await screen.findByText(/Password updates apply to authenticated Supabase server\/cloud accounts/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update Password/i })).not.toBeInTheDocument();
  });

  it('validates complexity and calls supabase.auth.updateUser for authenticated Supabase users', async () => {
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

    const updateBtn = await screen.findByRole('button', { name: /Update Password/i });
    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmInput = screen.getByLabelText('Confirm New Password');

    fireEvent.change(newPasswordInput, { target: { value: 'weakpass' } });
    fireEvent.change(confirmInput, { target: { value: 'weakpass' } });
    fireEvent.click(updateBtn);

    expect(await screen.findByText(/Password must be at least 12 characters/i)).toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();

    fireEvent.change(newPasswordInput, { target: { value: 'WealthNest#2027' } });
    fireEvent.change(confirmInput, { target: { value: 'WealthNest#2027' } });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'WealthNest#2027',
      });
    });

    expect(await screen.findByText(/Your password has been updated\./i)).toBeInTheDocument();
  });
});

