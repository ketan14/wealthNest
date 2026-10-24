import { describe, it, expect, vi } from 'vitest';
import { ok } from '@wealthnest/shared';
import { RefreshMarketQuotesUseCase } from '../use-cases/refresh-market-quotes.js';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';
import { MarketDataPort } from '../ports/market-data.port.js';

describe('RefreshMarketQuotesUseCase', () => {
  it('fetches latest quotes for portfolio holdings from market data port', async () => {
    const mockRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn().mockResolvedValue(
        ok([
          {
            holdingId: 'h-1',
            assetId: 'a-1',
            name: 'Parag Parikh Flexi Cap Fund',
            ticker: 'PPFAS-FLEXI',
            isin: 'INF879O01019',
            assetClassId: 'mutual_fund',
            assetClassName: 'Mutual Funds',
            assetClassColor: '#06b6d4',
            quantity: 1500,
            unitCostCents: 5500,
            currentValueCents: 11000000,
            currency: 'INR',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ])
      ),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
    };

    const mockMarketPort: MarketDataPort = {
      getQuote: vi.fn(),
      refreshPortfolioQuotes: vi.fn().mockResolvedValue(
        ok([
          {
            identifier: 'INF879O01019',
            name: 'Parag Parikh Flexi Cap Fund - Direct Growth',
            isin: 'INF879O01019',
            priceCents: 7845, // ₹78.45
            changePercent: 1.25,
            asOfDate: '2026-10-22',
            source: 'AMFI',
          },
        ])
      ),
    };

    const useCase = new RefreshMarketQuotesUseCase(mockRepo, mockMarketPort);
    const result = await useCase.execute('user-1');

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.totalUpdatedHoldings).toBe(1);
    expect(result.value.quotes[0]?.priceCents).toBe(7845);
    expect(result.value.quotes[0]?.source).toBe('AMFI');
    expect(result.value.mutualFundsCount).toBe(1);
    expect(result.value.equitiesCount).toBe(0);
  });

  it('correctly aggregates multi-asset quotes across both NSE equities and AMFI mutual funds with session info', async () => {
    const mockRepo: HoldingRepositoryPort = {
      listDetailsByUser: vi.fn().mockResolvedValue(
        ok([
          {
            holdingId: 'h-eq',
            assetId: 'a-eq',
            name: 'Reliance Industries Ltd',
            ticker: 'RELIANCE',
            isin: 'INE002A01018',
            assetClassId: 'equity',
            assetClassName: 'Equities',
            quantity: 50,
            unitCostCents: 250000,
            currentValueCents: 14750000,
            currency: 'INR',
            updatedAt: '2026-01-01T00:00:00Z',
          },
          {
            holdingId: 'h-mf',
            assetId: 'a-mf',
            name: 'Parag Parikh Flexi Cap Fund',
            isin: 'INF879O01019',
            assetClassId: 'mutual_fund',
            assetClassName: 'Mutual Funds',
            quantity: 1000,
            unitCostCents: 5000,
            currentValueCents: 7845000,
            currency: 'INR',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ])
      ),
      createHoldingWithAsset: vi.fn(),
      deleteHolding: vi.fn(),
    };

    const mockMarketPort: MarketDataPort = {
      getQuote: vi.fn(),
      refreshPortfolioQuotes: vi.fn().mockResolvedValue(
        ok([
          {
            identifier: 'INE002A01018',
            ticker: 'RELIANCE',
            name: 'Reliance Industries Ltd',
            isin: 'INE002A01018',
            priceCents: 295000, // ₹2,950.00
            changePercent: 1.45,
            asOfDate: '2026-10-24',
            source: 'NSE',
            isLive: true,
          },
          {
            identifier: 'INF879O01019',
            name: 'Parag Parikh Flexi Cap Fund',
            isin: 'INF879O01019',
            priceCents: 7845,
            changePercent: 0.85,
            asOfDate: '2026-10-24',
            source: 'AMFI',
          },
        ])
      ),
      getMarketSession: vi.fn().mockReturnValue({
        isOpen: true,
        status: 'OPEN',
        description: 'Live Market Open',
        istTimeString: '11:00 IST',
      }),
    };

    const useCase = new RefreshMarketQuotesUseCase(mockRepo, mockMarketPort);
    const result = await useCase.execute('user-1');

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.totalUpdatedHoldings).toBe(2);
    expect(result.value.equitiesCount).toBe(1);
    expect(result.value.mutualFundsCount).toBe(1);
    expect(result.value.marketSession?.isOpen).toBe(true);
    expect(result.value.marketSession?.status).toBe('OPEN');
  });
});
