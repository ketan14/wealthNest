import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  inferAssetClassFromIsin,
  extractMutualFundSchemeDetails,
  isValidIsin,
  isIndianIsin,
} from '../cas/isin.js';
import { CdslCasParser } from '../cas/cdsl-cas-parser.js';
import { calculatePortfolioSummary, HoldingValuationItem } from '../portfolio/portfolio-summary.js';

describe('ISIN Classification & Reference Data Hints', () => {
  it('treats ISIN prefixes as hints and classifies based on statement context and security metadata', () => {
    // 1. Direct Equities (INE prefix)
    const reliance = inferAssetClassFromIsin(
      'INE002A01018',
      'RELIANCE INDUSTRIES LTD - EQ',
      'demat'
    );
    expect(reliance.assetClassId).toBe('equity');
    expect(reliance.instrumentType).toBe('equity_share');

    // 2. Exchange-Traded Funds (INF prefix in Demat with ETF in name)
    const niftyBees = inferAssetClassFromIsin(
      'INF209K01164',
      'NIPPON INDIA NIFTY 50 BEES ETF',
      'demat'
    );
    expect(niftyBees.assetClassId).toBe('equity');
    expect(niftyBees.instrumentType).toBe('etf');

    // 3. Mutual Fund Schemes (INF prefix in Mutual Fund RTA section or with Mutual Fund in description)
    const bandhanMf = inferAssetClassFromIsin(
      'INF194K01V89',
      'Bandhan Large & Mid Cap Fund-Direct Plan-Growth',
      'mutual_fund_rta'
    );
    expect(bandhanMf.assetClassId).toBe('mutual_fund');
    expect(bandhanMf.instrumentType).toBe('mutual_fund_scheme');

    // 4. Sovereign Gold Bonds (IN00... in Demat)
    const sgb = inferAssetClassFromIsin('IN0020180017', 'SOVEREIGN GOLD BOND 2028-29', 'demat');
    expect(sgb.assetClassId).toBe('commodity');
    expect(sgb.instrumentType).toBe('sgb');

    // 5. Real Estate Investment Trust (REIT)
    const reit = inferAssetClassFromIsin('INE041025011', 'EMBASSY OFFICE PARKS REIT', 'demat');
    expect(reit.assetClassId).toBe('real_estate');
    expect(reit.instrumentType).toBe('reit');

    // 6. Bonds & Government Debt
    const gsec = inferAssetClassFromIsin('IN0012230018', '7.18% GS 2033', 'demat');
    expect(gsec.assetClassId).toBe('fixed_income');
    expect(gsec.instrumentType).toBe('bond');
  });

  it('correctly disambiguates ambiguous instruments with identical ISIN prefixes', () => {
    // Case: Ambiguous INF... ISIN without explicit "ETF" word in Demat vs RTA
    const dematEtf = inferAssetClassFromIsin('INF209K01164', 'NIPPON INDIA JUNIOR BEES', 'demat');
    expect(dematEtf.assetClassId).toBe('equity');
    expect(dematEtf.instrumentType).toBe('etf');

    const rtaFund = inferAssetClassFromIsin(
      'INF209K01164',
      'Nippon India Growth Fund - Direct Plan',
      'mutual_fund_rta'
    );
    expect(rtaFund.assetClassId).toBe('mutual_fund');
    expect(rtaFund.instrumentType).toBe('mutual_fund_scheme');
  });

  it('extracts structured mutual fund AMC, plan, and option details without untyped blobs', () => {
    const details1 = extractMutualFundSchemeDetails(
      'D201 - Bandhan Large & Mid Cap Fund-Direct Plan-Growth (Formerly Bandhan Core Equity Fund)'
    );
    expect(details1.amcName).toBe('Bandhan Mutual Fund');
    expect(details1.schemePlan).toBe('Direct Plan - Growth');

    const details2 = extractMutualFundSchemeDetails('HDFC TOP 100 FUND - REGULAR PLAN - IDCW');
    expect(details2.amcName).toBe('HDFC Mutual Fund');
    expect(details2.schemePlan).toBe('Regular Plan - IDCW');

    const details3 = extractMutualFundSchemeDetails(
      'PARAG PARIKH FLEXI CAP FUND DIRECT PLAN GROWTH OPTION'
    );
    expect(details3.amcName).toBe('PPFAS Mutual Fund');
    expect(details3.schemePlan).toBe('Direct Plan - Growth');
  });
});

describe('Multi-Folio Holdings & Asset Identity Separation', () => {
  it('supports the exact same scheme appearing across multiple folios without colliding', () => {
    const parser = new CdslCasParser();

    // Statement containing 2 distinct folios of Bandhan Large & Mid Cap Fund (ISIN: INF194K01V89)
    const multiFolioStatement = `
      Central Depository Services (India) Limited
      Consolidated Account Statement (CDSL e-CAS)
      Statement as on : 30-Sep-2026

      MUTUAL FUND UNITS HELD WITH MF/RTA
      Bandhan Mutual Fund
      D201 - Bandhan Large & Mid Cap Fund-Direct Plan-Growth
      ISIN : INF194K01V89 Folio No: 209928335/70
      Closing Balance 2268.239 NAV: 166.084 Market Value: 3,76,718.00

      Bandhan Mutual Fund
      D201 - Bandhan Large & Mid Cap Fund-Direct Plan-Growth
      ISIN : INF194K01V89 Folio No: 108847291/00
      Closing Balance 500.000 NAV: 166.084 Market Value: 83,042.00
    `;

    const parsed = parser.parse([multiFolioStatement]);

    // Both folios must be extracted
    expect(parsed.holdings).toHaveLength(2);

    const folio1 = parsed.holdings.find((h) => h.folioNumber === '209928335/70');
    const folio2 = parsed.holdings.find((h) => h.folioNumber === '108847291/00');

    expect(folio1).toBeDefined();
    expect(folio2).toBeDefined();

    // Both share the same asset identity (ISIN)
    expect(folio1?.isin).toBe('INF194K01V89');
    expect(folio2?.isin).toBe('INF194K01V89');

    // But have distinct quantities and values
    expect(folio1?.quantity).toBe(2268.239);
    expect(folio2?.quantity).toBe(500);

    // Cost basis is marked unverified for closing balance imports
    expect(folio1?.costBasisVerified).toBe(false);
    expect(folio2?.costBasisVerified).toBe(false);
  });
});

describe('Portfolio Aggregation Engine (Direct Equities + Mutual Funds)', () => {
  it('aggregates direct equities, multi-folio mutual funds, and other assets exactly once', () => {
    const items: HoldingValuationItem[] = [
      // Direct Equity 1: Reliance
      {
        holdingId: 'h-eq-1',
        assetClassId: 'equity',
        assetClassName: 'Equities & Stocks',
        colorHex: '#3b82f6',
        quantity: 80,
        costBasis: Money.fromDecimal(200000, 'INR'), // ₹2,00,000
        currentValue: Money.fromDecimal(236000, 'INR'), // ₹2,36,000
      },
      // Direct Equity 2: TCS
      {
        holdingId: 'h-eq-2',
        assetClassId: 'equity',
        assetClassName: 'Equities & Stocks',
        colorHex: '#3b82f6',
        quantity: 40,
        costBasis: Money.fromDecimal(144000, 'INR'), // ₹1,44,000
        currentValue: Money.fromDecimal(166000, 'INR'), // ₹1,66,000
      },
      // Mutual Fund Folio A: Bandhan Folio 1
      {
        holdingId: 'h-mf-1',
        assetClassId: 'mutual_fund',
        assetClassName: 'Mutual Funds',
        colorHex: '#06b6d4',
        quantity: 2268.239,
        costBasis: Money.fromDecimal(300000, 'INR'), // ₹3,00,000
        currentValue: Money.fromDecimal(376718, 'INR'), // ₹3,76,718
      },
      // Mutual Fund Folio B: Bandhan Folio 2 (Same scheme, second folio)
      {
        holdingId: 'h-mf-2',
        assetClassId: 'mutual_fund',
        assetClassName: 'Mutual Funds',
        colorHex: '#06b6d4',
        quantity: 500,
        costBasis: Money.fromDecimal(70000, 'INR'), // ₹70,000
        currentValue: Money.fromDecimal(83042, 'INR'), // ₹83,042
      },
      // Sovereign Gold Bond
      {
        holdingId: 'h-gold-1',
        assetClassId: 'commodity',
        assetClassName: 'Gold & Precious Metals',
        colorHex: '#eab308',
        quantity: 30,
        costBasis: Money.fromDecimal(174000, 'INR'), // ₹1,74,000
        currentValue: Money.fromDecimal(229500, 'INR'), // ₹2,29,500
      },
    ];

    const summary = calculatePortfolioSummary(items, 'INR');

    // Expected Total Value: 236000 + 166000 + 376718 + 83042 + 229500 = 10,91,260 (₹10.91 Lakhs)
    expect(summary.totalValue.toDecimal()).toBe(1091260);

    // Expected Total Cost: 200000 + 144000 + 300000 + 70000 + 174000 = 8,88,000 (₹8.88 Lakhs)
    expect(summary.totalCostBasis.toDecimal()).toBe(888000);

    // Expected Unrealized Profit: 1091260 - 888000 = 2,03,260
    expect(summary.unrealizedGainLoss.toDecimal()).toBe(203260);
    expect(summary.isProfitable).toBe(true);

    // Separate asset class allocations
    expect(summary.allocations).toHaveLength(3);

    const mfAlloc = summary.allocations.find((a) => a.assetClassId === 'mutual_fund')!;
    expect(mfAlloc).toBeDefined();
    // MF total = 376718 + 83042 = 459760
    expect(mfAlloc.totalValue.toDecimal()).toBe(459760);

    const eqAlloc = summary.allocations.find((a) => a.assetClassId === 'equity')!;
    expect(eqAlloc).toBeDefined();
    // Equity total = 236000 + 166000 = 402000
    expect(eqAlloc.totalValue.toDecimal()).toBe(402000);

    const goldAlloc = summary.allocations.find((a) => a.assetClassId === 'commodity')!;
    expect(goldAlloc).toBeDefined();
    expect(goldAlloc.totalValue.toDecimal()).toBe(229500);

    // Percentages sum to 100%
    const sumPcts = summary.allocations.reduce((sum, a) => sum + a.percentage, 0);
    expect(Math.round(sumPcts)).toBe(100);
  });
});
