import { CurrencyCode } from '../money/currency.js';
import { Money } from '../money/money.js';

export type GoalCategory =
  | 'emergency_fund'
  | 'retirement'
  | 'home_purchase'
  | 'education'
  | 'wealth_creation'
  | 'vehicle'
  | 'vacation'
  | 'other';

export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';

export type GoalHealthStatus = 'on_track' | 'ahead' | 'behind' | 'achieved' | 'critical';

export interface GoalHoldingLink {
  readonly holdingId: string;
  readonly holdingName: string;
  readonly allocationPercentage: number;
  readonly allocatedValue: Money;
}

export interface GoalDefinition {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly category: GoalCategory;
  readonly targetAmount: Money;
  readonly targetDate: Date;
  readonly initialSaved: Money;
  readonly monthlyContribution: Money;
  readonly expectedReturnRate: number; // e.g. 12.0 for 12% p.a.
  readonly inflationRate: number; // e.g. 6.0 for 6% p.a.
  readonly priority: GoalPriority;
  readonly currency: CurrencyCode;
  readonly notes?: string;
  readonly linkedHoldings: readonly GoalHoldingLink[];
}

export interface GoalEvaluation {
  readonly goal: GoalDefinition;
  readonly monthsRemaining: number;
  readonly currentTotalCorpus: Money;
  readonly futureTargetAmount: Money; // Inflation-adjusted future target
  readonly fundedPercentage: number; // currentTotalCorpus / targetAmount * 100
  readonly requiredMonthlySip: Money;
  readonly monthlySipShortfall: Money; // requiredMonthlySip - monthlyContribution
  readonly projectedCorpusAtTarget: Money;
  readonly status: GoalHealthStatus;
  readonly isFunded: boolean;
}

export interface EmergencyFundRunway {
  readonly liquidCorpus: Money;
  readonly monthlyExpenses: Money;
  readonly monthsRunway: number;
  readonly status: 'adequate' | 'warning' | 'critical';
  readonly recommendedTargetCorpus: Money; // 6 months of expenses
}

export interface GoalsSummary {
  readonly totalTargetCorpus: Money;
  readonly totalCurrentCorpus: Money;
  readonly totalMonthlyCommittedSip: Money;
  readonly totalRequiredMonthlySip: Money;
  readonly overallFundedPercentage: number;
  readonly goalsOnTrackCount: number;
  readonly totalGoalsCount: number;
  readonly emergencyFund: EmergencyFundRunway;
  readonly goals: readonly GoalEvaluation[];
}
