import { Result, err } from '@wealthnest/shared';
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

    return this.holdingRepo.createHoldingWithAsset(params);
  }
}
