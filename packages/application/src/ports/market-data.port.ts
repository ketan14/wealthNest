import { Result } from '@wealthnest/shared';
import { HoldingDetailDto } from './holding-repository.port.js';

export interface MarketQuoteDto {
  readonly identifier: string; // Ticker or ISIN or Scheme Code
  readonly name?: string;
  readonly ticker?: string;
  readonly isin?: string;
  readonly priceCents: number; // Stored as integer paise (Zero Floating-Point Drift)
  readonly previousCloseCents?: number;
  readonly changePercent: number; // e.g. +1.42
  readonly changePaise?: number; // integer paise
  readonly dayHighCents?: number;
  readonly dayLowCents?: number;
  readonly volume?: number;
  readonly asOfDate: string;
  readonly source: 'AMFI' | 'NSE' | 'BSE' | 'FEED';
  readonly isLive?: boolean;
}

export interface MarketSessionDto {
  readonly isOpen: boolean;
  readonly status: 'PRE_MARKET' | 'OPEN' | 'POST_MARKET' | 'CLOSED' | 'WEEKEND';
  readonly description: string;
  readonly istTimeString: string;
}

export interface MarketDataPort {
  getQuote(identifier: string): Promise<Result<MarketQuoteDto | null>>;
  refreshPortfolioQuotes(
    holdings: readonly HoldingDetailDto[]
  ): Promise<Result<readonly MarketQuoteDto[]>>;
  getMarketSession?(): MarketSessionDto;
}
