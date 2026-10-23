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

  it('synchronizes holding units and updates cost basis on Buy trade', async () => {
    const mockTxRepo: TransactionRepositoryPort = {
      listByUser: vi.fn(),
      createTransaction: vi.fn().mockImplementation((p) =>
        Promise.resolve(
          ok({
            id: 'tx-created-1',
            createdAt: '2026-04-10T00:00:00Z',
            ...p,
          })
        )
      ),
      deleteTransaction: vi.fn(),
    };

    const mockHoldingRepo = {
      listDetailsByUser: vi.fn().mockResolvedValue(
        ok([
          {
            holdingId: 'hold-1',
            assetId: 'asset-1',
            name: 'Reliance Industries Ltd',
            assetClassId: 'equity',
            assetClassName: 'Equity',
            assetClassColor: '#3b82f6',
            quantity: 10,
            unitCostCents: 250000, // ₹2,500
            currentValueCents: 2500000,
            currency: 'INR',
            updatedAt: '2026-04-01T00:00:00Z',
          },
        ])
      ),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
      updateHoldingValues: vi.fn().mockResolvedValue(ok(undefined)),
    };

    const useCase = new RecordTransactionUseCase(mockTxRepo, mockHoldingRepo);

    const result = await useCase.execute({
      userId: 'user-1',
      assetId: 'asset-1',
      type: 'buy',
      quantity: 5,
      amountCents: 1400000, // ₹14,000 (unit ₹2,800)
      currency: 'INR',
    });

    expect(result.success).toBe(true);
    expect(mockHoldingRepo.updateHoldingValues).toHaveBeenCalledWith({
      holdingId: 'hold-1',
      userId: 'user-1',
      quantity: 15,
      unitCostCents: 260000, // (25000 + 14000) / 15 = 2600
      currentValueCents: 4200000,
    });
  });

  it('calculates realized capital gain and appends audit tag to notes on Sell trade', async () => {
    let capturedParams: any = null;
    const mockTxRepo: TransactionRepositoryPort = {
      listByUser: vi.fn(),
      createTransaction: vi.fn().mockImplementation((p) => {
        capturedParams = p;
        return Promise.resolve(
          ok({
            id: 'tx-created-2',
            createdAt: '2026-04-10T00:00:00Z',
            ...p,
          })
        );
      }),
      deleteTransaction: vi.fn(),
    };

    const mockHoldingRepo = {
      listDetailsByUser: vi.fn().mockResolvedValue(
        ok([
          {
            holdingId: 'hold-1',
            assetId: 'asset-1',
            name: 'Reliance Industries Ltd',
            assetClassId: 'equity',
            assetClassName: 'Equity',
            assetClassColor: '#3b82f6',
            quantity: 10,
            unitCostCents: 250000, // ₹2,500
            currentValueCents: 2500000,
            currency: 'INR',
            updatedAt: '2026-04-01T00:00:00Z',
          },
        ])
      ),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
      updateHoldingValues: vi.fn().mockResolvedValue(ok(undefined)),
    };

    const useCase = new RecordTransactionUseCase(mockTxRepo, mockHoldingRepo);

    // Sell 4 shares at ₹3,000 (total ₹12,000 = 1,200,000 paise)
    // Cost basis of 4 shares = 4 * 2500 = ₹10,000 = 1,000,000 paise
    // Realized Gain = ₹2,000
    const result = await useCase.execute({
      userId: 'user-1',
      assetId: 'asset-1',
      type: 'sell',
      quantity: 4,
      amountCents: 1200000,
      currency: 'INR',
      notes: 'Profit booking',
    });

    expect(result.success).toBe(true);
    expect(mockHoldingRepo.updateHoldingValues).toHaveBeenCalledWith({
      holdingId: 'hold-1',
      userId: 'user-1',
      quantity: 6,
      unitCostCents: 250000,
      currentValueCents: 1500000,
    });

    expect(capturedParams.notes).toContain('Profit booking');
    expect(capturedParams.notes).toContain('Realized Gain: ₹2,000.00');
  });
});

