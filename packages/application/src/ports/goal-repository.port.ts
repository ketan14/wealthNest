import { Result } from '@wealthnest/shared';
import { GoalCategory, GoalPriority } from '@wealthnest/domain';

export interface GoalHoldingLinkDto {
  readonly holdingId: string;
  readonly holdingName: string;
  readonly ticker?: string;
  readonly allocationPercentage: number;
  readonly currentValueCents: number;
}

export interface GoalDetailDto {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly category: GoalCategory;
  readonly targetAmountCents: number;
  readonly targetDate: string; // ISO format YYYY-MM-DD
  readonly initialSavedCents: number;
  readonly monthlyContributionCents: number;
  readonly expectedReturnRate: number; // e.g. 12.0
  readonly inflationRate: number; // e.g. 6.0
  readonly priority: GoalPriority;
  readonly currency: string;
  readonly notes?: string;
  readonly memberId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly linkedHoldings: readonly GoalHoldingLinkDto[];
}

export interface CreateGoalParams {
  readonly userId: string;
  readonly name: string;
  readonly category: GoalCategory;
  readonly targetAmountCents: number;
  readonly targetDate: string;
  readonly initialSavedCents?: number;
  readonly monthlyContributionCents?: number;
  readonly expectedReturnRate?: number;
  readonly inflationRate?: number;
  readonly priority?: GoalPriority;
  readonly currency?: string;
  readonly notes?: string;
  readonly memberId?: string;
}

export interface UpdateGoalParams {
  readonly goalId: string;
  readonly userId: string;
  readonly name?: string;
  readonly category?: GoalCategory;
  readonly targetAmountCents?: number;
  readonly targetDate?: string;
  readonly initialSavedCents?: number;
  readonly monthlyContributionCents?: number;
  readonly expectedReturnRate?: number;
  readonly inflationRate?: number;
  readonly priority?: GoalPriority;
  readonly notes?: string;
  readonly memberId?: string;
}

export interface LinkHoldingToGoalParams {
  readonly goalId: string;
  readonly holdingId: string;
  readonly userId: string;
  readonly allocationPercentage: number;
}

export interface GoalRepositoryPort {
  listGoalsByUser(userId: string): Promise<Result<GoalDetailDto[]>>;
  createGoal(params: CreateGoalParams): Promise<Result<GoalDetailDto>>;
  updateGoal(params: UpdateGoalParams): Promise<Result<GoalDetailDto>>;
  deleteGoal(goalId: string, userId: string): Promise<Result<void>>;
  linkHoldingToGoal(params: LinkHoldingToGoalParams): Promise<Result<void>>;
  unlinkHoldingFromGoal(goalId: string, holdingId: string, userId: string): Promise<Result<void>>;
}
