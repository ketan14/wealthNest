import { describe, it, expect } from 'vitest';
import {
  calculateCapitalGainsTaxSummary,
  BUDGET_2024_TAX_RULES,
} from '../tax/capital-gains.js';

describe('India Capital Gains & Tax-Loss Harvesting (Budget 2024)', () => {
  it('correctly applies Budget 2024 Section 112A ₹1,25,000 exemption and 12.5% LTCG rate', () => {
    const holdings = [
      {
        holdingId: 'h-1',
        name: 'Reliance Industries Ltd',
        assetClassId: 'equity',
        quantity: 100,
        unitCostCents: 150000, // ₹1,500
        currentValueCents: 35000000, // ₹3,50,000 (Gain: ₹2,00,000)
        purchaseDate: '2023-01-01', // > 365 days -> LTCG
      },
    ];

    const summary = calculateCapitalGainsTaxSummary(holdings, '2026-03-01');

    // Total LTCG Gain = ₹2,00,000
    expect(summary.ltcgGains.toDecimal()).toBe(200000);
    // Exemption = ₹1,25,000
    expect(summary.annualLtcgExemption.toDecimal()).toBe(125000);
    // Taxable LTCG = ₹2,00,000 - ₹1,25,000 = ₹75,000
    expect(summary.taxableLtcg.toDecimal()).toBe(75000);
    // 12.5% on ₹75,000 = ₹9,375
    expect(summary.estimatedLtcgTax.toDecimal()).toBe(9375);
    expect(summary.totalEstimatedTax.toDecimal()).toBe(9375);
    expect(summary.fiscalYear).toBe('FY 2025-26');
  });

  it('correctly calculates 20% STCG for holding period under 365 days', () => {
    const holdings = [
      {
        holdingId: 'h-2',
        name: 'Tata Motors Ltd',
        assetClassId: 'equity',
        quantity: 50,
        unitCostCents: 60000, // ₹600
        currentValueCents: 4000000, // ₹40,000 (Cost: ₹30,000, Gain: ₹10,000)
        purchaseDate: '2026-01-01', // 60 days -> STCG
      },
    ];

    const summary = calculateCapitalGainsTaxSummary(holdings, '2026-03-01');

    expect(summary.stcgGains.toDecimal()).toBe(10000);
    expect(summary.netStcg.toDecimal()).toBe(10000);
    // 20% on ₹10,000 = ₹2,000
    expect(summary.estimatedStcgTax.toDecimal()).toBe(2000);
    expect(summary.totalEstimatedTax.toDecimal()).toBe(2000);
  });

  it('identifies harvestable losses to offset taxable capital gains', () => {
    const holdings = [
      {
        holdingId: 'h-winner',
        name: 'HDFC Bank Ltd',
        assetClassId: 'equity',
        quantity: 100,
        unitCostCents: 100000, // ₹1,000
        currentValueCents: 20000000, // ₹2,00,000 (Gain: ₹1,00,000)
        purchaseDate: '2025-10-01', // Short term
      },
      {
        holdingId: 'h-loser',
        name: 'Paytm / One97',
        assetClassId: 'equity',
        quantity: 100,
        unitCostCents: 90000, // ₹900
        currentValueCents: 5000000, // ₹50,000 (Cost: ₹90,000, Loss: ₹40,000)
        purchaseDate: '2025-11-01', // Short term
      },
    ];

    const summary = calculateCapitalGainsTaxSummary(holdings, '2026-03-01');

    expect(summary.stcgGains.toDecimal()).toBe(100000);
    expect(summary.stcgLosses.toDecimal()).toBe(40000);
    // Net STCG = ₹1,00,000 - ₹40,000 = ₹60,000
    expect(summary.netStcg.toDecimal()).toBe(60000);
    // 20% on ₹60,000 = ₹12,000
    expect(summary.estimatedStcgTax.toDecimal()).toBe(12000);
    // Harvestable loss opportunity = ₹40,000
    expect(summary.harvestableLossPotential.toDecimal()).toBe(40000);
    // Potential tax savings = 20% of ₹40,000 = ₹8,000
    expect(summary.potentialTaxSavings.toDecimal()).toBe(8000);
  });
});
