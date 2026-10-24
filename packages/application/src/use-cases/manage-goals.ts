import { Result, ok, err } from '@wealthnest/shared';
import {
  CurrencyCode,
  Money,
  GoalCategory,
  GoalPriority,
  GoalDefinition,
  calculateGoalsSummary,
} from '@wealthnest/domain';
import {
  GoalRepositoryPort,
  GoalDetailDto,
  CreateGoalParams,
  UpdateGoalParams,
} from '../ports/goal-repository.port.js';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';

export interface GetGoalsSummaryParams {
  readonly userId: string;
  readonly monthlyExpensesCents?: number; // e.g. 5000000 for ₹50,000/mo
  readonly currency?: CurrencyCode;
  readonly memberId?: string;
}

export interface GoalEvaluationDto {
  readonly id: string;
  readonly name: string;
  readonly category: GoalCategory;
  readonly targetAmount: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly targetDate: string;
  readonly monthsRemaining: number;
  readonly currentTotalCorpus: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly futureTargetAmount: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly fundedPercentage: number;
  readonly monthlyContribution: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly requiredMonthlySip: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly monthlySipShortfall: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly projectedCorpusAtTarget: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly expectedReturnRate: number;
  readonly inflationRate: number;
  readonly priority: GoalPriority;
  readonly status: string;
  readonly isFunded: boolean;
  readonly notes?: string;
  readonly memberId?: string;
  readonly linkedHoldingsCount: number;
}

export interface GoalsSummaryDto {
  readonly totalTargetCorpus: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly totalCurrentCorpus: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly totalMonthlyCommittedSip: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly totalRequiredMonthlySip: {
    readonly cents: string;
    readonly decimal: number;
    readonly currency: string;
  };
  readonly overallFundedPercentage: number;
  readonly goalsOnTrackCount: number;
  readonly totalGoalsCount: number;
  readonly emergencyFund: {
    readonly liquidCorpusDecimal: number;
    readonly monthlyExpensesDecimal: number;
    readonly monthsRunway: number;
    readonly status: 'adequate' | 'warning' | 'critical';
    readonly recommendedTargetDecimal: number;
  };
  readonly goals: readonly GoalEvaluationDto[];
}

export class GetGoalsSummaryUseCase {
  constructor(
    private readonly goalRepo: GoalRepositoryPort,
    private readonly holdingRepo: HoldingRepositoryPort
  ) {}

  async execute(params: GetGoalsSummaryParams): Promise<Result<GoalsSummaryDto>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    const currency: CurrencyCode = params.currency || 'INR';

    // 1. Fetch user goals
    const goalsResult = await this.goalRepo.listGoalsByUser(params.userId);
    if (!goalsResult.success) {
      return err(goalsResult.error);
    }

    const filteredGoalRows =
      params.memberId && params.memberId !== 'all'
        ? goalsResult.value.filter((g) => g.memberId === params.memberId)
        : goalsResult.value;

    // 2. Fetch user holdings to identify liquid cash and linked holdings values
    const holdingsResult = await this.holdingRepo.listDetailsByUser(params.userId);
    const holdings = holdingsResult.success ? holdingsResult.value : [];

    // Calculate total liquid cash for emergency runway
    let liquidCashCents = 0n;
    for (const h of holdings) {
      if (h.assetClassId === 'cash') {
        liquidCashCents += BigInt(Math.round(h.currentValueCents));
      }
    }

    // 3. Map GoalDetailDto to domain GoalDefinition
    const domainGoals: GoalDefinition[] = filteredGoalRows.map((g) => {
      const gCurrency = (g.currency as CurrencyCode) || currency;
      const targetDate = new Date(g.targetDate);

      const linkedHoldings = g.linkedHoldings.map((link) => {
        const valCents = BigInt(Math.round(link.currentValueCents));
        return {
          holdingId: link.holdingId,
          holdingName: link.holdingName,
          allocationPercentage: link.allocationPercentage,
          allocatedValue: Money.fromCents(valCents, gCurrency),
        };
      });

      return {
        id: g.id,
        userId: g.userId,
        name: g.name,
        category: g.category,
        targetAmount: Money.fromCents(BigInt(g.targetAmountCents), gCurrency),
        targetDate: isNaN(targetDate.getTime()) ? new Date(Date.now() + 365 * 24 * 3600 * 1000) : targetDate,
        initialSaved: Money.fromCents(BigInt(g.initialSavedCents), gCurrency),
        monthlyContribution: Money.fromCents(BigInt(g.monthlyContributionCents), gCurrency),
        expectedReturnRate: g.expectedReturnRate,
        inflationRate: g.inflationRate,
        priority: g.priority,
        currency: gCurrency,
        notes: g.notes,
        memberId: g.memberId,
        linkedHoldings,
      };
    });

    // Default monthly expenses: ₹50,000 if not provided
    const monthlyExpensesCents = BigInt(params.monthlyExpensesCents || 5000000);
    const liquidMoney = Money.fromCents(liquidCashCents, currency);
    const expensesMoney = Money.fromCents(monthlyExpensesCents, currency);

    // 4. Pure domain summary calculation
    const summary = calculateGoalsSummary(domainGoals, liquidMoney, expensesMoney, currency);

    // 5. Build DTO
    const goalDtos: GoalEvaluationDto[] = summary.goals.map((evalResult) => ({
      id: evalResult.goal.id,
      name: evalResult.goal.name,
      category: evalResult.goal.category,
      targetAmount: {
        cents: evalResult.goal.targetAmount.cents.toString(),
        decimal: evalResult.goal.targetAmount.toDecimal(),
        currency: evalResult.goal.targetAmount.currency,
      },
      targetDate: evalResult.goal.targetDate.toISOString().split('T')[0]!,
      monthsRemaining: evalResult.monthsRemaining,
      currentTotalCorpus: {
        cents: evalResult.currentTotalCorpus.cents.toString(),
        decimal: evalResult.currentTotalCorpus.toDecimal(),
        currency: evalResult.currentTotalCorpus.currency,
      },
      futureTargetAmount: {
        cents: evalResult.futureTargetAmount.cents.toString(),
        decimal: evalResult.futureTargetAmount.toDecimal(),
        currency: evalResult.futureTargetAmount.currency,
      },
      fundedPercentage: evalResult.fundedPercentage,
      monthlyContribution: {
        cents: evalResult.goal.monthlyContribution.cents.toString(),
        decimal: evalResult.goal.monthlyContribution.toDecimal(),
        currency: evalResult.goal.monthlyContribution.currency,
      },
      requiredMonthlySip: {
        cents: evalResult.requiredMonthlySip.cents.toString(),
        decimal: evalResult.requiredMonthlySip.toDecimal(),
        currency: evalResult.requiredMonthlySip.currency,
      },
      monthlySipShortfall: {
        cents: evalResult.monthlySipShortfall.cents.toString(),
        decimal: evalResult.monthlySipShortfall.toDecimal(),
        currency: evalResult.monthlySipShortfall.currency,
      },
      projectedCorpusAtTarget: {
        cents: evalResult.projectedCorpusAtTarget.cents.toString(),
        decimal: evalResult.projectedCorpusAtTarget.toDecimal(),
        currency: evalResult.projectedCorpusAtTarget.currency,
      },
      expectedReturnRate: evalResult.goal.expectedReturnRate,
      inflationRate: evalResult.goal.inflationRate,
      priority: evalResult.goal.priority,
      status: evalResult.status,
      isFunded: evalResult.isFunded,
      notes: evalResult.goal.notes,
      memberId: evalResult.goal.memberId,
      linkedHoldingsCount: evalResult.goal.linkedHoldings.length,
    }));

    const dto: GoalsSummaryDto = {
      totalTargetCorpus: {
        cents: summary.totalTargetCorpus.cents.toString(),
        decimal: summary.totalTargetCorpus.toDecimal(),
        currency: summary.totalTargetCorpus.currency,
      },
      totalCurrentCorpus: {
        cents: summary.totalCurrentCorpus.cents.toString(),
        decimal: summary.totalCurrentCorpus.toDecimal(),
        currency: summary.totalCurrentCorpus.currency,
      },
      totalMonthlyCommittedSip: {
        cents: summary.totalMonthlyCommittedSip.cents.toString(),
        decimal: summary.totalMonthlyCommittedSip.toDecimal(),
        currency: summary.totalMonthlyCommittedSip.currency,
      },
      totalRequiredMonthlySip: {
        cents: summary.totalRequiredMonthlySip.cents.toString(),
        decimal: summary.totalRequiredMonthlySip.toDecimal(),
        currency: summary.totalRequiredMonthlySip.currency,
      },
      overallFundedPercentage: summary.overallFundedPercentage,
      goalsOnTrackCount: summary.goalsOnTrackCount,
      totalGoalsCount: summary.totalGoalsCount,
      emergencyFund: {
        liquidCorpusDecimal: summary.emergencyFund.liquidCorpus.toDecimal(),
        monthlyExpensesDecimal: summary.emergencyFund.monthlyExpenses.toDecimal(),
        monthsRunway: summary.emergencyFund.monthsRunway,
        status: summary.emergencyFund.status,
        recommendedTargetDecimal: summary.emergencyFund.recommendedTargetCorpus.toDecimal(),
      },
      goals: goalDtos,
    };

    return ok(dto);
  }
}

export class CreateGoalUseCase {
  constructor(private readonly goalRepo: GoalRepositoryPort) {}

  async execute(params: CreateGoalParams): Promise<Result<GoalDetailDto>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }
    if (!params.name || params.name.trim().length === 0) {
      return err(new Error('Goal name is required.'));
    }
    if (params.targetAmountCents <= 0) {
      return err(new Error('Target amount must be greater than zero.'));
    }
    if (!params.targetDate) {
      return err(new Error('Target date is required.'));
    }

    return this.goalRepo.createGoal(params);
  }
}

export class UpdateGoalUseCase {
  constructor(private readonly goalRepo: GoalRepositoryPort) {}

  async execute(params: UpdateGoalParams): Promise<Result<GoalDetailDto>> {
    if (!params.goalId || params.goalId.trim().length === 0) {
      return err(new Error('Goal ID is required.'));
    }
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    return this.goalRepo.updateGoal(params);
  }
}

export class DeleteGoalUseCase {
  constructor(private readonly goalRepo: GoalRepositoryPort) {}

  async execute(goalId: string, userId: string): Promise<Result<void>> {
    if (!goalId || goalId.trim().length === 0) {
      return err(new Error('Goal ID is required.'));
    }
    if (!userId || userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    return this.goalRepo.deleteGoal(goalId, userId);
  }
}
