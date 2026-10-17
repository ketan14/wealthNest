import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  calculateCashflowSummary,
  CashflowTransactionItem,
  isInflow,
  isOutflow,
} from '../cashflow/cashflow-summary.js';

describe('Cashflow Domain Calculation Engine', () => {
  it('correctly classifies inflow and outflow transaction types', () => {
    expect(isInflow('deposit')).toBe(true);
    expect(isInflow('dividend')).toBe(true);
    expect(isInflow('sell')).toBe(true);
    expect(isInflow('buy')).toBe(false);
    expect(isInflow('withdrawal')).toBe(false);
    expect(isInflow('fee')).toBe(false);

    expect(isOutflow('buy')).toBe(true);
    expect(isOutflow('withdrawal')).toBe(true);
    expect(isOutflow('fee')).toBe(true);
    expect(isOutflow('deposit')).toBe(false);
  });

  it('returns zero values for empty transactions list', () => {
    const summary = calculateCashflowSummary([], 'INR');
    expect(summary.totalInflows.cents).toBe(0n);
    expect(summary.totalOutflows.cents).toBe(0n);
    expect(summary.netCashflow.cents).toBe(0n);
    expect(summary.isNetPositive).toBe(true);
    expect(summary.totalCount).toBe(0);
    expect(summary.inflowCount).toBe(0);
    expect(summary.outflowCount).toBe(0);
  });

  it('aggregates inflows and outflows with positive net cashflow in INR', () => {
    const items: CashflowTransactionItem[] = [
      {
        id: 'tx-1',
        type: 'deposit',
        amount: Money.fromDecimal(100000, 'INR'), // +₹1,00,000 (1 Lakh)
        date: '2026-04-01T10:00:00Z',
      },
      {
        id: 'tx-2',
        type: 'dividend',
        amount: Money.fromDecimal(5400, 'INR'), // +₹5,400 (TCS Dividend)
        date: '2026-04-15T10:00:00Z',
      },
      {
        id: 'tx-3',
        type: 'buy',
        amount: Money.fromDecimal(45000, 'INR'), // -₹45,000 (Reliance purchase)
        date: '2026-04-20T10:00:00Z',
      },
      {
        id: 'tx-4',
        type: 'fee',
        amount: Money.fromDecimal(150, 'INR'), // -₹150 (STT & brokerage)
        date: '2026-04-20T10:01:00Z',
      },
    ];

    const summary = calculateCashflowSummary(items, 'INR');

    // Inflows: 1,00,000 + 5,400 = 1,05,400
    expect(summary.totalInflows.toDecimal()).toBe(105400);
    expect(summary.inflowCount).toBe(2);

    // Outflows: 45,000 + 150 = 45,150
    expect(summary.totalOutflows.toDecimal()).toBe(45150);
    expect(summary.outflowCount).toBe(2);

    // Net: 1,05,400 - 45,150 = 60,250
    expect(summary.netCashflow.toDecimal()).toBe(60250);
    expect(summary.isNetPositive).toBe(true);
    expect(summary.totalCount).toBe(4);

    // Breakdown check
    expect(summary.breakdownByType.deposit.toDecimal()).toBe(100000);
    expect(summary.breakdownByType.dividend.toDecimal()).toBe(5400);
    expect(summary.breakdownByType.buy.toDecimal()).toBe(45000);
    expect(summary.breakdownByType.fee.toDecimal()).toBe(150);
    expect(summary.breakdownByType.withdrawal.toDecimal()).toBe(0);
  });

  it('accurately calculates negative net cashflow when outflows exceed inflows', () => {
    const items: CashflowTransactionItem[] = [
      {
        id: 'tx-5',
        type: 'withdrawal',
        amount: Money.fromDecimal(80000, 'INR'), // -₹80,000
        date: '2026-05-01T10:00:00Z',
      },
      {
        id: 'tx-6',
        type: 'deposit',
        amount: Money.fromDecimal(30000, 'INR'), // +₹30,000
        date: '2026-05-05T10:00:00Z',
      },
    ];

    const summary = calculateCashflowSummary(items, 'INR');
    expect(summary.totalInflows.toDecimal()).toBe(30000);
    expect(summary.totalOutflows.toDecimal()).toBe(80000);
    // Net difference is 50,000 deficit
    expect(summary.netCashflow.toDecimal()).toBe(50000);
    expect(summary.isNetPositive).toBe(false);
  });
});
