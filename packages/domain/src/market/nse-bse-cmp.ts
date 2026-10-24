/**
 * Indian Equity (NSE / BSE) Real-Time CMP (Current Market Price) Domain Logic
 * Handles trading session detection (IST), ticker normalisation, integer paise conversion,
 * and quote matching for Indian equities.
 */

export type Exchange = 'NSE' | 'BSE';

export type TradingSessionStatus =
  | 'PRE_MARKET'   // 09:00 - 09:15 IST
  | 'OPEN'         // 09:15 - 15:30 IST (Regular trading session)
  | 'POST_MARKET'  // 15:30 - 16:00 IST
  | 'CLOSED'       // 16:00 - 09:00 IST
  | 'WEEKEND';     // Saturday & Sunday

export interface MarketSessionInfo {
  readonly status: TradingSessionStatus;
  readonly isOpen: boolean;
  readonly description: string;
  readonly istTimeString: string;
}

export interface StockCmpRecord {
  readonly symbol: string;          // e.g. 'RELIANCE', 'TCS'
  readonly exchange: Exchange;       // 'NSE' | 'BSE'
  readonly isin?: string;            // e.g. 'INE002A01018'
  readonly companyName?: string;
  readonly cmp: number;              // in ₹ Rupees, e.g. 2950.45
  readonly cmpPaise: bigint;         // Zero Floating-Point Drift: integer paise
  readonly previousClose: number;    // in ₹ Rupees
  readonly previousClosePaise: bigint;
  readonly dayHigh?: number;
  readonly dayLow?: number;
  readonly change: number;           // ₹ delta
  readonly changePercent: number;    // % delta
  readonly volume?: number;
  readonly asOfDate: string;         // ISO string or YYYY-MM-DD
  readonly isLive: boolean;
}

/**
 * Calculates current Indian Market session status based on IST (UTC+5:30)
 */
export function getIndianMarketSession(currentDate: Date = new Date()): MarketSessionInfo {
  // Convert to Indian Standard Time (UTC + 5 hours 30 minutes)
  const utcTime = currentDate.getTime() + currentDate.getTimezoneOffset() * 60000;
  const istOffsetMs = 5.5 * 60 * 60000;
  const istDate = new Date(utcTime + istOffsetMs);

  const dayOfWeek = istDate.getUTCDay(); // 0 is Sunday, 6 is Saturday
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;

  const istTimeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} IST`;

  // Weekend: Saturday (6) or Sunday (0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      status: 'WEEKEND',
      isOpen: false,
      description: 'Markets Closed (Weekend)',
      istTimeString,
    };
  }

  // Pre-market: 09:00 to 09:15 (540 to 555 mins)
  if (totalMinutes >= 540 && totalMinutes < 555) {
    return {
      status: 'PRE_MARKET',
      isOpen: false,
      description: 'Pre-Market Session (09:00 - 09:15 IST)',
      istTimeString,
    };
  }

  // Regular Trading Session: 09:15 to 15:30 (555 to 930 mins)
  if (totalMinutes >= 555 && totalMinutes < 930) {
    return {
      status: 'OPEN',
      isOpen: true,
      description: 'Live Market Open (09:15 - 15:30 IST)',
      istTimeString,
    };
  }

  // Post-market: 15:30 to 16:00 (930 to 960 mins)
  if (totalMinutes >= 930 && totalMinutes < 960) {
    return {
      status: 'POST_MARKET',
      isOpen: false,
      description: 'Post-Market Closing (15:30 - 16:00 IST)',
      istTimeString,
    };
  }

  return {
    status: 'CLOSED',
    isOpen: false,
    description: 'Markets Closed (Opens 09:15 IST)',
    istTimeString,
  };
}

/**
 * Standardizes raw ticker symbols to standard exchange formats.
 * e.g. "RELIANCE", "RELIANCE.NS", "NSE:RELIANCE" -> symbol: "RELIANCE", exchange: "NSE"
 */
export function normalizeIndianTicker(raw: string): {
  symbol: string;
  exchange: Exchange;
  querySymbol: string;
} {
  const cleaned = (raw || '').trim().toUpperCase();

  if (cleaned.endsWith('.BO') || cleaned.startsWith('BSE:')) {
    const symbol = cleaned.replace(/^BSE:/, '').replace(/\.BO$/, '');
    return { symbol, exchange: 'BSE', querySymbol: `${symbol}.BO` };
  }

  const symbol = cleaned.replace(/^NSE:/, '').replace(/\.NS$/, '');
  return { symbol, exchange: 'NSE', querySymbol: `${symbol}.NS` };
}

/**
 * Creates a validated StockCmpRecord with zero floating-point drift (integer paise).
 */
export function createStockCmpRecord(params: {
  symbol: string;
  exchange?: Exchange;
  isin?: string;
  companyName?: string;
  cmp: number;
  previousClose: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  asOfDate?: string;
  isLive?: boolean;
}): StockCmpRecord {
  const symbol = params.symbol.toUpperCase();
  const exchange = params.exchange || 'NSE';
  const cmp = Math.max(0, params.cmp);
  const previousClose = Math.max(0, params.previousClose);
  const cmpPaise = BigInt(Math.round(cmp * 100));
  const previousClosePaise = BigInt(Math.round(previousClose * 100));

  const change = +(cmp - previousClose).toFixed(2);
  const changePercent = previousClose > 0 ? +((change / previousClose) * 100).toFixed(2) : 0;

  return {
    symbol,
    exchange,
    isin: params.isin,
    companyName: params.companyName,
    cmp,
    cmpPaise,
    previousClose,
    previousClosePaise,
    dayHigh: params.dayHigh,
    dayLow: params.dayLow,
    change,
    changePercent,
    volume: params.volume,
    asOfDate: params.asOfDate || new Date().toISOString(),
    isLive: params.isLive ?? true,
  };
}

/**
 * Parses raw JSON quote object (e.g. from Yahoo Finance chart / quote API).
 */
export function parseYahooQuoteJson(json: any): StockCmpRecord | null {
  try {
    const result = json?.chart?.result?.[0] || json?.quoteResponse?.result?.[0];
    if (!result) return null;

    const meta = result.meta || result;
    const rawSymbol: string = meta.symbol || '';
    const { symbol, exchange } = normalizeIndianTicker(rawSymbol);

    const cmp = Number(meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0);
    const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? cmp);

    if (cmp <= 0) return null;

    return createStockCmpRecord({
      symbol,
      exchange,
      companyName: meta.shortName || meta.longName || symbol,
      cmp,
      previousClose,
      dayHigh: meta.regularMarketDayHigh ? Number(meta.regularMarketDayHigh) : undefined,
      dayLow: meta.regularMarketDayLow ? Number(meta.regularMarketDayLow) : undefined,
      volume: meta.regularMarketVolume ? Number(meta.regularMarketVolume) : undefined,
      asOfDate: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
      isLive: true,
    });
  } catch {
    return null;
  }
}

/**
 * High-performance lookup helper matching by ISIN first, then Ticker Symbol.
 */
export function matchHoldingToStockCmp(
  lookupMap: Map<string, StockCmpRecord>,
  identifier: { isin?: string; ticker?: string; symbol?: string }
): StockCmpRecord | null {
  if (identifier.isin && lookupMap.has(identifier.isin)) {
    return lookupMap.get(identifier.isin)!;
  }
  if (identifier.ticker) {
    const norm = normalizeIndianTicker(identifier.ticker).symbol;
    if (lookupMap.has(norm)) return lookupMap.get(norm)!;
    if (lookupMap.has(identifier.ticker)) return lookupMap.get(identifier.ticker)!;
  }
  if (identifier.symbol) {
    const norm = normalizeIndianTicker(identifier.symbol).symbol;
    if (lookupMap.has(norm)) return lookupMap.get(norm)!;
    if (lookupMap.has(identifier.symbol)) return lookupMap.get(identifier.symbol)!;
  }
  return null;
}
