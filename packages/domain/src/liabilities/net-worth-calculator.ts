import { CurrencyCode } from '../money/currency.js';
import { Money } from '../money/money.js';
import { LoanType, LiabilityStatus } from '../models/liability.js';
import { LoanPrepaymentEvent } from '../models/loan-amortization.js';

export interface ResolvedAssetValuation {
  readonly assetId: string;
  readonly assetName: string;
  readonly assetClassId: string;
  readonly valuation: Money;
  readonly asOfDate: string;
}

export interface ResolvedLiabilityBalance {
  readonly liabilityId: string;
  readonly name: string;
  readonly loanType: LoanType;
  readonly lender: string;
  readonly status: LiabilityStatus;
  readonly emiAmount: Money;
  readonly originalPrincipal: Money;
  readonly outstandingBalance: Money;
  readonly asOfDate: string;
  readonly linkedAssetId?: string;
}

export interface AssetHistoricalInput {
  readonly assetId: string;
  readonly name: string;
  readonly assetClassId: string;
  readonly valuations: readonly {
    readonly asOfDate: string; // YYYY-MM-DD
    readonly value: Money;
  }[];
  readonly fallbackCurrentValue?: Money;
}

export interface LiabilityHistoricalInput {
  readonly liabilityId: string;
  readonly name: string;
  readonly loanType: LoanType;
  readonly lender: string;
  readonly status: LiabilityStatus;
  readonly emiAmount: Money;
  readonly originalPrincipal: Money;
  readonly startDate?: string;
  readonly interestRate?: number;
  readonly prepayments?: readonly LoanPrepaymentEvent[];
  readonly balances: readonly {
    readonly asOfDate: string; // YYYY-MM-DD
    readonly balance: Money;
  }[];
  readonly linkedAssetId?: string;
}

export interface AssetLiabilityLinkInput {
  readonly assetId: string;
  readonly liabilityId: string;
  readonly linkType?: string;
  readonly ownershipSharePercentage?: number;
}

export interface PropertyEquityDetail {
  readonly assetId: string;
  readonly assetName: string;
  readonly propertyValue: Money;
  readonly totalDebt: Money;
  readonly equity: Money;
  readonly isNegativeEquity: boolean;
  readonly ltvRatioPercentage: number;
  readonly linkedLoans: readonly {
    readonly liabilityId: string;
    readonly name: string;
    readonly outstandingBalance: Money;
  }[];
}

export interface NetWorthSummary {
  readonly asOfDate: string;
  readonly totalAssets: Money;
  readonly totalLiabilities: Money;
  readonly netWorth: Money;
  readonly isSolvent: boolean;
  readonly debtToAssetsRatio: number; // e.g. 0.45 (45%)
  readonly totalMonthlyEmi: Money;
  readonly propertyEquities: readonly PropertyEquityDetail[];
  readonly missingAssetValuations: readonly string[];
  readonly missingLiabilityBalances: readonly string[];
}

/**
 * Calculates total gross assets from resolved asset valuations.
 * Converts cross-currency assets to the target currency.
 */
export function calculateTotalAssets(
  assets: readonly ResolvedAssetValuation[],
  targetCurrency: CurrencyCode = 'INR'
): Money {
  let total = Money.zero(targetCurrency);
  for (const asset of assets) {
    const valInTarget =
      asset.valuation.currency === targetCurrency
        ? asset.valuation
        : asset.valuation.convertTo(targetCurrency);
    total = total.add(valInTarget);
  }
  return total;
}

/**
 * Calculates total outstanding liabilities.
 * Guarantees that each unique liability is counted exactly ONCE,
 * even if it is linked to multiple properties/assets.
 */
export function calculateTotalLiabilities(
  liabilities: readonly ResolvedLiabilityBalance[],
  targetCurrency: CurrencyCode = 'INR'
): Money {
  const seenLiabilities = new Set<string>();
  let total = Money.zero(targetCurrency);

  for (const liability of liabilities) {
    if (seenLiabilities.has(liability.liabilityId)) {
      continue;
    }
    seenLiabilities.add(liability.liabilityId);

    if (liability.status === 'closed') {
      continue;
    }

    const balInTarget =
      liability.outstandingBalance.currency === targetCurrency
        ? liability.outstandingBalance
        : liability.outstandingBalance.convertTo(targetCurrency);
    total = total.add(balInTarget);
  }

  return total;
}

/**
 * Calculates Net Worth = Total Assets - Total Liabilities.
 * Handles positive net worth (solvent) and negative equity/insolvent states cleanly.
 */
export function calculateNetWorth(
  totalAssets: Money,
  totalLiabilities: Money
): { netWorth: Money; isSolvent: boolean; netDifferencePaise: bigint } {
  const targetCurrency = totalAssets.currency;
  const liabilitiesInTarget =
    totalLiabilities.currency === targetCurrency
      ? totalLiabilities
      : totalLiabilities.convertTo(targetCurrency);

  const diffPaise = totalAssets.cents - liabilitiesInTarget.cents;
  const isSolvent = diffPaise >= 0n;
  const absDiff = diffPaise < 0n ? -diffPaise : diffPaise;

  return {
    netWorth: Money.fromCents(absDiff, targetCurrency),
    isSolvent,
    netDifferencePaise: diffPaise,
  };
}

/**
 * Calculates Property Equity = Property Value - Associated outstanding loan balances.
 * Handles multiple loans linked to a single property (e.g. Home Loan + Top-up).
 * Flags negative equity when total debt exceeds property value.
 */
export function calculatePropertyEquity(
  propertyValue: Money,
  linkedDebts: readonly Money[]
): {
  equity: Money;
  isNegativeEquity: boolean;
  totalDebt: Money;
  equityDifferencePaise: bigint;
} {
  const currency = propertyValue.currency;
  let totalDebt = Money.zero(currency);

  for (const debt of linkedDebts) {
    const debtInTarget = debt.currency === currency ? debt : debt.convertTo(currency);
    totalDebt = totalDebt.add(debtInTarget);
  }

  const diffPaise = propertyValue.cents - totalDebt.cents;
  const isNegativeEquity = diffPaise < 0n;
  const absDiff = diffPaise < 0n ? -diffPaise : diffPaise;

  return {
    equity: Money.fromCents(absDiff, currency),
    isNegativeEquity,
    totalDebt,
    equityDifferencePaise: diffPaise,
  };
}

/**
 * Calculates Loan-To-Value (LTV) Ratio as a percentage.
 * LTV = (Total Outstanding Debt / Property Value) * 100.
 * Handles zero property value gracefully (returns 0 if debt is 0, or 100% if debt > 0).
 */
export function calculateLtvRatio(totalDebt: Money, propertyValue: Money): number {
  if (propertyValue.cents === 0n) {
    return totalDebt.cents > 0n ? 100 : 0;
  }

  const currency = propertyValue.currency;
  const debtInTarget = totalDebt.currency === currency ? totalDebt : totalDebt.convertTo(currency);

  const basisPoints = (debtInTarget.cents * 10000n) / propertyValue.cents;
  return Number(basisPoints) / 100;
}

/**
 * Calculates Debt-To-Assets Ratio = Total Liabilities / Total Assets.
 * Handles zero assets gracefully (returns 0 if liabilities are 0, or 1 if liabilities > 0).
 */
export function calculateDebtToAssetsRatio(totalLiabilities: Money, totalAssets: Money): number {
  if (totalAssets.cents === 0n) {
    return totalLiabilities.cents > 0n ? 1 : 0;
  }

  const currency = totalAssets.currency;
  const liabilitiesInTarget =
    totalLiabilities.currency === currency
      ? totalLiabilities
      : totalLiabilities.convertTo(currency);

  const basisPoints = (liabilitiesInTarget.cents * 10000n) / totalAssets.cents;
  return Number(basisPoints) / 10000;
}

/**
 * Calculates total active monthly EMI commitment.
 */
export function calculateTotalMonthlyEmi(
  liabilities: readonly { emiAmount: Money; status: LiabilityStatus }[],
  currency: CurrencyCode = 'INR'
): Money {
  let totalEmi = Money.zero(currency);
  for (const l of liabilities) {
    if (l.status === 'active') {
      const emiInTarget =
        l.emiAmount.currency === currency ? l.emiAmount : l.emiAmount.convertTo(currency);
      totalEmi = totalEmi.add(emiInTarget);
    }
  }
  return totalEmi;
}

export {
  type HistoricalNetWorthParams,
  calculateHistoricalNetWorth,
} from './historical-net-worth-calculator.js';

/**
 * Applies a loan payment and splits it according to accounting rules:
 * - Principal repayments reduce loan liability.
 * - Interest is an expense and must NOT reduce loan principal.
 */
export function applyLoanPayment(params: {
  currentBalance: Money;
  principalPaid: Money;
  interestPaid: Money;
  extraPrincipalPaid?: Money;
}): {
  newBalance: Money;
  totalPrincipalReduction: Money;
  interestExpense: Money;
} {
  const currency = params.currentBalance.currency;
  const principalPaid =
    params.principalPaid.currency === currency
      ? params.principalPaid
      : params.principalPaid.convertTo(currency);
  const extraPrincipalPaid = params.extraPrincipalPaid
    ? params.extraPrincipalPaid.currency === currency
      ? params.extraPrincipalPaid
      : params.extraPrincipalPaid.convertTo(currency)
    : Money.zero(currency);
  const interestExpense =
    params.interestPaid.currency === currency
      ? params.interestPaid
      : params.interestPaid.convertTo(currency);

  const totalPrincipalReduction = principalPaid.add(extraPrincipalPaid);
  const newBalanceCents =
    params.currentBalance.cents > totalPrincipalReduction.cents
      ? params.currentBalance.cents - totalPrincipalReduction.cents
      : 0n;

  return {
    newBalance: Money.fromCents(newBalanceCents, currency),
    totalPrincipalReduction,
    interestExpense,
  };
}
