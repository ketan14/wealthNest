import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/supabase/auth-context';
import { SignUpPage } from '../pages/SignUpPage';
import { LoginPage } from '../pages/LoginPage';
import { supabase } from '../lib/supabase/client';

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
            <Route path="/" element={<div data-testid="home-page">Home Dashboard</div>} />
          </Routes>
          {ui}
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Dedicated Authentication Pages (SignUpPage & LoginPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByText(/You must agree to the Terms of Service & Privacy Policy/i)).toBeInTheDocument();

      expect(supabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('validates invalid email, short password, and password mismatch', async () => {
      renderWithProviders(<></>, '/signup');

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ketan Vaghela' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'not-an-email' } });
      fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: '123' } });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), { target: { value: '456' } });
      fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      expect(await screen.findByText(/Please enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/Password must be at least 6 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();

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
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'investor@wealthnest.local' } });
      fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'WealthNest@2026' } });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), { target: { value: 'WealthNest@2026' } });
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
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'parul@wealthnest.local' } });
      fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'WealthNest@2026' } });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), { target: { value: 'WealthNest@2026' } });
      fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      expect(await screen.findByRole('heading', { name: /Check your email/i })).toBeInTheDocument();
      expect(screen.getByText(/parul@wealthnest\.local/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Proceed to Sign In/i })).toHaveAttribute('href', '/login');
    });

    it('displays server error banner when registration fails', async () => {
      (supabase.auth.signUp as any).mockResolvedValueOnce({
        data: null,
        error: new Error('User already registered with this email'),
      });

      renderWithProviders(<></>, '/signup');

      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ketan Vaghela' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'existing@wealthnest.local' } });
      fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'WealthNest@2026' } });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), { target: { value: 'WealthNest@2026' } });
      fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/User already registered with this email/i)).toBeInTheDocument();
    });
  });

  describe('LoginPage Rendering, Validation & Submission', () => {
    it('renders login page with email, password, and links', async () => {
      renderWithProviders(<></>, '/login');

      expect(screen.getByRole('heading', { name: /Welcome back to WealthNest/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Sign in to your account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Create an account/i })).toHaveAttribute('href', '/signup');
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

      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'investor@wealthnest.local' } });
      fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'WealthNest@2026' } });

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

      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'wrong@wealthnest.local' } });
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
          expect.objectContaining({ redirectTo: expect.stringContaining('/login') })
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
      expect(screen.queryByRole('heading', { name: /Create your WealthNest account/i })).not.toBeInTheDocument();
    });
  });
});
