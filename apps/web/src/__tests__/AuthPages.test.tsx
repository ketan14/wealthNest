import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../lib/supabase/auth-context';
import { SignUpPage } from '../pages/SignUpPage';
import { LoginPage } from '../pages/LoginPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { supabase } from '../lib/supabase/client';
import { connectionManager } from '../lib/services/connection-manager';
import { SERVER_CONFIG_STORAGE_KEY } from '../lib/config/server-config';
import { formatBackendUnreachableMessage } from '../components/auth/AuthBackendStatusBar';

// Mock Supabase client
vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

function renderWithProviders(ui: React.ReactElement, initialRoute = '/signup') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/" element={<div data-testid="home-page">Home Dashboard</div>} />
          </Routes>
          {ui}
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Dedicated Authentication Pages (SignUpPage & LoginPage)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.removeItem(SERVER_CONFIG_STORAGE_KEY);
    await connectionManager.resetToDefaults();
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    });
  });

  describe('SignUpPage Rendering & Layout', () => {
    it('renders branding, value proposition headlines, and form elements', async () => {
      renderWithProviders(<></>, '/signup');

      // Left branding elements
      expect(
        screen.getByRole('heading', { name: /Build a clearer picture of your wealth/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/Understand your total net worth/i)).toBeInTheDocument();
      expect(screen.getByText(/Track investments and property values/i)).toBeInTheDocument();
      expect(screen.getByText(/Manage household assets and liabilities/i)).toBeInTheDocument();

      // Right form elements
      expect(
        screen.getByRole('heading', { name: /Create your WealthNest account/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Confirm Password$/i)).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Terms of Service/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Sign in/i })).toHaveAttribute('href', '/login');
    });

    it('toggles password and confirm password visibility', async () => {
      renderWithProviders(<></>, '/signup');

      const passwordInput = screen.getByLabelText(/^Password$/i) as HTMLInputElement;
      const togglePasswordBtn = screen.getByTestId('toggle-password-btn');

      expect(passwordInput.type).toBe('password');
      fireEvent.click(togglePasswordBtn);
      expect(passwordInput.type).toBe('text');
      fireEvent.click(togglePasswordBtn);
      expect(passwordInput.type).toBe('password');

      const confirmInput = screen.getByLabelText(/^Confirm Password$/i) as HTMLInputElement;
      const toggleConfirmBtn = screen.getByTestId('toggle-confirm-password-btn');

      expect(confirmInput.type).toBe('password');
      fireEvent.click(toggleConfirmBtn);
      expect(confirmInput.type).toBe('text');
    });

    it('opens and closes terms and privacy modal', async () => {
      renderWithProviders(<></>, '/signup');

      const termsBtn = screen.getByRole('button', { name: /Terms of Service/i });
      fireEvent.click(termsBtn);

      expect(screen.getByText(/WealthNest Terms & Privacy/i)).toBeInTheDocument();
      expect(screen.getByText(/Data Privacy & Financial Encryption/i)).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: /Close/i });
      fireEvent.click(closeBtn);

      expect(screen.queryByText(/WealthNest Terms & Privacy/i)).not.toBeInTheDocument();
    });
  });

  describe('SignUpPage Client-Side Validation', () => {
    it('shows validation errors when submitting an empty form', async () => {
      renderWithProviders(<></>, '/signup');

      const submitBtn = screen.getByRole('button', { name: /Create Account/i });
      fireEvent.click(submitBtn);

      expect(await screen.findByText(/Full name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Email address is required/i)).toBeInTheDocument();
      expect(screen.getByText(/^Password is required$/i)).toBeInTheDocument();
      expect(screen.getByText(/Confirm your password/i)).toBeInTheDocument();
      expect(
        screen.getByText(/You must agree to the Terms of Service & Privacy Policy/i)
      ).toBeInTheDocument();

      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('validates invalid email, short password, and password mismatch', async () => {
      renderWithProviders(<></>, '/signup');

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ketan Vaghela' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'not-an-email' },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: '123' } });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), { target: { value: '456' } });
      fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      expect(await screen.findByText(/Please enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/Password must be at least 12 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();

      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('rejects a 12-character password missing complexity classes', async () => {
      renderWithProviders(<></>, '/signup');

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ketan Vaghela' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'investor@wealthnest.local' },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: 'alllowercasepassword' },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), {
        target: { value: 'alllowercasepassword' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      expect(
        await screen.findByText(
          /Password must include uppercase, lowercase, a number, and a special character/i
        )
      ).toBeInTheDocument();
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });
  });

  describe('SignUpPage Submission & Supabase Integration', () => {
    it('handles successful registration with immediate authenticated session', async () => {
      (supabase.auth.signUp as any).mockResolvedValueOnce({
        data: {
          user: { id: 'usr-new-001', email: 'investor@wealthnest.local' },
          session: { access_token: 'fake-token' },
        },
        error: null,
      });

      renderWithProviders(<></>, '/signup');

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ketan Vaghela' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'investor@wealthnest.local' },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: 'WealthNest@2026' },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), {
        target: { value: 'WealthNest@2026' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'investor@wealthnest.local',
          password: 'WealthNest@2026',
          options: {
            data: {
              full_name: 'Ketan Vaghela',
              display_name: 'Ketan Vaghela',
            },
          },
        });
      });

      // Redirects to home page on immediate session
      expect(await screen.findByTestId('home-page')).toBeInTheDocument();
    });

    it('handles registration requiring email confirmation', async () => {
      (supabase.auth.signUp as any).mockResolvedValueOnce({
        data: {
          user: { id: 'usr-new-002', email: 'parul@wealthnest.local', confirmed_at: null },
          session: null, // No session yet, awaiting verification
        },
        error: null,
      });

      renderWithProviders(<></>, '/signup');

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Parul Vaghela' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'parul@wealthnest.local' },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: 'WealthNest@2026' },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), {
        target: { value: 'WealthNest@2026' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      expect(await screen.findByRole('heading', { name: /Check your email/i })).toBeInTheDocument();
      expect(screen.getByText(/parul@wealthnest\.local/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Proceed to Sign In/i })).toHaveAttribute(
        'href',
        '/login'
      );
    });

    it('displays server error banner when registration fails', async () => {
      (supabase.auth.signUp as any).mockResolvedValueOnce({
        data: null,
        error: new Error('User already registered with this email'),
      });

      renderWithProviders(<></>, '/signup');

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ketan Vaghela' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'existing@wealthnest.local' },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: 'WealthNest@2026' },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), {
        target: { value: 'WealthNest@2026' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/User already registered with this email/i)).toBeInTheDocument();
    });
  });

  describe('LoginPage Rendering, Validation & Submission', () => {
    it('renders login page with email, password, and links', async () => {
      renderWithProviders(<></>, '/login');

      expect(
        screen.getByRole('heading', { name: /Welcome back to WealthNest/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Sign in to your account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Create an account/i })).toHaveAttribute(
        'href',
        '/signup'
      );
      expect(screen.getByRole('button', { name: /Forgot Password\?/i })).toBeInTheDocument();
    });

    it('shows validation errors for empty fields on login', async () => {
      renderWithProviders(<></>, '/login');

      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      expect(await screen.findByText(/Email address is required/i)).toBeInTheDocument();
      expect(screen.getByText(/^Password is required$/i)).toBeInTheDocument();
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('signs in successfully and navigates to home page', async () => {
      (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
        data: { session: { user: { id: 'usr-1' } } },
        error: null,
      });

      renderWithProviders(<></>, '/login');

      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'investor@wealthnest.local' },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), {
        target: { value: 'WealthNest@2026' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'investor@wealthnest.local',
          password: 'WealthNest@2026',
        });
      });

      expect(await screen.findByTestId('home-page')).toBeInTheDocument();
    });

    it('shows error banner on failed login', async () => {
      (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
        data: null,
        error: new Error('Invalid login credentials'),
      });

      renderWithProviders(<></>, '/login');

      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'wrong@wealthnest.local' },
      });
      fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'WrongPass' } });

      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Invalid login credentials/i)).toBeInTheDocument();
    });

    it('opens forgot password modal and submits recovery request', async () => {
      (supabase.auth.resetPasswordForEmail as any).mockResolvedValueOnce({
        data: {},
        error: null,
      });

      renderWithProviders(<></>, '/login');

      fireEvent.click(screen.getByRole('button', { name: /Forgot Password\?/i }));

      expect(screen.getByRole('heading', { name: /Password Recovery/i })).toBeInTheDocument();

      const modalEmailInput = screen.getByLabelText(/Recovery Email Address/i);
      fireEvent.change(modalEmailInput, { target: { value: 'recovery@wealthnest.local' } });

      fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }));

      await waitFor(() => {
        expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'recovery@wealthnest.local',
          expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
        );
      });

      expect(await screen.findByText(/Password reset link sent!/i)).toBeInTheDocument();
    });
  });

  describe('Authenticated User Redirection', () => {
    it('redirects already-authenticated users away from /signup to /', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({
        data: {
          session: {
            user: { id: 'usr-auth', email: 'investor@wealthnest.local' },
          },
        },
      });

      renderWithProviders(<></>, '/signup');

      // The authenticated user should be automatically redirected to the home page
      expect(await screen.findByTestId('home-page')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /Create your WealthNest account/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Password Recovery & ResetPasswordPage Flow (AUTH-05)', () => {
    it('shows expired/missing recovery link guidance when opened without a recovery session', async () => {
      renderWithProviders(<></>, '/reset-password');

      expect(
        await screen.findByRole('heading', { name: /Recovery Link Missing or Expired/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Back to Sign In/i })).toHaveAttribute(
        'href',
        '/login'
      );
    });

    it('redirects PASSWORD_RECOVERY sessions to /reset-password, enforces complexity, and updates password', async () => {
      let authCallback: ((event: string, session: any) => void) | null = null;
      (supabase.auth.onAuthStateChange as any).mockImplementationOnce((cb: any) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });
      (supabase.auth.updateUser as any).mockResolvedValueOnce({
        data: { user: { id: 'usr-rec', email: 'recover@wealthnest.local' } },
        error: null,
      });

      renderWithProviders(<></>, '/login');

      await waitFor(() => {
        expect(authCallback).not.toBeNull();
      });

      authCallback!('PASSWORD_RECOVERY', {
        user: { id: 'usr-rec', email: 'recover@wealthnest.local' },
      });

      expect(
        await screen.findByRole('heading', { name: /Set a New Password/i })
      ).toBeInTheDocument();

      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmInput = screen.getByLabelText('Confirm New Password');
      const submitBtn = screen.getByRole('button', { name: /Set New Password/i });

      // Rejects weak passwords locally before calling updateUser
      fireEvent.change(newPasswordInput, { target: { value: 'weak' } });
      fireEvent.change(confirmInput, { target: { value: 'different' } });
      fireEvent.click(submitBtn);

      expect(await screen.findByText(/Password must be at least 12 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();

      // Accepts compliant matching password and persists via supabase.auth.updateUser
      fireEvent.change(newPasswordInput, { target: { value: 'WealthNest@2026!' } });
      fireEvent.change(confirmInput, { target: { value: 'WealthNest@2026!' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(supabase.auth.updateUser).toHaveBeenCalledWith({
          password: 'WealthNest@2026!',
        });
      });

      expect(await screen.findByRole('heading', { name: /Password Updated/i })).toBeInTheDocument();
    });
  });

  describe('Session Termination & Query Cache Purging (AUTH-04)', () => {
    it('purges React Query cache and clears user state on signOut()', async () => {
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: {
          session: {
            user: { id: 'usr-cached', email: 'cached@wealthnest.local' },
          },
        },
      });
      (supabase.auth.signOut as any).mockResolvedValueOnce({ error: null });

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity },
        },
      });
      queryClient.setQueryData(['portfolio', 'usr-cached'], { netWorth: 123456 });

      function SignOutTrigger() {
        const { user, signOut } = useAuth();
        return (
          <div>
            <span data-testid="session-user">{user?.id ?? 'signed-out'}</span>
            <button type="button" onClick={() => void signOut()}>
              Sign Out Now
            </button>
          </div>
        );
      }

      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SignOutTrigger />
          </AuthProvider>
        </QueryClientProvider>
      );

      expect(await screen.findByTestId('session-user')).toHaveTextContent('usr-cached');
      expect(queryClient.getQueryData(['portfolio', 'usr-cached'])).toEqual({ netWorth: 123456 });

      fireEvent.click(screen.getByRole('button', { name: /Sign Out Now/i }));

      await waitFor(() => {
        expect(screen.getByTestId('session-user')).toHaveTextContent('signed-out');
      });
      expect(queryClient.getQueryData(['portfolio', 'usr-cached'])).toBeUndefined();
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pre-Auth Mobile Backend Configuration Recovery', () => {
    it('omits 127.0.0.1 advice on mobile network errors and lets users switch to Cloud Supabase before login', async () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      });

      (supabase.auth.signInWithPassword as any).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      try {
        renderWithProviders(<></>, '/login');

        fireEvent.change(screen.getByLabelText(/Email Address/i), {
          target: { value: 'mobile@wealthnest.local' },
        });
        fireEvent.change(screen.getByLabelText(/^Password$/i), {
          target: { value: 'WealthNest@2026' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/Cannot reach backend at http:\/\/192\.168\.1\.105:54321/i);
        expect(alert).not.toHaveTextContent(/127\.0\.0\.1/i);

        fireEvent.click(screen.getByRole('button', { name: /Configure Backend/i }));
        expect(
          await screen.findByRole('dialog', { name: /Configure Backend Server/i })
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Remote \/ Production/i }));
        fireEvent.change(screen.getByLabelText(/Supabase Project URL/i), {
          target: { value: 'https://qa-cloud.supabase.co' },
        });
        fireEvent.change(screen.getByLabelText(/Supabase Publishable \/ Anon Key/i), {
          target: { value: 'sb_publishable_mobile_qa_key' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Save & Connect/i }));

        await waitFor(() => {
          expect(connectionManager.getSupabaseUrl()).toBe('https://qa-cloud.supabase.co');
        });
        expect(
          screen.getByText(/Switched to https:\/\/qa-cloud\.supabase\.co/i)
        ).toBeInTheDocument();
        expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(2);
      } finally {
        Object.defineProperty(navigator, 'userAgent', {
          configurable: true,
          value: originalUserAgent,
        });
      }
    });

    it('formats unreachable backend messages cleanly across mobile and desktop modes', () => {
      const mobileMsg = formatBackendUnreachableMessage({
        activeUrl: 'http://192.168.1.105:54321',
        activeMode: 'lan',
        hasConfiguredRemote: true,
        isMobile: true,
        isHttps: false,
      });
      expect(mobileMsg).toContain('Switch to Cloud Supabase');
      expect(mobileMsg).not.toContain('127.0.0.1');

      const desktopMsg = formatBackendUnreachableMessage({
        activeUrl: 'http://192.168.1.105:54321',
        activeMode: 'lan',
        hasConfiguredRemote: false,
        isMobile: false,
        isHttps: false,
      });
      expect(desktopMsg).toContain('127.0.0.1');
    });
  });
});
