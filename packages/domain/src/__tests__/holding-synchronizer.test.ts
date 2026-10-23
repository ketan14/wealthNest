import { describe, it, expect } from 'vitest';
import { syncHoldingWithTransaction, SynchronizableHolding } from '../portfolio/holding-synchronizer.js';

describe('syncHoldingWithTransaction Domain Logic', () => {
  const initialHolding: SynchronizableHolding = {
    holdingId: 'hold-rel-1',
    quantity: 10,
    unitCostCents: 250000, // ₹2,500.00
    currentValueCents: 2500000, // ₹25,000.00
  };

  it('updates holding quantity and computes weighted average cost basis on Buy', () => {
    // Buy 5 shares at ₹2,800 (total ₹14,000 = 1,400,000 paise)
    const result = syncHoldingWithTransaction(initialHolding, {
      type: 'buy',
      quantity: 5,
      amountCents: 1400000,
    });

    expect(result.updatedQuantity).toBe(15);
    // (10 * 2500 + 14000) / 15 = 39000 / 15 = ₹2,600 = 260000 paise
    expect(result.updatedUnitCostCents).toBe(260000);
    // 15 * 2800 = 42000 = 4,200,000 paise
    expect(result.updatedCurrentValueCents).toBe(4200000);
    expect(result.realizedGainLossCents).toBeUndefined();
  });

  it('reduces quantity and calculates realized capital gains on profitable Sell', () => {
    // Sell 4 shares at ₹3,000 (total ₹12,000 = 1,200,000 paise)
    // Cost basis of 4 shares = 4 * 2500 = ₹10,000 = 1,000,000 paise
    // Realized Gain = 1,200,000 - 1,000,000 = +200,000 paise (₹2,000)
    const result = syncHoldingWithTransaction(initialHolding, {
      type: 'sell',
      quantity: 4,
      amountCents: 1200000,
    });

    expect(result.updatedQuantity).toBe(6);
    expect(result.updatedUnitCostCents).toBe(250000); // unchanged weighted unit cost for remaining
    expect(result.realizedGainLossCents).toBe(200000);
    expect(result.isRealizedGain).toBe(true);
    // 6 * 2500 = 1,500,000 paise
    expect(result.updatedCurrentValueCents).toBe(1500000);
  });

  it('calculates realized loss on Sell below cost basis', () => {
    // Sell 5 shares at ₹2,000 (total ₹10,000 = 1,000,000 paise)
    // Cost basis of 5 shares = 5 * 2500 = ₹12,500 = 1,250,000 paise
    // Realized Loss = 1,000,000 - 1,250,000 = -250,000 paise (-₹2,500)
    const result = syncHoldingWithTransaction(initialHolding, {
      type: 'sell',
      quantity: 5,
      amountCents: 1000000,
    });

    expect(result.updatedQuantity).toBe(5);
    expect(result.realizedGainLossCents).toBe(-250000);
    expect(result.isRealizedGain).toBe(false);
  });

  it('leaves inventory unchanged for dividend and fee transactions', () => {
    const dividendResult = syncHoldingWithTransaction(initialHolding, {
      type: 'dividend',
      amountCents: 50000,
    });
    expect(dividendResult.updatedQuantity).toBe(10);
    expect(dividendResult.updatedUnitCostCents).toBe(250000);
    expect(dividendResult.updatedCurrentValueCents).toBe(2500000);
  });
});
