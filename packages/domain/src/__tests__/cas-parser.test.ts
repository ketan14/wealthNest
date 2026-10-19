import { describe, it, expect } from 'vitest';
import { CdslCasParser } from '../cas/cdsl-cas-parser.js';
import { NsdlCasParser } from '../cas/nsdl-cas-parser.js';
import { CasParserRegistry } from '../cas/cas-parser-registry.js';
import { isValidIsin, isIndianIsin, inferAssetClassFromIsin, inferTickerFromSecurity } from '../cas/isin.js';

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
    expect(inferAssetClassFromIsin('INF740K01128', 'DSP Mid Cap Fund').assetClassId).toBe('mutual_fund');
    expect(inferAssetClassFromIsin('INF194K01524', 'Bandhan Large & Mid Cap Fund').assetClassId).toBe('mutual_fund');
    expect(inferAssetClassFromIsin('IN0020180017', 'Sovereign Gold Bond 2028').assetClassId).toBe('commodity');
    expect(inferAssetClassFromIsin('INE040A01034', 'Embassy Office Parks REIT').assetClassId).toBe('real_estate');
  });

  it('attaches security name with asset ticker symbol correctly', () => {
    expect(inferTickerFromSecurity('INE002A01018', 'RELIANCE INDUSTRIES LTD. - EQ')).toBe('RELIANCE');
    expect(inferTickerFromSecurity('INF209K01164', 'NIPPON INDIA NIFTY 50 BEES ETF')).toBe('NIFTYBEES');
    expect(inferTickerFromSecurity('IN0020180017', 'SOVEREIGN GOLD BOND 2028-29')).toBe('SGB-2028');
    expect(inferTickerFromSecurity('INE467B01029', 'TATA CONSULTANCY SERVICES LTD')).toBe('TCS');
    expect(inferTickerFromSecurity('INE040A01034', 'HDFC BANK LIMITED')).toBe('HDFCBANK');
    expect(inferTickerFromSecurity('INF740K01PX1', 'DSP FLEXI CAP FUND - REGULAR PLAN')).toBe('DSP-FLEXI');
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
    expect(reliance.ticker).toBe('RELIANCE');
    expect(reliance.quantity).toBe(80);
    expect(reliance.reportedMarketValue.toDecimal()).toBe(236000);
    expect(reliance.assetClassId).toBe('equity');

    // Verify SGB
    const sgb = result.holdings.find((h) => h.isin === 'IN0020180017')!;
    expect(sgb).toBeDefined();
    expect(sgb.ticker).toBe('SGB-2028');
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
    expect(tcs.ticker).toBe('TCS');
    expect(tcs.quantity).toBe(40);
    expect(tcs.reportedMarketValue.toDecimal()).toBe(166000);

    const hdfc = result.holdings.find((h) => h.isin === 'INE040A01034')!;
    expect(hdfc.ticker).toBe('HDFCBANK');
    expect(hdfc.quantity).toBe(50);
    expect(hdfc.reportedMarketValue.toDecimal()).toBe(80000);

    // Total: 1,66,000 + 80,000 = 2,46,000
    expect(result.totalReportedValue.toDecimal()).toBe(246000);
  });

  it('reliably parses multi-line mutual fund schemes like INF740K01PX1', () => {
    const multiLineMfStatement = `
      Central Depository Services (India) Limited
      Consolidated Account Statement (CDSL e-CAS)
      Statement as on : 31-Mar-2026

      MUTUAL FUNDS HOLDINGS:
      DSP MUTUAL FUND
      DSP FLEXI CAP FUND - REGULAR PLAN - GROWTH
      ISIN: INF740K01PX1 Folio No: 1234567/89
      1,245.500 82.450 1,02,691.48
    `;

    const parser = new CdslCasParser();
    const result = parser.parse([multiLineMfStatement]);

    expect(result.warnings).toHaveLength(0);
    expect(result.holdings).toHaveLength(1);

    const dsp = result.holdings[0]!;
    expect(dsp.isin).toBe('INF740K01PX1');
    expect(dsp.name).toContain('DSP FLEXI CAP FUND');
    expect(dsp.quantity).toBe(1245.5);
    expect(dsp.reportedMarketValue.toDecimal()).toBe(102691.48);
    expect(dsp.assetType).toBe('mutual_fund');
  });

  it('handles explicit zero-balance closed folios with a descriptive warning', () => {
    const zeroBalanceStatement = `
      Central Depository Services (India) Limited
      Statement as on : 31-Mar-2026

      MUTUAL FUNDS:
      DSP MUTUAL FUND
      INF740K01PX1 DSP FLEXI CAP FUND
      Units: 0.000 NAV: 82.45 Value: 0.00
    `;

    const parser = new CdslCasParser();
    const result = parser.parse([zeroBalanceStatement]);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('reported 0 units');
  });

  it('parses real CDSL Page 12 Mutual Fund Folio table with Units, NAV, Cumulative Invested, and Valuation', () => {
    const realCdslMfTable = `
      Central Depository Services (India) Limited
      Statement as on : 30-Sep-2026
      MUTUAL FUND UNITS HELD AS ON 30-09-2026
      Scheme Name ISIN Folio No. ARN Code Closing Bal (Units) NAV (Rs) Cumulative Amount Invested (in INR) Valuation (Rs) Average Total Expense Ratio Gross Commission Paid Unrealised Profit/Loss Unrealised Profit/Loss (%)
      782 - DSP Mid Cap Fund - Direct Plan - Growth INF740K01PX1 4685175/66 ARN-DIRECT 625.535 165.517 60,708.71 1,03,536.68 0 .8 0 42,827.97 70.55
      001ZG - Parag Parikh Flexi Cap Fund - Direct Plan Growth INF879O01027 10720220 ARN-DIRECT 2118.914 88.8355 1,36,000.00 1,88,234.78 0 .7 0 52,234.78 38.41
    `;

    const parser = new CdslCasParser();
    const result = parser.parse([realCdslMfTable]);

    expect(result.holdings).toHaveLength(2);

    const dsp = result.holdings.find((h) => h.isin === 'INF740K01PX1')!;
    expect(dsp).toBeDefined();
    expect(dsp.name).toContain('DSP Mid Cap Fund');
    expect(dsp.ticker).toBe('DSP-MIDCAP');
    expect(dsp.quantity).toBe(625.535);
    expect(dsp.reportedNavOrPrice?.toDecimal()).toBe(165.52);
    expect(dsp.reportedMarketValue.toDecimal()).toBe(103536.68);
    expect(dsp.unitCost).toBeDefined();
    expect(dsp.folioOrDemat).toBe('4685175/66');

    const ppfas = result.holdings.find((h) => h.isin === 'INF879O01027')!;
    expect(ppfas).toBeDefined();
    expect(ppfas.name).toContain('Parag Parikh Flexi Cap Fund');
    expect(ppfas.ticker).toBe('PPFAS-FLEXI');
    expect(ppfas.quantity).toBe(2118.914);
    expect(ppfas.reportedNavOrPrice?.toDecimal()).toBe(88.84);
    expect(ppfas.reportedMarketValue.toDecimal()).toBe(188234.78);
    expect(ppfas.folioOrDemat).toBe('10720220');
  });

  it('correctly parses multi-line CDSL Demat stocks without confusing boilerplate for company name', () => {
    const realCdslDematSnippet = `
      Central Depository Services (India) Limited
      Statement as on : 31-Aug-2026
      DEMAT ACCOUNTS HELD WITH CDSL
      BO ID: 1208160000000000
      Name: KETAN SHAMALBHAI VAGHELA

      MTAR TECHNOLOGIES LIMITED
      INE864I01014
      # EQUITY SHARES 17.000 -- -- -- 17.000 7765.4500 1,32,012.65

      TATA MOTORS LIMITED
      INE1TAE01010
      LIMITED # EQUITY SHARES 18.000 -- -- -- 18.000 3221.3500 57,984.30

      INFOSYS LIMITED
      INE009A01021
      SHARES OF RS 5/- EACH 54.000 -- -- -- 54.000 995.0000 53,730.00

      ADANI ENTERPRISES LIMITED-EQUITY SHARES OF RS 1/- EACH AFTER SUB DIVISION
      INE423A01024 16.000 -- -- -- 16.000 2900.2500 46,404.00
    `;

    const parser = new CdslCasParser();
    const result = parser.parse([realCdslDematSnippet]);

    expect(result.holdings).toHaveLength(4);

    // 1. MTAR Technologies
    const mtar = result.holdings.find((h) => h.isin === 'INE864I01014')!;
    expect(mtar).toBeDefined();
    expect(mtar.name).toBe('MTAR TECHNOLOGIES LIMITED');
    expect(mtar.ticker).toBe('MTARTECH');
    expect(mtar.quantity).toBe(17);
    expect(mtar.reportedNavOrPrice?.toDecimal()).toBe(7765.45);
    expect(mtar.reportedMarketValue.toDecimal()).toBe(132012.65);

    // 2. Tata Motors
    const tata = result.holdings.find((h) => h.isin === 'INE1TAE01010')!;
    expect(tata).toBeDefined();
    expect(tata.name).toBe('TATA MOTORS LIMITED');
    expect(tata.ticker).toBe('TATAMOTORS');
    expect(tata.quantity).toBe(18);
    expect(tata.reportedMarketValue.toDecimal()).toBe(57984.3);

    // 3. Infosys
    const infy = result.holdings.find((h) => h.isin === 'INE009A01021')!;
    expect(infy).toBeDefined();
    expect(infy.name).toBe('INFOSYS LIMITED');
    expect(infy.ticker).toBe('INFY');
    expect(infy.quantity).toBe(54);
    expect(infy.reportedMarketValue.toDecimal()).toBe(53730);

    // 4. Adani Enterprises
    const adani = result.holdings.find((h) => h.isin === 'INE423A01024')!;
    expect(adani).toBeDefined();
    expect(adani.name).toBe('ADANI ENTERPRISES LIMITED');
    expect(adani.ticker).toBe('ADANIENT');
    expect(adani.quantity).toBe(16);
    expect(adani.reportedMarketValue.toDecimal()).toBe(46404);
  });

  it('correctly parses wrapped Mutual Fund Folio lines and prevents commission/P&L column pollution', () => {
    const wrappedMfSnippet = `
      Central Depository Services (India) Limited
      Statement as on : 31-Aug-2026
      MUTUAL FUND UNITS HELD AS ON 31-08-2026

      104 - DSP Mid Cap Fund - Regular Plan - Growth INF740K01128
      4685175/66 ARN-9992 358.791 147.201 29,000.00 52,814.39 1.72 0 281.78 23,814.39 82.12

      Bandhan Large & Mid Cap Fund - Regular Plan Growth INF194K01524
      1895586/61 ARN-9992 348.034 135.962 46,000.00 47,319.40 2.28 0 272.73 1,319.40 2.87

      / ARN-
      DIRECT . - -
      LIMITED # EQUITY SHARES -- -- --
    `;

    const parser = new CdslCasParser();
    const result = parser.parse([wrappedMfSnippet]);

    // Should only have 2 real mutual funds, ghost rows completely ignored
    expect(result.holdings).toHaveLength(2);

    const dsp = result.holdings.find((h) => h.isin === 'INF740K01128')!;
    expect(dsp).toBeDefined();
    expect(dsp.name).toBe('DSP Mid Cap Fund - Regular Plan - Growth');
    expect(dsp.ticker).toBe('DSP-MIDCAP');
    expect(dsp.folioOrDemat).toBe('4685175/66');
    expect(dsp.quantity).toBe(358.791);
    expect(dsp.reportedNavOrPrice?.toDecimal()).toBe(147.2);
    expect(dsp.reportedMarketValue.toDecimal()).toBe(52814.39);
    // Cost basis should be derived from cumulative invested (29,000 / 358.791)
    expect(dsp.unitCost?.toDecimal()).toBeCloseTo(80.83, 1);

    const bandhan = result.holdings.find((h) => h.isin === 'INF194K01524')!;
    expect(bandhan).toBeDefined();
    expect(bandhan.name).toBe('Bandhan Large & Mid Cap Fund - Regular Plan Growth');
    expect(bandhan.ticker).toBe('BANDHAN-LM');
    expect(bandhan.folioOrDemat).toBe('1895586/61');
    expect(bandhan.quantity).toBe(348.034);
    expect(bandhan.reportedMarketValue.toDecimal()).toBe(47319.4);
  });

  it('parses mutual funds held with MF/RTA including transactions and closing balance', () => {
    const rtaSnippet = `
      Central Depository Services (India) Limited
      Statement as on : 30-Sep-2026
      MUTUAL FUND UNITS HELD WITH MF/RTA
      STATEMENT OF TRANSACTIONS FOR THE PERIOD FROM 01-09-2026 TO 30-09-2026
      IDFC Mutual Fund
      D201 - Bandhan Large & Mid Cap Fund-Direct Plan-Growth ( Formerly Known as Bandhan Core Equity Fund-Direct Plan-Growth)
      ISIN : INF194K01V89 UCC : MFSTCH0030
      Date Transaction Description Amount (\`) NAV (\`) Price (\`) Units Stamp Duty (\`)
      Opening Balance 2689.717
      21-09-2026
      *Redemption - Electronic Payment - via myCAMS Mobile App - IN22626624053919 209928335
      -70000 166.084 166.084 -421.478 0 0 0
      STT .7
      Closing Balance 2268.239

      ( ₹ ) 201 - Bandhan Large & Mid Cap Fund-Regular Plan-Growth
      ISIN : INF194K01524 UCC : MFSTCH0030
      Opening Balance 333.93
      01-09-2026
      Net Systematic Purchase - Instalment 109/988
      1999.9 141.796 141.796 14.104 .1 0 0
      Closing Balance 348.034
    `;

    const parser = new CdslCasParser();
    const result = parser.parse([rtaSnippet]);

    // Holdings extracted from Closing Balance
    expect(result.holdings).toHaveLength(2);
    const bandhanDirect = result.holdings.find((h) => h.isin === 'INF194K01V89')!;
    expect(bandhanDirect).toBeDefined();
    expect(bandhanDirect.name).toBe('Bandhan Large & Mid Cap Fund-Direct Plan-Growth');
    expect(bandhanDirect.quantity).toBe(2268.239);
    expect(bandhanDirect.reportedNavOrPrice?.toDecimal()).toBe(166.08);

    // Transactions extracted
    expect(result.transactions).toBeDefined();
    expect(result.transactions).toHaveLength(2);

    const redemption = result.transactions?.find((t) => t.type === 'sell')!;
    expect(redemption).toBeDefined();
    expect(redemption.isin).toBe('INF194K01V89');
    expect(redemption.date).toBe('2026-09-21');
    expect(redemption.amount.toDecimal()).toBe(70000);
    expect(redemption.units).toBe(421.478);
    expect(redemption.navOrPrice?.toDecimal()).toBe(166.08);

    const sip = result.transactions?.find((t) => t.type === 'buy')!;
    expect(sip).toBeDefined();
    expect(sip.isin).toBe('INF194K01524');
    expect(sip.date).toBe('2026-09-01');
    expect(sip.amount.toDecimal()).toBe(1999.9);
    expect(sip.units).toBe(14.104);
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
