import { describe, it, expect } from 'vitest';
import {
  getIndianMarketSession,
  normalizeIndianTicker,
  createStockCmpRecord,
  parseYahooQuoteJson,
  matchHoldingToStockCmp,
  StockCmpRecord,
} from '../market/nse-bse-cmp.js';

describe('NSE / BSE Real-Time CMP Domain', () => {
  describe('Indian Market Trading Sessions (IST)', () => {
    it('identifies regular trading hours on weekdays as OPEN (09:15 - 15:30 IST)', () => {
      // 10:30 AM IST on Wednesday 2026-10-21 -> UTC is 05:00 AM
      const openTime = new Date('2026-10-21T05:00:00.000Z');
      const session = getIndianMarketSession(openTime);

      expect(session.status).toBe('OPEN');
      expect(session.isOpen).toBe(true);
      expect(session.description).toContain('Live Market Open');
      expect(session.istTimeString).toBe('10:30 IST');
    });

    it('identifies pre-market session on weekdays (09:00 - 09:15 IST)', () => {
      // 09:08 AM IST on Wednesday 2026-10-21 -> UTC is 03:38 AM
      const preMarket = new Date('2026-10-21T03:38:00.000Z');
      const session = getIndianMarketSession(preMarket);

      expect(session.status).toBe('PRE_MARKET');
      expect(session.isOpen).toBe(false);
      expect(session.description).toContain('Pre-Market');
    });

    it('identifies post-market closing on weekdays (15:30 - 16:00 IST)', () => {
      // 15:45 IST on Wednesday 2026-10-21 -> UTC is 10:15 AM
      const postMarket = new Date('2026-10-21T10:15:00.000Z');
      const session = getIndianMarketSession(postMarket);

      expect(session.status).toBe('POST_MARKET');
      expect(session.isOpen).toBe(false);
      expect(session.description).toContain('Post-Market');
    });

    it('identifies overnight closed hours on weekdays (e.g. 21:00 IST)', () => {
      // 21:00 IST on Wednesday 2026-10-21 -> UTC is 15:30
      const night = new Date('2026-10-21T15:30:00.000Z');
      const session = getIndianMarketSession(night);

      expect(session.status).toBe('CLOSED');
      expect(session.isOpen).toBe(false);
    });

    it('identifies weekends as WEEKEND with markets closed', () => {
      // Sunday 2026-10-25 11:00 AM IST
      const sunday = new Date('2026-10-25T05:30:00.000Z');
      const session = getIndianMarketSession(sunday);

      expect(session.status).toBe('WEEKEND');
      expect(session.isOpen).toBe(false);
      expect(session.description).toContain('Weekend');
    });
  });

  describe('Ticker Normalisation', () => {
    it('normalizes NSE equity tickers', () => {
      expect(normalizeIndianTicker('RELIANCE')).toEqual({
        symbol: 'RELIANCE',
        exchange: 'NSE',
        querySymbol: 'RELIANCE.NS',
      });

      expect(normalizeIndianTicker('TCS.NS')).toEqual({
        symbol: 'TCS',
        exchange: 'NSE',
        querySymbol: 'TCS.NS',
      });

      expect(normalizeIndianTicker('NSE:INFY')).toEqual({
        symbol: 'INFY',
        exchange: 'NSE',
        querySymbol: 'INFY.NS',
      });
    });

    it('normalizes BSE equity tickers', () => {
      expect(normalizeIndianTicker('500325.BO')).toEqual({
        symbol: '500325',
        exchange: 'BSE',
        querySymbol: '500325.BO',
      });

      expect(normalizeIndianTicker('BSE:TATAMOTORS')).toEqual({
        symbol: 'TATAMOTORS',
        exchange: 'BSE',
        querySymbol: 'TATAMOTORS.BO',
      });
    });
  });

  describe('Zero Floating-Point Drift Integer Paise Conversion', () => {
    it('stores currency in integer paise with zero drift', () => {
      const record = createStockCmpRecord({
        symbol: 'RELIANCE',
        isin: 'INE002A01018',
        companyName: 'Reliance Industries Ltd',
        cmp: 2950.45,
        previousClose: 2910.0,
      });

      expect(record.cmpPaise).toBe(295045n);
      expect(record.previousClosePaise).toBe(291000n);
      expect(record.change).toBe(40.45);
      expect(record.changePercent).toBe(1.39);
      expect(record.exchange).toBe('NSE');
    });
  });

  describe('Yahoo Finance Quote Parser', () => {
    it('parses chart quote response successfully', () => {
      const mockYahooPayload = {
        chart: {
          result: [
            {
              meta: {
                symbol: 'INFY.NS',
                shortName: 'Infosys Limited',
                regularMarketPrice: 1920.75,
                chartPreviousClose: 1895.0,
                regularMarketDayHigh: 1935.0,
                regularMarketDayLow: 1890.0,
                regularMarketVolume: 4500000,
                regularMarketTime: 1729500000,
              },
            },
          ],
        },
      };

      const quote = parseYahooQuoteJson(mockYahooPayload);
      expect(quote).not.toBeNull();
      expect(quote?.symbol).toBe('INFY');
      expect(quote?.exchange).toBe('NSE');
      expect(quote?.cmp).toBe(1920.75);
      expect(quote?.cmpPaise).toBe(192075n);
      expect(quote?.change).toBe(25.75);
      expect(quote?.changePercent).toBe(1.36);
    });

    it('returns null on invalid response payload', () => {
      expect(parseYahooQuoteJson(null)).toBeNull();
      expect(parseYahooQuoteJson({})).toBeNull();
      expect(parseYahooQuoteJson({ chart: { result: [] } })).toBeNull();
    });
  });

  describe('Lookup and Match Holding to Stock CMP', () => {
    it('matches holding by ISIN or Ticker', () => {
      const map = new Map<string, StockCmpRecord>();
      const reliance = createStockCmpRecord({
        symbol: 'RELIANCE',
        isin: 'INE002A01018',
        cmp: 2950.0,
        previousClose: 2900.0,
      });
      map.set('INE002A01018', reliance);
      map.set('RELIANCE', reliance);

      // Match by ISIN
      const matchByIsin = matchHoldingToStockCmp(map, { isin: 'INE002A01018' });
      expect(matchByIsin?.symbol).toBe('RELIANCE');

      // Match by Ticker
      const matchByTicker = matchHoldingToStockCmp(map, { ticker: 'RELIANCE.NS' });
      expect(matchByTicker?.symbol).toBe('RELIANCE');

      // Unmatched
      const matchNone = matchHoldingToStockCmp(map, { ticker: 'UNKNOWN' });
      expect(matchNone).toBeNull();
    });
  });
});
