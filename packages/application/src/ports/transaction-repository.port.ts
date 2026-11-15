import { Result } from '@wealthnest/shared';
import { RecordVisibility, TransactionType } from '@wealthnest/domain';

export interface TransactionDetailDto {
  readonly id: string;
  readonly householdId?: string;
  readonly userId: string;
  readonly visibility?: RecordVisibility;
  readonly createdBy?: string;
  readonly assetId?: string;
  readonly assetName?: string;
  readonly assetTicker?: string;
  readonly type: TransactionType;
  readonly quantity?: number;
  readonly amountCents: number; // Stored as integer paise
  readonly currency: string;
  readonly transactionDate: string;
  readonly notes?: string;
  readonly memberId?: string;
  readonly accountId?: string;
  readonly destinationAccountId?: string;
  readonly createdAt: string;
}

export interface CreateTransactionParams {
  readonly userId: string;
  readonly householdId?: string;
  readonly visibility?: RecordVisibility;
  readonly assetId?: string;
  readonly type: TransactionType;
  readonly quantity?: number;
  readonly amountCents: number;
  readonly currency: string;
  readonly memberId?: string;
  readonly accountId?: string;
  readonly destinationAccountId?: string;
  readonly transactionDate?: string;
  readonly notes?: string;
  readonly restrictedGranteeUserIds?: readonly string[];
}

export interface TransactionRepositoryPort {
  listByUser(scopeId: string): Promise<Result<TransactionDetailDto[]>>;
  listByHousehold?(householdId: string): Promise<Result<TransactionDetailDto[]>>;
  createTransaction(params: CreateTransactionParams): Promise<Result<TransactionDetailDto>>;
  deleteTransaction(transactionId: string, scopeId: string): Promise<Result<void>>;
}
