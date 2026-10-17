import { describe, it, expect } from 'vitest';
import { CdslCasParser } from '../cas/cdsl-cas-parser.js';
import { NsdlCasParser } from '../cas/nsdl-cas-parser.js';
import { CasParserRegistry } from '../cas/cas-parser-registry.js';
import { isValidIsin, isIndianIsin, inferAssetClassFromIsin } from '../cas/isin.js';

describe('ISIN Validation & Asset Class Inference', () => {
  it('validates 12-character ISO 6166 ISINs', () => {
    expect(isValidIsin('INE002A01018')).toBe(true); // Reliance
    expect(isValidIsin('INF209K01164')).toBe(true); // Nippon Mutual Fund
    expect(isValidIsin('IN0020180017')).toBe(true); // SGB
    expect(isValidIsin('US0378331005')).toBe(true); // Apple (US)
    expect(isValidIsin('INVALID')).toBe(false);
    expect(isValidIsin('INE002A0101')).toBe(false); // 11 chars
  });

  it('detects Indian country code prefix (IN)', () => {
    expect(isIndianIsin('INE002A01018')).toBe(true);
    expect(isIndianIsin('US0378331005')).toBe(false);
  });

  it('infers asset classes correctly', () => {
    expect(inferAssetClassFromIsin('INE002A01018', 'Reliance Industries Ltd').assetClassId).toBe('equity');
    expect(inferAssetClassFromIsin('INF209K01164', 'Nippon India Nifty BeES').assetClassId).toBe('equity');
    expect(inferAssetClassFromIsin('IN0020180017', 'Sovereign Gold Bond 2028').assetClassId).toBe('commodity');
    expect(inferAssetClassFromIsin('INE040A01034', 'Embassy Office Parks REIT').assetClassId).toBe('real_estate');
  });
});

describe('CDSL CAS Statement Parser (Sanitized Fixture)', () => {
  const cdslFixturePage1 = `
    Central Depository Services (India) Limited
    Consolidated Account Statement (CDSL e-CAS)
    Statement as on : 31-Mar-2026
    BO ID: 1208160000000000
    Name: QA TEST INVESTOR

    EQUITY SHARES / LISTED SECURITIES:
    ISIN         Security Name                     Current Balance   Market Price    Market Value
    INE002A01018 RELIANCE INDUSTRIES LTD. - EQ     80.000            2950.00         236000.00
    INF209K01164 NIPPON INDIA NIFTY 50 BEES ETF    500.000           280.00          140000.00
  `;

  const cdslFixturePage2 = `
    Central Depository Services (India) Limited
    Statement as on : 31-Mar-2026
    Page 2 of 2

    GOVERNMENT SECURITIES & GOLD BONDS:
    ISIN         Security Name                     Current Balance   Market Price    Market Value
    IN0020180017 SOVEREIGN GOLD BOND 2028-29       30.000            7650.00         229500.00
  `;

  it('detects CDSL statement provider', () => {
    const parser = new CdslCasParser();
    expect(parser.canParse(cdslFixturePage1)).toBe(true);
    expect(parser.canParse('Random Bank Statement Text')).toBe(false);
  });

  it('parses multi-page CDSL holdings, ISINs, and statement date accurately', () => {
    const parser = new CdslCasParser();
    const result = parser.parse([cdslFixturePage1, cdslFixturePage2]);

    expect(result.provider).toBe('CDSL');
    expect(result.statementDate).toBe('2026-03-31');
    expect(result.holdings).toHaveLength(3);

    // Verify Reliance
    const reliance = result.holdings.find((h) => h.isin === 'INE002A01018')!;
    expect(reliance).toBeDefined();
    expect(reliance.quantity).toBe(80);
    expect(reliance.reportedMarketValue.toDecimal()).toBe(236000);
    expect(reliance.assetClassId).toBe('equity');

    // Verify SGB
    const sgb = result.holdings.find((h) => h.isin === 'IN0020180017')!;
    expect(sgb).toBeDefined();
    expect(sgb.quantity).toBe(30);
    expect(sgb.reportedMarketValue.toDecimal()).toBe(229500);
    expect(sgb.assetClassId).toBe('commodity');

    // Total reported value: 2,36,000 + 1,40,000 + 2,29,500 = 6,05,500
    expect(result.totalReportedValue.toDecimal()).toBe(605500);
  });
});

describe('NSDL CAS Statement Parser (Sanitized Fixture)', () => {
  const nsdlFixture = `
    National Securities Depository Limited
    NSDL Consolidated Account Statement (CAS)
    Statement Date : 31/03/2026
    DP ID : IN300000  Client ID : 10000000
    Investor: SANITIZED MOCK USER

    Holdings Statement:
    ISIN          Security Description              Balance       Rate (Rs.)    Value (Rs.)
    INE467B01029  TATA CONSULTANCY SERVICES LTD     40.000        4150.00       166000.00
    INE040A01034  HDFC BANK LIMITED                 50.000        1600.00       80000.00
  `;

  it('detects NSDL statement provider and parses holdings', () => {
    const parser = new NsdlCasParser();
    expect(parser.canParse(nsdlFixture)).toBe(true);

    const result = parser.parse([nsdlFixture]);
    expect(result.provider).toBe('NSDL');
    expect(result.statementDate).toBe('2026-03-31');
    expect(result.holdings).toHaveLength(2);

    const tcs = result.holdings.find((h) => h.isin === 'INE467B01029')!;
    expect(tcs.quantity).toBe(40);
    expect(tcs.reportedMarketValue.toDecimal()).toBe(166000);

    const hdfc = result.holdings.find((h) => h.isin === 'INE040A01034')!;
    expect(hdfc.quantity).toBe(50);
    expect(hdfc.reportedMarketValue.toDecimal()).toBe(80000);

    // Total: 1,66,000 + 80,000 = 2,46,000
    expect(result.totalReportedValue.toDecimal()).toBe(246000);
  });
});

describe('CasParserRegistry', () => {
  it('automatically routes to appropriate parser based on statement header', () => {
    const registry = new CasParserRegistry();

    const cdslSample = ['Central Depository Services (India) Limited\nINE002A01018 RELIANCE 10 2500 25000'];
    const nsdlSample = ['National Securities Depository Limited\nINE467B01029 TCS 20 4000 80000'];

    expect(registry.detectAndParse(cdslSample).provider).toBe('CDSL');
    expect(registry.detectAndParse(nsdlSample).provider).toBe('NSDL');
  });
});
