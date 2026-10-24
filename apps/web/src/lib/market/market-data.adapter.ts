import { Result, ok, err } from '@wealthnest/shared';
import {
  MarketDataPort,
  MarketQuoteDto,
  MarketSessionDto,
  HoldingDetailDto,
} from '@wealthnest/application';
import {
  getIndianMarketSession,
  normalizeIndianTicker,
} from '@wealthnest/domain';

export interface SecurityBaseline {
  readonly symbol: string;
  readonly name: string;
  readonly isin?: string;
  readonly baselinePaise: bigint;
  readonly previousClosePaise: bigint;
  readonly dayHighPaise?: bigint;
  readonly dayLowPaise?: bigint;
  readonly source: 'AMFI' | 'NSE' | 'BSE';
  readonly assetClass: 'equity' | 'mutual_fund' | 'commodity' | 'fixed_income';
}

// Prominent Indian securities baseline with official ISINs & Tickers
const INDIAN_SECURITIES: readonly SecurityBaseline[] = [
  // Equities (NSE)
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    isin: 'INE002A01018',
    baselinePaise: 295000n, // ₹2,950.00
    previousClosePaise: 291200n,
    dayHighPaise: 296500n,
    dayLowPaise: 290500n,
    source: 'NSE',
    assetClass: 'equity',
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd',
    isin: 'INE467B01029',
    baselinePaise: 415000n, // ₹4,150.00
    previousClosePaise: 411000n,
    dayHighPaise: 417500n,
    dayLowPaise: 409800n,
    source: 'NSE',
    assetClass: 'equity',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    isin: 'INE040A01034',
    baselinePaise: 168000n, // ₹1,680.00
    previousClosePaise: 166500n,
    dayHighPaise: 169200n,
    dayLowPaise: 166000n,
    source: 'NSE',
    assetClass: 'equity',
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    isin: 'INE009A01021',
    baselinePaise: 192000n, // ₹1,920.00
    previousClosePaise: 189500n,
    dayHighPaise: 193500n,
    dayLowPaise: 189000n,
    source: 'NSE',
    assetClass: 'equity',
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    isin: 'INE155A01022',
    baselinePaise: 98500n, // ₹985.00
    previousClosePaise: 97200n,
    dayHighPaise: 99400n,
    dayLowPaise: 96800n,
    source: 'NSE',
    assetClass: 'equity',
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    isin: 'INE062A01020',
    baselinePaise: 82500n, // ₹825.00
    previousClosePaise: 81800n,
    dayHighPaise: 83100n,
    dayLowPaise: 81500n,
    source: 'NSE',
    assetClass: 'equity',
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    isin: 'INE090A01021',
    baselinePaise: 124500n, // ₹1,245.00
    previousClosePaise: 123000n,
    dayHighPaise: 125500n,
    dayLowPaise: 122800n,
    source: 'NSE',
    assetClass: 'equity',
  },
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd',
    isin: 'INE397D01024',
    baselinePaise: 169000n, // ₹1,690.00
    previousClosePaise: 167500n,
    dayHighPaise: 170500n,
    dayLowPaise: 167000n,
    source: 'NSE',
    assetClass: 'equity',
  },

  // Sovereign Gold Bonds & Commodities
  {
    symbol: 'SGB-2028',
    name: 'Sovereign Gold Bond 2028',
    isin: 'IN0020180017',
    baselinePaise: 745000n, // ₹7,450.00 per gram
    previousClosePaise: 738000n,
    dayHighPaise: 748000n,
    dayLowPaise: 737000n,
    source: 'NSE',
    assetClass: 'commodity',
  },

  // Mutual Funds (AMFI Daily NAVs)
  {
    symbol: 'PPFAS-FLEXI',
    name: 'Parag Parikh Flexi Cap Direct Growth',
    isin: 'INF879O01019',
    baselinePaise: 7845n, // ₹78.45
    previousClosePaise: 7780n,
    source: 'AMFI',
    assetClass: 'mutual_fund',
  },
  {
    symbol: 'BANDHAN-LM',
    name: 'Bandhan Large & Mid Cap Direct Growth',
    isin: 'INF194K01V89',
    baselinePaise: 16610n, // ₹166.10
    previousClosePaise: 16480n,
    source: 'AMFI',
    assetClass: 'mutual_fund',
  },
  {
    symbol: 'SBI-BLUECHIP',
    name: 'SBI Bluechip Fund Direct Growth',
    isin: 'INF200K01TS4',
    baselinePaise: 9214n, // ₹92.14
    previousClosePaise: 9140n,
    source: 'AMFI',
    assetClass: 'mutual_fund',
  },
  {
    symbol: 'ICICI-VALUEDISC',
    name: 'ICICI Prudential Value Discovery Direct Growth',
    isin: 'INF109K012R6',
    baselinePaise: 41025n, // ₹410.25
    previousClosePaise: 40750n,
    source: 'AMFI',
    assetClass: 'mutual_fund',
  },
  {
    symbol: 'MIRAE-LARGECAP',
    name: 'Mirae Asset Large Cap Fund Direct Growth',
    isin: 'INF767K01085',
    baselinePaise: 11560n, // ₹115.60
    previousClosePaise: 11480n,
    source: 'AMFI',
    assetClass: 'mutual_fund',
  },
  {
    symbol: 'HDFC-MIDCAP',
    name: 'HDFC Mid-Cap Opportunities Fund Direct Growth',
    isin: 'INF179K01BE2',
    baselinePaise: 18420n, // ₹184.20
    previousClosePaise: 18260n,
    source: 'AMFI',
    assetClass: 'mutual_fund',
  },
  {
    symbol: 'NIPPON-SMALLCAP',
    name: 'Nippon India Small Cap Fund Direct Growth',
    isin: 'INF209K01168',
    baselinePaise: 17230n, // ₹172.30
    previousClosePaise: 17090n,
    source: 'AMFI',
    assetClass: 'mutual_fund',
  },
];

// In-memory lookup tables
const BY_ISIN = new Map<string, SecurityBaseline>();
const BY_SYMBOL = new Map<string, SecurityBaseline>();

for (const sec of INDIAN_SECURITIES) {
  if (sec.isin) BY_ISIN.set(sec.isin.toUpperCase(), sec);
  BY_SYMBOL.set(sec.symbol.toUpperCase(), sec);
}

// In-memory quote cache with timestamp
interface CachedQuote {
  readonly quote: MarketQuoteDto;
  readonly timestamp: number;
}
const quoteCache = new Map<string, CachedQuote>();
const CACHE_TTL_MS = 15000; // 15 seconds cache

export class MarketDataAdapter implements MarketDataPort {
  getMarketSession(): MarketSessionDto {
    const session = getIndianMarketSession();
    return {
      isOpen: session.isOpen,
      status: session.status,
      description: session.description,
      istTimeString: session.istTimeString,
    };
  }

  /**
   * Resolves a security baseline from ISIN, Ticker symbol, or Raw identifier
   */
  private findBaseline(identifier: string): SecurityBaseline | undefined {
    const cleaned = identifier.trim().toUpperCase();
    if (BY_ISIN.has(cleaned)) return BY_ISIN.get(cleaned);

    const norm = normalizeIndianTicker(cleaned).symbol;
    if (BY_SYMBOL.has(norm)) return BY_SYMBOL.get(norm);
    if (BY_SYMBOL.has(cleaned)) return BY_SYMBOL.get(cleaned);

    return undefined;
  }

  /**
   * Generates a live quote with simulated realistic market tick movements
   * during open market hours, or official closing prices when closed.
   */
  private generateQuote(baseline: SecurityBaseline): MarketQuoteDto {
    const session = this.getMarketSession();
    const isEquityOrCommodity = baseline.source === 'NSE' || baseline.source === 'BSE';

    let currentPricePaise = baseline.baselinePaise;
    let dayHighPaise = baseline.dayHighPaise ?? baseline.baselinePaise;
    let dayLowPaise = baseline.dayLowPaise ?? baseline.baselinePaise;

    // During live market session, simulate realistic tick movement (+/- 0.35%)
    if (session.isOpen && isEquityOrCommodity) {
      // Random tick between -0.4% and +0.6%
      const tickFactor = 1 + (Math.random() * 0.01 - 0.004);
      const tickedPrice = Math.round(Number(baseline.baselinePaise) * tickFactor);
      currentPricePaise = BigInt(Math.max(1, tickedPrice));

      if (currentPricePaise > dayHighPaise) dayHighPaise = currentPricePaise;
      if (currentPricePaise < dayLowPaise) dayLowPaise = currentPricePaise;
    }

    const previousClosePaise = baseline.previousClosePaise;
    const changePaise = Number(currentPricePaise - previousClosePaise);
    const changePercent =
      previousClosePaise > 0n
        ? +((changePaise / Number(previousClosePaise)) * 100).toFixed(2)
        : 0;

    return {
      identifier: baseline.isin || baseline.symbol,
      name: baseline.name,
      ticker: baseline.symbol,
      isin: baseline.isin,
      priceCents: Number(currentPricePaise),
      previousCloseCents: Number(previousClosePaise),
      changePercent,
      changePaise,
      dayHighCents: Number(dayHighPaise),
      dayLowCents: Number(dayLowPaise),
      asOfDate: new Date().toISOString().slice(0, 10),
      source: baseline.source,
      isLive: session.isOpen && isEquityOrCommodity,
    };
  }

  async getQuote(identifier: string): Promise<Result<MarketQuoteDto | null>> {
    try {
      const now = Date.now();
      const cached = quoteCache.get(identifier);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return ok(cached.quote);
      }

      const baseline = this.findBaseline(identifier);
      if (baseline) {
        const quote = this.generateQuote(baseline);
        quoteCache.set(identifier, { quote, timestamp: now });
        return ok(quote);
      }

      return ok(null);
    } catch (e: any) {
      return err(new Error(e?.message || 'Error fetching quote'));
    }
  }

  async refreshPortfolioQuotes(
    holdings: readonly HoldingDetailDto[]
  ): Promise<Result<readonly MarketQuoteDto[]>> {
    try {
      const quotes: MarketQuoteDto[] = [];
      const now = Date.now();

      for (const h of holdings) {
        const lookupKey = h.isin || h.ticker || h.holdingId;
        const baseline =
          (h.isin && this.findBaseline(h.isin)) ||
          (h.ticker && this.findBaseline(h.ticker)) ||
          this.findBaseline(lookupKey);

        if (baseline) {
          const quote = this.generateQuote(baseline);
          quotes.push(quote);
          quoteCache.set(lookupKey, { quote, timestamp: now });
        } else {
          // Dynamic fallback for custom/unlisted holdings based on existing unit valuation
          const unitPriceCents =
            h.quantity > 0 ? Math.round(h.currentValueCents / h.quantity) : h.unitCostCents;

          quotes.push({
            identifier: lookupKey,
            name: h.name,
            ticker: h.ticker,
            isin: h.isin,
            priceCents: unitPriceCents,
            previousCloseCents: unitPriceCents,
            changePercent: 0.0,
            changePaise: 0,
            asOfDate: new Date().toISOString().slice(0, 10),
            source: h.assetClassId === 'mutual_fund' ? 'AMFI' : 'NSE',
            isLive: false,
          });
        }
      }

      return ok(quotes);
    } catch (e: any) {
      return err(new Error(e?.message || 'Error refreshing quotes'));
    }
  }
}

export const marketDataAdapter = new MarketDataAdapter();
