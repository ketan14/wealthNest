import { Result, err } from '@wealthnest/shared';
import {
  LiabilityRepositoryPort,
  RecordLiabilityBalanceParams,
  LiabilityBalanceDto,
} from '../ports/liability-repository.port.js';

export class RecordLiabilityBalanceUseCase {
  constructor(private readonly liabilityRepo: LiabilityRepositoryPort) {}

  async execute(params: RecordLiabilityBalanceParams): Promise<Result<LiabilityBalanceDto>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    if (!params.liabilityId || params.liabilityId.trim().length === 0) {
      return err(new Error('Liability ID is required.'));
    }

    if (params.balanceCents < 0n) {
      return err(new Error('Outstanding balance cannot be negative.'));
    }

    if (!params.asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.asOfDate)) {
      return err(new Error('Valid as-of date (YYYY-MM-DD) is required.'));
    }

    // Check if liability exists
    const existing = await this.liabilityRepo.getLiabilityById(params.liabilityId, params.userId);
    if (!existing.success) {
      return err(existing.error);
    }
    if (!existing.value) {
      return err(new Error(`Liability with ID ${params.liabilityId} was not found.`));
    }

    return this.liabilityRepo.recordLiabilityBalance(params);
  }
}
