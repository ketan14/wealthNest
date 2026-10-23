import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoalsPage } from '../pages/GoalsPage';
import { AuthProvider } from '../lib/supabase/auth-context';

describe('GoalsPage Component (Phase 5)', () => {
  it('renders goals summary KPIs, emergency runway, and active milestones', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <GoalsPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Header & Badges
    expect(screen.getByText('Financial Goals & Milestones')).toBeInTheDocument();
    expect(screen.getByText('India First (₹ INR)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Financial Goal/i })).toBeInTheDocument();

    // Top 4 KPI cards
    expect(screen.getByText('Emergency Runway')).toBeInTheDocument();
    expect(screen.getByText('Target Corpus Sum')).toBeInTheDocument();
    expect(screen.getByText('Accumulated Corpus')).toBeInTheDocument();
    expect(screen.getByText('Committed Monthly SIP')).toBeInTheDocument();

    // Emergency reserve burn rate analyzer
    expect(screen.getByText(/Emergency Reserve Buffer & Burn Rate Analyzer/i)).toBeInTheDocument();

    // Active milestones section
    expect(screen.getByText('Active Financial Milestones')).toBeInTheDocument();
    expect(screen.getByText('Emergency Reserve Fund (6 Months)')).toBeInTheDocument();
    expect(screen.getByText('Retirement & Financial Independence (FIRE)')).toBeInTheDocument();
    expect(screen.getByText('Apartment Down Payment (3BHK)')).toBeInTheDocument();
  });
});
