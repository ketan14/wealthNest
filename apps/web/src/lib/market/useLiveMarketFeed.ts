import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketQuoteDto, MarketSessionDto, HoldingDetailDto } from '@wealthnest/application';
import { marketDataAdapter } from './market-data.adapter';

export interface UseLiveMarketFeedOptions {
  readonly holdings: readonly HoldingDetailDto[];
  readonly onQuotesUpdated?: (quotes: readonly MarketQuoteDto[]) => void;
  readonly defaultPolling?: boolean;
  readonly pollingIntervalMs?: number; // e.g. 30000ms (30s)
}

export interface UseLiveMarketFeedResult {
  readonly isPolling: boolean;
  readonly setIsPolling: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  readonly isRefreshing: boolean;
  readonly lastUpdated: Date | null;
  readonly session: MarketSessionDto;
  readonly quotes: Map<string, MarketQuoteDto>;
  readonly statusMessage: string | null;
  readonly refreshNow: () => Promise<readonly MarketQuoteDto[]>;
}

export function useLiveMarketFeed({
  holdings,
  onQuotesUpdated,
  defaultPolling = false,
  pollingIntervalMs = 30000,
}: UseLiveMarketFeedOptions): UseLiveMarketFeedResult {
  const [isPolling, setIsPolling] = useState<boolean>(defaultPolling);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Map<string, MarketQuoteDto>>(new Map());
  const [session, setSession] = useState<MarketSessionDto>(() =>
    marketDataAdapter.getMarketSession()
  );

  const onQuotesUpdatedRef = useRef(onQuotesUpdated);
  onQuotesUpdatedRef.current = onQuotesUpdated;

  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;

  // Manual or automatic refresh execution
  const refreshNow = useCallback(async (): Promise<readonly MarketQuoteDto[]> => {
    setIsRefreshing(true);
    try {
      const activeHoldings = holdingsRef.current;
      const res = await marketDataAdapter.refreshPortfolioQuotes(activeHoldings);

      // Refresh current session status
      const updatedSession = marketDataAdapter.getMarketSession();
      setSession(updatedSession);

      if (res.success) {
        const quoteList = res.value;
        const newMap = new Map<string, MarketQuoteDto>();

        let equityCount = 0;
        let mfCount = 0;

        for (const q of quoteList) {
          if (q.isin) newMap.set(q.isin, q);
          if (q.ticker) newMap.set(q.ticker, q);
          newMap.set(q.identifier, q);

          if (q.source === 'NSE' || q.source === 'BSE') equityCount++;
          if (q.source === 'AMFI') mfCount++;
        }

        setQuotes(newMap);
        const now = new Date();
        setLastUpdated(now);

        const msg = `Refreshed ${quoteList.length} securities (${equityCount} Stocks via NSE/BSE, ${mfCount} MFs via AMFI)`;
        setStatusMessage(msg);
        setTimeout(() => setStatusMessage((curr) => (curr === msg ? null : curr)), 5000);

        if (onQuotesUpdatedRef.current) {
          onQuotesUpdatedRef.current(quoteList);
        }

        return quoteList;
      }
      return [];
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Update session periodically every 60s
  useEffect(() => {
    const sessionTimer = setInterval(() => {
      setSession(marketDataAdapter.getMarketSession());
    }, 60000);

    return () => clearInterval(sessionTimer);
  }, []);

  // Track app foreground/background visibility to prevent mobile battery drain
  const [isDocumentVisible, setIsDocumentVisible] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState !== 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Background polling timer (pauses automatically when app/tab is hidden)
  useEffect(() => {
    if (!isPolling || !isDocumentVisible) return;

    // Run first refresh on enabling or returning to foreground
    void refreshNow();

    const pollTimer = setInterval(() => {
      void refreshNow();
    }, pollingIntervalMs);

    return () => clearInterval(pollTimer);
  }, [isPolling, isDocumentVisible, pollingIntervalMs, refreshNow]);

  return {
    isPolling,
    setIsPolling,
    isRefreshing,
    lastUpdated,
    session,
    quotes,
    statusMessage,
    refreshNow,
  };
}
