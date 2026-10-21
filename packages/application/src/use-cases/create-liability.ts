import { Result, ok, err } from '@wealthnest/shared';
import {
  LiabilityRepositoryPort,
  CreateLiabilityParams,
  LiabilityDto,
} from '../ports/liability-repository.port.js';

export class CreateLiabilityUseCase {
  constructor(private readonly liabilityRepo: LiabilityRepositoryPort) {}

  async execute(params: CreateLiabilityParams): Promise<Result<LiabilityDto>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required to create a liability.'));
    }

    if (!params.name || params.name.trim().length === 0) {
      return err(new Error('Loan name is required.'));
    }

    if (!params.lender || params.lender.trim().length === 0) {
      return err(new Error('Lender name is required.'));
    }

    if (params.originalPrincipalCents <= 0n) {
      return err(new Error('Original principal must be greater than zero.'));
    }

    if (params.interestRate < 0) {
      return err(new Error('Interest rate cannot be negative.'));
    }

    const created = await this.liabilityRepo.createLiability(params);
    if (!created.success) {
      return err(created.error);
    }

    // If an initial balance was provided, record initial balance record
    const initialBalance = params.initialBalanceCents ?? params.originalPrincipalCents;
    const asOfDate = params.startDate || new Date().toISOString().split('T')[0]!;

    await this.liabilityRepo.recordLiabilityBalance({
      liabilityId: created.value.id,
      userId: params.userId,
      balanceCents: initialBalance,
      asOfDate,
      source: 'initial_loan_origination',
      notes: 'Initial principal recorded upon creation',
    });

    // If linked asset is specified, also record the asset-liability link
    if (params.linkedAssetId) {
      await this.liabilityRepo.linkAssetLiability({
        userId: params.userId,
        assetId: params.linkedAssetId,
        liabilityId: created.value.id,
        linkType: params.loanType === 'home_loan' ? 'mortgage' : 'collateral',
      });
    }

    return ok(created.value);
  }
}
