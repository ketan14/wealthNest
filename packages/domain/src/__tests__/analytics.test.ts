import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import { calculateXirr, CashflowItem } from '../analytics/xirr.js';
import { calculateCagr } from '../analytics/cagr.js';
import {
  calculatePortfolioAnalytics,
  AnalyticsInputHolding,
  AnalyticsInputTransaction,
  TARGET_ALLOCATION_MODELS,
} from '../analytics/portfolio-analytics.js';

describe('Domain: Analytics Module', () => {
  describe('calculateXirr', () => {
    it('returns null for less than 2 cashflows', () => {
      expect(calculateXirr([])).toBeNull();
      expect(calculateXirr([{ date: new Date('2024-01-01'), amount: -100000 }])).toBeNull();
    });

    it('returns null if all cashflows have the same sign', () => {
      const allNegative: CashflowItem[] = [
        { date: new Date('2024-01-01'), amount: -50000 },
        { date: new Date('2024-06-01'), amount: -50000 },
      ];
      expect(calculateXirr(allNegative)).toBeNull();

      const allPositive: CashflowItem[] = [
        { date: new Date('2024-01-01'), amount: 50000 },
        { date: new Date('2024-06-01'), amount: 50000 },
      ];
      expect(calculateXirr(allPositive)).toBeNull();
    });

    it('calculates exact annual return for simple 1-year investment', () => {
      // Invest 100,000 on Jan 1 2024, Redeem 112,000 on Jan 1 2025 -> Exactly 12.00%
      const cashflows: CashflowItem[] = [
        { date: new Date('2024-01-01T00:00:00Z'), amount: -100000 },
        { date: new Date('2025-01-01T00:00:00Z'), amount: 112000 },
      ];
      const rate = calculateXirr(cashflows);
      expect(rate).not.toBeNull();
      expect(rate).toBeCloseTo(0.12, 2);
    });

    it('calculates XIRR for multiple SIP investments and terminal valuation', () => {
      // 3 periodic investments and terminal valuation
      const cashflows: CashflowItem[] = [
        { date: new Date('2024-01-01T00:00:00Z'), amount: -25000 },
        { date: new Date('2024-04-01T00:00:00Z'), amount: -25000 },
        { date: new Date('2024-07-01T00:00:00Z'), amount: -25000 },
        { date: new Date('2024-10-01T00:00:00Z'), amount: -25000 },
        { date: new Date('2025-01-01T00:00:00Z'), amount: 120000 }, // Total invested 100k, now 120k
      ];
      const rate = calculateXirr(cashflows);
      expect(rate).not.toBeNull();
      expect(rate!).toBeGreaterThan(0.2); // Annualized return is > 20% due to weighted timing
    });

    it('handles negative returns properly', () => {
      const cashflows: CashflowItem[] = [
        { date: new Date('2024-01-01T00:00:00Z'), amount: -100000 },
        { date: new Date('2025-01-01T00:00:00Z'), amount: 85000 }, // -15%
      ];
      const rate = calculateXirr(cashflows);
      expect(rate).not.toBeNull();
      expect(rate).toBeCloseTo(-0.15, 2);
    });
  });

  describe('calculateCagr', () => {
    it('calculates accurate compound growth over 2 years', () => {
      // ₹1,00,000 growing to ₹1,44,000 in 2 years = (1.44)^0.5 - 1 = 20%
      const start = Money.fromDecimal(100000, 'INR');
      const end = Money.fromDecimal(144000, 'INR');
      const cagr = calculateCagr({ beginningValue: start, endingValue: end, years: 2 });
      expect(cagr).toBeCloseTo(0.2, 4);
    });

    it('returns 0 for non-positive years or values', () => {
      const m1 = Money.fromDecimal(100000, 'INR');
      const m2 = Money.fromDecimal(120000, 'INR');
      expect(calculateCagr({ beginningValue: m1, endingValue: m2, years: 0 })).toBe(0);
      expect(calculateCagr({ beginningValue: m1, endingValue: m2, years: -1 })).toBe(0);
      expect(calculateCagr({ beginningValue: Money.zero('INR'), endingValue: m2, years: 2 })).toBe(0);
    });
  });

  describe('calculatePortfolioAnalytics', () => {
    const mockHoldings: AnalyticsInputHolding[] = [
      {
        holdingId: 'h-1',
        name: 'Reliance Industries',
        ticker: 'RELIANCE',
        assetClassId: 'equity',
        assetClassName: 'Equities & Mutual Funds',
        colorHex: '#3b82f6',
        costBasis: Money.fromDecimal(200000, 'INR'),
        currentValue: Money.fromDecimal(260000, 'INR'), // +60k (+30%)
      },
      {
        holdingId: 'h-2',
        name: 'SBI Bluechip Fund',
        ticker: 'SBIBLUE',
        assetClassId: 'equity',
        assetClassName: 'Equities & Mutual Funds',
        colorHex: '#3b82f6',
        costBasis: Money.fromDecimal(100000, 'INR'),
        currentValue: Money.fromDecimal(130000, 'INR'), // +30k (+30%)
      },
      {
        holdingId: 'h-3',
        name: 'Sovereign Gold Bond 2028',
        ticker: 'SGB2028',
        assetClassId: 'commodity',
        assetClassName: 'Gold & Precious Metals',
        colorHex: '#eab308',
        costBasis: Money.fromDecimal(50000, 'INR'),
        currentValue: Money.fromDecimal(65000, 'INR'), // +15k (+30%)
      },
      {
        holdingId: 'h-4',
        name: 'HDFC Corporate Bond Fund',
        ticker: 'HDFCBOND',
        assetClassId: 'fixed_income',
        assetClassName: 'Fixed Income & Debt',
        colorHex: '#8b5cf6',
        costBasis: Money.fromDecimal(150000, 'INR'),
        currentValue: Money.fromDecimal(165000, 'INR'), // +15k (+10%)
      },
    ];

    const mockTransactions: AnalyticsInputTransaction[] = [
      {
        date: '2024-01-15T00:00:00Z',
        type: 'deposit',
        amountCents: 50000000n, // ₹5,00,000
        currency: 'INR',
      },
      {
        date: '2024-07-20T00:00:00Z',
        type: 'dividend',
        amountCents: 500000n, // ₹5,000
        currency: 'INR',
      },
    ];

    it('aggregates portfolio total values and return percentage with paise precision', () => {
      const result = calculatePortfolioAnalytics(mockHoldings, mockTransactions, 'INR', 'balanced');

      // Total Cost: 200k + 100k + 50k + 150k = 500,000.00
      expect(result.totalCostBasis.toDecimal()).toBe(500000);
      // Total Value: 260k + 130k + 65k + 165k = 620,000.00
      expect(result.totalValue.toDecimal()).toBe(620000);
      // Absolute Gain: 120,000.00
      expect(result.absoluteGain.toDecimal()).toBe(120000);
      expect(result.returnPercentage).toBe(24);
    });

    it('computes XIRR and benchmark metrics', () => {
      const result = calculatePortfolioAnalytics(mockHoldings, mockTransactions, 'INR', 'balanced');

      expect(result.xirr).not.toBeNull();
      // ₹5,00,000 growing to ₹6,20,000 (+24% absolute) over ~2.75 years yields ~8.45% annualized XIRR
      expect(result.xirr!).toBeCloseTo(0.084, 2);
      expect(result.benchmarks.length).toBeGreaterThanOrEqual(4);
    });

    it('analyzes concentration risk and top asset weights', () => {
      const result = calculatePortfolioAnalytics(mockHoldings, mockTransactions, 'INR', 'balanced');

      // Total Value is 620,000. Reliance is 260,000 -> 260/620 = 41.93%
      expect(result.concentration.topAssetName).toBe('Reliance Industries');
      expect(result.concentration.topAssetWeight).toBeCloseTo(41.94, 1);
      expect(result.concentration.riskLevel).toBe('high'); // >30% triggers alert
      expect(result.concentration.warning).toContain('Reliance Industries');
    });

    it('computes asset allocation drift against balanced target model', () => {
      const result = calculatePortfolioAnalytics(mockHoldings, mockTransactions, 'INR', 'balanced');

      // Total Equity is 390,000 out of 620,000 = 62.9%
      // Balanced target is 55% -> Drift is ~ +7.9% -> action should be 'sell' to rebalance
      const equityDrift = result.drifts.find((d) => d.assetClassId === 'equity');
      expect(equityDrift).toBeDefined();
      expect(equityDrift?.currentPercentage).toBeCloseTo(62.9, 1);
      expect(equityDrift?.targetPercentage).toBe(55);
      expect(equityDrift?.rebalanceAction).toBe('sell');
      expect(equityDrift?.rebalanceAmount.cents).toBeGreaterThan(0n);
    });

    it('generates 12 monthly trajectory points for charting', () => {
      const result = calculatePortfolioAnalytics(mockHoldings, mockTransactions, 'INR', 'balanced');

      expect(result.trajectory.length).toBe(12);
      const lastPoint = result.trajectory[11]!;
      expect(lastPoint.portfolioValueCents).toBeGreaterThan(0n);
      expect(lastPoint.investedAmountCents).toBeGreaterThan(0n);
    });
  });
});
