import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import {
  GetCashflowSummaryUseCase,
  RecordTransactionUseCase,
  TransactionRepositoryPort,
  TransactionDetailDto,
} from '../index.js';

describe('GetCashflowSummaryUseCase (India First)', () => {
  it('orchestrates cashflow calculation in INR via repository port', async () => {
    const mockTransactions: TransactionDetailDto[] = [
      {
        id: 'tx-1',
        userId: 'user-1',
        type: 'deposit',
        amountCents: 10000000, // ₹1,00,000 (1 Lakh)
        currency: 'INR',
        transactionDate: '2026-04-01T10:00:00Z',
        createdAt: '2026-04-01T10:00:00Z',
      },
      {
        id: 'tx-2',
        userId: 'user-1',
        assetId: 'asset-rel',
        assetName: 'Reliance Industries Ltd',
        assetTicker: 'RELIANCE',
        type: 'buy',
        quantity: 10,
        amountCents: 2500000, // ₹25,000
        currency: 'INR',
        transactionDate: '2026-04-05T10:00:00Z',
        createdAt: '2026-04-05T10:00:00Z',
      },
      {
        id: 'tx-3',
        userId: 'user-1',
        assetId: 'asset-tcs',
        assetName: 'Tata Consultancy Services',
        assetTicker: 'TCS',
        type: 'dividend',
        amountCents: 350000, // ₹3,500
        currency: 'INR',
        transactionDate: '2026-04-10T10:00:00Z',
        createdAt: '2026-04-10T10:00:00Z',
      },
    ];

    const mockRepo: TransactionRepositoryPort = {
      listByUser: vi.fn().mockResolvedValue(ok(mockTransactions)),
      createTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
    };

    const useCase = new GetCashflowSummaryUseCase(mockRepo);
    const result = await useCase.execute('user-1', 'INR');

    expect(result.success).toBe(true);
    if (result.success) {
      // Inflow: 1,00,000 + 3,500 = 1,03,500
      expect(result.value.summary.totalInflows.toDecimal()).toBe(103500);
      // Outflow: 25,000
      expect(result.value.summary.totalOutflows.toDecimal()).toBe(25000);
      // Net: 78,500
      expect(result.value.summary.netCashflow.toDecimal()).toBe(78500);
      expect(result.value.summary.isNetPositive).toBe(true);
      expect(result.value.transactions).toHaveLength(3);
    }
  });
});

describe('RecordTransactionUseCase', () => {
  it('validates input parameters and rejects zero or negative amounts', async () => {
    const mockRepo: TransactionRepositoryPort = {
      listByUser: vi.fn(),
      createTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
    };

    const useCase = new RecordTransactionUseCase(mockRepo);

    // Reject missing user
    const resNoUser = await useCase.execute({
      userId: '',
      type: 'deposit',
      amountCents: 1000,
      currency: 'INR',
    });
    expect(resNoUser.success).toBe(false);

    // Reject non-positive amount
    const resNegative = await useCase.execute({
      userId: 'user-1',
      type: 'deposit',
      amountCents: 0,
      currency: 'INR',
    });
    expect(resNegative.success).toBe(false);

    // Reject invalid quantity
    const resInvalidQty = await useCase.execute({
      userId: 'user-1',
      type: 'buy',
      amountCents: 5000,
      quantity: -5,
      currency: 'INR',
    });
    expect(resInvalidQty.success).toBe(false);
  });
});
