import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoalDetailDto } from '@wealthnest/application';
import { GoalProjectionCard } from '../components/goals/GoalProjectionCard';

describe('GoalProjectionCard (Milestone Projection & Step-Up SIP)', () => {
  const sampleGoals: GoalDetailDto[] = [
    {
      id: 'goal-1',
      userId: 'user-1',
      name: 'Krisha Higher Education',
      category: 'education',
      targetAmountCents: 40_00_000_00,
      targetDate: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      initialSavedCents: 5_00_000_00,
      monthlyContributionCents: 25_000_00,
      expectedReturnRate: 12,
      inflationRate: 6,
      priority: 'high',
      currency: 'INR',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      linkedHoldings: [],
    },
  ];

  it('renders milestone projection curve and allows switching SIP step-up percentage', () => {
    render(<GoalProjectionCard goals={sampleGoals} />);

    expect(
      screen.getByText('Milestone Projection Curve & Step-Up SIP Simulator')
    ).toBeInTheDocument();
    expect(screen.getByText('Projected Step-Up Corpus')).toBeInTheDocument();
    expect(screen.getByText('Step-Up Wealth Boost')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+15%/yr' }));
    expect(screen.getByText(/Step-Up SIP \(\+15%\/yr\)/i)).toBeInTheDocument();
  });
});
