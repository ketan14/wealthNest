import { Result, err, ok } from '@wealthnest/shared';
import {
  HoldingRepositoryPort,
  UpdateHoldingValuesParams,
} from '../ports/holding-repository.port.js';

export class UpdateHoldingValuesUseCase {
  constructor(private readonly holdingRepo: HoldingRepositoryPort) {}

  async execute(params: UpdateHoldingValuesParams): Promise<Result<void>> {
    if (!params.holdingId || params.holdingId.trim().length === 0) {
      return err(new Error('Holding ID is required.'));
    }

    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    if (params.quantity <= 0) {
      return err(new Error('Quantity must be greater than zero.'));
    }

    if (params.unitCostCents < 0 || params.currentValueCents < 0) {
      return err(new Error('Valuation amounts cannot be negative.'));
    }

    if (this.holdingRepo.updateHoldingValues) {
      return this.holdingRepo.updateHoldingValues(params);
    }

    return ok(undefined);
  }
}

