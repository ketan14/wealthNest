import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import { calculatePortfolioSummary, HoldingValuationItem } from '../portfolio/portfolio-summary.js';

describe('Portfolio Domain Calculation Engine (India First)', () => {
  it('returns zeroes for an empty portfolio', () => {
    const summary = calculatePortfolioSummary([], 'INR');
    expect(summary.totalValue.cents).toBe(0n);
    expect(summary.totalCostBasis.cents).toBe(0n);
    expect(summary.unrealizedGainLoss.cents).toBe(0n);
    expect(summary.returnPercentage).toBe(0);
    expect(summary.isProfitable).toBe(false);
    expect(summary.allocations).toHaveLength(0);
  });

  it('calculates total valuation and positive unrealized return in INR', () => {
    const items: HoldingValuationItem[] = [
      {
        holdingId: 'h-1',
        assetClassId: 'equity',
        assetClassName: 'Equities',
        colorHex: '#3b82f6',
        quantity: 10,
        costBasis: Money.fromDecimal(100000, 'INR'), // ₹1,00,000 (1 Lakh)
        currentValue: Money.fromDecimal(150000, 'INR'), // ₹1,50,000 (1.5 Lakh)
      },
      {
        holdingId: 'h-2',
        assetClassId: 'cash',
        assetClassName: 'Cash & Liquid',
        colorHex: '#10b981',
        quantity: 1,
        costBasis: Money.fromDecimal(50000, 'INR'), // ₹50,000
        currentValue: Money.fromDecimal(50000, 'INR'),
      },
    ];

    const summary = calculatePortfolioSummary(items, 'INR');

    // Total = 1,50,000 + 50,000 = 2,00,000 (2 Lakhs)
    expect(summary.totalValue.toDecimal()).toBe(200000);
    // Cost = 1,00,000 + 50,000 = 1,50,000
    expect(summary.totalCostBasis.toDecimal()).toBe(150000);
    // Gain = 50,000
    expect(summary.unrealizedGainLoss.toDecimal()).toBe(50000);
    expect(summary.isProfitable).toBe(true);
    // Return % = 50,000 / 1,50,000 = 33.33%
    expect(summary.returnPercentage).toBe(33.33);

    // Allocations: Equity = 150000 / 200000 = 75%, Cash = 50000 / 200000 = 25%
    expect(summary.allocations).toHaveLength(2);
    expect(summary.allocations[0]!.name).toBe('Equities');
    expect(summary.allocations[0]!.percentage).toBe(75);
    expect(summary.allocations[1]!.name).toBe('Cash & Liquid');
    expect(summary.allocations[1]!.percentage).toBe(25);
  });

  it('calculates unrealized losses accurately in INR', () => {
    const items: HoldingValuationItem[] = [
      {
        holdingId: 'h-3',
        assetClassId: 'crypto',
        assetClassName: 'Crypto',
        colorHex: '#ec4899',
        quantity: 1,
        costBasis: Money.fromDecimal(100000, 'INR'),
        currentValue: Money.fromDecimal(80000, 'INR'),
      },
    ];

    const summary = calculatePortfolioSummary(items, 'INR');
    expect(summary.totalValue.toDecimal()).toBe(80000);
    expect(summary.totalCostBasis.toDecimal()).toBe(100000);
    expect(summary.unrealizedGainLoss.toDecimal()).toBe(20000);
    expect(summary.isProfitable).toBe(false);
    expect(summary.returnPercentage).toBe(-20);
  });
});
