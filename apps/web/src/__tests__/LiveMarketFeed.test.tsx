import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { marketDataAdapter } from '../lib/market/market-data.adapter';
import { useLiveMarketFeed } from '../lib/market/useLiveMarketFeed';
import { HoldingDetailDto } from '@wealthnest/application';

const TEST_HOLDINGS: HoldingDetailDto[] = [
  {
    holdingId: 'h-rel',
    assetId: 'a-rel',
    name: 'Reliance Industries Ltd',
    ticker: 'RELIANCE',
    isin: 'INE002A01018',
    assetClassId: 'equity',
    assetClassName: 'Equities & Stocks',
    assetClassColor: '#3b82f6',
    quantity: 10,
    unitCostCents: 250000,
    currentValueCents: 2950000,
    currency: 'INR',
    updatedAt: '2026-10-24T00:00:00Z',
  },
  {
    holdingId: 'h-ppfas',
    assetId: 'a-ppfas',
    name: 'Parag Parikh Flexi Cap Fund',
    ticker: 'PPFAS-FLEXI',
    isin: 'INF879O01019',
    assetClassId: 'mutual_fund',
    assetClassName: 'Mutual Funds',
    assetClassColor: '#06b6d4',
    quantity: 100,
    unitCostCents: 5500,
    currentValueCents: 784500,
    currency: 'INR',
    updatedAt: '2026-10-24T00:00:00Z',
  },
];

describe('MarketDataAdapter & useLiveMarketFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('provides Indian market session status with IST timezone time', () => {
    const session = marketDataAdapter.getMarketSession();
    expect(session).toBeDefined();
    expect(['OPEN', 'CLOSED', 'PRE_MARKET', 'POST_MARKET', 'WEEKEND']).toContain(session.status);
    expect(session.istTimeString).toContain('IST');
  });

  it('fetches live equity CMP and mutual fund NAV with integer paise zero drift', async () => {
    const res = await marketDataAdapter.refreshPortfolioQuotes(TEST_HOLDINGS);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const quotes = res.value;
    expect(quotes.length).toBe(2);

    // Reliance equity quote
    const relQuote = quotes.find((q) => q.ticker === 'RELIANCE' || q.isin === 'INE002A01018');
    expect(relQuote).toBeDefined();
    expect(relQuote?.source).toBe('NSE');
    expect(relQuote?.priceCents).toBeGreaterThan(250000); // around ₹2,950

    // PPFAS Mutual Fund NAV
    const mfQuote = quotes.find((q) => q.isin === 'INF879O01019');
    expect(mfQuote).toBeDefined();
    expect(mfQuote?.source).toBe('AMFI');
    expect(mfQuote?.priceCents).toBe(7845); // ₹78.45
  });

  it('useLiveMarketFeed hook executes manual refresh and updates quotes map', async () => {
    const onUpdated = vi.fn();

    const { result } = renderHook(() =>
      useLiveMarketFeed({
        holdings: TEST_HOLDINGS,
        onQuotesUpdated: onUpdated,
        defaultPolling: false,
      })
    );

    expect(result.current.isPolling).toBe(false);
    expect(result.current.isRefreshing).toBe(false);

    // Trigger manual refresh
    await act(async () => {
      await result.current.refreshNow();
    });

    expect(onUpdated).toHaveBeenCalled();
    expect(result.current.quotes.size).toBeGreaterThanOrEqual(2);
    expect(result.current.statusMessage).toContain('Refreshed 2 securities');
    expect(result.current.statusMessage).toContain('Stocks via NSE/BSE');
    expect(result.current.statusMessage).toContain('MFs via AMFI');
  });

  it('useLiveMarketFeed supports auto-polling timer intervals', async () => {
    const onUpdated = vi.fn();

    const { result } = renderHook(() =>
      useLiveMarketFeed({
        holdings: TEST_HOLDINGS,
        onQuotesUpdated: onUpdated,
        defaultPolling: false,
        pollingIntervalMs: 5000,
      })
    );

    // Turn polling on
    act(() => {
      result.current.setIsPolling(true);
    });

    expect(result.current.isPolling).toBe(true);

    // Fast-forward initial poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(onUpdated).toHaveBeenCalledTimes(1);

    // Advance 5000ms to trigger next polling tick
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onUpdated).toHaveBeenCalledTimes(2);

    // Turn polling off
    act(() => {
      result.current.setIsPolling(false);
    });

    // Advance more time and verify no more calls
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(onUpdated).toHaveBeenCalledTimes(2);
  });
});
