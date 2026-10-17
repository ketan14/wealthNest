import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import {
  GetPortfolioSummaryUseCase,
  HoldingRepositoryPort,
  HoldingDetailDto,
  AddHoldingUseCase,
} from '../index.js';

describe('GetPortfolioSummaryUseCase', () => {
  it('orchestrates portfolio summary calculation via repository port', async () => {
    const mockHoldings: HoldingDetailDto[] = [
      {
        holdingId: 'h-100',
        assetId: 'a-100',
        name: 'Apple Inc.',
        ticker: 'AAPL',
        assetClassId: 'equity',
        assetClassName: 'Equities & Stocks',
        assetClassColor: '#3b82f6',
        quantity: 10,
        unitCostCents: 15000, // $150.00
        currentValueCents: 180000, // $1,800.00
        currency: 'USD',
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn().mockResolvedValue(ok(mockHoldings)),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
    };

    const useCase = new GetPortfolioSummaryUseCase(mockRepo);
    const result = await useCase.execute('user-123', 'USD');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.summary.totalValue.toDecimal()).toBe(1800);
      expect(result.value.summary.totalCostBasis.toDecimal()).toBe(1500);
      expect(result.value.summary.unrealizedGainLoss.toDecimal()).toBe(300);
      expect(result.value.summary.returnPercentage).toBe(20);
      expect(result.value.summary.isProfitable).toBe(true);
      expect(result.value.holdings).toHaveLength(1);
    }
  });
});

describe('AddHoldingUseCase', () => {
  it('validates required fields', async () => {
    const mockRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn(),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
    };

    const useCase = new AddHoldingUseCase(mockRepo);
    const result = await useCase.execute({
      userId: 'user-1',
      name: '',
      assetClassId: 'equity',
      currency: 'USD',
      quantity: 1,
      unitCostCents: 100,
      currentValueCents: 100,
    });

    expect(result.success).toBe(false);
  });
});
