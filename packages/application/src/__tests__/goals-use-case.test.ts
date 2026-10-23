import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import {
  GetGoalsSummaryUseCase,
  CreateGoalUseCase,
  DeleteGoalUseCase,
  GoalRepositoryPort,
  HoldingRepositoryPort,
  GoalDetailDto,
  HoldingDetailDto,
} from '../index.js';

describe('Application: Financial Goals Use Cases', () => {
  const mockGoals: GoalDetailDto[] = [
    {
      id: 'g-1',
      userId: 'user-123',
      name: 'Emergency Fund',
      category: 'emergency_fund',
      targetAmountCents: 30000000, // ₹3,00,000
      targetDate: '2026-12-31',
      initialSavedCents: 30000000, // ₹3,00,000 (100% funded)
      monthlyContributionCents: 0,
      expectedReturnRate: 6.0,
      inflationRate: 0,
      priority: 'critical',
      currency: 'INR',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      linkedHoldings: [],
    },
    {
      id: 'g-2',
      userId: 'user-123',
      name: 'Home Down Payment',
      category: 'home_purchase',
      targetAmountCents: 200000000, // ₹20,00,000
      targetDate: '2029-01-01',
      initialSavedCents: 40000000, // ₹4,00,000
      monthlyContributionCents: 3500000, // ₹35,000/mo
      expectedReturnRate: 11.0,
      inflationRate: 5.0,
      priority: 'high',
      currency: 'INR',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      linkedHoldings: [],
    },
  ];

  const mockHoldings: HoldingDetailDto[] = [
    {
      holdingId: 'h-1',
      assetId: 'a-1',
      name: 'ICICI Prudential Liquid Fund',
      assetClassId: 'cash',
      assetClassName: 'Cash & Liquid Savings',
      assetClassColor: '#10b981',
      quantity: 3000,
      unitCostCents: 10000,
      currentValueCents: 32000000, // ₹3,20,000 liquid cash
      currency: 'INR',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  describe('GetGoalsSummaryUseCase', () => {
    it('rejects empty user ID', async () => {
      const mockGoalRepo: GoalRepositoryPort = {
        listGoalsByUser: vi.fn(),
        createGoal: vi.fn(),
        updateGoal: vi.fn(),
        deleteGoal: vi.fn(),
        linkHoldingToGoal: vi.fn(),
        unlinkHoldingFromGoal: vi.fn(),
      };
      const mockHoldingRepo: HoldingRepositoryPort = {
        listDetailsByUser: vi.fn(),
        createHoldingWithAsset: vi.fn(),
        deleteHolding: vi.fn(),
      };

      const useCase = new GetGoalsSummaryUseCase(mockGoalRepo, mockHoldingRepo);
      const res = await useCase.execute({ userId: '' });
      expect(res.success).toBe(false);
    });

    it('aggregates goals and calculates emergency runway from liquid cash', async () => {
      const mockGoalRepo: GoalRepositoryPort = {
        listGoalsByUser: vi.fn().mockResolvedValue(ok(mockGoals)),
        createGoal: vi.fn(),
        updateGoal: vi.fn(),
        deleteGoal: vi.fn(),
        linkHoldingToGoal: vi.fn(),
        unlinkHoldingFromGoal: vi.fn(),
      };
      const mockHoldingRepo: HoldingRepositoryPort = {
        listDetailsByUser: vi.fn().mockResolvedValue(ok(mockHoldings)),
        createHoldingWithAsset: vi.fn(),
        deleteHolding: vi.fn(),
      };

      const useCase = new GetGoalsSummaryUseCase(mockGoalRepo, mockHoldingRepo);
      // Monthly expenses ₹50,000
      const res = await useCase.execute({ userId: 'user-123', monthlyExpensesCents: 5000000 });

      expect(res.success).toBe(true);
      if (!res.success) return;

      const summary = res.value;
      expect(summary.totalGoalsCount).toBe(2);
      expect(summary.goals.length).toBe(2);

      // Emergency fund runway: ₹3,20,000 liquid / ₹50,000 = 6.4 months runway
      expect(summary.emergencyFund.monthsRunway).toBeCloseTo(6.4, 1);
      expect(summary.emergencyFund.status).toBe('adequate');

      // First goal (Emergency Fund) is 100% funded -> achieved
      const g1 = summary.goals[0]!;
      expect(g1.name).toBe('Emergency Fund');
      expect(g1.isFunded).toBe(true);
      expect(g1.status).toBe('achieved');
    });
  });

  describe('CreateGoalUseCase', () => {
    it('validates target amount > 0 and creates goal', async () => {
      const mockGoalRepo: GoalRepositoryPort = {
        listGoalsByUser: vi.fn(),
        createGoal: vi.fn().mockResolvedValue(ok(mockGoals[0]!)),
        updateGoal: vi.fn(),
        deleteGoal: vi.fn(),
        linkHoldingToGoal: vi.fn(),
        unlinkHoldingFromGoal: vi.fn(),
      };

      const useCase = new CreateGoalUseCase(mockGoalRepo);
      const res = await useCase.execute({
        userId: 'user-123',
        name: 'New Car',
        category: 'vehicle',
        targetAmountCents: 100000000,
        targetDate: '2027-06-01',
      });

      expect(res.success).toBe(true);
      expect(mockGoalRepo.createGoal).toHaveBeenCalled();
    });

    it('rejects target amount <= 0', async () => {
      const mockGoalRepo: GoalRepositoryPort = {
        listGoalsByUser: vi.fn(),
        createGoal: vi.fn(),
        updateGoal: vi.fn(),
        deleteGoal: vi.fn(),
        linkHoldingToGoal: vi.fn(),
        unlinkHoldingFromGoal: vi.fn(),
      };

      const useCase = new CreateGoalUseCase(mockGoalRepo);
      const res = await useCase.execute({
        userId: 'user-123',
        name: 'Invalid Goal',
        category: 'wealth_creation',
        targetAmountCents: 0,
        targetDate: '2028-01-01',
      });

      expect(res.success).toBe(false);
    });
  });

  describe('DeleteGoalUseCase', () => {
    it('deletes goal via repository', async () => {
      const mockGoalRepo: GoalRepositoryPort = {
        listGoalsByUser: vi.fn(),
        createGoal: vi.fn(),
        updateGoal: vi.fn(),
        deleteGoal: vi.fn().mockResolvedValue(ok(undefined)),
        linkHoldingToGoal: vi.fn(),
        unlinkHoldingFromGoal: vi.fn(),
      };

      const useCase = new DeleteGoalUseCase(mockGoalRepo);
      const res = await useCase.execute('g-1', 'user-123');
      expect(res.success).toBe(true);
      expect(mockGoalRepo.deleteGoal).toHaveBeenCalledWith('g-1', 'user-123');
    });
  });
});
