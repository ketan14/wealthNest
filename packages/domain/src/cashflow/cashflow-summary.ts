import { CurrencyCode } from '../money/currency.js';
import { Money } from '../money/money.js';
import { TransactionType } from '../models/transaction.js';

export interface CashflowTransactionItem {
  readonly id: string;
  readonly type: TransactionType;
  readonly amount: Money;
  readonly date: string;
}

export interface CashflowSummary {
  readonly totalInflows: Money;
  readonly totalOutflows: Money;
  readonly netCashflow: Money;
  readonly isNetPositive: boolean;
  readonly inflowCount: number;
  readonly outflowCount: number;
  readonly totalCount: number;
  readonly breakdownByType: Record<TransactionType, Money>;
}

export const INFLOW_TYPES: readonly TransactionType[] = ['deposit', 'dividend', 'sell'];
export const OUTFLOW_TYPES: readonly TransactionType[] = ['withdrawal', 'buy', 'fee'];

export function isInflow(type: TransactionType): boolean {
  return INFLOW_TYPES.includes(type);
}

export function isOutflow(type: TransactionType): boolean {
  return OUTFLOW_TYPES.includes(type);
}

/**
 * Pure Domain calculation for cash inflows, outflows, and net cashflow balance.
 * Eliminates floating-point rounding errors by utilizing integer paise (Money value object).
 */
export function calculateCashflowSummary(
  items: readonly CashflowTransactionItem[],
  currency: CurrencyCode = 'INR'
): CashflowSummary {
  const breakdown: Record<TransactionType, Money> = {
    buy: Money.zero(currency),
    sell: Money.zero(currency),
    deposit: Money.zero(currency),
    withdrawal: Money.zero(currency),
    dividend: Money.zero(currency),
    fee: Money.zero(currency),
  };

  if (items.length === 0) {
    return {
      totalInflows: Money.zero(currency),
      totalOutflows: Money.zero(currency),
      netCashflow: Money.zero(currency),
      isNetPositive: true,
      inflowCount: 0,
      outflowCount: 0,
      totalCount: 0,
      breakdownByType: breakdown,
    };
  }

  let totalInflows = Money.zero(currency);
  let totalOutflows = Money.zero(currency);
  let inflowCount = 0;
  let outflowCount = 0;

  for (const item of items) {
    const itemAmount = item.amount;
    breakdown[item.type] = breakdown[item.type].add(itemAmount);

    if (isInflow(item.type)) {
      totalInflows = totalInflows.add(itemAmount);
      inflowCount++;
    } else if (isOutflow(item.type)) {
      totalOutflows = totalOutflows.add(itemAmount);
      outflowCount++;
    }
  }

  const diffPaise = totalInflows.cents - totalOutflows.cents;
  const isNetPositive = diffPaise >= 0n;
  const absDiff = diffPaise < 0n ? -diffPaise : diffPaise;
  const netCashflow = Money.fromCents(absDiff, currency);

  return {
    totalInflows,
    totalOutflows,
    netCashflow,
    isNetPositive,
    inflowCount,
    outflowCount,
    totalCount: items.length,
    breakdownByType: breakdown,
  };
}
