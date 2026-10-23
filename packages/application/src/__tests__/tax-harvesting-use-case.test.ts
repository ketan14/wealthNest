import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import { GetTaxHarvestingSummaryUseCase } from '../use-cases/get-tax-harvesting-summary.js';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';

describe('GetTaxHarvestingSummaryUseCase', () => {
  it('analyzes portfolio holdings and ranks tax loss harvesting opportunities', async () => {
    const mockRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn().mockResolvedValue(
        ok([
          {
            holdingId: 'h-gain-1',
            assetId: 'a-1',
            name: 'Reliance Industries Ltd',
            assetClassId: 'equity',
            assetClassName: 'Equities',
            assetClassColor: '#3b82f6',
            quantity: 100,
            unitCostCents: 150000, // ₹1,500
            currentValueCents: 35000000, // ₹3,50,000 (Gain: ₹2,00,000)
            currency: 'INR',
            updatedAt: '2023-01-01T00:00:00Z', // Long term
          },
          {
            holdingId: 'h-loss-1',
            assetId: 'a-2',
            name: 'Paytm / One97',
            assetClassId: 'equity',
            assetClassName: 'Equities',
            assetClassColor: '#3b82f6',
            quantity: 100,
            unitCostCents: 100000, // ₹1,000
            currentValueCents: 4000000, // ₹40,000 (Loss: ₹60,000)
            currency: 'INR',
            updatedAt: '2025-11-01T00:00:00Z', // Short term
          },
        ])
      ),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
    };

    const useCase = new GetTaxHarvestingSummaryUseCase(mockRepo);
    const result = await useCase.execute('user-1', '2026-03-01');

    expect(result.success).toBe(true);
    if (!result.success) return;

    const data = result.value;
    expect(data.taxSummary.ltcgGains.toDecimal()).toBe(200000);
    expect(data.taxSummary.annualLtcgExemption.toDecimal()).toBe(125000);

    // Top harvesting opportunities
    expect(data.topHarvestingOpportunities.length).toBe(1);
    const opp = data.topHarvestingOpportunities[0]!;
    expect(opp.assetName).toBe('Paytm / One97');
    expect(opp.currentLossAmountCents).toBe(6000000); // ₹60,000
    // 20% on ₹60,000 = ₹12,000 potential savings
    expect(opp.potentialTaxSavingsCents).toBe(1200000);
    expect(opp.recommendation).toContain('Sell to harvest');
    expect(data.deadlineDate).toBe('March 31, 2026');
    expect(data.daysRemainingInFy).toBeGreaterThan(0);
  });
});
