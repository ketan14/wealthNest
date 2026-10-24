import { describe, it, expect } from 'vitest';
import {
  parseZerodhaCsv,
  parseGrowwCsv,
  detectAndParseBrokerCsv,
} from '../index.js';

describe('Broker CSV Importers (Zerodha Kite & Groww)', () => {
  describe('Zerodha Kite Holdings CSV', () => {
    const sampleZerodhaHoldings = `
Instrument,Qty.,Avg. cost,LTP,Cur. val,P&L,Net chg.,Day chg.
RELIANCE,80,2500.00,2950.00,"2,36,000.00","36,000.00",18.00,1.25
TCS,40,"3,600.00","4,150.00","1,66,000.00","22,000.00",15.28,-0.45
GOLDBEES,500,52.50,58.20,29100.00,2850.00,10.86,0.34
`;

    it('parses Zerodha holdings with integer paise zero drift', () => {
      const result = parseZerodhaCsv(sampleZerodhaHoldings);

      expect(result.provider).toBe('ZERODHA');
      expect(result.csvType).toBe('HOLDINGS');
      expect(result.holdings.length).toBe(3);

      // Reliance
      const rel = result.holdings.find((h) => h.symbol === 'RELIANCE');
      expect(rel).toBeDefined();
      expect(rel?.isin).toBe('INE002A01018');
      expect(rel?.quantity).toBe(80);
      expect(rel?.unitCost.cents).toBe(250000n); // ₹2,500.00
      expect(rel?.currentPrice?.cents).toBe(295000n); // ₹2,950.00
      expect(rel?.currentValue?.cents).toBe(23600000n); // ₹2,36,000.00
      expect(rel?.assetType).toBe('equity');

      // TCS
      const tcs = result.holdings.find((h) => h.symbol === 'TCS');
      expect(tcs).toBeDefined();
      expect(tcs?.isin).toBe('INE467B01029');
      expect(tcs?.quantity).toBe(40);
      expect(tcs?.unitCost.cents).toBe(360000n);

      // Gold BeES
      const gold = result.holdings.find((h) => h.symbol === 'GOLDBEES');
      expect(gold).toBeDefined();
      expect(gold?.assetType).toBe('commodity');
      expect(gold?.quantity).toBe(500);
      expect(gold?.unitCost.cents).toBe(5250n); // ₹52.50
    });
  });

  describe('Zerodha Tradebook CSV', () => {
    const sampleZerodhaTradebook = `
symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,trade_id,order_id,order_execution_time
RELIANCE,INE002A01018,2024-03-15,NSE,EQ,EQ,buy,50,2500.00,123456,987654,2024-03-15 11:20:15
TCS,INE467B01029,2024-04-10,NSE,EQ,EQ,buy,40,3600.00,123457,987655,2024-04-10 14:15:30
RELIANCE,INE002A01018,2024-05-20,NSE,EQ,EQ,sell,10,2900.00,123458,987656,2024-05-20 10:05:00
`;

    it('parses Zerodha tradebook with buy and sell orders', () => {
      const result = parseZerodhaCsv(sampleZerodhaTradebook);

      expect(result.provider).toBe('ZERODHA');
      expect(result.csvType).toBe('TRADEBOOK');
      expect(result.trades.length).toBe(3);

      const [buy1, buy2, sell1] = result.trades;

      expect(buy1?.symbol).toBe('RELIANCE');
      expect(buy1?.tradeType).toBe('BUY');
      expect(buy1?.quantity).toBe(50);
      expect(buy1?.price.cents).toBe(250000n);
      expect(buy1?.totalAmount.cents).toBe(12500000n); // 50 * ₹2,500 = ₹1,25,000
      expect(buy1?.tradeDate).toBe('2024-03-15');

      expect(sell1?.symbol).toBe('RELIANCE');
      expect(sell1?.tradeType).toBe('SELL');
      expect(sell1?.quantity).toBe(10);
      expect(sell1?.price.cents).toBe(290000n);
      expect(sell1?.totalAmount.cents).toBe(2900000n); // 10 * ₹2,900 = ₹29,000
    });
  });

  describe('Groww Holdings CSV', () => {
    const sampleGrowwHoldings = `
Company Name,Symbol,Shares,Average Price,Current Value,Market Price
Reliance Industries Ltd,RELIANCE,30,"2,480.00","88,500.00","2,950.00"
Tata Consultancy Services Ltd,TCS,20,"3,550.00","83,000.00","4,150.00"
Parag Parikh Flexi Cap Fund Direct-Growth,PPFAS-FLEXI,1000,55.00,78450.00,78.45
`;

    it('parses Groww holdings containing equities and mutual funds', () => {
      const result = parseGrowwCsv(sampleGrowwHoldings);

      expect(result.provider).toBe('GROWW');
      expect(result.csvType).toBe('HOLDINGS');
      expect(result.holdings.length).toBe(3);

      const rel = result.holdings.find((h) => h.symbol === 'RELIANCE');
      expect(rel?.quantity).toBe(30);
      expect(rel?.unitCost.cents).toBe(248000n);
      expect(rel?.assetType).toBe('equity');

      const mf = result.holdings.find((h) => h.name.includes('Parag Parikh'));
      expect(mf).toBeDefined();
      expect(mf?.quantity).toBe(1000);
      expect(mf?.unitCost.cents).toBe(5500n);
      expect(mf?.assetType).toBe('mutual_fund');
    });
  });

  describe('Groww Orders CSV', () => {
    const sampleGrowwOrders = `
Stock Name,Order Type,Date,Quantity,Average Price,Status
Reliance Industries,BUY,12-Apr-2024,25,2520.00,EXECUTED
Infosys,BUY,18-Apr-2024,50,1420.00,EXECUTED
`;

    it('parses Groww orders successfully with date normalization', () => {
      const result = parseGrowwCsv(sampleGrowwOrders);

      expect(result.provider).toBe('GROWW');
      expect(result.csvType).toBe('TRADEBOOK');
      expect(result.trades.length).toBe(2);

      const trade1 = result.trades[0];
      expect(trade1?.symbol).toBe('RELIANCE');
      expect(trade1?.tradeType).toBe('BUY');
      expect(trade1?.quantity).toBe(25);
      expect(trade1?.price.cents).toBe(252000n);
      expect(trade1?.tradeDate).toBe('2024-04-12');
    });
  });

  describe('Auto-Detection Registry', () => {
    it('detects Zerodha and Groww CSV formats automatically', () => {
      const zerodhaSample = 'Instrument,Qty.,Avg. cost,LTP,Cur. val\nRELIANCE,10,2500,2900,29000';
      const growwSample = 'Company Name,Symbol,Shares,Average Price,Current Value\nInfosys,INFY,20,1500,30000';

      const res1 = detectAndParseBrokerCsv(zerodhaSample);
      expect(res1.provider).toBe('ZERODHA');
      expect(res1.holdings.length).toBe(1);

      const res2 = detectAndParseBrokerCsv(growwSample);
      expect(res2.provider).toBe('GROWW');
      expect(res2.holdings.length).toBe(1);
    });

    it('handles empty or malformed CSV safely', () => {
      const res = detectAndParseBrokerCsv('');
      expect(res.totalRecords).toBe(0);
      expect(res.warnings.length).toBeGreaterThan(0);
    });
  });
});
