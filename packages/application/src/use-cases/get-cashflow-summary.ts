import { Result, ok, err } from '@wealthnest/shared';
import {
  CurrencyCode,
  Money,
  calculateCashflowSummary,
  CashflowSummary,
  CashflowTransactionItem,
} from '@wealthnest/domain';
import {
  TransactionRepositoryPort,
  TransactionDetailDto,
} from '../ports/transaction-repository.port.js';

export interface CashflowDataDto {
  readonly summary: CashflowSummary;
  readonly transactions: readonly TransactionDetailDto[];
}

export class GetCashflowSummaryUseCase {
  constructor(private readonly transactionRepo: TransactionRepositoryPort) {}

  async execute(userId: string, currency: CurrencyCode = 'INR'): Promise<Result<CashflowDataDto>> {
    const txResult = await this.transactionRepo.listByUser(userId);

    if (!txResult.success) {
      return err(txResult.error);
    }

    const transactions = txResult.value;

    const items: CashflowTransactionItem[] = transactions.map((t) => {
      const txCurrency = (t.currency as CurrencyCode) || currency;
      const amount = Money.fromCents(BigInt(t.amountCents), txCurrency);

      return {
        id: t.id,
        type: t.type,
        amount,
        date: t.transactionDate,
      };
    });

    const summary = calculateCashflowSummary(items, currency);

    return ok({
      summary,
      transactions,
    });
  }
}
