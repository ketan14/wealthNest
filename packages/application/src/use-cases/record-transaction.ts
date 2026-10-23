import { Result, err } from '@wealthnest/shared';
import { syncHoldingWithTransaction } from '@wealthnest/domain';
import {
  TransactionRepositoryPort,
  TransactionDetailDto,
  CreateTransactionParams,
} from '../ports/transaction-repository.port.js';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';

const VALID_TRANSACTION_TYPES = [
  'buy',
  'sell',
  'deposit',
  'withdrawal',
  'dividend',
  'fee',
] as const;

export class RecordTransactionUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepositoryPort,
    private readonly holdingRepo?: HoldingRepositoryPort
  ) {}

  async execute(params: CreateTransactionParams): Promise<Result<TransactionDetailDto>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required.'));
    }

    if (!VALID_TRANSACTION_TYPES.includes(params.type)) {
      return err(new Error(`Invalid transaction type: "${params.type}".`));
    }

    if (params.amountCents <= 0) {
      return err(new Error('Transaction amount must be greater than zero.'));
    }

    if (params.quantity !== undefined && params.quantity <= 0) {
      return err(new Error('Asset quantity must be greater than zero when specified.'));
    }

    let finalParams = params;

    // Automatic portfolio holding synchronization for buy/sell trades
    if (
      this.holdingRepo &&
      (params.type === 'buy' || params.type === 'sell') &&
      params.assetId
    ) {
      const holdingsRes = await this.holdingRepo.listDetailsByUser(params.userId);
      if (holdingsRes.success && holdingsRes.value) {
        const matchingHolding = holdingsRes.value.find((h) => h.assetId === params.assetId);
        if (matchingHolding) {
          const syncAdjustment = syncHoldingWithTransaction(
            {
              holdingId: matchingHolding.holdingId,
              quantity: matchingHolding.quantity,
              unitCostCents: matchingHolding.unitCostCents,
              currentValueCents: matchingHolding.currentValueCents,
            },
            {
              type: params.type,
              quantity: params.quantity,
              amountCents: params.amountCents,
            }
          );

          if (this.holdingRepo.updateHoldingValues) {
            await this.holdingRepo.updateHoldingValues({
              holdingId: matchingHolding.holdingId,
              userId: params.userId,
              quantity: syncAdjustment.updatedQuantity,
              unitCostCents: syncAdjustment.updatedUnitCostCents,
              currentValueCents: syncAdjustment.updatedCurrentValueCents,
            });
          }

          if (syncAdjustment.realizedGainLossCents !== undefined) {
            const pnlPaise = syncAdjustment.realizedGainLossCents;
            const pnlRupees = (Math.abs(pnlPaise) / 100).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            const tag = syncAdjustment.isRealizedGain
              ? `[Realized Gain: ₹${pnlRupees}]`
              : `[Realized Loss: ₹${pnlRupees}]`;

            finalParams = {
              ...finalParams,
              notes: finalParams.notes ? `${finalParams.notes} ${tag}` : tag,
            };
          }
        }
      }
    }

    return this.transactionRepo.createTransaction(finalParams);
  }
}

