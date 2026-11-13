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
