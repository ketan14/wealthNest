import {
  ParsedBrokerCsvResult,
  ParsedBrokerHolding,
  ParsedBrokerTrade,
} from './broker-csv-types.js';
import {
  parseCsvRows,
  parseCleanNumber,
  parseCleanMoney,
  parseCleanDate,
  INDIAN_SYMBOL_MAP,
} from './csv-utils.js';

export function isZerodhaCsv(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  const upper = content.toUpperCase();
  // Check for typical Zerodha Kite holdings or tradebook headers
  const isHoldings =
    (upper.includes('INSTRUMENT') || upper.includes('SYMBOL')) &&
    (upper.includes('AVG. COST') || upper.includes('AVG COST') || upper.includes('CUR. VAL'));
  const isTradebook =
    upper.includes('TRADE_DATE') &&
    upper.includes('TRADE_TYPE') &&
    (upper.includes('ORDER_ID') || upper.includes('TRADE_ID'));

  return isHoldings || isTradebook;
}

export function parseZerodhaCsv(content: string): ParsedBrokerCsvResult {
  const rows = parseCsvRows(content);
  if (rows.length < 2) {
    return {
      provider: 'ZERODHA',
      csvType: 'HOLDINGS',
      holdings: [],
      trades: [],
      totalRecords: 0,
      warnings: ['Empty or insufficient CSV rows'],
    };
  }

  const headerRow = rows[0]!.map((h) => h.toUpperCase().replace(/[^A-Z0-9_.]/g, ''));
  const isTradebook = headerRow.includes('TRADEDATE') || headerRow.includes('TRADE_DATE');

  if (isTradebook) {
    return parseZerodhaTradebook(rows);
  }
  return parseZerodhaHoldings(rows);
}

function parseZerodhaHoldings(rows: string[][]): ParsedBrokerCsvResult {
  const header = rows[0]!.map((h) => h.trim().toUpperCase());
  const symbolIdx = header.findIndex((h) => h.includes('INSTRUMENT') || h.includes('SYMBOL'));
  const isinIdx = header.findIndex((h) => h === 'ISIN');
  const qtyIdx = header.findIndex((h) => h.startsWith('QTY'));
  const avgCostIdx = header.findIndex((h) => h.includes('AVG') || h.includes('COST'));
  const ltpIdx = header.findIndex((h) => h.includes('LTP') || h.includes('MARKET PRICE'));
  const curValIdx = header.findIndex((h) => h.includes('CUR') || h.includes('CURRENT'));

  const holdings: ParsedBrokerHolding[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 0 || !row[symbolIdx]) continue;

    const rawSymbol = row[symbolIdx]!.trim().toUpperCase();
    if (!rawSymbol || rawSymbol === 'TOTAL') continue;

    const qty = parseCleanNumber(row[qtyIdx]);
    if (qty <= 0) continue;

    const unitCost = parseCleanMoney(row[avgCostIdx]);
    const currentPrice = ltpIdx >= 0 ? parseCleanMoney(row[ltpIdx]) : undefined;
    const currentValue = curValIdx >= 0 ? parseCleanMoney(row[curValIdx]) : undefined;

    const isin = isinIdx >= 0 && row[isinIdx] ? row[isinIdx]!.trim().toUpperCase() : undefined;
    const known = INDIAN_SYMBOL_MAP[rawSymbol];

    const resolvedIsin = isin || known?.isin;
    const name = known?.name || `${rawSymbol} Ltd`;
    const assetType =
      known?.assetType ||
      (rawSymbol.endsWith('BEES') || rawSymbol.includes('ETF')
        ? 'equity'
        : rawSymbol.startsWith('SGB')
        ? 'commodity'
        : 'equity');

    holdings.push({
      symbol: rawSymbol,
      isin: resolvedIsin,
      name,
      quantity: qty,
      unitCost,
      currentPrice,
      currentValue: currentValue || (currentPrice ? currentPrice.multiply(qty) : unitCost.multiply(qty)),
      assetType,
      rawBroker: 'ZERODHA',
    });
  }

  return {
    provider: 'ZERODHA',
    csvType: 'HOLDINGS',
    holdings,
    trades: [],
    totalRecords: holdings.length,
    warnings,
  };
}

function parseZerodhaTradebook(rows: string[][]): ParsedBrokerCsvResult {
  const header = rows[0]!.map((h) => h.trim().toUpperCase().replace(/\s+/g, '_'));
  const symbolIdx = header.findIndex((h) => h === 'SYMBOL' || h.includes('INSTRUMENT'));
  const isinIdx = header.findIndex((h) => h === 'ISIN');
  const dateIdx = header.findIndex((h) => h.includes('DATE'));
  const typeIdx = header.findIndex((h) => h.includes('TYPE'));
  const qtyIdx = header.findIndex((h) => h.startsWith('QTY') || h === 'QUANTITY');
  const priceIdx = header.findIndex((h) => h === 'PRICE' || h.includes('RATE'));
  const exchangeIdx = header.findIndex((h) => h === 'EXCHANGE');
  const tradeIdIdx = header.findIndex((h) => h.includes('TRADE_ID'));
  const orderIdIdx = header.findIndex((h) => h.includes('ORDER_ID'));

  const trades: ParsedBrokerTrade[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 0 || !row[symbolIdx]) continue;

    const symbol = row[symbolIdx]!.trim().toUpperCase();
    if (!symbol) continue;

    const rawType = (row[typeIdx] || 'BUY').trim().toUpperCase();
    const tradeType = rawType.includes('SELL') ? 'SELL' : 'BUY';

    const qty = parseCleanNumber(row[qtyIdx]);
    if (qty <= 0) continue;

    const price = parseCleanMoney(row[priceIdx]);
    const totalAmount = price.multiply(qty);
    const tradeDate = parseCleanDate(row[dateIdx] || '');

    const isin = isinIdx >= 0 && row[isinIdx] ? row[isinIdx]!.trim().toUpperCase() : undefined;
    const known = INDIAN_SYMBOL_MAP[symbol];
    const name = known?.name || `${symbol} Ltd`;
    const exchange =
      exchangeIdx >= 0 && row[exchangeIdx]?.toUpperCase().includes('BSE') ? 'BSE' : 'NSE';

    trades.push({
      symbol,
      isin: isin || known?.isin,
      name,
      tradeDate,
      tradeType,
      quantity: qty,
      price,
      totalAmount,
      exchange,
      tradeId: tradeIdIdx >= 0 ? row[tradeIdIdx]?.trim() : undefined,
      orderId: orderIdIdx >= 0 ? row[orderIdIdx]?.trim() : undefined,
      rawBroker: 'ZERODHA',
    });
  }

  return {
    provider: 'ZERODHA',
    csvType: 'TRADEBOOK',
    holdings: [],
    trades,
    totalRecords: trades.length,
    warnings,
  };
}
