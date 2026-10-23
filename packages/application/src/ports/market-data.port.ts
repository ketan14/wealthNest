import { Result } from '@wealthnest/shared';
import { HoldingDetailDto } from './holding-repository.port.js';

export interface MarketQuoteDto {
  readonly identifier: string; // Ticker or ISIN or Scheme Code
  readonly name?: string;
  readonly isin?: string;
  readonly priceCents: number; // Stored as integer paise
  readonly changePercent: number; // e.g. +1.42
  readonly asOfDate: string;
  readonly source: 'AMFI' | 'NSE' | 'BSE' | 'FEED';
}

export interface MarketDataPort {
  getQuote(identifier: string): Promise<Result<MarketQuoteDto | null>>;
  refreshPortfolioQuotes(
    holdings: readonly HoldingDetailDto[]
  ): Promise<Result<readonly MarketQuoteDto[]>>;
}
