import { Result, err } from '@wealthnest/shared';
import { validateOwnershipShares } from '@wealthnest/domain';
import {
  HoldingRepositoryPort,
  HoldingDetailDto,
  CreateHoldingParams,
} from '../ports/holding-repository.port.js';

export class AddHoldingUseCase {
  constructor(private readonly holdingRepo: HoldingRepositoryPort) {}

  async execute(params: CreateHoldingParams): Promise<Result<HoldingDetailDto>> {
    if (!params.name || params.name.trim().length === 0) {
      return err(new Error('Asset name is required.'));
    }

    if (params.quantity <= 0) {
      return err(new Error('Quantity must be greater than zero.'));
    }

    if (params.unitCostCents < 0 || params.currentValueCents < 0) {
      return err(new Error('Holding valuation amounts cannot be negative.'));
    }

    if (params.ownerShares && params.ownerShares.length > 0) {
      const shareCheck = validateOwnershipShares(
        params.ownerShares.map((o) => ({
          familyMemberId: o.familyMemberId,
          sharePercentage: o.ownershipShare,
          isPrimary: o.isPrimaryOwner,
        }))
      );
      if (!shareCheck.valid) {
        return err(new Error(shareCheck.error || 'Invalid holding ownership shares.'));
      }
    }

    return this.holdingRepo.createHoldingWithAsset(params);
  }
}
