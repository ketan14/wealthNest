/**
 * WealthNest Financial Precision and Calculation Rules
 * 
 * Rules:
 * 1. Money representation: Always stored as integer paise (1 INR = 100 paise, BigInt).
 *    Zero floating-point arithmetic drift allowed for all currency amounts.
 * 2. Quantity representation: Stored as high-precision decimals up to 8 decimal places
 *    (standard numeric(20, 8) for mutual fund fractional units and crypto).
 * 3. Unit Cost vs Total Cost Basis:
 *    - unitCostPaise: The weighted average purchase price per single unit in paise.
 *    - totalCostBasisPaise: quantity * unitCostPaise, rounded to nearest integer paise.
 * 4. Current Price vs Current Valuation:
 *    - currentMarketPricePaise: Current market price or NAV per single unit in paise.
 *    - currentValuationPaise: aggregate market value of all held units.
 *      For holdings: quantity * currentMarketPricePaise, rounded to nearest integer paise.
 *      For physical assets: latest dated asset_valuation record.
 * 5. Gains and Performance:
 *    - unrealizedGainPaise = currentValuationPaise - totalCostBasisPaise
 *    - realizedGainPaise = saleProceedsPaise - (soldQuantity * unitCostPaise)
 *    - returnPercentage = (gainPaise * 10000n) / totalCostBasisPaise / 100 (basis points, 2 decimal places).
 */

export interface HoldingCostAndValuation {
  readonly quantity: number;
  readonly unitCostPaise: bigint;
  readonly currentPricePaise: bigint;
}

export interface ComputedHoldingGains {
  readonly quantity: number;
  readonly unitCostPaise: bigint;
  readonly currentPricePaise: bigint;
  readonly totalCostBasisPaise: bigint;
  readonly currentValuationPaise: bigint;
  readonly unrealizedGainLossPaise: bigint;
  readonly isProfitable: boolean;
  readonly returnPercentage: number;
}

/**
 * Calculates total cost basis in integer paise from quantity and unit cost in paise.
 * Enforces half-up rounding to prevent fractional paise accumulation.
 */
export function calculateCostBasisPaise(quantity: number, unitCostPaise: bigint): bigint {
  if (quantity <= 0 || unitCostPaise <= 0n) return 0n;
  const rawPaise = Math.round(quantity * Number(unitCostPaise));
  return BigInt(rawPaise);
}

/**
 * Calculates current valuation in integer paise from quantity and unit market price in paise.
 * Enforces half-up rounding.
 */
export function calculateValuationPaise(quantity: number, currentPricePaise: bigint): bigint {
  if (quantity <= 0 || currentPricePaise <= 0n) return 0n;
  const rawPaise = Math.round(quantity * Number(currentPricePaise));
  return BigInt(rawPaise);
}

/**
 * Calculates unrealized gain or loss and return percentage in basis points (2 decimal places).
 * Handles zero and negative cost basis safely.
 */
export function calculateHoldingGains(params: HoldingCostAndValuation): ComputedHoldingGains {
  const { quantity, unitCostPaise, currentPricePaise } = params;
  const totalCostBasisPaise = calculateCostBasisPaise(quantity, unitCostPaise);
  const currentValuationPaise = calculateValuationPaise(quantity, currentPricePaise);

  const diffPaise = currentValuationPaise - totalCostBasisPaise;
  const isProfitable = diffPaise >= 0n;

  let returnPercentage = 0;
  if (totalCostBasisPaise > 0n) {
    // Basis points integer calculation: (diff * 10000) / cost
    const basisPoints = (diffPaise * 10000n) / totalCostBasisPaise;
    returnPercentage = Number(basisPoints) / 100;
  }

  return {
    quantity,
    unitCostPaise,
    currentPricePaise,
    totalCostBasisPaise,
    currentValuationPaise,
    unrealizedGainLossPaise: diffPaise,
    isProfitable,
    returnPercentage,
  };
}

/**
 * Calculates realized gain or loss for a partial or full sale of a holding.
 */
export function calculateRealizedGain(
  soldQuantity: number,
  unitCostPaise: bigint,
  salePricePaise: bigint
): {
  readonly soldQuantity: number;
  readonly costBasisOfSoldUnitsPaise: bigint;
  readonly saleProceedsPaise: bigint;
  readonly realizedGainPaise: bigint;
  readonly isProfitable: boolean;
} {
  const costBasisOfSoldUnitsPaise = calculateCostBasisPaise(soldQuantity, unitCostPaise);
  const saleProceedsPaise = calculateValuationPaise(soldQuantity, salePricePaise);
  const realizedGainPaise = saleProceedsPaise - costBasisOfSoldUnitsPaise;

  return {
    soldQuantity,
    costBasisOfSoldUnitsPaise,
    saleProceedsPaise,
    realizedGainPaise,
    isProfitable: realizedGainPaise >= 0n,
  };
}

/**
 * Sanitizes quantity to maximum 8 decimal places to eliminate IEEE 754 floating point artifacts.
 */
export function sanitizeQuantity(quantity: number): number {
  if (isNaN(quantity) || !isFinite(quantity) || quantity < 0) return 0;
  return Number(Math.round(Number(quantity + 'e8')) + 'e-8');
}
