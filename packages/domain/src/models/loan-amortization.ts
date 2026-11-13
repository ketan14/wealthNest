import { Money } from '../money/money.js';

export interface EmiBifurcationResult {
  readonly totalPayment: Money;
  readonly principalPart: Money;
  readonly interestPart: Money;
  readonly extraPayment: Money;
  readonly remainingBalance: Money;
}

/**
 * Calculates the exact split of an EMI into its interest and principal components.
 * Guarantees zero floating-point drift using integer paise.
 *
 * Formula:
 * Monthly Interest = Current Outstanding Balance * (Annual Rate / 12 / 100)
 * Principal Component = Total EMI - Monthly Interest
 */
export function bifurcateLoanPayment(
  outstandingBalance: Money,
  annualInterestRate: number,
  totalPayment: Money,
  extraPayment: Money = Money.zero(outstandingBalance.currency)
): EmiBifurcationResult {
  const currency = outstandingBalance.currency;

  if (outstandingBalance.cents <= 0n) {
    return {
      totalPayment,
      principalPart: Money.zero(currency),
      interestPart: Money.zero(currency),
      extraPayment: totalPayment,
      remainingBalance: Money.zero(currency),
    };
  }

  // Monthly interest in paise
  // interest = balance * annualRate / 1200
  const balanceCents = Number(outstandingBalance.cents);
  const monthlyRate = Math.max(0, annualInterestRate) / (12 * 100);
  const interestCents = BigInt(Math.round(balanceCents * monthlyRate));
  const interestPart = Money.fromCents(interestCents, currency);

  // If payment is less than interest (under-payment), interest absorbed is capped or accrued
  let principalCents = 0n;
  if (totalPayment.cents > interestCents) {
    principalCents = totalPayment.cents - interestCents;
  }

  // Extra payment directly reduces principal
  const totalPrincipalReduction = principalCents + extraPayment.cents;

  let remainingCents = 0n;
  if (outstandingBalance.cents > totalPrincipalReduction) {
    remainingCents = outstandingBalance.cents - totalPrincipalReduction;
  }

  return {
    totalPayment,
    principalPart: Money.fromCents(principalCents, currency),
    interestPart,
    extraPayment,
    remainingBalance: Money.fromCents(remainingCents, currency),
  };
}

export interface LoanPrepaymentEvent {
  readonly asOfDate: string; // YYYY-MM-DD
  readonly amount: Money;
}

export interface AmortizedBalanceAsOfParams {
  readonly checkpointBalance: Money;
  readonly checkpointDate: string; // YYYY-MM-DD
  readonly targetDate: string; // YYYY-MM-DD
  readonly annualInterestRate: number;
  readonly monthlyEmi: Money;
  readonly prepayments?: readonly LoanPrepaymentEvent[];
}

export interface AmortizedBalanceAsOfResult {
  readonly outstandingBalance: Money;
  readonly monthsCompounded: number;
  readonly totalInterestAccrued: Money;
  readonly totalPrincipalPaid: Money;
  readonly totalPrepaid: Money;
}

function parseIsoYearMonthDay(
  isoDate: string
): { year: number; month: number; day: number } | null {
  const parts = isoDate.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { year: parts[0]!, month: parts[1]!, day: parts[2]! };
}

function countElapsedWholeMonths(fromIso: string, toIso: string): number {
  const from = parseIsoYearMonthDay(fromIso);
  const to = parseIsoYearMonthDay(toIso);
  if (!from || !to) return 0;
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.day < from.day) {
    months -= 1;
  }
  return Math.max(0, months);
}

function addMonthsToIso(baseIso: string, monthsToAdd: number): string {
  const parsed = parseIsoYearMonthDay(baseIso);
  if (!parsed) return baseIso;
  const d = new Date(Date.UTC(parsed.year, parsed.month - 1 + monthsToAdd, parsed.day));
  return d.toISOString().slice(0, 10);
}

/**
 * Projects a loan's outstanding balance from a historical checkpoint forward to `targetDate`
 * by compounding monthly interest, amortizing regular EMIs, and applying irregular prepayments
 * in their exact calendar months.
 */
export function projectAmortizedBalanceAsOf(
  params: AmortizedBalanceAsOfParams
): AmortizedBalanceAsOfResult {
  const currency = params.checkpointBalance.currency;
  const zero = Money.zero(currency);

  if (params.targetDate <= params.checkpointDate || params.checkpointBalance.cents <= 0n) {
    return {
      outstandingBalance: params.checkpointBalance,
      monthsCompounded: 0,
      totalInterestAccrued: zero,
      totalPrincipalPaid: zero,
      totalPrepaid: zero,
    };
  }

  const months = countElapsedWholeMonths(params.checkpointDate, params.targetDate);
  const validPrepayments = (params.prepayments ?? []).filter(
    (p) =>
      p.asOfDate > params.checkpointDate && p.asOfDate <= params.targetDate && p.amount.cents > 0n
  );

  let balance = params.checkpointBalance;
  let totalInterestCents = 0n;
  let totalPrincipalCents = 0n;
  let totalPrepaidCents = 0n;
  let monthsCompounded = 0;

  for (let m = 1; m <= months; m++) {
    if (balance.cents <= 0n) break;
    const prevBoundary = addMonthsToIso(params.checkpointDate, m - 1);
    const currBoundary = addMonthsToIso(params.checkpointDate, m);

    let monthPrepayCents = 0n;
    for (const p of validPrepayments) {
      if (p.asOfDate > prevBoundary && p.asOfDate <= currBoundary) {
        const pInTarget = p.amount.currency === currency ? p.amount : p.amount.convertTo(currency);
        monthPrepayCents += pInTarget.cents;
      }
    }

    const step = bifurcateLoanPayment(
      balance,
      params.annualInterestRate,
      params.monthlyEmi,
      Money.fromCents(monthPrepayCents, currency)
    );

    balance = step.remainingBalance;
    totalInterestCents += step.interestPart.cents;
    totalPrincipalCents += step.principalPart.cents;
    totalPrepaidCents += step.extraPayment.cents;
    monthsCompounded += 1;
  }

  // Apply any prepayments that fell after the last whole month boundary up to targetDate
  if (balance.cents > 0n) {
    const lastBoundary = addMonthsToIso(params.checkpointDate, months);
    let tailPrepayCents = 0n;
    for (const p of validPrepayments) {
      if (p.asOfDate > lastBoundary && p.asOfDate <= params.targetDate) {
        const pInTarget = p.amount.currency === currency ? p.amount : p.amount.convertTo(currency);
        tailPrepayCents += pInTarget.cents;
      }
    }
    if (tailPrepayCents > 0n) {
      const applied = tailPrepayCents > balance.cents ? balance.cents : tailPrepayCents;
      balance = Money.fromCents(balance.cents - applied, currency);
      totalPrepaidCents += applied;
    }
  }

  return {
    outstandingBalance: balance,
    monthsCompounded,
    totalInterestAccrued: Money.fromCents(totalInterestCents, currency),
    totalPrincipalPaid: Money.fromCents(totalPrincipalCents, currency),
    totalPrepaid: Money.fromCents(totalPrepaidCents, currency),
  };
}

export interface PrepaymentSimulationParams {
  readonly outstandingBalance: Money;
  readonly annualInterestRate: number;
  readonly monthlyEmi: Money;
  readonly extraMonthlyPrepayment?: Money;
  readonly lumpSumPrepayment?: Money;
  readonly maxMonths?: number;
}

export interface PrepaymentYearPoint {
  readonly year: number;
  readonly baselineBalance: Money;
  readonly acceleratedBalance: Money;
}

export interface PrepaymentSimulationResult {
  readonly baselineMonthsToPayoff: number;
  readonly acceleratedMonthsToPayoff: number;
  readonly monthsSaved: number;
  readonly baselineTotalInterest: Money;
  readonly acceleratedTotalInterest: Money;
  readonly interestSaved: Money;
  readonly yearlySchedule: readonly PrepaymentYearPoint[];
}

function runPayoffPath(
  initialBalance: Money,
  annualRate: number,
  monthlyEmi: Money,
  extraMonthly: Money,
  lumpSumMonth1: Money,
  maxMonths: number
): { months: number; totalInterest: Money; yearEndBalances: Map<number, Money> } {
  const currency = initialBalance.currency;
  let balance = initialBalance;
  let totalInterestCents = 0n;
  let months = 0;
  const yearEndBalances = new Map<number, Money>();
  yearEndBalances.set(0, initialBalance);

  if (balance.cents <= 0n) {
    return { months: 0, totalInterest: Money.zero(currency), yearEndBalances };
  }

  for (let m = 1; m <= maxMonths; m++) {
    if (balance.cents <= 0n) break;
    const extraCents = extraMonthly.cents + (m === 1 ? lumpSumMonth1.cents : 0n);
    const step = bifurcateLoanPayment(
      balance,
      annualRate,
      monthlyEmi,
      Money.fromCents(extraCents, currency)
    );
    totalInterestCents += step.interestPart.cents;
    balance = step.remainingBalance;
    months = m;

    if (m % 12 === 0 || balance.cents === 0n) {
      const yr = Math.ceil(m / 12);
      yearEndBalances.set(yr, balance);
    }
    if (balance.cents === 0n) break;
  }

  return {
    months,
    totalInterest: Money.fromCents(totalInterestCents, currency),
    yearEndBalances,
  };
}

/**
 * Compares baseline EMI payoff vs accelerated payoff with extra monthly and/or lump-sum prepayments.
 */
export function simulateLoanPrepayment(
  params: PrepaymentSimulationParams
): PrepaymentSimulationResult {
  const currency = params.outstandingBalance.currency;
  const maxMonths = params.maxMonths ?? 360;
  const extraMonthly = params.extraMonthlyPrepayment ?? Money.zero(currency);
  const lumpSum = params.lumpSumPrepayment ?? Money.zero(currency);

  const baseline = runPayoffPath(
    params.outstandingBalance,
    params.annualInterestRate,
    params.monthlyEmi,
    Money.zero(currency),
    Money.zero(currency),
    maxMonths
  );

  const accelerated = runPayoffPath(
    params.outstandingBalance,
    params.annualInterestRate,
    params.monthlyEmi,
    extraMonthly,
    lumpSum,
    maxMonths
  );

  const monthsSaved = Math.max(0, baseline.months - accelerated.months);
  const interestSavedCents =
    baseline.totalInterest.cents > accelerated.totalInterest.cents
      ? baseline.totalInterest.cents - accelerated.totalInterest.cents
      : 0n;

  const maxYear = Math.max(Math.ceil(baseline.months / 12), Math.ceil(accelerated.months / 12), 1);
  const yearlySchedule: PrepaymentYearPoint[] = [];
  for (let yr = 0; yr <= maxYear; yr++) {
    yearlySchedule.push({
      year: yr,
      baselineBalance: baseline.yearEndBalances.get(yr) ?? Money.zero(currency),
      acceleratedBalance: accelerated.yearEndBalances.get(yr) ?? Money.zero(currency),
    });
  }

  return {
    baselineMonthsToPayoff: baseline.months,
    acceleratedMonthsToPayoff: accelerated.months,
    monthsSaved,
    baselineTotalInterest: baseline.totalInterest,
    acceleratedTotalInterest: accelerated.totalInterest,
    interestSaved: Money.fromCents(interestSavedCents, currency),
    yearlySchedule,
  };
}
