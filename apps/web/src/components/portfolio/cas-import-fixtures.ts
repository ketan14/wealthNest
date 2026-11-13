import { CasPreviewDto, ImportCasItemDto, ImportCasTransactionDto } from '@wealthnest/application';
import { detectAndParseBrokerCsv, StatementProvider } from '@wealthnest/domain';

// Sample sanitized CDSL, NSDL, CAMS/KFin, and broker CSV fixtures for quick testing without personal files

export const SANITIZED_CDSL_FIXTURE_PAGES = [
  `Central Depository Services (India) Limited
   Consolidated Account Statement (CDSL e-CAS)
   Statement as on : 31-Mar-2026
   BO ID: 1208160000000000
   Name: QA TEST INVESTOR

   EQUITY SHARES / LISTED SECURITIES:
   ISIN         Security Name                     Current Balance   Market Price    Market Value
   INE002A01018 RELIANCE INDUSTRIES LTD. - EQ     80.000            2950.00         236000.00
   INF209K01164 NIPPON INDIA NIFTY 50 BEES ETF    500.000           280.00          140000.00
   IN0020180017 SOVEREIGN GOLD BOND 2028-29       30.000            7650.00         229500.00`,
];

export const SANITIZED_NSDL_FIXTURE_PAGES = [
  `National Securities Depository Limited
   NSDL Consolidated Account Statement (CAS)
   Statement Date : 31/03/2026
   DP ID : IN300000  Client ID : 10000000
   Investor: QA TEST INVESTOR

   Holdings Statement:
   ISIN          Security Description              Balance       Rate (Rs.)    Value (Rs.)
   INE467B01029  TATA CONSULTANCY SERVICES LTD     40.000        4150.00       166000.00
   INE040A01034  HDFC BANK LIMITED                 50.000        1600.00       80000.00`,
];

export const SANITIZED_CAMS_KFIN_FIXTURE_PAGES = [
  `This Consolidated Account Summary  is brought  to you as  an  investor
   friendly initiative by KFIN and CAMS and lists the balances and valuation
   Closing Unit
   Balance Scheme Name Folio No.  NAV Date  Registrar Price  Market Value
   (INR)  (INR)
   Cost Value
   (INR) ISIN
   CAMS 1895586  GD201-Bandhan Large & Mid Cap Fund-Direct
   Plan-Growth ( Formerly Known as  Bandhan Core
   Equity Fund-Direct Plan-Growth)  (Non-Demat)
   2268.2390  09-NOV-2026  167.2240  379304 INF194K01V89  220948.23
   CAMS 4685175  D782-DSP Mid Cap Fund - Direct Plan - Growth
   (formerly DSP Small and Mid Cap Fund)
   (Non-Demat)
   625.5350  09-NOV-2026  168.6480  105495.23 INF740K01PX1  60708.71
   KFINTECH 499236287077  RMFMFAGG-NIPPON INDIA MULTI ASSET
   ALLOCATION FUND - DIRECT GROWTH PLAN (Non
   Demat)
   999.950  09-NOV-2026  26.8915  26890.16 INF204KB19V4  10000.00
   Total  5,11,689.39 2,91,656.94
   Consolidated Account Summary
   As on 10-Nov-2026`,
];

export const SANITIZED_ZERODHA_HOLDINGS_CSV = `Instrument,Qty.,Avg. cost,LTP,Cur. val,P&L,Net chg.,Day chg.
RELIANCE,80,2500.00,2950.00,"2,36,000.00","36,000.00",18.00,1.25
TCS,40,"3,600.00","4,150.00","1,66,000.00","22,000.00",15.28,-0.45
GOLDBEES,500,52.50,58.20,29100.00,2850.00,10.86,0.34`;

export const SANITIZED_ZERODHA_TRADEBOOK_CSV = `symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,trade_id,order_id,order_execution_time
RELIANCE,INE002A01018,2024-03-15,NSE,EQ,EQ,buy,50,2500.00,123456,987654,2024-03-15 11:20:15
TCS,INE467B01029,2024-04-10,NSE,EQ,EQ,buy,40,3600.00,123457,987655,2024-04-10 14:15:30
RELIANCE,INE002A01018,2024-05-20,NSE,EQ,EQ,sell,10,2900.00,123458,987656,2024-05-20 10:05:00`;

export const SANITIZED_GROWW_HOLDINGS_CSV = `Company Name,Symbol,Shares,Average Price,Current Value,Market Price
Reliance Industries Ltd,RELIANCE,30,"2,480.00","88,500.00","2,950.00"
Tata Consultancy Services Ltd,TCS,20,"3,550.00","83,000.00","4,150.00"
Parag Parikh Flexi Cap Fund Direct-Growth,PPFAS-FLEXI,1000,55.00,78450.00,78.45`;

export const SANITIZED_GROWW_ORDERS_CSV = `Stock Name,Order Type,Date,Quantity,Average Price,Status
Reliance Industries,BUY,12-Apr-2024,25,2520.00,EXECUTED
Infosys,BUY,18-Apr-2024,50,1420.00,EXECUTED`;

export function buildBrokerCsvPreview(
  csvContent: string,
  preferredBroker?: 'ZERODHA' | 'GROWW'
): { preview: CasPreviewDto } | { error: string } {
  const parsed = detectAndParseBrokerCsv(csvContent, preferredBroker);

  if (parsed.holdings.length === 0 && parsed.trades.length === 0) {
    return {
      error:
        parsed.warnings.length > 0
          ? parsed.warnings.join('; ')
          : 'Could not extract any holdings or trades from this CSV file. Please verify the format.',
    };
  }

  const convertedItems: ImportCasItemDto[] = parsed.holdings.map((h) => ({
    isin: h.isin || '',
    name: h.name,
    ticker: h.symbol,
    assetClassId:
      h.assetType === 'mutual_fund'
        ? 'mutual_fund'
        : h.assetType === 'commodity'
          ? 'commodity'
          : 'equity',
    instrumentType:
      h.assetType === 'mutual_fund'
        ? 'mutual_fund_scheme'
        : h.assetType === 'commodity'
          ? 'sovereign_gold_bond'
          : 'equity_share',
    quantity: h.quantity,
    unitCostCents: Number(h.unitCost.cents),
    currentValueCents: Number(h.currentValue?.cents ?? h.unitCost.multiply(h.quantity).cents),
    costBasisVerified: true,
    currency: 'INR',
    selected: true,
  }));

  const convertedTxs: ImportCasTransactionDto[] = parsed.trades.map((t) => ({
    isin: t.isin || '',
    schemeName: t.name,
    ticker: t.symbol,
    date: t.tradeDate,
    description: `${t.rawBroker} ${t.tradeType} ${t.symbol}${t.tradeId ? ` [#${t.tradeId}]` : ''}`,
    type: t.tradeType.toLowerCase() as 'buy' | 'sell',
    amountCents: Number(t.totalAmount.cents),
    units: t.quantity,
    navPriceCents: Number(t.price.cents),
    currency: 'INR',
    selected: true,
  }));

  const totalReportedValueCents = convertedItems.reduce((acc, i) => acc + i.currentValueCents, 0);

  return {
    preview: {
      provider: parsed.provider as StatementProvider,
      statementDate: new Date().toISOString().slice(0, 10),
      items: convertedItems,
      equities: convertedItems.filter((i) => i.assetClassId !== 'mutual_fund'),
      mutualFunds: convertedItems.filter((i) => i.assetClassId === 'mutual_fund'),
      transactions: convertedTxs,
      totalReportedValueCents,
      warnings: parsed.warnings,
    },
  };
}
