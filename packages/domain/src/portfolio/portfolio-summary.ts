import { CurrencyCode } from '../money/currency.js';
import { Money } from '../money/money.js';

export interface HoldingValuationItem {
  readonly holdingId: string;
  readonly assetClassId: string;
  readonly assetClassName: string;
  readonly colorHex: string;
  readonly quantity: number;
  readonly costBasis: Money;
  readonly currentValue: Money;
}

export interface AssetClassAllocation {
  readonly assetClassId: string;
  readonly name: string;
  readonly colorHex: string;
  readonly totalValue: Money;
  readonly percentage: number;
}

export interface PortfolioSummary {
  readonly totalValue: Money;
  readonly totalCostBasis: Money;
  readonly unrealizedGainLoss: Money;
  readonly returnPercentage: number;
  readonly isProfitable: boolean;
  readonly allocations: readonly AssetClassAllocation[];
}

/**
 * Pure Domain calculation for portfolio aggregation and asset distribution.
 * Guarantees zero floating-point arithmetic errors by utilizing the Money value object.
 */
export function calculatePortfolioSummary(
  items: readonly HoldingValuationItem[],
  currency: CurrencyCode = 'INR'
): PortfolioSummary {
  if (items.length === 0) {
    return {
      totalValue: Money.zero(currency),
      totalCostBasis: Money.zero(currency),
      unrealizedGainLoss: Money.zero(currency),
      returnPercentage: 0,
      isProfitable: false,
      allocations: [],
    };
  }

  // 1. Calculate overall portfolio totals
  let totalValue = Money.zero(currency);
  let totalCost = Money.zero(currency);

  for (const item of items) {
    totalValue = totalValue.add(item.currentValue);
    totalCost = totalCost.add(item.costBasis);
  }

  // 2. Calculate unrealized gain/loss
  const diffCents = totalValue.cents - totalCost.cents;
  const isProfitable = diffCents >= 0n;

  // Handle absolute diff for Money representation
  const absDiff = diffCents < 0n ? -diffCents : diffCents;
  const unrealizedGainLoss = Money.fromCents(absDiff, currency);

  // Return percentage calculation
  let returnPercentage = 0;
  if (totalCost.cents > 0n) {
    returnPercentage = Number((diffCents * 10000n) / totalCost.cents) / 100;
  }

  // 3. Aggregate asset class allocations
  const classMap = new Map<
    string,
    { name: string; colorHex: string; totalValue: Money }
  >();

  for (const item of items) {
    const existing = classMap.get(item.assetClassId);
    if (existing) {
      existing.totalValue = existing.totalValue.add(item.currentValue);
    } else {
      classMap.set(item.assetClassId, {
        name: item.assetClassName,
        colorHex: item.colorHex,
        totalValue: item.currentValue,
      });
    }
  }

  const allocations: AssetClassAllocation[] = [];
  for (const [assetClassId, data] of classMap.entries()) {
    let percentage = 0;
    if (totalValue.cents > 0n) {
      percentage =
        Number((data.totalValue.cents * 10000n) / totalValue.cents) / 100;
    }

    allocations.push({
      assetClassId,
      name: data.name,
      colorHex: data.colorHex,
      totalValue: data.totalValue,
      percentage,
    });
  }

  // Sort descending by value
  allocations.sort((a, b) => (b.totalValue.cents > a.totalValue.cents ? 1 : -1));

  return {
    totalValue,
    totalCostBasis: totalCost,
    unrealizedGainLoss,
    returnPercentage,
    isProfitable,
    allocations,
  };
}
