import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoalsPage } from '../pages/GoalsPage';
import { AuthProvider } from '../lib/supabase/auth-context';

function renderGoalsPage(initialEntries: string[] = ['/goals']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <GoalsPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('GoalsPage Component', () => {
  it('renders goals summary KPIs, emergency runway, and active milestones', async () => {
    renderGoalsPage();

    // Header & Badges
    expect(screen.getByText('Financial Goals & Milestones')).toBeInTheDocument();
    expect(screen.getByText('India First (₹ INR)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Goal/i })).toBeInTheDocument();

    // Top 4 KPI cards & Required Pace
    expect(screen.getByText('Emergency Runway')).toBeInTheDocument();
    expect(screen.getByText('Target Corpus Sum')).toBeInTheDocument();
    expect(screen.getByText('Accumulated Corpus')).toBeInTheDocument();
    expect(screen.getByText('Committed Monthly SIP')).toBeInTheDocument();
    expect(screen.getByText(/Required Pace:/i)).toBeInTheDocument();

    // Emergency reserve burn rate analyzer
    expect(screen.getByText(/Emergency Reserve Buffer & Burn Rate Analyzer/i)).toBeInTheDocument();

    // Active milestones section
    expect(screen.getByText('Active Financial Milestones')).toBeInTheDocument();
    expect(screen.getByText('Emergency Reserve Fund (6 Months)')).toBeInTheDocument();
    expect(screen.getAllByText(/Ketan & Parul Retirement/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Krisha Higher Education/i).length).toBeGreaterThanOrEqual(1);
  });

  it('supports filtering by status, sorting, and resetting empty filters', async () => {
    renderGoalsPage();

    const completedPill = screen.getByRole('button', { name: /Completed \(/i });
    fireEvent.click(completedPill);

    // Emergency Reserve Fund in demo data is achieved/completed
    expect(screen.getByText('Emergency Reserve Fund (6 Months)')).toBeInTheDocument();

    // Filter to Needs Boost and sort by Monthly Gap
    fireEvent.click(screen.getByRole('button', { name: /Needs Boost \(/i }));
    const sortSelect = screen.getByLabelText('Sort goals by');
    fireEvent.change(sortSelect, { target: { value: 'monthly_gap' } });

    // Switch back to All and check category filter
    fireEvent.click(screen.getByRole('button', { name: /^All \(/i }));
    const catSelect = screen.getByLabelText('Filter goals by category');
    fireEvent.change(catSelect, { target: { value: 'education' } });
    expect(screen.getAllByText(/Krisha Higher Education/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Emergency Reserve Fund (6 Months)')).not.toBeInTheDocument();
  });

  it('supports quick contribution Top Up and Edit Goal modal', async () => {
    renderGoalsPage();

    // Trigger Top Up on the first card
    const topUpButtons = screen.getAllByRole('button', { name: /Top Up/i });
    fireEvent.click(topUpButtons[0]!);

    expect(screen.getByRole('heading', { name: 'Add Contribution' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /\+₹25,000/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Contribution' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Add Contribution' })).not.toBeInTheDocument();
    });

    // Trigger Edit Goal on Emergency Reserve Fund
    fireEvent.click(
      screen.getByRole('button', { name: /Edit goal Emergency Reserve Fund \(6 Months\)/i })
    );
    expect(screen.getByRole('heading', { name: 'Edit Financial Goal' })).toBeInTheDocument();
    const submitEditBtn = screen.getByRole('button', { name: 'Update Goal' });
    fireEvent.click(submitEditBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Financial Goal' })).not.toBeInTheDocument();
    });
  });

  it('auto-opens Create Financial Goal modal when visiting /goals?action=new', async () => {
    renderGoalsPage(['/goals?action=new']);

    expect(await screen.findByRole('heading', { name: 'Create Financial Goal' })).toBeInTheDocument();
  });

  it('opens Create Financial Goal modal when clicking header Create Goal button', async () => {
    renderGoalsPage();

    fireEvent.click(screen.getByRole('button', { name: /^Create Goal$/i }));
    expect(await screen.findByRole('heading', { name: 'Create Financial Goal' })).toBeInTheDocument();
  });
});
