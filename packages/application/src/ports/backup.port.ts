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

export interface BackupPort {
  createFullBackup(userId: string): Promise<Result<PortfolioBackupData>>;
  restoreFromBackup(
    userId: string,
    backup: PortfolioBackupData
  ): Promise<
    Result<{
      readonly restoredHoldings: number;
      readonly restoredTransactions: number;
      readonly restoredLiabilities: number;
      readonly restoredGoals: number;
    }>
  >;
}
