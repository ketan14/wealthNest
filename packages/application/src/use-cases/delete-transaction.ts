import { Result } from '@wealthnest/shared';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port.js';

export class DeleteTransactionUseCase {
  constructor(private readonly transactionRepo: TransactionRepositoryPort) {}

  async execute(transactionId: string, userId: string): Promise<Result<void>> {
    return this.transactionRepo.deleteTransaction(transactionId, userId);
  }
}
