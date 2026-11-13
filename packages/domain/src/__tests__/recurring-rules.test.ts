import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  RecurringTransactionRule,
  computeNextDueDate,
  evaluateRecurringRuleStatus,
  summarizeRecurringCommitments,
  advanceRecurringRuleAfterPost,
} from '../transactions/recurring-rules.js';

describe('Recurring Transaction Rules Engine', () => {
  const sampleRules: RecurringTransactionRule[] = [
    {
      id: 'rule-sip-1',
      name: 'Parag Parikh Flexi Cap SIP',
      category: 'sip',
      transactionType: 'buy',
      amount: Money.fromDecimal(25000, 'INR'),
      frequency: 'monthly',
      dayOfMonth: 5,
      nextDueDate: '2026-11-05',
      memberId: 'mem-self',
      accountId: 'acc-groww',
      isActive: true,
    },
    {
      id: 'rule-emi-1',
      name: 'SBI Home Loan EMI',
      category: 'emi',
      transactionType: 'withdrawal',
      amount: Money.fromDecimal(45000, 'INR'),
      frequency: 'monthly',
      dayOfMonth: 10,
      nextDueDate: '2026-11-10',
      memberId: 'mem-self',
      isActive: true,
    },
    {
      id: 'rule-sip-2',
      name: 'Quarterly Nifty 50 Index Top-up',
      category: 'sip',
      transactionType: 'buy',
      amount: Money.fromDecimal(30000, 'INR'),
      frequency: 'quarterly',
      dayOfMonth: 15,
      nextDueDate: '2026-12-15',
      memberId: 'mem-spouse',
      isActive: true,
    },
  ];

  it('computes next due dates accurately across monthly, quarterly, and yearly frequencies', () => {
    expect(computeNextDueDate('2026-11-05', 'monthly', 5)).toBe('2026-12-05');
    expect(computeNextDueDate('2026-11-15', 'quarterly', 15)).toBe('2027-02-15');
    expect(computeNextDueDate('2026-11-10', 'yearly', 10)).toBe('2027-11-10');
  });

  it('evaluates due and overdue status relative to referenceDate', () => {
    const refDate = new Date('2026-11-13T00:00:00Z');
    const overdueStatus = evaluateRecurringRuleStatus(sampleRules[0]!, refDate);
    expect(overdueStatus.isDue).toBe(true);
    expect(overdueStatus.isOverdue).toBe(true);
    expect(overdueStatus.daysUntilDue).toBe(-8);

    const upcomingStatus = evaluateRecurringRuleStatus(sampleRules[2]!, refDate);
    expect(upcomingStatus.isDue).toBe(false);
    expect(upcomingStatus.isOverdue).toBe(false);
    expect(upcomingStatus.daysUntilDue).toBe(32);
  });

  it('summarizes monthly SIP and EMI commitments with integer paise normalization', () => {
    const refDate = new Date('2026-11-13T00:00:00Z');
    const summary = summarizeRecurringCommitments(sampleRules, 'INR', refDate);

    // ₹25,000/mo + (₹30,000 / 3)/mo = ₹35,000/mo
    expect(summary.totalMonthlySip.cents).toBe(3500000n);
    // ₹45,000/mo
    expect(summary.totalMonthlyEmi.cents).toBe(4500000n);
    expect(summary.dueCount).toBe(2);
    expect(summary.overdueCount).toBe(2);
  });

  it('advances nextDueDate and sets lastPostedDate when posting a recurring rule', () => {
    const updated = advanceRecurringRuleAfterPost(sampleRules[0]!, '2026-11-13');
    expect(updated.lastPostedDate).toBe('2026-11-13');
    expect(updated.nextDueDate).toBe('2026-12-05');
  });
});

