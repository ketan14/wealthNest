import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoanPrepaymentSimulatorCard } from '../components/liabilities/LoanPrepaymentSimulatorCard';
import { LiabilityDto } from '@wealthnest/application';

describe('LoanPrepaymentSimulatorCard', () => {
  const sampleLoans: LiabilityDto[] = [
    {
      id: 'loan-home-1',
      userId: 'user-1',
      name: 'SBI Home Loan',
      loanType: 'home_loan',
      lender: 'SBI',
      originalPrincipalCents: 600000000n, // ₹60L
      currentBalanceCents: 450000000n, // ₹45L
      interestRate: 8.75,
      interestType: 'floating',
      emiAmountCents: 4800000n, // ₹48,000
      currency: 'INR',
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  ];

  it('renders prepayment simulation metrics and updates when extra monthly preset is clicked', () => {
    render(<LoanPrepaymentSimulatorCard liabilities={sampleLoans} />);

    expect(screen.getByText('Prepayment & Compound Amortization Simulator')).toBeInTheDocument();
    expect(screen.getByText('Interest Saved')).toBeInTheDocument();
    expect(screen.getByText('Tenure Reduced')).toBeInTheDocument();

    const initialMonthsText = screen.getByText(/\d+ mos/).textContent;
    fireEvent.click(screen.getByRole('button', { name: '₹25k' }));
    const updatedMonthsText = screen.getByText(/\d+ mos/).textContent;

    expect(updatedMonthsText).not.toBe(initialMonthsText);
  });
});

