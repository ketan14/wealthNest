import { describe, it, expect } from 'vitest';
import {
  calculateSection112aHarvestingPlan,
  RawHarvestInputHolding,
} from '../tax/section-112a-harvesting.js';

describe('Section 112A Capital Gains Tax Harvesting Tool (TAX-112A-01)', () => {
  it('calculates optimal tax-free harvesting capacity across multi-entity PANs (Ketan & Shamalbhai HUF)', () => {
    const holdings: RawHarvestInputHolding[] = [
      // Ketan Vaghela (Individual): Reliance (+₹2,00,000 LTCG, held 450 days)
      {
        holdingId: 'h-1',
        assetName: 'Reliance Industries Ltd',
        ticker: 'RELIANCE',
        memberId: 'mem-self',
        memberName: 'Ketan Vaghela',
        isHuf: false,
        quantity: 100,
        unitCostCents: 200000, // ₹2,000
        currentValueCents: 40000000, // ₹4,00,000 (Gain: ₹2,00,000)
        purchaseDate: '2024-01-01',
      },
      // Shamalbhai Vaghela HUF: TCS (+₹1,00,000 LTCG, held 500 days)
      {
        holdingId: 'h-2',
        assetName: 'Tata Consultancy Services',
        ticker: 'TCS',
        memberId: 'mem-huf',
        memberName: 'Shamalbhai Vaghela HUF',
        isHuf: true,
        quantity: 50,
        unitCostCents: 300000, // ₹3,000
        currentValueCents: 25000000, // ₹2,50,000 (Gain: ₹1,00,000)
        purchaseDate: '2023-11-15',
      },
      // Ketan Vaghela: HDFC Bank (+₹50,000 STCG, held 120 days) -> Should NOT qualify for 112A
      {
        holdingId: 'h-3',
        assetName: 'HDFC Bank Ltd',
        ticker: 'HDFCBANK',
        memberId: 'mem-self',
        memberName: 'Ketan Vaghela',
        isHuf: false,
        quantity: 100,
        unitCostCents: 150000,
        currentValueCents: 20000000,
        purchaseDate: '2026-01-01',
      },
    ];

    const plan = calculateSection112aHarvestingPlan(holdings, {
      asOfDate: '2026-03-15',
    });

    // 2 Distinct PAN entities = ₹2,50,000 Total Exemption Capacity
    expect(plan.totalFamilyExemptionCapacity.toDecimal()).toBe(250000);

    // Entity 1: Ketan Vaghela (Max out at ₹1,25,000)
    const ketanEntity = plan.entityBreakdowns.find((e) => e.memberId === 'mem-self')!;
    expect(ketanEntity).toBeDefined();
    expect(ketanEntity.totalUnrealizedLtcg.toDecimal()).toBe(200000);
    expect(ketanEntity.optimalHarvestAmount.toDecimal()).toBe(125000); // Capped at ₹1.25L
    expect(ketanEntity.estimatedTaxShield.toDecimal()).toBe(15625); // 12.5% of ₹1.25L = ₹15,625 saved

    // Entity 2: Shamalbhai HUF (Harvest all ₹1,00,000 tax-free)
    const hufEntity = plan.entityBreakdowns.find((e) => e.memberId === 'mem-huf')!;
    expect(hufEntity).toBeDefined();
    expect(hufEntity.totalUnrealizedLtcg.toDecimal()).toBe(100000);
    expect(hufEntity.optimalHarvestAmount.toDecimal()).toBe(100000);
    expect(hufEntity.remainingExemptionHeadroom.toDecimal()).toBe(25000); // ₹25k unused headroom
    expect(hufEntity.estimatedTaxShield.toDecimal()).toBe(12500); // 12.5% of ₹1,00,000 = ₹12,500 saved

    // Family Total Tax Saved: ₹15,625 + ₹12,500 = ₹28,125
    expect(plan.totalOptimalHarvestAmount.toDecimal()).toBe(225000);
    expect(plan.totalEstimatedTaxSaved.toDecimal()).toBe(28125);
  });
});
