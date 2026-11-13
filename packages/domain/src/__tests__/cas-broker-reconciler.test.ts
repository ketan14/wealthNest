import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import { ParsedCasHolding } from '../cas/cas-types.js';
import { ParsedBrokerHolding, ParsedBrokerTrade } from '../importers/broker-csv-types.js';
import { reconcileCasWithBroker } from '../reconciliation/cas-broker-reconciler.js';

describe('Domain: CAS <-> Broker Tradebook Auto-Reconciliation Engine', () => {
  const casHoldings: ParsedCasHolding[] = [
    {
      isin: 'INE002A01018',
      name: 'Reliance Industries Ltd',
      ticker: 'RELIANCE',
      assetType: 'equity',
      assetClassId: 'equity',
      quantity: 80,
      unitCost: Money.fromCents(250000n, 'INR'),
      costBasisVerified: true,
      reportedMarketValue: Money.fromCents(23600000n, 'INR'),
      statementDate: '2026-03-31',
      currency: 'INR',
    },
    {
      isin: 'INF194K01V89',
      name: 'Bandhan Large & Mid Cap Fund',
      ticker: 'BANDHAN-LM',
      assetType: 'mutual_fund',
      assetClassId: 'mutual_fund',
      quantity: 1000,
      costBasisVerified: false,
      reportedMarketValue: Money.fromCents(16600000n, 'INR'),
      statementDate: '2026-03-31',
      currency: 'INR',
    },
    {
      isin: 'INE467B01029',
      name: 'Tata Consultancy Services',
      ticker: 'TCS',
      assetType: 'equity',
      assetClassId: 'equity',
      quantity: 40,
      unitCost: Money.fromCents(360000n, 'INR'),
      costBasisVerified: true,
      reportedMarketValue: Money.fromCents(16600000n, 'INR'),
      statementDate: '2026-03-31',
      currency: 'INR',
    },
  ];

  it('matches holdings by ISIN, flags unverified cost basis, and detects quantity mismatches', () => {
    const brokerHoldings: ParsedBrokerHolding[] = [
      {
        symbol: 'RELIANCE',
        isin: 'INE002A01018',
        name: 'Reliance Industries Ltd',
        quantity: 80,
        unitCost: Money.fromCents(250000n, 'INR'),
        assetType: 'equity',
        rawBroker: 'ZERODHA',
      },
      {
        symbol: 'BANDHAN-LM',
        isin: 'INF194K01V89',
        name: 'Bandhan Large & Mid Cap Fund',
        quantity: 1000,
        unitCost: Money.fromCents(14720n, 'INR'),
        assetType: 'mutual_fund',
        rawBroker: 'GROWW',
      },
      {
        symbol: 'TCS',
        isin: 'INE467B01029',
        name: 'Tata Consultancy Services',
        quantity: 35,
        unitCost: Money.fromCents(360000n, 'INR'),
        assetType: 'equity',
        rawBroker: 'ZERODHA',
      },
    ];

    const summary = reconcileCasWithBroker({ casHoldings, brokerHoldings });
    expect(summary.totalRecords).toBe(3);
    expect(summary.totalMatched).toBe(1);
    expect(summary.unverifiedCostBasisCount).toBe(1);
    expect(summary.quantityMismatchCount).toBe(1);
    expect(summary.reconciliationScorePct).toBe(33.3);

    const tcs = summary.records.find((r) => r.isin === 'INE467B01029');
    expect(tcs?.status).toBe('quantity_mismatch');
    expect(tcs?.quantityDelta).toBe(5);
  });

  it('derives net broker quantities and weighted average cost from tradebook rows', () => {
    const brokerTrades: ParsedBrokerTrade[] = [
      {
        symbol: 'RELIANCE',
        isin: 'INE002A01018',
        name: 'Reliance Industries Ltd',
        tradeDate: '2025-01-10',
        tradeType: 'BUY',
        quantity: 100,
        price: Money.fromCents(250000n, 'INR'),
        totalAmount: Money.fromCents(25000000n, 'INR'),
        rawBroker: 'ZERODHA',
      },
      {
        symbol: 'RELIANCE',
        isin: 'INE002A01018',
        name: 'Reliance Industries Ltd',
        tradeDate: '2025-08-15',
        tradeType: 'SELL',
        quantity: 20,
        price: Money.fromCents(290000n, 'INR'),
        totalAmount: Money.fromCents(5800000n, 'INR'),
        rawBroker: 'ZERODHA',
      },
    ];

    const summary = reconcileCasWithBroker({
      casHoldings: [casHoldings[0]!],
      brokerTrades,
    });

    expect(summary.totalMatched).toBe(1);
    expect(summary.records[0]?.brokerQuantity).toBe(80);
    expect(summary.records[0]?.brokerUnitCostPaise).toBe(250000n);
  });
});

