import { Result } from '@wealthnest/shared';
import { TransactionType } from '@wealthnest/domain';

export interface TransactionDetailDto {
  readonly id: string;
  readonly userId: string;
  readonly assetId?: string;
  readonly assetName?: string;
  readonly assetTicker?: string;
  readonly type: TransactionType;
  readonly quantity?: number;
  readonly amountCents: number; // Stored as integer paise
  readonly currency: string;
  readonly transactionDate: string;
  readonly notes?: string;
  readonly createdAt: string;
}

export interface CreateTransactionParams {
  readonly userId: string;
  readonly assetId?: string;
  readonly type: TransactionType;
  readonly quantity?: number;
  readonly amountCents: number;
  readonly currency: string;
  readonly transactionDate?: string;
  readonly notes?: string;
}

export interface TransactionRepositoryPort {
  listByUser(userId: string): Promise<Result<TransactionDetailDto[]>>;
  createTransaction(params: CreateTransactionParams): Promise<Result<TransactionDetailDto>>;
  deleteTransaction(transactionId: string, userId: string): Promise<Result<void>>;
}
