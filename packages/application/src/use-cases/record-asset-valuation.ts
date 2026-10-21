import { Result, err } from '@wealthnest/shared';
import {
  LiabilityRepositoryPort,
  RecordAssetValuationParams,
  AssetValuationDto,
} from '../ports/liability-repository.port.js';

export class RecordAssetValuationUseCase {
  constructor(private readonly liabilityRepo: LiabilityRepositoryPort) {}

  async execute(params: RecordAssetValuationParams): Promise<Result<AssetValuationDto>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    if (!params.assetId || params.assetId.trim().length === 0) {
      return err(new Error('Asset ID is required.'));
    }

    if (params.valuationCents < 0n) {
      return err(new Error('Valuation amount cannot be negative.'));
    }

    if (!params.asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.asOfDate)) {
      return err(new Error('Valid as-of date (YYYY-MM-DD) is required.'));
    }

    return this.liabilityRepo.recordAssetValuation(params);
  }
}
