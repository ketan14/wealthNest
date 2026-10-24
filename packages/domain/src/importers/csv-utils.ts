import { Money } from '../money/money.js';

/**
 * Robust CSV line tokenizer that respects quotes and internal commas.
 */
export function parseCsvRows(content: string): string[][] {
  if (!content || typeof content !== 'string') return [];

  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const row: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Cleans monetary and numeric string into pure float number.
 * Removes commas ("2,950.00" -> 2950.0), currency symbols ("₹", "Rs."), extra spaces.
 */
export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val || typeof val !== 'string') return 0;

  const cleaned = val
    .replace(/[₹$,]/g, '')
    .replace(/Rs\.?/gi, '')
    .trim();

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Converts float currency into Money Value Object with zero floating-point drift (integer paise).
 */
export function parseCleanMoney(val: any, currency = 'INR'): Money {
  const num = parseCleanNumber(val);
  const paise = BigInt(Math.round(num * 100));
  return Money.fromCents(paise, currency as any);
}

/**
 * Normalizes dates from various Indian formats (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-Mon-YYYY)
 * to standard ISO YYYY-MM-DD.
 */
export function parseCleanDate(val: string): string {
  if (!val || typeof val !== 'string') return new Date().toISOString().slice(0, 10);
  const trimmed = val.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1]!.padStart(2, '0');
    const month = dmyMatch[2]!.padStart(2, '0');
    const year = dmyMatch[3]!;
    return `${year}-${month}-${day}`;
  }

  // Date object parse fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Standard known Indian securities for name & ISIN resolution when brokers export only symbols.
 */
export const INDIAN_SYMBOL_MAP: Record<
  string,
  { isin: string; name: string; assetType: 'equity' | 'mutual_fund' | 'commodity' }
> = {
  RELIANCE: { isin: 'INE002A01018', name: 'Reliance Industries Ltd', assetType: 'equity' },
  TCS: { isin: 'INE467B01029', name: 'Tata Consultancy Services Ltd', assetType: 'equity' },
  HDFCBANK: { isin: 'INE040A01034', name: 'HDFC Bank Ltd', assetType: 'equity' },
  INFY: { isin: 'INE009A01021', name: 'Infosys Ltd', assetType: 'equity' },
  TATAMOTORS: { isin: 'INE155A01022', name: 'Tata Motors Ltd', assetType: 'equity' },
  SBIN: { isin: 'INE062A01020', name: 'State Bank of India', assetType: 'equity' },
  ICICIBANK: { isin: 'INE090A01021', name: 'ICICI Bank Ltd', assetType: 'equity' },
  BHARTIARTL: { isin: 'INE397D01024', name: 'Bharti Airtel Ltd', assetType: 'equity' },
  ITC: { isin: 'INE154A01025', name: 'ITC Ltd', assetType: 'equity' },
  LT: { isin: 'INE018A01030', name: 'Larsen & Toubro Ltd', assetType: 'equity' },
  GOLDBEES: { isin: 'INF204KB14I2', name: 'Nippon India ETF Gold BeES', assetType: 'commodity' },
  NIFTYBEES: { isin: 'INF209K01164', name: 'Nippon India Nifty 50 BeES ETF', assetType: 'equity' },
  'SGB-2028': { isin: 'IN0020180017', name: 'Sovereign Gold Bond 2028', assetType: 'commodity' },
};
