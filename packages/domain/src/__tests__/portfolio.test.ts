import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  calculatePortfolioSummary,
  HoldingValuationItem,
} from '../portfolio/portfolio-summary.js';

describe('Portfolio Domain Calculation Engine', () => {
  it('returns zeroes for an empty portfolio', () => {
    const summary = calculatePortfolioSummary([], 'USD');
    expect(summary.totalValue.cents).toBe(0n);
    expect(summary.totalCostBasis.cents).toBe(0n);
    expect(summary.unrealizedGainLoss.cents).toBe(0n);
    expect(summary.returnPercentage).toBe(0);
    expect(summary.isProfitable).toBe(false);
    expect(summary.allocations).toHaveLength(0);
  });

  it('calculates total valuation and positive unrealized return', () => {
    const items: HoldingValuationItem[] = [
      {
        holdingId: 'h-1',
        assetClassId: 'equity',
        assetClassName: 'Equities',
        colorHex: '#3b82f6',
        quantity: 10,
        costBasis: Money.fromDecimal(1000, 'USD'),
        currentValue: Money.fromDecimal(1500, 'USD'),
      },
      {
        holdingId: 'h-2',
        assetClassId: 'cash',
        assetClassName: 'Cash',
        colorHex: '#10b981',
        quantity: 1,
        costBasis: Money.fromDecimal(500, 'USD'),
        currentValue: Money.fromDecimal(500, 'USD'),
      },
    ];

    const summary = calculatePortfolioSummary(items, 'USD');

    // Total = 1500 + 500 = 2000
    expect(summary.totalValue.toDecimal()).toBe(2000);
    // Cost = 1000 + 500 = 1500
    expect(summary.totalCostBasis.toDecimal()).toBe(1500);
    // Gain = 500
    expect(summary.unrealizedGainLoss.toDecimal()).toBe(500);
    expect(summary.isProfitable).toBe(true);
    // Return % = 500 / 1500 = 33.33%
    expect(summary.returnPercentage).toBe(33.33);

    // Allocations: Equity = 1500 / 2000 = 75%, Cash = 500 / 2000 = 25%
    expect(summary.allocations).toHaveLength(2);
    expect(summary.allocations[0]!.name).toBe('Equities');
    expect(summary.allocations[0]!.percentage).toBe(75);
    expect(summary.allocations[1]!.name).toBe('Cash');
    expect(summary.allocations[1]!.percentage).toBe(25);
  });

  it('calculates unrealized losses accurately', () => {
    const items: HoldingValuationItem[] = [
      {
        holdingId: 'h-3',
        assetClassId: 'crypto',
        assetClassName: 'Crypto',
        colorHex: '#ec4899',
        quantity: 1,
        costBasis: Money.fromDecimal(1000, 'USD'),
        currentValue: Money.fromDecimal(800, 'USD'),
      },
    ];

    const summary = calculatePortfolioSummary(items, 'USD');
    expect(summary.totalValue.toDecimal()).toBe(800);
    expect(summary.totalCostBasis.toDecimal()).toBe(1000);
    expect(summary.unrealizedGainLoss.toDecimal()).toBe(200);
    expect(summary.isProfitable).toBe(false);
    expect(summary.returnPercentage).toBe(-20);
  });
});
