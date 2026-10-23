import { describe, it, expect } from 'vitest';
import { parseAmfiNavFeed, matchHoldingToAmfiNav } from '../market/amfi-nav.js';

describe('AMFI NAV Feed Parser', () => {
  const sampleFeed = `
Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
122639;INF879O01019;INF879O01027;Parag Parikh Flexi Cap Fund - Direct Plan - Growth;78.4521;22-Oct-2026
118989;INF200K01TS4;-;SBI Bluechip Fund - Direct Plan - Growth;92.1400;22-Oct-2026
120503;INF109K012R6;INF109K012S4;ICICI Prudential Value Discovery Fund - Direct Plan - Growth;410.2500;22-Oct-2026
`;

  it('parses semicolon-delimited AMFI feed into indexed Map by Scheme Code and ISIN', () => {
    const map = parseAmfiNavFeed(sampleFeed);

    expect(map.size).toBeGreaterThanOrEqual(3);

    // Lookup by Scheme Code
    const ppfasByCode = map.get('122639');
    expect(ppfasByCode).toBeDefined();
    expect(ppfasByCode?.schemeName).toContain('Parag Parikh Flexi Cap Fund');
    expect(ppfasByCode?.nav).toBe(78.4521);
    expect(ppfasByCode?.navPaise).toBe(7845n);
    expect(ppfasByCode?.date).toBe('22-Oct-2026');

    // Lookup by ISIN
    const ppfasByIsin = map.get('INF879O01019');
    expect(ppfasByIsin).toBeDefined();
    expect(ppfasByIsin?.schemeCode).toBe('122639');

    // Lookup SBI Bluechip
    const sbiByIsin = map.get('INF200K01TS4');
    expect(sbiByIsin).toBeDefined();
    expect(sbiByIsin?.nav).toBe(92.14);
  });

  it('matches holding to latest AMFI NAV using ISIN or Scheme Code', () => {
    const map = parseAmfiNavFeed(sampleFeed);

    const match1 = matchHoldingToAmfiNav(map, { isin: 'INF879O01019' });
    expect(match1).not.toBeNull();
    expect(match1?.schemeName).toContain('Parag Parikh');

    const match2 = matchHoldingToAmfiNav(map, { schemeCode: '118989' });
    expect(match2).not.toBeNull();
    expect(match2?.schemeName).toContain('SBI Bluechip Fund');

    const matchNone = matchHoldingToAmfiNav(map, { isin: 'UNKNOWN_ISIN' });
    expect(matchNone).toBeNull();
  });
});
