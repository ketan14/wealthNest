import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  projectAmortizedBalanceAsOf,
  simulateLoanPrepayment,
} from '../models/loan-amortization.js';
import { calculateHistoricalNetWorth } from '../liabilities/net-worth-calculator.js';

describe('Compound Point-in-Time Loan Amortization & Prepayment Engine', () => {
  it('compounds monthly interest and amortizes EMI + irregular prepayments between checkpoints', () => {
    const result = projectAmortizedBalanceAsOf({
      checkpointBalance: Money.fromDecimal(5000000, 'INR'), // ₹50,00,000
      checkpointDate: '2026-01-01',
      targetDate: '2026-07-01', // 6 months
      annualInterestRate: 9.0, // 0.75% / month
      monthlyEmi: Money.fromDecimal(45000, 'INR'),
      prepayments: [
        { asOfDate: '2026-03-15', amount: Money.fromDecimal(200000, 'INR') }, // ₹2,00,000 prepay
      ],
    });

    expect(result.monthsCompounded).toBe(6);
    expect(result.totalPrepaid.cents).toBe(20000000n);
    expect(result.totalInterestAccrued.cents).toBeGreaterThan(0n);
    // Balance should be strictly lower than ₹48,00,000 due to EMI principal + ₹2L prepayment
    expect(result.outstandingBalance.cents).toBeLessThan(480000000n);
  });

  it('simulates baseline vs accelerated payoff with extra monthly and lump-sum prepayments', () => {
    const sim = simulateLoanPrepayment({
      outstandingBalance: Money.fromDecimal(4000000, 'INR'), // ₹40L
      annualInterestRate: 8.75,
      monthlyEmi: Money.fromDecimal(42000, 'INR'),
      extraMonthlyPrepayment: Money.fromDecimal(10000, 'INR'),
      lumpSumPrepayment: Money.fromDecimal(200000, 'INR'),
    });

    expect(sim.acceleratedMonthsToPayoff).toBeLessThan(sim.baselineMonthsToPayoff);
    expect(sim.monthsSaved).toBe(sim.baselineMonthsToPayoff - sim.acceleratedMonthsToPayoff);
    expect(sim.interestSaved.cents).toBeGreaterThan(0n);
    expect(sim.yearlySchedule.length).toBeGreaterThan(1);
    expect(sim.yearlySchedule[0]?.baselineBalance.cents).toBe(400000000n);
  });

  it('uses compound amortization in calculateHistoricalNetWorth when interestRate is provided', () => {
    const summary = calculateHistoricalNetWorth({
      asOfDate: '2026-07-01',
      assets: [
        {
          assetId: 'prop-1',
          name: '3BHK Flat',
          assetClassId: 'real_estate',
          valuations: [{ asOfDate: '2026-01-01', value: Money.fromDecimal(10000000, 'INR') }],
        },
      ],
      liabilities: [
        {
          liabilityId: 'loan-1',
          name: 'Home Loan',
          loanType: 'home_loan',
          lender: 'SBI',
          status: 'active',
          emiAmount: Money.fromDecimal(45000, 'INR'),
          originalPrincipal: Money.fromDecimal(5000000, 'INR'),
          interestRate: 9.0,
          prepayments: [{ asOfDate: '2026-04-10', amount: Money.fromDecimal(300000, 'INR') }],
          balances: [{ asOfDate: '2026-01-01', balance: Money.fromDecimal(5000000, 'INR') }],
        },
      ],
      currency: 'INR',
    });

    // Without compounding/prepayment, balance would still be ₹50L; with it, it's < ₹47L
    expect(summary.totalLiabilities.cents).toBeLessThan(470000000n);
    expect(summary.netWorth.cents).toBeGreaterThan(530000000n);
  });
});
