import { describe, it, expect, vi } from 'vitest';
import { ok, err } from '@wealthnest/shared';
import {
  ParseCasPdfUseCase,
  ConfirmCasImportUseCase,
  PdfExtractorPort,
  CasImportRepositoryPort,
  ImportCasItemDto,
  HoldingRepositoryPort,
  AddHoldingUseCase,
  GetPortfolioSummaryUseCase,
  DeleteHoldingUseCase,
} from '../index.js';

describe('Equities & Mutual Funds Separation in Application Layer', () => {
  it('parses CAS PDF into separated Equities/ETFs and Mutual Funds preview collections', async () => {
    const mockPages = [
      `Central Depository Services (India) Limited
       Statement as on : 30-Sep-2026

       EQUITY SHARES:
       ISIN INE002A01018 RELIANCE INDUSTRIES LTD 50 2500 125000
       ISIN INF209K01164 NIPPON INDIA NIFTY 50 BEES ETF 100 280 28000

       MUTUAL FUND UNITS HELD WITH MF/RTA
       Bandhan Mutual Fund
       D201 - Bandhan Large & Mid Cap Fund-Direct Plan-Growth
       ISIN : INF194K01V89 Folio No: 209928335/70
       Closing Balance 2268.239 NAV: 166.084 Market Value: 3,76,718.00`,
    ];

    const mockExtractor: PdfExtractorPort = {
      extractPages: vi.fn().mockResolvedValue(ok({ pages: mockPages, totalPageCount: 1 })),
    };

    const useCase = new ParseCasPdfUseCase(mockExtractor);
    const result = await useCase.execute(new ArrayBuffer(2048));

    expect(result.success).toBe(true);
    if (result.success) {
      const preview = result.value;

      // Check separated preview collections
      expect(preview.equities).toHaveLength(2);
      expect(preview.mutualFunds).toHaveLength(1);

      // Verify Equities details
      const reliance = preview.equities.find((e) => e.isin === 'INE002A01018')!;
      expect(reliance).toBeDefined();
      expect(reliance.assetClassId).toBe('equity');
      expect(reliance.ticker).toBe('RELIANCE');
      expect(reliance.instrumentType).toBe('equity_share');

      // Verify ETF classified as Equity with ETF instrument type
      const niftyBees = preview.equities.find((e) => e.isin === 'INF209K01164')!;
      expect(niftyBees).toBeDefined();
      expect(niftyBees.assetClassId).toBe('equity');
      expect(niftyBees.instrumentType).toBe('etf');

      // Verify Mutual Fund details
      const bandhanMf = preview.mutualFunds[0]!;
      expect(bandhanMf.isin).toBe('INF194K01V89');
      expect(bandhanMf.assetClassId).toBe('mutual_fund');
      expect(bandhanMf.instrumentType).toBe('mutual_fund_scheme');
      expect(bandhanMf.folioNumber).toBe('209928335/70');
      expect(bandhanMf.amcName).toBe('Bandhan Mutual Fund');
      expect(bandhanMf.schemePlan).toBe('Direct Plan - Growth');
      expect(bandhanMf.costBasisVerified).toBe(false);
    }
  });

  it('supports partial import by preserving independent selection between Equities and Mutual Funds', async () => {
    const mockRepo: CasImportRepositoryPort = {
      upsertHoldingsFromCas: vi.fn().mockResolvedValue(
        ok({
          batchId: 'batch-partial',
          total: 2,
          imported: 1,
          updated: 0,
          skipped: 1,
          failed: 0,
          equitiesImported: 1,
          equitiesUpdated: 0,
          mutualFundsImported: 0,
          mutualFundsUpdated: 0,
        })
      ),
    };

    const useCase = new ConfirmCasImportUseCase(mockRepo);

    const items: ImportCasItemDto[] = [
      {
        isin: 'INE002A01018',
        name: 'Reliance Industries',
        assetClassId: 'equity',
        quantity: 50,
        unitCostCents: 250000,
        currentValueCents: 12500000,
        currency: 'INR',
        selected: true, // Selected for import
      },
      {
        isin: 'INF194K01V89',
        name: 'Bandhan Large & Mid Cap Fund',
        assetClassId: 'mutual_fund',
        quantity: 2268.239,
        unitCostCents: 16608,
        currentValueCents: 37671800,
        currency: 'INR',
        folioNumber: '209928335/70',
        selected: false, // User deselected mutual funds tab
      },
    ];

    const result = await useCase.execute({
      userId: 'user-partial-test',
      provider: 'CDSL',
      statementDate: '2026-09-30',
      items,
    });

    expect(result.success).toBe(true);
    expect(mockRepo.upsertHoldingsFromCas).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-partial-test',
        items: [expect.objectContaining({ isin: 'INE002A01018' })],
      })
    );
  });

  it('preserves multi-folio holdings of the same scheme during import confirmation', async () => {
    const mockRepo: CasImportRepositoryPort = {
      upsertHoldingsFromCas: vi.fn().mockResolvedValue(
        ok({
          batchId: 'batch-multi-folio',
          total: 2,
          imported: 2,
          updated: 0,
          skipped: 0,
          failed: 0,
          mutualFundsImported: 2,
        })
      ),
    };

    const useCase = new ConfirmCasImportUseCase(mockRepo);

    const multiFolioItems: ImportCasItemDto[] = [
      {
        isin: 'INF194K01V89',
        name: 'Bandhan Large & Mid Cap Fund',
        assetClassId: 'mutual_fund',
        quantity: 1000,
        unitCostCents: 16608,
        currentValueCents: 16608000,
        currency: 'INR',
        folioNumber: 'FOLIO-A',
        amcName: 'Bandhan Mutual Fund',
        selected: true,
      },
      {
        isin: 'INF194K01V89',
        name: 'Bandhan Large & Mid Cap Fund',
        assetClassId: 'mutual_fund',
        quantity: 500,
        unitCostCents: 16608,
        currentValueCents: 8304000,
        currency: 'INR',
        folioNumber: 'FOLIO-B',
        amcName: 'Bandhan Mutual Fund',
        selected: true,
      },
    ];

    const result = await useCase.execute({
      userId: 'user-folio-test',
      provider: 'CDSL',
      statementDate: '2026-09-30',
      items: multiFolioItems,
    });

    expect(result.success).toBe(true);
    expect(mockRepo.upsertHoldingsFromCas).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ folioNumber: 'FOLIO-A' }),
          expect.objectContaining({ folioNumber: 'FOLIO-B' }),
        ]),
      })
    );
  });
});

describe('User Ownership & Security Boundaries', () => {
  it('enforces userId at application use case boundaries', async () => {
    const mockHoldingRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn().mockResolvedValue(ok([])),
      createHoldingWithAsset: vi.fn().mockResolvedValue(ok({} as any)),
      deleteHolding: vi.fn().mockResolvedValue(ok(undefined)),
    };

    // 1. Get Portfolio Summary requires valid userId
    const summaryUseCase = new GetPortfolioSummaryUseCase(mockHoldingRepo);
    await summaryUseCase.execute('user-tenant-1', 'INR');
    expect(mockHoldingRepo.listDetailsByUser).toHaveBeenCalledWith('user-tenant-1');

    // 2. Add Holding requires non-empty name and positive quantity
    const addUseCase = new AddHoldingUseCase(mockHoldingRepo);
    const invalidRes = await addUseCase.execute({
      userId: 'user-tenant-1',
      name: '',
      assetClassId: 'equity',
      currency: 'INR',
      quantity: 10,
      unitCostCents: 1000,
      currentValueCents: 10000,
    });
    expect(invalidRes.success).toBe(false);

    // 3. Delete Holding passes userId to prevent cross-tenant deletion
    const deleteUseCase = new DeleteHoldingUseCase(mockHoldingRepo);
    await deleteUseCase.execute('holding-123', 'user-tenant-1');
    expect(mockHoldingRepo.deleteHolding).toHaveBeenCalledWith('holding-123', 'user-tenant-1');
  });
});
