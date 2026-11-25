import { Result } from '@wealthnest/shared';
import { UserPreferences } from '@wealthnest/domain';
import { HoldingDetailDto } from './holding-repository.port.js';
import { TransactionDetailDto } from './transaction-repository.port.js';
import { LiabilityDto } from './liability-repository.port.js';
import { GoalDetailDto } from './goal-repository.port.js';

export interface PortfolioBackupMetrics {
  readonly totalAssetsCents: number;
  readonly totalLiabilitiesCents: number;
  readonly netWorthCents: number;
  readonly totalHoldings: number;
  readonly totalTransactions: number;
  readonly totalLiabilities: number;
  readonly totalGoals: number;
}

export interface PortfolioBackupData {
  readonly version: '1.0.0';
  readonly schema: 'wealthnest-portfolio-v1';
  readonly exportedAt: string;
  readonly household?: {
    readonly id: string;
    readonly name?: string;
  };
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName?: string;
    readonly defaultCurrency: string;
    readonly preferences?: UserPreferences;
  };
  readonly holdings: readonly HoldingDetailDto[];
  readonly transactions: readonly TransactionDetailDto[];
  readonly liabilities: readonly LiabilityDto[];
  readonly goals: readonly GoalDetailDto[];
  readonly metrics: PortfolioBackupMetrics;
}

export interface BackupValidationResult {
  readonly isValid: boolean;
  readonly version: string;
  readonly exportedAt: string;
  readonly holdingsCount: number;
  readonly transactionsCount: number;
  readonly liabilitiesCount: number;
  readonly goalsCount: number;
  readonly errors: readonly string[];
}

export type ResettableFinancialCategory =
  | 'investment_portfolio'
  | 'real_estate'
  | 'loans_liabilities'
  | 'transactions'
  | 'financial_goals'
  | 'documents_vault'
  | 'cas_import_history';

export interface HouseholdDataResetPreview {
  readonly investment_portfolio: number;
  readonly real_estate: number;
  readonly loans_liabilities: number;
  readonly transactions: number;
  readonly financial_goals: number;
  readonly documents_vault: number;
  readonly cas_import_history: number;
  readonly linked_home_loans: number;
  readonly linked_goal_holdings: number;
}

export interface HouseholdDataResetResult {
  readonly auditLogId?: string;
  readonly deletedCounts: Record<ResettableFinancialCategory, number>;
}

export interface BackupPort {
  createFullBackup(scopeId: string): Promise<Result<PortfolioBackupData>>;
  restoreFromBackup(
    scopeId: string,
    backup: PortfolioBackupData,
    options?: { readonly targetUserId?: string; readonly householdId?: string }
  ): Promise<
    Result<{
      readonly restoredHoldings: number;
      readonly restoredTransactions: number;
      readonly restoredLiabilities: number;
      readonly restoredGoals: number;
    }>
  >;
  getDataResetPreview?(params: {
    readonly householdId?: string;
    readonly userId?: string;
  }): Promise<Result<HouseholdDataResetPreview>>;
  resetHouseholdFinancialData?(params: {
    readonly householdId?: string;
    readonly userId?: string;
    readonly categories: readonly ResettableFinancialCategory[];
  }): Promise<Result<HouseholdDataResetResult>>;
}
