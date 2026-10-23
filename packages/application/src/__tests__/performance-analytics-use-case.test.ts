import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import {
  GetPerformanceAnalyticsUseCase,
  HoldingRepositoryPort,
  TransactionRepositoryPort,
  HoldingDetailDto,
  TransactionDetailDto,
} from '../index.js';

describe('Application: GetPerformanceAnalyticsUseCase', () => {
  const mockHoldings: HoldingDetailDto[] = [
    {
      holdingId: 'h-1',
      assetId: 'a-1',
      name: 'Tata Consultancy Services',
      ticker: 'TCS',
      assetClassId: 'equity',
      assetClassName: 'Equities & Mutual Funds',
      assetClassColor: '#3b82f6',
      quantity: 50,
      unitCostCents: 350000, // ₹3,500.00
      currentValueCents: 20000000, // ₹2,00,000.00 (+₹25,000)
      currency: 'INR',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      holdingId: 'h-2',
      assetId: 'a-2',
      name: 'ICICI Prudential Liquid Fund',
      ticker: 'ICICILIQ',
      assetClassId: 'cash',
      assetClassName: 'Cash & Liquid Savings',
      assetClassColor: '#10b981',
      quantity: 500,
      unitCostCents: 10000, // ₹100.00
      currentValueCents: 5500000, // ₹55,000.00 (+₹5,000)
      currency: 'INR',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  const mockTransactions: TransactionDetailDto[] = [
    {
      id: 'tx-1',
      userId: 'user-123',
      type: 'deposit',
      amountCents: 22500000, // ₹2,25,000.00
      currency: 'INR',
      transactionDate: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];

  it('rejects empty user ID with an error result', async () => {
    const mockHoldingRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn(),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
    };
    const mockTxRepo: TransactionRepositoryPort = {
      listByUser: vi.fn(),
      createTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
    };

    const useCase = new GetPerformanceAnalyticsUseCase(mockHoldingRepo, mockTxRepo);
    const result = await useCase.execute({ userId: '' });
    expect(result.success).toBe(false);
  });

  it('calculates comprehensive performance analytics with DTO values', async () => {
    const mockHoldingRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn().mockResolvedValue(ok(mockHoldings)),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
    };
    const mockTxRepo: TransactionRepositoryPort = {
      listByUser: vi.fn().mockResolvedValue(ok(mockTransactions)),
      createTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
    };

    const useCase = new GetPerformanceAnalyticsUseCase(mockHoldingRepo, mockTxRepo);
    const result = await useCase.execute({ userId: 'user-123', currency: 'INR', modelType: 'balanced' });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const dto = result.value;
    // Total value = ₹2,00,000 + ₹55,000 = ₹2,55,000
    expect(dto.totalValue.decimal).toBe(255000);
    // Cost basis = 50 * ₹3,500 + 500 * ₹100 = 175,000 + 50,000 = ₹2,25,000
    expect(dto.totalCostBasis.decimal).toBe(225000);
    expect(dto.absoluteGain.decimal).toBe(30000);
    expect(dto.returnPercentage).toBeCloseTo(13.33, 1);
    expect(dto.benchmarks.length).toBeGreaterThan(0);
    expect(dto.drifts.length).toBeGreaterThan(0);
    expect(dto.concentration.topAssetName).toBe('Tata Consultancy Services');
    expect(dto.trajectory.length).toBe(12);
  });
});
