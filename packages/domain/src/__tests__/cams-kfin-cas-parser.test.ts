import { describe, it, expect } from 'vitest';
import { CamsKfinCasParser } from '../cas/cams-kfin-cas-parser.js';
import { CasParserRegistry } from '../cas/cas-parser-registry.js';

// Sanitized layout of a CAMS/KFintech "Consolidated Account Summary" as extracted by PDF.js.
const PAGE_1 = [
  'This Consolidated Account Summary  is brought  to you as  an  investor',
  'friendly initiative by KFIN and CAMS and lists the balances and valuation',
  'Closing Unit',
  'Balance Scheme Name Folio No.  NAV Date  Registrar Price  Market Value',
  '(INR)  (INR)',
  'Cost Value',
  '(INR) ISIN',
  'CAMS 1895586  GD201-Bandhan Large & Mid Cap Fund-Direct',
  'Plan-Growth ( Formerly Known as  Bandhan Core',
  'Equity Fund-Direct Plan-Growth)  (Non-Demat)',
  '2268.2390  09-NOV-2026  167.2240  379304 INF194K01V89  220948.23',
  'CAMS 1895586  G201-Bandhan Large & Mid Cap Fund-Regular',
  'Plan-Growth ( Formerly Known as  Bandhan Core',
  'Equity Fund-Regular Plan-Growth)  (Non-Demat)',
  '377.78  09-NOV-2026  141.3280  53390.89 INF194K01524  50000',
  'CAMS 4685175  D782-DSP Mid Cap Fund - Direct Plan - Growth',
  '(formerly DSP Small and Mid Cap Fund)',
  '(Non-Demat)',
  '625.5350  09-NOV-2026  168.6480  105495.23 INF740K01PX1  60708.71',
  'KFINTECH 499236287077  RMFMFAGG-NIPPON INDIA MULTI ASSET',
  'ALLOCATION FUND - DIRECT GROWTH PLAN (Non',
  'Demat)',
  '999.950  09-NOV-2026  26.8915  26890.16 INF204KB19V4  10000.00',
  'Total  5,65,080.28 3,41,656.94',
  'Consolidated Account Summary',
  'As on 10-Nov-2026',
].join('\n');

describe('CAMS / KFin Consolidated Account Summary Parser', () => {
  const parser = new CamsKfinCasParser();
  const result = parser.parse([PAGE_1]);

  it('is detected by the registry and not mistaken for CDSL / NSDL', () => {
    expect(parser.canParse(PAGE_1)).toBe(true);
    expect(new CasParserRegistry().detectAndParse([PAGE_1]).provider).toBe('CAMS_KFIN');
  });

  it('maps units, price, market value and cost to the right columns', () => {
    const direct = result.holdings.find((h) => h.isin === 'INF194K01V89')!;
    expect(direct.quantity).toBe(2268.239);
    expect(direct.reportedNavOrPrice?.cents).toBe(16722n);
    expect(direct.reportedMarketValue.cents).toBe(37930400n);
    expect(direct.costBasisVerified).toBe(true);
    expect(direct.folioNumber).toBe('1895586');
    expect(direct.name).toBe('Bandhan Large & Mid Cap Fund-Direct Plan-Growth');
  });

  it('keeps Direct and Regular plans of the same folio as separate unique entries', () => {
    const bandhan = result.holdings.filter((h) => h.folioNumber === '1895586');
    expect(bandhan.map((h) => h.isin).sort()).toEqual(['INF194K01524', 'INF194K01V89']);
    const keys = new Set(result.holdings.map((h) => `${h.isin}::${h.folioNumber}`));
    expect(keys.size).toBe(result.holdings.length);
    expect(result.holdings.find((h) => h.isin === 'INF194K01524')!.reportedMarketValue.cents).toBe(
      5339089n
    );
  });

  it('cleans scheme codes, wrapped lines and Non-Demat suffixes, and reads KFintech folios', () => {
    const dsp = result.holdings.find((h) => h.isin === 'INF740K01PX1')!;
    expect(dsp.name).toBe('DSP Mid Cap Fund - Direct Plan - Growth');
    const nippon = result.holdings.find((h) => h.isin === 'INF204KB19V4')!;
    expect(nippon.folioNumber).toBe('499236287077');
    expect(nippon.name).toBe('NIPPON INDIA MULTI ASSET ALLOCATION FUND - DIRECT GROWTH PLAN');
    expect(nippon.quantity).toBe(999.95);
  });

  it('never produces absurd values (units × price must reconcile with market value)', () => {
    for (const h of result.holdings) {
      // Money keeps 2 decimals, so NAV (4 dp on the statement) may be off by half a paisa per unit
      const expected = h.quantity * h.reportedNavOrPrice!.toDecimal();
      const tolerance = h.quantity * 0.005 + 1;
      expect(Math.abs(expected - h.reportedMarketValue.toDecimal())).toBeLessThan(tolerance);
    }
    expect(result.statementDate).toBe('2026-11-10');
  });

  it('warns when parsed rows cannot be reconciled', () => {
    const bad = parser.parse([PAGE_1.replace('379304 INF194K01V89', '999999 INF194K01V89')]);
    expect(bad.warnings.some((w) => w.includes('INF194K01V89'))).toBe(true);
  });
});
