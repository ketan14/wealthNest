import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { supabase } from '../lib/supabase/client';

vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

describe('WealthNest App Shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('redirects unauthenticated web users to /login', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as any);

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
  });

  it('renders application branding and header elements when authenticated', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: 'usr-test-001',
            email: 'investor@wealthnest.local',
            user_metadata: { display_name: 'Ketan Vaghela' },
          },
        },
      },
      error: null,
    } as any);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/System Overview/i)).toBeInTheDocument();
    });

    const brandElements = screen.getAllByText(/WealthNest/i);
    expect(brandElements.length).toBeGreaterThan(0);

    const portfolioLinks = screen.getAllByText(/Portfolio/i);
    expect(portfolioLinks.length).toBeGreaterThan(0);

    expect(screen.getByTestId('header-privacy-toggle')).toBeInTheDocument();
  });
});
