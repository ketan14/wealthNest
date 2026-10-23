/**
 * Cashflow entry for XIRR calculation.
 * Investments / Outflows are negative numbers.
 * Redemptions / Final Portfolio Current Valuation are positive numbers.
 */
export interface CashflowItem {
  readonly date: Date;
  readonly amount: number; // in standard currency units (e.g. ₹ or $)
}

const MAX_ITERATIONS = 100;
const ACCURACY = 1e-7;

/**
 * Calculates Net Present Value (NPV) for a given rate and cash flow series.
 */
function calculateNpv(rate: number, cashflows: readonly CashflowItem[]): number {
  const d0 = cashflows[0]!.date.getTime();
  let npv = 0;

  for (const item of cashflows) {
    const days = (item.date.getTime() - d0) / (1000 * 60 * 60 * 24);
    const factor = Math.pow(1 + rate, days / 365);
    if (factor === 0 || !isFinite(factor)) return NaN;
    npv += item.amount / factor;
  }

  return npv;
}

/**
 * Calculates the first derivative of NPV with respect to rate.
 */
function calculateNpvDerivative(rate: number, cashflows: readonly CashflowItem[]): number {
  const d0 = cashflows[0]!.date.getTime();
  let derivative = 0;

  for (const item of cashflows) {
    const days = (item.date.getTime() - d0) / (1000 * 60 * 60 * 24);
    const years = days / 365;
    const factor = Math.pow(1 + rate, years + 1);
    if (factor === 0 || !isFinite(factor)) return NaN;
    derivative -= (years * item.amount) / factor;
  }

  return derivative;
}

/**
 * Calculates the Extended Internal Rate of Return (XIRR) for irregular cashflows.
 * Uses the Newton-Raphson numerical method with bisection boundary protection.
 *
 * @param cashflows Array of CashflowItems (must include at least one negative and one positive value)
 * @param guess Initial annualized rate guess (defaults to 0.10, i.e., 10%)
 * @returns Annualized rate as a decimal (e.g., 0.1425 for 14.25%), or null if non-convergent.
 */
export function calculateXirr(
  cashflows: readonly CashflowItem[],
  guess: number = 0.1
): number | null {
  if (cashflows.length < 2) {
    return null;
  }

  // Verify at least one positive and one negative cashflow
  let hasPositive = false;
  let hasNegative = false;
  for (const cf of cashflows) {
    if (cf.amount > 0) hasPositive = true;
    if (cf.amount < 0) hasNegative = true;
  }
  if (!hasPositive || !hasNegative) {
    return null;
  }

  // Sort cashflows chronologically ascending
  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());

  let rate = guess;

  // Newton-Raphson iteration
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const npv = calculateNpv(rate, sorted);
    if (isNaN(npv)) {
      break;
    }

    if (Math.abs(npv) < ACCURACY) {
      return Number(rate.toFixed(6));
    }

    const derivative = calculateNpvDerivative(rate, sorted);
    if (isNaN(derivative) || Math.abs(derivative) < 1e-12) {
      break;
    }

    const nextRate = rate - npv / derivative;

    // Check bounds: rate cannot drop below -0.9999 (-99.99%) or exceed reasonable 1000%
    if (nextRate <= -0.9999 || nextRate > 10.0 || isNaN(nextRate)) {
      break;
    }

    if (Math.abs(nextRate - rate) < ACCURACY) {
      return Number(nextRate.toFixed(6));
    }

    rate = nextRate;
  }

  // Bisection method fallback if Newton-Raphson did not converge
  let low = -0.99;
  let high = 5.0;
  let npvLow = calculateNpv(low, sorted);
  let npvHigh = calculateNpv(high, sorted);

  if (isNaN(npvLow) || isNaN(npvHigh) || npvLow * npvHigh > 0) {
    return null;
  }

  for (let j = 0; j < 100; j++) {
    const mid = (low + high) / 2;
    const npvMid = calculateNpv(mid, sorted);

    if (Math.abs(npvMid) < ACCURACY || (high - low) / 2 < ACCURACY) {
      return Number(mid.toFixed(6));
    }

    if (npvLow * npvMid < 0) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }

  return Number(((low + high) / 2).toFixed(6));
}
