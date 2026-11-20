import { Result, err } from '@wealthnest/shared';
import { validateOwnershipShares } from '@wealthnest/domain';
import {
  LiabilityRepositoryPort,
  UpdateLiabilityParams,
  LiabilityDto,
} from '../ports/liability-repository.port.js';

export class UpdateLiabilityUseCase {
  constructor(private readonly liabilityRepo: LiabilityRepositoryPort) {}

  async execute(params: UpdateLiabilityParams): Promise<Result<LiabilityDto>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    if (!params.id || params.id.trim().length === 0) {
      return err(new Error('Liability ID is required.'));
    }

    if (params.originalPrincipalCents !== undefined && params.originalPrincipalCents <= 0n) {
      return err(new Error('Original principal must be greater than zero.'));
    }

    if (params.currentBalanceCents !== undefined && params.currentBalanceCents < 0n) {
      return err(new Error('Outstanding balance cannot be negative.'));
    }

    if (params.interestRate !== undefined && params.interestRate < 0) {
      return err(new Error('Interest rate cannot be negative.'));
    }

    if (params.emiAmountCents !== undefined && params.emiAmountCents < 0n) {
      return err(new Error('EMI amount cannot be negative.'));
    }

    if (params.parties && params.parties.length > 0) {
      const shareCheck = validateOwnershipShares(
        params.parties.map((p) => ({
          familyMemberId: p.familyMemberId,
          sharePercentage: p.liabilityShare,
          isPrimary: p.partyRole === 'primary_borrower',
        }))
      );
      if (!shareCheck.valid) {
        return err(new Error(shareCheck.error || 'Invalid liability borrower share allocation.'));
      }
    }

    return this.liabilityRepo.updateLiability(params);
  }
}

export class DeleteLiabilityUseCase {
  constructor(private readonly liabilityRepo: LiabilityRepositoryPort) {}

  async execute(id: string, userId: string): Promise<Result<void>> {
    if (!id || id.trim().length === 0) {
      return err(new Error('Liability ID is required.'));
    }

    if (!userId || userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    return this.liabilityRepo.deleteLiability(id, userId);
  }
}
