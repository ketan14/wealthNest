import { describe, it, expect } from 'vitest';
import {
  calculateCostBasisPaise,
  calculateValuationPaise,
  calculateHoldingGains,
  calculateRealizedGain,
  sanitizeQuantity,
} from '../portfolio/precision-rules.js';

describe('Financial Precision and Rounding Invariants', () => {
  it('calculates cost basis with integer paise precision and half-up rounding', () => {
    // 12.345678 units @ ₹1,234.56 per unit (123456 paise)
    const qty = 12.345678;
    const unitCostPaise = 123456n;
    const costBasis = calculateCostBasisPaise(qty, unitCostPaise);
    
    // 12.345678 * 123456 = 1524148.029... -> rounds to 1524148 paise (₹15,241.48)
    expect(costBasis).toBe(1524148n);
  });

  it('calculates current valuation accurately without floating point creep', () => {
    // 100.5 units @ ₹250.75 per unit (25075 paise)
    const qty = 100.5;
    const currentPricePaise = 25075n;
    const valuation = calculateValuationPaise(qty, currentPricePaise);

    // 100.5 * 25075 = 2520037.5 -> rounds to 2520038 paise (₹25,200.38)
    expect(valuation).toBe(2520038n);
  });

  it('separates unrealized gains and accurately computes return percentage in basis points', () => {
    // Bought 50 shares @ ₹1,000 (100000 paise) = ₹50,000 cost basis (5000000 paise)
    // Current price @ ₹1,250 (125000 paise) = ₹62,500 valuation (6250000 paise)
    const gains = calculateHoldingGains({
      quantity: 50,
      unitCostPaise: 100000n,
      currentPricePaise: 125000n,
    });

    expect(gains.totalCostBasisPaise).toBe(5000000n);
    expect(gains.currentValuationPaise).toBe(6250000n);
    expect(gains.unrealizedGainLossPaise).toBe(1250000n); // +₹12,500
    expect(gains.isProfitable).toBe(true);
    expect(gains.returnPercentage).toBe(25.0); // +25.00%
  });

  it('handles unrealized loss correctly', () => {
    // Bought 10 shares @ ₹2,000 = ₹20,000 (2000000 paise)
    // Current price @ ₹1,700 = ₹17,000 (1700000 paise)
    const gains = calculateHoldingGains({
      quantity: 10,
      unitCostPaise: 200000n,
      currentPricePaise: 170000n,
    });

    expect(gains.totalCostBasisPaise).toBe(2000000n);
    expect(gains.currentValuationPaise).toBe(1700000n);
    expect(gains.unrealizedGainLossPaise).toBe(-300000n); // -₹3,000
    expect(gains.isProfitable).toBe(false);
    expect(gains.returnPercentage).toBe(-15.0); // -15.00%
  });

  it('computes realized gains for partial sales with proportional cost basis', () => {
    // Had bought 100 units @ ₹500 (50000 paise).
    // Sold 40 units @ ₹650 (65000 paise).
    const sale = calculateRealizedGain(40, 50000n, 65000n);

    expect(sale.soldQuantity).toBe(40);
    expect(sale.costBasisOfSoldUnitsPaise).toBe(2000000n); // 40 * ₹500 = ₹20,000
    expect(sale.saleProceedsPaise).toBe(2600000n); // 40 * ₹650 = ₹26,000
    expect(sale.realizedGainPaise).toBe(600000n); // +₹6,000
    expect(sale.isProfitable).toBe(true);
  });

  it('sanitizes fractional quantities to 8 decimal places max', () => {
    const raw = 0.1 + 0.2; // 0.30000000000000004 in IEEE 754
    const clean = sanitizeQuantity(raw);
    expect(clean).toBe(0.3);

    const fractionalMutualFundUnits = 145.8923456789;
    const sanitizedUnits = sanitizeQuantity(fractionalMutualFundUnits);
    expect(sanitizedUnits).toBe(145.89234568);
  });
});
