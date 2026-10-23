import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  calculateInflationAdjustedTarget,
  calculateMonthsRemaining,
  evaluateGoal,
  calculateGoalsSummary,
} from '../goals/goal-calculator.js';
import { GoalDefinition } from '../goals/goal-types.js';

describe('Domain: Financial Goals Module', () => {
  describe('calculateInflationAdjustedTarget', () => {
    it('calculates compound inflation correctly over 10 years', () => {
      // ₹50,00,000 target with 6% inflation over 120 months (10 years)
      // 50,00,000 * (1.06)^10 = ~89,54,238.48
      const target = Money.fromDecimal(5000000, 'INR');
      const adjusted = calculateInflationAdjustedTarget(target, 6.0, 120);

      expect(adjusted.toDecimal()).toBeCloseTo(8954238, -2); // within ~100 rupees
    });

    it('returns exact target if inflation is 0 or months is 0', () => {
      const target = Money.fromDecimal(1000000, 'INR');
      expect(calculateInflationAdjustedTarget(target, 0, 60).cents).toBe(target.cents);
      expect(calculateInflationAdjustedTarget(target, 6, 0).cents).toBe(target.cents);
    });
  });

  describe('evaluateGoal', () => {
    const fixedNow = new Date('2026-01-01T00:00:00Z');

    it('identifies fully funded goal as achieved', () => {
      const targetDate = new Date('2027-01-01T00:00:00Z');
      const goal: GoalDefinition = {
        id: 'g-1',
        userId: 'u-1',
        name: 'Emergency Fund',
        category: 'emergency_fund',
        targetAmount: Money.fromDecimal(300000, 'INR'), // ₹3 Lakh
        targetDate,
        initialSaved: Money.fromDecimal(300000, 'INR'), // ₹3 Lakh
        monthlyContribution: Money.zero('INR'),
        expectedReturnRate: 6.0,
        inflationRate: 0,
        priority: 'critical',
        currency: 'INR',
        linkedHoldings: [],
      };

      const result = evaluateGoal(goal, fixedNow);
      expect(result.isFunded).toBe(true);
      expect(result.status).toBe('achieved');
      expect(result.fundedPercentage).toBe(100);
      expect(result.requiredMonthlySip.toDecimal()).toBe(0);
    });

    it('calculates required monthly SIP for a future goal with inflation', () => {
      // ₹12,00,000 target in 3 years (36 months), expected return 12% p.a., inflation 0%
      const targetDate = new Date('2029-01-01T00:00:00Z');
      const goal: GoalDefinition = {
        id: 'g-2',
        userId: 'u-1',
        name: 'Down Payment',
        category: 'home_purchase',
        targetAmount: Money.fromDecimal(1200000, 'INR'),
        targetDate,
        initialSaved: Money.fromDecimal(200000, 'INR'), // Already saved 2L
        monthlyContribution: Money.fromDecimal(20000, 'INR'), // Committing 20k/month
        expectedReturnRate: 12.0,
        inflationRate: 0,
        priority: 'high',
        currency: 'INR',
        linkedHoldings: [],
      };

      const result = evaluateGoal(goal, fixedNow);
      expect(result.monthsRemaining).toBe(36);
      expect(result.requiredMonthlySip.toDecimal()).toBeGreaterThan(15000);
      expect(result.requiredMonthlySip.toDecimal()).toBeLessThan(25000);
      expect(result.projectedCorpusAtTarget.cents).toBeGreaterThan(0n);
    });

    it('aggregates linked holdings into current corpus', () => {
      const targetDate = new Date('2030-01-01T00:00:00Z');
      const goal: GoalDefinition = {
        id: 'g-3',
        userId: 'u-1',
        name: 'Retirement Corpus',
        category: 'retirement',
        targetAmount: Money.fromDecimal(10000000, 'INR'), // ₹1 Crore
        targetDate,
        initialSaved: Money.fromDecimal(500000, 'INR'),
        monthlyContribution: Money.fromDecimal(35000, 'INR'),
        expectedReturnRate: 12.0,
        inflationRate: 6.0,
        priority: 'critical',
        currency: 'INR',
        linkedHoldings: [
          {
            holdingId: 'h-1',
            holdingName: 'Parag Parikh Flexi Cap',
            allocationPercentage: 100,
            allocatedValue: Money.fromDecimal(1500000, 'INR'), // ₹15 Lakh
          },
        ],
      };

      const result = evaluateGoal(goal, fixedNow);
      // Total current = 500k + 1500k = 20,00,000
      expect(result.currentTotalCorpus.toDecimal()).toBe(2000000);
      expect(result.fundedPercentage).toBe(20);
    });
  });

  describe('calculateGoalsSummary', () => {
    it('computes goals summary and emergency fund runway', () => {
      const goals: GoalDefinition[] = [
        {
          id: 'g-1',
          userId: 'u-1',
          name: 'Emergency Fund',
          category: 'emergency_fund',
          targetAmount: Money.fromDecimal(300000, 'INR'),
          targetDate: new Date('2026-06-01T00:00:00Z'),
          initialSaved: Money.fromDecimal(300000, 'INR'),
          monthlyContribution: Money.zero('INR'),
          expectedReturnRate: 6.0,
          inflationRate: 0,
          priority: 'critical',
          currency: 'INR',
          linkedHoldings: [],
        },
      ];

      // ₹3,00,000 liquid corpus with ₹50,000 monthly expense = 6.0 months runway
      const liquid = Money.fromDecimal(300000, 'INR');
      const expenses = Money.fromDecimal(50000, 'INR');

      const summary = calculateGoalsSummary(goals, liquid, expenses, 'INR');
      expect(summary.emergencyFund.monthsRunway).toBe(6.0);
      expect(summary.emergencyFund.status).toBe('adequate');
      expect(summary.emergencyFund.recommendedTargetCorpus.toDecimal()).toBe(300000);
      expect(summary.goalsOnTrackCount).toBe(1);
      expect(summary.totalGoalsCount).toBe(1);
    });
  });
});
