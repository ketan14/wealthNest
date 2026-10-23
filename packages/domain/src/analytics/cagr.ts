import { Money } from '../money/money.js';

export interface CagrParams {
  readonly beginningValue: Money;
  readonly endingValue: Money;
  readonly years: number;
}

/**
 * Calculates Compound Annual Growth Rate (CAGR).
 *
 * @param params beginningValue, endingValue, and period in fractional/integer years.
 * @returns Annualized compound growth rate as a decimal (e.g. 0.125 for 12.5%), or 0 if invalid.
 */
export function calculateCagr(params: CagrParams): number {
  const { beginningValue, endingValue, years } = params;

  if (years <= 0) {
    return 0;
  }

  const startCents = Number(beginningValue.cents);
  const endCents = Number(endingValue.cents);

  if (startCents <= 0 || endCents <= 0) {
    return 0;
  }

  const growthRatio = endCents / startCents;
  const cagr = Math.pow(growthRatio, 1 / years) - 1;

  if (isNaN(cagr) || !isFinite(cagr)) {
    return 0;
  }

  return Number(cagr.toFixed(6));
}
