import { Result, err } from '@wealthnest/shared';
import {
  TransactionRepositoryPort,
  TransactionDetailDto,
  CreateTransactionParams,
} from '../ports/transaction-repository.port.js';

const VALID_TRANSACTION_TYPES = ['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'fee'] as const;

export class RecordTransactionUseCase {
  constructor(private readonly transactionRepo: TransactionRepositoryPort) {}

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

    return this.transactionRepo.createTransaction(params);
  }
}
