import { Money } from '../money/money.js';

export type BrokerProvider = 'ZERODHA' | 'GROWW' | 'GENERIC_CSV';

export type BrokerCsvType = 'HOLDINGS' | 'TRADEBOOK';

export interface ParsedBrokerHolding {
  readonly symbol: string;          // e.g. 'RELIANCE', 'TCS'
  readonly isin?: string;            // e.g. 'INE002A01018'
  readonly name: string;             // e.g. 'Reliance Industries Ltd'
  readonly quantity: number;
  readonly unitCost: Money;          // Integer paise
  readonly currentPrice?: Money;     // Integer paise
  readonly currentValue?: Money;     // Integer paise
  readonly assetType: 'equity' | 'mutual_fund' | 'commodity' | 'other';
  readonly rawBroker: BrokerProvider;
}

export interface ParsedBrokerTrade {
  readonly symbol: string;
  readonly isin?: string;
  readonly name: string;
  readonly tradeDate: string;        // YYYY-MM-DD
  readonly tradeType: 'BUY' | 'SELL';
  readonly quantity: number;
  readonly price: Money;             // Integer paise
  readonly totalAmount: Money;       // Integer paise
  readonly tradeId?: string;
  readonly orderId?: string;
  readonly exchange?: 'NSE' | 'BSE';
  readonly rawBroker: BrokerProvider;
}

export interface ParsedBrokerCsvResult {
  readonly provider: BrokerProvider;
  readonly csvType: BrokerCsvType;
  readonly holdings: readonly ParsedBrokerHolding[];
  readonly trades: readonly ParsedBrokerTrade[];
  readonly totalRecords: number;
  readonly warnings: readonly string[];
}
