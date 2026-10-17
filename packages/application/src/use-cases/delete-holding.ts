import { Result } from '@wealthnest/shared';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';

export class DeleteHoldingUseCase {
  constructor(private readonly holdingRepo: HoldingRepositoryPort) {}

  async execute(holdingId: string, userId: string): Promise<Result<void>> {
    return this.holdingRepo.deleteHolding(holdingId, userId);
  }
}
