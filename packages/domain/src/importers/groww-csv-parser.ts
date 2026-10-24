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

export function isGrowwCsv(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  const upper = content.toUpperCase();
  // Check for typical Groww headers
  const isHoldings =
    (upper.includes('STOCK NAME') || upper.includes('COMPANY NAME') || upper.includes('SCHEME NAME')) &&
    (upper.includes('AVERAGE PRICE') || upper.includes('AVG BUY PRICE') || upper.includes('AVERAGE NAV') || upper.includes('CURRENT VALUE'));
  const isOrders =
    (upper.includes('STOCK NAME') || upper.includes('COMPANY NAME')) &&
    (upper.includes('ORDER TYPE') || (upper.includes('TYPE') && upper.includes('STATUS')));

  return isHoldings || isOrders;
}

export function parseGrowwCsv(content: string): ParsedBrokerCsvResult {
  const rows = parseCsvRows(content);
  if (rows.length < 2) {
    return {
      provider: 'GROWW',
      csvType: 'HOLDINGS',
      holdings: [],
      trades: [],
      totalRecords: 0,
      warnings: ['Empty or insufficient Groww CSV rows'],
    };
  }

  const headerRow = rows[0]!.map((h) => h.toUpperCase().replace(/\s+/g, '_'));
  const isOrders = headerRow.includes('ORDER_TYPE') || (headerRow.includes('TYPE') && headerRow.includes('STATUS'));

  if (isOrders) {
    return parseGrowwOrders(rows);
  }
  return parseGrowwHoldings(rows);
}

function parseGrowwHoldings(rows: string[][]): ParsedBrokerCsvResult {
  const header = rows[0]!.map((h) => h.trim().toUpperCase());
  const nameIdx = header.findIndex(
    (h) => h.includes('COMPANY') || h.includes('STOCK NAME') || h.includes('SCHEME')
  );
  const symbolIdx = header.findIndex((h) => h === 'SYMBOL' || h === 'TICKER' || h === 'ISIN');
  const qtyIdx = header.findIndex(
    (h) => h.startsWith('QTY') || h.includes('QUANTITY') || h.includes('SHARES') || h.includes('UNITS')
  );
  const avgPriceIdx = header.findIndex(
    (h) => h.includes('AVG') || h.includes('AVERAGE') || h.includes('BUY PRICE')
  );
  const curValIdx = header.findIndex((h) => h.includes('CURRENT VALUE') || h.includes('VALUE'));
  const mktPriceIdx = header.findIndex(
    (h) => h.includes('MARKET PRICE') || h.includes('LTP') || h.includes('CURRENT NAV')
  );

  const holdings: ParsedBrokerHolding[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 0) continue;

    const rawName = (nameIdx >= 0 ? row[nameIdx] : '')?.trim() || '';
    let rawSymbol = (symbolIdx >= 0 ? row[symbolIdx] : '')?.trim().toUpperCase() || '';

    // If symbol not explicitly provided, try to infer from name or use name tokens
    if (!rawSymbol && rawName) {
      const upperName = rawName.toUpperCase();
      if (upperName.includes('RELIANCE')) rawSymbol = 'RELIANCE';
      else if (upperName.includes('TCS') || upperName.includes('TATA CONSULTANCY')) rawSymbol = 'TCS';
      else if (upperName.includes('HDFC BANK')) rawSymbol = 'HDFCBANK';
      else if (upperName.includes('INFOSYS')) rawSymbol = 'INFY';
      else if (upperName.includes('TATA MOTORS')) rawSymbol = 'TATAMOTORS';
      else if (upperName.includes('PARAG PARIKH')) rawSymbol = 'PPFAS-FLEXI';
      else rawSymbol = rawName.split(/\s+/)[0]?.toUpperCase() || 'GROWW-ASSET';
    }

    if (!rawName && !rawSymbol) continue;

    const qty = parseCleanNumber(row[qtyIdx]);
    if (qty <= 0) continue;

    const unitCost = parseCleanMoney(row[avgPriceIdx]);
    const currentPrice = mktPriceIdx >= 0 ? parseCleanMoney(row[mktPriceIdx]) : undefined;
    const currentValue = curValIdx >= 0 ? parseCleanMoney(row[curValIdx]) : undefined;

    const known = INDIAN_SYMBOL_MAP[rawSymbol];
    const isMutualFund =
      rawName.toLowerCase().includes('fund') ||
      rawName.toLowerCase().includes('growth') ||
      rawSymbol.startsWith('INF');

    const assetType = isMutualFund ? 'mutual_fund' : known?.assetType || 'equity';

    holdings.push({
      symbol: rawSymbol,
      isin: known?.isin,
      name: rawName || known?.name || `${rawSymbol} Ltd`,
      quantity: qty,
      unitCost,
      currentPrice,
      currentValue: currentValue || (currentPrice ? currentPrice.multiply(qty) : unitCost.multiply(qty)),
      assetType,
      rawBroker: 'GROWW',
    });
  }

  return {
    provider: 'GROWW',
    csvType: 'HOLDINGS',
    holdings,
    trades: [],
    totalRecords: holdings.length,
    warnings,
  };
}

function parseGrowwOrders(rows: string[][]): ParsedBrokerCsvResult {
  const header = rows[0]!.map((h) => h.trim().toUpperCase());
  const nameIdx = header.findIndex(
    (h) => h.includes('STOCK') || h.includes('COMPANY') || h.includes('NAME')
  );
  const typeIdx = header.findIndex((h) => h.includes('TYPE'));
  const dateIdx = header.findIndex((h) => h.includes('DATE') || h.includes('TIME'));
  const qtyIdx = header.findIndex(
    (h) => h.includes('QTY') || h.includes('QUANTITY') || h.includes('SHARES')
  );
  const priceIdx = header.findIndex((h) => h.includes('PRICE') || h.includes('RATE'));

  const trades: ParsedBrokerTrade[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 0) continue;

    const rawName = (nameIdx >= 0 ? row[nameIdx] : '')?.trim() || '';
    if (!rawName) continue;

    const rawType = (row[typeIdx] || 'BUY').trim().toUpperCase();
    const tradeType = rawType.includes('SELL') ? 'SELL' : 'BUY';

    const qty = parseCleanNumber(row[qtyIdx]);
    if (qty <= 0) continue;

    const price = parseCleanMoney(row[priceIdx]);
    const totalAmount = price.multiply(qty);
    const tradeDate = parseCleanDate(row[dateIdx] || '');

    let symbol = rawName.toUpperCase();
    if (symbol.includes('RELIANCE')) symbol = 'RELIANCE';
    else if (symbol.includes('TCS') || symbol.includes('TATA CONSULTANCY')) symbol = 'TCS';
    else if (symbol.includes('HDFC BANK')) symbol = 'HDFCBANK';
    else if (symbol.includes('INFOSYS')) symbol = 'INFY';

    const known = INDIAN_SYMBOL_MAP[symbol];

    trades.push({
      symbol,
      isin: known?.isin,
      name: rawName,
      tradeDate,
      tradeType,
      quantity: qty,
      price,
      totalAmount,
      exchange: 'NSE',
      rawBroker: 'GROWW',
    });
  }

  return {
    provider: 'GROWW',
    csvType: 'TRADEBOOK',
    holdings: [],
    trades,
    totalRecords: trades.length,
    warnings,
  };
}
