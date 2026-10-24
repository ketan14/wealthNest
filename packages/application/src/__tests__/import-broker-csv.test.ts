import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import { ImportBrokerCsvUseCase } from '../use-cases/import-broker-csv.js';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';
import { TransactionRepositoryPort } from '../ports/transaction-repository.port.js';

describe('ImportBrokerCsvUseCase', () => {
  it('imports Zerodha holdings CSV assigning to member and demat account', async () => {
    const mockHoldingRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn(),
      createHoldingWithAsset: vi.fn().mockImplementation((params) =>
        Promise.resolve(
          ok({
            holdingId: 'h-new',
            assetId: 'a-new',
            name: params.name,
            ticker: params.ticker,
            isin: params.isin,
            assetClassId: params.assetClassId,
            assetClassName: 'Equities',
            assetClassColor: '#3b82f6',
            quantity: params.quantity,
            unitCostCents: params.unitCostCents,
            currentValueCents: params.currentValueCents,
            currency: 'INR',
            updatedAt: '2026-10-24T00:00:00Z',
            memberId: params.memberId,
            accountId: params.accountId,
          })
        )
      ),
      deleteHolding: vi.fn(),
    };

    const csvData = `
Instrument,Qty.,Avg. cost,LTP,Cur. val
RELIANCE,50,2500.00,2950.00,147500.00
TCS,30,3600.00,4150.00,124500.00
`;

    const useCase = new ImportBrokerCsvUseCase(mockHoldingRepo);
    const result = await useCase.execute({
      csvContent: csvData,
      userId: 'user-ketan',
      targetMemberId: 'mem-self',
      targetAccountId: 'acc-zerodha',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.provider).toBe('ZERODHA');
    expect(result.value.csvType).toBe('HOLDINGS');
    expect(result.value.totalParsed).toBe(2);
    expect(result.value.holdingsImported).toBe(2);

    expect(mockHoldingRepo.createHoldingWithAsset).toHaveBeenCalledTimes(2);
    expect(mockHoldingRepo.createHoldingWithAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: 'RELIANCE',
        memberId: 'mem-self',
        accountId: 'acc-zerodha',
        quantity: 50,
        unitCostCents: 250000,
      })
    );
  });

  it('imports Zerodha tradebook CSV into transactions audit ledger', async () => {
    const mockTxRepo: TransactionRepositoryPort = {
      listByUser: vi.fn(),
      createTransaction: vi.fn().mockImplementation((params) =>
        Promise.resolve(
          ok({
            id: 'tx-1',
            userId: params.userId,
            type: params.type,
            quantity: params.quantity,
            amountCents: params.amountCents,
            currency: params.currency,
            transactionDate: params.transactionDate || '2024-03-15',
            notes: params.notes,
            memberId: params.memberId,
            accountId: params.accountId,
            createdAt: '2026-10-24T00:00:00Z',
          })
        )
      ),
      deleteTransaction: vi.fn(),
    };

    const csvData = `
symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,trade_id,order_id
RELIANCE,INE002A01018,2024-03-15,NSE,EQ,EQ,buy,50,2500.00,123456,987654
`;

    const useCase = new ImportBrokerCsvUseCase(undefined, mockTxRepo);
    const result = await useCase.execute({
      csvContent: csvData,
      userId: 'user-ketan',
      targetMemberId: 'mem-self',
      targetAccountId: 'acc-zerodha',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.provider).toBe('ZERODHA');
    expect(result.value.csvType).toBe('TRADEBOOK');
    expect(result.value.tradesImported).toBe(1);

    expect(mockTxRepo.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'buy',
        quantity: 50,
        amountCents: 12500000, // 50 * ₹2500 = ₹1,25,000
        memberId: 'mem-self',
        accountId: 'acc-zerodha',
      })
    );
  });
});
