import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import {
  GetPortfolioSummaryUseCase,
  HoldingRepositoryPort,
  HoldingDetailDto,
  AddHoldingUseCase,
  DeleteHoldingUseCase,
} from '../index.js';

describe('GetPortfolioSummaryUseCase (India First)', () => {
  it('orchestrates portfolio summary calculation via repository port in INR', async () => {
    const mockHoldings: HoldingDetailDto[] = [
      {
        holdingId: 'h-100',
        assetId: 'a-100',
        name: 'Reliance Industries Ltd',
        ticker: 'RELIANCE',
        assetClassId: 'equity',
        assetClassName: 'Equities & Stocks',
        assetClassColor: '#3b82f6',
        quantity: 50,
        unitCostCents: 250000, // ₹2,500.00
        currentValueCents: 15000000, // ₹1,50,000.00 (Cost basis = 50 * 2500 = 1,25,000 -> Gain = +25,000)
        currency: 'INR',
        updatedAt: new Date().toISOString(),
      },
    ];

    const mockRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn().mockResolvedValue(ok(mockHoldings)),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
    };

    const useCase = new GetPortfolioSummaryUseCase(mockRepo);
    const result = await useCase.execute('user-123', 'INR');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.summary.totalValue.toDecimal()).toBe(150000);
      expect(result.value.summary.totalCostBasis.toDecimal()).toBe(125000);
      expect(result.value.summary.unrealizedGainLoss.toDecimal()).toBe(25000);
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
      currency: 'INR',
      quantity: 1,
      unitCostCents: 100,
      currentValueCents: 100,
    });

    expect(result.success).toBe(false);
  });
});

describe('DeleteHoldingUseCase', () => {
  it('invokes repository deleteHolding method with correct holdingId and userId', async () => {
    const mockRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn(),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn().mockResolvedValue(ok(undefined)),
    };

    const useCase = new DeleteHoldingUseCase(mockRepo);
    const result = await useCase.execute('holding-123', 'user-456');

    expect(result.success).toBe(true);
    expect(mockRepo.deleteHolding).toHaveBeenCalledWith('holding-123', 'user-456');
  });
});
