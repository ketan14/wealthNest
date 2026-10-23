export interface SynchronizableHolding {
  readonly holdingId: string;
  readonly quantity: number;
  readonly unitCostCents: number;
  readonly currentValueCents: number;
}

export interface HoldingSyncAdjustment {
  readonly updatedQuantity: number;
  readonly updatedUnitCostCents: number;
  readonly updatedCurrentValueCents: number;
  readonly realizedGainLossCents?: number;
  readonly isRealizedGain?: boolean;
}

export interface HoldingSyncTransactionInput {
  readonly type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend' | 'fee';
  readonly quantity?: number;
  readonly amountCents: number; // integer paise
}

/**
 * Synchronizes holding quantity, weighted average cost basis, and computes realized P&L on trades.
 * Implements standard Indian equity & mutual fund weighted average cost accounting.
 */
export function syncHoldingWithTransaction(
  holding: SynchronizableHolding,
  transaction: HoldingSyncTransactionInput
): HoldingSyncAdjustment {
  if (transaction.type === 'buy') {
    const buyQty = transaction.quantity !== undefined && transaction.quantity > 0 ? transaction.quantity : 1;
    const oldTotalCost = Math.round(holding.quantity * holding.unitCostCents);
    const newQty = holding.quantity + buyQty;
    const newTotalCost = oldTotalCost + transaction.amountCents;
    const newUnitCost = newQty > 0 ? Math.round(newTotalCost / newQty) : 0;

    // Latest price per unit from this buy transaction
    const latestUnitPrice = transaction.amountCents / buyQty;
    const updatedCurrentVal = Math.round(newQty * latestUnitPrice);

    return {
      updatedQuantity: newQty,
      updatedUnitCostCents: newUnitCost,
      updatedCurrentValueCents: updatedCurrentVal,
    };
  }

  if (transaction.type === 'sell') {
    const sellQty = transaction.quantity !== undefined && transaction.quantity > 0 ? transaction.quantity : 1;
    const actualSoldQty = Math.min(sellQty, holding.quantity);
    const remainingQty = Math.max(0, holding.quantity - actualSoldQty);

    const costBasisOfSoldUnits = Math.round(actualSoldQty * holding.unitCostCents);
    const proceeds = transaction.amountCents;
    const realizedGainLoss = proceeds - costBasisOfSoldUnits;

    // Remaining units retain the existing weighted average unit cost
    const currentPricePerUnit = holding.quantity > 0 ? holding.currentValueCents / holding.quantity : 0;
    const updatedCurrentVal = Math.round(remainingQty * currentPricePerUnit);

    return {
      updatedQuantity: remainingQty,
      updatedUnitCostCents: holding.unitCostCents,
      updatedCurrentValueCents: updatedCurrentVal,
      realizedGainLossCents: realizedGainLoss,
      isRealizedGain: realizedGainLoss >= 0,
    };
  }

  // Non-trade cashflow (dividend, fee, etc.) does not alter holding inventory
  return {
    updatedQuantity: holding.quantity,
    updatedUnitCostCents: holding.unitCostCents,
    updatedCurrentValueCents: holding.currentValueCents,
  };
}
