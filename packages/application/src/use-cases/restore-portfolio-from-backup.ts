import { Result, ok, err } from '@wealthnest/shared';
import { BackupPort, PortfolioBackupData } from '../ports/backup.port.js';
import { ValidateAndParseBackupUseCase } from './validate-and-parse-backup.js';

export interface RestorePortfolioParams {
  readonly targetUserId: string;
  readonly backupData: PortfolioBackupData;
  readonly mode?: 'atomic_replace' | 'atomic_merge';
}

export interface RestorePortfolioSummary {
  readonly restoredHoldings: number;
  readonly restoredTransactions: number;
  readonly restoredLiabilities: number;
  readonly restoredGoals: number;
  readonly durationMs: number;
}

export class RestorePortfolioFromBackupUseCase {
  private readonly validator: ValidateAndParseBackupUseCase;

  constructor(private readonly backupPort: BackupPort) {
    this.validator = new ValidateAndParseBackupUseCase();
  }

  async execute(params: RestorePortfolioParams): Promise<Result<RestorePortfolioSummary>> {
    const startTime = Date.now();
    const { targetUserId, backupData } = params;

    if (!targetUserId || targetUserId.trim() === '') {
      return err(new Error('Target user ID is required for restore operation'));
    }

    if (!backupData) {
      return err(new Error('Backup data is empty or missing'));
    }

    // 1. Deep validate the payload before performing any storage actions
    const serialized = JSON.stringify(
      backupData,
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v)
    );
    const validationResult = this.validator.execute(serialized);
    if (!validationResult.success) {
      return err(new Error(`Backup payload validation failed: ${validationResult.error.message}`));
    }

    if (!validationResult.value.isValid) {
      return err(
        new Error(
          `Backup rejected with validation errors: ${validationResult.value.errors.join('; ')}`
        )
      );
    }

    // 2. Perform atomic restore via BackupPort with rollback guarantee
    try {
      const restoreResult = await this.backupPort.restoreFromBackup(targetUserId, backupData);
      if (!restoreResult.success) {
        return err(
          new Error(`Atomic restore failed and was rolled back: ${restoreResult.error.message}`)
        );
      }

      const durationMs = Date.now() - startTime;
      return ok({
        ...restoreResult.value,
        durationMs,
      });
    } catch (unexpectedError: any) {
      return err(
        new Error(
          `Unexpected exception during portfolio restore: ${unexpectedError?.message || 'Unknown error'}`
        )
      );
    }
  }
}
