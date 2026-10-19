import { describe, it, expect, vi } from 'vitest';
import { ok, err } from '@wealthnest/shared';
import {
  ParseCasPdfUseCase,
  ConfirmCasImportUseCase,
  PdfExtractorPort,
  CasImportRepositoryPort,
} from '../index.js';

describe('ParseCasPdfUseCase', () => {
  it('rejects empty PDF buffer', async () => {
    const mockExtractor: PdfExtractorPort = {
      extractPages: vi.fn(),
    };

    const useCase = new ParseCasPdfUseCase(mockExtractor);
    const result = await useCase.execute(new ArrayBuffer(0));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('empty');
    }
  });

  it('handles password requirement error gracefully', async () => {
    const mockExtractor: PdfExtractorPort = {
      extractPages: vi.fn().mockResolvedValue(err(new Error('Password required to decrypt document'))),
    };

    const useCase = new ParseCasPdfUseCase(mockExtractor);
    const result = await useCase.execute(new ArrayBuffer(1024));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('password protected');
    }
  });

  it('retries with uppercase password when lowercase password fails decryption', async () => {
    const mockExtractor: PdfExtractorPort = {
      extractPages: vi.fn().mockImplementation((_buf, pass) => {
        if (pass === 'ABCDE1234F01011990') {
          return Promise.resolve(
            ok({
              pages: [
                `Central Depository Services (India) Limited
                 Statement as on : 31-Mar-2026
                 EQUITY SHARES:
                 ISIN INE002A01018 RELIANCE INDUSTRIES LTD 50 2500 125000`,
              ],
              totalPageCount: 1,
            })
          );
        }
        return Promise.resolve(err(new Error('Password required to decrypt document')));
      }),
    };

    const useCase = new ParseCasPdfUseCase(mockExtractor);
    // User passed lowercase password with leading/trailing spaces
    const result = await useCase.execute(new ArrayBuffer(1024), '  abcde1234f01011990  ');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.provider).toBe('CDSL');
      expect(result.value.items).toHaveLength(1);
    }
  });

  it('extracts CDSL statement and maps to preview DTO', async () => {
    const mockPages = [
      `Central Depository Services (India) Limited
       Statement as on : 31-Mar-2026
       EQUITY SHARES:
       ISIN INE002A01018 RELIANCE INDUSTRIES LTD 50 2500 125000`,
    ];

    const mockExtractor: PdfExtractorPort = {
      extractPages: vi.fn().mockResolvedValue(ok({ pages: mockPages, totalPageCount: 1 })),
    };

    const useCase = new ParseCasPdfUseCase(mockExtractor);
    const result = await useCase.execute(new ArrayBuffer(2048), 'MOCKPASS');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.provider).toBe('CDSL');
      expect(result.value.statementDate).toBe('2026-03-31');
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0]!.isin).toBe('INE002A01018');
      expect(result.value.items[0]!.name).toBe('RELIANCE INDUSTRIES LTD');
      expect(result.value.items[0]!.ticker).toBe('RELIANCE');
      expect(result.value.items[0]!.quantity).toBe(50);
      expect(result.value.items[0]!.currentValueCents).toBe(12500000);
      expect(result.value.items[0]!.selected).toBe(true);
    }
  });
});

describe('ConfirmCasImportUseCase', () => {
  it('validates user ID presence', async () => {
    const mockRepo: CasImportRepositoryPort = {
      upsertHoldingsFromCas: vi.fn(),
    };

    const useCase = new ConfirmCasImportUseCase(mockRepo);
    const result = await useCase.execute({
      userId: '',
      provider: 'CDSL',
      statementDate: '2026-03-31',
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it('filters unselected items and calls upsert repository', async () => {
    const mockRepo: CasImportRepositoryPort = {
      upsertHoldingsFromCas: vi.fn().mockResolvedValue(
        ok({
          batchId: 'batch-1',
          total: 2,
          imported: 1,
          updated: 0,
          skipped: 1,
          failed: 0,
        })
      ),
    };

    const useCase = new ConfirmCasImportUseCase(mockRepo);
    const result = await useCase.execute({
      userId: 'user-qa',
      provider: 'CDSL',
      statementDate: '2026-03-31',
      items: [
        {
          isin: 'INE002A01018',
          name: 'Reliance',
          assetClassId: 'equity',
          quantity: 10,
          unitCostCents: 250000,
          currentValueCents: 2500000,
          currency: 'INR',
          selected: true,
        },
        {
          isin: 'INE467B01029',
          name: 'TCS',
          assetClassId: 'equity',
          quantity: 5,
          unitCostCents: 350000,
          currentValueCents: 1750000,
          currency: 'INR',
          selected: false, // Deselected by user
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockRepo.upsertHoldingsFromCas).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-qa',
        items: [expect.objectContaining({ isin: 'INE002A01018' })],
      })
    );
  });

  it('filters selected transactions and passes them to repository', async () => {
    const mockRepo: CasImportRepositoryPort = {
      upsertHoldingsFromCas: vi.fn().mockResolvedValue(
        ok({
          batchId: 'batch-2',
          total: 1,
          imported: 1,
          updated: 0,
          skipped: 0,
          failed: 0,
          transactionsImported: 1,
        })
      ),
    };

    const useCase = new ConfirmCasImportUseCase(mockRepo);
    const result = await useCase.execute({
      userId: 'user-qa',
      provider: 'CDSL',
      statementDate: '2026-09-30',
      items: [],
      transactions: [
        {
          isin: 'INF194K01V89',
          schemeName: 'Bandhan Large & Mid Cap Fund',
          date: '2026-09-21',
          description: 'Redemption',
          type: 'sell',
          amountCents: 7000000,
          units: 421.478,
          currency: 'INR',
          selected: true,
        },
        {
          isin: 'INF194K01524',
          schemeName: 'Bandhan Large & Mid Cap Fund Regular',
          date: '2026-09-01',
          description: 'SIP',
          type: 'buy',
          amountCents: 199990,
          units: 14.104,
          currency: 'INR',
          selected: false, // Deselected
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockRepo.upsertHoldingsFromCas).toHaveBeenCalledWith(
      expect.objectContaining({
        transactions: [expect.objectContaining({ isin: 'INF194K01V89', type: 'sell' })],
      })
    );
  });
});
